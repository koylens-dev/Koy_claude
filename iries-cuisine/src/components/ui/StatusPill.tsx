import { STAFF_LABEL, STATUS_TONE, customerLabel } from '@/lib/order-status'
import type { Fulfilment, OrderStatus } from '@/lib/types'
import { cn } from '@/lib/cn'

export function StatusPill({ status, fulfilment, audience = 'staff', className }: {
  status: OrderStatus
  fulfilment?: Fulfilment
  audience?: 'staff' | 'customer'
  className?: string
}) {
  const label = audience === 'customer' && fulfilment ? customerLabel(status, fulfilment) : STAFF_LABEL[status]
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', STATUS_TONE[status], className)}>
      {label}
    </span>
  )
}
