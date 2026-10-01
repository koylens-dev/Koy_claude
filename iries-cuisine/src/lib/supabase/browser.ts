'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { publicEnv } from '@/lib/public-env'

let client: SupabaseClient | undefined

/** One Supabase client per browser tab (auth session in cookies, realtime socket shared). */
export function getBrowserSupabase(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseKey)
  }
  return client
}
