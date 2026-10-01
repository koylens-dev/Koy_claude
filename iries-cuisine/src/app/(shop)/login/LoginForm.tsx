'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { formatGhanaPhone, normalizeGhanaPhone } from '@/lib/phone'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'

function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNext(params.get('next'))
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phoneInput, setPhoneInput] = useState('')
  const [phone, setPhone] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)
    const normalized = normalizeGhanaPhone(phoneInput)
    if (!normalized) {
      setError('Enter a Ghana mobile number, e.g. 024 123 4567')
      return
    }
    setBusy(true)
    const { error } = await getBrowserSupabase().auth.signInWithOtp({ phone: normalized })
    setBusy(false)
    if (error) {
      setError(error.status === 429 ? 'Too many attempts — please wait a few minutes.' : 'We could not send the code. Check the number and try again.')
      return
    }
    setPhone(normalized)
    setStep('code')
    setCooldown(60)
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (!phone) return
    setError(null)
    setBusy(true)
    const { error } = await getBrowserSupabase().auth.verifyOtp({ phone, token: code.trim(), type: 'sms' })
    setBusy(false)
    if (error) {
      setError('That code is wrong or has expired. Request a new one.')
      return
    }
    router.replace(next)
    router.refresh()
  }

  if (step === 'phone') {
    return (
      <form onSubmit={sendCode} className="mt-8 space-y-5">
        <Field label="Mobile number" htmlFor="phone" error={error} hint="MTN, Telecel or AT — the number you’ll pay with is easiest.">
          <div className="flex">
            <span className="inline-flex items-center rounded-l-xl border border-r-0 border-line bg-brand-soft/50 px-3 font-semibold">🇬🇭 +233</span>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="024 123 4567"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="rounded-l-none"
              required
            />
          </div>
        </Field>
        <Button type="submit" size="lg" block loading={busy}>
          Text me a code
        </Button>
        <p className="text-xs leading-relaxed text-muted">
          By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link>. We use your number for your orders and sign-in only, unless you choose to receive offers.
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={verify} className="mt-8 space-y-5">
      <Field label={`Code sent to ${formatGhanaPhone(phone)}`} htmlFor="code" error={error}>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="text-center text-2xl tracking-[0.5em]"
          autoFocus
          required
        />
      </Field>
      <Button type="submit" size="lg" block loading={busy} disabled={code.length !== 6}>
        Verify and continue
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" className="min-h-11 font-semibold text-brand" onClick={() => { setStep('phone'); setCode('') }}>
          Change number
        </button>
        <button type="button" className="min-h-11 font-semibold text-brand disabled:text-muted" disabled={cooldown > 0 || busy} onClick={() => sendCode()}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </form>
  )
}
