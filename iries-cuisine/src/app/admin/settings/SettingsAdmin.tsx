'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { PageTitle } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import type { StoreSettings } from '@/lib/types'
import { accraDateKey } from '@/lib/time'
import { normalizeGhanaPhone } from '@/lib/phone'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
type Window = { day_of_week: number; opens_at: string; closes_at: string }

export function SettingsAdmin() {
  const toast = useToast()
  const [s, setS] = useState<StoreSettings | null>(null)
  const [hours, setHours] = useState<Window[]>([])
  const [closed, setClosed] = useState<{ closed_on: string; reason: string | null }[]>([])
  const [newClosed, setNewClosed] = useState({ date: '', reason: '' })
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(() => {
    const supabase = getBrowserSupabase()
    return Promise.all([
      supabase.from('store_settings').select('*').eq('id', 1).single(),
      supabase.from('opening_hours').select('day_of_week, opens_at, closes_at').order('day_of_week').order('opens_at'),
      supabase.from('closed_dates').select('*').gte('closed_on', accraDateKey()).order('closed_on'),
    ]).then(([a, b, c]) => {
      setS(a.data as StoreSettings)
      setHours(((b.data ?? []) as Window[]).map((h) => ({ ...h, opens_at: h.opens_at.slice(0, 5), closes_at: h.closes_at.slice(0, 5) })))
      setClosed(c.data ?? [])
    })
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function saveSettings() {
    if (!s) return
    for (const [k, v] of [['support_phone', s.support_phone], ['whatsapp_number', s.whatsapp_number]] as const) {
      if (v && !normalizeGhanaPhone(v)) return toast(`${k === 'support_phone' ? 'Support phone' : 'WhatsApp number'} is not a valid Ghana number`, 'error')
    }
    setSaving('settings')
    const { id: _id, ...rest } = s
    void _id
    const { error } = await getBrowserSupabase()
      .from('store_settings')
      .update({
        ...rest,
        support_phone: s.support_phone ? normalizeGhanaPhone(s.support_phone) : null,
        whatsapp_number: s.whatsapp_number ? normalizeGhanaPhone(s.whatsapp_number) : null,
      })
      .eq('id', 1)
    setSaving(null)
    toast(error ? error.message : 'Settings saved', error ? 'error' : 'success')
  }

  async function saveHours() {
    if (hours.some((h) => h.closes_at <= h.opens_at)) return toast('Closing time must be after opening time (no overnight windows).', 'error')
    setSaving('hours')
    const supabase = getBrowserSupabase()
    const del = await supabase.from('opening_hours').delete().gte('day_of_week', 0)
    const ins = hours.length ? await supabase.from('opening_hours').insert(hours) : { error: null }
    setSaving(null)
    const error = del.error ?? ins.error
    toast(error ? error.message : 'Opening hours saved', error ? 'error' : 'success')
    load()
  }

  async function addClosed() {
    if (!newClosed.date) return
    const { error } = await getBrowserSupabase().from('closed_dates').upsert({ closed_on: newClosed.date, reason: newClosed.reason || null })
    if (error) return toast(error.message, 'error')
    setNewClosed({ date: '', reason: '' })
    load()
  }

  if (!s) return <Skeleton className="h-96 max-w-3xl" />
  const set = (patch: Partial<StoreSettings>) => setS({ ...s, ...patch })

  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle title="Hours & settings" description="Changes are recorded in the audit log." />

      <section className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-line">
        <h2 className="font-sans text-base font-semibold">Taking orders</h2>
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-4">
          <span>
            <strong>Accepting orders</strong>
            <span className="block text-xs text-muted">Turn off to pause all new orders (e.g. kitchen overloaded, power cut).</span>
          </span>
          <Toggle on={s.accepting_orders} onChange={(v) => set({ accepting_orders: v })} label="Accepting orders" />
        </label>
        {!s.accepting_orders && (
          <Field label="Message shown to customers while paused" htmlFor="pause">
            <Input id="pause" value={s.pause_message ?? ''} onChange={(e) => set({ pause_message: e.target.value })} placeholder="We’re fully booked tonight — back tomorrow at 10 am!" />
          </Field>
        )}
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">Delivery <Toggle on={s.delivery_enabled} onChange={(v) => set({ delivery_enabled: v })} label="Delivery enabled" /></label>
          <label className="flex items-center gap-2">Pickup <Toggle on={s.pickup_enabled} onChange={(v) => set({ pickup_enabled: v })} label="Pickup enabled" /></label>
          <label className="flex items-center gap-2">Scheduled orders <Toggle on={s.scheduling_enabled} onChange={(v) => set({ scheduling_enabled: v })} label="Scheduling enabled" /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default prep time (min)" htmlFor="prep"><Input id="prep" type="number" min={5} max={240} value={s.default_prep_minutes} onChange={(e) => set({ default_prep_minutes: Number(e.target.value) })} /></Field>
          <Field label="Last order before closing (min)" htmlFor="last"><Input id="last" type="number" min={0} max={180} value={s.last_order_minutes_before_close} onChange={(e) => set({ last_order_minutes_before_close: Number(e.target.value) })} /></Field>
          <Field label="Schedule up to (days ahead)" htmlFor="days"><Input id="days" type="number" min={0} max={14} value={s.schedule_days_ahead} onChange={(e) => set({ schedule_days_ahead: Number(e.target.value) })} /></Field>
          <Field label="Scheduled orders need at least (min notice)" htmlFor="lead"><Input id="lead" type="number" min={15} max={1440} value={s.min_schedule_lead_minutes} onChange={(e) => set({ min_schedule_lead_minutes: Number(e.target.value) })} /></Field>
          <Field label="Time slot length" htmlFor="slot">
            <Select id="slot" value={s.slot_minutes} onChange={(e) => set({ slot_minutes: Number(e.target.value) })}>
              {[15, 20, 30, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </Select>
          </Field>
          <Field label="Cancel unpaid orders after (min)" htmlFor="timeout"><Input id="timeout" type="number" min={10} max={1440} value={s.payment_timeout_minutes} onChange={(e) => set({ payment_timeout_minutes: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Pickup address (shown to customers)" htmlFor="pickup"><Textarea id="pickup" rows={2} value={s.pickup_address} onChange={(e) => set({ pickup_address: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Support phone" htmlFor="sup"><Input id="sup" type="tel" value={s.support_phone ?? ''} onChange={(e) => set({ support_phone: e.target.value })} /></Field>
          <Field label="WhatsApp number" htmlFor="wa"><Input id="wa" type="tel" value={s.whatsapp_number ?? ''} onChange={(e) => set({ whatsapp_number: e.target.value })} /></Field>
        </div>
        <Button loading={saving === 'settings'} onClick={saveSettings}>Save settings</Button>
      </section>

      <section className="space-y-3 rounded-3xl bg-surface p-5 ring-1 ring-line">
        <h2 className="font-sans text-base font-semibold">Opening hours (Accra time)</h2>
        <p className="text-xs text-muted">Add two windows on a day for a split shift. Leave a day empty to stay closed.</p>
        {hours.map((h, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Select aria-label="Day" value={h.day_of_week} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, day_of_week: Number(e.target.value) } : x)))} className="w-40">
              {DAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}
            </Select>
            <Input aria-label="Opens" type="time" value={h.opens_at} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, opens_at: e.target.value } : x)))} className="w-32" />
            –
            <Input aria-label="Closes" type="time" value={h.closes_at} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, closes_at: e.target.value } : x)))} className="w-32" />
            <button type="button" onClick={() => setHours(hours.filter((_, j) => j !== i))} className="grid size-10 place-items-center rounded-lg hover:bg-black/5" aria-label="Remove window">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setHours([...hours, { day_of_week: 1, opens_at: '10:00', closes_at: '21:30' }])}>
            <Plus className="size-4" aria-hidden /> Add window
          </Button>
          <Button size="sm" loading={saving === 'hours'} onClick={saveHours}>Save hours</Button>
        </div>
      </section>

      <section className="space-y-3 rounded-3xl bg-surface p-5 ring-1 ring-line">
        <h2 className="font-sans text-base font-semibold">Closed days (public holidays, events)</h2>
        <ul className="space-y-1 text-sm">
          {closed.map((c) => (
            <li key={c.closed_on} className="flex items-center justify-between gap-2">
              <span>{c.closed_on}{c.reason && ` — ${c.reason}`}</span>
              <button
                type="button"
                className="grid size-9 place-items-center rounded-lg hover:bg-black/5"
                aria-label={`Remove ${c.closed_on}`}
                onClick={async () => {
                  await getBrowserSupabase().from('closed_dates').delete().eq('closed_on', c.closed_on)
                  load()
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Input type="date" aria-label="Closed date" min={accraDateKey()} value={newClosed.date} onChange={(e) => setNewClosed({ ...newClosed, date: e.target.value })} className="w-44" />
          <Input aria-label="Reason" placeholder="Reason (optional)" value={newClosed.reason} onChange={(e) => setNewClosed({ ...newClosed, reason: e.target.value })} className="min-w-40 flex-1" />
          <Button variant="secondary" onClick={addClosed}>Add</Button>
        </div>
      </section>
    </div>
  )
}
