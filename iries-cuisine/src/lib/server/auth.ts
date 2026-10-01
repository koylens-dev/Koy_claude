import 'server-only'

import { getServerSupabase } from '@/lib/supabase/server'
import { jsonError } from './http'
import type { StaffRole } from '@/lib/types'

export type SessionUser = { id: string; phone: string | null; email: string | null }
export type StaffMember = { userId: string; role: StaffRole; displayName: string }

/** The verified signed-in user (JWT checked by Supabase), or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getServerSupabase()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  return {
    id: claims.sub as string,
    phone: (claims.phone as string | undefined) || null,
    email: (claims.email as string | undefined) || null,
  }
}

/** Active staff record for the signed-in user, or null. */
export async function getStaffMember(): Promise<StaffMember | null> {
  const supabase = await getServerSupabase()
  const { data: claims } = await supabase.auth.getClaims()
  const uid = claims?.claims?.sub
  if (!uid) return null
  const { data } = await supabase
    .from('staff')
    .select('user_id, role, display_name, is_active')
    .eq('user_id', uid)
    .maybeSingle()
  if (!data || !data.is_active) return null
  return { userId: data.user_id, role: data.role as StaffRole, displayName: data.display_name }
}

/** For API routes: returns the staff member or a ready-made 401/403 response. */
export async function requireStaff(roles?: StaffRole[]): Promise<{ staff: StaffMember } | { response: Response }> {
  const staff = await getStaffMember()
  if (!staff) return { response: jsonError(401, 'unauthorized', 'Please sign in with a staff account.') }
  if (roles && !roles.includes(staff.role)) return { response: jsonError(403, 'forbidden', "Your role can't do that.") }
  return { staff }
}

export const MANAGER_ROLES: StaffRole[] = ['manager', 'owner']
export const FRONT_OF_HOUSE: StaffRole[] = ['attendant', 'manager', 'owner']
