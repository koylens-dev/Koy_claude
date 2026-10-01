'use client'

import { useEffect, useState } from 'react'
import { formatSlot, isOpenForAsap, nextOpening, type HoursConfig } from '@/lib/time'
import { cn } from '@/lib/cn'

export function StoreStatus({ config, pauseMessage, className }: { config: HoursConfig; pauseMessage?: string | null; className?: string }) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  if (!now) return <span className={cn('inline-block h-8 w-48 rounded-full skeleton', className)} />

  const open = isOpenForAsap(now, config)
  const next = open ? null : nextOpening(now, config)
  const text = open
    ? 'Open now · order for delivery or pickup'
    : !config.acceptingOrders
      ? (pauseMessage ?? 'Not taking orders right now')
      : next
        ? `Closed · opens ${formatSlot(next, now)}${config.schedulingEnabled ? ' · schedule ahead' : ''}`
        : 'Closed'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset',
        open ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-amber-200',
        className,
      )}
    >
      <span className={cn('size-2 rounded-full', open ? 'bg-emerald-500' : 'bg-amber-500')} aria-hidden />
      {text}
    </span>
  )
}
