-- =============================================================================
-- Remove ALL orders, payments, refunds and SMS logs — for clearing test data
-- right before go-live. Keeps the menu, zones, hours, settings, staff and customers.
-- DANGER: never run this after real customers have ordered.
-- =============================================================================
begin;
update public.orders set paid_payment_id = null where paid_payment_id is not null;
delete from public.refunds;
delete from public.notifications;
delete from public.payments;
delete from public.order_events;
delete from public.order_items;
delete from public.orders;
delete from public.webhook_events;
delete from public.rate_limits;
delete from public.audit_log where entity_type in ('order', 'payment');
alter sequence public.order_number_seq restart with 1001;
commit;
