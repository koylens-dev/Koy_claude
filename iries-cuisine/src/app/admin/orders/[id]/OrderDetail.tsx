'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { OrderCard } from '@/components/staff/OrderCard'
import { useStaffAction } from '@/components/staff/useStaffAction'
import { useAdmin } from '@/components/admin/AdminShell'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatCedis } from '@/lib/money'
import { formatDateTime } from '@/lib/time'
import { STAFF_LABEL } from '@/lib/order-status'
import type { OrderStatus, OrderWithItems } from '@/lib/types'

type Event = { id: number; from_status: OrderStatus | null; to_status: OrderStatus; actor_role: string; note: string | null; created_at: string }
type Payment = { id: string; reference: string; status: string; channel: string | null; amount_pesewas: number; fees_pesewas: number | null; gateway_response: string | null; created_at: string; paid_at: string | null }
type Refund = { id: string; amount_pesewas: number; reason: string; status: string; is_automatic: boolean; requested_role: string; error: string | null; created_at: string; payment_id: string }
type Notification = { id: number; kind: string; status: string; recipient: string; created_at: string; error: string | null }

export function OrderDetail({ id }: { id: string }) {
  const { role } = useAdmin()
  const toast = useToast()
  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [notes, setNotes] = useState<Notification[]>([])
  const [retrying, setRetrying] = useState<string | null>(null)

  const load = useCallback(() => {
    const supabase = getBrowserSupabase()
    return Promise.all([
      supabase.from('orders').select('*, order_items(*)').eq('id', id).single(),
      supabase.from('order_events').select('*').eq('order_id', id).order('created_at'),
      supabase.from('payments').select('id, reference, status, channel, amount_pesewas, fees_pesewas, gateway_response, created_at, paid_at').eq('order_id', id).order('created_at'),
      supabase.from('refunds').select('*').eq('order_id', id).order('created_at'),
      supabase.from('notifications').select('id, kind, status, recipient, created_at, error').eq('order_id', id).order('created_at'),
    ]).then(([o, e, p, r, n]) => {
      setOrder(o.data as OrderWithItems)
      setEvents((e.data ?? []) as Event[])
      setPayments((p.data ?? []) as Payment[])
      setRefunds((r.data ?? []) as Refund[])
      setNotes((n.data ?? []) as Notification[])
    })
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const action = useStaffAction(() => load())

  async function retryRefund(r: Refund) {
    setRetrying(r.id)
    const res = await fetch(`/api/staff/orders/${id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountPesewas: r.amount_pesewas, paymentId: r.payment_id, reason: `${r.reason} (retry)` }),
    }).catch(() => null)
    setRetrying(null)
    const json = await res?.json().catch(() => null)
    toast(res?.ok ? 'Refund re-sent to Paystack.' : (json?.error?.message ?? 'Retry failed.'), res?.ok ? 'success' : 'error')
    load()
  }

  if (!order) return <Skeleton className="h-96" />

  return (
    <div className="max-w-5xl">
      <Link href="/admin/orders" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
        <ArrowLeft className="size-4" aria-hidden /> All orders
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <OrderCard order={order} role={role} action={action} onRefunded={load} defaultPrep={order.prep_minutes ?? 25} />
        <div className="space-y-6">
          <section className="rounded-2xl bg-surface p-4 ring-1 ring-line">
            <h2 className="font-sans text-base font-semibold">Timeline</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="w-36 shrink-0 tabular-nums text-muted">{formatDateTime(e.created_at)}</span>
                  <span>
                    <strong>{STAFF_LABEL[e.to_status]}</strong> <span className="text-muted">by {e.actor_role}</span>
                    {e.note && <span className="block text-xs text-muted">{e.note}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-2xl bg-surface p-4 ring-1 ring-line">
            <h2 className="font-sans text-base font-semibold">Payment attempts</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {payments.length === 0 && <li className="text-muted">None yet.</li>}
              {payments.map((p) => (
                <li key={p.id} className="rounded-xl bg-cream p-2.5">
                  <span className="font-mono text-xs">{p.reference}</span> · <strong>{p.status}</strong> · {formatCedis(p.amount_pesewas)}
                  {p.channel && ` · ${p.channel}`}
                  {p.fees_pesewas != null && <span className="text-muted"> · fee {formatCedis(p.fees_pesewas)}</span>}
                  <span className="block text-xs text-muted">{formatDateTime(p.created_at)}{p.gateway_response && ` · ${p.gateway_response}`}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl bg-surface p-4 ring-1 ring-line">
            <h2 className="font-sans text-base font-semibold">Refunds</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {refunds.length === 0 && <li className="text-muted">None.</li>}
              {refunds.map((r) => (
                <li key={r.id} className={`rounded-xl p-2.5 ${r.status === 'failed' ? 'bg-red-50' : 'bg-cream'}`}>
                  <strong>{formatCedis(r.amount_pesewas)}</strong> · {r.status} · {r.is_automatic ? 'automatic' : `by ${r.requested_role}`}
                  <span className="block text-xs text-muted">{formatDateTime(r.created_at)} · {r.reason}</span>
                  {r.error && <span className="block text-xs text-red-800">{r.error}</span>}
                  {r.status === 'failed' && (
                    <Button size="sm" variant="secondary" className="mt-2" loading={retrying === r.id} onClick={() => retryRefund(r)}>
                      <RotateCcw className="size-3.5" aria-hidden /> Retry refund
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl bg-surface p-4 ring-1 ring-line">
            <h2 className="font-sans text-base font-semibold">SMS sent</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {notes.length === 0 && <li className="text-muted">None.</li>}
              {notes.map((n) => (
                <li key={n.id}>
                  {formatDateTime(n.created_at)} · {n.kind} · <strong>{n.status}</strong>
                  {n.error && <span className="text-xs text-red-800"> · {n.error}</span>}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
