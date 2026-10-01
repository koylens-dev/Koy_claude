import type { Metadata } from 'next'
import { AccountForm } from './AccountForm'

export const metadata: Metadata = { title: 'My account', robots: { index: false } }

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-md pt-8">
      <h1 className="font-display text-4xl font-semibold">My account</h1>
      <AccountForm />
    </div>
  )
}
