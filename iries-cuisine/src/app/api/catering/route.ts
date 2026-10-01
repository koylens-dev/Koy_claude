import type { NextRequest } from 'next/server'
import { after } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { cateringSchema, firstZodMessage } from '@/lib/validation'
import { clientIp, jsonError, jsonOk, rateLimit } from '@/lib/server/http'
import { normalizeGhanaPhone } from '@/lib/phone'
import { serverEnv } from '@/lib/server/env'
import { sendSms } from '@/lib/server/sms'
import { smsTemplates, toGsmSafe } from '@/lib/sms-templates'

// POST /api/catering — catering / bulk-order enquiry, routed to management.
export async function POST(req: NextRequest) {
  if (!(await rateLimit(`catering:${clientIp(req)}`, 5, 3600))) {
    return jsonError(429, 'rate_limited', 'Too many enquiries from this connection. Please call or WhatsApp us.')
  }
  const parsed = cateringSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return jsonError(400, 'invalid_input', firstZodMessage(parsed.error))
  const input = parsed.data
  if (input.website) return jsonOk({ ok: true }) // honeypot filled: quietly ignore bots

  const phone = normalizeGhanaPhone(input.phone)
  if (!phone) return jsonError(422, 'invalid_phone', 'Enter a valid Ghana mobile number.')

  const { error } = await getAdminSupabase().from('catering_enquiries').insert({
    name: input.name,
    phone,
    email: input.email || null,
    event_date: input.eventDate ?? null,
    event_type: input.eventType ?? null,
    headcount: input.headcount ?? null,
    budget: input.budget ?? null,
    location: input.location ?? null,
    menu_interest: input.menuInterest ?? null,
    notes: input.notes ?? null,
  })
  if (error) return jsonError(500, 'save_failed', 'Could not send your enquiry. Please try WhatsApp instead.')

  const message = toGsmSafe(smsTemplates.cateringAlert(input.name, phone, input.eventDate ?? null, input.headcount ?? null))
  after(async () => {
    for (const p of serverEnv.staffAlertPhones) await sendSms(p, message)
  })
  return jsonOk({ ok: true })
}
