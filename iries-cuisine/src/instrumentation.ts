import * as Sentry from '@sentry/nextjs'

// Error monitoring (Sentry). Does nothing until SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN are set.
export async function register() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: 0.05,
    })
  }
}

export const onRequestError = Sentry.captureRequestError
