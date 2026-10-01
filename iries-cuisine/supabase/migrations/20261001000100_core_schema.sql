-- =============================================================================
-- Irie's Cuisine — core schema
-- Money is stored as integer pesewas (GHS 1.00 = 100 pesewas). Never floats.
-- All timestamps are timestamptz (UTC in storage); the business runs on
-- Africa/Accra time (GMT, no daylight saving).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.staff_role as enum ('attendant', 'kitchen', 'dispatcher', 'manager', 'owner');

create type public.order_status as enum (
  'awaiting_payment',
  'paid',
  'accepted',
  'rejected',
  'in_kitchen',
  'ready',
  'out_for_delivery',
  'ready_for_pickup',
  'delivered',
  'completed',
  'cancelled',
  'refunded'
);

create type public.fulfilment_type as enum ('delivery', 'pickup');
create type public.order_channel as enum ('web', 'phone', 'whatsapp', 'walk_in');

create type public.payment_status as enum (
  'initialized',     -- created on our side, customer sent to gateway
  'pending',         -- gateway says the customer has not completed yet (e.g. MoMo prompt open)
  'success',
  'failed',
  'abandoned',
  'reversed',
  'amount_mismatch'  -- gateway amount/currency differs from what we asked for: never auto-accepted
);

create type public.refund_status as enum ('pending', 'processing', 'processed', 'failed');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Store settings (single row) and opening hours
-- ---------------------------------------------------------------------------
create table public.store_settings (
  id smallint primary key default 1 check (id = 1),
  store_name text not null default 'Irie''s Cuisine',
  accepting_orders boolean not null default true,          -- manual "pause orders" switch
  pause_message text,
  delivery_enabled boolean not null default true,
  pickup_enabled boolean not null default true,
  default_prep_minutes integer not null default 25 check (default_prep_minutes between 5 and 240),
  scheduling_enabled boolean not null default true,
  schedule_days_ahead integer not null default 2 check (schedule_days_ahead between 0 and 14),
  slot_minutes integer not null default 30 check (slot_minutes in (15, 20, 30, 60)),
  last_order_minutes_before_close integer not null default 30 check (last_order_minutes_before_close between 0 and 180),
  min_schedule_lead_minutes integer not null default 60 check (min_schedule_lead_minutes between 15 and 1440),
  payment_timeout_minutes integer not null default 45 check (payment_timeout_minutes between 10 and 1440),
  pickup_address text not null default 'Adenta, Accra',
  pickup_lat numeric(9, 6),
  pickup_lng numeric(9, 6),
  support_phone text,
  whatsapp_number text,
  updated_at timestamptz not null default now()
);

create trigger store_settings_updated_at before update on public.store_settings
  for each row execute function public.set_updated_at();

insert into public.store_settings (id) values (1);

create table public.opening_hours (
  id bigint generated always as identity primary key,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday … 6 = Saturday
  opens_at time not null,
  closes_at time not null,
  constraint opening_hours_window check (closes_at > opens_at)
);
create index opening_hours_day_idx on public.opening_hours (day_of_week);

create table public.closed_dates (
  closed_on date primary key,
  reason text
);

-- ---------------------------------------------------------------------------
-- Delivery zones (Phase 1: zone-based fees; Phase 2 adds distance/polygons)
-- ---------------------------------------------------------------------------
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  areas text,                                   -- neighbourhoods covered, shown to customers
  fee_pesewas integer not null check (fee_pesewas >= 0),
  min_order_pesewas integer not null default 0 check (min_order_pesewas >= 0),
  eta_minutes integer not null default 40 check (eta_minutes between 5 and 240),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger delivery_zones_updated_at before update on public.delivery_zones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  image_path text,                               -- path inside the public "menu" storage bucket
  is_available boolean not null default true,    -- false = SOLD OUT (still listed)
  is_active boolean not null default true,       -- false = hidden from the menu
  is_featured boolean not null default false,
  dietary_tags text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index menu_items_category_idx on public.menu_items (category_id, sort_order);
create trigger menu_items_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();

-- Portion sizes. Every item has at least one portion; the portion carries the price.
create table public.menu_item_portions (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  name text not null,                            -- "Regular", "Large", "Family (serves 4)"
  price_pesewas integer not null check (price_pesewas >= 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0
);
create index menu_item_portions_item_idx on public.menu_item_portions (menu_item_id, sort_order);

-- Add-ons / extras / spice level are all modifier groups.
create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'addon' check (kind in ('addon', 'spice', 'choice')),
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modifier_groups_select_range check (max_select >= min_select)
);
create trigger modifier_groups_updated_at before update on public.modifier_groups
  for each row execute function public.set_updated_at();

create table public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.modifier_groups (id) on delete cascade,
  name text not null,
  price_pesewas integer not null default 0 check (price_pesewas >= 0),
  is_available boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0
);
create index modifier_options_group_idx on public.modifier_options (group_id, sort_order);

create table public.menu_item_modifier_groups (
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  group_id uuid not null references public.modifier_groups (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (menu_item_id, group_id)
);
create index menu_item_modifier_groups_group_idx on public.menu_item_modifier_groups (group_id);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique,                             -- E.164, e.g. +233241234567 (verified by OTP)
  full_name text,
  email text,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  default_zone_id uuid references public.delivery_zones (id) on delete set null,
  default_address jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role public.staff_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger staff_updated_at before update on public.staff
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create sequence public.order_number_seq start with 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint not null unique default nextval('public.order_number_seq'),
  -- unguessable token (122 random bits) for the public tracking/receipt/payment links sent by SMS;
  -- 32 characters keeps those SMS inside one 160-character message
  public_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  customer_id uuid references auth.users (id) on delete set null,
  customer_name text not null check (length(customer_name) between 1 and 120),
  customer_phone text not null check (customer_phone ~ '^\+233[0-9]{9}$'),
  customer_email text,
  channel public.order_channel not null default 'web',
  fulfilment public.fulfilment_type not null,
  status public.order_status not null default 'awaiting_payment',

  zone_id uuid references public.delivery_zones (id) on delete restrict,
  zone_name text,
  zone_eta_minutes integer,
  address_gps text,                              -- Ghana Post GPS digital address, e.g. GA-543-0125
  address_landmark text,
  address_directions text,
  address_lat numeric(9, 6),
  address_lng numeric(9, 6),

  scheduled_for timestamptz,
  notes text check (notes is null or length(notes) <= 500),

  subtotal_pesewas integer not null check (subtotal_pesewas >= 0),
  delivery_fee_pesewas integer not null default 0 check (delivery_fee_pesewas >= 0),
  discount_pesewas integer not null default 0 check (discount_pesewas >= 0),
  total_pesewas integer not null check (total_pesewas > 0),
  refunded_pesewas integer not null default 0 check (refunded_pesewas >= 0),

  prep_minutes integer check (prep_minutes is null or prep_minutes between 1 and 600),
  estimated_ready_at timestamptz,
  reject_reason text,
  cancel_reason text,
  rider_name text,
  rider_phone text,
  delivery_code text not null default lpad((floor(random() * 10000))::int::text, 4, '0'),
  created_by uuid references auth.users (id) on delete set null,   -- staff member for phone/WhatsApp orders
  paid_payment_id uuid,                                             -- FK added after payments table

  paid_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  kitchen_started_at timestamptz,
  ready_at timestamptz,
  dispatched_at timestamptz,
  ready_for_pickup_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_total_matches check (total_pesewas = subtotal_pesewas + delivery_fee_pesewas - discount_pesewas),
  constraint orders_delivery_needs_zone check (fulfilment = 'pickup' or zone_id is not null),
  constraint orders_delivery_needs_address check (
    fulfilment = 'pickup' or coalesce(address_gps, address_landmark, address_directions) is not null
  )
);
create index orders_status_idx on public.orders (status) where status not in ('completed', 'cancelled', 'refunded', 'rejected');
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_phone_idx on public.orders (customer_phone, created_at desc);
create index orders_created_idx on public.orders (created_at desc);
create index orders_paid_idx on public.orders (paid_at) where paid_at is not null;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  portion_id uuid references public.menu_item_portions (id) on delete set null,
  item_name text not null,
  portion_name text,
  modifiers jsonb not null default '[]'::jsonb,  -- snapshot: [{group, option, price_pesewas}]
  unit_price_pesewas integer not null check (unit_price_pesewas >= 0),
  quantity integer not null check (quantity between 1 and 50),
  line_total_pesewas integer not null,
  notes text check (notes is null or length(notes) <= 200),
  constraint order_items_line_total check (line_total_pesewas = unit_price_pesewas * quantity)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_menu_item_idx on public.order_items (menu_item_id);

-- Every status change, timestamped, with who did it.
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id uuid,
  actor_role text not null,          -- customer | attendant | kitchen | dispatcher | manager | owner | system
  note text,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

-- The order state machine, as data. transition_order() refuses anything not listed here.
create table public.order_status_transitions (
  from_status public.order_status not null,
  to_status public.order_status not null,
  allowed_roles text[] not null,
  primary key (from_status, to_status)
);

insert into public.order_status_transitions (from_status, to_status, allowed_roles) values
  -- payment (only the server, after a verified gateway confirmation)
  ('awaiting_payment', 'paid',             array['system']),
  ('cancelled',        'paid',             array['system']),  -- late MoMo approval after timeout; guarded in code
  ('awaiting_payment', 'cancelled',        array['system', 'customer', 'attendant', 'manager', 'owner']),
  -- attendant decision
  ('paid',             'accepted',         array['attendant', 'manager', 'owner']),
  ('paid',             'rejected',         array['attendant', 'manager', 'owner']),
  -- kitchen
  ('accepted',         'in_kitchen',       array['kitchen', 'attendant', 'manager', 'owner']),
  ('accepted',         'ready',            array['kitchen', 'attendant', 'manager', 'owner']),
  ('in_kitchen',       'ready',            array['kitchen', 'attendant', 'manager', 'owner']),
  -- hand-off
  ('ready',            'out_for_delivery', array['attendant', 'dispatcher', 'manager', 'owner']),
  ('ready',            'ready_for_pickup', array['attendant', 'kitchen', 'manager', 'owner']),
  ('out_for_delivery', 'delivered',        array['attendant', 'dispatcher', 'manager', 'owner']),
  ('ready_for_pickup', 'delivered',        array['attendant', 'manager', 'owner']),
  ('delivered',        'completed',        array['system', 'attendant', 'manager', 'owner']),
  -- cancellation after payment: managers only (the app refunds automatically)
  ('paid',             'cancelled',        array['manager', 'owner']),
  ('accepted',         'cancelled',        array['manager', 'owner']),
  ('in_kitchen',       'cancelled',        array['manager', 'owner']),
  ('ready',            'cancelled',        array['manager', 'owner']),
  ('out_for_delivery', 'cancelled',        array['manager', 'owner']),
  ('ready_for_pickup', 'cancelled',        array['manager', 'owner']),
  -- full refund (set by the refund flow once the gateway accepts the refund)
  ('paid',             'refunded',         array['system']),
  ('accepted',         'refunded',         array['system']),
  ('rejected',         'refunded',         array['system']),
  ('in_kitchen',       'refunded',         array['system']),
  ('ready',            'refunded',         array['system']),
  ('out_for_delivery', 'refunded',         array['system']),
  ('ready_for_pickup', 'refunded',         array['system']),
  ('delivered',        'refunded',         array['system']),
  ('completed',        'refunded',         array['system']),
  ('cancelled',        'refunded',         array['system']);

-- ---------------------------------------------------------------------------
-- Payments, refunds, webhooks
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null default 'paystack',
  reference text not null unique,
  amount_pesewas integer not null check (amount_pesewas > 0),
  currency text not null default 'GHS',
  status public.payment_status not null default 'initialized',
  channel text,                     -- mobile_money | card | bank | bank_transfer | …
  provider_transaction_id text,
  fees_pesewas integer,
  authorization_url text,
  access_code text,
  customer_email text,
  gateway_response text,
  paid_at timestamptz,
  last_checked_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id, created_at desc);
create index payments_open_idx on public.payments (created_at) where status in ('initialized', 'pending');
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.orders
  add constraint orders_paid_payment_fk foreign key (paid_payment_id) references public.payments (id) on delete restrict;

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  payment_id uuid not null references public.payments (id) on delete restrict,
  amount_pesewas integer not null check (amount_pesewas > 0),
  reason text not null check (length(reason) between 3 and 500),
  status public.refund_status not null default 'pending',
  provider_refund_id text,
  requested_by uuid references auth.users (id) on delete set null,
  requested_role text not null,
  is_automatic boolean not null default false,
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index refunds_order_idx on public.refunds (order_id);
create index refunds_payment_idx on public.refunds (payment_id);
create index refunds_open_idx on public.refunds (created_at) where status in ('pending', 'processing');
create trigger refunds_updated_at before update on public.refunds
  for each row execute function public.set_updated_at();

create table public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null default 'paystack',
  dedupe_key text not null,
  event_type text,
  reference text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  result text,
  error text,
  constraint webhook_events_dedupe unique (provider, dedupe_key)
);
create index webhook_events_reference_idx on public.webhook_events (reference);

-- ---------------------------------------------------------------------------
-- Notifications (SMS log, also guarantees one message per order per kind)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id bigint generated always as identity primary key,
  order_id uuid references public.orders (id) on delete cascade,
  channel text not null default 'sms',
  kind text not null,
  recipient text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider text,
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint notifications_once unique (order_id, kind, channel)
);

-- ---------------------------------------------------------------------------
-- Audit log (price changes, refunds, cancellations, staff & settings changes)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window counters, used by the server)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------------------
-- Catering / bulk-order enquiries (Phase 1: capture + list; Phase 3: pipeline)
-- ---------------------------------------------------------------------------
create table public.catering_enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  phone text not null,
  email text,
  event_date date,
  event_type text,
  headcount integer check (headcount is null or headcount between 1 and 100000),
  budget text,
  location text,
  menu_interest text,
  notes text check (notes is null or length(notes) <= 2000),
  status text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'won', 'lost')),
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger catering_enquiries_updated_at before update on public.catering_enquiries
  for each row execute function public.set_updated_at();
