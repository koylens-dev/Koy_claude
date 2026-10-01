import type { Metadata } from 'next'
import { ZonesAdmin } from './ZonesAdmin'

export const metadata: Metadata = { title: 'Delivery zones' }

export default function ZonesPage() {
  return <ZonesAdmin />
}
