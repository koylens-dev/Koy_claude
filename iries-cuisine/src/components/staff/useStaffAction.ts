'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import type { OrderRow, OrderStatus } from '@/lib/types'

/** Calls the status API; one retry on network failure (kitchen Wi-Fi blips). */
export function useStaffAction(onUpdated: (order: OrderRow) => void) {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  async function change(
    orderId: string,
    to: Exclude<OrderStatus, 'awaiting_payment' | 'paid' | 'refunded'>,
    extra: { note?: string; prepMinutes?: number; riderName?: string; riderPhone?: string } = {},
  ) {
    setBusy(`${orderId}:${to}`)
    const body = JSON.stringify({ to, ...extra })
    try {
      let res: Response | null = null
      for (let attempt = 0; attempt < 2 && !res; attempt++) {
        try {
          res = await fetch(`/api/staff/orders/${orderId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
        } catch {
          if (attempt === 1) throw new Error('offline')
          await new Promise((r) => setTimeout(r, 1500))
        }
      }
      const json = await res!.json()
      if (!res!.ok) {
        toast(json.error?.message ?? 'That did not work.', 'error')
        return false
      }
      onUpdated(json.order)
      if (json.refund && !json.refund.ok) toast('Order updated, but the automatic refund failed — a manager must refund it from Admin › Orders.', 'error')
      return true
    } catch {
      toast('No connection — check the internet and try again.', 'error')
      return false
    } finally {
      setBusy(null)
    }
  }

  return { change, busy }
}
