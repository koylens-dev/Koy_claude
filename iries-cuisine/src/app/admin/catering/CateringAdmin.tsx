'use client'

import { useCallback, useEffect, useState } from 'react'
import { Phone } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { PageTitle } from '@/components/admin/AdminShell'
import { Select } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDateTime } from '@/lib/time'
import { formatGhanaPhone, whatsappLink } from '@/lib/phone'

type Enquiry = {
  id: string
  name: string
  phone: string
  email: string | null
  event_date: string | null
  event_type: string | null
  headcount: number | null
  budget: string | null
  location: string | null
  menu_interest: string | null
  notes: string | null
  status: string
  created_at: string
}
const STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost']

export function CateringAdmin() {
  const [rows, setRows] = useState<Enquiry[] | null>(null)
  const load = useCallback(
    () =>
      getBrowserSupabase()
        .from('catering_enquiries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
        .then(({ data }) => setRows((data ?? []) as Enquiry[])),
    [],
  )
  useEffect(() => {
    load()
  }, [load])

  async function setStatus(id: string, status: string) {
    await getBrowserSupabase().from('catering_enquiries').update({ status }).eq('id', id)
    load()
  }

  return (
    <div className="max-w-4xl">
      <PageTitle title="Catering enquiries" description="From the catering form on the website. Managers also get an SMS for each new enquiry (if STAFF_ALERT_PHONES is set)." />
      {!rows ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-muted">No enquiries yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((e) => (
            <li key={e.id} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{e.name} · {e.event_type ?? 'Event'}{e.headcount ? ` · ${e.headcount} guests` : ''}</p>
                  <p className="text-sm text-muted">
                    {e.event_date ? `Event ${e.event_date}` : 'Date not set'}{e.location && ` · ${e.location}`}{e.budget && ` · budget ${e.budget}`}
                  </p>
                </div>
                <Select aria-label="Status" value={e.status} onChange={(ev) => setStatus(e.id, ev.target.value)} className="w-36">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              {e.menu_interest && <p className="mt-2 text-sm"><strong>Menu:</strong> {e.menu_interest}</p>}
              {e.notes && <p className="mt-1 text-sm"><strong>Notes:</strong> {e.notes}</p>}
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <a href={`tel:${e.phone}`} className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 font-semibold ring-1 ring-line"><Phone className="size-4" aria-hidden /> {formatGhanaPhone(e.phone)}</a>
                <a href={whatsappLink(e.phone, `Hello ${e.name.split(' ')[0]}, thank you for your catering enquiry with Irie's Cuisine. `)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-xl bg-[#25D366] px-3 font-semibold text-white">WhatsApp</a>
                {e.email && <a href={`mailto:${e.email}`} className="inline-flex min-h-10 items-center rounded-xl px-3 font-semibold ring-1 ring-line">{e.email}</a>}
                <span className="ml-auto self-center text-xs text-muted">{formatDateTime(e.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
