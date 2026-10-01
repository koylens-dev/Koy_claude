import type { Metadata } from 'next'
import { OrderDetail } from './OrderDetail'

export const metadata: Metadata = { title: 'Order' }

export default async function AdminOrderPage({ params }: PageProps<'/admin/orders/[id]'>) {
  const { id } = await params
  return <OrderDetail id={id} />
}
