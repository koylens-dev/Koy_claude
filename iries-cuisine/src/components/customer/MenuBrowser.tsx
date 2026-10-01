'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Search, Flame, X } from 'lucide-react'
import type { Category, MenuItem } from '@/lib/types'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { formatCedis } from '@/lib/money'
import { cn } from '@/lib/cn'
import { ItemArt } from '@/components/menu/ItemArt'
import { ItemDialog } from '@/components/menu/ItemDialog'
import type { ItemSelection } from '@/components/menu/ItemOptions'
import { useCart } from './CartProvider'
import { useToast } from '@/components/ui/Toast'

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function MenuBrowser({ categories: initial }: { categories: Category[] }) {
  const [categories, setCategories] = useState(initial)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<MenuItem | null>(null)
  const [activeCat, setActiveCat] = useState(initial[0]?.slug ?? '')
  const cart = useCart()
  const toast = useToast()
  const chipsRef = useRef<HTMLDivElement>(null)

  // Live "sold out" badges: patch availability as staff toggle it.
  useEffect(() => {
    const supabase = getBrowserSupabase()
    const channel = supabase
      .channel('menu-availability')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'menu_items' }, (payload) => {
        const row = payload.new as { id: string; is_available: boolean; is_active: boolean }
        setCategories((cats) =>
          cats.map((c) => ({
            ...c,
            items: c.items
              .map((i) => (i.id === row.id ? { ...i, is_available: row.is_available, is_active: row.is_active } : i))
              .filter((i) => i.is_active),
          })),
        )
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'modifier_options' }, (payload) => {
        const row = payload.new as { id: string; is_available: boolean }
        setCategories((cats) =>
          cats.map((c) => ({
            ...c,
            items: c.items.map((i) => ({
              ...i,
              modifier_groups: i.modifier_groups.map((g) => ({
                ...g,
                options: g.options.map((o) => (o.id === row.id ? { ...o, is_available: row.is_available } : o)),
              })),
            })),
          })),
        )
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Keep the open dialog in sync with live availability.
  const openItem = useMemo(() => {
    if (!open) return null
    for (const c of categories) for (const i of c.items) if (i.id === open.id) return i
    return open
  }, [open, categories])

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return categories
    return categories
      .map((c) => ({ ...c, items: c.items.filter((i) => normalize(`${i.name} ${i.description ?? ''} ${c.name}`).includes(q)) }))
      .filter((c) => c.items.length > 0)
  }, [categories, query])

  // Highlight the category chip for the section on screen.
  useEffect(() => {
    if (query) return
    const sections = document.querySelectorAll<HTMLElement>('[data-category]')
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActiveCat((visible.target as HTMLElement).dataset.category ?? '')
      },
      { rootMargin: '-140px 0px -60% 0px' },
    )
    sections.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [filtered, query])

  useEffect(() => {
    chipsRef.current?.querySelector(`[data-chip="${activeCat}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [activeCat])

  const addToCart = (item: MenuItem, sel: ItemSelection) => {
    cart.add({
      itemId: item.id,
      slug: item.slug,
      name: item.name,
      imagePath: item.image_path,
      portionId: sel.portionId,
      portionName: sel.portionName,
      portionPrice: sel.portionPrice,
      options: sel.options,
      quantity: sel.quantity,
      notes: sel.notes,
    })
    setOpen(null)
    toast(`Added ${sel.quantity} × ${item.name}`, 'success')
  }

  return (
    <div>
      <div className="sticky top-[60px] z-20 -mx-4 border-b border-line bg-cream/95 px-4 pb-2 pt-3 backdrop-blur sm:top-[68px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jollof, waakye, tilapia…"
            aria-label="Search the menu"
            className="block min-h-11 w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-10 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full hover:bg-black/5" aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
        </div>
        {!query && (
          <nav ref={chipsRef} aria-label="Menu categories" className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {categories.map((c) => (
              <a
                key={c.id}
                href={`#${c.slug}`}
                data-chip={c.slug}
                className={cn(
                  'shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset transition-colors',
                  activeCat === c.slug ? 'bg-ink text-white ring-ink' : 'bg-surface text-ink ring-line hover:bg-brand-soft/50',
                )}
              >
                {c.name}
              </a>
            ))}
          </nav>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="py-16 text-center text-muted">
          Nothing matches “{query}”. Try another dish, or <Link href="/catering" className="font-semibold text-brand underline">ask us about catering</Link>.
        </p>
      )}

      {filtered.map((c) => (
        <section key={c.id} id={c.slug} data-category={c.slug} className="scroll-mt-40 pt-8">
          <h2 className="font-display text-3xl font-semibold">{c.name}</h2>
          {c.description && <p className="mt-1 text-sm text-muted">{c.description}</p>}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {c.items.map((item, index) => (
              <li key={item.id}>
                <MenuCard item={item} priority={c === filtered[0] && index < 2} onOpen={() => setOpen(item)} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {openItem && <ItemDialog item={openItem} onClose={() => setOpen(null)} onAdd={addToCart} />}
    </div>
  )
}

function MenuCard({ item, onOpen, priority }: { item: MenuItem; onOpen: () => void; priority?: boolean }) {
  const from = Math.min(...item.portions.map((p) => p.price_pesewas))
  const multiple = item.portions.length > 1
  const soldOut = !item.is_available
  const spicy = item.modifier_groups.some((g) => g.kind === 'spice')
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group flex w-full gap-3 rounded-2xl bg-surface p-3 text-left shadow-sm ring-1 ring-line transition hover:shadow-md sm:flex-col sm:p-0',
        soldOut && 'opacity-70',
      )}
      aria-label={`${item.name}, ${multiple ? 'from ' : ''}${formatCedis(from)}${soldOut ? ', sold out' : ''}`}
    >
      <div className="relative size-28 shrink-0 sm:size-auto">
        <ItemArt name={item.name} imagePath={item.image_path} priority={priority} className="size-28 rounded-xl sm:aspect-[4/3] sm:size-auto sm:w-full sm:rounded-b-none sm:rounded-t-2xl" />
        {soldOut && (
          <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/45 text-sm font-bold uppercase tracking-wider text-white sm:rounded-b-none sm:rounded-t-2xl">
            Sold out
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col sm:px-4 sm:pb-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-sans text-base font-semibold leading-snug">{item.name}</h3>
          {item.is_featured && <span className="shrink-0 rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink">Chef’s pick</span>}
        </div>
        {item.description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{item.description}</p>}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-semibold">
            {multiple && <span className="text-xs font-medium text-muted">from </span>}
            {formatCedis(from)}
          </span>
          {spicy && (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Flame className="size-3.5 text-brand" aria-hidden /> spice level
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
