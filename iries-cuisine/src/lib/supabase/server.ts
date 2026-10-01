import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { serverEnv } from '@/lib/server/env'

/**
 * Supabase client acting as the signed-in user (RLS applies).
 * Create a new one per request.
 */
export async function getServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(serverEnv.supabaseUrl, serverEnv.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component: cookies are read-only there. The proxy refreshes sessions.
        }
      },
    },
  })
}
