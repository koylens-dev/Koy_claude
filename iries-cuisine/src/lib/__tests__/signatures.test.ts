import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { bodyFingerprint, verifyPaystackSignature, verifyStandardWebhook } from '../signatures'

describe('Paystack webhook signature', () => {
  const secret = 'sk_test_abc123'
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'IC1001-AB12CD34', amount: 18500 } })
  const sig = crypto.createHmac('sha512', secret).update(body).digest('hex')

  it('accepts a correctly signed body', () => expect(verifyPaystackSignature(body, sig, secret)).toBe(true))
  it('rejects a tampered body', () => expect(verifyPaystackSignature(body.replace('18500', '100'), sig, secret)).toBe(false))
  it('rejects a wrong key or missing header', () => {
    expect(verifyPaystackSignature(body, sig, 'sk_test_other')).toBe(false)
    expect(verifyPaystackSignature(body, null, secret)).toBe(false)
    expect(verifyPaystackSignature(body, 'short', secret)).toBe(false)
  })
  it('fingerprints identical deliveries identically', () => {
    expect(bodyFingerprint(body)).toBe(bodyFingerprint(body))
    expect(bodyFingerprint(body)).not.toBe(bodyFingerprint(body + ' '))
  })
})

describe('Supabase auth hook (Standard Webhooks) signature', () => {
  const key = crypto.randomBytes(32)
  const secret = `v1,whsec_${key.toString('base64')}`
  const body = JSON.stringify({ user: { phone: '233241234567' }, sms: { otp: '123456' } })
  const id = 'msg_123'
  const now = Date.now()
  const ts = String(Math.floor(now / 1000))
  const sign = (k: Buffer) => `v1,${crypto.createHmac('sha256', k).update(`${id}.${ts}.${body}`).digest('base64')}`

  it('accepts a valid signature', () => {
    expect(verifyStandardWebhook({ rawBody: body, id, timestamp: ts, signatureHeader: sign(key), secret, now })).toBe(true)
  })
  it('accepts when one of several signatures matches (key rotation)', () => {
    const header = `${sign(crypto.randomBytes(32))} ${sign(key)}`
    expect(verifyStandardWebhook({ rawBody: body, id, timestamp: ts, signatureHeader: header, secret, now })).toBe(true)
  })
  it('rejects wrong key, tampered body and stale timestamps', () => {
    expect(verifyStandardWebhook({ rawBody: body, id, timestamp: ts, signatureHeader: sign(crypto.randomBytes(32)), secret, now })).toBe(false)
    expect(verifyStandardWebhook({ rawBody: body + 'x', id, timestamp: ts, signatureHeader: sign(key), secret, now })).toBe(false)
    expect(verifyStandardWebhook({ rawBody: body, id, timestamp: ts, signatureHeader: sign(key), secret, now: now + 10 * 60_000 })).toBe(false)
  })
})
