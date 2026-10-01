'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { formatGhanaPhone, whatsappLink } from '@/lib/phone'
import { publicEnv } from '@/lib/public-env'

export function AccountForm() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [id, setId] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)

  useEffect(() => {
    const supabase = getBrowserSupabase()
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user
      if (!user) {
        router.replace('/login?next=/account')
        return
      }
      const { data: p } = await supabase.from('profiles').select('phone, full_name, email, marketing_consent').eq('id', user.id).single()
      setId(user.id)
      setPhone(p?.phone ?? null)
      setName(p?.full_name ?? '')
      setEmail(p?.email ?? '')
      setConsent(!!p?.marketing_consent)
      setLoading(false)
    })
  }, [router])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setSaving(true)
    const { error } = await getBrowserSupabase()
      .from('profiles')
      .update({ full_name: name.trim() || null, email: email.trim() || null, marketing_consent: consent })
      .eq('id', id)
    setSaving(false)
    toast(error ? 'Could not save. Please try again.' : 'Saved', error ? 'error' : 'success')
  }

  async function signOut() {
    await getBrowserSupabase().auth.signOut()
    router.replace('/')
    router.refresh()
  }

  if (loading) return <Skeleton className="mt-6 h-72" />

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={save} className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-line">
        <p className="text-sm text-muted">
          Signed in as <strong className="text-ink">{formatGhanaPhone(phone)}</strong>
        </p>
        <Field label="Name" htmlFor="acc-name">
          <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Email (optional)" htmlFor="acc-email">
          <Input id="acc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 accent-[var(--brand)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>Send me offers and new dishes by SMS/WhatsApp.</span>
        </label>
        <Button type="submit" loading={saving} block>
          Save
        </Button>
      </form>

      <div className="rounded-3xl bg-surface p-5 text-sm ring-1 ring-line">
        <h2 className="font-display text-xl font-semibold">Your data</h2>
        <p className="mt-1 text-muted">
          You can ask for a copy of your data or for it to be deleted at any time (Data Protection Act, 2012). Order records needed for tax are kept as the law requires.
        </p>
        {publicEnv.whatsappNumber && (
          <a className="mt-3 inline-block font-semibold text-brand underline" href={whatsappLink(publicEnv.whatsappNumber, `Data request for my account ${phone ?? ''}: `)} target="_blank" rel="noopener noreferrer">
            Request my data / deletion
          </a>
        )}
      </div>

      <Button variant="secondary" block onClick={signOut}>
        Sign out
      </Button>
    </div>
  )
}
