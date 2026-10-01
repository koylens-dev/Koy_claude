import Link from 'next/link'
import { CartProvider } from '@/components/customer/CartProvider'
import { SiteHeader } from '@/components/customer/SiteHeader'
import { CartBar } from '@/components/customer/CartBar'
import { WhatsAppButton } from '@/components/customer/WhatsAppButton'

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <SiteHeader />
      <main className="mx-auto min-h-[70dvh] max-w-6xl px-4 pb-32">{children}</main>
      <footer className="border-t border-line bg-surface/60">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted sm:grid-cols-3">
          <div>
            <p className="font-display text-2xl font-semibold text-ink">Irie’s Cuisine</p>
            <p className="mt-1">Ghanaian home cooking · Adenta, Accra</p>
            <p className="mt-1">Prepaid orders only — MoMo, Visa & Mastercard.</p>
          </div>
          <nav className="flex flex-col gap-2" aria-label="Footer">
            <Link href="/catering" className="hover:text-ink">Catering & bulk orders</Link>
            <Link href="/orders" className="hover:text-ink">My orders</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy policy</Link>
            <Link href="/terms" className="hover:text-ink">Terms & refunds</Link>
          </nav>
          <div className="sm:text-right">
            <p>© {new Date().getFullYear()} Irie’s Cuisine</p>
            <Link href="/staff/login" className="mt-2 inline-block text-xs hover:text-ink">Staff sign-in</Link>
          </div>
        </div>
      </footer>
      <CartBar />
      <WhatsAppButton />
    </CartProvider>
  )
}
