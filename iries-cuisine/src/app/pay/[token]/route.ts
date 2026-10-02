import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { getCheckoutUrl } from '@/lib/server/payments'
import { rateLimit } from '@/lib/server/http'
import type { OrderRow } from '@/lib/types'

// GET /pay/<token> — a payment link that never goes stale. Sent by SMS/WhatsApp for
// phone orders and used by "Pay now" on the tracking page. Creates (or re-uses) a
// Paystack checkout and redirects to it.
export async function GET(req: NextRequest, ctx: RouteContext<'/pay/[token]'>) {
  const { token } = await ctx.params
  const trackUrl = new URL(`/t/${token}`, req.url)
  if (!/^[0-9a-f]{32}$/.test(token)) return NextResponse.redirect(new URL('/', req.url), 303)

  const admin = getAdminSupabase()
  const { data: order } = await admin.from('orders').select('*').eq('public_token', token).maybeSingle()
  if (!order) return NextResponse.redirect(new URL('/', req.url), 303)
  if (order.status !== 'awaiting_payment') return NextResponse.redirect(trackUrl, 303)
  if (order.is_demo) {
    trackUrl.searchParams.set('error', 'demo')
    return NextResponse.redirect(trackUrl, 303)
  }

  if (!(await rateLimit(`pay:${token}`, 12, 600))) {
    trackUrl.searchParams.set('error', 'rate_limited')
    return NextResponse.redirect(trackUrl, 303)
  }

  try {
    const url = await getCheckoutUrl(order as OrderRow)
    return NextResponse.redirect(url, 303)
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'pay-link' } })
    trackUrl.searchParams.set('error', 'gateway_unavailable')
    return NextResponse.redirect(trackUrl, 303)
  }
}
