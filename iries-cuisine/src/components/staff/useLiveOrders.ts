'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { ACTIVE_STATUSES } from '@/lib/order-status'
import type { OrderWithItems } from '@/lib/types'

export type Connection = 'connecting' | 'live' | 'offline'

const SELECT = '*, order_items(*)'
const RECENT_HOURS = 18

/**
 * Live list of orders for staff screens.
 * - Supabase Realtime pushes every change to the orders table (RLS: staff only).
 * - On (re)connect we reload everything, because changes during a drop are not replayed.
 * - A slow safety poll covers flaky networks; a faster one runs while offline.
 */
export function useLiveOrders() {
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loaded, setLoaded] = useState(false)
  const [connection, setConnection] = useState<Connection>('connecting')
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const loadingRef = useRef(false)

  const load = useCallback(() => {
    if (loadingRef.current) return Promise.resolve()
    loadingRef.current = true
    const since = new Date(Date.now() - RECENT_HOURS * 3600_000).toISOString()
    return getBrowserSupabase()
      .from('orders')
      .select(SELECT)
      .or(`status.in.(${ACTIVE_STATUSES.join(',')}),created_at.gte.${since}`)
      .order('created_at', { ascending: false })
      .limit(300)
      .then(
        ({ data, error }) => {
          loadingRef.current = false
          if (error) {
            setConnection('offline')
            return
          }
          setOrders((data ?? []) as OrderWithItems[])
          setLoaded(true)
          setLastSync(new Date())
        },
        () => {
          loadingRef.current = false
          setConnection('offline')
        },
      )
  }, [])

  const upsert = useCallback((order: OrderWithItems) => {
    setOrders((prev) => {
      const i = prev.findIndex((o) => o.id === order.id)
      if (i === -1) return [order, ...prev]
      const next = [...prev]
      next[i] = { ...prev[i], ...order, order_items: order.order_items ?? prev[i].order_items }
      return next
    })
  }, [])

  const fetchOne = useCallback(
    async (id: string) => {
      const { data } = await getBrowserSupabase().from('orders').select(SELECT).eq('id', id).maybeSingle()
      if (data) upsert(data as OrderWithItems)
    },
    [upsert],
  )

  useEffect(() => {
    // Show orders straight away; don't wait for the realtime socket (slow on 3G).
    load()
    const supabase = getBrowserSupabase()
    const channel = supabase
      .channel('staff-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const row = (payload.new ?? {}) as { id?: string }
        if (row.id) fetchOne(row.id) // re-read with items
        setLastSync(new Date())
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnection('live')
          load()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnection('offline')
        }
      })

    const onOnline = () => load()
    const onOffline = () => setConnection('offline')
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, fetchOne])

  // Safety net: poll every 30 s when live, every 8 s when the socket is down.
  useEffect(() => {
    const t = setInterval(load, connection === 'live' ? 30_000 : 8_000)
    return () => clearInterval(t)
  }, [connection, load])

  return { orders, loaded, connection, lastSync, reload: load, upsert }
}
