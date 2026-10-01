'use client'

import { useState } from 'react'
import { Phone, MapPin, Printer, Clock, StickyNote, Copy, Send, Bike, Store } from 'lucide-react'
import type { OrderWithItems, StaffRole } from '@/lib/types'
import { StatusPill } from '@/components/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { formatCedis } from '@/lib/money'
import { formatGhanaPhone, normalizeGhanaPhone, whatsappLink } from '@/lib/phone'
import { mapsLink } from '@/lib/ghana-post'
import { formatSlot, formatTime, minutesBetween } from '@/lib/time'
import { canTransition, REJECT_REASONS } from '@/lib/order-status'
import { publicEnv } from '@/lib/public-env'
import { cn } from '@/lib/cn'
import type { useStaffAction } from './useStaffAction'

const PREP_CHOICES = [15, 20, 25, 30, 45, 60]
const CHANNEL_LABEL: Record<string, string> = { phone: 'Phone order', whatsapp: 'WhatsApp order', walk_in: 'Walk-in' }

export function OrderCard({
  order,
  role,
  action,
  onRefunded,
  defaultPrep,
}: {
  order: OrderWithItems
  role: StaffRole
  action: ReturnType<typeof useStaffAction>
  onRefunded: () => void
  defaultPrep: number
}) {
  const toast = useToast()
  const [dialog, setDialog] = useState<null | 'accept' | 'reject' | 'dispatch' | 'cancel' | 'refund'>(null)
  const [note, setNote] = useState('')
  const [prep, setPrep] = useState(defaultPrep)
  const [rider, setRider] = useState({ name: order.rider_name ?? '', phone: order.rider_phone ?? '' })
  const [refundAmount, setRefundAmount] = useState('')
  const [refundBusy, setRefundBusy] = useState(false)

  const can = (to: Parameters<typeof canTransition>[1]) => canTransition(order.status, to, role, order.fulfilment)
  const busy = (to: string) => action.busy === `${order.id}:${to}`
  const isNew = order.status === 'paid'
  const delivery = order.fulfilment === 'delivery'
  const map = mapsLink({ lat: order.address_lat, lng: order.address_lng, gps: order.address_gps, landmark: order.address_landmark })
  const manager = role === 'manager' || role === 'owner'
  const paidMinutes = order.paid_at ? minutesBetween(order.paid_at) : null
  const payLink = `${publicEnv.siteUrl}/pay/${order.public_token}`

  const riderMessage = [
    `Irie's order #${order.order_number}`,
    `Customer: ${order.customer_name} ${formatGhanaPhone(order.customer_phone)}`,
    `Area: ${order.zone_name ?? ''}`,
    order.address_landmark && `Landmark: ${order.address_landmark}`,
    order.address_gps && `GPS: ${order.address_gps}`,
    order.address_directions && `Directions: ${order.address_directions}`,
    map && `Map: ${map}`,
    `Delivery code: ${order.delivery_code}`,
  ]
    .filter(Boolean)
    .join('\n')

  async function refund(full: boolean) {
    const amount = full ? null : Math.round(Number(refundAmount) * 100)
    if (!full && (!amount || amount <= 0)) {
      toast('Enter an amount in cedis, e.g. 25 or 12.50', 'error')
      return
    }
    if (note.trim().length < 3) {
      toast('Please give a reason.', 'error')
      return
    }
    setRefundBusy(true)
    const res = await fetch(`/api/staff/orders/${order.id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountPesewas: amount, reason: note.trim() }),
    }).catch(() => null)
    setRefundBusy(false)
    const json = await res?.json().catch(() => null)
    if (!res?.ok) {
      toast(json?.error?.message ?? 'Refund failed.', 'error')
      return
    }
    toast('Refund sent to Paystack.', 'success')
    setDialog(null)
    setNote('')
    onRefunded()
  }

  return (
    <article
      className={cn(
        'flex flex-col rounded-2xl bg-surface ring-1 ring-line',
        isNew && 'alarm-pulse ring-2 ring-danger',
        order.status === 'awaiting_payment' && 'opacity-90',
      )}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <span className="font-display text-2xl font-bold">#{order.order_number}</span>
        <StatusPill status={order.status} />
        {order.channel !== 'web' && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-900">{CHANNEL_LABEL[order.channel]}</span>}
        <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-muted">
          {delivery ? <Bike className="size-4" aria-hidden /> : <Store className="size-4" aria-hidden />}
          {delivery ? 'Delivery' : 'Pickup'}
        </span>
      </header>

      <div className="flex-1 space-y-3 px-4 py-3 text-sm">
        {order.scheduled_for && (
          <p className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-2 py-1 font-semibold text-amber-950">
            <Clock className="size-4" aria-hidden /> Scheduled for {formatSlot(order.scheduled_for)}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-semibold">{order.customer_name}</p>
            <p className="text-muted">{formatGhanaPhone(order.customer_phone)}</p>
          </div>
          <div className="flex gap-1">
            <a href={`tel:${order.customer_phone}`} className="grid size-10 place-items-center rounded-xl ring-1 ring-line hover:bg-black/5" aria-label="Call customer">
              <Phone className="size-4" />
            </a>
            <a href={whatsappLink(order.customer_phone, `Hello ${order.customer_name.split(' ')[0]}, this is Irie's Cuisine about your order #${order.order_number}. `)} target="_blank" rel="noopener noreferrer" className="grid size-10 place-items-center rounded-xl bg-[#25D366] text-xs font-bold text-white" aria-label="WhatsApp customer">
              WA
            </a>
          </div>
        </div>

        {delivery && (
          <div className="rounded-xl bg-cream p-2.5">
            <p className="font-semibold">{order.zone_name}</p>
            {order.address_landmark && <p>{order.address_landmark}</p>}
            {order.address_gps && <p className="font-mono text-xs">{order.address_gps}</p>}
            {order.address_directions && <p className="text-muted">{order.address_directions}</p>}
            {map && (
              <a href={map} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand underline">
                <MapPin className="size-3.5" aria-hidden /> Open in Google Maps{order.address_lat ? ' (pinned)' : ''}
              </a>
            )}
          </div>
        )}

        <ul className="space-y-1.5">
          {order.order_items.map((i) => (
            <li key={i.id}>
              <span className="font-semibold">{i.quantity}×</span> {i.item_name}
              {i.portion_name && <span className="text-muted"> · {i.portion_name}</span>}
              {i.modifiers.length > 0 && <span className="block pl-5 text-xs text-muted">{i.modifiers.map((m) => m.option).join(', ')}</span>}
              {i.notes && <span className="block pl-5 text-xs font-semibold text-amber-800">“{i.notes}”</span>}
            </li>
          ))}
        </ul>
        {order.notes && (
          <p className="flex gap-1.5 rounded-lg bg-amber-100 p-2 text-amber-950">
            <StickyNote className="mt-0.5 size-4 shrink-0" aria-hidden /> {order.notes}
          </p>
        )}

        <div className="flex items-center justify-between border-t border-line pt-2 text-xs text-muted">
          <span>
            {order.paid_at ? `Paid ${formatTime(order.paid_at)}${paidMinutes !== null ? ` (${paidMinutes} min ago)` : ''}` : `Created ${formatTime(order.created_at)}`}
            {order.estimated_ready_at && order.status !== 'paid' && ` · ready ~${formatTime(order.estimated_ready_at)}`}
          </span>
          <span className="text-sm font-bold text-ink">{formatCedis(order.total_pesewas)}</span>
        </div>
        {order.refunded_pesewas > 0 && <p className="text-xs font-semibold text-violet-900">Refunded {formatCedis(order.refunded_pesewas)}</p>}
        {(order.reject_reason || (order.cancel_reason && order.cancel_reason !== 'payment_timeout')) && (
          <p className="text-xs text-muted">Reason: {order.reject_reason ?? order.cancel_reason}</p>
        )}
      </div>

      {/* Actions */}
      <footer className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
        {can('accepted') && (
          <Button variant="success" size="lg" className="flex-1" onClick={() => setDialog('accept')}>
            Accept
          </Button>
        )}
        {can('rejected') && (
          <Button variant="secondary" size="lg" onClick={() => setDialog('reject')}>
            Reject
          </Button>
        )}
        {can('in_kitchen') && order.status === 'accepted' && (
          <Button variant="secondary" loading={busy('in_kitchen')} onClick={() => action.change(order.id, 'in_kitchen')}>
            Start cooking
          </Button>
        )}
        {can('ready') && (
          <Button className="flex-1" loading={busy('ready')} onClick={() => action.change(order.id, 'ready')}>
            Mark ready
          </Button>
        )}
        {can('out_for_delivery') && (
          <Button className="flex-1" size="lg" onClick={() => setDialog('dispatch')}>
            <Bike className="size-4" aria-hidden /> Send out
          </Button>
        )}
        {can('ready_for_pickup') && (
          <Button className="flex-1" size="lg" loading={busy('ready_for_pickup')} onClick={() => action.change(order.id, 'ready_for_pickup')}>
            Ready for pickup — notify
          </Button>
        )}
        {can('delivered') && (
          <Button variant="success" className="flex-1" size="lg" loading={busy('delivered')} onClick={() => action.change(order.id, 'delivered')}>
            {delivery ? 'Delivered' : 'Collected'}
          </Button>
        )}
        {order.status === 'out_for_delivery' && (
          <a href={whatsappLink(normalizeGhanaPhone(order.rider_phone) ?? order.customer_phone, riderMessage)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold ring-1 ring-line">
            <Send className="size-4" aria-hidden /> Rider info
          </a>
        )}
        {order.status === 'awaiting_payment' && (
          <>
            <Button
              variant="secondary"
              onClick={() => navigator.clipboard.writeText(payLink).then(() => toast('Payment link copied', 'success'))}
            >
              <Copy className="size-4" aria-hidden /> Copy pay link
            </Button>
            <a
              href={whatsappLink(order.customer_phone, `Hello ${order.customer_name.split(' ')[0]}, please pay ${formatCedis(order.total_pesewas)} for your Irie's Cuisine order #${order.order_number} here: ${payLink}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-xl bg-[#25D366] px-3 text-sm font-semibold text-white"
            >
              Send via WhatsApp
            </a>
            {can('cancelled') && (
              <Button variant="ghost" loading={busy('cancelled')} onClick={() => action.change(order.id, 'cancelled', { note: 'Cancelled by staff before payment' })}>
                Cancel
              </Button>
            )}
          </>
        )}
        <a href={`/staff/ticket/${order.id}`} target="_blank" rel="noopener noreferrer" className="ml-auto grid size-11 place-items-center rounded-xl ring-1 ring-line hover:bg-black/5" aria-label="Print kitchen ticket">
          <Printer className="size-4" />
        </a>
        {manager && order.paid_payment_id && order.status !== 'awaiting_payment' && (
          <div className="flex w-full gap-2 border-t border-dashed border-line pt-2">
            {can('cancelled') && (
              <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDialog('cancel')}>
                Cancel & refund
              </Button>
            )}
            {order.status !== 'refunded' && order.refunded_pesewas < order.total_pesewas && (
              <Button variant="ghost" size="sm" onClick={() => setDialog('refund')}>
                Partial refund…
              </Button>
            )}
          </div>
        )}
      </footer>

      {/* Dialogs */}
      {dialog === 'accept' && (
        <Dialog
          open
          onClose={() => setDialog(null)}
          title={`Accept #${order.order_number}`}
          footer={
            <Button
              variant="success"
              size="lg"
              block
              loading={busy('accepted')}
              onClick={async () => {
                if (await action.change(order.id, 'accepted', { prepMinutes: prep })) setDialog(null)
              }}
            >
              Accept · ready in {prep} min
            </Button>
          }
        >
          <p className="text-sm text-muted">How long until it’s ready? The customer gets an SMS with this estimate.</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {PREP_CHOICES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPrep(m)}
                className={cn('min-h-14 rounded-xl text-lg font-bold ring-1', prep === m ? 'bg-ink text-white ring-ink' : 'ring-line hover:bg-black/5')}
              >
                {m} min
              </button>
            ))}
          </div>
        </Dialog>
      )}

      {dialog === 'reject' && (
        <Dialog
          open
          onClose={() => setDialog(null)}
          title={`Reject #${order.order_number}?`}
          footer={
            <Button
              variant="danger"
              size="lg"
              block
              disabled={note.trim().length < 3}
              loading={busy('rejected')}
              onClick={async () => {
                if (await action.change(order.id, 'rejected', { note: note.trim() })) setDialog(null)
              }}
            >
              Reject and refund {formatCedis(order.total_pesewas)}
            </Button>
          }
        >
          <p className="text-sm text-muted">The customer is refunded in full automatically and gets an SMS with your reason.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {REJECT_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setNote(r)} className={cn('min-h-11 rounded-full px-3 text-sm ring-1', note === r ? 'bg-ink text-white ring-ink' : 'ring-line')}>
                {r}
              </button>
            ))}
          </div>
          <Field className="mt-4" label="Reason" htmlFor={`reject-${order.id}`}>
            <Input id={`reject-${order.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </Field>
        </Dialog>
      )}

      {dialog === 'dispatch' && (
        <Dialog
          open
          onClose={() => setDialog(null)}
          title={`Send out #${order.order_number}`}
          footer={
            <Button
              size="lg"
              block
              loading={busy('out_for_delivery')}
              onClick={async () => {
                if (await action.change(order.id, 'out_for_delivery', { riderName: rider.name || undefined, riderPhone: rider.phone || undefined })) setDialog(null)
              }}
            >
              Mark out for delivery
            </Button>
          }
        >
          <div className="space-y-4">
            <Field label="Rider name (optional)" htmlFor={`rn-${order.id}`}>
              <Input id={`rn-${order.id}`} value={rider.name} onChange={(e) => setRider((r) => ({ ...r, name: e.target.value }))} />
            </Field>
            <Field label="Rider phone (optional)" htmlFor={`rp-${order.id}`} hint="Shown to the customer so they can call the rider">
              <Input id={`rp-${order.id}`} type="tel" value={rider.phone} onChange={(e) => setRider((r) => ({ ...r, phone: e.target.value }))} placeholder="024 123 4567" />
            </Field>
            <a
              href={whatsappLink(normalizeGhanaPhone(rider.phone) ?? '+233000000000', riderMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn('inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white', !normalizeGhanaPhone(rider.phone) && 'pointer-events-none opacity-40')}
            >
              <Send className="size-4" aria-hidden /> Send address to rider on WhatsApp
            </a>
          </div>
        </Dialog>
      )}

      {(dialog === 'cancel' || dialog === 'refund') && (
        <Dialog
          open
          onClose={() => setDialog(null)}
          title={dialog === 'cancel' ? `Cancel #${order.order_number} and refund` : `Partial refund for #${order.order_number}`}
          footer={
            dialog === 'cancel' ? (
              <Button
                variant="danger"
                size="lg"
                block
                disabled={note.trim().length < 3}
                loading={busy('cancelled')}
                onClick={async () => {
                  if (await action.change(order.id, 'cancelled', { note: note.trim() })) setDialog(null)
                }}
              >
                Cancel order and refund {formatCedis(order.total_pesewas - order.refunded_pesewas)}
              </Button>
            ) : (
              <Button size="lg" block loading={refundBusy} onClick={() => refund(false)}>
                Refund {refundAmount ? `GH₵${refundAmount}` : ''}
              </Button>
            )
          }
        >
          <div className="space-y-4">
            {dialog === 'refund' && (
              <Field label="Amount (GH₵)" htmlFor={`ra-${order.id}`} hint={`Up to ${formatCedis(order.total_pesewas - order.refunded_pesewas)}`}>
                <Input id={`ra-${order.id}`} inputMode="decimal" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="25.00" />
              </Field>
            )}
            <Field label="Reason (saved in the audit log)" htmlFor={`rr-${order.id}`}>
              <Textarea id={`rr-${order.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
            </Field>
          </div>
        </Dialog>
      )}
    </article>
  )
}
