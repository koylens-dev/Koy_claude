import 'server-only'

import { serverEnv } from './env'
import { toMsisdn } from '@/lib/phone'

// Ghana SMS providers behind one function. Set SMS_PROVIDER=arkesel (recommended)
// or mnotify; SMS_FALLBACK_PROVIDER lets a second provider take over if the first fails.
// "console" just logs (local development); "none" disables SMS entirely.

export type SmsResult = { ok: boolean; provider: string; messageId?: string; error?: string }
type Provider = 'arkesel' | 'mnotify' | 'console' | 'none'

async function sendArkesel(to: string, message: string): Promise<SmsResult> {
  const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
    method: 'POST',
    headers: { 'api-key': serverEnv.arkeselApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: serverEnv.smsSenderId, message, recipients: [toMsisdn(to)] }),
    signal: AbortSignal.timeout(15_000),
  })
  const json = (await res.json().catch(() => null)) as { status?: string; message?: string; data?: { id?: string }[] } | null
  if (!res.ok || json?.status !== 'success') {
    return { ok: false, provider: 'arkesel', error: json?.message ?? `HTTP ${res.status}` }
  }
  return { ok: true, provider: 'arkesel', messageId: json.data?.[0]?.id }
}

async function sendMnotify(to: string, message: string): Promise<SmsResult> {
  const url = `https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(serverEnv.mnotifyApiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: [`0${toMsisdn(to).slice(3)}`],
      sender: serverEnv.smsSenderId,
      message,
      is_schedule: false,
      schedule_date: '',
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const json = (await res.json().catch(() => null)) as { status?: string; message?: string; summary?: { _id?: string } } | null
  if (!res.ok || json?.status !== 'success') {
    return { ok: false, provider: 'mnotify', error: json?.message ?? `HTTP ${res.status}` }
  }
  return { ok: true, provider: 'mnotify', messageId: json.summary?._id }
}

async function sendVia(provider: Provider, to: string, message: string): Promise<SmsResult> {
  try {
    switch (provider) {
      case 'arkesel':
        return await sendArkesel(to, message)
      case 'mnotify':
        return await sendMnotify(to, message)
      case 'none':
        return { ok: false, provider: 'none', error: 'SMS disabled (SMS_PROVIDER=none)' }
      default:
        console.info(`[sms:console] to=${to} (${message.length} chars): ${message}`)
        return { ok: true, provider: 'console', messageId: `console-${Date.now()}` }
    }
  } catch (err) {
    return { ok: false, provider, error: (err as Error).message }
  }
}

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const primary = serverEnv.smsProvider
  const result = await sendVia(primary, to, message)
  if (result.ok || primary === 'none') return result

  const fallback = (process.env.SMS_FALLBACK_PROVIDER ?? '').toLowerCase() as Provider
  if ((fallback === 'arkesel' || fallback === 'mnotify') && fallback !== primary) {
    const second = await sendVia(fallback, to, message)
    if (second.ok) return second
    return { ...second, error: `${primary}: ${result.error}; ${fallback}: ${second.error}` }
  }
  return result
}
