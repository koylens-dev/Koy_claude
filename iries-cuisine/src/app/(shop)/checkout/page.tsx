import type { Metadata } from 'next'
import { CheckoutForm } from './CheckoutForm'

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } }

export default function CheckoutPage() {
  return (
    <div className="pt-8">
      <h1 className="font-display text-4xl font-semibold">Checkout</h1>
      <CheckoutForm />
    </div>
  )
}
