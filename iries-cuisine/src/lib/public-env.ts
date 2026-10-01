// Values that are safe to ship to the browser. NEXT_PUBLIC_* variables must be
// referenced literally so Next.js can inline them at build time.

export const publicEnv = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '',
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? '',
}

export function menuImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/menu/${path.replace(/^\//, '')}`
}
