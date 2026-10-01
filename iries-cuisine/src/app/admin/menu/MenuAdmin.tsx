'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Pencil } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { fetchMenu } from '@/lib/menu'
import type { Category } from '@/lib/types'
import { PageTitle } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { ItemArt } from '@/components/menu/ItemArt'
import { Toggle } from '@/components/ui/Toggle'
import { formatCedis, parseCedisToPesewas } from '@/lib/money'
import { slugify } from '@/lib/slug'

export function MenuAdmin() {
  const toast = useToast()
  const router = useRouter()
  const [menu, setMenu] = useState<Category[] | null>(null)
  const [catDialog, setCatDialog] = useState<null | { id?: string; name: string; description: string; sort_order: number }>(null)
  const [itemDialog, setItemDialog] = useState<null | { categoryId: string; name: string; price: string }>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => fetchMenu(getBrowserSupabase(), { includeInactive: true }).then(setMenu), [])
  useEffect(() => {
    load()
  }, [load])

  async function saveCategory() {
    if (!catDialog || catDialog.name.trim().length < 2) return
    setBusy(true)
    const supabase = getBrowserSupabase()
    const row = { name: catDialog.name.trim(), description: catDialog.description.trim() || null, sort_order: catDialog.sort_order }
    const { error } = catDialog.id
      ? await supabase.from('categories').update(row).eq('id', catDialog.id)
      : await supabase.from('categories').insert({ ...row, slug: `${slugify(row.name)}-${Math.random().toString(36).slice(2, 5)}` })
    setBusy(false)
    if (error) return toast(error.message, 'error')
    setCatDialog(null)
    load()
  }

  async function createItem() {
    if (!itemDialog) return
    const price = parseCedisToPesewas(itemDialog.price)
    if (itemDialog.name.trim().length < 2 || price === null) return toast('Enter a name and a price like 85 or 85.50', 'error')
    setBusy(true)
    const supabase = getBrowserSupabase()
    const { data: item, error } = await supabase
      .from('menu_items')
      .insert({ category_id: itemDialog.categoryId, name: itemDialog.name.trim(), slug: `${slugify(itemDialog.name)}-${Math.random().toString(36).slice(2, 5)}`, is_active: false })
      .select('id')
      .single()
    if (error || !item) {
      setBusy(false)
      return toast(error?.message ?? 'Could not create', 'error')
    }
    await supabase.from('menu_item_portions').insert({ menu_item_id: item.id, name: 'Regular', price_pesewas: price, is_default: true })
    setBusy(false)
    router.push(`/admin/menu/${item.id}`)
  }

  async function setFlag(table: 'categories' | 'menu_items', id: string, patch: Record<string, boolean>) {
    const { error } = await getBrowserSupabase().from(table).update(patch).eq('id', id)
    if (error) toast(error.message, 'error')
    load()
  }

  return (
    <div className="max-w-5xl">
      <PageTitle
        title="Menu"
        description="New dishes start hidden — add a photo and portions, then switch “On menu” on. Price changes are recorded in the audit log."
        actions={
          <Button onClick={() => setCatDialog({ name: '', description: '', sort_order: (menu?.length ?? 0) + 1 })}>
            <Plus className="size-4" aria-hidden /> Category
          </Button>
        }
      />
      {!menu ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="space-y-6">
          {menu.map((c) => (
            <section key={c.id} className="rounded-3xl bg-surface p-4 ring-1 ring-line">
              <header className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-2xl font-semibold">{c.name}</h2>
                {!c.is_active && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold">Hidden</span>}
                <button type="button" onClick={() => setCatDialog({ id: c.id, name: c.name, description: c.description ?? '', sort_order: c.sort_order })} className="grid size-9 place-items-center rounded-lg hover:bg-black/5" aria-label={`Edit ${c.name}`}>
                  <Pencil className="size-4" />
                </button>
                <span className="ml-auto flex items-center gap-2 text-sm">
                  Visible <Toggle on={c.is_active} onChange={(v) => setFlag('categories', c.id, { is_active: v })} label={`${c.name} visible`} />
                </span>
              </header>
              <ul className="mt-3 divide-y divide-line">
                {c.items.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <ItemArt name={i.name} imagePath={i.image_path} className="size-12 rounded-lg" sizes="48px" />
                    <Link href={`/admin/menu/${i.id}`} className="min-w-40 flex-1">
                      <span className="font-semibold underline-offset-2 hover:underline">{i.name}</span>
                      <span className="block text-xs text-muted">
                        {i.portions.map((p) => `${p.name} ${formatCedis(p.price_pesewas)}`).join(' · ') || 'No portions yet'}
                      </span>
                    </Link>
                    <span className="flex items-center gap-2 text-xs">
                      On menu <Toggle on={i.is_active} onChange={(v) => setFlag('menu_items', i.id, { is_active: v })} label={`${i.name} on menu`} />
                    </span>
                    <span className="flex items-center gap-2 text-xs">
                      In stock <Toggle on={i.is_available} onChange={(v) => setFlag('menu_items', i.id, { is_available: v })} label={`${i.name} in stock`} />
                    </span>
                  </li>
                ))}
              </ul>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => setItemDialog({ categoryId: c.id, name: '', price: '' })}>
                <Plus className="size-4" aria-hidden /> Add dish
              </Button>
            </section>
          ))}
        </div>
      )}

      {catDialog && (
        <Dialog open onClose={() => setCatDialog(null)} title={catDialog.id ? 'Edit category' : 'New category'} footer={<Button block size="lg" loading={busy} onClick={saveCategory}>Save</Button>}>
          <div className="space-y-4">
            <Field label="Name" htmlFor="cat-name"><Input id="cat-name" value={catDialog.name} onChange={(e) => setCatDialog({ ...catDialog, name: e.target.value })} /></Field>
            <Field label="Description" htmlFor="cat-desc"><Textarea id="cat-desc" rows={2} value={catDialog.description} onChange={(e) => setCatDialog({ ...catDialog, description: e.target.value })} /></Field>
            <Field label="Position (1 = first)" htmlFor="cat-sort"><Input id="cat-sort" type="number" value={catDialog.sort_order} onChange={(e) => setCatDialog({ ...catDialog, sort_order: Number(e.target.value) })} /></Field>
          </div>
        </Dialog>
      )}
      {itemDialog && (
        <Dialog open onClose={() => setItemDialog(null)} title="New dish" footer={<Button block size="lg" loading={busy} onClick={createItem}>Create and edit details</Button>}>
          <div className="space-y-4">
            <Field label="Dish name" htmlFor="item-name"><Input id="item-name" value={itemDialog.name} onChange={(e) => setItemDialog({ ...itemDialog, name: e.target.value })} /></Field>
            <Field label="Price (GH₵) for the regular portion" htmlFor="item-price"><Input id="item-price" inputMode="decimal" value={itemDialog.price} onChange={(e) => setItemDialog({ ...itemDialog, price: e.target.value })} placeholder="85.00" /></Field>
          </div>
        </Dialog>
      )}
    </div>
  )
}
