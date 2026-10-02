'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BellRing, Clock, Printer } from 'lucide-react'
import { useLiveOrders } from '@/components/staff/useLiveOrders'
import { useStaffAction } from '@/components/staff/useStaffAction'
import { ConnectionBadge } from '@/components/staff/ConnectionBadge'
import { keepScreenOn, playTicketBeep, releaseScreen, unlockAudio } from '@/components/staff/alerts'
import type { OrderRow, OrderWithItems } from '@/lib/types'
import { accraDateKey, formatSlot, formatTime } from '@/lib/time'
import { cn } from '@/lib/cn'

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function mmss(ms: number) {
  const neg = ms < 0
  const s = Math.floor(Math.abs(ms) / 1000)
  return `${neg ? '-' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** When the kitchen should start this ticket (scheduled orders wait until it's time). */
function startBy(o: OrderWithItems) {
  if (o.estimated_ready_at && o.prep_minutes) return new Date(o.estimated_ready_at).getTime() - o.prep_minutes * 60000
  return new Date(o.accepted_at ?? o.paid_at ?? o.created_at).getTime()
}

export function KitchenDisplay() {
  const { orders, loaded, connection, lastSync, upsert } = useLiveOrders()
  const action = useStaffAction((o: OrderRow) => upsert(o as OrderWithItems))
  const [soundOn, setSoundOn] = useState(false)
  const now = useNow()

  // Scheduled tickets stay off the board until 90 minutes before the kitchen should start them.
  const accepted = useMemo(() => orders.filter((o) => o.status === 'accepted').sort((a, b) => startBy(a) - startBy(b)), [orders])
  const toCook = useMemo(() => accepted.filter((o) => startBy(o) - now < 90 * 60000), [accepted, now])
  const later = accepted.length - toCook.length
  const cooking = useMemo(() => orders.filter((o) => o.status === 'in_kitchen').sort((a, b) => startBy(a) - startBy(b)), [orders])
  const ready = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'ready' && o.ready_at && now - new Date(o.ready_at).getTime() < 45 * 60000)
        .sort((a, b) => new Date(b.ready_at!).getTime() - new Date(a.ready_at!).getTime()),
    [orders, now],
  )
  const waitingForAttendant = orders.filter((o) => o.status === 'paid').length

  // Beep when a new ticket lands in "To cook".
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!loaded) return
    const ids = new Set(toCook.map((o) => o.id))
    if (seen.current && soundOn && [...ids].some((id) => !seen.current!.has(id))) playTicketBeep()
    seen.current = ids
  }, [toCook, loaded, soundOn])

  useEffect(() => {
    if (!soundOn) return
    keepScreenOn()
    const onVisible = () => document.visibilityState === 'visible' && keepScreenOn()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      releaseScreen()
    }
  }, [soundOn])

  return (
    <div className="px-3 pb-10 pt-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!soundOn && (
          <button type="button" onClick={async () => setSoundOn(await unlockAudio())} className="min-h-12 rounded-xl bg-gold px-4 font-bold text-midnight">
            Start shift (sound + screen on)
          </button>
        )}
        {later > 0 && (
          <span className="inline-flex items-center gap-2 rounded-xl bg-sky-900 px-3 py-2 text-sm font-bold">
            <Clock className="size-4" aria-hidden /> {later} scheduled for later (shown 90 min before start)
          </span>
        )}
        {waitingForAttendant > 0 && (
          <span className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold">
            <BellRing className="size-4" aria-hidden /> {waitingForAttendant} new order{waitingForAttendant > 1 ? 's' : ''} waiting for the attendant
          </span>
        )}
        <span className="ml-auto">
          <ConnectionBadge connection={connection} lastSync={lastSync} dark />
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Column title="To cook" count={toCook.length}>
          {toCook.map((o) => (
            <Ticket key={o.id} order={o} now={now} since={o.accepted_at}>
              <button type="button" disabled={action.busy === `${o.id}:in_kitchen`} onClick={() => action.change(o.id, 'in_kitchen')} className="min-h-14 flex-1 rounded-xl bg-gold text-lg font-bold text-midnight active:scale-[0.98] disabled:opacity-50">
                Start
              </button>
              <button type="button" disabled={action.busy === `${o.id}:ready`} onClick={() => action.change(o.id, 'ready')} className="min-h-14 rounded-xl bg-white/10 px-4 font-semibold disabled:opacity-50">
                Ready
              </button>
            </Ticket>
          ))}
        </Column>
        <Column title="Cooking" count={cooking.length}>
          {cooking.map((o) => (
            <Ticket key={o.id} order={o} now={now} since={o.kitchen_started_at ?? o.accepted_at}>
              <button type="button" disabled={action.busy === `${o.id}:ready`} onClick={() => action.change(o.id, 'ready')} className="min-h-14 flex-1 rounded-xl bg-emerald-500 text-lg font-bold text-neutral-950 active:scale-[0.98] disabled:opacity-50">
                Mark ready
              </button>
            </Ticket>
          ))}
        </Column>
        <Column title="Ready (last 45 min)" count={ready.length}>
          {ready.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-2xl bg-emerald-950/60 px-4 py-3 ring-1 ring-emerald-800">
              <span className="flex items-center gap-2 font-display text-3xl font-bold">
                #{o.order_number}
                {o.is_demo && <DemoChip />}
              </span>
              <span className="text-sm text-emerald-200">
                {o.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'} · ready {formatTime(o.ready_at!)}
              </span>
            </div>
          ))}
        </Column>
      </div>
      {loaded && toCook.length + cooking.length === 0 && <p className="mt-10 text-center text-white/50">No tickets. New accepted orders appear here instantly.</p>}
    </div>
  )
}

function Column({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white/[0.03] p-2 ring-1 ring-white/10">
      <h2 className="flex items-center justify-between px-2 py-2 font-sans text-lg font-bold uppercase tracking-wider text-white/80">
        {title} <span className="rounded-full bg-white/10 px-3 text-base">{count}</span>
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Ticket({ order, now, since, children }: { order: OrderWithItems; now: number; since: string | null; children: React.ReactNode }) {
  const scheduledStart = order.scheduled_for ? startBy(order) : null
  const notYet = scheduledStart !== null && scheduledStart > now
  const elapsed = since ? now - new Date(since).getTime() : 0
  const budget = (order.prep_minutes ?? 25) * 60000
  const ratio = elapsed / budget
  const tone = notYet ? 'bg-sky-900 ring-sky-600' : ratio < 0.75 ? 'bg-neutral-900 ring-emerald-600' : ratio < 1 ? 'bg-amber-950 ring-amber-500' : 'bg-red-950 ring-red-500'
  const timerTone = notYet ? 'text-sky-200' : ratio < 0.75 ? 'text-emerald-300' : ratio < 1 ? 'text-amber-300' : 'text-red-300'

  return (
    <article className={cn('rounded-2xl p-4 ring-2', tone)}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-display text-4xl font-bold leading-none">
            #{order.order_number}
            {order.is_demo && <DemoChip />}
          </p>
          <p className="mt-1 text-sm text-white/70">
            {order.fulfilment === 'delivery' ? `Delivery · ${order.zone_name ?? ''}` : 'Pickup'} · {order.customer_name.split(' ')[0]}
          </p>
        </div>
        <div className="text-right">
          {notYet ? (
            <p className={cn('flex items-center gap-1 text-lg font-bold', timerTone)}>
              <Clock className="size-4" aria-hidden /> start{' '}
              {accraDateKey(new Date(scheduledStart!)) === accraDateKey(new Date(now)) ? formatTime(new Date(scheduledStart!)) : formatSlot(new Date(scheduledStart!), new Date(now))}
            </p>
          ) : (
            <p className={cn('font-mono text-3xl font-bold tabular-nums', timerTone)} aria-label={`Elapsed ${Math.floor(elapsed / 60000)} minutes`}>
              {mmss(elapsed)}
            </p>
          )}
          <p className="text-xs text-white/60">target {order.prep_minutes ?? 25} min</p>
        </div>
      </header>
      {order.scheduled_for && <p className="mt-2 rounded-lg bg-sky-500/20 px-2 py-1 text-sm font-semibold text-sky-100">Scheduled for {formatTime(order.scheduled_for)}</p>}
      <ul className="mt-3 space-y-2 text-lg">
        {order.order_items.map((i) => (
          <li key={i.id} className="leading-snug">
            <span className="font-bold text-gold">{i.quantity}×</span> <span className="font-semibold">{i.item_name}</span>
            {i.portion_name && <span className="text-white/70"> — {i.portion_name}</span>}
            {i.modifiers.length > 0 && <span className="block pl-7 text-base text-white/80">{i.modifiers.map((m) => m.option).join(' · ')}</span>}
            {i.notes && <span className="mt-0.5 block rounded bg-yellow-300 px-2 py-0.5 pl-2 text-base font-bold text-neutral-950">⚠ {i.notes}</span>}
          </li>
        ))}
      </ul>
      {order.notes && <p className="mt-2 rounded-lg bg-yellow-300 px-2 py-1 text-base font-bold text-neutral-950">Order note: {order.notes}</p>}
      <footer className="mt-4 flex gap-2">
        {children}
        <a href={`/staff/ticket/${order.id}`} target="_blank" rel="noopener noreferrer" className="grid min-h-14 w-14 place-items-center rounded-xl bg-white/10" aria-label="Print ticket">
          <Printer className="size-5" />
        </a>
      </footer>
    </article>
  )
}

function DemoChip() {
  return (
    <span className="rounded-md bg-fuchsia-300 px-1.5 py-0.5 font-sans text-xs font-bold uppercase tracking-wide text-fuchsia-950" title="Practice order: do not cook">
      Demo
    </span>
  )
}
