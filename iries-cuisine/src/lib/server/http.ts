import 'server-only'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase/admin'

export function jsonError(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message }, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function jsonOk(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, { ...init, headers: { 'Cache-Control': 'no-store', ...(init.headers ?? {}) } })
}

/** Client IP as seen by Vercel's edge (first entry of x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/**
 * Fixed-window rate limit backed by Postgres. Fails open (allows the request)
 * if the database is unreachable, so a hiccup never blocks a paying customer.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await getAdminSupabase().rpc('rate_limit_hit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })
    if (error) throw error
    return data === true
  } catch (err) {
    console.error('[rate-limit] failing open', err)
    return true
  }
}

/** Turns database exceptions like "forbidden_transition:paid->accepted:kitchen" into friendly text. */
export function friendlyDbError(message: string | undefined): { status: number; code: string; message: string } {
  const m = message ?? ''
  if (m.startsWith('forbidden')) return { status: 403, code: 'forbidden', message: "Your role can't do that." }
  if (m.startsWith('invalid_transition')) return { status: 409, code: 'invalid_transition', message: 'This order has already moved on — refresh to see its current status.' }
  if (m.startsWith('reason_required')) return { status: 422, code: 'reason_required', message: 'Please give a reason.' }
  if (m.startsWith('not_a_delivery_order')) return { status: 422, code: 'not_delivery', message: 'This is a pickup order.' }
  if (m.startsWith('not_a_pickup_order')) return { status: 422, code: 'not_pickup', message: 'This is a delivery order.' }
  if (m.startsWith('order_not_found')) return { status: 404, code: 'not_found', message: 'Order not found.' }
  if (m.startsWith('refund_amount_invalid')) {
    const max = Number(m.split('max=')[1])
    return { status: 422, code: 'refund_amount_invalid', message: `Refund must be more than 0 and at most GH₵${(max / 100).toFixed(2)}.` }
  }
  if (m.startsWith('nothing_to_refund')) return { status: 409, code: 'nothing_to_refund', message: 'This payment has already been fully refunded.' }
  if (m.startsWith('payment_not_refundable')) return { status: 409, code: 'payment_not_refundable', message: 'There is no successful payment to refund.' }
  return { status: 500, code: 'server_error', message: 'Something went wrong. Please try again.' }
}
