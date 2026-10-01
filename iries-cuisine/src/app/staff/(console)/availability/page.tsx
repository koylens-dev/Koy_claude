import type { Metadata } from 'next'
import { AvailabilityBoard } from './AvailabilityBoard'

export const metadata: Metadata = { title: 'Sold out' }

export default function AvailabilityPage() {
  return (
    <div className="px-3 pb-16 pt-4">
      <h1 className="font-display text-3xl font-semibold">Sold out?</h1>
      <p className="mb-4 text-sm text-muted">Switch a dish or extra off and customers see “Sold out” immediately.</p>
      <AvailabilityBoard />
    </div>
  )
}
