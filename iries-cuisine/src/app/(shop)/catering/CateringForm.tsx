'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { accraDateKey } from '@/lib/time'

export function CateringForm() {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const f = new FormData(e.currentTarget)
    const str = (k: string) => (f.get(k) as string | null)?.trim() || null
    setBusy(true)
    try {
      const res = await fetch('/api/catering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: str('name'),
          phone: str('phone'),
          email: str('email') ?? '',
          eventDate: str('eventDate'),
          eventType: str('eventType'),
          headcount: str('headcount') ? Number(str('headcount')) : null,
          budget: str('budget'),
          location: str('location'),
          menuInterest: str('menuInterest'),
          notes: str('notes'),
          website: str('website') ?? '',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Could not send')
      setDone(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="mt-8 rounded-3xl bg-surface p-6 text-center ring-1 ring-line">
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
        <h2 className="mt-3 font-display text-3xl font-semibold">Thank you!</h2>
        <p className="mt-2 text-muted">We’ve received your enquiry and will call you within one working day.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-line">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="c-name"><Input id="c-name" name="name" required minLength={2} autoComplete="name" /></Field>
        <Field label="Phone" htmlFor="c-phone"><Input id="c-phone" name="phone" type="tel" required placeholder="024 123 4567" autoComplete="tel" /></Field>
        <Field label="Email (optional)" htmlFor="c-email"><Input id="c-email" name="email" type="email" autoComplete="email" /></Field>
        <Field label="Event date" htmlFor="c-date"><Input id="c-date" name="eventDate" type="date" min={accraDateKey()} /></Field>
        <Field label="Type of event" htmlFor="c-type">
          <Select id="c-type" name="eventType" defaultValue="">
            <option value="">Choose…</option>
            <option>Wedding / engagement</option>
            <option>Funeral / one-week</option>
            <option>Naming ceremony / birthday</option>
            <option>Office / corporate</option>
            <option>Church / community</option>
            <option>Other</option>
          </Select>
        </Field>
        <Field label="Number of guests" htmlFor="c-headcount"><Input id="c-headcount" name="headcount" type="number" min={1} max={100000} inputMode="numeric" /></Field>
        <Field label="Budget (optional)" htmlFor="c-budget"><Input id="c-budget" name="budget" placeholder="e.g. GH₵ 5,000" /></Field>
        <Field label="Event location" htmlFor="c-location"><Input id="c-location" name="location" placeholder="Area / venue" /></Field>
      </div>
      <Field label="Dishes you’re interested in" htmlFor="c-menu"><Textarea id="c-menu" name="menuInterest" rows={2} placeholder="Jollof, waakye, kelewele, grilled tilapia…" /></Field>
      <Field label="Anything else?" htmlFor="c-notes"><Textarea id="c-notes" name="notes" rows={3} /></Field>
      {/* Honeypot for bots — hidden from people and screen readers */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-900" role="alert">{error}</p>}
      <Button type="submit" size="lg" block loading={busy}>Send enquiry</Button>
      <p className="text-xs text-muted">We only use these details to respond to your enquiry.</p>
    </form>
  )
}
