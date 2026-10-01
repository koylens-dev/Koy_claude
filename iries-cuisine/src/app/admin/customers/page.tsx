import type { Metadata } from 'next'
import { CustomersAdmin } from './CustomersAdmin'

export const metadata: Metadata = { title: 'Customers' }

export default function CustomersPage() {
  return <CustomersAdmin />
}
