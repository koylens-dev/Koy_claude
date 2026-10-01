import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { bodyFingerprint, verifyPaystackSignature } from '@/lib/signatures'
import { serverEnv } from '@/lib/server/env'
import { PAYSTACK_WEBHOOK_IPS } from '@/lib/server/paystack'
import { verifyAndProcess } from '@/lib/server/payments'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { clientIp, jsonError, jsonOk } from '@/lib/server/http'

// POST /api/webhooks/paystack
// 1. Reject anything not signed with our Paystack secret key (HMAC-SHA512 of the raw body).
// 2. Drop exact duplicate deliveries (same body) once they have been processed.
// 3. For charges, re-verify with the Paystack API and then confirm in the database
//    (idempotent, row-locked) — a webhook alone never marks an order paid.
// 4. Answer 200 quickly; answer 500 only if we want Paystack to retry.
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature')

  if (!verifyPaystackSignature(rawBody, signature, serverEnv.paystackSecretKey)) {
    return jsonError(401, 'invalid_signature', 'Invalid signature')
  }
  if (serverEnv.paystackEnforceIpAllowlist && !PAYSTACK_WEBHOOK_IPS.includes(clientIp(req))) {
    return jsonError(403, 'ip_not_allowed', 'Forbidden')
  }

  let event: { event?: string; data?: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return jsonError(400, 'invalid_json', 'Invalid JSON')
  }

  const admin = getAdminSupabase()
  const type = event.event ?? 'unknown'
  const data = event.data ?? {}
  const reference =
    (data.reference as string | undefined) ??
    (data.transaction_reference as string | undefined) ??
    ((data.transaction as { reference?: string } | undefined)?.reference ?? null)
  const dedupeKey = bodyFingerprint(rawBody)

  // Record the delivery; if we've already processed this exact body, stop here.
  const { data: existing } = await admin
    .from('webhook_events')
    .select('id, processed_at')
    .eq('provider', 'paystack')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle()
  if (existing?.processed_at) return jsonOk({ received: true, duplicate: true })

  let eventId = existing?.id as number | undefined
  if (!eventId) {
    const { data: inserted } = await admin
      .from('webhook_events')
      .upsert(
        { provider: 'paystack', dedupe_key: dedupeKey, event_type: type, reference, payload: event },
        { onConflict: 'provider,dedupe_key', ignoreDuplicates: true },
      )
      .select('id')
    eventId = inserted?.[0]?.id
  }

  try {
    let result = 'ignored'
    if (type === 'charge.success' && reference) {
      const outcome = await verifyAndProcess(reference)
      result = outcome.result
    } else if (type.startsWith('refund.')) {
      const status = (data.status as string | undefined) ?? type.split('.')[1]
      const { data: upd } = await admin.rpc('update_refund_status', {
        p_provider_refund_id: data.id != null ? String(data.id) : null,
        p_transaction_reference: reference,
        p_amount_pesewas: typeof data.amount === 'number' ? data.amount : null,
        p_status: status,
      })
      result = (upd as { result?: string } | null)?.result ?? 'refund_update'
    }

    if (eventId) {
      await admin.from('webhook_events').update({ processed_at: new Date().toISOString(), result }).eq('id', eventId)
    }
    return jsonOk({ received: true, result })
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'paystack-webhook' }, extra: { type, reference } })
    if (eventId) {
      await admin.from('webhook_events').update({ error: (err as Error).message.slice(0, 1000) }).eq('id', eventId)
    }
    // 500 => Paystack retries later; the cron sweep also re-checks open payments.
    return jsonError(500, 'processing_failed', 'Will retry')
  }
}
