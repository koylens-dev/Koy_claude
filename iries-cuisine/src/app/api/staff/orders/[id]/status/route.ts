import type { NextRequest } from 'next/server'
import { after } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getServerSupabase } from '@/lib/supabase/server'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/server/auth'
import { friendlyDbError, jsonError, jsonOk } from '@/lib/server/http'
import { firstZodMessage, statusChangeSchema } from '@/lib/validation'
import { issueRefund } from '@/lib/server/payments'
import { notifyStatusChange } from '@/lib/server/notify'
import { normalizeGhanaPhone } from '@/lib/phone'
import type { OrderRow } from '@/lib/types'

// POST /api/staff/orders/:id/status { to, note?, prepMinutes?, riderName?, riderPhone? }
// The status change runs as the signed-in staff member, so the database checks
// their role against the transition rules. Side effects (refund on reject/cancel,
// customer SMS) happen here afterwards.
export async function POST(req: NextRequest, ctx: RouteContext<'/api/staff/orders/[id]/status'>) {
  const auth = await requireStaff()
  if ('response' in auth) return auth.response
  const { id } = await ctx.params

  const parsed = statusChangeSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return jsonError(400, 'invalid_input', firstZodMessage(parsed.error))
  const input = parsed.data
  const supabase = await getServerSupabase()

  if (input.to === 'out_for_delivery' && (input.riderName || input.riderPhone)) {
    const riderPhone = input.riderPhone ? normalizeGhanaPhone(input.riderPhone) : null
    if (input.riderPhone && !riderPhone) return jsonError(422, 'invalid_phone', 'Rider phone number is not valid.')
    const { error } = await supabase.rpc('assign_rider', {
      p_order_id: id,
      p_rider_name: input.riderName ?? '',
      p_rider_phone: riderPhone ?? '',
    })
    if (error) {
      const f = friendlyDbError(error.message)
      return jsonError(f.status, f.code, f.message)
    }
  }

  const { data: before } = await supabase.from('orders').select('status, paid_payment_id').eq('id', id).maybeSingle()
  if (!before) return jsonError(404, 'not_found', 'Order not found.')

  const { data: order, error } = await supabase.rpc('transition_order', {
    p_order_id: id,
    p_to: input.to,
    p_note: input.note ?? null,
    p_prep_minutes: input.prepMinutes ?? null,
  })
  if (error || !order) {
    const f = friendlyDbError(error?.message)
    return jsonError(f.status, f.code, f.message)
  }

  let updated = order as OrderRow
  const changed = before.status !== updated.status
  let refund: Awaited<ReturnType<typeof issueRefund>> | null = null

  // Rejected or cancelled after payment => automatic full refund.
  if (changed && (updated.status === 'rejected' || updated.status === 'cancelled') && updated.paid_payment_id) {
    refund = await issueRefund({
      orderId: updated.id,
      amountPesewas: null,
      reason:
        updated.status === 'rejected'
          ? `Order rejected: ${input.note ?? 'restaurant unavailable'}`
          : `Order cancelled: ${input.note ?? 'cancelled by restaurant'}`,
      requestedBy: auth.staff.userId,
      requestedRole: auth.staff.role,
      automatic: true,
    })
    if (!refund.ok) {
      Sentry.captureMessage(`Automatic refund failed for order ${updated.order_number}: ${refund.error}`, 'error')
    }
    const { data: fresh } = await getAdminSupabase().from('orders').select('*').eq('id', id).single()
    if (fresh) updated = fresh as OrderRow
  }

  if (changed) {
    // Notify about the step staff just took (an automatic refund may already have moved it on to "refunded").
    const snapshot = { ...updated, status: input.to } as OrderRow
    after(() => notifyStatusChange(snapshot, { reason: input.note ?? null, refundPesewas: refund?.ok ? refund.amountPesewas : 0 }))
  }

  return jsonOk({ order: updated, refund })
}
