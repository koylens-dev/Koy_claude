// Webhook signature checks. Pure Node crypto so they are unit-testable.
import crypto from 'node:crypto'

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}

/**
 * Paystack signs the exact raw request body with HMAC-SHA512 using your secret key
 * and sends it in the `x-paystack-signature` header (hex).
 */
export function verifyPaystackSignature(rawBody: string, signature: string | null | undefined, secretKey: string): boolean {
  if (!signature || !secretKey) return false
  const expected = crypto.createHmac('sha512', secretKey).update(rawBody, 'utf8').digest('hex')
  return safeEqual(expected, signature.trim().toLowerCase())
}

/**
 * Supabase Auth hooks follow the Standard Webhooks spec (https://www.standardwebhooks.com):
 * signature = base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)), header "v1,<sig>".
 * The secret is shown in the Supabase dashboard as "v1,whsec_<base64>".
 */
export function verifyStandardWebhook(opts: {
  rawBody: string
  id: string | null
  timestamp: string | null
  signatureHeader: string | null
  secret: string
  toleranceSeconds?: number
  now?: number
}): boolean {
  const { rawBody, id, timestamp, signatureHeader, secret } = opts
  if (!id || !timestamp || !signatureHeader || !secret) return false

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  const now = Math.floor((opts.now ?? Date.now()) / 1000)
  if (Math.abs(now - ts) > (opts.toleranceSeconds ?? 300)) return false

  const base64Secret = secret.replace(/^v1,/, '').replace(/^whsec_/, '')
  const key = Buffer.from(base64Secret, 'base64')
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`, 'utf8').digest('base64')

  return signatureHeader
    .split(' ')
    .map((part) => part.split(',', 2))
    .some(([version, sig]) => version === 'v1' && typeof sig === 'string' && safeEqual(expected, sig))
}

/** Stable key used to drop duplicate webhook deliveries. */
export function bodyFingerprint(rawBody: string): string {
  return crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex')
}
