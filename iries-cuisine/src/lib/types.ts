// Shapes of the rows we read from Supabase (kept by hand; small and stable).

export type StaffRole = 'attendant' | 'kitchen' | 'dispatcher' | 'manager' | 'owner'

export type OrderStatus =
  | 'awaiting_payment'
  | 'paid'
  | 'accepted'
  | 'rejected'
  | 'in_kitchen'
  | 'ready'
  | 'out_for_delivery'
  | 'ready_for_pickup'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded'

export type Fulfilment = 'delivery' | 'pickup'
export type OrderChannel = 'web' | 'phone' | 'whatsapp' | 'walk_in'

export type ModifierOption = {
  id: string
  group_id: string
  name: string
  price_pesewas: number
  is_available: boolean
  is_default: boolean
  sort_order: number
}

export type ModifierGroup = {
  id: string
  name: string
  kind: 'addon' | 'spice' | 'choice'
  min_select: number
  max_select: number
  sort_order: number
  options: ModifierOption[]
}

export type Portion = {
  id: string
  menu_item_id: string
  name: string
  price_pesewas: number
  is_default: boolean
  is_active: boolean
  sort_order: number
}

export type MenuItem = {
  id: string
  category_id: string
  name: string
  slug: string
  description: string | null
  image_path: string | null
  is_available: boolean
  is_active: boolean
  is_featured: boolean
  dietary_tags: string[]
  sort_order: number
  portions: Portion[]
  modifier_groups: ModifierGroup[]
}

export type Category = {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
  items: MenuItem[]
}

export type DeliveryZone = {
  id: string
  name: string
  areas: string | null
  fee_pesewas: number
  min_order_pesewas: number
  eta_minutes: number
  is_active: boolean
  sort_order: number
}

export type StoreSettings = {
  id: number
  store_name: string
  accepting_orders: boolean
  pause_message: string | null
  delivery_enabled: boolean
  pickup_enabled: boolean
  default_prep_minutes: number
  scheduling_enabled: boolean
  schedule_days_ahead: number
  slot_minutes: number
  last_order_minutes_before_close: number
  min_schedule_lead_minutes: number
  payment_timeout_minutes: number
  pickup_address: string
  pickup_lat: number | null
  pickup_lng: number | null
  support_phone: string | null
  whatsapp_number: string | null
}

export type OrderModifierSnapshot = {
  group_id?: string
  group: string
  option_id?: string
  option: string
  price_pesewas: number
}

export type OrderItemRow = {
  id: string
  order_id: string
  menu_item_id: string | null
  portion_id: string | null
  item_name: string
  portion_name: string | null
  modifiers: OrderModifierSnapshot[]
  unit_price_pesewas: number
  quantity: number
  line_total_pesewas: number
  notes: string | null
}

export type OrderRow = {
  id: string
  order_number: number
  public_token: string
  customer_id: string | null
  customer_name: string
  customer_phone: string
  customer_email: string | null
  channel: OrderChannel
  fulfilment: Fulfilment
  status: OrderStatus
  zone_id: string | null
  zone_name: string | null
  zone_eta_minutes: number | null
  address_gps: string | null
  address_landmark: string | null
  address_directions: string | null
  address_lat: number | null
  address_lng: number | null
  scheduled_for: string | null
  notes: string | null
  subtotal_pesewas: number
  delivery_fee_pesewas: number
  discount_pesewas: number
  total_pesewas: number
  refunded_pesewas: number
  prep_minutes: number | null
  estimated_ready_at: string | null
  reject_reason: string | null
  cancel_reason: string | null
  rider_name: string | null
  rider_phone: string | null
  delivery_code: string
  created_by: string | null
  paid_payment_id: string | null
  is_demo: boolean
  paid_at: string | null
  accepted_at: string | null
  rejected_at: string | null
  kitchen_started_at: string | null
  ready_at: string | null
  dispatched_at: string | null
  ready_for_pickup_at: string | null
  delivered_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  refunded_at: string | null
  created_at: string
  updated_at: string
}

export type OrderWithItems = OrderRow & { order_items: OrderItemRow[] }

/** What the public track_order(token) RPC returns. */
export type TrackedOrder = {
  id: string
  order_number: number
  status: OrderStatus
  fulfilment: Fulfilment
  channel: OrderChannel
  customer_name: string
  customer_phone_masked: string
  zone_name: string | null
  zone_eta_minutes: number | null
  address_gps: string | null
  address_landmark: string | null
  scheduled_for: string | null
  notes: string | null
  subtotal_pesewas: number
  delivery_fee_pesewas: number
  discount_pesewas: number
  total_pesewas: number
  refunded_pesewas: number
  prep_minutes: number | null
  estimated_ready_at: string | null
  reject_reason: string | null
  cancel_reason: string | null
  delivery_code: string | null
  rider_name: string | null
  rider_phone: string | null
  created_at: string
  paid_at: string | null
  accepted_at: string | null
  rejected_at: string | null
  kitchen_started_at: string | null
  ready_at: string | null
  dispatched_at: string | null
  ready_for_pickup_at: string | null
  delivered_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  refunded_at: string | null
  items: {
    item_name: string
    portion_name: string | null
    modifiers: OrderModifierSnapshot[]
    quantity: number
    unit_price_pesewas: number
    line_total_pesewas: number
    notes: string | null
    menu_item_id: string | null
    portion_id: string | null
  }[]
  payment: { status: string; channel: string | null; reference: string; paid_at: string | null } | null
  refunds: { amount_pesewas: number; status: string; created_at: string }[]
}
