import 'server-only'

// Server-side configuration. Secrets live in environment variables (Vercel →
// Project → Settings → Environment Variables), never in code or the browser.
// Getters so a missing optional value only fails the feature that needs it.

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example and docs/SETUP_AND_DEPLOY.md.`)
  return value
}

export const serverEnv = {
  get siteUrl(): string {
    return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  },
  get supabaseUrl(): string {
    return required('NEXT_PUBLIC_SUPABASE_URL')
  },
  get supabasePublishableKey(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? required('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  },
  get supabaseSecretKey(): string {
    return process.env.SUPABASE_SECRET_KEY ?? required('SUPABASE_SERVICE_ROLE_KEY')
  },
  get paystackSecretKey(): string {
    return required('PAYSTACK_SECRET_KEY')
  },
  /** Paystack requires an email; customers who sign in by phone get <msisdn>@<this domain>. */
  get paystackFallbackEmailDomain(): string {
    if (process.env.PAYSTACK_FALLBACK_EMAIL_DOMAIN) return process.env.PAYSTACK_FALLBACK_EMAIL_DOMAIN
    try {
      const host = new URL(this.siteUrl).hostname
      return host === 'localhost' ? 'example.com' : `orders.${host.replace(/^www\./, '')}`
    } catch {
      return 'example.com'
    }
  },
  get paystackEnforceIpAllowlist(): boolean {
    return process.env.PAYSTACK_ENFORCE_IP_ALLOWLIST === 'true'
  },
  get smsProvider(): 'arkesel' | 'mnotify' | 'console' | 'none' {
    const p = (process.env.SMS_PROVIDER ?? 'console').toLowerCase()
    return p === 'arkesel' || p === 'mnotify' || p === 'none' ? p : 'console'
  },
  get smsSenderId(): string {
    return process.env.SMS_SENDER_ID ?? 'IriesFood'
  },
  get arkeselApiKey(): string {
    return required('ARKESEL_API_KEY')
  },
  get mnotifyApiKey(): string {
    return required('MNOTIFY_API_KEY')
  },
  get smsHookSecret(): string {
    return required('SUPABASE_SMS_HOOK_SECRET')
  },
  get cronSecret(): string {
    return required('CRON_SECRET')
  },
  /** Comma-separated E.164 numbers that get an SMS when a paid order waits too long or a catering enquiry arrives. */
  get staffAlertPhones(): string[] {
    return (process.env.STAFF_ALERT_PHONES ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
  },
  get staffAlertAfterMinutes(): number {
    return Number(process.env.STAFF_ALERT_AFTER_MINUTES ?? 5)
  },
  get isProduction(): boolean {
    return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
  },
}
