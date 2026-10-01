import 'server-only'

import { getAdminSupabase } from '@/lib/supabase/admin'
import { fetchMenu, fetchStoreContext, hoursConfig, menuItemMap } from '@/lib/menu'
import { computeTotals, priceLines, type PricedLine } from '@/lib/pricing'
import { formatSlot, isOpenForAsap, isValidScheduledTime, nextOpening } from '@/lib/time'
import { normalizeGhanaPostGps } from '@/lib/ghana-post'
import type { DeliveryZone, StoreSettings } from '@/lib/types'
import type { z } from 'zod'
import type { addressSchema, cartLineSchema } from '@/lib/validation'

export type QuoteIssue = { code: string; message: string; lineIndex?: number }

export type Quote = {
  ok: boolean
  lines: PricedLine[]
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  zone: DeliveryZone | null
  address: { gps: string | null; landmark: string | null; directions: string | null; lat: number | null; lng: number | null }
  scheduledFor: string | null
  issues: QuoteIssue[]
  settings: StoreSettings
}

/**
 * Prices an order from the database and checks every business rule (sold out,
 * zones, minimum order, opening hours, schedule slots). Used for the checkout
 * preview and again, authoritatively, when the order is placed.
 */
export async function buildQuote(
  input: {
    fulfilment: 'delivery' | 'pickup'
    zoneId?: string | null
    address: z.infer<typeof addressSchema>
    scheduledFor?: string | null
    lines: z.infer<typeof cartLineSchema>[]
  },
  opts: { enforceHours: boolean; now?: Date },
): Promise<Quote> {
  const admin = getAdminSupabase()
  const [menu, ctx] = await Promise.all([fetchMenu(admin), fetchStoreContext(admin)])
  const now = opts.now ?? new Date()
  const issues: QuoteIssue[] = []

  const priced = priceLines(menuItemMap(menu), input.lines)
  for (const i of priced.issues) issues.push({ code: i.code, message: i.message, lineIndex: i.index })

  const zone = input.fulfilment === 'delivery' ? (ctx.zones.find((z) => z.id === input.zoneId) ?? null) : null
  const totals = computeTotals({
    subtotal: priced.subtotal,
    lineCount: input.lines.length,
    fulfilment: input.fulfilment,
    zone,
    deliveryEnabled: ctx.settings.delivery_enabled,
    pickupEnabled: ctx.settings.pickup_enabled,
  })
  issues.push(...totals.issues)

  // Address: riders need at least a landmark; Ghana Post GPS is validated if given.
  const rawGps = input.address?.gps?.trim() || null
  const gps = rawGps ? normalizeGhanaPostGps(rawGps) : null
  const landmark = input.address?.landmark?.trim() || null
  if (input.fulfilment === 'delivery') {
    if (rawGps && !gps) issues.push({ code: 'gps_invalid', message: 'That Ghana Post GPS address does not look right (e.g. GA-543-0125).' })
    if (!landmark) issues.push({ code: 'landmark_required', message: 'Add a landmark so our rider can find you.' })
  }

  // Timing
  const cfg = hoursConfig(ctx)
  let scheduledFor: string | null = null
  if (input.scheduledFor) {
    const when = new Date(input.scheduledFor)
    if (!isValidScheduledTime(when, now, cfg)) {
      issues.push({ code: 'schedule_invalid', message: 'That time slot is no longer available. Please pick another.' })
    } else {
      scheduledFor = when.toISOString()
    }
  } else if (opts.enforceHours && !isOpenForAsap(now, cfg)) {
    const next = nextOpening(now, cfg)
    issues.push({
      code: 'closed',
      message: !ctx.settings.accepting_orders
        ? (ctx.settings.pause_message ?? 'We are not taking orders right now.')
        : next
          ? `We're closed right now. We open ${formatSlot(next, now)} — you can schedule your order for later.`
          : "We're closed right now.",
    })
  }

  return {
    ok: issues.length === 0,
    lines: priced.lines,
    subtotal: priced.subtotal,
    deliveryFee: totals.deliveryFee,
    discount: totals.discount,
    total: totals.total,
    zone,
    address: {
      gps,
      landmark,
      directions: input.address?.directions?.trim() || null,
      lat: input.address?.lat ?? null,
      lng: input.address?.lng ?? null,
    },
    scheduledFor,
    issues,
    settings: ctx.settings,
  }
}

/** Shape create_order() expects. */
export function orderPayload(quote: Quote, extra: {
  customerId: string | null
  customerName: string
  customerPhone: string
  customerEmail: string | null
  channel: 'web' | 'phone' | 'whatsapp' | 'walk_in'
  fulfilment: 'delivery' | 'pickup'
  notes: string | null
  createdBy: string | null
}) {
  const delivery = extra.fulfilment === 'delivery'
  return {
    customer_id: extra.customerId,
    customer_name: extra.customerName,
    customer_phone: extra.customerPhone,
    customer_email: extra.customerEmail,
    channel: extra.channel,
    fulfilment: extra.fulfilment,
    zone_id: delivery ? quote.zone?.id : null,
    zone_name: delivery ? quote.zone?.name : null,
    zone_eta_minutes: delivery ? quote.zone?.eta_minutes : null,
    address_gps: delivery ? quote.address.gps : null,
    address_landmark: delivery ? quote.address.landmark : null,
    address_directions: delivery ? quote.address.directions : null,
    address_lat: delivery ? quote.address.lat : null,
    address_lng: delivery ? quote.address.lng : null,
    scheduled_for: quote.scheduledFor,
    notes: extra.notes,
    subtotal_pesewas: quote.subtotal,
    delivery_fee_pesewas: quote.deliveryFee,
    discount_pesewas: quote.discount,
    total_pesewas: quote.total,
    created_by: extra.createdBy,
  }
}

/** Public view of a quote for the browser. */
export function publicQuote(q: Quote) {
  return {
    ok: q.ok,
    lines: q.lines,
    subtotal: q.subtotal,
    deliveryFee: q.deliveryFee,
    discount: q.discount,
    total: q.total,
    zone: q.zone ? { id: q.zone.id, name: q.zone.name, eta_minutes: q.zone.eta_minutes } : null,
    scheduledFor: q.scheduledFor,
    issues: q.issues,
  }
}
export type PublicQuote = ReturnType<typeof publicQuote>
