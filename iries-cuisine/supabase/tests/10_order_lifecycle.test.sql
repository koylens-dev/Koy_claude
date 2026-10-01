-- End-to-end checks of the order state machine, payments, refunds and RLS.
-- Run with: npm run test:db   (needs a local Postgres 15+; see scripts/test-db.sh)
\set ON_ERROR_STOP 1
\set QUIET 1

-- ---------------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------------
create schema test;
grant usage on schema test to public;

create function test.ok(p_cond boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FAILED: %', p_label;
  end if;
  raise notice 'ok - %', p_label;
end;
$$;

create function test.throws(p_sql text, p_pattern text, p_label text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ~* p_pattern then
      raise notice 'ok - % (got: %)', p_label, sqlerrm;
      return;
    end if;
    raise exception 'FAILED: % — wrong error: %', p_label, sqlerrm;
  end;
  raise exception 'FAILED: % — expected an error matching "%"', p_label, p_pattern;
end;
$$;

create function test.login(p_uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
$$;

create function test.logout() returns void
language sql as $$
  select set_config('request.jwt.claims', '', false);
$$;

-- Build an order for a customer the way the server does (prices from the DB).
create function test.make_order(p_customer uuid, p_phone text, p_fulfilment text default 'delivery')
returns public.orders
language plpgsql as $$
declare
  v_portion record;
  v_zone public.delivery_zones;
  v_fee integer := 0;
  v_order public.orders;
begin
  select p.id as portion_id, p.name as portion_name, p.price_pesewas, m.id as item_id, m.name as item_name
    into v_portion
    from public.menu_item_portions p join public.menu_items m on m.id = p.menu_item_id
   where m.slug = 'jollof-grilled-chicken' and p.is_default;
  select * into v_zone from public.delivery_zones where name = 'Adenta';
  if p_fulfilment = 'delivery' then v_fee := v_zone.fee_pesewas; end if;

  v_order := public.create_order(
    jsonb_build_object(
      'customer_id', p_customer, 'customer_name', 'Ama Mensah', 'customer_phone', p_phone,
      'channel', 'web', 'fulfilment', p_fulfilment,
      'zone_id', case when p_fulfilment = 'delivery' then v_zone.id end,
      'zone_name', case when p_fulfilment = 'delivery' then v_zone.name end,
      'zone_eta_minutes', v_zone.eta_minutes,
      'address_gps', 'GA-543-0125', 'address_landmark', 'Behind Adenta SDA church',
      'subtotal_pesewas', v_portion.price_pesewas * 2,
      'delivery_fee_pesewas', v_fee,
      'total_pesewas', v_portion.price_pesewas * 2 + v_fee),
    jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_portion.item_id, 'portion_id', v_portion.portion_id,
      'item_name', v_portion.item_name, 'portion_name', v_portion.portion_name,
      'modifiers', jsonb_build_array(jsonb_build_object('group', 'Spice level', 'option', 'Hot', 'price_pesewas', 0)),
      'unit_price_pesewas', v_portion.price_pesewas, 'quantity', 2,
      'line_total_pesewas', v_portion.price_pesewas * 2)),
    'customer', p_customer);
  return v_order;
end;
$$;

create function test.add_payment(p_order uuid, p_reference text) returns void
language sql as $$
  insert into public.payments (order_id, reference, amount_pesewas)
  select id, p_reference, total_pesewas from public.orders where id = p_order;
$$;

grant execute on all functions in schema test to public;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-0000000000a1', '233241110001'),   -- customer A
  ('00000000-0000-0000-0000-0000000000b2', '233241110002');   -- customer B
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c3', 'attendant@iries.test'),
  ('00000000-0000-0000-0000-0000000000d4', 'kitchen@iries.test'),
  ('00000000-0000-0000-0000-0000000000e5', 'manager@iries.test'),
  ('00000000-0000-0000-0000-0000000000f6', 'rider@iries.test');
insert into public.staff (user_id, display_name, role) values
  ('00000000-0000-0000-0000-0000000000c3', 'Esi (front desk)', 'attendant'),
  ('00000000-0000-0000-0000-0000000000d4', 'Kojo (kitchen)', 'kitchen'),
  ('00000000-0000-0000-0000-0000000000e5', 'Akua (manager)', 'manager'),
  ('00000000-0000-0000-0000-0000000000f6', 'Yaw (rider)', 'dispatcher');

\set cust_a '00000000-0000-0000-0000-0000000000a1'
\set cust_b '00000000-0000-0000-0000-0000000000b2'
\set attendant '00000000-0000-0000-0000-0000000000c3'
\set kitchen '00000000-0000-0000-0000-0000000000d4'
\set manager '00000000-0000-0000-0000-0000000000e5'
\set rider '00000000-0000-0000-0000-0000000000f6'

select test.ok((select phone from public.profiles where id = :'cust_a') = '+233241110001',
               'new phone user gets a profile with E.164 phone');

-- ---------------------------------------------------------------------------
-- Happy path: create -> pay -> accept -> kitchen -> ready -> deliver -> complete
-- ---------------------------------------------------------------------------
select id as order1, public_token as token1, total_pesewas as total1
  from test.make_order(:'cust_a', '+233241110001') \gset

select test.ok((select status from public.orders where id = :'order1') = 'awaiting_payment', 'order starts awaiting payment');
select test.ok((select order_number from public.orders where id = :'order1') >= 1001, 'order numbers start at 1001');
select test.throws($$select public.create_order('{"customer_name":"x","customer_phone":"+233241110001","fulfilment":"pickup","subtotal_pesewas":100,"total_pesewas":100}', '[]')$$,
                   'empty_order', 'orders need at least one item');
select test.throws(format($$select public.create_order('{"customer_name":"x","customer_phone":"+233241110001","fulfilment":"pickup","subtotal_pesewas":999,"total_pesewas":999}',
                   '[{"item_name":"Jollof","unit_price_pesewas":100,"quantity":1,"line_total_pesewas":100}]')$$),
                   'subtotal_mismatch', 'subtotal must equal sum of lines');

-- RLS: who can see the order?
set role anon;
select test.ok((select count(*) from public.orders) = 0, 'anon cannot read orders');
select test.ok((select count(*) from public.menu_items) > 0, 'anon can read the menu');
select test.ok((public.track_order(:'token1') ->> 'order_number') is not null, 'anon can track by token');
select test.ok(public.track_order('not-a-real-token') is null, 'bad token returns nothing');
select test.throws($$select public.confirm_payment('x', 1, 'GHS', 'card', null, null, null, null, '{}')$$,
                   'permission denied', 'anon cannot confirm payments');
reset role;

select test.login(:'cust_b');
set role authenticated;
select test.ok((select count(*) from public.orders) = 0, 'customer B cannot see customer A orders');
select test.throws(format($$select public.transition_order(%L, 'cancelled')$$, :'order1'),
                   'forbidden', 'customer B cannot cancel customer A order');
reset role;

select test.login(:'cust_a');
set role authenticated;
select test.ok((select count(*) from public.orders) = 1, 'customer A sees own order');
select test.ok((select count(*) from public.order_items) = 1, 'customer A sees own order items');
select test.throws($$insert into public.orders (customer_name, customer_phone, fulfilment, subtotal_pesewas, total_pesewas) values ('x', '+233241110001', 'pickup', 1, 1)$$,
                   'row-level security|permission denied', 'customers cannot insert orders directly');
-- UPDATE under RLS without an update policy silently affects 0 rows; verified after reset role below.
update public.orders set total_pesewas = 1 where id = :'order1';
select test.throws(format($$select public.transition_order(%L, 'accepted')$$, :'order1'),
                   'invalid_transition|forbidden', 'customer cannot accept own order');
select test.throws(format($$select public.transition_order(%L, 'paid')$$, :'order1'),
                   'invalid_transition|forbidden', 'customer cannot mark own order paid');
select test.throws(format($$update public.profiles set phone = '+233200000000' where id = %L$$, :'cust_a'),
                   'permission denied', 'customer cannot change verified phone');
update public.profiles set full_name = 'Ama Mensah', marketing_consent = true where id = :'cust_a';
reset role;
select test.ok((select total_pesewas from public.orders where id = :'order1') = :total1, 'direct UPDATE by customer had no effect');
select test.ok((select marketing_consent_at is not null from public.profiles where id = :'cust_a'), 'consent timestamp recorded');

-- Payment
select test.add_payment(:'order1', 'IC-T-0001');
select test.ok((public.confirm_payment('IC-T-0001', :total1, 'GHS', 'mobile_money', '9001', 195, now(), 'Approved', '{}') ->> 'result') = 'paid',
               'verified payment marks order paid');
select test.ok((public.confirm_payment('IC-T-0001', :total1, 'GHS', 'mobile_money', '9001', 195, now(), 'Approved', '{}') ->> 'result') = 'already_processed',
               'duplicate callback is a no-op');
select test.ok((select status from public.orders where id = :'order1') = 'paid', 'order is paid');
select test.ok((select count(*) from public.order_events where order_id = :'order1' and to_status = 'paid') = 1, 'exactly one paid event');
select test.ok((public.confirm_payment('IC-T-UNKNOWN', 100, 'GHS', 'card', null, null, null, null, '{}') ->> 'result') = 'unknown_reference',
               'unknown reference is reported, not crashed');

-- Staff roles
select test.login(:'kitchen');
set role authenticated;
select test.ok((select count(*) from public.orders) >= 1, 'kitchen can see orders');
select test.throws(format($$select public.transition_order(%L, 'accepted')$$, :'order1'),
                   'forbidden_transition', 'kitchen cannot accept orders');
select test.ok((select count(*) from public.payments) = 0, 'kitchen sees no payment rows');
select test.ok((select count(*) from public.profiles where id <> :'kitchen') = 0, 'kitchen sees no customer profiles');
reset role;

select test.login(:'attendant');
set role authenticated;
select test.throws(format($$select public.transition_order(%L, 'rejected')$$, :'order1'),
                   'reason_required', 'rejecting needs a reason');
select test.ok((public.transition_order(:'order1', 'accepted', null, 20)).status = 'accepted', 'attendant accepts with 20 min prep');
select test.ok((public.transition_order(:'order1', 'accepted', null, 20)).status = 'accepted', 'repeat accept is idempotent');
select test.ok((select count(*) from public.payments) >= 1, 'attendant can see payments');
reset role;
select test.ok((select prep_minutes = 20 and estimated_ready_at > now() + interval '19 minutes'
                  from public.orders where id = :'order1'), 'prep time and ETA stored');

select test.login(:'kitchen');
set role authenticated;
select test.ok((public.transition_order(:'order1', 'in_kitchen')).status = 'in_kitchen', 'kitchen starts cooking');
select test.ok((public.transition_order(:'order1', 'ready')).status = 'ready', 'kitchen marks ready');
select test.throws(format($$select public.transition_order(%L, 'out_for_delivery')$$, :'order1'),
                   'forbidden_transition', 'kitchen cannot dispatch');
select test.ok((public.set_item_availability((select id from public.menu_items where slug = 'kelewele'), false)).is_available = false,
               'kitchen can mark an item sold out');
reset role;

select test.login(:'rider');
set role authenticated;
select test.throws(format($$select public.transition_order(%L, 'ready_for_pickup')$$, :'order1'),
                   'forbidden_transition|not_a_pickup_order', 'delivery order cannot become ready-for-pickup');
select test.ok((public.assign_rider(:'order1', 'Yaw', '+233241110009')).rider_name = 'Yaw', 'dispatcher assigns rider');
select test.ok((public.transition_order(:'order1', 'out_for_delivery')).status = 'out_for_delivery', 'dispatcher sends out');
select test.ok((public.transition_order(:'order1', 'delivered')).status = 'delivered', 'dispatcher marks delivered');
reset role;
select test.ok((public.track_order(:'token1') ->> 'status') = 'delivered', 'tracking shows delivered');

update public.orders set delivered_at = now() - interval '3 hours' where id = :'order1';
select test.ok(public.auto_complete_orders(120) >= 1, 'auto-complete runs');
select test.ok((select status from public.orders where id = :'order1') = 'completed', 'order completed');
select test.ok((select count(*) from public.order_events where order_id = :'order1') = 8, 'every step is timestamped in order_events');

-- ---------------------------------------------------------------------------
-- Refunds: partial, over-refund, then full
-- ---------------------------------------------------------------------------
select id as refund1 from public.reserve_refund(:'order1', null, 1000, 'Missing coleslaw', :'manager', 'manager', false) \gset
select test.ok((public.finalize_refund(:'refund1', true, 'RF-1', 'pending', null) ->> 'result') = 'ok', 'partial refund accepted');
select test.ok((select refunded_pesewas from public.orders where id = :'order1') = 1000, 'refunded amount tracked');
select test.ok((select status from public.orders where id = :'order1') = 'completed', 'partial refund keeps status');
select test.throws(format($$select public.reserve_refund(%L, null, %s, 'too much', null, 'manager', false)$$, :'order1', :total1),
                   'refund_amount_invalid', 'cannot refund more than was paid');
select id as refund2 from public.reserve_refund(:'order1', null, null, 'Customer complaint — full refund', :'manager', 'manager', false) \gset
select test.ok((public.finalize_refund(:'refund2', true, 'RF-2', 'processed', null) ->> 'order_refunded')::boolean, 'remaining balance refund completes');
select test.ok((select status from public.orders where id = :'order1') = 'refunded', 'fully refunded order is Refunded');
select test.throws(format($$select public.reserve_refund(%L, null, null, 'again', null, 'manager', false)$$, :'order1'),
                   'nothing_to_refund', 'no double refunds');
select test.ok((public.update_refund_status('RF-1', null, null, 'processed') ->> 'result') = 'updated', 'refund webhook updates status');
select test.ok((public.update_refund_status('RF-1', null, null, 'processed') ->> 'result') = 'unchanged', 'duplicate refund webhook is a no-op');

-- ---------------------------------------------------------------------------
-- Reject -> automatic refund; failed refund releases the amount
-- ---------------------------------------------------------------------------
select id as order2, total_pesewas as total2 from test.make_order(:'cust_a', '+233241110001', 'pickup') \gset
select test.add_payment(:'order2', 'IC-T-0002');
select public.confirm_payment('IC-T-0002', :total2, 'GHS', 'card', '9002', 100, now(), 'Approved', '{}');
select test.login(:'attendant');
set role authenticated;
select test.ok((public.transition_order(:'order2', 'rejected', 'Out of tilapia')).status = 'rejected', 'attendant rejects with reason');
reset role;
select id as refund3 from public.reserve_refund(:'order2', null, null, 'Order rejected: Out of tilapia', null, 'system', true) \gset
select public.finalize_refund(:'refund3', false, null, null, 'Gateway timeout');
select test.ok((select refunded_pesewas from public.orders where id = :'order2') = 0, 'failed refund releases the reserved amount');
select id as refund4 from public.reserve_refund(:'order2', null, null, 'Order rejected: Out of tilapia (retry)', null, 'system', true) \gset
select public.finalize_refund(:'refund4', true, 'RF-4', 'pending', null);
select test.ok((select status from public.orders where id = :'order2') = 'refunded', 'rejected order becomes Refunded');

-- ---------------------------------------------------------------------------
-- Timeouts, late MoMo approval, duplicate payments, amount mismatch
-- ---------------------------------------------------------------------------
select id as order3, total_pesewas as total3 from test.make_order(:'cust_a', '+233241110001') \gset
select test.add_payment(:'order3', 'IC-T-0003');
update public.orders set created_at = now() - interval '2 hours' where id = :'order3';
update public.payments set created_at = now() - interval '2 hours' where reference = 'IC-T-0003';
select test.ok(public.expire_unpaid_orders() >= 1, 'unpaid orders expire');
select test.ok((select status = 'cancelled' and cancel_reason = 'payment_timeout' from public.orders where id = :'order3'), 'expired with payment_timeout');
select test.ok((public.confirm_payment('IC-T-0003', :total3, 'GHS', 'mobile_money', '9003', 100, now(), 'Approved', '{}') ->> 'revived')::boolean,
               'late MoMo approval revives the order');
select test.ok((select status = 'paid' and cancel_reason is null from public.orders where id = :'order3'), 'revived order is paid');

select test.add_payment(:'order3', 'IC-T-0003-B');
select test.ok((public.confirm_payment('IC-T-0003-B', :total3, 'GHS', 'card', '9004', 100, now(), 'Approved', '{}') ->> 'reason') = 'duplicate_payment',
               'second successful payment is flagged for automatic refund');
select id as dup_refund from public.reserve_refund(:'order3', (select id from public.payments where reference = 'IC-T-0003-B'), null,
                                                    'Duplicate payment', null, 'system', true) \gset
select public.finalize_refund(:'dup_refund', true, 'RF-DUP', 'pending', null);
select test.ok((select status from public.orders where id = :'order3') = 'paid', 'refunding a duplicate payment does not touch the order');

select id as order4, total_pesewas as total4 from test.make_order(:'cust_a', '+233241110001') \gset
select test.add_payment(:'order4', 'IC-T-0004');
select test.ok((public.confirm_payment('IC-T-0004', 100, 'GHS', 'card', '9005', 1, now(), 'Approved', '{}') ->> 'result') = 'amount_mismatch',
               'amount mismatch is never accepted');
select test.ok((select status from public.orders where id = :'order4') = 'awaiting_payment', 'order stays unpaid on mismatch');

-- customer may cancel own unpaid order, but not a paid one
select test.login(:'cust_a');
set role authenticated;
select test.ok((public.transition_order(:'order4', 'cancelled')).status = 'cancelled', 'customer cancels own unpaid order');
select test.throws(format($$select public.transition_order(%L, 'cancelled')$$, :'order3'),
                   'forbidden_transition', 'customer cannot cancel a paid order');
reset role;

select test.add_payment(:'order4', 'IC-T-0004-B');
select test.ok((public.confirm_payment('IC-T-0004-B', :total4, 'GHS', 'card', '9006', 1, now(), 'Approved', '{}') ->> 'reason') = 'order_not_payable',
               'payment on a customer-cancelled order is flagged for refund');

-- ---------------------------------------------------------------------------
-- Reports, audit, rate limiting, misc
-- ---------------------------------------------------------------------------
select test.login(:'attendant');
set role authenticated;
select test.throws($$select public.sales_summary(current_date - 1, current_date + 1)$$, 'forbidden', 'attendants cannot open reports');
select test.ok((select count(*) from public.audit_log) = 0, 'attendants cannot read the audit log');
reset role;

select test.login(:'manager');
set role authenticated;
select (public.sales_summary(current_date - 1, current_date + 1)) as summary \gset
select test.ok((:'summary'::jsonb -> 'totals' ->> 'orders')::int = 3, 'report counts paid orders (1 completed+refunded, 1 rejected, 1 revived)');
select test.ok((:'summary'::jsonb -> 'totals' ->> 'refunds_pesewas')::int > 0, 'report includes refunds');
select test.ok(jsonb_array_length(:'summary'::jsonb -> 'top_items') >= 1, 'report has top items');
select test.ok(jsonb_array_length(:'summary'::jsonb -> 'bottom_items') >= 1, 'report has bottom items');
select test.ok((select count(*) from public.customer_list()) = 1, 'customer list groups by phone');
update public.menu_item_portions set price_pesewas = price_pesewas + 500
 where menu_item_id = (select id from public.menu_items where slug = 'kelewele');
select test.ok((select count(*) from public.audit_log where action = 'price_change') = 1, 'price change audited');
select test.ok((select count(*) from public.audit_log where action = 'refund_requested') >= 3, 'refunds audited');
select test.ok((select count(*) from public.audit_log where action = 'order_rejected') = 1, 'rejection audited');
update public.store_settings set accepting_orders = false where id = 1;
select test.ok((select count(*) from public.audit_log where action = 'settings_changed' and actor_id = :'manager' and actor_role = 'manager') = 1, 'settings change audited with actor');
reset role;

select test.ok(public.rate_limit_hit('test:key', 2, 60), 'rate limit hit 1');
select test.ok(public.rate_limit_hit('test:key', 2, 60), 'rate limit hit 2');
select test.ok(not public.rate_limit_hit('test:key', 2, 60), 'rate limit blocks hit 3');

select test.login(:'cust_a');
set role authenticated;
select test.throws($$select public.rate_limit_hit('x', 1, 60)$$, 'permission denied', 'clients cannot call server-only functions');
select test.throws($$select public.set_item_availability((select id from public.menu_items limit 1), true)$$, 'forbidden', 'customers cannot toggle sold-out');
reset role;

\echo 'All database tests passed.'
