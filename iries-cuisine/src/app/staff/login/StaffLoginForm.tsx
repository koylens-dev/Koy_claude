'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'

export function StaffLoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/staff'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(params.get('error') === 'not_staff' ? 'This account is not an active staff account.' : null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await getBrowserSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    setBusy(false)
    if (error) {
      setError(error.status === 429 ? 'Too many attempts. Wait a few minutes.' : 'Wrong email or password.')
      return
    }
    router.replace(next)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <Field label="Email" htmlFor="staff-email">
        <Input id="staff-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Password" htmlFor="staff-password">
        <Input id="staff-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-900" role="alert">{error}</p>}
      <Button type="submit" size="lg" block loading={busy}>
        Sign in
      </Button>
      <p className="text-xs text-muted">Forgot your password? Ask the manager to reset it in Admin › Staff.</p>
    </form>
  )
}
