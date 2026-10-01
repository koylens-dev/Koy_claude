import 'server-only'

import { serverEnv } from './env'

// Minimal Paystack REST client (https://paystack.com/docs/api/). Amounts are in
// the currency's subunit: pesewas for GHS.

// Override only for automated tests against a mock gateway.
const BASE_URL = process.env.PAYSTACK_API_BASE ?? 'https://api.paystack.co'

/** Paystack's published webhook source IPs (same for test and live). */
export const PAYSTACK_WEBHOOK_IPS = ['52.31.139.75', '52.49.173.169', '52.214.14.220']

export class PaystackError extends Error {
  constructor(
    message: string,
    public httpStatus: number,
    public body: unknown,
  ) {
    super(message)
    this.name = 'PaystackError'
  }
}

async function call<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${serverEnv.paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (err) {
    throw new PaystackError(`Could not reach Paystack: ${(err as Error).message}`, 0, null)
  }
  const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null
  if (!res.ok || !json?.status) {
    throw new PaystackError(json?.message ?? `Paystack HTTP ${res.status}`, res.status, json)
  }
  return json.data as T
}

export type PaystackTransaction = {
  id: number
  status: 'success' | 'failed' | 'abandoned' | 'ongoing' | 'pending' | 'processing' | 'queued' | 'reversed' | string
  reference: string
  amount: number
  currency: string
  channel: string | null
  fees: number | null
  paid_at: string | null
  gateway_response: string | null
  metadata?: unknown
}

export type PaystackRefund = {
  id: number
  status: string // pending | processing | processed | failed | needs-attention
  amount: number
  currency: string
  transaction?: { id: number; reference: string } | number
}

export function initializeTransaction(input: {
  email: string
  amountPesewas: number
  reference: string
  callbackUrl: string
  metadata: Record<string, unknown>
}) {
  return call<{ authorization_url: string; access_code: string; reference: string }>('/transaction/initialize', {
    method: 'POST',
    body: {
      email: input.email,
      amount: input.amountPesewas,
      currency: 'GHS',
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      // No `channels` list: whatever is enabled on the Paystack dashboard (MoMo, card, bank) is offered.
    },
  })
}

export function verifyTransaction(reference: string) {
  return call<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`)
}

export function createRefund(input: { reference: string; amountPesewas?: number; merchantNote: string; customerNote?: string }) {
  return call<PaystackRefund>('/refund', {
    method: 'POST',
    body: {
      transaction: input.reference,
      amount: input.amountPesewas,
      currency: 'GHS',
      merchant_note: input.merchantNote.slice(0, 200),
      customer_note: (input.customerNote ?? input.merchantNote).slice(0, 200),
    },
  })
}

export function fetchRefund(id: string) {
  return call<PaystackRefund>(`/refund/${encodeURIComponent(id)}`)
}
