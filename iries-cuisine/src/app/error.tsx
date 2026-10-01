'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-muted">Please try again. If you already paid, your order is safe — you’ll get SMS updates.</p>
        <button type="button" onClick={reset} className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-brand px-6 font-semibold text-white">
          Try again
        </button>
      </div>
    </main>
  )
}
