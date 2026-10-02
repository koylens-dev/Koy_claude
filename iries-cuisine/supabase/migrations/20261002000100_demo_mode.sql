-- =============================================================================
-- Demo / training data
--
-- Lets the owner explore every screen with realistic numbers, and lets staff
-- practise before launch. Demo rows are flagged is_demo and:
--   * never send SMS (the message is recorded as "skipped" so trainees can read it)
--   * never touch Paystack (payments and refunds are simulated)
--   * never trigger the "order waiting" staff alert
--   * are removed in one click (Admin → Hours & settings → Demo data)
-- =============================================================================

alter table public.orders add column is_demo boolean not null default false;
alter table public.catering_enquiries add column is_demo boolean not null default false;
alter table public.staff add column is_demo boolean not null default false;
create index orders_demo_idx on public.orders (is_demo) where is_demo;

-- ---------------------------------------------------------------------------
-- Random basket from the live menu: [{menu_item_id, portion_id, item_name,
-- portion_name, modifiers, unit, qty}], priced exactly like real orders.
-- ---------------------------------------------------------------------------
create or replace function public._demo_lines(p_count integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_lines jsonb := '[]'::jsonb;
  v_item record;
  v_portion record;
  v_opt record;
  v_mods jsonb;
  v_mods_total integer;
  v_qty integer;
  n integer;
begin
  for n in 1..p_count loop
    -- popular dishes (chef's picks) more often; drinks and sides as 2nd/3rd lines
    select mi.id, mi.name into v_item
      from public.menu_items mi
      join public.categories c on c.id = mi.category_id
     where mi.is_active and c.is_active
       and exists (select 1 from public.menu_item_portions p where p.menu_item_id = mi.id and p.is_active)
     order by -ln(1 - random())
              / ((case when mi.is_featured then 3.0 else 1.0 end)
                 * (case when n > 1 and c.slug in ('drinks', 'small-chops', 'grills-sides') then 4.0 else 1.0 end))
     limit 1;

    if random() < 0.8 then
      select p.id, p.name, p.price_pesewas into v_portion
        from public.menu_item_portions p
       where p.menu_item_id = v_item.id and p.is_active
       order by p.is_default desc, p.sort_order
       limit 1;
    else
      select p.id, p.name, p.price_pesewas into v_portion
        from public.menu_item_portions p
       where p.menu_item_id = v_item.id and p.is_active
       order by random()
       limit 1;
    end if;

    v_mods := '[]'::jsonb;
    v_mods_total := 0;
    -- required groups (e.g. spice level): the default choice
    for v_opt in
      select g.id as group_id, g.name as group_name, o.id as option_id, o.name as option_name, o.price_pesewas
        from public.menu_item_modifier_groups link
        join public.modifier_groups g on g.id = link.group_id
        cross join lateral (
          select * from public.modifier_options o
           where o.group_id = g.id and o.is_available
           order by o.is_default desc, random()
           limit 1) o
       where link.menu_item_id = v_item.id and g.min_select >= 1
       order by link.sort_order
    loop
      v_mods := v_mods || jsonb_build_object('group_id', v_opt.group_id, 'group', v_opt.group_name,
                                             'option_id', v_opt.option_id, 'option', v_opt.option_name,
                                             'price_pesewas', v_opt.price_pesewas);
      v_mods_total := v_mods_total + v_opt.price_pesewas;
    end loop;
    -- sometimes one paid extra
    if random() < 0.25 then
      select g.id as group_id, g.name as group_name, o.id as option_id, o.name as option_name, o.price_pesewas
        into v_opt
        from public.menu_item_modifier_groups link
        join public.modifier_groups g on g.id = link.group_id
        join public.modifier_options o on o.group_id = g.id and o.is_available
       where link.menu_item_id = v_item.id and g.min_select = 0
       order by random()
       limit 1;
      if found then
        v_mods := v_mods || jsonb_build_object('group_id', v_opt.group_id, 'group', v_opt.group_name,
                                               'option_id', v_opt.option_id, 'option', v_opt.option_name,
                                               'price_pesewas', v_opt.price_pesewas);
        v_mods_total := v_mods_total + v_opt.price_pesewas;
      end if;
    end if;

    v_qty := case when random() < 0.82 then 1 when random() < 0.85 then 2 else 3 end;
    v_lines := v_lines || jsonb_build_object(
      'menu_item_id', v_item.id, 'portion_id', v_portion.id,
      'item_name', v_item.name, 'portion_name', v_portion.name,
      'modifiers', v_mods, 'unit', v_portion.price_pesewas + v_mods_total, 'qty', v_qty);
  end loop;
  return v_lines;
end;
$$;

-- ---------------------------------------------------------------------------
-- Insert one demo order with a full, consistent timeline (order, items,
-- payment, every status event, refund). Timestamps left null = step not taken.
-- ---------------------------------------------------------------------------
create or replace function public._demo_insert_order(
  p_status public.order_status,
  p_fulfilment public.fulfilment_type,
  p_channel public.order_channel,
  p_customer integer,
  p_lines jsonb,
  p_created timestamptz,
  p_paid timestamptz,
  p_accepted timestamptz,
  p_rejected timestamptz,
  p_kitchen timestamptz,
  p_ready timestamptz,
  p_dispatched timestamptz,
  p_ready_for_pickup timestamptz,
  p_delivered timestamptz,
  p_completed timestamptz,
  p_cancelled timestamptz,
  p_refunded timestamptz,
  p_refund_pesewas integer default 0,
  p_prep integer default null,
  p_scheduled timestamptz default null,
  p_pay_channel text default 'mobile_money',
  p_with_rider boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_first text[] := array['Ama','Kwame','Akosua','Kofi','Efua','Yaw','Abena','Kwabena','Adwoa','Kojo','Esi','Kweku',
                          'Afia','Nana','Selorm','Dzifa','Fiifi','Naa','Nii','Elikem','Akua','Mawuli','Edem','Serwaa'];
  v_last text[] := array['Mensah','Boateng','Owusu','Asante','Quaye','Darko','Ofori','Appiah','Sarpong','Antwi','Badu',
                         'Amponsah','Gyamfi','Agyeman','Agbeko','Kpodo','Tetteh','Armah','Fiagbe','Donkor','Addo','Lartey'];
  v_landmarks text[] := array['Near the SSNIT flats gate','Behind the filling station','Opposite the Methodist church',
                              'Close to the police station','Next to the big mango tree','Opposite the supermarket',
                              'Behind the community school','Near the trotro station','Yellow gate after the pharmacy',
                              'Opposite the hardware shop'];
  v_reject_reasons text[] := array['An item is sold out','Kitchen is too busy right now','Address is outside our delivery area'];
  v_id uuid := gen_random_uuid();
  v_number bigint;
  v_payment uuid;
  v_sub integer;
  v_fee integer := 0;
  v_zone_id uuid;
  v_zone_name text;
  v_zone_eta integer;
  v_fulfilment public.fulfilment_type := p_fulfilment;
  v_prev public.order_status;
begin
  select coalesce(sum((x ->> 'unit')::int * (x ->> 'qty')::int), 0)::int into v_sub from jsonb_array_elements(p_lines) x;

  if v_fulfilment = 'delivery' then
    -- nearer zones more often; only zones whose minimum order this basket meets
    select z.id, z.name, z.fee_pesewas, z.eta_minutes into v_zone_id, v_zone_name, v_fee, v_zone_eta
      from public.delivery_zones z
     where z.is_active and z.min_order_pesewas <= v_sub
     order by -ln(1 - random()) * (z.sort_order + 1)
     limit 1;
    if v_zone_id is null then
      v_fulfilment := 'pickup';
      v_fee := 0;
    end if;
  end if;

  insert into public.orders (
    id, customer_name, customer_phone, channel, fulfilment, status,
    zone_id, zone_name, zone_eta_minutes, address_gps, address_landmark, notes, scheduled_for,
    subtotal_pesewas, delivery_fee_pesewas, discount_pesewas, total_pesewas, refunded_pesewas,
    prep_minutes, estimated_ready_at, reject_reason, cancel_reason, rider_name, rider_phone, is_demo,
    created_at, paid_at, accepted_at, rejected_at, kitchen_started_at, ready_at, dispatched_at,
    ready_for_pickup_at, delivered_at, completed_at, cancelled_at, refunded_at
  ) values (
    v_id,
    v_first[1 + p_customer % array_length(v_first, 1)] || ' ' || v_last[1 + (p_customer * 7) % array_length(v_last, 1)],
    '+2332000' || lpad(p_customer::text, 5, '0'),   -- fictional demo numbers; demo orders never send SMS
    p_channel, v_fulfilment, p_status,
    v_zone_id, v_zone_name, v_zone_eta,
    case when v_fulfilment = 'delivery' and random() < 0.5
         then 'GA-' || (100 + floor(random() * 800))::int || '-' || lpad(floor(random() * 10000)::int::text, 4, '0') end,
    case when v_fulfilment = 'delivery' then v_landmarks[1 + floor(random() * array_length(v_landmarks, 1))::int] end,
    case when random() < 0.08 then 'Please call when you arrive' end,
    p_scheduled,
    v_sub, v_fee, 0, v_sub + v_fee, least(coalesce(p_refund_pesewas, 0), v_sub + v_fee),
    case when p_accepted is not null then coalesce(p_prep, 25) end,
    case when p_accepted is not null
         then greatest(p_accepted + make_interval(mins => coalesce(p_prep, 25)),
                       coalesce(p_scheduled - make_interval(mins => coalesce(v_zone_eta, 0)), '-infinity'::timestamptz)) end,
    case when p_rejected is not null then v_reject_reasons[1 + floor(random() * 3)::int] end,
    case when p_cancelled is not null then 'Gas finished - kitchen paused' end,
    case when p_with_rider then 'Yaw (demo rider)' end,
    case when p_with_rider then '+233200099999' end,
    true,
    p_created, p_paid, p_accepted, p_rejected, p_kitchen, p_ready, p_dispatched,
    p_ready_for_pickup, p_delivered, p_completed, p_cancelled, p_refunded
  )
  returning order_number into v_number;

  insert into public.order_items (order_id, menu_item_id, portion_id, item_name, portion_name, modifiers,
                                  unit_price_pesewas, quantity, line_total_pesewas)
  select v_id, (x ->> 'menu_item_id')::uuid, (x ->> 'portion_id')::uuid, x ->> 'item_name', x ->> 'portion_name',
         x -> 'modifiers', (x ->> 'unit')::int, (x ->> 'qty')::int, (x ->> 'unit')::int * (x ->> 'qty')::int
    from jsonb_array_elements(p_lines) x;

  if p_paid is not null then
    insert into public.payments (order_id, reference, amount_pesewas, status, channel, provider_transaction_id,
                                 fees_pesewas, paid_at, gateway_response, created_at)
    values (v_id, 'DEMO-' || v_number, v_sub + v_fee, 'success', p_pay_channel, 'demo',
            round((v_sub + v_fee) * 0.0195)::int, p_paid, 'Demo payment (simulated)', p_created)
    returning id into v_payment;
    update public.orders set paid_payment_id = v_payment where id = v_id;
  end if;

  -- Status history, in the order it happened
  insert into public.order_events (order_id, from_status, to_status, actor_role, note, created_at)
  values (v_id, null, 'awaiting_payment', case when p_channel = 'web' then 'customer' else 'attendant' end,
          'Order created (demo)', p_created);
  v_prev := 'awaiting_payment';
  if p_paid is not null then
    insert into public.order_events (order_id, from_status, to_status, actor_role, note, created_at)
    values (v_id, v_prev, 'paid', 'system', 'Payment confirmed (demo, ' || p_pay_channel || ')', p_paid);
    v_prev := 'paid';
  end if;
  if p_rejected is not null then
    insert into public.order_events (order_id, from_status, to_status, actor_role, note, created_at)
    values (v_id, v_prev, 'rejected', 'attendant', 'Rejected (demo)', p_rejected);
    v_prev := 'rejected';
  end if;
  if p_accepted is not null then
    insert into public.order_events (order_id, from_status, to_status, actor_role, note, created_at)
    values (v_id, v_prev, 'accepted', 'attendant', null, p_accepted);
    v_prev := 'accepted';
  end if;
  if p_kitchen is not null then
    insert into public.order_events (order_id, from_status, to_status, actor_role, note, created_at)
    values (v_id, v_prev, 'in_kitchen', 'kitchen', null, p_kitchen);
    v_prev := 'in_kitchen';
  end if;
  if p_ready is not null then
    insert into public.order_events (order_id, from_status, to_status, actor_role, note, created_at)
    values (v_id, v_prev, 'ready', 'kitchen', null, p_ready);
    v_prev := 'ready';
  end if;
  if p_dispatched is not null then
    insert into public.order_events (order_id, from_status, to_status, actor_role, note, created_at)
    values (v_id, v_prev, 'out_for_delivery', 'attendant', null, p_dispatched);
    v_prev := 'out_for_delivery';
  end if;
  if p_ready_for_pickup is not null then
    insert into public.order_events (order_id, from_status, to_status, actor_role, note, created_at)
    values (v_id, v_prev, 'ready_for_pickup', 'attendant', null, p_ready_for_pickup);
    v_prev := 'ready_for_pickup';
  end if;
  if p_delivered is not null then
    insert into public.order_events (order_id, from_status, to_status, actor_role, note, created_at)
    values (v_id, v_prev, 'delivered', 'attendant', null, p_delivered);
    v_prev := 'delivered';
  end if;
  if p_completed is not null then
    insert into public.order_events (order_id, from_status, to_status, actor_role, note, created_at)
    values (v_id, v_prev, 'completed', 'system', 'Auto-completed', p_completed);
    v_prev := 'completed';
  end if;
  if p_cancelled is not null then
    insert into public.order_events (order_id, from_status, to_status, actor_role, note, created_at)
    values (v_id, v_prev, 'cancelled', 'manager', 'Gas finished - kitchen paused', p_cancelled);
    v_prev := 'cancelled';
  end if;

  if coalesce(p_refund_pesewas, 0) > 0 and v_payment is not null then
    insert into public.refunds (order_id, payment_id, amount_pesewas, reason, status, provider_refund_id,
                                requested_role, is_automatic, processed_at, created_at)
    values (v_id, v_payment, least(p_refund_pesewas, v_sub + v_fee),
            case when p_rejected is not null then 'Order rejected (automatic refund)'
                 when p_cancelled is not null then 'Order cancelled (automatic refund)'
                 else 'Missing side item' end,
            'processed', 'DEMO-RF-' || v_number,
            case when p_rejected is not null or p_cancelled is not null then 'system' else 'manager' end,
            p_rejected is not null or p_cancelled is not null,
            coalesce(p_refunded, p_completed, p_delivered, now()),
            coalesce(p_refunded, p_delivered, now()));
    if p_refunded is not null then
      insert into public.order_events (order_id, from_status, to_status, actor_role, note, created_at)
      values (v_id, v_prev, 'refunded', 'system', 'Full refund issued (demo)', p_refunded);
    end if;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Load the demo data set: ~6 weeks of history + live orders + catering enquiries
-- ---------------------------------------------------------------------------
create or replace function public.seed_demo_data(p_days integer default 42)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Africa/Accra')::date;
  v_day date;
  v_dow integer;
  v_open integer;
  v_close integer;
  v_count integer;
  v_minute integer;
  v_r double precision;
  v_outcome text;
  v_prep integer;
  v_fulfilment public.fulfilment_type;
  v_created timestamptz;
  v_paid timestamptz;
  v_accepted timestamptz;
  v_kitchen timestamptz;
  v_ready timestamptz;
  v_out timestamptz;
  v_delivered timestamptz;
  v_lines jsonb;
  v_total integer;
  v_orders integer := 0;
  v_live integer := 0;
  d integer;
  i integer;
  m timestamptz := now();
begin
  if exists (select 1 from public.orders where is_demo) then
    raise exception 'demo_data_exists' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.menu_items mi
                  join public.menu_item_portions p on p.menu_item_id = mi.id and p.is_active
                 where mi.is_active) then
    raise exception 'menu_empty' using errcode = 'P0001';
  end if;
  p_days := least(greatest(p_days, 1), 120);

  -- History: only days we're open; busier as the weeks go by, on Fri/Sat, at lunch and dinner
  for d in reverse p_days..1 loop
    v_day := v_today - d;
    v_dow := extract(dow from v_day)::int;
    continue when exists (select 1 from public.closed_dates where closed_on = v_day);
    select min(extract(epoch from opens_at) / 60)::int, max(extract(epoch from closes_at) / 60)::int
      into v_open, v_close
      from public.opening_hours where day_of_week = v_dow;
    continue when v_open is null;

    v_count := round((14 + (p_days - d) * (18.0 / p_days))
                     * (case v_dow when 5 then 1.3 when 6 then 1.35 when 0 then 0.8 else 1 end)
                     * (0.8 + random() * 0.4))::int;

    for i in 1..v_count loop
      v_r := random();
      v_minute := case
        when v_r < 0.45 then 12 * 60 + floor(random() * 150)::int
        when v_r < 0.90 then 18 * 60 + floor(random() * 180)::int
        else v_open + floor(random() * greatest(v_close - v_open, 1))::int
      end;
      v_minute := least(greatest(v_minute, v_open + 15), v_close - 30);
      v_created := (v_day::timestamp at time zone 'Africa/Accra') + make_interval(mins => v_minute, secs => floor(random() * 60)::int);

      v_r := random();
      v_outcome := case when v_r < 0.03 then 'rejected' when v_r < 0.045 then 'cancelled' when v_r < 0.06 then 'partial' else 'ok' end;
      v_prep := (array[15, 20, 20, 25, 25, 25, 30, 30, 35, 45])[1 + floor(random() * 10)::int];
      v_fulfilment := case when random() < 0.7 then 'delivery' else 'pickup' end;
      v_paid := v_created + make_interval(secs => 40 + floor(random() * 200)::int);
      v_accepted := v_paid + make_interval(secs => 30 + floor(random() * 300)::int);
      v_kitchen := v_accepted + make_interval(secs => floor(random() * 180)::int);
      v_ready := v_kitchen + make_interval(mins => greatest(8, v_prep - 5 + floor(random() * 12)::int
                  + case when v_minute between 12 * 60 and 14 * 60 or v_minute between 18 * 60 + 30 and 20 * 60 + 30
                         then floor(random() * 8)::int else 0 end));
      v_out := v_ready + make_interval(mins => 2 + floor(random() * 10)::int);
      v_delivered := case when v_fulfilment = 'delivery'
                          then v_out + make_interval(mins => 20 + floor(random() * 30)::int)
                          else v_ready + make_interval(mins => 5 + floor(random() * 30)::int) end;
      v_lines := public._demo_lines(case when random() < 0.55 then 1 when random() < 0.7 then 2 else 3 end);
      select sum((x ->> 'unit')::int * (x ->> 'qty')::int)::int into v_total from jsonb_array_elements(v_lines) x;

      perform public._demo_insert_order(
        case v_outcome when 'rejected' then 'refunded'::public.order_status
                       when 'cancelled' then 'refunded'::public.order_status
                       else 'completed'::public.order_status end,
        v_fulfilment,
        (case when random() < 0.12 then 'whatsapp' when random() < 0.1 then 'phone' else 'web' end)::public.order_channel,
        -- ~60 regulars place almost half the orders; the rest come from a long tail of occasional customers
        (case when random() < 0.45 then floor(60 * power(random(), 1.5)) else 60 + floor(540 * random()) end)::int,
        v_lines,
        v_created,
        v_paid,
        case when v_outcome <> 'rejected' then v_accepted end,
        case when v_outcome = 'rejected' then v_accepted end,
        case when v_outcome in ('ok', 'partial') then v_kitchen end,
        case when v_outcome in ('ok', 'partial') then v_ready end,
        case when v_outcome in ('ok', 'partial') and v_fulfilment = 'delivery' then v_out end,
        case when v_outcome in ('ok', 'partial') and v_fulfilment = 'pickup' then v_ready + interval '1 minute' end,
        case when v_outcome in ('ok', 'partial') then v_delivered end,
        case when v_outcome in ('ok', 'partial') then v_delivered + interval '2 hours' end,
        case when v_outcome = 'cancelled' then v_kitchen end,
        case when v_outcome = 'rejected' then v_accepted + interval '1 minute'
             when v_outcome = 'cancelled' then v_kitchen + interval '1 minute' end,
        case when v_outcome in ('rejected', 'cancelled') then 100000000
             when v_outcome = 'partial' then (array[500, 1000, 1500, 2000])[1 + floor(random() * 4)::int]
             else 0 end,
        v_prep,
        null,
        case when random() < 0.72 then 'mobile_money' when random() < 0.9 then 'card' else 'bank_transfer' end,
        false);
      v_orders := v_orders + 1;
    end loop;
  end loop;

  -- Live orders "right now", so every staff screen has something on it
  -- two new paid orders (the attendant alarm rings)
  perform public._demo_insert_order('paid', 'delivery', 'web', 3, public._demo_lines(2),
    m - interval '7 minutes', m - interval '6 minutes', null, null, null, null, null, null, null, null, null, null);
  perform public._demo_insert_order('paid', 'pickup', 'whatsapp', 11, public._demo_lines(1),
    m - interval '3 minutes', m - interval '2 minutes', null, null, null, null, null, null, null, null, null, null);
  -- accepted, waiting for the kitchen
  perform public._demo_insert_order('accepted', 'delivery', 'web', 5, public._demo_lines(2),
    m - interval '14 minutes', m - interval '13 minutes', m - interval '10 minutes', null, null, null, null, null, null, null, null, null,
    0, 25);
  -- cooking: one nearly due (amber), one late (red)
  perform public._demo_insert_order('in_kitchen', 'delivery', 'web', 8, public._demo_lines(3),
    m - interval '22 minutes', m - interval '21 minutes', m - interval '19 minutes', null, m - interval '17 minutes', null, null, null, null, null, null, null,
    0, 20);
  perform public._demo_insert_order('in_kitchen', 'pickup', 'phone', 14, public._demo_lines(1),
    m - interval '40 minutes', m - interval '39 minutes', m - interval '36 minutes', null, m - interval '34 minutes', null, null, null, null, null, null, null,
    0, 25);
  -- ready, waiting for the rider
  perform public._demo_insert_order('ready', 'delivery', 'web', 2, public._demo_lines(2),
    m - interval '35 minutes', m - interval '34 minutes', m - interval '32 minutes', null, m - interval '30 minutes', m - interval '3 minutes',
    null, null, null, null, null, null, 0, 25);
  -- on the road with a rider
  perform public._demo_insert_order('out_for_delivery', 'delivery', 'web', 21, public._demo_lines(2),
    m - interval '55 minutes', m - interval '54 minutes', m - interval '51 minutes', null, m - interval '50 minutes', m - interval '22 minutes',
    m - interval '15 minutes', null, null, null, null, null, 0, 25, null, 'card', true);
  -- pickup ready at the counter
  perform public._demo_insert_order('ready_for_pickup', 'pickup', 'web', 17, public._demo_lines(1),
    m - interval '45 minutes', m - interval '44 minutes', m - interval '42 minutes', null, m - interval '40 minutes', m - interval '12 minutes',
    null, m - interval '11 minutes', null, null, null, null, 0, 25);
  -- a phone order waiting for the customer to pay (staff can "Simulate payment")
  perform public._demo_insert_order('awaiting_payment', 'delivery', 'phone', 30, public._demo_lines(2),
    m - interval '4 minutes', null, null, null, null, null, null, null, null, null, null, null);
  -- a scheduled order for tomorrow lunchtime (already accepted)
  perform public._demo_insert_order('accepted', 'delivery', 'web', 9, public._demo_lines(3),
    m - interval '2 hours', m - interval '2 hours' + interval '1 minute', m - interval '1 hour 50 minutes', null, null, null, null, null, null, null, null, null,
    0, 30, ((v_today + 1)::timestamp + time '13:00') at time zone 'Africa/Accra');
  v_live := 10;

  insert into public.catering_enquiries (name, phone, email, event_date, event_type, headcount, budget, location, menu_interest, notes, status, is_demo, created_at)
  values
    ('Efua Quaye', '+233200000101', null, v_today + 21, 'Wedding / engagement', 180, 'GH₵ 25,000', 'East Legon', 'Jollof, grilled chicken, kelewele, sobolo', 'Outdoor reception, need servers', 'new', true, m - interval '3 hours'),
    ('Kojo Antwi', '+233200000102', null, v_today + 10, 'Office / corporate', 40, 'GH₵ 4,000', 'Airport City', 'Packed lunches: waakye and fried rice', 'Delivery by 12:30', 'contacted', true, m - interval '2 days'),
    ('Abena Ofori', '+233200000103', null, v_today + 35, 'Funeral / one-week', 300, null, 'Adenta', 'Banku & tilapia, red red, drinks', null, 'quoted', true, m - interval '5 days'),
    ('Nii Armah', '+233200000104', null, v_today - 3, 'Naming ceremony / birthday', 60, 'GH₵ 6,000', 'Madina', 'Small chops and jollof', null, 'won', true, m - interval '12 days'),
    ('Selorm Agbeko', '+233200000105', null, v_today + 14, 'Church / community', 120, 'GH₵ 9,000', 'Oyarifa', 'Fried rice, chicken, sobolo', 'Harvest Sunday', 'new', true, m - interval '6 hours');

  return jsonb_build_object('history_orders', v_orders, 'live_orders', v_live, 'catering', 5, 'days', p_days);
end;
$$;

-- ---------------------------------------------------------------------------
-- Remove every demo row (orders, payments, refunds, SMS log, catering, demo staff)
-- Returns the demo staff user ids so the server can delete their logins.
-- ---------------------------------------------------------------------------
create or replace function public.clear_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_staff uuid[];
  v_orders integer;
  v_catering integer;
begin
  select coalesce(array_agg(id), '{}') into v_ids from public.orders where is_demo;
  v_orders := coalesce(array_length(v_ids, 1), 0);
  if v_orders > 0 then
    update public.orders set paid_payment_id = null where id = any (v_ids);
    delete from public.refunds where order_id = any (v_ids);
    delete from public.notifications where order_id = any (v_ids);
    delete from public.payments where order_id = any (v_ids);
    delete from public.audit_log where entity_type = 'order' and entity_id in (select unnest(v_ids)::text);
    delete from public.orders where id = any (v_ids);      -- items and events cascade
  end if;

  with deleted as (delete from public.catering_enquiries where is_demo returning 1)
  select count(*)::int into v_catering from deleted;

  select coalesce(array_agg(user_id), '{}') into v_staff from public.staff where is_demo;
  update public.staff set is_active = false where is_demo;
  delete from public.audit_log where entity_type = 'staff' and entity_id in (select unnest(v_staff)::text);

  -- Start real order numbers at #1001 if nothing else is left
  if not exists (select 1 from public.orders) then
    perform setval('public.order_number_seq', 1001, false);
  end if;

  return jsonb_build_object('orders', v_orders, 'catering', v_catering, 'staff_user_ids', to_jsonb(v_staff));
end;
$$;

-- ---------------------------------------------------------------------------
-- Training: pretend the customer paid a demo order (goes through the real
-- confirm_payment() so the alarm, status and timeline behave exactly as live).
-- ---------------------------------------------------------------------------
create or replace function public.demo_pay(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_ref text;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or not v_order.is_demo then
    raise exception 'not_a_demo_order' using errcode = 'P0001';
  end if;
  if v_order.status <> 'awaiting_payment' then
    raise exception 'invalid_transition:%->paid', v_order.status using errcode = 'P0001';
  end if;
  v_ref := 'DEMO-' || v_order.order_number || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
  insert into public.payments (order_id, reference, amount_pesewas) values (p_order_id, v_ref, v_order.total_pesewas);
  return public.confirm_payment(v_ref, v_order.total_pesewas, 'GHS', 'mobile_money', 'demo',
                                round(v_order.total_pesewas * 0.0195)::int, now(), 'Demo payment (simulated)', '{}'::jsonb);
end;
$$;

-- Server-only
revoke execute on function public._demo_lines(integer) from public, anon, authenticated;
revoke execute on function public._demo_insert_order(public.order_status, public.fulfilment_type, public.order_channel, integer, jsonb,
  timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz,
  timestamptz, timestamptz, integer, integer, timestamptz, text, boolean) from public, anon, authenticated;
revoke execute on function public.seed_demo_data(integer) from public, anon, authenticated;
revoke execute on function public.clear_demo_data() from public, anon, authenticated;
revoke execute on function public.demo_pay(uuid) from public, anon, authenticated;
grant execute on function public._demo_lines(integer) to service_role;
grant execute on function public.seed_demo_data(integer) to service_role;
grant execute on function public.clear_demo_data() to service_role;
grant execute on function public.demo_pay(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Customer list: demo customers are hidden unless asked for, so a marketing export
-- can never include the made-up demo numbers (which may belong to real people).
-- ---------------------------------------------------------------------------
drop function public.customer_list();
create function public.customer_list(p_include_demo boolean default false)
returns table (
  phone text,
  full_name text,
  email text,
  marketing_consent boolean,
  marketing_consent_at timestamptz,
  orders_count integer,
  total_spent_pesewas bigint,
  first_order_at timestamptz,
  last_order_at timestamptz,
  is_demo boolean
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
           max(o.paid_at),
           o.is_demo
      from public.orders o
      left join public.profiles p on p.phone = o.customer_phone and not o.is_demo
     where o.paid_at is not null
       and (p_include_demo or not o.is_demo)
     group by o.customer_phone, o.is_demo
     order by max(o.paid_at) desc;
end;
$$;
revoke execute on function public.customer_list(boolean) from public, anon;
grant execute on function public.customer_list(boolean) to authenticated, service_role;
