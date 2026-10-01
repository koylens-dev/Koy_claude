import type { Metadata } from 'next'
import { CateringForm } from './CateringForm'

export const metadata: Metadata = {
  title: 'Catering & bulk orders',
  description: "Weddings, funerals, office lunches, parties — Irie's Cuisine caters Ghanaian food for groups of any size across Accra.",
}

export default function CateringPage() {
  return (
    <div className="mx-auto max-w-2xl pt-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Catering</p>
      <h1 className="mt-2 font-display text-5xl font-semibold leading-tight">Feeding a crowd?</h1>
      <p className="mt-3 leading-relaxed text-muted">
        Weddings, naming ceremonies, funerals, office lunches and parties. Tell us about your event and our manager will call you with a menu and quote.
      </p>
      <CateringForm />
    </div>
  )
}
