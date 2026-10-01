import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getPublicSupabase } from '@/lib/supabase/public'
import { fetchMenu } from '@/lib/menu'
import { menuImageUrl } from '@/lib/public-env'
import { formatCedis } from '@/lib/money'
import { ItemArt } from '@/components/menu/ItemArt'
import { ItemPageForm } from './ItemPageForm'

export const revalidate = 60

async function findItem(slug: string) {
  const categories = await fetchMenu(getPublicSupabase())
  for (const c of categories) {
    const item = c.items.find((i) => i.slug === slug)
    if (item) return { item, category: c }
  }
  return null
}

export async function generateStaticParams() {
  try {
    const categories = await fetchMenu(getPublicSupabase())
    return categories.flatMap((c) => c.items.map((i) => ({ slug: i.slug })))
  } catch {
    return [] // no database at build time: pages render on first request instead
  }
}

// Shareable dish links for Instagram / WhatsApp with a proper preview card.
export async function generateMetadata({ params }: PageProps<'/menu/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const found = await findItem(slug)
  if (!found) return { title: 'Dish not found' }
  const { item } = found
  const from = Math.min(...item.portions.map((p) => p.price_pesewas))
  const image = menuImageUrl(item.image_path)
  const description = `${item.description ?? item.name} — from ${formatCedis(from)}. Order online from Irie's Cuisine, Adenta.`
  return {
    title: item.name,
    description,
    alternates: { canonical: `/menu/${item.slug}` },
    openGraph: { title: `${item.name} · Irie's Cuisine`, description, images: image ? [{ url: image, width: 1200, height: 900, alt: item.name }] : undefined },
  }
}

export default async function MenuItemPage({ params }: PageProps<'/menu/[slug]'>) {
  const { slug } = await params
  const found = await findItem(slug)
  if (!found) notFound()
  const { item, category } = found

  return (
    <div className="mx-auto max-w-2xl pt-4">
      <Link href={`/#${category.slug}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {category.name}
      </Link>
      <ItemArt name={item.name} imagePath={item.image_path} priority className="mt-2 aspect-[4/3] w-full rounded-3xl" sizes="(max-width: 672px) 100vw, 672px" />
      <h1 className="mt-5 font-display text-4xl font-semibold">{item.name}</h1>
      {item.description && <p className="mt-2 leading-relaxed text-muted">{item.description}</p>}
      {!item.is_available && <p className="mt-3 inline-block rounded-full bg-stone-200 px-3 py-1 text-sm font-semibold">Sold out right now</p>}
      <div className="mt-6 rounded-3xl bg-surface p-5 ring-1 ring-line">
        <ItemPageForm item={item} />
      </div>
    </div>
  )
}
