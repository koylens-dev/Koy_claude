import type { NextRequest } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { getServerSupabase } from '@/lib/supabase/server'
import { MANAGER_ROLES, requireStaff } from '@/lib/server/auth'
import { jsonError } from '@/lib/server/http'
import { toCsv } from '@/lib/csv'
import { pesewasToDecimalString as d } from '@/lib/money'
import { formatDateTime, zonedToUtc } from '@/lib/time'

export const maxDuration = 60

// GET /api/admin/export?type=orders|items|payments|customers&from=YYYY-MM-DD&to=YYYY-MM-DD
// CSV (opens in Excel / Google Sheets). Column names are stable so the files can be
// imported into an accounting system (e.g. Odoo) later.
export async function GET(req: NextRequest) {
  const auth = await requireStaff(MANAGER_ROLES)
  if ('response' in auth) return auth.response

  const sp = req.nextUrl.searchParams
  const type = sp.get('type') ?? 'orders'
  const from = sp.get('from')
  const to = sp.get('to')
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (type !== 'customers' && (!from || !to || !dateRe.test(from) || !dateRe.test(to))) {
    return jsonError(400, 'invalid_range', 'Choose a date range.')
  }
  const fromIso = from ? zonedToUtc(from, 0).toISOString() : ''
  const toIso = to ? new Date(zonedToUtc(to, 0).getTime() + 86400000).toISOString() : ''
  const admin = getAdminSupabase()
  let csv = ''

  if (type === 'orders') {
    const { data, error } = await admin
      .from('orders')
      .select('*, payments!orders_paid_payment_fk(reference, channel, fees_pesewas)')
      .gte('created_at', fromIso)
      .lt('created_at', toIso)
      .order('created_at')
      .limit(50000)
    if (error) return jsonError(500, 'export_failed', error.message)
    csv = toCsv(
      [
        'order_number', 'created_at', 'paid_at', 'status', 'channel', 'fulfilment', 'zone', 'customer_name', 'customer_phone',
        'subtotal_ghs', 'delivery_fee_ghs', 'discount_ghs', 'total_ghs', 'refunded_ghs', 'net_ghs',
        'payment_method', 'payment_reference', 'gateway_fee_ghs', 'expected_settlement_ghs',
        'accepted_at', 'ready_at', 'delivered_at', 'cancel_or_reject_reason',
      ],
      (data ?? []).map((o) => {
        const p = o.payments as { reference: string; channel: string | null; fees_pesewas: number | null } | null
        const paid = !!o.paid_at
        return [
          o.order_number, formatDateTime(o.created_at), o.paid_at ? formatDateTime(o.paid_at) : '', o.status, o.channel,
          o.fulfilment, o.zone_name ?? '', o.customer_name, o.customer_phone,
          d(o.subtotal_pesewas), d(o.delivery_fee_pesewas), d(o.discount_pesewas), d(o.total_pesewas), d(o.refunded_pesewas),
          paid ? d(o.total_pesewas - o.refunded_pesewas) : '0.00',
          p?.channel ?? '', p?.reference ?? '', p?.fees_pesewas != null ? d(p.fees_pesewas) : '',
          paid && p?.fees_pesewas != null ? d(o.total_pesewas - p.fees_pesewas) : '',
          o.accepted_at ? formatDateTime(o.accepted_at) : '', o.ready_at ? formatDateTime(o.ready_at) : '',
          o.delivered_at ? formatDateTime(o.delivered_at) : '', o.reject_reason ?? o.cancel_reason ?? '',
        ]
      }),
    )
  } else if (type === 'items') {
    const { data, error } = await admin
      .from('order_items')
      .select('*, orders!inner(order_number, paid_at, status)')
      .gte('orders.paid_at', fromIso)
      .lt('orders.paid_at', toIso)
      .limit(100000)
    if (error) return jsonError(500, 'export_failed', error.message)
    csv = toCsv(
      ['order_number', 'paid_at', 'order_status', 'item', 'portion', 'extras', 'quantity', 'unit_price_ghs', 'line_total_ghs', 'notes'],
      (data ?? []).map((i) => {
        const o = i.orders as { order_number: number; paid_at: string; status: string }
        const extras = (i.modifiers as { option: string }[]).map((m) => m.option).join('; ')
        return [o.order_number, formatDateTime(o.paid_at), o.status, i.item_name, i.portion_name ?? '', extras, i.quantity, d(i.unit_price_pesewas), d(i.line_total_pesewas), i.notes ?? '']
      }),
    )
  } else if (type === 'payments') {
    const { data, error } = await admin
      .from('payments')
      .select('*, orders!payments_order_id_fkey(order_number)')
      .gte('created_at', fromIso)
      .lt('created_at', toIso)
      .order('created_at')
      .limit(100000)
    if (error) return jsonError(500, 'export_failed', error.message)
    csv = toCsv(
      ['reference', 'order_number', 'status', 'method', 'amount_ghs', 'gateway_fee_ghs', 'net_ghs', 'paid_at', 'created_at', 'gateway_message'],
      (data ?? []).map((p) => [
        p.reference, (p.orders as { order_number: number } | null)?.order_number ?? '', p.status, p.channel ?? '',
        d(p.amount_pesewas), p.fees_pesewas != null ? d(p.fees_pesewas) : '', p.fees_pesewas != null ? d(p.amount_pesewas - p.fees_pesewas) : '',
        p.paid_at ? formatDateTime(p.paid_at) : '', formatDateTime(p.created_at), p.gateway_response ?? '',
      ]),
    )
  } else if (type === 'customers') {
    // customer_list() checks the manager role itself, so call it as the signed-in user.
    const supabase = await getServerSupabase()
    const { data, error } = await supabase.rpc('customer_list')
    if (error) return jsonError(500, 'export_failed', error.message)
    csv = toCsv(
      ['phone', 'name', 'email', 'marketing_consent', 'consent_given_at', 'orders', 'total_spent_ghs', 'first_order_at', 'last_order_at'],
      ((data ?? []) as Record<string, unknown>[]).map((c) => [
        c.phone as string, (c.full_name as string) ?? '', (c.email as string) ?? '', c.marketing_consent ? 'yes' : 'no',
        c.marketing_consent_at ? formatDateTime(c.marketing_consent_at as string) : '', c.orders_count as number,
        d(Number(c.total_spent_pesewas)), c.first_order_at ? formatDateTime(c.first_order_at as string) : '',
        c.last_order_at ? formatDateTime(c.last_order_at as string) : '',
      ]),
    )
  } else {
    return jsonError(400, 'invalid_type', 'Unknown export type.')
  }

  const filename = `iries-${type}${from ? `-${from}_to_${to}` : ''}.csv`
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
