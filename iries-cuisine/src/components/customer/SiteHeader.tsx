'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ShoppingBag, UserRound, Receipt } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { useCart } from './CartProvider'

export function SiteHeader() {
  const { count, hydrated } = useCart()
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    const supabase = getBrowserSupabase()
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session))
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-cream/95 backdrop-blur">
      <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between px-4 sm:h-[68px]">
        <Link href="/" className="flex items-baseline gap-1.5" aria-label="Irie's Cuisine — home">
          <span className="font-display text-[26px] font-bold leading-none text-brand sm:text-3xl">Irie’s</span>
          <span className="font-display text-[26px] font-semibold italic leading-none sm:text-3xl">Cuisine</span>
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          <Link href="/catering" className="hidden rounded-full px-3 py-2 text-sm font-semibold hover:bg-black/5 sm:block">
            Catering
          </Link>
          {signedIn && (
            <Link href="/orders" className="grid size-11 place-items-center rounded-full hover:bg-black/5" aria-label="My orders">
              <Receipt className="size-5" />
            </Link>
          )}
          <Link href={signedIn ? '/account' : '/login'} className="grid size-11 place-items-center rounded-full hover:bg-black/5" aria-label={signedIn ? 'My account' : 'Sign in'}>
            <UserRound className="size-5" />
          </Link>
          <Link href="/cart" className="relative grid size-11 place-items-center rounded-full bg-ink text-white hover:bg-black" aria-label={`Cart, ${count} items`}>
            <ShoppingBag className="size-5" />
            {hydrated && count > 0 && (
              <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-cream">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  )
}
