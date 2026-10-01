import 'server-only'

import * as Sentry from '@sentry/nextjs'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { serverEnv } from './env'
import { sendSms } from './sms'
import { smsTemplates, toGsmSafe } from '@/lib/sms-templates'
import type { OrderRow } from '@/lib/types'

export type OrderNotificationKind =
  | 'order_paid'
  | 'order_accepted'
  | 'out_for_delivery'
  | 'ready_for_pickup'
  | 'order_rejected'
  | 'order_cancelled'
  | `partial_refund:${string}`
  | 'payment_link'
  | `staff_alert:${string}`

export function trackUrl(token: string) {
  return `${serverEnv.siteUrl}/t/${token}`
}

export function payUrl(token: string) {
  return `${serverEnv.siteUrl}/pay/${token}`
}

/**
 * Send an SMS about an order at most once per (order, kind). Never throws:
 * a failed SMS must not break a payment confirmation or a status change.
 */
export async function sendOrderSms(orderId: string, kind: OrderNotificationKind, recipient: string, body: string) {
  const admin = getAdminSupabase()
  const message = toGsmSafe(body)
  try {
    const { data: inserted, error } = await admin
      .from('notifications')
      .upsert(
        { order_id: orderId, kind, channel: 'sms', recipient, body: message },
        { onConflict: 'order_id,kind,channel', ignoreDuplicates: true },
      )
      .select('id')
    if (error) throw error
    if (!inserted || inserted.length === 0) return { skipped: true } // already sent

    const result = await sendSms(recipient, message)
    await admin
      .from('notifications')
      .update({
        status: result.ok ? 'sent' : serverEnv.smsProvider === 'none' ? 'skipped' : 'failed',
        provider: result.provider,
        provider_message_id: result.messageId ?? null,
        error: result.error ?? null,
        sent_at: result.ok ? new Date().toISOString() : null,
      })
      .eq('id', inserted[0].id)
    return { ok: result.ok }
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'notify' }, extra: { orderId, kind } })
    console.error('[notify] failed', kind, err)
    return { ok: false }
  }
}

/** Customer SMS for a status the order just moved into. */
export async function notifyStatusChange(order: OrderRow, opts: { reason?: string | null; refundPesewas?: number } = {}) {
  const info = {
    orderNumber: order.order_number,
    totalPesewas: order.total_pesewas,
    fulfilment: order.fulfilment,
    prepMinutes: order.prep_minutes,
    estimatedReadyAt: order.estimated_ready_at,
    scheduledFor: order.scheduled_for,
    riderName: order.rider_name,
    riderPhone: order.rider_phone,
    deliveryCode: order.delivery_code,
    trackUrl: trackUrl(order.public_token),
  }

  switch (order.status) {
    case 'paid':
      return sendOrderSms(order.id, 'order_paid', order.customer_phone, smsTemplates.orderPaid(info))
    case 'accepted':
      return sendOrderSms(order.id, 'order_accepted', order.customer_phone, smsTemplates.orderAccepted(info))
    case 'out_for_delivery':
      return sendOrderSms(order.id, 'out_for_delivery', order.customer_phone, smsTemplates.outForDelivery(info))
    case 'ready_for_pickup': {
      const { data: settings } = await getAdminSupabase().from('store_settings').select('pickup_address').eq('id', 1).single()
      return sendOrderSms(
        order.id,
        'ready_for_pickup',
        order.customer_phone,
        smsTemplates.readyForPickup(info, settings?.pickup_address ?? 'Adenta'),
      )
    }
    case 'rejected':
      return sendOrderSms(
        order.id,
        'order_rejected',
        order.customer_phone,
        smsTemplates.orderRejected(info, opts.reason ?? order.reject_reason ?? 'restaurant unavailable', opts.refundPesewas ?? 0),
      )
    case 'cancelled':
      if (!order.paid_payment_id) return
      return sendOrderSms(
        order.id,
        'order_cancelled',
        order.customer_phone,
        smsTemplates.orderCancelled(info, opts.reason ?? order.cancel_reason ?? 'cancelled', opts.refundPesewas ?? 0),
      )
    default:
      return
  }
}
