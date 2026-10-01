'use client'

import { useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { MenuItem } from '@/lib/types'
import { formatCedis } from '@/lib/money'
import { cn } from '@/lib/cn'
import type { CartOption } from '@/components/customer/CartProvider'

export type ItemSelection = {
  portionId: string
  portionName: string
  portionPrice: number
  options: CartOption[]
  quantity: number
  notes: string
}

function defaultSelection(item: MenuItem): Record<string, string[]> {
  const sel: Record<string, string[]> = {}
  for (const g of item.modifier_groups) {
    const defaults = g.options.filter((o) => o.is_default && o.is_available).map((o) => o.id)
    if (defaults.length) sel[g.id] = defaults.slice(0, g.max_select)
    else if (g.min_select > 0 && g.max_select === 1) {
      const first = g.options.find((o) => o.is_available)
      if (first) sel[g.id] = [first.id]
    } else sel[g.id] = []
  }
  return sel
}

/** Portion, extras, spice level, quantity and notes for one dish. Shared by the customer menu and staff order entry. */
export function useItemOptions(item: MenuItem) {
  const defaultPortion = item.portions.find((p) => p.is_default) ?? item.portions[0]
  const [portionId, setPortionId] = useState(defaultPortion?.id ?? '')
  const [chosen, setChosen] = useState<Record<string, string[]>>(() => defaultSelection(item))
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  const portion = item.portions.find((p) => p.id === portionId) ?? defaultPortion
  const options: CartOption[] = useMemo(
    () =>
      item.modifier_groups.flatMap((g) =>
        g.options
          .filter((o) => (chosen[g.id] ?? []).includes(o.id))
          .map((o) => ({ id: o.id, groupName: g.name, name: o.name, price: o.price_pesewas })),
      ),
    [item.modifier_groups, chosen],
  )
  const missing = item.modifier_groups.filter((g) => (chosen[g.id]?.length ?? 0) < g.min_select)
  const unit = (portion?.price_pesewas ?? 0) + options.reduce((s, o) => s + o.price, 0)

  const toggle = (groupId: string, optionId: string, max: number) =>
    setChosen((prev) => {
      const current = prev[groupId] ?? []
      if (max === 1) return { ...prev, [groupId]: [optionId] }
      if (current.includes(optionId)) return { ...prev, [groupId]: current.filter((id) => id !== optionId) }
      if (current.length >= max) return prev
      return { ...prev, [groupId]: [...current, optionId] }
    })

  const selection: ItemSelection | null = portion
    ? { portionId: portion.id, portionName: portion.name, portionPrice: portion.price_pesewas, options, quantity, notes }
    : null

  return { portion, portionId, setPortionId, chosen, toggle, quantity, setQuantity, notes, setNotes, missing, unit, selection }
}

export function ItemOptionsForm({ item, state }: { item: MenuItem; state: ReturnType<typeof useItemOptions> }) {
  const { portionId, setPortionId, chosen, toggle, quantity, setQuantity, notes, setNotes } = state

  return (
    <div className="space-y-6">
      {item.portions.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Portion</legend>
          <div className="grid gap-2">
            {item.portions.map((p) => (
              <label
                key={p.id}
                className={cn(
                  'flex min-h-12 cursor-pointer items-center justify-between rounded-xl border px-4 py-2.5',
                  portionId === p.id ? 'border-brand bg-brand-soft/60 ring-1 ring-brand' : 'border-line',
                )}
              >
                <span className="flex items-center gap-3">
                  <input type="radio" name="portion" className="size-4 accent-[var(--brand)]" checked={portionId === p.id} onChange={() => setPortionId(p.id)} />
                  <span className="font-medium">{p.name}</span>
                </span>
                <span className="font-semibold">{formatCedis(p.price_pesewas)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {item.modifier_groups.map((g) => {
        const picked = chosen[g.id] ?? []
        const single = g.max_select === 1
        return (
          <fieldset key={g.id}>
            <legend className="mb-2 flex w-full items-baseline justify-between gap-2">
              <span className="text-sm font-bold uppercase tracking-wide text-muted">{g.name}</span>
              <span className="text-xs text-muted">
                {g.min_select > 0 ? 'Required' : 'Optional'}
                {!single && ` · up to ${g.max_select}`}
              </span>
            </legend>
            <div className={cn('grid gap-2', g.kind === 'spice' && 'grid-cols-2')}>
              {g.options.map((o) => {
                const on = picked.includes(o.id)
                const disabled = !o.is_available || (!single && !on && picked.length >= g.max_select)
                return (
                  <label
                    key={o.id}
                    className={cn(
                      'flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-2.5',
                      on ? 'border-brand bg-brand-soft/60 ring-1 ring-brand' : 'border-line',
                      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type={single ? 'radio' : 'checkbox'}
                        name={`group-${g.id}`}
                        className="size-4 accent-[var(--brand)]"
                        checked={on}
                        disabled={disabled}
                        onChange={() => toggle(g.id, o.id, g.max_select)}
                      />
                      <span className="text-sm font-medium">
                        {o.name}
                        {!o.is_available && <span className="ml-1 text-xs text-danger">(sold out)</span>}
                      </span>
                    </span>
                    {o.price_pesewas > 0 && <span className="text-sm text-muted">+{formatCedis(o.price_pesewas)}</span>}
                  </label>
                )
              })}
            </div>
          </fieldset>
        )
      })}

      <div>
        <label htmlFor={`notes-${item.id}`} className="mb-2 block text-sm font-bold uppercase tracking-wide text-muted">
          Notes for the kitchen <span className="font-normal normal-case">(optional)</span>
        </label>
        <input
          id={`notes-${item.id}`}
          value={notes}
          maxLength={200}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. no onions, pepper on the side"
          className="block min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-bold uppercase tracking-wide text-muted">Quantity</span>
        <Stepper value={quantity} onChange={setQuantity} />
      </div>
    </div>
  )
}

export function Stepper({ value, onChange, min = 1, max = 50, label = 'quantity' }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label?: string }) {
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-surface">
      <button
        type="button"
        className="grid size-11 place-items-center rounded-full hover:bg-black/5 disabled:opacity-40"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Decrease ${label}`}
      >
        <Minus className="size-4" />
      </button>
      <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="grid size-11 place-items-center rounded-full hover:bg-black/5 disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}
