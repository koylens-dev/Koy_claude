import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { serverEnv } from '@/lib/server/env'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { verifyAndProcess } from '@/lib/server/payments'
import { fetchRefund } from '@/lib/server/paystack'
import { sendOrderSms } from '@/lib/server/notify'
import { smsTemplates } from '@/lib/sms-templates'
import { jsonError, jsonOk } from '@/lib/server/http'
import { minutesBetween } from '@/lib/time'

export const maxDuration = 60

// GET /api/cron — housekeeping, every 5 minutes (vercel.json). Vercel sends
// "Authorization: Bearer $CRON_SECRET" automatically when CRON_SECRET is set.
//  1. Re-check open payments with Paystack (catches missed webhooks, MoMo approvals)
//  2. Cancel orders unpaid past the timeout
//  3. Auto-complete delivered orders after 2 hours
//  4. Refresh pending refunds
//  5. SMS a manager if a paid order sits unaccepted
//  6. Clean old rate-limit rows
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${serverEnv.cronSecret}`) {
    return jsonError(401, 'unauthorized', 'Unauthorized')
  }
  const admin = getAdminSupabase()
  const report: Record<string, unknown> = {}

  // 1. open payments, oldest first, not checked in the last 3 minutes
  try {
    const { data: open } = await admin
      .from('payments')
      .select('reference, created_at, last_checked_at')
      .in('status', ['initialized', 'pending', 'abandoned'])
      .lt('created_at', new Date(Date.now() - 2 * 60_000).toISOString())
      .gt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
      .or(`last_checked_at.is.null,last_checked_at.lt.${new Date(Date.now() - 3 * 60_000).toISOString()}`)
      .order('created_at')
      .limit(25)
    let checked = 0
    for (const p of open ?? []) {
      try {
        await verifyAndProcess(p.reference)
      } catch {
        // Paystack returns an error for transactions that were initialised but never attempted.
      }
      await admin.from('payments').update({ last_checked_at: new Date().toISOString() }).eq('reference', p.reference)
      checked++
    }
    report.paymentsChecked = checked
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'cron-payments' } })
  }

  // 2 + 3
  const [expired, completed] = await Promise.all([
    admin.rpc('expire_unpaid_orders'),
    admin.rpc('auto_complete_orders', { p_after_minutes: 120 }),
  ])
  report.expired = expired.data
  report.autoCompleted = completed.data

  // 4. refunds still pending at the gateway
  try {
    const { data: refunds } = await admin
      .from('refunds')
      .select('provider_refund_id')
      .in('status', ['pending', 'processing'])
      .not('provider_refund_id', 'is', null)
      .lt('updated_at', new Date(Date.now() - 10 * 60_000).toISOString())
      .limit(20)
    for (const r of refunds ?? []) {
      try {
        const g = await fetchRefund(r.provider_refund_id as string)
        await admin.rpc('update_refund_status', {
          p_provider_refund_id: r.provider_refund_id,
          p_transaction_reference: null,
          p_amount_pesewas: null,
          p_status: g.status === 'needs-attention' ? 'failed' : g.status,
        })
        // touch updated_at so we don't hammer Paystack for the same refund
        await admin.from('refunds').update({ updated_at: new Date().toISOString() }).eq('provider_refund_id', r.provider_refund_id)
      } catch {
        /* try again next run */
      }
    }
    report.refundsChecked = refunds?.length ?? 0
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'cron-refunds' } })
  }

  // 5. paid but not accepted for too long -> SMS the managers once per order
  const phones = serverEnv.staffAlertPhones
  if (phones.length) {
    const cutoff = new Date(Date.now() - serverEnv.staffAlertAfterMinutes * 60_000).toISOString()
    const { data: waiting } = await admin
      .from('orders')
      .select('id, order_number, total_pesewas, paid_at')
      .eq('status', 'paid')
      .lt('paid_at', cutoff)
      .limit(10)
    for (const o of waiting ?? []) {
      for (const phone of phones) {
        await sendOrderSms(
          o.id,
          `staff_alert:${phone}`,
          phone,
          smsTemplates.staffUnaccepted(o.order_number, o.total_pesewas, minutesBetween(o.paid_at!)),
        )
      }
    }
    report.staffAlerts = waiting?.length ?? 0
  }

  await admin.rpc('maintenance_cleanup')
  return jsonOk({ ok: true, ...report })
}
