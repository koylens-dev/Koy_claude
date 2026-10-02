'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Trash2, Copy, Send, CheckCircle2, FlaskConical } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { fetchMenu } from '@/lib/menu'
import type { Category, DeliveryZone, MenuItem } from '@/lib/types'
import { ItemDialog } from '@/components/menu/ItemDialog'
import type { ItemSelection } from '@/components/menu/ItemOptions'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { formatCedis } from '@/lib/money'
import { formatGhanaPhone, whatsappLink } from '@/lib/phone'
import type { PublicQuote } from '@/lib/server/quote'
import { cn } from '@/lib/cn'

type Line = { key: number; item: MenuItem; sel: ItemSelection }
type Created = {
  order: { id: string; order_number: number; total_pesewas: number; customer_phone: string; is_demo: boolean }
  links: { pay: string; track: string }
}

export function NewOrderForm() {
  const toast = useToast()
  const [menu, setMenu] = useState<Category[] | null>(null)
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [query, setQuery] = useState('')
  const [picking, setPicking] = useState<MenuItem | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' })
  const [channel, setChannel] = useState<'phone' | 'whatsapp' | 'walk_in'>('phone')
  const [fulfilment, setFulfilment] = useState<'delivery' | 'pickup'>('delivery')
  const [zoneId, setZoneId] = useState('')
  const [address, setAddress] = useState({ gps: '', landmark: '', directions: '' })
  const [notes, setNotes] = useState('')
  const [sendSms, setSendSms] = useState(true)
  const [practice, setPractice] = useState(false)
  const [demoPaid, setDemoPaid] = useState(false)
  const [quote, setQuote] = useState<PublicQuote | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Created | null>(null)

  useEffect(() => {
    const supabase = getBrowserSupabase()
    fetchMenu(supabase).then(setMenu)
    supabase.from('delivery_zones').select('*').eq('is_active', true).order('sort_order').then(({ data }) => setZones((data ?? []) as DeliveryZone[]))
  }, [])

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (menu ?? []).flatMap((c) => c.items).filter((i) => !q || i.name.toLowerCase().includes(q))
  }, [menu, query])

  const body = (mode: 'quote' | 'place') => ({
    mode,
    channel,
    customer: { name: customer.name.trim(), phone: customer.phone.trim(), email: customer.email.trim() },
    fulfilment,
    zoneId: fulfilment === 'delivery' ? zoneId || null : null,
    address: { gps: address.gps || null, landmark: address.landmark || null, directions: address.directions || null },
    notes: notes || null,
    sendPaymentSms: sendSms && !practice,
    demo: practice,
    lines: lines.map((l) => ({
      itemId: l.item.id,
      portionId: l.sel.portionId,
      optionIds: l.sel.options.map((o) => o.id),
      quantity: l.sel.quantity,
      notes: l.sel.notes || null,
    })),
  })

  async function submit(mode: 'quote' | 'place') {
    setError(null)
    if (!lines.length) {
      setError('Add at least one dish.')
      return
    }
    if (customer.name.trim().length < 2 || customer.phone.trim().length < 9) {
      setError('Enter the customer’s name and phone number.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/staff/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body(mode)) })
      const json = await res.json()
      if (json.quote) setQuote(json.quote)
      if (!res.ok) {
        setError(json.error?.message ?? json.quote?.issues?.[0]?.message ?? 'Please check the order.')
        return
      }
      if (mode === 'place') {
        setCreated(json)
        toast(`Order #${json.order.order_number} created`, 'success')
      }
    } catch {
      setError('No connection — try again.')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setLines([])
    setCustomer({ name: '', phone: '', email: '' })
    setAddress({ gps: '', landmark: '', directions: '' })
    setNotes('')
    setQuote(null)
    setCreated(null)
    setDemoPaid(false)
  }

  async function simulatePayment(orderId: string) {
    setBusy(true)
    const res = await fetch(`/api/staff/orders/${orderId}/demo-pay`, { method: 'POST' }).catch(() => null)
    setBusy(false)
    const json = await res?.json().catch(() => null)
    if (!res?.ok) {
      toast(json?.error?.message ?? 'Could not simulate the payment.', 'error')
      return
    }
    setDemoPaid(true)
    toast('Practice payment received', 'success')
  }

  if (created?.order.is_demo) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl bg-surface p-6 text-center ring-1 ring-fuchsia-200">
        <FlaskConical className="mx-auto size-12 text-fuchsia-700" aria-hidden />
        <h2 className="mt-3 font-display text-3xl font-semibold">Practice order #{created.order.order_number}</h2>
        <p className="mt-1 text-muted">
          {formatCedis(created.order.total_pesewas)} · no SMS was sent and no real payment can be taken.
        </p>
        {demoPaid ? (
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">
            Paid (practice). It is now in <strong>Orders → New</strong> with the alarm, ready to accept and cook.
          </p>
        ) : (
          <p className="mt-4 rounded-xl bg-fuchsia-50 p-3 text-sm text-fuchsia-950">
            On a real order the customer would now pay with MoMo or card. Tap below to pretend they did.
          </p>
        )}
        <div className="mt-4 grid gap-2">
          {!demoPaid && (
            <Button variant="success" size="lg" loading={busy} onClick={() => simulatePayment(created.order.id)}>
              <FlaskConical className="size-4" aria-hidden /> Simulate payment
            </Button>
          )}
          <Button variant={demoPaid ? 'primary' : 'secondary'} onClick={reset}>New order</Button>
        </div>
      </div>
    )
  }

  if (created) {
    const msg = `Hello ${customer.name.split(' ')[0]}, thank you for ordering from Irie's Cuisine! Order #${created.order.order_number}: ${formatCedis(created.order.total_pesewas)}. Pay securely with MoMo or card here: ${created.links.pay}`
    return (
      <div className="mx-auto max-w-lg rounded-3xl bg-surface p-6 text-center ring-1 ring-line">
        <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
        <h2 className="mt-3 font-display text-3xl font-semibold">Order #{created.order.order_number} created</h2>
        <p className="mt-1 text-muted">
          {formatCedis(created.order.total_pesewas)} · waiting for payment from {formatGhanaPhone(created.order.customer_phone)}
          {sendSms && ' · payment link sent by SMS'}
        </p>
        <p className="mt-4 break-all rounded-xl bg-cream p-3 font-mono text-sm">{created.links.pay}</p>
        <div className="mt-4 grid gap-2">
          <Button variant="secondary" onClick={() => navigator.clipboard.writeText(created.links.pay).then(() => toast('Link copied', 'success'))}>
            <Copy className="size-4" aria-hidden /> Copy payment link
          </Button>
          <a href={whatsappLink(created.order.customer_phone, msg)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] font-semibold text-white">
            <Send className="size-4" aria-hidden /> Send on WhatsApp
          </a>
          <Button onClick={reset}>New order</Button>
        </div>
        <p className="mt-4 text-xs text-muted">The order appears under “Awaiting payment” and moves to “New” with an alarm as soon as the customer pays.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <section className="rounded-3xl bg-surface p-4 ring-1 ring-line">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a dish…" className="pl-9" aria-label="Find a dish" />
        </div>
        {!menu ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  disabled={!i.is_available}
                  onClick={() => setPicking(i)}
                  className="flex min-h-14 w-full items-center justify-between gap-2 rounded-xl px-3 text-left ring-1 ring-line hover:bg-brand-soft/40 disabled:opacity-40"
                >
                  <span className="font-medium">{i.name}</span>
                  <span className="text-sm text-muted">{i.is_available ? formatCedis(Math.min(...i.portions.map((p) => p.price_pesewas))) : 'Sold out'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 rounded-3xl bg-surface p-4 ring-1 ring-line">
        <h2 className="font-display text-2xl font-semibold">Order</h2>
        {lines.length === 0 ? (
          <p className="text-sm text-muted">Tap dishes on the left to add them.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {lines.map((l) => (
              <li key={l.key} className="flex items-start justify-between gap-2">
                <span>
                  <strong>{l.sel.quantity}×</strong> {l.item.name}
                  <span className="block text-xs text-muted">{[l.sel.portionName, ...l.sel.options.map((o) => o.name)].join(' · ')}{l.sel.notes && ` · “${l.sel.notes}”`}</span>
                </span>
                <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="grid size-9 place-items-center rounded-lg hover:bg-black/5" aria-label={`Remove ${l.item.name}`}>
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Channel">
          {(['phone', 'whatsapp', 'walk_in'] as const).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={channel === c} onClick={() => setChannel(c)} className={cn('min-h-11 rounded-xl text-sm font-semibold ring-1', channel === c ? 'bg-ink text-white ring-ink' : 'ring-line')}>
              {c === 'phone' ? 'Phone' : c === 'whatsapp' ? 'WhatsApp' : 'Walk-in'}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Customer name" htmlFor="no-name"><Input id="no-name" value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} /></Field>
          <Field label="Customer phone" htmlFor="no-phone"><Input id="no-phone" type="tel" value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} placeholder="024 123 4567" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['delivery', 'pickup'] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFulfilment(f)} className={cn('min-h-11 rounded-xl text-sm font-semibold ring-1', fulfilment === f ? 'bg-ink text-white ring-ink' : 'ring-line')}>
              {f === 'delivery' ? 'Delivery' : 'Pickup'}
            </button>
          ))}
        </div>
        {fulfilment === 'delivery' && (
          <div className="space-y-3">
            <Field label="Zone" htmlFor="no-zone">
              <Select id="no-zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                <option value="">Select…</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name} — {formatCedis(z.fee_pesewas)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Landmark" htmlFor="no-landmark"><Input id="no-landmark" value={address.landmark} onChange={(e) => setAddress((a) => ({ ...a, landmark: e.target.value }))} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ghana Post GPS" htmlFor="no-gps"><Input id="no-gps" value={address.gps} onChange={(e) => setAddress((a) => ({ ...a, gps: e.target.value.toUpperCase() }))} placeholder="GA-543-0125" /></Field>
              <Field label="Directions" htmlFor="no-dir"><Input id="no-dir" value={address.directions} onChange={(e) => setAddress((a) => ({ ...a, directions: e.target.value }))} /></Field>
            </div>
          </div>
        )}
        <Field label="Notes" htmlFor="no-notes"><Textarea id="no-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <label className={cn('flex items-center gap-2 text-sm', practice && 'opacity-40')}>
          <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={sendSms && !practice} disabled={practice} onChange={(e) => setSendSms(e.target.checked)} />
          Text the payment link to the customer
        </label>
        <label className="flex items-start gap-2 rounded-xl bg-fuchsia-50 p-2.5 text-sm text-fuchsia-950">
          <input type="checkbox" className="mt-0.5 size-5 accent-fuchsia-700" checked={practice} onChange={(e) => setPractice(e.target.checked)} />
          <span>
            <strong>Practice order</strong> (training): no SMS, no real payment. Removed with the rest of the demo data.
          </span>
        </label>

        {quote && (
          <dl className="space-y-1 rounded-xl bg-cream p-3 text-sm">
            <div className="flex justify-between"><dt>Food</dt><dd>{formatCedis(quote.subtotal)}</dd></div>
            {fulfilment === 'delivery' && <div className="flex justify-between"><dt>Delivery</dt><dd>{formatCedis(quote.deliveryFee)}</dd></div>}
            <div className="flex justify-between font-bold"><dt>Total</dt><dd>{formatCedis(quote.total)}</dd></div>
            {quote.issues.map((i) => <p key={i.code + (i.lineIndex ?? '')} className="text-xs text-red-800">{i.message}</p>)}
          </dl>
        )}
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-900" role="alert">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" loading={busy} onClick={() => submit('quote')}>Check total</Button>
          <Button loading={busy} onClick={() => submit('place')}>{practice ? 'Create practice order' : 'Create & get pay link'}</Button>
        </div>
        <p className="text-xs text-muted">Prepaid only: the kitchen sees this order after the customer pays.</p>
      </section>

      {picking && (
        <ItemDialog
          item={picking}
          actionLabel="Add"
          onClose={() => setPicking(null)}
          onAdd={(item, sel) => {
            setLines((ls) => [...ls, { key: Date.now(), item, sel }])
            setPicking(null)
            setQuote(null)
          }}
        />
      )}
    </div>
  )
}
