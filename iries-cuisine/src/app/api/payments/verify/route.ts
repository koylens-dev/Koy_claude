import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { verifyAndProcess } from '@/lib/server/payments'
import { clientIp, jsonError, jsonOk, rateLimit } from '@/lib/server/http'

// POST /api/payments/verify { reference, token }
// Called by the tracking page when the customer returns from Paystack. We ask
// Paystack directly — the browser only tells us *which* transaction to check.
// The webhook would arrive anyway; this just makes the confirmation instant.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { reference?: string; token?: string } | null
  const reference = body?.reference?.trim()
  const token = body?.token?.trim()
  if (!reference || !token || reference.length > 100) return jsonError(400, 'invalid_input', 'Missing reference.')

  if (!(await rateLimit(`verify:${clientIp(req)}`, 30, 60))) return jsonError(429, 'rate_limited', 'Slow down a little.')

  const admin = getAdminSupabase()
  const { data: payment } = await admin
    .from('payments')
    .select('status, orders!payments_order_id_fkey(public_token)')
    .eq('reference', reference)
    .maybeSingle()
  const orderToken = (payment?.orders as unknown as { public_token: string } | null)?.public_token
  if (!payment || orderToken !== token) return jsonError(404, 'not_found', 'Payment not found.')
  if (payment.status === 'success') return jsonOk({ result: 'already_processed' })

  try {
    const outcome = await verifyAndProcess(reference)
    return jsonOk(outcome)
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'verify' } })
    return jsonError(502, 'gateway_unavailable', 'Could not reach the payment service. We will keep checking.')
  }
}
