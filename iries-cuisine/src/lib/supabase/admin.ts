import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { serverEnv } from '@/lib/server/env'

let admin: SupabaseClient | undefined

/**
 * Service-role client: bypasses RLS. Server-only (webhooks, checkout, refunds, cron).
 * Never import this from a Client Component.
 */
export function getAdminSupabase(): SupabaseClient {
  if (!admin) {
    admin = createClient(serverEnv.supabaseUrl, serverEnv.supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  }
  return admin
}
