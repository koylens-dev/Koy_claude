'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { PageTitle } from '@/components/admin/AdminShell'
import { StatusPill } from '@/components/ui/StatusPill'
import { DemoBadge } from '@/components/staff/OrderCard'
import { Input, Select } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatCedis } from '@/lib/money'
import { formatDateTime } from '@/lib/time'
import { normalizeGhanaPhone } from '@/lib/phone'
import { STAFF_LABEL } from '@/lib/order-status'
import type { OrderRow, OrderStatus } from '@/lib/types'

export function OrdersTable() {
  const params = useSearchParams()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>(params.get('filter') === 'attention' ? 'attention' : '')
  const [rows, setRows] = useState<OrderRow[] | null>(null)

  const load = useCallback(async () => {
    const supabase = getBrowserSupabase()
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100)
    const term = q.trim().replace(/^#/, '')
    if (/^\d{3,7}$/.test(term)) query = query.eq('order_number', Number(term))
    else if (normalizeGhanaPhone(term)) query = query.eq('customer_phone', normalizeGhanaPhone(term)!)
    else if (term) query = query.ilike('customer_name', `%${term.replace(/[%_,()]/g, '')}%`)

    if (status === 'attention') {
      const [{ data: failed }, { data: mismatch }] = await Promise.all([
        supabase.from('refunds').select('order_id').eq('status', 'failed'),
        supabase.from('payments').select('order_id').eq('status', 'amount_mismatch'),
      ])
      const ids = [...new Set([...(failed ?? []), ...(mismatch ?? [])].map((r) => r.order_id as string))]
      query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
    } else if (status) query = query.eq('status', status)

    const { data } = await query
    setRows((data ?? []) as OrderRow[])
  }, [q, status])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div>
      <PageTitle title="Orders & refunds" description="Search any order. Open one to see its full timeline, payments and refunds, or to refund it." />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order number, phone or name" className="pl-9" aria-label="Search orders" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-56" aria-label="Status">
          <option value="">All statuses</option>
          <option value="attention">⚠ Needs attention</option>
          {(Object.keys(STAFF_LABEL) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>{STAFF_LABEL[s]}</option>
          ))}
        </Select>
      </div>
      {!rows ? (
        <Skeleton className="h-96" />
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-muted">No orders found.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Refunded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-t border-line hover:bg-cream">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand underline">#{o.order_number}</Link>
                    {o.is_demo && <DemoBadge className="ml-2" />}
                    <span className="block text-xs text-muted">{o.channel} · {o.fulfilment}</span>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{formatDateTime(o.created_at)}</td>
                  <td className="px-4 py-2.5">{o.customer_name}<span className="block text-xs text-muted">{o.customer_phone}</span></td>
                  <td className="px-4 py-2.5"><StatusPill status={o.status} /></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCedis(o.total_pesewas)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{o.refunded_pesewas ? formatCedis(o.refunded_pesewas) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
