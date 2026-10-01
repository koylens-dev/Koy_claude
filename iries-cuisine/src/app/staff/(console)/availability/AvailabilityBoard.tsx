'use client'

import { useEffect, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { fetchMenu } from '@/lib/menu'
import type { Category } from '@/lib/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { Toggle } from '@/components/ui/Toggle'

export function AvailabilityBoard() {
  const toast = useToast()
  const [menu, setMenu] = useState<Category[] | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    fetchMenu(getBrowserSupabase()).then(setMenu)
  }, [])

  async function setItem(id: string, available: boolean) {
    setPending(id)
    const { error } = await getBrowserSupabase().rpc('set_item_availability', { p_item_id: id, p_available: available })
    setPending(null)
    if (error) return toast('Could not update — check your connection.', 'error')
    setMenu((m) => m && m.map((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? { ...i, is_available: available } : i)) })))
  }

  async function setOption(id: string, available: boolean) {
    setPending(id)
    const { error } = await getBrowserSupabase().rpc('set_option_availability', { p_option_id: id, p_available: available })
    setPending(null)
    if (error) return toast('Could not update — check your connection.', 'error')
    setMenu((m) =>
      m &&
      m.map((c) => ({
        ...c,
        items: c.items.map((i) => ({ ...i, modifier_groups: i.modifier_groups.map((g) => ({ ...g, options: g.options.map((o) => (o.id === id ? { ...o, is_available: available } : o)) })) })),
      })),
    )
  }

  if (!menu) return <Skeleton className="h-96" />

  const options = new Map<string, { id: string; name: string; group: string; is_available: boolean }>()
  for (const c of menu) for (const i of c.items) for (const g of i.modifier_groups) if (g.kind !== 'spice') for (const o of g.options) options.set(o.id, { id: o.id, name: o.name, group: g.name, is_available: o.is_available })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {menu.map((c) => (
        <section key={c.id} className="rounded-3xl bg-surface p-4 ring-1 ring-line">
          <h2 className="font-display text-2xl font-semibold">{c.name}</h2>
          <ul className="mt-2 divide-y divide-line">
            {c.items.map((i) => (
              <li key={i.id} className="flex min-h-14 items-center justify-between gap-3">
                <span className={cn('font-medium', !i.is_available && 'text-muted line-through')}>{i.name}</span>
                <Toggle on={i.is_available} disabled={pending === i.id} onChange={(v) => setItem(i.id, v)} label={`${i.name} available`} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="rounded-3xl bg-surface p-4 ring-1 ring-line">
        <h2 className="font-display text-2xl font-semibold">Extras & sides</h2>
        <ul className="mt-2 divide-y divide-line">
          {[...options.values()].map((o) => (
            <li key={o.id} className="flex min-h-14 items-center justify-between gap-3">
              <span className={cn(!o.is_available && 'text-muted line-through')}>
                {o.name} <span className="text-xs text-muted">({o.group})</span>
              </span>
              <Toggle on={o.is_available} disabled={pending === o.id} onChange={(v) => setOption(o.id, v)} label={`${o.name} available`} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
