import type { MetadataRoute } from 'next'
import { publicEnv } from '@/lib/public-env'
import { getPublicSupabase } from '@/lib/supabase/public'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/catering`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ]
  try {
    const { data } = await getPublicSupabase().from('menu_items').select('slug, updated_at').eq('is_active', true)
    for (const item of data ?? []) {
      pages.push({ url: `${base}/menu/${item.slug}`, lastModified: item.updated_at, changeFrequency: 'weekly', priority: 0.8 })
    }
  } catch {
    // database unavailable at build time: static pages only
  }
  return pages
}
