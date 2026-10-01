import type { NextRequest } from 'next/server'
import { after } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { FRONT_OF_HOUSE, requireStaff } from '@/lib/server/auth'
import { jsonError, jsonOk, rateLimit } from '@/lib/server/http'
import { buildQuote, orderPayload, publicQuote } from '@/lib/server/quote'
import { firstZodMessage, staffOrderSchema } from '@/lib/validation'
import { normalizeGhanaPhone } from '@/lib/phone'
import { payUrl, sendOrderSms, trackUrl } from '@/lib/server/notify'
import { smsTemplates } from '@/lib/sms-templates'

// POST /api/staff/orders — attendant enters a phone / WhatsApp / walk-in order so
// every sale lives in one system. The order waits for payment like any other; the
// customer gets a payment link (SMS and/or WhatsApp). Prepaid only — no cash.
export async function POST(req: NextRequest) {
  const auth = await requireStaff(FRONT_OF_HOUSE)
  if ('response' in auth) return auth.response

  const parsed = staffOrderSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return jsonError(400, 'invalid_input', firstZodMessage(parsed.error))
  const input = parsed.data

  const phone = normalizeGhanaPhone(input.customer.phone)
  if (!phone) return jsonError(422, 'invalid_phone', 'Enter a valid Ghana mobile number, e.g. 024 123 4567.')

  // Staff may take orders outside opening hours (e.g. for later); everything else is enforced.
  const quote = await buildQuote(input, { enforceHours: false })
  if (input.mode === 'quote' || !quote.ok) {
    return jsonOk({ quote: publicQuote(quote) }, { status: quote.ok || input.mode === 'quote' ? 200 : 422 })
  }
  if (!(await rateLimit(`staff-order:${auth.staff.userId}`, 60, 3600))) {
    return jsonError(429, 'rate_limited', 'Too many orders in a short time.')
  }

  const admin = getAdminSupabase()
  // Link to the customer's account if they have one, so it shows in their order history.
  const { data: profile } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle()

  const { data: order, error } = await admin.rpc('create_order', {
    p_order: orderPayload(quote, {
      customerId: profile?.id ?? null,
      customerName: input.customer.name,
      customerPhone: phone,
      customerEmail: input.customer.email || null,
      channel: input.channel,
      fulfilment: input.fulfilment,
      notes: input.notes ?? null,
      createdBy: auth.staff.userId,
    }),
    p_items: quote.lines,
    p_actor_role: auth.staff.role,
    p_actor_id: auth.staff.userId,
  })
  if (error || !order) {
    Sentry.captureException(error ?? new Error('create_order returned nothing'), { tags: { area: 'staff-order' } })
    return jsonError(500, 'order_failed', 'Could not create the order.')
  }

  const links = { pay: payUrl(order.public_token), track: trackUrl(order.public_token) }
  if (input.sendPaymentSms) {
    after(() =>
      sendOrderSms(order.id, 'payment_link', phone, smsTemplates.paymentLink(order.order_number, order.total_pesewas, links.pay)),
    )
  }

  return jsonOk({
    order: { id: order.id, order_number: order.order_number, total_pesewas: order.total_pesewas, customer_phone: phone },
    links,
    quote: publicQuote(quote),
  })
}
