import { getAdminSupabase } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET /api/health — for uptime monitors (UptimeRobot / Better Stack). 200 when the
// app can reach the database, 503 otherwise.
export async function GET() {
  const started = Date.now()
  try {
    const { error } = await getAdminSupabase().from('store_settings').select('id').eq('id', 1).single()
    if (error) throw error
    return Response.json({ ok: true, db: 'up', ms: Date.now() - started }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ ok: false, db: 'down' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
