'use client'

import { useEffect, useMemo, useState } from 'react'
import { BellRing, Volume2, VolumeX } from 'lucide-react'
import { useLiveOrders } from '@/components/staff/useLiveOrders'
import { useStaffAction } from '@/components/staff/useStaffAction'
import { OrderCard } from '@/components/staff/OrderCard'
import { ConnectionBadge } from '@/components/staff/ConnectionBadge'
import { useStaff } from '@/components/staff/StaffShell'
import { keepScreenOn, playNewOrderAlarm, releaseScreen, unlockAudio } from '@/components/staff/alerts'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import type { OrderRow, OrderStatus, OrderWithItems } from '@/lib/types'
import { cn } from '@/lib/cn'

type Tab = 'new' | 'preparing' | 'ready' | 'out' | 'unpaid' | 'done'

const TABS: { id: Tab; label: string; statuses: OrderStatus[] }[] = [
  { id: 'new', label: 'New', statuses: ['paid'] },
  { id: 'preparing', label: 'Preparing', statuses: ['accepted', 'in_kitchen'] },
  { id: 'ready', label: 'Ready', statuses: ['ready'] },
  { id: 'out', label: 'Out / pickup', statuses: ['out_for_delivery', 'ready_for_pickup'] },
  { id: 'unpaid', label: 'Awaiting payment', statuses: ['awaiting_payment'] },
  { id: 'done', label: 'Done', statuses: ['delivered', 'completed', 'rejected', 'cancelled', 'refunded'] },
]

function sortKey(o: OrderWithItems) {
  // Scheduled orders by due time; everything else by when it was paid/created.
  return new Date(o.scheduled_for ?? o.paid_at ?? o.created_at).getTime()
}

export function AttendantConsole({ defaultPrep }: { defaultPrep: number }) {
  const { role } = useStaff()
  const { orders, loaded, connection, lastSync, reload, upsert } = useLiveOrders()
  const action = useStaffAction((o: OrderRow) => upsert(o as OrderWithItems))
  const [tab, setTab] = useState<Tab>(role === 'dispatcher' ? 'ready' : 'new')
  const [soundOn, setSoundOn] = useState(false)
  const [muted, setMuted] = useState(false)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (!muted) return
    const t = setTimeout(() => setMuted(false), 60_000)
    return () => clearTimeout(t)
  }, [muted])

  const byTab = useMemo(() => {
    const map = new Map<Tab, OrderWithItems[]>()
    for (const t of TABS) {
      const list = orders.filter((o) => t.statuses.includes(o.status))
      list.sort((a, b) => (t.id === 'done' ? sortKey(b) - sortKey(a) : sortKey(a) - sortKey(b)))
      // Only show unpaid orders that staff created (phone/WhatsApp) or that are recent.
      map.set(t.id, t.id === 'unpaid' ? list.filter((o) => o.channel !== 'web' || now.getTime() - new Date(o.created_at).getTime() < 3600_000) : list)
    }
    return map
  }, [orders, now])

  const newCount = byTab.get('new')?.length ?? 0

  // Ring every few seconds until every paid order is accepted or rejected (or muted for a minute).
  const hasNew = newCount > 0
  useEffect(() => {
    if (!soundOn || !hasNew || muted) return
    playNewOrderAlarm()
    const t = setInterval(playNewOrderAlarm, 4000)
    return () => clearInterval(t)
  }, [soundOn, muted, hasNew])

  // Flash the browser tab title when new orders are waiting.
  useEffect(() => {
    const base = 'Orders · Irie’s staff'
    if (!newCount) {
      document.title = base
      return
    }
    let on = false
    const t = setInterval(() => {
      on = !on
      document.title = on ? `🔔 (${newCount}) NEW ORDER` : base
    }, 1000)
    return () => {
      clearInterval(t)
      document.title = base
    }
  }, [newCount])

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

  const list = byTab.get(tab) ?? []

  return (
    <div className="px-3 pb-24 pt-3">
      {!soundOn && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl bg-ink p-4 text-white">
          <BellRing className="size-6 text-accent" aria-hidden />
          <p className="flex-1 text-sm">
            <strong>Start your shift:</strong> tap to switch on loud alerts for new paid orders and keep this screen awake.
          </p>
          <Button variant="primary" size="lg" onClick={async () => setSoundOn(await unlockAudio())}>
            Start shift
          </Button>
        </div>
      )}

      {newCount > 0 && tab !== 'new' && (
        <button type="button" onClick={() => setTab('new')} className="alarm-pulse mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-danger p-4 text-lg font-bold text-white">
          <BellRing className="size-6" aria-hidden /> {newCount} new paid {newCount === 1 ? 'order' : 'orders'} — tap to view
        </button>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 gap-1 overflow-x-auto rounded-2xl bg-surface p-1 ring-1 ring-line [scrollbar-width:none]" role="tablist">
          {TABS.map((t) => {
            const count = byTab.get(t.id)?.length ?? 0
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold',
                  tab === t.id ? 'bg-ink text-white' : 'hover:bg-black/5',
                )}
              >
                {t.label}
                <span className={cn('min-w-6 rounded-full px-1.5 text-xs leading-6', t.id === 'new' && count > 0 ? 'bg-danger text-white' : tab === t.id ? 'bg-white/20' : 'bg-black/5')}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
        <ConnectionBadge connection={connection} lastSync={lastSync} />
        {soundOn && (
          <Button variant="secondary" size="sm" onClick={() => setMuted((m) => !m)} aria-pressed={muted}>
            {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
            {muted ? 'Muted for 1 min' : 'Mute 1 min'}
          </Button>
        )}
      </div>

      {connection === 'offline' && (
        <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-900" role="alert">
          Connection lost. Orders on screen may be out of date — we keep retrying automatically. Payments still arrive safely; nothing is lost.
        </p>
      )}

      {!loaded ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : list.length === 0 ? (
        <p className="py-20 text-center text-muted">Nothing here right now.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((o) => (
            <OrderCard key={o.id} order={o} role={role} action={action} onRefunded={reload} defaultPrep={defaultPrep} />
          ))}
        </div>
      )}
    </div>
  )
}
