import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { checkoutSchema, firstZodMessage } from '@/lib/validation'
import { getSessionUser } from '@/lib/server/auth'
import { buildQuote, orderPayload, publicQuote } from '@/lib/server/quote'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { getCheckoutUrl } from '@/lib/server/payments'
import { jsonError, rateLimit } from '@/lib/server/http'
import { normalizeGhanaPhone } from '@/lib/phone'
import type { OrderRow } from '@/lib/types'

// POST /api/checkout  { mode: 'quote' | 'place', ... }
// quote: server-side price + rule check for the checkout screen
// place: creates the order (awaiting payment) and returns the Paystack checkout URL
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return jsonError(401, 'unauthorized', 'Please sign in with your phone number first.')

  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return jsonError(400, 'invalid_input', firstZodMessage(parsed.error))
  const input = parsed.data

  const allowed =
    input.mode === 'place' ? await rateLimit(`place:${user.id}`, 8, 600) : await rateLimit(`quote:${user.id}`, 120, 60)
  if (!allowed) return jsonError(429, 'rate_limited', 'Too many attempts. Please wait a minute and try again.')

  const quote = await buildQuote(input, { enforceHours: true })
  if (input.mode === 'quote' || !quote.ok) {
    return NextResponse.json({ quote: publicQuote(quote) }, { status: quote.ok || input.mode === 'quote' ? 200 : 422 })
  }

  const admin = getAdminSupabase()
  const { data: profile } = await admin.from('profiles').select('phone').eq('id', user.id).single()
  const phone = normalizeGhanaPhone(profile?.phone ?? user.phone)
  if (!phone) return jsonError(400, 'phone_required', 'Please sign in again with a Ghana mobile number.')

  const email = input.customer.email || null
  await admin
    .from('profiles')
    .update({
      full_name: input.customer.name,
      email,
      marketing_consent: input.customer.marketingConsent,
      default_zone_id: input.fulfilment === 'delivery' ? quote.zone?.id : undefined,
      default_address: input.fulfilment === 'delivery' ? quote.address : undefined,
    })
    .eq('id', user.id)

  const { data: order, error } = await admin.rpc('create_order', {
    p_order: orderPayload(quote, {
      customerId: user.id,
      customerName: input.customer.name,
      customerPhone: phone,
      customerEmail: email,
      channel: 'web',
      fulfilment: input.fulfilment,
      notes: input.notes ?? null,
      createdBy: null,
    }),
    p_items: quote.lines,
    p_actor_role: 'customer',
    p_actor_id: user.id,
  })
  if (error || !order) {
    Sentry.captureException(error ?? new Error('create_order returned nothing'), { tags: { area: 'checkout' } })
    return jsonError(500, 'order_failed', 'We could not create your order. Please try again.')
  }

  try {
    const authorizationUrl = await getCheckoutUrl(order as OrderRow)
    return NextResponse.json({ orderId: order.id, token: order.public_token, authorizationUrl })
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'checkout' } })
    // The order exists; the customer can retry payment from the tracking page.
    return NextResponse.json(
      { orderId: order.id, token: order.public_token, authorizationUrl: null, error: { code: 'gateway_unavailable', message: 'Payment service is busy. Tap "Pay now" to try again.' } },
      { status: 502 },
    )
  }
}
