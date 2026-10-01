import type { Metadata } from 'next'
import { Suspense } from 'react'
import { OrdersTable } from './OrdersTable'

export const metadata: Metadata = { title: 'Orders' }

export default function AdminOrdersPage() {
  return (
    <Suspense>
      <OrdersTable />
    </Suspense>
  )
}
