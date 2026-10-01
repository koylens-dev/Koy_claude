import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { publicEnv } from '@/lib/public-env'

let client: SupabaseClient | undefined

/**
 * Cookie-less anonymous client for public data (menu, hours, zones). Because it
 * doesn't read cookies, pages using it can be cached at the CDN edge.
 */
export function getPublicSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}
