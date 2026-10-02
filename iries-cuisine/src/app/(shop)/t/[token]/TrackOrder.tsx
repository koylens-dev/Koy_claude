'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, Loader2, Phone, Printer, RotateCcw, ChefHat, Bike, PackageCheck, XCircle, Wallet } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import type { TrackedOrder } from '@/lib/types'
import { customerLabel, isTerminal, progressSteps } from '@/lib/order-status'
import { formatCedis } from '@/lib/money'
import { formatDateTime, formatSlot, formatTime } from '@/lib/time'
import { formatGhanaPhone, whatsappLink } from '@/lib/phone'
import { publicEnv } from '@/lib/public-env'
import { buttonClasses } from '@/components/ui/Button'
import { useCart } from '@/components/customer/CartProvider'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'

const PAYMENT_METHOD: Record<string, string> = {
  mobile_money: 'Mobile Money',
  card: 'Card',
  bank: 'Bank',
  bank_transfer: 'Bank transfer',
  apple_pay: 'Apple Pay',
}

export function TrackOrder({ token, initial, reference, error }: { token: string; initial: TrackedOrder; reference: string | null; error: string | null }) {
  const [order, setOrder] = useState(initial)
  const [verifying, setVerifying] = useState(!!reference && initial.status === 'awaiting_payment')
  const returnedAt = useRef(0)
  useEffect(() => {
    returnedAt.current = Date.now()
  }, [])
  const cart = useCart()
  const toast = useToast()
  const router = useRouter()

  const refresh = useCallback(async () => {
    const { data } = await getBrowserSupabase().rpc('track_order', { p_token: token })
    if (data) setOrder(data as TrackedOrder)
  }, [token])

  // Back from Paystack: ask our server to verify with Paystack right away.
  useEffect(() => {
    if (!reference || initial.status !== 'awaiting_payment') return
    fetch('/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference, token }),
    })
      .catch(() => null)
      .finally(async () => {
        await refresh()
        setVerifying(false)
      })
  }, [reference, token, initial.status, refresh])

  // Poll: quickly while waiting for MoMo approval, calmly while cooking, stop when finished.
  useEffect(() => {
    if (isTerminal(order.status)) return
    const fast = order.status === 'awaiting_payment' && Date.now() - returnedAt.current < 5 * 60_000
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, fast ? 4000 : 15000)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', refresh)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', refresh)
    }
  }, [order.status, refresh])

  const reorder = () => {
    const lines = order.items
      .filter((i) => i.menu_item_id && i.portion_id)
      .map((i) => ({
        itemId: i.menu_item_id!,
        slug: '',
        name: i.item_name,
        imagePath: null,
        portionId: i.portion_id!,
        portionName: i.portion_name ?? '',
        portionPrice: i.unit_price_pesewas - i.modifiers.reduce((s, m) => s + m.price_pesewas, 0),
        options: i.modifiers.filter((m) => m.option_id).map((m) => ({ id: m.option_id!, groupName: m.group, name: m.option, price: m.price_pesewas })),
        quantity: i.quantity,
        notes: i.notes ?? '',
      }))
    cart.replace(lines)
    toast('Added to your order — prices are re-checked at checkout.', 'success')
    router.push('/cart')
  }

  const delivery = order.fulfilment === 'delivery'
  const steps = progressSteps(order.fulfilment)
  const reachedIndex = steps.findIndex((s) => s.status === order.status)
  const doneAt = (key: string) => (order as unknown as Record<string, string | null>)[key]
  const failed = ['rejected', 'cancelled', 'refunded'].includes(order.status)
  const eta = order.estimated_ready_at
    ? delivery
      ? new Date(new Date(order.estimated_ready_at).getTime() + (order.zone_eta_minutes ?? 30) * 60000)
      : new Date(order.estimated_ready_at)
    : null
  const support = publicEnv.whatsappNumber

  return (
    <div className="mx-auto max-w-2xl pt-8">
      <p className="text-sm font-semibold uppercase tracking-wider text-muted">Order #{order.order_number}</p>
      <h1 className="mt-1 font-display text-4xl font-semibold leading-tight">{customerLabel(order.status, order.fulfilment)}</h1>

      {/* Status card */}
      <section className={cn('mt-5 rounded-3xl p-5 ring-1', failed ? 'bg-stone-100 ring-stone-300' : 'bg-surface ring-line')} aria-live="polite">
        {order.status === 'awaiting_payment' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              {verifying ? <Loader2 className="mt-0.5 size-6 animate-spin text-brand" aria-hidden /> : <Wallet className="mt-0.5 size-6 text-brand" aria-hidden />}
              <div>
                <p className="font-semibold">{verifying ? 'Confirming your payment…' : 'Waiting for payment confirmation'}</p>
                <p className="mt-1 text-sm text-muted">
                  Paying with MoMo? Approve the prompt on your phone (or dial your network’s approval code). This page updates by itself.
                </p>
              </div>
            </div>
            {error === 'gateway_unavailable' && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">The payment service was busy. Please tap “Pay now” again.</p>}
            {error === 'rate_limited' && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Too many payment attempts. Please wait a few minutes.</p>}
            {error === 'demo' && <p className="rounded-xl bg-violet-50 p-3 text-sm text-violet-950">This is a demo order used for training — it can’t be paid. Staff can use “Simulate payment” on the attendant screen.</p>}
            <a href={`/pay/${token}`} className={buttonClasses({ size: 'lg', block: true })}>
              Pay now · {formatCedis(order.total_pesewas)}
            </a>
            <p className="text-xs text-muted">Unpaid orders are cancelled automatically after a while. You are never charged twice — a duplicate payment is refunded automatically.</p>
          </div>
        )}

        {!failed && order.status !== 'awaiting_payment' && (
          <>
            {eta && !isTerminal(order.status) && order.status !== 'delivered' && (
              <p className="mb-4 rounded-2xl bg-brand-soft/60 p-4 text-center">
                <span className="block text-xs font-bold uppercase tracking-wide text-muted">{delivery ? 'Estimated arrival' : 'Ready for pickup around'}</span>
                <span className="font-display text-4xl font-semibold">{order.scheduled_for ? formatSlot(order.scheduled_for) : formatTime(eta)}</span>
              </p>
            )}
            {order.status === 'paid' && (
              <p className="mb-4 flex items-center gap-2 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden /> The restaurant is confirming your order — usually within a few minutes.
              </p>
            )}
            <ol className="space-y-3">
              {steps.map((s, i) => {
                const at = doneAt(s.at)
                const done = !!at || i <= reachedIndex || order.status === 'completed'
                const Icon = s.status === 'in_kitchen' ? ChefHat : s.status === 'out_for_delivery' ? Bike : s.status === 'delivered' ? PackageCheck : null
                return (
                  <li key={s.status} className="flex items-center gap-3">
                    {done ? <CheckCircle2 className="size-6 shrink-0 text-success" aria-hidden /> : <Circle className="size-6 shrink-0 text-line" aria-hidden />}
                    <span className={cn('flex-1', done ? 'font-semibold' : 'text-muted')}>
                      {s.label}
                      {Icon && !done && i === reachedIndex + 1 && <Icon className="ml-2 inline size-4 text-brand" aria-hidden />}
                    </span>
                    {at && <span className="text-sm tabular-nums text-muted">{formatTime(at)}</span>}
                  </li>
                )
              })}
            </ol>
            {order.status === 'out_for_delivery' && (order.rider_name || order.delivery_code) && (
              <div className="mt-4 rounded-2xl bg-sky-50 p-4 text-sm text-sky-950">
                {order.rider_name && (
                  <p>
                    Your rider: <strong>{order.rider_name}</strong>
                    {order.rider_phone && (
                      <a href={`tel:${order.rider_phone}`} className="ml-2 inline-flex items-center gap-1 font-semibold underline">
                        <Phone className="size-3.5" aria-hidden /> {formatGhanaPhone(order.rider_phone)}
                      </a>
                    )}
                  </p>
                )}
                {order.delivery_code && (
                  <p className="mt-1">
                    Delivery code: <strong className="text-lg tracking-widest">{order.delivery_code}</strong> — share it with the rider when you receive your food.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {failed && (
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 size-6 shrink-0 text-stone-600" aria-hidden />
            <div className="text-sm">
              {order.reject_reason && <p>Reason: {order.reject_reason}</p>}
              {order.cancel_reason && order.cancel_reason !== 'payment_timeout' && <p>Reason: {order.cancel_reason}</p>}
              {order.cancel_reason === 'payment_timeout' && <p>This order was cancelled because payment wasn’t completed. You have not been charged.</p>}
              {order.refunds.length > 0 && (
                <p className="mt-2">
                  Refund of <strong>{formatCedis(order.refunds.reduce((s, r) => s + r.amount_pesewas, 0))}</strong>{' '}
                  {order.refunds.every((r) => r.status === 'processed') ? 'completed.' : 'started. Card refunds can take 5–10 working days; MoMo refunds are usually faster.'}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Receipt */}
      <section className="mt-6 rounded-3xl bg-surface p-5 ring-1 ring-line" aria-labelledby="receipt-title">
        <div className="flex items-center justify-between">
          <h2 id="receipt-title" className="font-display text-2xl font-semibold">Receipt</h2>
          <button type="button" onClick={() => window.print()} className="no-print inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold hover:bg-black/5">
            <Printer className="size-4" aria-hidden /> Print / save PDF
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">
          Irie’s Cuisine · Adenta, Accra · {formatDateTime(order.created_at)}
          <br />
          {order.customer_name} · {order.customer_phone_masked}
          {delivery ? ` · Delivery to ${order.zone_name ?? ''}${order.address_landmark ? ` (${order.address_landmark})` : ''}` : ' · Pickup'}
          {order.scheduled_for && ` · Scheduled ${formatSlot(order.scheduled_for)}`}
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-3">
              <span>
                {i.quantity}× {i.item_name}
                <span className="block text-xs text-muted">
                  {[i.portion_name, ...i.modifiers.map((m) => m.option)].filter(Boolean).join(' · ')}
                  {i.notes && ` · “${i.notes}”`}
                </span>
              </span>
              <span className="shrink-0">{formatCedis(i.line_total_pesewas)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><dt>Food</dt><dd>{formatCedis(order.subtotal_pesewas)}</dd></div>
          {delivery && <div className="flex justify-between"><dt>Delivery</dt><dd>{formatCedis(order.delivery_fee_pesewas)}</dd></div>}
          {order.discount_pesewas > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{formatCedis(order.discount_pesewas)}</dd></div>}
          <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{formatCedis(order.total_pesewas)}</dd></div>
          {order.refunded_pesewas > 0 && <div className="flex justify-between text-violet-900"><dt>Refunded</dt><dd>−{formatCedis(order.refunded_pesewas)}</dd></div>}
        </dl>
        {order.payment && order.payment.status === 'success' && (
          <p className="mt-3 text-xs text-muted">
            Paid by {PAYMENT_METHOD[order.payment.channel ?? ''] ?? order.payment.channel ?? 'Paystack'} · Ref {order.payment.reference}
            {order.payment.paid_at && ` · ${formatDateTime(order.payment.paid_at)}`}
          </p>
        )}
      </section>

      <div className="no-print mt-6 grid gap-3 sm:grid-cols-2">
        {support && (
          <a href={whatsappLink(support, `Hello Irie's Cuisine, about my order #${order.order_number}: `)} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
            WhatsApp us about this order
          </a>
        )}
        {(isTerminal(order.status) || order.status === 'delivered') && (
          <button type="button" onClick={reorder} className={buttonClasses({ size: 'lg' })}>
            <RotateCcw className="size-4" aria-hidden /> Order this again
          </button>
        )}
        <Link href="/" className={buttonClasses({ variant: 'ghost', size: 'lg' })}>
          Back to menu
        </Link>
      </div>
    </div>
  )
}
