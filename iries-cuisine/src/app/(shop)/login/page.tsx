import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } }

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md pt-10">
      <h1 className="font-display text-4xl font-semibold">Sign in with your phone</h1>
      <p className="mt-2 text-muted">We’ll text you a 6-digit code. No passwords to remember.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
