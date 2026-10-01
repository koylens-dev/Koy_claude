import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { verifyStandardWebhook } from '@/lib/signatures'
import { serverEnv } from '@/lib/server/env'
import { sendSms } from '@/lib/server/sms'
import { smsTemplates } from '@/lib/sms-templates'
import { rateLimit } from '@/lib/server/http'
import { normalizeGhanaPhone } from '@/lib/phone'

// Supabase Auth "Send SMS" hook: Supabase generates the OTP and calls us to deliver
// it through a Ghanaian SMS provider (much cheaper than Twilio for +233 numbers).
// Configure in Supabase → Authentication → Hooks → Send SMS → HTTPS, URL:
//   https://<your-domain>/api/auth/sms-hook
function hookError(httpCode: number, message: string) {
  return NextResponse.json({ error: { http_code: httpCode, message } }, { status: httpCode })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const valid = verifyStandardWebhook({
    rawBody,
    id: req.headers.get('webhook-id'),
    timestamp: req.headers.get('webhook-timestamp'),
    signatureHeader: req.headers.get('webhook-signature'),
    secret: serverEnv.smsHookSecret,
  })
  if (!valid) return hookError(401, 'Invalid hook signature')

  const payload = JSON.parse(rawBody) as { user?: { phone?: string }; sms?: { otp?: string } }
  const phone = normalizeGhanaPhone(payload.user?.phone)
  const otp = payload.sms?.otp
  if (!phone || !otp) return hookError(400, 'Only Ghana mobile numbers are supported.')

  // Supabase rate-limits OTPs too; this is a second guard per number against SMS pumping.
  if (!(await rateLimit(`otp:${phone}`, 5, 3600))) return hookError(429, 'Too many codes requested. Try again later.')

  const result = await sendSms(phone, smsTemplates.otp(otp))
  if (!result.ok) return hookError(502, 'Could not send the SMS. Please try again.')
  return NextResponse.json({})
}
