-- =============================================================================
-- Irie's Cuisine — business logic in the database
--
-- Rule of thumb: anything that must never be wrong (state transitions, payment
-- confirmation, refund limits) lives here, inside a transaction, guarded by row
-- locks. The web app calls these functions; it never updates orders directly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so RLS policies can use them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = public
as $$
  select s.role from public.staff s where s.user_id = (select auth.uid()) and s.is_active;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff s where s.user_id = (select auth.uid()) and s.is_active);
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff s
     where s.user_id = (select auth.uid()) and s.is_active and s.role in ('manager', 'owner')
  );
$$;

create or replace function public.has_staff_role(p_roles public.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff s
     where s.user_id = (select auth.uid()) and s.is_active and s.role = any (p_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- Audit helper
-- ---------------------------------------------------------------------------
create or replace function public.write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_details jsonb default '{}'::jsonb,
  p_actor_id uuid default null,
  p_actor_role text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, details)
  values (
    coalesce(p_actor_id, (select auth.uid())),
    coalesce(p_actor_role, (select public.current_staff_role())::text, case when (select auth.uid()) is null then 'system' end),
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- New auth user -> profile row (customers sign in with phone OTP)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, email)
  values (
    new.id,
    case
      when new.phone is null or new.phone = '' then null
      when left(new.phone, 1) = '+' then new.phone
      else '+' || new.phone
    end,
    nullif(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Marketing consent timestamp (Data Protection Act, 2012 (Act 843): keep proof of consent)
create or replace function public.profiles_consent_timestamp()
returns trigger
language plpgsql
as $$
begin
  if new.marketing_consent is distinct from coalesce(old.marketing_consent, false) then
    new.marketing_consent_at := case when new.marketing_consent then now() else null end;
  end if;
  return new;
end;
$$;

create trigger profiles_consent_timestamp
  before insert or update of marketing_consent on public.profiles
  for each row execute function public.profiles_consent_timestamp();

-- ---------------------------------------------------------------------------
-- Order state machine
-- ---------------------------------------------------------------------------
create or replace function public._transition_order(
  p_order_id uuid,
  p_to public.order_status,
  p_actor_role text,
  p_actor_id uuid,
  p_note text default null,
  p_prep_minutes integer default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_from public.order_status;
  v_allowed text[];
  v_prep integer;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  v_from := v_order.status;

  -- Idempotent: a repeated tap or a retry after a network drop is harmless.
  if v_from = p_to then
    return v_order;
  end if;

  select t.allowed_roles into v_allowed
    from public.order_status_transitions t
   where t.from_status = v_from and t.to_status = p_to;

  if v_allowed is null then
    raise exception 'invalid_transition:%->%', v_from, p_to using errcode = 'P0001';
  end if;
  if not (p_actor_role = any (v_allowed)) then
    raise exception 'forbidden_transition:%->%:%', v_from, p_to, p_actor_role using errcode = '42501';
  end if;

  -- Business guards that the transition table cannot express
  if p_to = 'out_for_delivery' and v_order.fulfilment <> 'delivery' then
    raise exception 'not_a_delivery_order' using errcode = 'P0001';
  end if;
  if p_to = 'ready_for_pickup' and v_order.fulfilment <> 'pickup' then
    raise exception 'not_a_pickup_order' using errcode = 'P0001';
  end if;
  if p_to = 'paid' and v_order.paid_payment_id is null then
    raise exception 'payment_missing' using errcode = 'P0001';
  end if;
  if v_from = 'cancelled' and p_to = 'paid' and v_order.cancel_reason is distinct from 'payment_timeout' then
    raise exception 'order_not_revivable' using errcode = 'P0001';
  end if;
  if p_to = 'refunded' and v_order.paid_payment_id is null then
    raise exception 'order_never_paid' using errcode = 'P0001';
  end if;
  if p_to in ('rejected', 'cancelled') and p_actor_role not in ('system', 'customer') and v_note is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  if p_to = 'accepted' then
    v_prep := coalesce(p_prep_minutes, (select s.default_prep_minutes from public.store_settings s where s.id = 1), 25);
    if v_prep < 1 or v_prep > 600 then
      raise exception 'invalid_prep_minutes' using errcode = 'P0001';
    end if;
  end if;

  update public.orders o set
    status              = p_to,
    paid_at             = case when p_to = 'paid' then now() else o.paid_at end,
    accepted_at         = case when p_to = 'accepted' then now() else o.accepted_at end,
    prep_minutes        = case when p_to = 'accepted' then v_prep else o.prep_minutes end,
    estimated_ready_at  = case when p_to = 'accepted' then
                            greatest(
                              now() + make_interval(mins => v_prep),
                              coalesce(
                                o.scheduled_for - make_interval(mins => case when o.fulfilment = 'delivery'
                                                                             then coalesce(o.zone_eta_minutes, 0) else 0 end),
                                '-infinity'::timestamptz))
                          else o.estimated_ready_at end,
    rejected_at         = case when p_to = 'rejected' then now() else o.rejected_at end,
    reject_reason       = case when p_to = 'rejected' then v_note else o.reject_reason end,
    kitchen_started_at  = case when p_to = 'in_kitchen' then now() else o.kitchen_started_at end,
    ready_at            = case when p_to = 'ready' then now() else o.ready_at end,
    dispatched_at       = case when p_to = 'out_for_delivery' then now() else o.dispatched_at end,
    ready_for_pickup_at = case when p_to = 'ready_for_pickup' then now() else o.ready_for_pickup_at end,
    delivered_at        = case when p_to = 'delivered' then now() else o.delivered_at end,
    completed_at        = case when p_to = 'completed' then now() else o.completed_at end,
    cancelled_at        = case when p_to = 'cancelled' then now()
                               when p_to = 'paid' then null
                               else o.cancelled_at end,
    cancel_reason       = case when p_to = 'cancelled' then
                                 coalesce(v_note, case when p_actor_role = 'customer' then 'Cancelled by customer' else 'Cancelled' end)
                               when p_to = 'paid' then null
                               else o.cancel_reason end,
    refunded_at         = case when p_to = 'refunded' then now() else o.refunded_at end
  where o.id = p_order_id
  returning * into v_order;

  insert into public.order_events (order_id, from_status, to_status, actor_id, actor_role, note)
  values (p_order_id, v_from, p_to, p_actor_id, p_actor_role, v_note);

  if p_to = 'rejected' or (p_to = 'cancelled' and v_from <> 'awaiting_payment') then
    perform public.write_audit(
      case when p_to = 'rejected' then 'order_rejected' else 'order_cancelled' end,
      'order', p_order_id::text,
      jsonb_build_object('order_number', v_order.order_number, 'from', v_from, 'reason', v_note,
                         'total_pesewas', v_order.total_pesewas),
      p_actor_id, p_actor_role);
  end if;

  return v_order;
end;
$$;

-- Staff / customer entry point: the role comes from the database, never from the client.
create or replace function public.transition_order(
  p_order_id uuid,
  p_to public.order_status,
  p_note text default null,
  p_prep_minutes integer default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_customer uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select s.role::text into v_role from public.staff s where s.user_id = v_uid and s.is_active;

  if v_role is null then
    select o.customer_id into v_customer from public.orders o where o.id = p_order_id;
    if v_customer is not null and v_customer = v_uid then
      v_role := 'customer';
    else
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  return public._transition_order(p_order_id, p_to, v_role, v_uid, p_note, p_prep_minutes);
end;
$$;

-- Server-only entry point (payment confirmations, timeouts, auto-complete, refunds).
create or replace function public.system_transition_order(
  p_order_id uuid,
  p_to public.order_status,
  p_note text default null
)
returns public.orders
language sql
security definer
set search_path = public
as $$
  select * from public._transition_order(p_order_id, p_to, 'system', null, p_note, null);
$$;

-- ---------------------------------------------------------------------------
-- Order creation (server-only; prices are computed on the server from the DB)
-- ---------------------------------------------------------------------------
create or replace function public.create_order(
  p_order jsonb,
  p_items jsonb,
  p_actor_role text default 'customer',
  p_actor_id uuid default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_sum integer;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order' using errcode = 'P0001';
  end if;

  insert into public.orders (
    customer_id, customer_name, customer_phone, customer_email, channel, fulfilment,
    zone_id, zone_name, zone_eta_minutes,
    address_gps, address_landmark, address_directions, address_lat, address_lng,
    scheduled_for, notes,
    subtotal_pesewas, delivery_fee_pesewas, discount_pesewas, total_pesewas, created_by
  ) values (
    nullif(p_order ->> 'customer_id', '')::uuid,
    p_order ->> 'customer_name',
    p_order ->> 'customer_phone',
    nullif(p_order ->> 'customer_email', ''),
    coalesce(nullif(p_order ->> 'channel', ''), 'web')::public.order_channel,
    (p_order ->> 'fulfilment')::public.fulfilment_type,
    nullif(p_order ->> 'zone_id', '')::uuid,
    nullif(p_order ->> 'zone_name', ''),
    nullif(p_order ->> 'zone_eta_minutes', '')::integer,
    nullif(p_order ->> 'address_gps', ''),
    nullif(p_order ->> 'address_landmark', ''),
    nullif(p_order ->> 'address_directions', ''),
    nullif(p_order ->> 'address_lat', '')::numeric,
    nullif(p_order ->> 'address_lng', '')::numeric,
    nullif(p_order ->> 'scheduled_for', '')::timestamptz,
    nullif(p_order ->> 'notes', ''),
    (p_order ->> 'subtotal_pesewas')::integer,
    coalesce(nullif(p_order ->> 'delivery_fee_pesewas', '')::integer, 0),
    coalesce(nullif(p_order ->> 'discount_pesewas', '')::integer, 0),
    (p_order ->> 'total_pesewas')::integer,
    nullif(p_order ->> 'created_by', '')::uuid
  )
  returning * into v_order;

  insert into public.order_items (
    order_id, menu_item_id, portion_id, item_name, portion_name, modifiers,
    unit_price_pesewas, quantity, line_total_pesewas, notes
  )
  select
    v_order.id,
    nullif(i ->> 'menu_item_id', '')::uuid,
    nullif(i ->> 'portion_id', '')::uuid,
    i ->> 'item_name',
    nullif(i ->> 'portion_name', ''),
    coalesce(i -> 'modifiers', '[]'::jsonb),
    (i ->> 'unit_price_pesewas')::integer,
    (i ->> 'quantity')::integer,
    (i ->> 'line_total_pesewas')::integer,
    nullif(i ->> 'notes', '')
  from jsonb_array_elements(p_items) as i;

  select sum(oi.line_total_pesewas) into v_sum from public.order_items oi where oi.order_id = v_order.id;
  if v_sum is distinct from v_order.subtotal_pesewas then
    raise exception 'subtotal_mismatch' using errcode = 'P0001';
  end if;

  insert into public.order_events (order_id, from_status, to_status, actor_id, actor_role, note)
  values (v_order.id, null, 'awaiting_payment', p_actor_id, p_actor_role, 'Order created (' || v_order.channel || ')');

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payment confirmation (server-only, called after verifying with the gateway)
-- Idempotent and safe under duplicate / concurrent webhook deliveries.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_payment(
  p_reference text,
  p_amount_pesewas integer,
  p_currency text,
  p_channel text,
  p_provider_transaction_id text,
  p_fees_pesewas integer,
  p_paid_at timestamptz,
  p_gateway_response text,
  p_raw jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_revived boolean := false;
begin
  -- Lock the payment row first; concurrent duplicate callbacks queue up here.
  select * into v_payment from public.payments where reference = p_reference for update;
  if not found then
    return jsonb_build_object('result', 'unknown_reference');
  end if;

  if v_payment.status = 'success' then
    return jsonb_build_object('result', 'already_processed', 'order_id', v_payment.order_id, 'payment_id', v_payment.id);
  end if;

  if p_amount_pesewas is distinct from v_payment.amount_pesewas
     or upper(coalesce(p_currency, '')) is distinct from upper(v_payment.currency) then
    update public.payments
       set status = 'amount_mismatch', gateway_response = p_gateway_response, raw = p_raw, last_checked_at = now()
     where id = v_payment.id;
    perform public.write_audit('payment_amount_mismatch', 'payment', v_payment.id::text,
      jsonb_build_object('reference', p_reference, 'expected', v_payment.amount_pesewas, 'received', p_amount_pesewas,
                         'currency', p_currency), null, 'system');
    return jsonb_build_object('result', 'amount_mismatch', 'order_id', v_payment.order_id, 'payment_id', v_payment.id);
  end if;

  update public.payments set
    status = 'success',
    channel = coalesce(p_channel, channel),
    provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
    fees_pesewas = coalesce(p_fees_pesewas, fees_pesewas),
    paid_at = coalesce(p_paid_at, now()),
    gateway_response = p_gateway_response,
    raw = p_raw,
    last_checked_at = now()
  where id = v_payment.id;

  select * into v_order from public.orders where id = v_payment.order_id for update;

  if v_order.status = 'awaiting_payment'
     or (v_order.status = 'cancelled' and v_order.cancel_reason = 'payment_timeout' and v_order.paid_payment_id is null) then
    v_revived := v_order.status = 'cancelled';
    update public.orders set paid_payment_id = v_payment.id where id = v_order.id;
    perform public._transition_order(v_order.id, 'paid', 'system', null,
      'Payment confirmed (' || coalesce(p_channel, 'unknown') || ', ref ' || p_reference || ')', null);
    return jsonb_build_object('result', 'paid', 'order_id', v_order.id, 'payment_id', v_payment.id, 'revived', v_revived);
  end if;

  -- The order was already paid by another attempt, or cancelled by the customer:
  -- the money must go back. The caller issues an automatic refund.
  perform public.write_audit('payment_needs_refund', 'payment', v_payment.id::text,
    jsonb_build_object('reference', p_reference, 'order_status', v_order.status,
                       'reason', case when v_order.paid_payment_id is not null then 'duplicate_payment' else 'order_not_payable' end),
    null, 'system');
  return jsonb_build_object(
    'result', 'needs_refund',
    'reason', case when v_order.paid_payment_id is not null then 'duplicate_payment' else 'order_not_payable' end,
    'order_id', v_order.id,
    'payment_id', v_payment.id,
    'amount_pesewas', v_payment.amount_pesewas);
end;
$$;

-- Record a non-success gateway state without ever downgrading a successful payment.
create or replace function public.record_payment_state(
  p_reference text,
  p_status public.payment_status,
  p_gateway_response text,
  p_raw jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.payments
     set status = p_status,
         gateway_response = coalesce(p_gateway_response, gateway_response),
         raw = coalesce(p_raw, raw),
         last_checked_at = now()
   where reference = p_reference
     and status not in ('success', 'amount_mismatch');
$$;

-- ---------------------------------------------------------------------------
-- Refunds (two-step so concurrent clicks can never refund twice)
-- 1. reserve_refund: validates the amount under a row lock, inserts 'pending'
-- 2. server calls the gateway
-- 3. finalize_refund: records the gateway's answer, moves order to 'refunded' when fully refunded
-- ---------------------------------------------------------------------------
create or replace function public._recompute_order_refunds(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  select coalesce(sum(r.amount_pesewas), 0) into v_total
    from public.refunds r
    join public.orders o on o.id = r.order_id
   where r.order_id = p_order_id
     and r.payment_id = o.paid_payment_id
     and r.status <> 'failed';
  update public.orders set refunded_pesewas = v_total where id = p_order_id;
  return v_total;
end;
$$;

create or replace function public.reserve_refund(
  p_order_id uuid,
  p_payment_id uuid,
  p_amount_pesewas integer,      -- null = everything still refundable on that payment
  p_reason text,
  p_requested_by uuid,
  p_requested_role text,
  p_is_automatic boolean default false
)
returns public.refunds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_payment public.payments;
  v_already integer;
  v_refundable integer;
  v_amount integer;
  v_refund public.refunds;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  select * into v_payment from public.payments
   where id = coalesce(p_payment_id, v_order.paid_payment_id) and order_id = p_order_id;
  if not found or v_payment.status <> 'success' then
    raise exception 'payment_not_refundable' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount_pesewas), 0) into v_already
    from public.refunds where payment_id = v_payment.id and status <> 'failed';

  v_refundable := v_payment.amount_pesewas - v_already;
  v_amount := coalesce(p_amount_pesewas, v_refundable);

  if v_refundable <= 0 then
    raise exception 'nothing_to_refund' using errcode = 'P0001';
  end if;
  if v_amount <= 0 or v_amount > v_refundable then
    raise exception 'refund_amount_invalid:max=%', v_refundable using errcode = 'P0001';
  end if;
  if coalesce(length(btrim(p_reason)), 0) < 3 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  insert into public.refunds (order_id, payment_id, amount_pesewas, reason, status, requested_by, requested_role, is_automatic)
  values (p_order_id, v_payment.id, v_amount, btrim(p_reason), 'pending', p_requested_by, p_requested_role, p_is_automatic)
  returning * into v_refund;

  perform public._recompute_order_refunds(p_order_id);

  perform public.write_audit('refund_requested', 'order', p_order_id::text,
    jsonb_build_object('order_number', v_order.order_number, 'refund_id', v_refund.id, 'amount_pesewas', v_amount,
                       'payment_reference', v_payment.reference, 'reason', btrim(p_reason), 'automatic', p_is_automatic),
    p_requested_by, p_requested_role);

  return v_refund;
end;
$$;

create or replace function public.finalize_refund(
  p_refund_id uuid,
  p_ok boolean,
  p_provider_refund_id text,
  p_provider_status text,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund public.refunds;
  v_order public.orders;
  v_status public.refund_status;
  v_refunded integer;
  v_order_refunded boolean := false;
begin
  select * into v_refund from public.refunds where id = p_refund_id;
  if not found then
    raise exception 'refund_not_found' using errcode = 'P0002';
  end if;
  select * into v_order from public.orders where id = v_refund.order_id for update;

  if not p_ok or lower(coalesce(p_provider_status, '')) = 'failed' then
    update public.refunds set status = 'failed', error = left(coalesce(p_error, 'Gateway reported failure'), 1000)
     where id = p_refund_id;
    perform public._recompute_order_refunds(v_refund.order_id);
    perform public.write_audit('refund_failed', 'order', v_refund.order_id::text,
      jsonb_build_object('refund_id', p_refund_id, 'error', left(coalesce(p_error, 'Gateway reported failure'), 500)),
      null, 'system');
    return jsonb_build_object('result', 'failed');
  end if;

  v_status := case lower(coalesce(p_provider_status, 'pending'))
                when 'processed' then 'processed'
                when 'processing' then 'processing'
                when 'failed' then 'failed'
                else 'pending'
              end;

  update public.refunds
     set provider_refund_id = coalesce(p_provider_refund_id, provider_refund_id),
         status = v_status,
         processed_at = case when v_status = 'processed' then now() else processed_at end
   where id = p_refund_id;

  v_refunded := public._recompute_order_refunds(v_refund.order_id);

  if v_refund.payment_id = v_order.paid_payment_id
     and v_refunded >= v_order.total_pesewas
     and v_order.status <> 'refunded'
     and exists (select 1 from public.order_status_transitions t
                  where t.from_status = v_order.status and t.to_status = 'refunded') then
    perform public._transition_order(v_order.id, 'refunded', 'system', null, 'Full refund issued', null);
    v_order_refunded := true;
  end if;

  return jsonb_build_object('result', 'ok', 'status', v_status, 'order_refunded', v_order_refunded,
                            'refunded_pesewas', v_refunded);
end;
$$;

-- Webhook / cron update of a refund's gateway status.
create or replace function public.update_refund_status(
  p_provider_refund_id text,
  p_transaction_reference text,
  p_amount_pesewas integer,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund public.refunds;
  v_status public.refund_status;
begin
  v_status := case lower(coalesce(p_status, ''))
                when 'processed' then 'processed'
                when 'processing' then 'processing'
                when 'failed' then 'failed'
                when 'pending' then 'pending'
                else null
              end;
  if v_status is null then
    return jsonb_build_object('result', 'ignored_status');
  end if;

  if p_provider_refund_id is not null then
    select * into v_refund from public.refunds where provider_refund_id = p_provider_refund_id for update;
  end if;

  if v_refund.id is null and p_transaction_reference is not null then
    select r.* into v_refund
      from public.refunds r
      join public.payments p on p.id = r.payment_id
     where p.reference = p_transaction_reference
       and (p_amount_pesewas is null or r.amount_pesewas = p_amount_pesewas)
       and r.status in ('pending', 'processing')
     order by r.created_at
     limit 1
     for update of r;
  end if;

  if v_refund.id is null then
    return jsonb_build_object('result', 'unknown_refund');
  end if;

  if v_refund.status = v_status or v_refund.status in ('processed', 'failed') then
    return jsonb_build_object('result', 'unchanged', 'refund_id', v_refund.id);
  end if;

  update public.refunds
     set status = v_status,
         provider_refund_id = coalesce(provider_refund_id, p_provider_refund_id),
         processed_at = case when v_status = 'processed' then now() else processed_at end
   where id = v_refund.id;

  if v_status = 'failed' then
    perform public._recompute_order_refunds(v_refund.order_id);
    perform public.write_audit('refund_failed', 'order', v_refund.order_id::text,
      jsonb_build_object('refund_id', v_refund.id, 'source', 'gateway'), null, 'system');
  end if;

  return jsonb_build_object('result', 'updated', 'refund_id', v_refund.id, 'status', v_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- Housekeeping (called by the scheduled job)
-- ---------------------------------------------------------------------------
create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timeout integer := coalesce((select payment_timeout_minutes from public.store_settings where id = 1), 45);
  v_count integer := 0;
  r record;
begin
  for r in
    select o.id from public.orders o
     where o.status = 'awaiting_payment'
       and o.created_at < now() - make_interval(mins => v_timeout)
       -- give a MoMo prompt that is still open a little longer
       and not exists (select 1 from public.payments p
                        where p.order_id = o.id and p.status = 'pending'
                          and p.created_at > now() - make_interval(mins => v_timeout + 15))
     for update skip locked
  loop
    perform public._transition_order(r.id, 'cancelled', 'system', null, 'payment_timeout', null);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.auto_complete_orders(p_after_minutes integer default 120)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select o.id from public.orders o
     where o.status = 'delivered' and o.delivered_at < now() - make_interval(mins => p_after_minutes)
     for update skip locked
  loop
    perform public._transition_order(r.id, 'completed', 'system', null, 'Auto-completed', null);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits as rl (key, window_start, hits)
  values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = rl.hits + 1
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

create or replace function public.maintenance_cleanup()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
  delete from public.webhook_events where received_at < now() - interval '180 days';
$$;

-- ---------------------------------------------------------------------------
-- Staff conveniences (role-checked)
-- ---------------------------------------------------------------------------
create or replace function public.set_item_availability(p_item_id uuid, p_available boolean)
returns public.menu_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.menu_items;
begin
  if not public.has_staff_role(array['attendant', 'kitchen', 'manager', 'owner']::public.staff_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.menu_items set is_available = p_available where id = p_item_id returning * into v_item;
  if not found then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  return v_item;
end;
$$;

create or replace function public.set_option_availability(p_option_id uuid, p_available boolean)
returns public.modifier_options
language plpgsql
security definer
set search_path = public
as $$
declare
  v_option public.modifier_options;
begin
  if not public.has_staff_role(array['attendant', 'kitchen', 'manager', 'owner']::public.staff_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.modifier_options set is_available = p_available where id = p_option_id returning * into v_option;
  if not found then
    raise exception 'option_not_found' using errcode = 'P0002';
  end if;
  return v_option;
end;
$$;

create or replace function public.assign_rider(p_order_id uuid, p_rider_name text, p_rider_phone text)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.has_staff_role(array['attendant', 'dispatcher', 'manager', 'owner']::public.staff_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.orders
     set rider_name = nullif(btrim(p_rider_name), ''), rider_phone = nullif(btrim(p_rider_phone), '')
   where id = p_order_id and fulfilment = 'delivery'
  returning * into v_order;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public order tracking / receipt by unguessable token (no login needed,
-- used by SMS links and phone-order payment links)
-- ---------------------------------------------------------------------------
create or replace function public.track_order(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'fulfilment', o.fulfilment,
    'channel', o.channel,
    'customer_name', o.customer_name,
    'customer_phone_masked', left(o.customer_phone, 6) || '****' || right(o.customer_phone, 3),
    'zone_name', o.zone_name,
    'zone_eta_minutes', o.zone_eta_minutes,
    'address_gps', o.address_gps,
    'address_landmark', o.address_landmark,
    'scheduled_for', o.scheduled_for,
    'notes', o.notes,
    'subtotal_pesewas', o.subtotal_pesewas,
    'delivery_fee_pesewas', o.delivery_fee_pesewas,
    'discount_pesewas', o.discount_pesewas,
    'total_pesewas', o.total_pesewas,
    'refunded_pesewas', o.refunded_pesewas,
    'prep_minutes', o.prep_minutes,
    'estimated_ready_at', o.estimated_ready_at,
    'reject_reason', o.reject_reason,
    'cancel_reason', o.cancel_reason,
    'delivery_code', case when o.fulfilment = 'delivery' and o.status = 'out_for_delivery' then o.delivery_code end,
    'rider_name', case when o.status = 'out_for_delivery' then o.rider_name end,
    'rider_phone', case when o.status = 'out_for_delivery' then o.rider_phone end,
    'created_at', o.created_at,
    'paid_at', o.paid_at,
    'accepted_at', o.accepted_at,
    'rejected_at', o.rejected_at,
    'kitchen_started_at', o.kitchen_started_at,
    'ready_at', o.ready_at,
    'dispatched_at', o.dispatched_at,
    'ready_for_pickup_at', o.ready_for_pickup_at,
    'delivered_at', o.delivered_at,
    'completed_at', o.completed_at,
    'cancelled_at', o.cancelled_at,
    'refunded_at', o.refunded_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'item_name', oi.item_name,
               'portion_name', oi.portion_name,
               'modifiers', oi.modifiers,
               'quantity', oi.quantity,
               'unit_price_pesewas', oi.unit_price_pesewas,
               'line_total_pesewas', oi.line_total_pesewas,
               'notes', oi.notes,
               'menu_item_id', oi.menu_item_id,
               'portion_id', oi.portion_id) order by oi.item_name)
        from public.order_items oi where oi.order_id = o.id), '[]'::jsonb),
    'payment', (
      select jsonb_build_object('status', p.status, 'channel', p.channel, 'reference', p.reference, 'paid_at', p.paid_at)
        from public.payments p
       where p.order_id = o.id
       order by (p.id = o.paid_payment_id) desc nulls last, p.created_at desc
       limit 1),
    'refunds', coalesce((
      select jsonb_agg(jsonb_build_object('amount_pesewas', r.amount_pesewas, 'status', r.status, 'created_at', r.created_at)
                       order by r.created_at)
        from public.refunds r where r.order_id = o.id and r.payment_id = o.paid_payment_id), '[]'::jsonb)
  )
  from public.orders o
  where length(p_token) = 32 and o.public_token = p_token;
$$;

-- ---------------------------------------------------------------------------
-- Reporting (managers & owner)
-- Days are Africa/Accra calendar days. "Sales" = orders whose payment was
-- confirmed in the period (refunds are reported separately and netted off).
-- ---------------------------------------------------------------------------
create or replace function public.sales_summary(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz := (p_from::timestamp at time zone 'Africa/Accra');
  v_to timestamptz := ((p_to + 1)::timestamp at time zone 'Africa/Accra');
  v_result jsonb;
begin
  if not public.is_manager() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 400 then
    raise exception 'invalid_range' using errcode = 'P0001';
  end if;

  with paid as (
    select o.*, p.channel as pay_channel
      from public.orders o
      left join public.payments p on p.id = o.paid_payment_id
     where o.paid_at >= v_from and o.paid_at < v_to
  ),
  totals as (
    select count(*)::int as orders,
           coalesce(sum(total_pesewas), 0)::bigint as gross_pesewas,
           coalesce(sum(subtotal_pesewas), 0)::bigint as food_pesewas,
           coalesce(sum(delivery_fee_pesewas), 0)::bigint as delivery_fees_pesewas,
           coalesce(sum(discount_pesewas), 0)::bigint as discounts_pesewas,
           count(*) filter (where status = 'rejected' or (status = 'refunded' and rejected_at is not null))::int as rejected,
           count(*) filter (where cancelled_at is not null)::int as cancelled_after_payment,
           count(*) filter (where status = 'refunded')::int as fully_refunded,
           count(distinct customer_phone)::int as customers
      from paid
  ),
  refund_totals as (
    select coalesce(sum(r.amount_pesewas), 0)::bigint as refunds_pesewas, count(*)::int as refund_count
      from public.refunds r
      join public.orders o on o.id = r.order_id and r.payment_id = o.paid_payment_id
     where r.created_at >= v_from and r.created_at < v_to and r.status <> 'failed'
  ),
  repeaters as (
    select count(*)::int as repeat_customers
      from (select distinct customer_phone from paid) c
     where (select count(*) from public.orders o2
             where o2.customer_phone = c.customer_phone and o2.paid_at is not null and o2.paid_at < v_to) >= 2
  ),
  by_day as (
    select to_char((paid_at at time zone 'Africa/Accra')::date, 'YYYY-MM-DD') as day,
           count(*)::int as orders, sum(total_pesewas)::bigint as gross_pesewas
      from paid group by 1 order by 1
  ),
  by_hour as (
    select extract(hour from paid_at at time zone 'Africa/Accra')::int as hour,
           count(*)::int as orders, sum(total_pesewas)::bigint as gross_pesewas
      from paid group by 1 order by 1
  ),
  by_payment as (
    select coalesce(pay_channel, 'unknown') as channel, count(*)::int as orders, sum(total_pesewas)::bigint as gross_pesewas
      from paid group by 1 order by 3 desc
  ),
  by_zone as (
    select case when fulfilment = 'pickup' then 'Pickup' else coalesce(zone_name, 'Unknown zone') end as zone,
           count(*)::int as orders, sum(total_pesewas)::bigint as gross_pesewas
      from paid group by 1 order by 3 desc
  ),
  by_channel as (
    select channel::text as channel, count(*)::int as orders, sum(total_pesewas)::bigint as gross_pesewas
      from paid group by 1 order by 3 desc
  ),
  item_sales as (
    select oi.menu_item_id, min(oi.item_name) as name,
           sum(oi.quantity)::int as quantity, sum(oi.line_total_pesewas)::bigint as revenue_pesewas
      from public.order_items oi
      join paid on paid.id = oi.order_id
     where paid.status not in ('rejected', 'refunded')
     group by oi.menu_item_id
  ),
  all_items as (
    select mi.id as menu_item_id, mi.name,
           coalesce(s.quantity, 0) as quantity, coalesce(s.revenue_pesewas, 0) as revenue_pesewas
      from public.menu_items mi
      left join item_sales s on s.menu_item_id = mi.id
     where mi.is_active
  ),
  timings as (
    select
      round(avg(extract(epoch from (accepted_at - paid_at)) / 60.0) filter (where accepted_at is not null and scheduled_for is null)::numeric, 1) as avg_accept_minutes,
      round(avg(extract(epoch from (ready_at - coalesce(kitchen_started_at, accepted_at))) / 60.0) filter (where ready_at is not null)::numeric, 1) as avg_prep_minutes,
      round(avg(extract(epoch from (delivered_at - dispatched_at)) / 60.0) filter (where delivered_at is not null and dispatched_at is not null)::numeric, 1) as avg_delivery_minutes,
      round(avg(extract(epoch from (delivered_at - paid_at)) / 60.0) filter (where delivered_at is not null and scheduled_for is null)::numeric, 1) as avg_total_minutes
    from paid
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'totals', (select to_jsonb(t) || jsonb_build_object(
                  'refunds_pesewas', r.refunds_pesewas,
                  'refund_count', r.refund_count,
                  'net_pesewas', t.gross_pesewas - r.refunds_pesewas,
                  'aov_pesewas', case when t.orders > 0 then round(t.gross_pesewas::numeric / t.orders) else 0 end,
                  'repeat_customers', rp.repeat_customers)
                 from totals t, refund_totals r, repeaters rp),
    'timings', (select to_jsonb(timings) from timings),
    'by_day', coalesce((select jsonb_agg(to_jsonb(d)) from by_day d), '[]'::jsonb),
    'by_hour', coalesce((select jsonb_agg(to_jsonb(h)) from by_hour h), '[]'::jsonb),
    'by_payment_method', coalesce((select jsonb_agg(to_jsonb(b)) from by_payment b), '[]'::jsonb),
    'by_zone', coalesce((select jsonb_agg(to_jsonb(z)) from by_zone z), '[]'::jsonb),
    'by_channel', coalesce((select jsonb_agg(to_jsonb(c)) from by_channel c), '[]'::jsonb),
    'top_items', coalesce((select jsonb_agg(to_jsonb(x)) from (
                    select name, quantity, revenue_pesewas from item_sales order by quantity desc, revenue_pesewas desc limit 10) x), '[]'::jsonb),
    'bottom_items', coalesce((select jsonb_agg(to_jsonb(x)) from (
                    select name, quantity, revenue_pesewas from all_items order by quantity asc, revenue_pesewas asc, name limit 5) x), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.customer_list()
returns table (
  phone text,
  full_name text,
  email text,
  marketing_consent boolean,
  marketing_consent_at timestamptz,
  orders_count integer,
  total_spent_pesewas bigint,
  first_order_at timestamptz,
  last_order_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_manager() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select o.customer_phone,
           coalesce(max(p.full_name), max(o.customer_name)),
           coalesce(max(p.email), max(o.customer_email)),
           coalesce(bool_or(p.marketing_consent), false),
           max(p.marketing_consent_at),
           count(*)::int,
           sum(o.total_pesewas - o.refunded_pesewas)::bigint,
           min(o.paid_at),
           max(o.paid_at)
      from public.orders o
      left join public.profiles p on p.phone = o.customer_phone
     where o.paid_at is not null
     group by o.customer_phone
     order by max(o.paid_at) desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit triggers: prices, fees, refunds status, staff, settings
-- ---------------------------------------------------------------------------
create or replace function public.audit_portion_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_name text;
begin
  select name into v_item_name from public.menu_items
   where id = coalesce(new.menu_item_id, old.menu_item_id);
  if tg_op = 'INSERT' then
    perform public.write_audit('price_set', 'menu_item_portion', new.id::text,
      jsonb_build_object('item', v_item_name, 'portion', new.name, 'new_price_pesewas', new.price_pesewas));
  elsif tg_op = 'UPDATE' and new.price_pesewas is distinct from old.price_pesewas then
    perform public.write_audit('price_change', 'menu_item_portion', new.id::text,
      jsonb_build_object('item', v_item_name, 'portion', new.name,
                         'old_price_pesewas', old.price_pesewas, 'new_price_pesewas', new.price_pesewas));
  elsif tg_op = 'DELETE' then
    perform public.write_audit('price_removed', 'menu_item_portion', old.id::text,
      jsonb_build_object('item', v_item_name, 'portion', old.name, 'old_price_pesewas', old.price_pesewas));
  end if;
  return coalesce(new, old);
end;
$$;

create trigger audit_portion_price
  after insert or update or delete on public.menu_item_portions
  for each row execute function public.audit_portion_price();

create or replace function public.audit_option_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.price_pesewas is distinct from old.price_pesewas then
    perform public.write_audit('price_change', 'modifier_option', new.id::text,
      jsonb_build_object('option', new.name, 'old_price_pesewas', old.price_pesewas, 'new_price_pesewas', new.price_pesewas));
  end if;
  return new;
end;
$$;

create trigger audit_option_price
  after update on public.modifier_options
  for each row execute function public.audit_option_price();

create or replace function public.audit_zone_fee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.fee_pesewas is distinct from old.fee_pesewas or new.min_order_pesewas is distinct from old.min_order_pesewas then
    perform public.write_audit('delivery_fee_change', 'delivery_zone', new.id::text,
      jsonb_build_object('zone', new.name,
                         'old_fee_pesewas', old.fee_pesewas, 'new_fee_pesewas', new.fee_pesewas,
                         'old_min_order_pesewas', old.min_order_pesewas, 'new_min_order_pesewas', new.min_order_pesewas));
  end if;
  return new;
end;
$$;

create trigger audit_zone_fee
  after update on public.delivery_zones
  for each row execute function public.audit_zone_fee();

create or replace function public.audit_staff_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('staff_added', 'staff', new.user_id::text,
      jsonb_build_object('name', new.display_name, 'role', new.role));
  elsif new.role is distinct from old.role or new.is_active is distinct from old.is_active then
    perform public.write_audit('staff_changed', 'staff', new.user_id::text,
      jsonb_build_object('name', new.display_name, 'old_role', old.role, 'new_role', new.role,
                         'old_active', old.is_active, 'new_active', new.is_active));
  end if;
  return new;
end;
$$;

create trigger audit_staff_change
  after insert or update on public.staff
  for each row execute function public.audit_staff_change();

create or replace function public.audit_settings_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.write_audit('settings_changed', 'store_settings', '1',
    jsonb_build_object('changes', (
      select coalesce(jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value)), '{}'::jsonb)
        from jsonb_each(to_jsonb(new)) n
        join jsonb_each(to_jsonb(old)) o on o.key = n.key
       where n.value is distinct from o.value and n.key <> 'updated_at')));
  return new;
end;
$$;

create trigger audit_settings_change
  after update on public.store_settings
  for each row execute function public.audit_settings_change();
