'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { PageTitle } from '@/components/admin/AdminShell'
import { Input } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatCedis } from '@/lib/money'
import { formatDateTime } from '@/lib/time'
import { formatGhanaPhone } from '@/lib/phone'

type Customer = { phone: string; full_name: string | null; email: string | null; marketing_consent: boolean; orders_count: number; total_spent_pesewas: number; last_order_at: string }

export function CustomersAdmin() {
  const [rows, setRows] = useState<Customer[] | null>(null)
  const [q, setQ] = useState('')
  const [consentOnly, setConsentOnly] = useState(false)

  useEffect(() => {
    getBrowserSupabase().rpc('customer_list').then(({ data }) => setRows((data ?? []) as Customer[]))
  }, [])

  const filtered = useMemo(
    () =>
      (rows ?? []).filter(
        (c) => (!consentOnly || c.marketing_consent) && (!q || `${c.full_name ?? ''} ${c.phone}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [rows, q, consentOnly],
  )

  return (
    <div className="max-w-5xl">
      <PageTitle
        title="Customers"
        description="Only message customers with marketing consent about promotions (Data Protection Act, 2012). Order updates are always allowed."
        actions={
          <a href="/api/admin/export?type=customers" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold ring-1 ring-line hover:bg-black/5">
            <Download className="size-4" aria-hidden /> Export CSV
          </a>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone" className="max-w-xs" aria-label="Search customers" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={consentOnly} onChange={(e) => setConsentOnly(e.target.checked)} /> Marketing consent only
        </label>
        {rows && <span className="text-sm text-muted">{filtered.length} customers</span>}
      </div>
      {!rows ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 text-right font-medium">Orders</th>
                <th className="px-4 py-3 text-right font-medium">Spent (net)</th>
                <th className="px-4 py-3 font-medium">Last order</th>
                <th className="px-4 py-3 font-medium">Offers</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.phone} className="border-t border-line">
                  <td className="px-4 py-2.5">{c.full_name ?? '—'}<span className="block text-xs text-muted">{formatGhanaPhone(c.phone)}</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{c.orders_count}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCedis(Number(c.total_spent_pesewas))}</td>
                  <td className="px-4 py-2.5 text-muted">{formatDateTime(c.last_order_at)}</td>
                  <td className="px-4 py-2.5">{c.marketing_consent ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
