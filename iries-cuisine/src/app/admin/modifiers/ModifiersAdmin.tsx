'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { PageTitle } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import { parseCedisToPesewas, pesewasToDecimalString } from '@/lib/money'

type Option = { id?: string; name: string; price: string; is_available: boolean; is_default: boolean }
type Group = { id?: string; name: string; kind: 'addon' | 'spice' | 'choice'; min_select: number; max_select: number; options: Option[]; removed: string[] }

export function ModifiersAdmin() {
  const toast = useToast()
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [saving, setSaving] = useState<number | null>(null)

  const load = useCallback(
    () =>
      getBrowserSupabase()
        .from('modifier_groups')
        .select('id, name, kind, min_select, max_select, sort_order, modifier_options(id, name, price_pesewas, is_available, is_default, sort_order)')
        .order('sort_order')
        .then(({ data }) => setGroups(
      (data ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        kind: g.kind,
        min_select: g.min_select,
        max_select: g.max_select,
        removed: [],
        options: [...(g.modifier_options as { id: string; name: string; price_pesewas: number; is_available: boolean; is_default: boolean; sort_order: number }[])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((o) => ({ id: o.id, name: o.name, price: pesewasToDecimalString(o.price_pesewas), is_available: o.is_available, is_default: o.is_default })),
      })),
    )),
    [],
  )
  useEffect(() => {
    load()
  }, [load])

  const update = (gi: number, patch: Partial<Group>) => setGroups((gs) => gs && gs.map((g, i) => (i === gi ? { ...g, ...patch } : g)))
  const updateOption = (gi: number, oi: number, patch: Partial<Option>) =>
    setGroups((gs) => gs && gs.map((g, i) => (i === gi ? { ...g, options: g.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : g)))

  async function save(gi: number) {
    const g = groups![gi]
    if (g.name.trim().length < 2) return toast('Group name is too short', 'error')
    if (g.max_select < Math.max(1, g.min_select)) return toast('“Up to” must be at least the minimum (and at least 1)', 'error')
    const opts = g.options.map((o) => ({ ...o, pesewas: parseCedisToPesewas(o.price || '0') }))
    if (opts.some((o) => !o.name.trim() || o.pesewas === null)) return toast('Every option needs a name and a valid price (0 for free)', 'error')
    setSaving(gi)
    const fail = (message: string) => {
      setSaving(null)
      toast(message, 'error')
    }
    const supabase = getBrowserSupabase()
    const row = { name: g.name.trim(), kind: g.kind, min_select: g.min_select, max_select: g.max_select, sort_order: gi }
    let groupId = g.id
    if (groupId) {
      const { error } = await supabase.from('modifier_groups').update(row).eq('id', groupId)
      if (error) return fail(error.message)
    } else {
      const { data, error } = await supabase.from('modifier_groups').insert(row).select('id').single()
      if (error || !data) return fail(error?.message ?? 'Failed')
      groupId = data.id
    }
    if (g.removed.length) await supabase.from('modifier_options').delete().in('id', g.removed)
    for (const [i, o] of opts.entries()) {
      const r = { group_id: groupId, name: o.name.trim(), price_pesewas: o.pesewas!, is_available: o.is_available, is_default: o.is_default, sort_order: i }
      const res = o.id ? await supabase.from('modifier_options').update(r).eq('id', o.id) : await supabase.from('modifier_options').insert(r)
      if (res.error) return fail(res.error.message)
    }
    setSaving(null)
    toast('Saved', 'success')
    load()
  }

  if (!groups) return <Skeleton className="h-96 max-w-3xl" />

  return (
    <div className="max-w-3xl">
      <PageTitle
        title="Extras & spice"
        description="Groups of options attached to dishes: spice level (choose 1), extra protein, sides… Attach groups to dishes in the dish editor."
        actions={
          <Button onClick={() => setGroups([...groups, { name: '', kind: 'addon', min_select: 0, max_select: 3, options: [], removed: [] }])}>
            <Plus className="size-4" aria-hidden /> Group
          </Button>
        }
      />
      <div className="space-y-6">
        {groups.map((g, gi) => (
          <section key={g.id ?? `new-${gi}`} className="space-y-3 rounded-3xl bg-surface p-5 ring-1 ring-line">
            <div className="grid gap-2 sm:grid-cols-[1fr_140px_90px_90px]">
              <Input aria-label="Group name" value={g.name} onChange={(e) => update(gi, { name: e.target.value })} placeholder="Extra protein" />
              <Select aria-label="Type" value={g.kind} onChange={(e) => update(gi, { kind: e.target.value as Group['kind'] })}>
                <option value="addon">Add-ons</option>
                <option value="spice">Spice level</option>
                <option value="choice">Choice</option>
              </Select>
              <Input aria-label="Minimum to choose" type="number" min={0} value={g.min_select} onChange={(e) => update(gi, { min_select: Number(e.target.value) })} title="Minimum (0 = optional)" />
              <Input aria-label="Maximum to choose" type="number" min={1} value={g.max_select} onChange={(e) => update(gi, { max_select: Number(e.target.value) })} title="Up to" />
            </div>
            <p className="text-xs text-muted">Min {g.min_select} (0 = optional) · up to {g.max_select}</p>
            <ul className="space-y-2">
              {g.options.map((o, oi) => (
                <li key={o.id ?? `o-${oi}`} className="flex flex-wrap items-center gap-2">
                  <Input aria-label="Option name" value={o.name} onChange={(e) => updateOption(gi, oi, { name: e.target.value })} className="min-w-32 flex-1" />
                  <Input aria-label="Extra price" inputMode="decimal" value={o.price} onChange={(e) => updateOption(gi, oi, { price: e.target.value })} className="w-24" placeholder="0.00" />
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={o.is_default} onChange={(e) => updateOption(gi, oi, { is_default: e.target.checked })} /> default
                  </label>
                  <Toggle on={o.is_available} onChange={(v) => updateOption(gi, oi, { is_available: v })} label={`${o.name} in stock`} />
                  <button
                    type="button"
                    className="grid size-10 place-items-center rounded-lg hover:bg-black/5"
                    aria-label={`Remove ${o.name}`}
                    onClick={() => update(gi, { options: g.options.filter((_, j) => j !== oi), removed: o.id ? [...g.removed, o.id] : g.removed })}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-between">
              <Button variant="secondary" size="sm" onClick={() => update(gi, { options: [...g.options, { name: '', price: '0', is_available: true, is_default: false }] })}>
                <Plus className="size-4" aria-hidden /> Option
              </Button>
              <Button size="sm" loading={saving === gi} onClick={() => save(gi)}>Save group</Button>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
