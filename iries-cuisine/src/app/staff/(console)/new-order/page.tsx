import type { Metadata } from 'next'
import { NewOrderForm } from './NewOrderForm'

export const metadata: Metadata = { title: 'New phone order' }

export default function NewOrderPage() {
  return (
    <div className="px-3 pb-16 pt-4">
      <h1 className="mb-1 font-display text-3xl font-semibold">New phone / WhatsApp order</h1>
      <p className="mb-4 text-sm text-muted">Every sale goes through the system. The customer pays by MoMo or card using the link we send them.</p>
      <NewOrderForm />
    </div>
  )
}
