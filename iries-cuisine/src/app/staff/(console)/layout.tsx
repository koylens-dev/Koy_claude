import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getStaffMember } from '@/lib/server/auth'
import { StaffShell } from '@/components/staff/StaffShell'

export const metadata: Metadata = { title: 'Staff', robots: { index: false, follow: false } }

export default async function StaffConsoleLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaffMember()
  if (!staff) redirect('/staff/login?error=not_staff')
  return (
    <StaffShell role={staff.role} name={staff.displayName}>
      {children}
    </StaffShell>
  )
}
