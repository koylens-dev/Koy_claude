import type { SupabaseClient } from '@supabase/supabase-js'
import type { Category, DeliveryZone, MenuItem, ModifierGroup, StoreSettings } from './types'
import type { HoursConfig, OpeningWindow } from './time'

const MENU_SELECT = `
  id, name, slug, description, sort_order, is_active,
  menu_items (
    id, category_id, name, slug, description, image_path, is_available, is_active, is_featured, dietary_tags, sort_order,
    menu_item_portions ( id, menu_item_id, name, price_pesewas, is_default, is_active, sort_order ),
    menu_item_modifier_groups (
      sort_order,
      modifier_groups ( id, name, kind, min_select, max_select, sort_order,
        modifier_options ( id, group_id, name, price_pesewas, is_available, is_default, sort_order ) )
    )
  )
`

type RawGroupLink = { sort_order: number; modifier_groups: (Omit<ModifierGroup, 'options'> & { modifier_options: ModifierGroup['options'] }) | null }
type RawItem = Omit<MenuItem, 'portions' | 'modifier_groups'> & {
  menu_item_portions: MenuItem['portions']
  menu_item_modifier_groups: RawGroupLink[]
}
type RawCategory = Omit<Category, 'items'> & { menu_items: RawItem[] }

const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order

function normalizeItem(raw: RawItem, includeInactive: boolean): MenuItem {
  return {
    id: raw.id,
    category_id: raw.category_id,
    name: raw.name,
    slug: raw.slug,
    description: raw.description,
    image_path: raw.image_path,
    is_available: raw.is_available,
    is_active: raw.is_active,
    is_featured: raw.is_featured,
    dietary_tags: raw.dietary_tags ?? [],
    sort_order: raw.sort_order,
    portions: (raw.menu_item_portions ?? []).filter((p) => includeInactive || p.is_active).sort(bySort),
    modifier_groups: (raw.menu_item_modifier_groups ?? [])
      .filter((l) => l.modifier_groups)
      .sort(bySort)
      .map((l, index) => ({
        id: l.modifier_groups!.id,
        name: l.modifier_groups!.name,
        kind: l.modifier_groups!.kind,
        min_select: l.modifier_groups!.min_select,
        max_select: l.modifier_groups!.max_select,
        sort_order: index,
        options: [...(l.modifier_groups!.modifier_options ?? [])].sort(bySort),
      })),
  }
}

/** Whole menu, ordered. Public callers see only active rows (RLS); `includeInactive` is for admin views. */
export async function fetchMenu(supabase: SupabaseClient, opts: { includeInactive?: boolean } = {}): Promise<Category[]> {
  let query = supabase.from('categories').select(MENU_SELECT).order('sort_order')
  if (!opts.includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as unknown as RawCategory[]).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    sort_order: c.sort_order,
    is_active: c.is_active,
    items: (c.menu_items ?? [])
      .filter((i) => opts.includeInactive || i.is_active)
      .map((i) => normalizeItem(i, !!opts.includeInactive))
      .filter((i) => opts.includeInactive || i.portions.length > 0)
      .sort(bySort),
  }))
}

export function menuItemMap(categories: Category[]): Map<string, MenuItem> {
  const map = new Map<string, MenuItem>()
  for (const c of categories) for (const i of c.items) map.set(i.id, i)
  return map
}

export type StoreContext = {
  settings: StoreSettings
  zones: DeliveryZone[]
  hours: OpeningWindow[]
  closedDates: string[]
}

export async function fetchStoreContext(supabase: SupabaseClient): Promise<StoreContext> {
  const [settings, zones, hours, closed] = await Promise.all([
    supabase.from('store_settings').select('*').eq('id', 1).single(),
    supabase.from('delivery_zones').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('opening_hours').select('day_of_week, opens_at, closes_at'),
    supabase.from('closed_dates').select('closed_on').gte('closed_on', new Date(Date.now() - 86400000).toISOString().slice(0, 10)),
  ])
  if (settings.error) throw settings.error
  return {
    settings: settings.data as StoreSettings,
    zones: (zones.data ?? []) as DeliveryZone[],
    hours: (hours.data ?? []) as OpeningWindow[],
    closedDates: (closed.data ?? []).map((r: { closed_on: string }) => r.closed_on),
  }
}

export function hoursConfig(ctx: StoreContext): HoursConfig {
  return {
    hours: ctx.hours,
    closedDates: ctx.closedDates,
    acceptingOrders: ctx.settings.accepting_orders,
    lastOrderMinutesBeforeClose: ctx.settings.last_order_minutes_before_close,
    schedulingEnabled: ctx.settings.scheduling_enabled,
    scheduleDaysAhead: ctx.settings.schedule_days_ahead,
    slotMinutes: ctx.settings.slot_minutes,
    minScheduleLeadMinutes: ctx.settings.min_schedule_lead_minutes,
  }
}
