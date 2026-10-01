'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { PageTitle } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import { parseCedisToPesewas, pesewasToDecimalString } from '@/lib/money'

type Zone = { id?: string; name: string; areas: string; fee: string; min: string; eta: number; is_active: boolean }

export function ZonesAdmin() {
  const toast = useToast()
  const [zones, setZones] = useState<Zone[] | null>(null)
  const [saving, setSaving] = useState<number | null>(null)

  const load = useCallback(
    () =>
      getBrowserSupabase()
        .from('delivery_zones')
        .select('*')
        .order('sort_order')
        .then(({ data }) =>
          setZones(
            (data ?? []).map((z) => ({ id: z.id, name: z.name, areas: z.areas ?? '', fee: pesewasToDecimalString(z.fee_pesewas), min: pesewasToDecimalString(z.min_order_pesewas), eta: z.eta_minutes, is_active: z.is_active })),
          ),
        ),
    [],
  )
  useEffect(() => {
    load()
  }, [load])

  async function save(i: number) {
    const z = zones![i]
    const fee = parseCedisToPesewas(z.fee)
    const min = parseCedisToPesewas(z.min || '0')
    if (z.name.trim().length < 2 || fee === null || min === null) return toast('Enter a name, fee and minimum order in cedis', 'error')
    setSaving(i)
    const row = { name: z.name.trim(), areas: z.areas.trim() || null, fee_pesewas: fee, min_order_pesewas: min, eta_minutes: z.eta, is_active: z.is_active, sort_order: i }
    const supabase = getBrowserSupabase()
    const { error } = z.id ? await supabase.from('delivery_zones').update(row).eq('id', z.id) : await supabase.from('delivery_zones').insert(row)
    setSaving(null)
    if (error) return toast(error.message, 'error')
    toast('Zone saved (fee changes are recorded in the audit log)', 'success')
    load()
  }

  const update = (i: number, patch: Partial<Zone>) => setZones((zs) => zs && zs.map((z, j) => (j === i ? { ...z, ...patch } : z)))

  if (!zones) return <Skeleton className="h-96 max-w-3xl" />
  return (
    <div className="max-w-3xl">
      <PageTitle
        title="Delivery zones"
        description="Customers pick their area at checkout. The fee is added to the order; the minimum applies to food only. Turn a zone off instead of deleting it."
        actions={<Button onClick={() => setZones([...zones, { name: '', areas: '', fee: '', min: '0', eta: 40, is_active: true }])}><Plus className="size-4" aria-hidden /> Zone</Button>}
      />
      <div className="space-y-4">
        {zones.map((z, i) => (
          <section key={z.id ?? `new-${i}`} className="grid gap-3 rounded-3xl bg-surface p-5 ring-1 ring-line sm:grid-cols-2">
            <Field label="Zone name" htmlFor={`z-name-${i}`}><Input id={`z-name-${i}`} value={z.name} onChange={(e) => update(i, { name: e.target.value })} /></Field>
            <Field label="Areas covered (shown to customers)" htmlFor={`z-areas-${i}`}><Input id={`z-areas-${i}`} value={z.areas} onChange={(e) => update(i, { areas: e.target.value })} /></Field>
            <Field label="Delivery fee (GH₵)" htmlFor={`z-fee-${i}`}><Input id={`z-fee-${i}`} inputMode="decimal" value={z.fee} onChange={(e) => update(i, { fee: e.target.value })} /></Field>
            <Field label="Minimum order (GH₵)" htmlFor={`z-min-${i}`}><Input id={`z-min-${i}`} inputMode="decimal" value={z.min} onChange={(e) => update(i, { min: e.target.value })} /></Field>
            <Field label="Ride time (minutes)" htmlFor={`z-eta-${i}`}><Input id={`z-eta-${i}`} type="number" min={5} max={240} value={z.eta} onChange={(e) => update(i, { eta: Number(e.target.value) })} /></Field>
            <div className="flex items-end justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">Active <Toggle on={z.is_active} onChange={(v) => update(i, { is_active: v })} label="Zone active" /></label>
              <Button loading={saving === i} onClick={() => save(i)}>Save</Button>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
