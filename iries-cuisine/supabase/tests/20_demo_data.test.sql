-- Demo / training data: load, use, remove. Runs after 10_order_lifecycle (reuses its helpers and users).
\set ON_ERROR_STOP 1
\set QUIET 1

\set attendant '00000000-0000-0000-0000-0000000000c3'
\set manager '00000000-0000-0000-0000-0000000000e5'

select count(*) as real_orders_before from public.orders where not is_demo \gset
select last_value as seq_before from public.order_number_seq \gset

-- clients can never load or remove demo data directly
select test.login(:'manager');
set role authenticated;
select test.throws($$select public.seed_demo_data(7)$$, 'permission denied', 'clients cannot load demo data');
select test.throws($$select public.clear_demo_data()$$, 'permission denied', 'clients cannot remove demo data');
reset role;

select public.seed_demo_data(21) as seeded \gset
select test.ok((:'seeded'::jsonb ->> 'history_orders')::int > 250, 'three weeks of history created');
select test.ok((select count(*) from public.orders where is_demo and created_at > now() - interval '2 hours') >= 9, 'live demo orders created');
select test.ok((select count(*) from public.orders where is_demo and status = 'paid') = 2, 'two new paid orders ring the alarm');
select test.ok((select count(*) from public.orders where is_demo and status = 'awaiting_payment') = 1, 'one phone order awaiting payment');
select test.ok((select count(*) from public.orders o where is_demo and paid_at is not null
                 and not exists (select 1 from public.payments p where p.id = o.paid_payment_id and p.status = 'success')) = 0,
               'every paid demo order has its successful payment');
select test.ok((select count(*) from public.orders o where is_demo
                 and subtotal_pesewas <> (select sum(line_total_pesewas) from public.order_items i where i.order_id = o.id)) = 0,
               'demo subtotals equal their line items');
select test.ok((select count(*) from public.orders o where is_demo and status = 'completed'
                 and (select count(*) from public.order_events e where e.order_id = o.id) < 6) = 0,
               'completed demo orders have a full timeline');
select test.ok((select count(*) from public.orders where is_demo and status = 'refunded' and refunded_pesewas <> total_pesewas) = 0,
               'refunded demo orders are fully refunded');
select test.ok((select count(distinct customer_phone) from public.orders where is_demo) between 200 and 600, 'a believable customer base');
select test.ok((select count(*) from public.catering_enquiries where is_demo) = 5, 'demo catering enquiries');
select test.throws($$select public.seed_demo_data(7)$$, 'demo_data_exists', 'demo data cannot be loaded twice');

-- the reports light up
select test.login(:'manager');
set role authenticated;
select (public.sales_summary(current_date - 14, current_date)) as summary \gset
select test.ok((:'summary'::jsonb -> 'totals' ->> 'orders')::int > 150, 'sales report includes demo history');
select test.ok(jsonb_array_length(:'summary'::jsonb -> 'by_hour') >= 5, 'orders spread over the day');
select test.ok((:'summary'::jsonb -> 'totals' ->> 'repeat_customers')::int > 5, 'repeat customers appear');
select test.ok((:'summary'::jsonb -> 'totals' ->> 'repeat_customers')::numeric / (:'summary'::jsonb -> 'totals' ->> 'customers')::numeric
               between 0.2 and 0.8, 'not everyone is a repeat customer');
select test.ok((select count(*) from public.customer_list() where is_demo) = 0, 'demo customers never in the default list / export');
select test.ok((select count(*) from public.customer_list(true) where is_demo) > 20, 'demo customers visible on request');
reset role;

-- training: simulate a payment, then reject (staff path) and refund
select id as demo_unpaid from public.orders where is_demo and status = 'awaiting_payment' limit 1 \gset
select test.ok((public.demo_pay(:'demo_unpaid') ->> 'result') = 'paid', 'simulated payment marks a demo order paid');
select test.throws(format($$select public.demo_pay(%L)$$, :'demo_unpaid'), 'invalid_transition', 'cannot simulate paying twice');
select test.throws(format($$select public.demo_pay(%L)$$, (select id from public.orders where not is_demo limit 1)),
                   'not_a_demo_order', 'real orders can never be "simulated" paid');
select test.login(:'attendant');
set role authenticated;
select test.ok((public.transition_order(:'demo_unpaid', 'rejected', 'Practice rejection')).status = 'rejected', 'staff can practise on demo orders');
reset role;

-- remove everything demo; real orders survive
select public.clear_demo_data() as cleared \gset
select test.ok((:'cleared'::jsonb ->> 'orders')::int > 250, 'demo orders removed');
select test.ok((select count(*) from public.orders where is_demo) = 0, 'no demo orders left');
select test.ok((select count(*) from public.catering_enquiries where is_demo) = 0, 'no demo catering left');
select test.ok((select count(*) from public.payments where reference like 'DEMO-%') = 0, 'no demo payments left');
select test.ok((select count(*) from public.orders where not is_demo) = :real_orders_before, 'real orders untouched');

\echo 'Demo data tests passed.'
