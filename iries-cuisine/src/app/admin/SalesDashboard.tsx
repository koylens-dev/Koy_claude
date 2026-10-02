'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Download, FlaskConical } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { BarList, ColumnChart, StatTile } from '@/components/admin/charts'
import { PageTitle } from '@/components/admin/AdminShell'
import { Input } from '@/components/ui/Field'
import { formatCedis } from '@/lib/money'
import { accraDateKey } from '@/lib/time'
import { cn } from '@/lib/cn'

type Summary = {
  totals: {
    orders: number
    gross_pesewas: number
    food_pesewas: number
    delivery_fees_pesewas: number
    discounts_pesewas: number
    refunds_pesewas: number
    refund_count: number
    net_pesewas: number
    aov_pesewas: number
    rejected: number
    cancelled_after_payment: number
    fully_refunded: number
    customers: number
    repeat_customers: number
  }
  timings: { avg_accept_minutes: number | null; avg_prep_minutes: number | null; avg_delivery_minutes: number | null; avg_total_minutes: number | null }
  by_day: { day: string; orders: number; gross_pesewas: number }[]
  by_hour: { hour: number; orders: number; gross_pesewas: number }[]
  by_payment_method: { channel: string; orders: number; gross_pesewas: number }[]
  by_zone: { zone: string; orders: number; gross_pesewas: number }[]
  by_channel: { channel: string; orders: number; gross_pesewas: number }[]
  top_items: { name: string; quantity: number; revenue_pesewas: number }[]
  bottom_items: { name: string; quantity: number; revenue_pesewas: number }[]
}

const METHOD: Record<string, string> = { mobile_money: 'Mobile Money', card: 'Card', bank: 'Bank', bank_transfer: 'Bank transfer', unknown: 'Unknown' }
const CHANNEL: Record<string, string> = { web: 'Website / app', phone: 'Phone', whatsapp: 'WhatsApp', walk_in: 'Walk-in' }

function shift(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function presets(today: string) {
  const monthStart = `${today.slice(0, 8)}01`
  const lastMonthEnd = shift(monthStart, -1)
  return [
    { id: 'today', label: 'Today', from: today, to: today },
    { id: 'yesterday', label: 'Yesterday', from: shift(today, -1), to: shift(today, -1) },
    { id: '7d', label: 'Last 7 days', from: shift(today, -6), to: today },
    { id: '30d', label: 'Last 30 days', from: shift(today, -29), to: today },
    { id: 'month', label: 'This month', from: monthStart, to: today },
    { id: 'lastmonth', label: 'Last month', from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd },
  ]
}

const cedisShort = (p: number) => {
  const c = p / 100
  return c >= 1000 ? `₵${(c / 1000).toFixed(c >= 10000 ? 0 : 1)}k` : `₵${Math.round(c)}`
}
const mins = (m: number | null) => (m == null ? '—' : `${Math.round(m)} min`)
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')

export function SalesDashboard() {
  const today = accraDateKey()
  const options = useMemo(() => presets(today), [today])
  const [range, setRange] = useState({ id: '7d', from: options[2].from, to: options[2].to })
  const [data, setData] = useState<Summary | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<{ failedRefunds: number; mismatches: number; demoOrders: number }>({ failedRefunds: 0, mismatches: 0, demoOrders: 0 })

  const key = `${range.from}|${range.to}`
  const loading = loadedKey !== key

  useEffect(() => {
    let current = true
    getBrowserSupabase()
      .rpc('sales_summary', { p_from: range.from, p_to: range.to })
      .then(({ data, error }) => {
        if (!current) return
        setError(error ? 'Could not load the report. Check your connection.' : null)
        if (!error) setData(data as Summary)
        setLoadedKey(`${range.from}|${range.to}`)
      })
    return () => {
      current = false
    }
  }, [range.from, range.to])

  useEffect(() => {
    const supabase = getBrowserSupabase()
    Promise.all([
      supabase.from('refunds').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'amount_mismatch'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('is_demo', true),
    ]).then(([r, p, d]) => setAlerts({ failedRefunds: r.count ?? 0, mismatches: p.count ?? 0, demoOrders: d.count ?? 0 }))
  }, [])

  const t = data?.totals
  const byDay = (data?.by_day ?? []).map((d) => ({
    key: d.day,
    label: new Date(`${d.day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    value: d.gross_pesewas,
  }))
  const byHour = Array.from({ length: 24 }, (_, h) => {
    const row = data?.by_hour.find((x) => x.hour === h)
    return { key: String(h), label: `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`, value: row?.orders ?? 0 }
  }).filter((_, h) => h >= 8 && h <= 23)
  const exportHref = (type: string) => `/api/admin/export?type=${type}&from=${range.from}&to=${range.to}`

  return (
    <div>
      <PageTitle title="Sales" description="Paid orders in Accra time. Refunds are subtracted in “Net sales”." />

      {(alerts.failedRefunds > 0 || alerts.mismatches > 0) && (
        <Link href="/admin/orders?filter=attention" className="mb-4 flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-900 ring-1 ring-red-200">
          <AlertTriangle className="size-5" aria-hidden />
          Needs attention: {alerts.failedRefunds} failed refund(s), {alerts.mismatches} payment amount mismatch(es).
        </Link>
      )}

      {alerts.demoOrders > 0 && (
        <Link href="/admin/settings#demo-heading" className="mb-4 flex items-center gap-2 rounded-2xl bg-fuchsia-50 p-4 text-sm text-fuchsia-950 ring-1 ring-fuchsia-200">
          <FlaskConical className="size-5 shrink-0" aria-hidden />
          <span>
            <strong>Demo data:</strong> these figures include {alerts.demoOrders.toLocaleString('en-GH')} sample orders. Remove them in
            Hours &amp; settings before go-live.
          </span>
        </Link>
      )}

      {/* Filters: one row, date range first */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setRange({ id: o.id, from: o.from, to: o.to })}
            className={cn('min-h-10 rounded-full px-4 text-sm font-semibold ring-1', range.id === o.id ? 'bg-ink text-white ring-ink' : 'bg-surface ring-line hover:bg-black/5')}
          >
            {o.label}
          </button>
        ))}
        <span className="ml-2 inline-flex items-center gap-1 text-sm">
          <Input type="date" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ id: 'custom', from: e.target.value, to: r.to }))} className="min-h-10 w-40 py-1.5" aria-label="From" />
          –
          <Input type="date" value={range.to} min={range.from} max={today} onChange={(e) => setRange((r) => ({ id: 'custom', from: r.from, to: e.target.value }))} className="min-h-10 w-40 py-1.5" aria-label="To" />
        </span>
      </div>

      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}

      <div className={cn('space-y-6 transition-opacity', loading && data && 'opacity-50')}>
        {!data ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <StatTile hero label="Net sales" value={formatCedis(t!.net_pesewas)} hint={`Gross ${formatCedis(t!.gross_pesewas)} − refunds ${formatCedis(t!.refunds_pesewas)}`} />
              </div>
              <StatTile label="Orders" value={t!.orders.toLocaleString('en-GH')} hint={`${t!.customers} customers`} />
              <StatTile label="Average order value" value={formatCedis(t!.aov_pesewas)} />
              <StatTile label="Delivery fees collected" value={formatCedis(t!.delivery_fees_pesewas)} />
              <StatTile label="Repeat customers" value={pct(t!.repeat_customers, t!.customers)} hint={`${t!.repeat_customers} of ${t!.customers} have ordered before`} />
              <StatTile label="Rejected / cancelled" value={pct(t!.rejected + t!.cancelled_after_payment, t!.orders)} hint={`${t!.rejected} rejected · ${t!.cancelled_after_payment} cancelled after payment`} />
              <StatTile label="Refunds" value={formatCedis(t!.refunds_pesewas)} hint={`${t!.refund_count} refund(s) · ${t!.fully_refunded} fully refunded orders`} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Avg time to accept" value={mins(data.timings.avg_accept_minutes)} />
              <StatTile label="Avg prep time" value={mins(data.timings.avg_prep_minutes)} />
              <StatTile label="Avg delivery ride" value={mins(data.timings.avg_delivery_minutes)} />
              <StatTile label="Avg paid → delivered" value={mins(data.timings.avg_total_minutes)} />
            </div>

            <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
              <h2 className="font-sans text-base font-semibold">Gross sales by day</h2>
              <ColumnChart className="mt-3" title="Gross sales by day" data={byDay} format={formatCedis} axisFormat={cedisShort} />
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
                <h2 className="font-sans text-base font-semibold">Orders by hour of day</h2>
                <ColumnChart className="mt-3" title="Orders by hour of day" data={byHour} format={(v) => `${v} orders`} axisFormat={(v) => String(v)} height={200} />
              </section>
              <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
                <h2 className="mb-4 font-sans text-base font-semibold">Sales by payment method</h2>
                <BarList rows={data.by_payment_method.map((r) => ({ label: METHOD[r.channel] ?? r.channel, value: r.gross_pesewas, sub: `${r.orders} orders` }))} format={formatCedis} />
                <h2 className="mb-4 mt-8 font-sans text-base font-semibold">Sales by order channel</h2>
                <BarList rows={data.by_channel.map((r) => ({ label: CHANNEL[r.channel] ?? r.channel, value: r.gross_pesewas, sub: `${r.orders} orders` }))} format={formatCedis} />
              </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
                <h2 className="mb-4 font-sans text-base font-semibold">Sales by delivery zone</h2>
                <BarList rows={data.by_zone.map((r) => ({ label: r.zone, value: r.gross_pesewas, sub: `${r.orders} orders` }))} format={formatCedis} />
              </section>
              <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
                <h2 className="font-sans text-base font-semibold">Top dishes</h2>
                <ItemTable rows={data.top_items} />
                <h2 className="mt-6 font-sans text-base font-semibold">Slowest sellers</h2>
                <ItemTable rows={data.bottom_items} />
              </section>
            </div>

            <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
              <h2 className="font-sans text-base font-semibold">Export (CSV for Excel, Google Sheets or your accountant)</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ['orders', 'Orders'],
                  ['items', 'Items sold'],
                  ['payments', 'Payments (for reconciliation)'],
                  ['customers', 'Customers & consent'],
                ].map(([type, label]) => (
                  <a key={type} href={exportHref(type)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold ring-1 ring-line hover:bg-black/5">
                    <Download className="size-4" aria-hidden /> {label}
                  </a>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function ItemTable({ rows }: { rows: { name: string; quantity: number; revenue_pesewas: number }[] }) {
  if (!rows.length) return <p className="mt-2 text-sm text-muted">No data.</p>
  return (
    <table className="mt-2 w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted">
          <th className="py-1 font-medium">Dish</th>
          <th className="py-1 text-right font-medium">Qty</th>
          <th className="py-1 text-right font-medium">Revenue</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} className="border-t border-line">
            <td className="py-1.5">{r.name}</td>
            <td className="py-1.5 text-right tabular-nums">{r.quantity}</td>
            <td className="py-1.5 text-right tabular-nums">{formatCedis(Number(r.revenue_pesewas))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
