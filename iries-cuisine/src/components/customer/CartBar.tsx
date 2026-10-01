'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingBag } from 'lucide-react'
import { formatCedis } from '@/lib/money'
import { useCart } from './CartProvider'

/** Sticky "View cart" bar on menu pages (mobile-first). */
export function CartBar() {
  const { count, subtotal, hydrated } = useCart()
  const pathname = usePathname()
  if (!hydrated || count === 0) return null
  if (!(pathname === '/' || pathname.startsWith('/menu'))) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-safe pt-2">
      <Link
        href="/cart"
        className="mx-auto flex min-h-14 max-w-xl items-center justify-between rounded-2xl bg-brand px-5 text-white shadow-xl shadow-brand/30 hover:bg-brand-strong"
      >
        <span className="flex items-center gap-2 font-semibold">
          <ShoppingBag className="size-5" aria-hidden />
          View order · {count} {count === 1 ? 'item' : 'items'}
        </span>
        <span className="font-bold">{formatCedis(subtotal)}</span>
      </Link>
    </div>
  )
}
