'use client'

import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import type { Connection } from './useLiveOrders'
import { formatTime } from '@/lib/time'
import { cn } from '@/lib/cn'

export function ConnectionBadge({ connection, lastSync, dark }: { connection: Connection; lastSync: Date | null; dark?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
        connection === 'live' && (dark ? 'bg-emerald-900/60 text-emerald-200' : 'bg-emerald-50 text-emerald-900'),
        connection === 'connecting' && (dark ? 'bg-white/10 text-white' : 'bg-stone-100 text-stone-700'),
        connection === 'offline' && 'bg-red-600 text-white',
      )}
      role="status"
    >
      {connection === 'live' && <Wifi className="size-3.5" aria-hidden />}
      {connection === 'connecting' && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {connection === 'offline' && <WifiOff className="size-3.5" aria-hidden />}
      {connection === 'live' ? 'Live' : connection === 'connecting' ? 'Connecting…' : 'Offline — reconnecting'}
      {lastSync && <span className="font-normal opacity-75">· {formatTime(lastSync)}</span>}
    </span>
  )
}
