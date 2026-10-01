import { redirect } from 'next/navigation'
import { getStaffMember } from '@/lib/server/auth'

export default async function StaffHome() {
  const staff = await getStaffMember()
  if (!staff) redirect('/staff/login')
  redirect(staff.role === 'kitchen' ? '/staff/kitchen' : '/staff/orders')
}
