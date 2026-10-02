'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])
  return (
    <html lang="en-GH">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#fdf6e3', color: '#0c1c14', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, padding: 16 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <h1>Something went wrong</h1>
          <p>Please try again in a moment.</p>
          <button type="button" onClick={reset} style={{ minHeight: 48, padding: '0 24px', borderRadius: 12, border: 0, background: '#1b4e22', color: '#fff', fontWeight: 600 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
