import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { getServerSupabase } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/server/auth'
import { StatusPill } from '@/components/ui/StatusPill'
import { buttonClasses } from '@/components/ui/Button'
import { formatCedis } from '@/lib/money'
import { formatDateTime } from '@/lib/time'
import type { Fulfilment, OrderStatus } from '@/lib/types'

export const metadata: Metadata = { title: 'My orders', robots: { index: false } }

export default async function OrdersPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?next=/orders')
  const supabase = await getServerSupabase()
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, public_token, status, fulfilment, total_pesewas, created_at, order_items(item_name, quantity)')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="mx-auto max-w-2xl pt-8">
      <h1 className="font-display text-4xl font-semibold">My orders</h1>
      {!orders?.length ? (
        <div className="py-16 text-center">
          <p className="text-muted">No orders yet.</p>
          <Link href="/" className={buttonClasses({ className: 'mt-4' })}>Browse the menu</Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/t/${o.public_token}`} className="flex items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line hover:shadow-md">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">#{o.order_number}</span>
                    <StatusPill status={o.status as OrderStatus} fulfilment={o.fulfilment as Fulfilment} audience="customer" />
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">
                    {(o.order_items as { item_name: string; quantity: number }[]).map((i) => `${i.quantity}× ${i.item_name}`).join(', ')}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{formatDateTime(o.created_at)}</p>
                </div>
                <span className="font-semibold">{formatCedis(o.total_pesewas)}</span>
                <ChevronRight className="size-5 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-sm text-muted">Tip: open any past order and tap “Order this again”.</p>
    </div>
  )
}
