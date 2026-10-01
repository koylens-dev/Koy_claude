-- =============================================================================
-- Irie's Cuisine — row level security, function privileges, realtime, storage
--
-- Model:
--   * anon (not signed in): read the public menu, store settings and hours;
--     track an order by its unguessable token.
--   * customers (signed in by phone OTP): read/update their own profile, read
--     their own orders; cancel their own unpaid order.
--   * staff: read orders; change status only through transition_order();
--     roles are looked up in public.staff on every call.
--   * managers/owner: manage menu, hours, zones, settings; see reports, audit
--     log, customers, payments.
--   * the server (service_role key, never sent to browsers): creates orders,
--     confirms payments, issues refunds.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Row level security on every table
-- ---------------------------------------------------------------------------
alter table public.store_settings            enable row level security;
alter table public.opening_hours             enable row level security;
alter table public.closed_dates              enable row level security;
alter table public.delivery_zones            enable row level security;
alter table public.categories                enable row level security;
alter table public.menu_items                enable row level security;
alter table public.menu_item_portions        enable row level security;
alter table public.modifier_groups           enable row level security;
alter table public.modifier_options          enable row level security;
alter table public.menu_item_modifier_groups enable row level security;
alter table public.profiles                  enable row level security;
alter table public.staff                     enable row level security;
alter table public.orders                    enable row level security;
alter table public.order_items               enable row level security;
alter table public.order_events              enable row level security;
alter table public.order_status_transitions  enable row level security;
alter table public.payments                  enable row level security;
alter table public.refunds                   enable row level security;
alter table public.webhook_events            enable row level security;
alter table public.notifications             enable row level security;
alter table public.audit_log                 enable row level security;
alter table public.rate_limits               enable row level security;
alter table public.catering_enquiries        enable row level security;

-- ---------------------------------------------------------------------------
-- Public catalogue & settings
-- ---------------------------------------------------------------------------
create policy "settings readable by everyone" on public.store_settings
  for select to anon, authenticated using (true);
create policy "settings editable by managers" on public.store_settings
  for update to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));

create policy "hours readable by everyone" on public.opening_hours
  for select to anon, authenticated using (true);
create policy "hours managed by managers" on public.opening_hours
  for all to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));

create policy "closures readable by everyone" on public.closed_dates
  for select to anon, authenticated using (true);
create policy "closures managed by managers" on public.closed_dates
  for all to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));

create policy "active zones readable" on public.delivery_zones
  for select to anon, authenticated using (is_active or (select public.is_staff()));
create policy "zones managed by managers" on public.delivery_zones
  for all to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));

create policy "active categories readable" on public.categories
  for select to anon, authenticated using (is_active or (select public.is_staff()));
create policy "categories managed by managers" on public.categories
  for all to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));

create policy "active items readable" on public.menu_items
  for select to anon, authenticated using (is_active or (select public.is_staff()));
create policy "items managed by managers" on public.menu_items
  for all to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));

create policy "active portions readable" on public.menu_item_portions
  for select to anon, authenticated using (is_active or (select public.is_staff()));
create policy "portions managed by managers" on public.menu_item_portions
  for all to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));

create policy "modifier groups readable" on public.modifier_groups
  for select to anon, authenticated using (true);
create policy "modifier groups managed by managers" on public.modifier_groups
  for all to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));

create policy "modifier options readable" on public.modifier_options
  for select to anon, authenticated using (true);
create policy "modifier options managed by managers" on public.modifier_options
  for all to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));

create policy "item modifier links readable" on public.menu_item_modifier_groups
  for select to anon, authenticated using (true);
create policy "item modifier links managed by managers" on public.menu_item_modifier_groups
  for all to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));

create policy "transitions readable" on public.order_status_transitions
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create policy "own profile or front-of-house staff" on public.profiles
  for select to authenticated
  using (id = (select auth.uid())
         or (select public.has_staff_role(array['attendant', 'manager', 'owner']::public.staff_role[])));
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Customers may only change these columns (never id or the OTP-verified phone).
revoke update on public.profiles from anon, authenticated;
grant update (full_name, email, marketing_consent, default_zone_id, default_address) on public.profiles to authenticated;

create policy "staff see own row, managers see all" on public.staff
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_manager()));
-- staff rows are written only by the server (owner/manager-checked API route)

-- ---------------------------------------------------------------------------
-- Orders (read-only for clients; all writes go through SECURITY DEFINER functions)
-- ---------------------------------------------------------------------------
create policy "customers see own orders, staff see all" on public.orders
  for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_staff()));

create policy "order items follow order visibility" on public.order_items
  for select to authenticated
  using ((select public.is_staff())
         or exists (select 1 from public.orders o
                     where o.id = order_items.order_id and o.customer_id = (select auth.uid())));

create policy "order events follow order visibility" on public.order_events
  for select to authenticated
  using ((select public.is_staff())
         or exists (select 1 from public.orders o
                     where o.id = order_events.order_id and o.customer_id = (select auth.uid())));

create policy "payments visible to front-of-house" on public.payments
  for select to authenticated
  using ((select public.has_staff_role(array['attendant', 'manager', 'owner']::public.staff_role[])));

create policy "refunds visible to front-of-house" on public.refunds
  for select to authenticated
  using ((select public.has_staff_role(array['attendant', 'manager', 'owner']::public.staff_role[])));

create policy "notifications visible to front-of-house" on public.notifications
  for select to authenticated
  using ((select public.has_staff_role(array['attendant', 'manager', 'owner']::public.staff_role[])));

create policy "audit log visible to managers" on public.audit_log
  for select to authenticated using ((select public.is_manager()));

create policy "catering visible to managers" on public.catering_enquiries
  for select to authenticated using ((select public.is_manager()));
create policy "catering updated by managers" on public.catering_enquiries
  for update to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));

-- webhook_events and rate_limits: no policies at all => server (service_role) only.

-- ---------------------------------------------------------------------------
-- Function privileges: deny by default, then grant precisely.
-- (Postgres grants EXECUTE to PUBLIC by default and Supabase adds anon/authenticated.)
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Used inside RLS policies, so callers must be able to execute them.
grant execute on function public.current_staff_role() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_manager() to anon, authenticated;
grant execute on function public.has_staff_role(public.staff_role[]) to anon, authenticated;

-- Client-callable RPCs (each checks the caller's role itself)
grant execute on function public.track_order(text) to anon, authenticated;
grant execute on function public.transition_order(uuid, public.order_status, text, integer) to authenticated;
grant execute on function public.set_item_availability(uuid, boolean) to authenticated;
grant execute on function public.set_option_availability(uuid, boolean) to authenticated;
grant execute on function public.assign_rider(uuid, text, text) to authenticated;
grant execute on function public.sales_summary(date, date) to authenticated;
grant execute on function public.customer_list() to authenticated;

-- Server-only
grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: staff screens and the menu's "sold out" badges update live.
-- RLS is applied per subscriber, so customers only receive their own orders.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
    alter publication supabase_realtime add table public.menu_items;
    alter publication supabase_realtime add table public.modifier_options;
    alter publication supabase_realtime add table public.store_settings;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: public "menu" bucket for dish photos; only managers can write.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('menu', 'menu', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute $p$
      create policy "menu images uploaded by managers" on storage.objects
        for insert to authenticated
        with check (bucket_id = 'menu' and (select public.is_manager()))
    $p$;
    execute $p$
      create policy "menu images updated by managers" on storage.objects
        for update to authenticated
        using (bucket_id = 'menu' and (select public.is_manager()))
    $p$;
    execute $p$
      create policy "menu images deleted by managers" on storage.objects
        for delete to authenticated
        using (bucket_id = 'menu' and (select public.is_manager()))
    $p$;
  end if;
end;
$$;
