import type { Metadata } from 'next'
import { StaffAdmin } from './StaffAdmin'

export const metadata: Metadata = { title: 'Staff' }

export default function StaffAdminPage() {
  return <StaffAdmin />
}
