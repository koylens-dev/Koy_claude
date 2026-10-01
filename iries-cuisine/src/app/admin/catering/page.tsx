import type { Metadata } from 'next'
import { CateringAdmin } from './CateringAdmin'

export const metadata: Metadata = { title: 'Catering' }

export default function CateringAdminPage() {
  return <CateringAdmin />
}
