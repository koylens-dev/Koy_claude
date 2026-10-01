'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ImagePlus, Plus, Trash2, ExternalLink } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { PageTitle } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import { ItemArt } from '@/components/menu/ItemArt'
import { resizeImage } from '@/lib/image-resize'
import { parseCedisToPesewas, pesewasToDecimalString } from '@/lib/money'
import { slugify } from '@/lib/slug'

type Item = {
  id: string
  category_id: string
  name: string
  slug: string
  description: string | null
  image_path: string | null
  is_available: boolean
  is_active: boolean
  is_featured: boolean
  dietary_tags: string[]
  sort_order: number
}
type PortionRow = { id?: string; name: string; price: string; is_default: boolean; is_active: boolean; sort_order: number }
type Group = { id: string; name: string; kind: string }

export function ItemEditor({ id }: { id: string }) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [item, setItem] = useState<Item | null>(null)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [portions, setPortions] = useState<PortionRow[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [attached, setAttached] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(() => {
    const supabase = getBrowserSupabase()
    return Promise.all([
      supabase.from('menu_items').select('*').eq('id', id).single(),
      supabase.from('categories').select('id, name').order('sort_order'),
      supabase.from('menu_item_portions').select('*').eq('menu_item_id', id).eq('is_active', true).order('sort_order'),
      supabase.from('modifier_groups').select('id, name, kind').order('sort_order'),
      supabase.from('menu_item_modifier_groups').select('group_id, sort_order').eq('menu_item_id', id).order('sort_order'),
    ]).then(([i, c, p, g, l]) => {
    setItem(i.data as Item)
    setCategories(c.data ?? [])
    setPortions(
      (p.data ?? []).map((r) => ({ id: r.id, name: r.name, price: pesewasToDecimalString(r.price_pesewas), is_default: r.is_default, is_active: r.is_active, sort_order: r.sort_order })),
    )
    setRemoved([])
    setGroups((g.data ?? []) as Group[])
    setAttached((l.data ?? []).map((r) => r.group_id as string))
    })
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function save() {
    if (!item) return
    if (item.name.trim().length < 2) return toast('Name is too short', 'error')
    const parsed = portions.map((p) => ({ ...p, pesewas: parseCedisToPesewas(p.price) }))
    if (!parsed.length) return toast('Add at least one portion with a price', 'error')
    if (parsed.some((p) => p.pesewas === null || !p.name.trim())) return toast('Every portion needs a name and a valid price (e.g. 85 or 85.50)', 'error')
    if (!parsed.some((p) => p.is_default)) parsed[0].is_default = true

    setSaving(true)
    const supabase = getBrowserSupabase()
    const { error } = await supabase
      .from('menu_items')
      .update({
        name: item.name.trim(),
        slug: slugify(item.slug || item.name),
        description: item.description?.trim() || null,
        category_id: item.category_id,
        is_featured: item.is_featured,
        is_active: item.is_active,
        is_available: item.is_available,
        dietary_tags: item.dietary_tags,
        sort_order: item.sort_order,
      })
      .eq('id', item.id)
    if (error) {
      setSaving(false)
      return toast(error.message.includes('duplicate') ? 'That web address (slug) is already used by another dish.' : error.message, 'error')
    }

    // Portions: deactivate removed ones (keeps order history intact), upsert the rest.
    if (removed.length) await supabase.from('menu_item_portions').update({ is_active: false }).in('id', removed)
    for (const [index, p] of parsed.entries()) {
      const row = { menu_item_id: item.id, name: p.name.trim(), price_pesewas: p.pesewas!, is_default: p.is_default, is_active: p.is_active, sort_order: index }
      const res = p.id ? await supabase.from('menu_item_portions').update(row).eq('id', p.id) : await supabase.from('menu_item_portions').insert(row)
      if (res.error) {
        setSaving(false)
        return toast(res.error.message, 'error')
      }
    }

    // Extras / spice groups
    await supabase.from('menu_item_modifier_groups').delete().eq('menu_item_id', item.id)
    if (attached.length) {
      await supabase.from('menu_item_modifier_groups').insert(attached.map((group_id, i) => ({ menu_item_id: item.id, group_id, sort_order: i })))
    }

    setSaving(false)
    toast('Saved. The public menu refreshes within a minute.', 'success')
    load()
  }

  async function upload(file: File) {
    if (!item) return
    if (!file.type.startsWith('image/')) return toast('Choose a photo', 'error')
    setUploading(true)
    try {
      const blob = await resizeImage(file)
      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `items/${item.id}-${Date.now()}.${ext}`
      const supabase = getBrowserSupabase()
      const { error } = await supabase.storage.from('menu').upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false })
      if (error) throw error
      const old = item.image_path
      await supabase.from('menu_items').update({ image_path: path }).eq('id', item.id)
      if (old && !/^https?:/.test(old)) await supabase.storage.from('menu').remove([old])
      setItem({ ...item, image_path: path })
      toast('Photo updated', 'success')
    } catch (err) {
      toast(`Upload failed: ${(err as Error).message}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  if (!item) return <Skeleton className="h-[32rem] max-w-3xl" />

  return (
    <div className="max-w-3xl">
      <Link href="/admin/menu" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
        <ArrowLeft className="size-4" aria-hidden /> Menu
      </Link>
      <PageTitle
        title={item.name}
        actions={
          <Link href={`/menu/${item.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
            View on site <ExternalLink className="size-4" aria-hidden />
          </Link>
        }
      />

      <div className="space-y-6">
        <section className="grid gap-4 rounded-3xl bg-surface p-5 ring-1 ring-line sm:grid-cols-[200px_1fr]">
          <div>
            <ItemArt name={item.name} imagePath={item.image_path} className="aspect-[4/3] w-full rounded-2xl" sizes="200px" />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <Button variant="secondary" size="sm" block className="mt-2" loading={uploading} onClick={() => fileRef.current?.click()}>
              <ImagePlus className="size-4" aria-hidden /> {item.image_path ? 'Replace photo' : 'Add photo'}
            </Button>
            <p className="mt-1 text-xs text-muted">Landscape photo works best. We shrink it automatically.</p>
          </div>
          <div className="space-y-4">
            <Field label="Name" htmlFor="it-name"><Input id="it-name" value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} /></Field>
            <Field label="Description" htmlFor="it-desc"><Textarea id="it-desc" rows={3} value={item.description ?? ''} onChange={(e) => setItem({ ...item, description: e.target.value })} maxLength={300} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="it-cat">
                <Select id="it-cat" value={item.category_id} onChange={(e) => setItem({ ...item, category_id: e.target.value })}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Position in category" htmlFor="it-sort"><Input id="it-sort" type="number" value={item.sort_order} onChange={(e) => setItem({ ...item, sort_order: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Web address" htmlFor="it-slug" hint={`Share link: /menu/${slugify(item.slug || item.name)}`}>
              <Input id="it-slug" value={item.slug} onChange={(e) => setItem({ ...item, slug: e.target.value })} />
            </Field>
            <Field label="Tags (comma separated)" htmlFor="it-tags" hint="e.g. vegetarian, contains_peanuts, contains_fish">
              <Input id="it-tags" value={item.dietary_tags.join(', ')} onChange={(e) => setItem({ ...item, dietary_tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
            </Field>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2">On menu <Toggle on={item.is_active} onChange={(v) => setItem({ ...item, is_active: v })} label="On menu" /></label>
              <label className="flex items-center gap-2">In stock <Toggle on={item.is_available} onChange={(v) => setItem({ ...item, is_available: v })} label="In stock" /></label>
              <label className="flex items-center gap-2">Chef’s pick <Toggle on={item.is_featured} onChange={(v) => setItem({ ...item, is_featured: v })} label="Chef’s pick" /></label>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          <h2 className="font-sans text-base font-semibold">Portions & prices (GH₵)</h2>
          <div className="mt-3 space-y-2">
            {portions.map((p, i) => (
              <div key={p.id ?? `new-${i}`} className="flex flex-wrap items-center gap-2">
                <Input aria-label="Portion name" value={p.name} onChange={(e) => setPortions((ps) => ps.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="min-w-32 flex-1" placeholder="Regular" />
                <Input aria-label="Price" inputMode="decimal" value={p.price} onChange={(e) => setPortions((ps) => ps.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} className="w-28" placeholder="85.00" />
                <label className="flex items-center gap-1 text-xs">
                  <input type="radio" name="default-portion" checked={p.is_default} onChange={() => setPortions((ps) => ps.map((x, j) => ({ ...x, is_default: j === i })))} className="size-4 accent-[var(--brand)]" /> default
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (p.id) setRemoved((r) => [...r, p.id!])
                    setPortions((ps) => ps.filter((_, j) => j !== i))
                  }}
                  className="grid size-10 place-items-center rounded-lg hover:bg-black/5"
                  aria-label={`Remove ${p.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => setPortions((ps) => [...ps, { name: '', price: '', is_default: ps.length === 0, is_active: true, sort_order: ps.length }])}>
            <Plus className="size-4" aria-hidden /> Add portion
          </Button>
        </section>

        <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          <h2 className="font-sans text-base font-semibold">Extras, sides & spice level</h2>
          <p className="text-xs text-muted">Edit the options themselves under “Extras & spice”.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {groups.map((g) => (
              <label key={g.id} className="flex min-h-11 items-center gap-3 rounded-xl px-3 ring-1 ring-line">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--brand)]"
                  checked={attached.includes(g.id)}
                  onChange={(e) => setAttached((a) => (e.target.checked ? [...a, g.id] : a.filter((x) => x !== g.id)))}
                />
                {g.name} <span className="text-xs text-muted">({g.kind})</span>
              </label>
            ))}
          </div>
        </section>

        <div className="sticky bottom-4 flex justify-end">
          <Button size="lg" loading={saving} onClick={save} className="shadow-xl">
            Save changes
          </Button>
        </div>
      </div>
    </div>
  )
}
