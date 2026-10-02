import { getPublicSupabase } from '@/lib/supabase/public'
import { fetchMenu, fetchStoreContext, hoursConfig } from '@/lib/menu'
import { MenuBrowser } from '@/components/customer/MenuBrowser'
import { StoreStatus } from '@/components/customer/StoreStatus'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { publicEnv } from '@/lib/public-env'
import { formatCedis } from '@/lib/money'

// Static page re-built at most once a minute (fast from the CDN on 3G);
// "sold out" changes arrive live over Supabase Realtime.
export const revalidate = 60

export default async function HomePage() {
  const supabase = getPublicSupabase()
  let loaded: [Awaited<ReturnType<typeof fetchMenu>>, Awaited<ReturnType<typeof fetchStoreContext>>]
  try {
    loaded = await Promise.all([fetchMenu(supabase), fetchStoreContext(supabase)])
  } catch {
    // Database unreachable (or not configured yet): show a friendly message; the page retries within a minute.
    return (
      <div className="py-24 text-center">
        <h1 className="font-display text-4xl font-semibold">The menu is warming up</h1>
        <p className="mt-2 text-muted">Please refresh in a moment.</p>
      </div>
    )
  }
  const [categories, ctx] = loaded
  const cheapestFee = ctx.zones.length ? Math.min(...ctx.zones.map((z) => z.fee_pesewas)) : null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: "Irie's Cuisine",
    servesCuisine: 'Ghanaian',
    url: publicEnv.siteUrl,
    telephone: ctx.settings.support_phone ?? undefined,
    address: { '@type': 'PostalAddress', addressLocality: 'Adenta', addressRegion: 'Greater Accra', addressCountry: 'GH' },
    priceRange: 'GH₵',
    acceptsReservations: false,
    paymentAccepted: 'Mobile Money, Visa, Mastercard',
    openingHoursSpecification: ctx.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][h.day_of_week],
      opens: h.opens_at.slice(0, 5),
      closes: h.closes_at.slice(0, 5),
    })),
  }

  return (
    <>
      <section className="brand-chevrons relative -mx-4 overflow-hidden px-4 pb-10 pt-10 text-white sm:rounded-b-[2rem]">
        <div className="relative mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Adenta · Accra</p>
          <h1 className="mt-3 max-w-xl font-display text-5xl font-semibold leading-[1.02] sm:text-6xl">
            Ghanaian food, <em className="font-medium text-accent">cooked with love</em>, delivered warm.
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/80">
            Pay with MoMo or card. Track your order live from our kitchen to your door
            {cheapestFee !== null && <> — delivery from {formatCedis(cheapestFee)}</>}.
          </p>
          <StoreStatus config={hoursConfig(ctx)} pauseMessage={ctx.settings.pause_message} className="mt-6" />
        </div>
      </section>
      <InstallPrompt />
      <MenuBrowser categories={categories} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </>
  )
}
