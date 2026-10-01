import type { NextRequest } from 'next/server'
import { after } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { MANAGER_ROLES, requireStaff } from '@/lib/server/auth'
import { friendlyDbError, jsonError, jsonOk } from '@/lib/server/http'
import { firstZodMessage, refundSchema } from '@/lib/validation'
import { issueRefund, notifyPartialRefund } from '@/lib/server/payments'
import type { OrderRow } from '@/lib/types'

// POST /api/staff/orders/:id/refund { amountPesewas?, reason } — managers and owner only.
// Omit amountPesewas for a full refund of whatever is still refundable.
export async function POST(req: NextRequest, ctx: RouteContext<'/api/staff/orders/[id]/refund'>) {
  const auth = await requireStaff(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const { id } = await ctx.params

  const parsed = refundSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return jsonError(400, 'invalid_input', firstZodMessage(parsed.error))

  const result = await issueRefund({
    orderId: id,
    paymentId: parsed.data.paymentId ?? null,
    amountPesewas: parsed.data.amountPesewas ?? null,
    reason: parsed.data.reason,
    requestedBy: auth.staff.userId,
    requestedRole: auth.staff.role,
    automatic: false,
  })
  if (!result.ok && !result.refundId) {
    const f = friendlyDbError(result.error)
    return jsonError(f.status, f.code, f.message)
  }
  if (!result.ok) {
    return jsonError(502, 'gateway_refund_failed', `Paystack did not accept the refund: ${result.error}. Nothing was refunded — try again or refund from the Paystack dashboard.`)
  }

  const { data: order } = await getAdminSupabase().from('orders').select('*').eq('id', id).single()
  if (order && !result.orderRefunded && parsed.data.amountPesewas) {
    after(() => notifyPartialRefund(order as OrderRow, result.refundId!, parsed.data.amountPesewas!))
  }
  return jsonOk({ refund: result, order })
}
