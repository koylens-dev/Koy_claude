import crypto from 'node:crypto'
import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { MANAGER_ROLES, requireStaff } from '@/lib/server/auth'
import { jsonError, jsonOk } from '@/lib/server/http'
import { serverEnv } from '@/lib/server/env'
import type { StaffRole } from '@/lib/types'

export const maxDuration = 60

const DEMO_STAFF: { role: StaffRole; name: string }[] = [
  { role: 'attendant', name: 'Demo Attendant' },
  { role: 'kitchen', name: 'Demo Kitchen' },
  { role: 'dispatcher', name: 'Demo Rider' },
  { role: 'manager', name: 'Demo Manager' },
]

function demoEmailDomain() {
  try {
    const host = new URL(serverEnv.siteUrl).hostname
    return host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host) ? 'iries.test' : host.replace(/^www\./, '')
  } catch {
    return 'iries.test'
  }
}

function password() {
  // readable: no 0/O/1/l
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.randomBytes(14), (b) => alphabet[b % alphabet.length]).join('')
}

// GET /api/admin/demo — is demo data loaded? (managers and owner)
export async function GET() {
  const auth = await requireStaff(MANAGER_ROLES)
  if ('response' in auth) return auth.response
  const admin = getAdminSupabase()
  const [orders, catering, staff] = await Promise.all([
    admin.from('orders').select('id', { count: 'exact', head: true }).eq('is_demo', true),
    admin.from('catering_enquiries').select('id', { count: 'exact', head: true }).eq('is_demo', true),
    admin.from('staff').select('user_id, display_name, role, is_active').eq('is_demo', true),
  ])
  return jsonOk({ orders: orders.count ?? 0, catering: catering.count ?? 0, staff: staff.data ?? [] })
}

// POST /api/admin/demo { action: 'seed' | 'clear' } — owner only.
export async function POST(req: NextRequest) {
  const auth = await requireStaff(['owner'])
  if ('response' in auth) return auth.response
  const body = (await req.json().catch(() => null)) as { action?: string } | null
  const admin = getAdminSupabase()

  if (body?.action === 'seed') {
    const { data, error } = await admin.rpc('seed_demo_data', { p_days: 42 })
    if (error) {
      if (error.message.startsWith('demo_data_exists')) return jsonError(409, 'exists', 'Demo data is already loaded.')
      if (error.message.startsWith('menu_empty')) return jsonError(422, 'menu_empty', 'Add at least one dish to the menu first.')
      Sentry.captureException(error, { tags: { area: 'demo-seed' } })
      return jsonError(500, 'seed_failed', 'Could not load demo data.')
    }

    // Practice logins for each role (removed together with the demo data)
    const domain = demoEmailDomain()
    const logins: { role: StaffRole; name: string; email: string; password: string }[] = []
    for (const s of DEMO_STAFF) {
      const email = `demo-${s.role}-${crypto.randomBytes(2).toString('hex')}@${domain}`
      const pw = password()
      const { data: created, error: userError } = await admin.auth.admin.createUser({
        email,
        password: pw,
        email_confirm: true,
        user_metadata: { display_name: s.name, demo: true },
      })
      if (userError || !created.user) continue
      const { error: staffError } = await admin
        .from('staff')
        .insert({ user_id: created.user.id, display_name: s.name, role: s.role, is_demo: true })
      if (staffError) {
        await admin.auth.admin.deleteUser(created.user.id)
        continue
      }
      logins.push({ role: s.role, name: s.name, email, password: pw })
    }
    await admin.from('audit_log').insert({
      actor_id: auth.staff.userId,
      actor_role: auth.staff.role,
      action: 'demo_data.loaded',
      entity_type: 'demo',
      details: { ...(data as object), demo_logins: logins.map((l) => l.email) },
    })
    return jsonOk({ seeded: data, logins })
  }

  if (body?.action === 'clear') {
    const { data, error } = await admin.rpc('clear_demo_data')
    if (error) {
      Sentry.captureException(error, { tags: { area: 'demo-clear' } })
      return jsonError(500, 'clear_failed', 'Could not remove demo data.')
    }
    const result = data as { orders: number; catering: number; staff_user_ids: string[] }
    let staffRemoved = 0
    for (const id of result.staff_user_ids ?? []) {
      const { error: delError } = await admin.auth.admin.deleteUser(id)
      if (!delError) staffRemoved++
    }
    await admin.from('audit_log').insert({
      actor_id: auth.staff.userId,
      actor_role: auth.staff.role,
      action: 'demo_data.removed',
      entity_type: 'demo',
      details: { orders: result.orders, catering: result.catering, staff: staffRemoved },
    })
    return jsonOk({ orders: result.orders, catering: result.catering, staff: staffRemoved })
  }

  return jsonError(400, 'invalid_action', 'Unknown action.')
}
