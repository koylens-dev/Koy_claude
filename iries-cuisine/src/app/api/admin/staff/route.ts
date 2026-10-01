import type { NextRequest } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { MANAGER_ROLES, requireStaff } from '@/lib/server/auth'
import { jsonError, jsonOk } from '@/lib/server/http'
import { firstZodMessage, staffAccountSchema, staffUpdateSchema } from '@/lib/validation'
import type { StaffRole } from '@/lib/types'

const PRIVILEGED: StaffRole[] = ['manager', 'owner']

// POST /api/admin/staff — create a staff login (email + password) with a role.
// Managers can create attendant/kitchen/dispatcher accounts; only the owner can create managers/owners.
export async function POST(req: NextRequest) {
  const auth = await requireStaff(MANAGER_ROLES)
  if ('response' in auth) return auth.response

  const parsed = staffAccountSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return jsonError(400, 'invalid_input', firstZodMessage(parsed.error))
  const input = parsed.data
  if (PRIVILEGED.includes(input.role) && auth.staff.role !== 'owner') {
    return jsonError(403, 'forbidden', 'Only the owner can create manager or owner accounts.')
  }

  const admin = getAdminSupabase()
  const { data: created, error } = await admin.auth.admin.createUser({
    email: input.email.toLowerCase(),
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.displayName },
  })
  if (error || !created.user) {
    return jsonError(422, 'create_failed', error?.message ?? 'Could not create the account (is the email already used?).')
  }

  const { error: staffError } = await admin
    .from('staff')
    .insert({ user_id: created.user.id, display_name: input.displayName, role: input.role })
  if (staffError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return jsonError(500, 'create_failed', staffError.message)
  }
  return jsonOk({ userId: created.user.id })
}

// PATCH /api/admin/staff — change role, name, active flag or reset password.
export async function PATCH(req: NextRequest) {
  const auth = await requireStaff(MANAGER_ROLES)
  if ('response' in auth) return auth.response

  const parsed = staffUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return jsonError(400, 'invalid_input', firstZodMessage(parsed.error))
  const input = parsed.data
  const admin = getAdminSupabase()

  const { data: target } = await admin.from('staff').select('user_id, role, is_active').eq('user_id', input.userId).maybeSingle()
  if (!target) return jsonError(404, 'not_found', 'Staff member not found.')

  const touchesPrivileged = PRIVILEGED.includes(target.role as StaffRole) || (input.role && PRIVILEGED.includes(input.role))
  if (touchesPrivileged && auth.staff.role !== 'owner') {
    return jsonError(403, 'forbidden', 'Only the owner can change manager or owner accounts.')
  }
  if (input.userId === auth.staff.userId && (input.isActive === false || (input.role && input.role !== auth.staff.role))) {
    return jsonError(422, 'self_change', "You can't deactivate yourself or change your own role.")
  }
  if (target.role === 'owner' && (input.isActive === false || (input.role && input.role !== 'owner'))) {
    const { count } = await admin.from('staff').select('user_id', { count: 'exact', head: true }).eq('role', 'owner').eq('is_active', true)
    if ((count ?? 0) <= 1) return jsonError(422, 'last_owner', 'There must always be at least one active owner.')
  }

  const patch: Record<string, unknown> = {}
  if (input.role) patch.role = input.role
  if (input.isActive !== undefined) patch.is_active = input.isActive
  if (input.displayName) patch.display_name = input.displayName
  if (Object.keys(patch).length) {
    const { error } = await admin.from('staff').update(patch).eq('user_id', input.userId)
    if (error) return jsonError(500, 'update_failed', error.message)
  }

  if (input.password) {
    const { error } = await admin.auth.admin.updateUserById(input.userId, { password: input.password })
    if (error) return jsonError(422, 'password_failed', error.message)
  }
  if (input.isActive !== undefined) {
    // Deactivated staff lose access at once (every query re-checks staff.is_active);
    // banning the login also stops them signing in again or refreshing a session.
    await admin.auth.admin
      .updateUserById(input.userId, { ban_duration: input.isActive ? 'none' : '876000h' })
      .catch(() => undefined)
  }
  return jsonOk({ ok: true })
}
