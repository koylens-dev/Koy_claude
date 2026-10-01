'use client'

import Link from 'next/link'
import { Trash2, ArrowRight } from 'lucide-react'
import { useCart, unitPrice } from '@/components/customer/CartProvider'
import { Stepper } from '@/components/menu/ItemOptions'
import { ItemArt } from '@/components/menu/ItemArt'
import { buttonClasses } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatCedis } from '@/lib/money'

export default function CartPage() {
  const { lines, hydrated, subtotal, setQuantity, remove } = useCart()

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 pt-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="font-display text-4xl font-semibold">Your order is empty</h1>
        <p className="mt-2 text-muted">Jollof, waakye, kelewele… the kitchen is ready when you are.</p>
        <Link href="/" className={buttonClasses({ size: 'lg', className: 'mt-6' })}>
          Browse the menu
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl pt-8">
      <h1 className="font-display text-4xl font-semibold">Your order</h1>
      <ul className="mt-6 divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
        {lines.map((line) => (
          <li key={line.key} className="flex gap-3 p-4">
            <ItemArt name={line.name} imagePath={line.imagePath} className="size-16 shrink-0 rounded-xl" sizes="64px" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold leading-snug">{line.name}</p>
                  <p className="text-sm text-muted">
                    {line.portionName}
                    {line.options.length > 0 && ` · ${line.options.map((o) => o.name).join(', ')}`}
                  </p>
                  {line.notes && <p className="mt-0.5 text-sm italic text-muted">“{line.notes}”</p>}
                </div>
                <p className="shrink-0 font-semibold">{formatCedis(unitPrice(line) * line.quantity)}</p>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <Stepper value={line.quantity} onChange={(q) => setQuantity(line.key, q)} label={line.name} />
                <button type="button" onClick={() => remove(line.key)} className="grid size-11 place-items-center rounded-full text-muted hover:bg-black/5 hover:text-danger" aria-label={`Remove ${line.name}`}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between text-lg">
        <span className="font-semibold">Subtotal</span>
        <span className="font-bold">{formatCedis(subtotal)}</span>
      </div>
      <p className="mt-1 text-sm text-muted">Delivery fee and final total are confirmed at checkout.</p>
      <Link href="/checkout" className={buttonClasses({ size: 'lg', block: true, className: 'mt-6' })}>
        Checkout <ArrowRight className="size-5" aria-hidden />
      </Link>
      <Link href="/" className="mt-3 block text-center text-sm font-semibold text-brand">
        Add more dishes
      </Link>
    </div>
  )
}
