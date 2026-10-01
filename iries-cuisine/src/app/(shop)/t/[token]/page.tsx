import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicSupabase } from '@/lib/supabase/public'
import type { TrackedOrder } from '@/lib/types'
import { TrackOrder } from './TrackOrder'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Your order', robots: { index: false, follow: false } }

// Tracking + receipt page. Works without signing in: the link contains an
// unguessable token (sent by SMS and used as Paystack's return URL).
export default async function TrackPage({ params, searchParams }: PageProps<'/t/[token]'>) {
  const { token } = await params
  const sp = await searchParams
  if (!/^[0-9a-f]{32}$/.test(token)) notFound()
  const { data } = await getPublicSupabase().rpc('track_order', { p_token: token })
  if (!data) notFound()
  const reference = (typeof sp.reference === 'string' && sp.reference) || (typeof sp.trxref === 'string' && sp.trxref) || null
  const error = typeof sp.error === 'string' ? sp.error : null
  return <TrackOrder token={token} initial={data as TrackedOrder} reference={reference} error={error} />
}
