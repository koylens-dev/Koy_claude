import type { NextRequest } from 'next/server'
import { after } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { FRONT_OF_HOUSE, requireStaff } from '@/lib/server/auth'
import { friendlyDbError, jsonError, jsonOk } from '@/lib/server/http'
import { notifyStatusChange } from '@/lib/server/notify'
import type { OrderRow } from '@/lib/types'

// POST /api/staff/orders/:id/demo-pay — training only: pretend the customer paid a
// DEMO order. Goes through the real payment confirmation, so the alarm rings and the
// order moves to "New — paid" exactly as in real life. Refuses real orders.
export async function POST(_req: NextRequest, ctx: RouteContext<'/api/staff/orders/[id]/demo-pay'>) {
  const auth = await requireStaff(FRONT_OF_HOUSE)
  if ('response' in auth) return auth.response
  const { id } = await ctx.params
  const admin = getAdminSupabase()

  const { data, error } = await admin.rpc('demo_pay', { p_order_id: id })
  if (error) {
    if (error.message.startsWith('not_a_demo_order')) return jsonError(403, 'not_demo', 'Only demo orders can be paid this way.')
    const f = friendlyDbError(error.message)
    return jsonError(f.status, f.code, f.message)
  }
  const { data: order } = await admin.from('orders').select('*').eq('id', id).single()
  if (order) after(() => notifyStatusChange(order as OrderRow)) // logged as "skipped" for demo orders
  return jsonOk({ result: (data as { result: string }).result, order })
}
