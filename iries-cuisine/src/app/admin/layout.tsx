import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getStaffMember } from '@/lib/server/auth'
import { AdminShell } from '@/components/admin/AdminShell'

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin · Irie’s' }, robots: { index: false, follow: false } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaffMember()
  if (!staff) redirect('/staff/login?next=/admin')
  if (staff.role !== 'manager' && staff.role !== 'owner') redirect('/staff')
  return (
    <AdminShell role={staff.role} name={staff.displayName}>
      {children}
    </AdminShell>
  )
}
