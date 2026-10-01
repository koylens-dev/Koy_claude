import type { Metadata } from 'next'
import { getServerSupabase } from '@/lib/supabase/server'
import { AttendantConsole } from './AttendantConsole'

export const metadata: Metadata = { title: 'Orders' }

export default async function StaffOrdersPage() {
  const supabase = await getServerSupabase()
  const { data } = await supabase.from('store_settings').select('default_prep_minutes').eq('id', 1).single()
  return <AttendantConsole defaultPrep={data?.default_prep_minutes ?? 25} />
}
