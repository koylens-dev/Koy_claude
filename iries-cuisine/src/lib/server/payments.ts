import 'server-only'

import crypto from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { serverEnv } from './env'
import { createRefund, initializeTransaction, verifyTransaction, type PaystackTransaction } from './paystack'
import { notifyStatusChange, sendOrderSms, trackUrl } from './notify'
import { smsTemplates } from '@/lib/sms-templates'
import { toMsisdn } from '@/lib/phone'
import type { OrderRow } from '@/lib/types'

// ---------------------------------------------------------------------------
// Starting a payment
// ---------------------------------------------------------------------------

function newReference(orderNumber: number) {
  return `IC${orderNumber}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
}

/**
 * Returns a Paystack checkout URL for an unpaid order. Re-uses a recent open
 * attempt (so double taps don't create several transactions), otherwise starts a new one.
 */
export async function getCheckoutUrl(order: OrderRow): Promise<string> {
  if (order.status !== 'awaiting_payment') throw new Error('order_not_awaiting_payment')
  if (order.is_demo) throw new Error('demo_order') // demo orders never reach Paystack
  const admin = getAdminSupabase()

  const { data: recent } = await admin
    .from('payments')
    .select('authorization_url, status, created_at')
    .eq('order_id', order.id)
    .in('status', ['initialized', 'pending'])
    .gte('created_at', new Date(Date.now() - 20 * 60_000).toISOString())
    .not('authorization_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
  if (recent?.[0]?.authorization_url) return recent[0].authorization_url as string

  const reference = newReference(order.order_number)
  const email = order.customer_email || `${toMsisdn(order.customer_phone)}@${serverEnv.paystackFallbackEmailDomain}`

  const { data: payment, error } = await admin
    .from('payments')
    .insert({ order_id: order.id, reference, amount_pesewas: order.total_pesewas, currency: 'GHS', customer_email: email })
    .select('id')
    .single()
  if (error) throw error

  try {
    const init = await initializeTransaction({
      email,
      amountPesewas: order.total_pesewas,
      reference,
      callbackUrl: trackUrl(order.public_token),
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        custom_fields: [
          { display_name: 'Order', variable_name: 'order_number', value: `#${order.order_number}` },
          { display_name: 'Phone', variable_name: 'phone', value: order.customer_phone },
        ],
      },
    })
    await admin
      .from('payments')
      .update({ authorization_url: init.authorization_url, access_code: init.access_code })
      .eq('id', payment.id)
    return init.authorization_url
  } catch (err) {
    await admin.from('payments').update({ status: 'failed', gateway_response: (err as Error).message }).eq('id', payment.id)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Processing a transaction we have verified with Paystack
// ---------------------------------------------------------------------------

export type ProcessResult =
  | { result: 'paid'; orderId: string; revived: boolean }
  | { result: 'already_processed'; orderId: string }
  | { result: 'needs_refund'; orderId: string }
  | { result: 'amount_mismatch'; orderId: string }
  | { result: 'unknown_reference' }
  | { result: 'not_successful'; status: string }

function mapFailedStatus(status: string): 'pending' | 'failed' | 'abandoned' | 'reversed' {
  if (status === 'failed') return 'failed'
  if (status === 'abandoned') return 'abandoned'
  if (status === 'reversed') return 'reversed'
  return 'pending' // ongoing | pending | processing | queued | send_otp …
}

/**
 * Single code path for webhook, redirect-return and cron sweeps. Safe to call any
 * number of times for the same transaction: the database function is idempotent.
 */
export async function processTransaction(tx: PaystackTransaction): Promise<ProcessResult> {
  const admin = getAdminSupabase()

  if (tx.status !== 'success') {
    await admin.rpc('record_payment_state', {
      p_reference: tx.reference,
      p_status: mapFailedStatus(tx.status),
      p_gateway_response: tx.gateway_response,
      p_raw: tx as unknown as Record<string, unknown>,
    })
    return { result: 'not_successful', status: tx.status }
  }

  const { data, error } = await admin.rpc('confirm_payment', {
    p_reference: tx.reference,
    p_amount_pesewas: tx.amount,
    p_currency: tx.currency,
    p_channel: tx.channel,
    p_provider_transaction_id: String(tx.id),
    p_fees_pesewas: tx.fees ?? null,
    p_paid_at: tx.paid_at,
    p_gateway_response: tx.gateway_response,
    p_raw: tx as unknown as Record<string, unknown>,
  })
  if (error) throw error

  const outcome = data as { result: string; order_id?: string; payment_id?: string; revived?: boolean; amount_pesewas?: number; reason?: string }

  switch (outcome.result) {
    case 'paid': {
      const { data: order } = await admin.from('orders').select('*').eq('id', outcome.order_id).single()
      if (order) await notifyStatusChange(order as OrderRow)
      return { result: 'paid', orderId: outcome.order_id!, revived: !!outcome.revived }
    }
    case 'already_processed':
      return { result: 'already_processed', orderId: outcome.order_id! }
    case 'needs_refund': {
      // Paid twice, or paid for an order the customer had cancelled: give the money back automatically.
      await issueRefund({
        orderId: outcome.order_id!,
        paymentId: outcome.payment_id!,
        amountPesewas: null,
        reason: outcome.reason === 'duplicate_payment' ? 'Duplicate payment (automatic refund)' : 'Order was cancelled before payment (automatic refund)',
        requestedBy: null,
        requestedRole: 'system',
        automatic: true,
      })
      return { result: 'needs_refund', orderId: outcome.order_id! }
    }
    case 'amount_mismatch':
      Sentry.captureMessage(`Paystack amount mismatch for ${tx.reference}`, 'error')
      return { result: 'amount_mismatch', orderId: outcome.order_id! }
    default:
      return { result: 'unknown_reference' }
  }
}

/** Ask Paystack directly (never trust the browser) and process the answer. */
export async function verifyAndProcess(reference: string): Promise<ProcessResult> {
  const tx = await verifyTransaction(reference)
  if (tx.reference !== reference) throw new Error('reference_mismatch')
  return processTransaction(tx)
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export type RefundOutcome = { ok: boolean; refundId?: string; amountPesewas?: number; status?: string; orderRefunded?: boolean; error?: string }

/**
 * Reserve (DB, under lock) -> ask Paystack -> record the answer.
 * amountPesewas = null refunds everything still refundable on that payment.
 */
export async function issueRefund(input: {
  orderId: string
  paymentId?: string | null
  amountPesewas: number | null
  reason: string
  requestedBy: string | null
  requestedRole: string
  automatic: boolean
}): Promise<RefundOutcome> {
  const admin = getAdminSupabase()

  const { data: refund, error } = await admin.rpc('reserve_refund', {
    p_order_id: input.orderId,
    p_payment_id: input.paymentId ?? null,
    p_amount_pesewas: input.amountPesewas,
    p_reason: input.reason,
    p_requested_by: input.requestedBy,
    p_requested_role: input.requestedRole,
    p_is_automatic: input.automatic,
  })
  if (error || !refund) {
    return { ok: false, error: error?.message ?? 'refund_not_reserved' }
  }

  const { data: payment } = await admin.from('payments').select('reference').eq('id', refund.payment_id).single()

  // Demo/training orders: simulate the gateway, never call Paystack.
  const { data: order } = await admin.from('orders').select('is_demo').eq('id', input.orderId).single()
  if (order?.is_demo) {
    const { data: fin, error: finError } = await admin.rpc('finalize_refund', {
      p_refund_id: refund.id,
      p_ok: true,
      p_provider_refund_id: `DEMO-RF-${refund.id.slice(0, 8)}`,
      p_provider_status: 'processed',
      p_error: null,
    })
    if (finError) return { ok: false, refundId: refund.id, error: finError.message }
    const result = fin as { status: string; order_refunded: boolean }
    return { ok: true, refundId: refund.id, amountPesewas: refund.amount_pesewas, status: result.status, orderRefunded: result.order_refunded }
  }

  try {
    const gateway = await createRefund({
      reference: payment!.reference,
      amountPesewas: refund.amount_pesewas,
      merchantNote: `Order refund: ${input.reason}`,
      customerNote: input.reason,
    })
    const { data: fin, error: finError } = await admin.rpc('finalize_refund', {
      p_refund_id: refund.id,
      p_ok: true,
      p_provider_refund_id: String(gateway.id),
      p_provider_status: gateway.status,
      p_error: null,
    })
    if (finError) throw finError
    const result = fin as { status: string; order_refunded: boolean }
    return { ok: true, refundId: refund.id, amountPesewas: refund.amount_pesewas, status: result.status, orderRefunded: result.order_refunded }
  } catch (err) {
    const message = (err as Error).message
    await admin.rpc('finalize_refund', {
      p_refund_id: refund.id,
      p_ok: false,
      p_provider_refund_id: null,
      p_provider_status: null,
      p_error: message,
    })
    Sentry.captureException(err, { tags: { area: 'refund' }, extra: { orderId: input.orderId } })
    return { ok: false, refundId: refund.id, error: message }
  }
}

/** After a partial refund, tell the customer. */
export async function notifyPartialRefund(order: OrderRow, refundId: string, amountPesewas: number) {
  await sendOrderSms(
    order.id,
    `partial_refund:${refundId}`,
    order.customer_phone,
    smsTemplates.partialRefund(
      {
        orderNumber: order.order_number,
        totalPesewas: order.total_pesewas,
        fulfilment: order.fulfilment,
        trackUrl: trackUrl(order.public_token),
      },
      amountPesewas,
    ),
  )
}
