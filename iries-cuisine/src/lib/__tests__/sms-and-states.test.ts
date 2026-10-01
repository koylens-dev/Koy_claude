import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { smsParts, smsTemplates, toGsmSafe } from '../sms-templates'
import { TRANSITIONS } from '../order-status'

const trackUrl = 'https://iriescuisine.com/t/0123456789abcdef0123456789abcdef'
const order = { orderNumber: 10423, totalPesewas: 18550, fulfilment: 'delivery' as const, prepMinutes: 25, trackUrl, riderName: 'Kwabena', riderPhone: '+233241234567', deliveryCode: '4821' }

describe('SMS templates', () => {
  it('strips characters that would force expensive UCS-2 SMS', () => {
    expect(toGsmSafe('Irie’s — GH₵185 “hot” 🔥')).toBe("Irie's - GHS 185 \"hot\"")
  })

  it.each([
    ['payment received', smsTemplates.orderPaid(order)],
    ['accepted', smsTemplates.orderAccepted(order)],
    ['out for delivery', smsTemplates.outForDelivery(order)],
    ['payment link', smsTemplates.paymentLink(10423, 18550, 'https://iriescuisine.com/pay/0123456789abcdef0123456789abcdef')],
    ['otp', smsTemplates.otp('123456')],
  ])('%s fits in one SMS', (_name, text) => {
    const safe = toGsmSafe(text)
    expect(safe).toBe(text.replace(/’/g, "'")) // nothing important lost
    expect(smsParts(safe)).toBe(1)
  })
})

describe('refund wording', () => {
  it('states the amount actually refunded, and never promises a refund that was not started', () => {
    expect(smsTemplates.orderCancelled(order, 'Gas ran out', 28500)).toContain('A refund of GHS 285.00 has been started.')
    expect(smsTemplates.orderRejected(order, 'Kitchen busy', 0)).toContain('Our team will contact you about your refund.')
  })
})

describe('order state machine', () => {
  it('the UI copy of the transitions matches the database migration exactly', () => {
    const sql = readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20261001000100_core_schema.sql'), 'utf8')
    const rows = [...sql.matchAll(/\('(\w+)',\s*'(\w+)',\s*array\[([^\]]*)\]\)/g)].map((m) => ({
      from: m[1],
      to: m[2],
      roles: m[3].split(',').map((r) => r.trim().replace(/'/g, '')).sort(),
    }))
    expect(rows.length).toBeGreaterThan(20)

    const fromTs = Object.entries(TRANSITIONS).flatMap(([from, tos]) =>
      Object.entries(tos).map(([to, roles]) => ({ from, to, roles: [...(roles ?? [])].sort() })),
    )
    const key = (r: { from: string; to: string }) => `${r.from}->${r.to}`
    expect(Object.fromEntries(fromTs.map((r) => [key(r), r.roles]))).toEqual(Object.fromEntries(rows.map((r) => [key(r), r.roles])))
  })
})
