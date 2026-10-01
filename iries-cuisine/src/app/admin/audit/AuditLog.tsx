'use client'

import { useEffect, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { PageTitle } from '@/components/admin/AdminShell'
import { Select } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDateTime } from '@/lib/time'
import { formatCedis } from '@/lib/money'

type Entry = { id: number; actor_id: string | null; actor_role: string | null; action: string; entity_type: string; entity_id: string | null; details: Record<string, unknown>; created_at: string }

const ACTIONS: Record<string, string> = {
  price_change: 'Price changed',
  price_set: 'Price added',
  price_removed: 'Price removed',
  delivery_fee_change: 'Delivery fee changed',
  refund_requested: 'Refund',
  refund_failed: 'Refund failed',
  order_rejected: 'Order rejected',
  order_cancelled: 'Order cancelled',
  staff_added: 'Staff added',
  staff_changed: 'Staff changed',
  settings_changed: 'Settings changed',
  payment_amount_mismatch: 'Payment amount mismatch',
  payment_needs_refund: 'Payment needs refund',
}

function describe(e: Entry): string {
  const d = e.details as Record<string, string | number | null>
  const money = (v: unknown) => (typeof v === 'number' ? formatCedis(v) : '—')
  switch (e.action) {
    case 'price_change':
      return `${d.item ?? d.option ?? ''} ${d.portion ?? ''}: ${money(d.old_price_pesewas)} → ${money(d.new_price_pesewas)}`
    case 'price_set':
      return `${d.item} ${d.portion}: ${money(d.new_price_pesewas)}`
    case 'delivery_fee_change':
      return `${d.zone}: fee ${money(d.old_fee_pesewas)} → ${money(d.new_fee_pesewas)}, minimum ${money(d.old_min_order_pesewas)} → ${money(d.new_min_order_pesewas)}`
    case 'refund_requested':
      return `Order #${d.order_number}: ${money(d.amount_pesewas)} — ${d.reason}${d.automatic ? ' (automatic)' : ''}`
    case 'order_rejected':
    case 'order_cancelled':
      return `Order #${d.order_number} (${money(d.total_pesewas)}): ${d.reason ?? ''}`
    case 'staff_added':
      return `${d.name} as ${d.role}`
    case 'staff_changed':
      return `${d.name}: ${d.old_role} → ${d.new_role}${d.old_active !== d.new_active ? `, ${d.new_active ? 'activated' : 'deactivated'}` : ''}`
    case 'settings_changed':
      return Object.keys((e.details.changes as object) ?? {}).join(', ')
    default:
      return JSON.stringify(e.details)
  }
}

export function AuditLog() {
  const [rows, setRows] = useState<Entry[] | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [action, setAction] = useState('')

  useEffect(() => {
    const supabase = getBrowserSupabase()
    let q = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(300)
    if (action) q = q.eq('action', action)
    q.then(({ data }) => setRows((data ?? []) as Entry[]))
    supabase.from('staff').select('user_id, display_name').then(({ data }) => setNames(Object.fromEntries((data ?? []).map((s) => [s.user_id, s.display_name]))))
  }, [action])

  return (
    <div className="max-w-5xl">
      <PageTitle title="Audit log" description="Price changes, refunds, cancellations, staff and settings changes — who did what and when. Entries cannot be edited or deleted from the app." />
      <Select value={action} onChange={(e) => setAction(e.target.value)} className="mb-4 w-64" aria-label="Filter by action">
        <option value="">All actions</option>
        {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </Select>
      {!rows ? (
        <Skeleton className="h-96" />
      ) : (
        <ul className="divide-y divide-line rounded-2xl bg-surface ring-1 ring-line">
          {rows.length === 0 && <li className="p-4 text-muted">Nothing yet.</li>}
          {rows.map((e) => (
            <li key={e.id} className="grid gap-1 p-3 text-sm sm:grid-cols-[170px_160px_1fr]">
              <span className="tabular-nums text-muted">{formatDateTime(e.created_at)}</span>
              <span className="font-semibold">{ACTIONS[e.action] ?? e.action}</span>
              <span>
                {describe(e)}
                <span className="block text-xs text-muted">by {e.actor_id ? (names[e.actor_id] ?? 'customer') : 'system'}{e.actor_role ? ` (${e.actor_role})` : ''}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
