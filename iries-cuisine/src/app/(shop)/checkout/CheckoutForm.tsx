'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bike, Store, MapPin, LockKeyhole, AlertTriangle, Check, LocateFixed } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { useCart } from '@/components/customer/CartProvider'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { formatCedis } from '@/lib/money'
import { formatGhanaPhone } from '@/lib/phone'
import { normalizeGhanaPostGps } from '@/lib/ghana-post'
import { formatSlot, isOpenForAsap, localParts, scheduleSlots, type HoursConfig, type OpeningWindow } from '@/lib/time'
import type { DeliveryZone, StoreSettings } from '@/lib/types'
import type { PublicQuote } from '@/lib/server/quote'
import { cn } from '@/lib/cn'

type Prefs = {
  fulfilment: 'delivery' | 'pickup'
  zoneId: string
  gps: string
  landmark: string
  directions: string
  lat: number | null
  lng: number | null
  name: string
  email: string
}

const PREFS_KEY = 'iries-checkout-v1'

export function CheckoutForm() {
  const router = useRouter()
  const toast = useToast()
  const cart = useCart()

  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [hours, setHours] = useState<OpeningWindow[]>([])
  const [closed, setClosed] = useState<string[]>([])
  const [phone, setPhone] = useState<string | null>(null)

  const [prefs, setPrefs] = useState<Prefs>({
    fulfilment: 'delivery',
    zoneId: '',
    gps: '',
    landmark: '',
    directions: '',
    lat: null,
    lng: null,
    name: '',
    email: '',
  })
  const [when, setWhen] = useState<'asap' | 'later'>('asap')
  const [slot, setSlot] = useState('')
  const [notes, setNotes] = useState('')
  const [consent, setConsent] = useState(false)
  const [locating, setLocating] = useState(false)

  const [quote, setQuote] = useState<PublicQuote | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const quoteSeq = useRef(0)

  // Load store data + profile + saved preferences
  useEffect(() => {
    const supabase = getBrowserSupabase()
    ;(async () => {
      // getSession() reads the session stored on this phone (no network round-trip), so a
      // flaky connection never bounces a signed-in customer to the login page. The server
      // re-verifies the session on every API call.
      const [{ data: auth }, s, z, h, c] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from('store_settings').select('*').eq('id', 1).single(),
        supabase.from('delivery_zones').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('opening_hours').select('day_of_week, opens_at, closes_at'),
        supabase.from('closed_dates').select('closed_on'),
      ])
      const user = auth.session?.user
      if (!user) {
        router.replace('/login?next=/checkout')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone, full_name, email, marketing_consent, default_zone_id, default_address')
        .eq('id', user.id)
        .single()

      let saved: Partial<Prefs> = {}
      try {
        saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')
      } catch {}
      const addr = (profile?.default_address ?? {}) as { gps?: string; landmark?: string; directions?: string; lat?: number; lng?: number }
      const st = s.data as StoreSettings
      setSettings(st)
      setZones((z.data ?? []) as DeliveryZone[])
      setHours((h.data ?? []) as OpeningWindow[])
      setClosed((c.data ?? []).map((r: { closed_on: string }) => r.closed_on))
      setPhone(profile?.phone ?? (user.phone ? `+${user.phone.replace(/^\+/, '')}` : null))
      setConsent(!!profile?.marketing_consent)
      setPrefs((p) => ({
        ...p,
        ...saved,
        fulfilment: st.delivery_enabled ? (saved.fulfilment ?? 'delivery') : 'pickup',
        zoneId: saved.zoneId ?? profile?.default_zone_id ?? '',
        gps: saved.gps ?? addr.gps ?? '',
        landmark: saved.landmark ?? addr.landmark ?? '',
        directions: saved.directions ?? addr.directions ?? '',
        lat: saved.lat ?? addr.lat ?? null,
        lng: saved.lng ?? addr.lng ?? null,
        name: profile?.full_name ?? saved.name ?? '',
        email: profile?.email ?? saved.email ?? '',
      }))
      setLoading(false)
    })()
  }, [router])

  useEffect(() => {
    if (loading) return
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {}
  }, [prefs, loading])

  const cfg: HoursConfig | null = useMemo(
    () =>
      settings && {
        hours,
        closedDates: closed,
        acceptingOrders: settings.accepting_orders,
        lastOrderMinutesBeforeClose: settings.last_order_minutes_before_close,
        schedulingEnabled: settings.scheduling_enabled,
        scheduleDaysAhead: settings.schedule_days_ahead,
        slotMinutes: settings.slot_minutes,
        minScheduleLeadMinutes: settings.min_schedule_lead_minutes,
      },
    [settings, hours, closed],
  )
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const openNow = cfg ? isOpenForAsap(now, cfg) : true
  const slots = useMemo(() => (cfg ? scheduleSlots(now, cfg) : []), [cfg, now])
  const slotDays = useMemo(() => {
    const days = new Map<string, Date[]>()
    for (const s of slots) {
      const k = localParts(s).dateKey
      days.set(k, [...(days.get(k) ?? []), s])
    }
    return days
  }, [slots])

  // If closed, default to scheduling
  useEffect(() => {
    if (!loading && !openNow && slots.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWhen('later')
    }
  }, [loading, openNow, slots.length])
  useEffect(() => {
    if (when === 'later' && slots.length && !slots.some((s) => s.toISOString() === slot)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlot(slots[0].toISOString())
    }
  }, [when, slots, slot])

  const payload = useCallback(
    (mode: 'quote' | 'place') => ({
      mode,
      fulfilment: prefs.fulfilment,
      zoneId: prefs.fulfilment === 'delivery' && prefs.zoneId ? prefs.zoneId : null,
      address: {
        gps: prefs.gps || null,
        landmark: prefs.landmark || null,
        directions: prefs.directions || null,
        lat: prefs.lat,
        lng: prefs.lng,
      },
      scheduledFor: when === 'later' && slot ? slot : null,
      notes: notes || null,
      lines: cart.lines.map((l) => ({
        itemId: l.itemId,
        portionId: l.portionId,
        optionIds: l.options.map((o) => o.id),
        quantity: l.quantity,
        notes: l.notes || null,
      })),
      customer: { name: prefs.name.trim() || 'Customer', email: prefs.email.trim(), marketingConsent: consent },
    }),
    [prefs, when, slot, notes, cart.lines, consent],
  )

  // Live server quote (debounced): exact prices, fees and any problem before paying.
  useEffect(() => {
    if (loading || !cart.hydrated || cart.lines.length === 0) return
    const seq = ++quoteSeq.current
    const t = setTimeout(async () => {
      setQuoting(true)
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload('quote')),
        })
        const json = await res.json()
        if (seq !== quoteSeq.current) return
        if (json.quote) {
          setQuote(json.quote)
          setError(null)
        } else setError(json.error?.message ?? 'Could not price your order.')
      } catch {
        if (seq === quoteSeq.current) setError('You seem to be offline. We’ll update the total when you reconnect.')
      } finally {
        if (seq === quoteSeq.current) setQuoting(false)
      }
    }, 450)
    return () => clearTimeout(t)
  }, [payload, loading, cart.hydrated, cart.lines.length])

  async function placeOrder() {
    setError(null)
    if (prefs.name.trim().length < 2) {
      setError('Please enter your name.')
      return
    }
    setPlacing(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload('place')),
      })
      const json = await res.json()
      if (json.token) {
        cart.clear()
        if (json.authorizationUrl) {
          window.location.assign(json.authorizationUrl)
          return
        }
        router.push(`/t/${json.token}?error=gateway_unavailable`)
        return
      }
      if (json.quote) setQuote(json.quote)
      setError(json.error?.message ?? json.quote?.issues?.[0]?.message ?? 'Please check your order details.')
      setPlacing(false)
    } catch {
      setError('Network problem — your order was not placed. Please try again.')
      setPlacing(false)
    }
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      toast('Location is not available on this device.', 'error')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPrefs((p) => ({ ...p, lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) }))
        setLocating(false)
        toast(`Location pinned (±${Math.round(pos.coords.accuracy)} m)`, 'success')
      },
      () => {
        setLocating(false)
        toast('Could not get your location. Please allow location access or add a landmark.', 'error')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  if (!cart.hydrated || loading) {
    return (
      <div className="mt-6 space-y-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
      </div>
    )
  }

  if (cart.lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted">Your order is empty.</p>
        <Link href="/" className={buttonClasses({ className: 'mt-4' })}>
          Browse the menu
        </Link>
      </div>
    )
  }

  const zone = zones.find((z) => z.id === prefs.zoneId)
  const gpsOk = !prefs.gps || !!normalizeGhanaPostGps(prefs.gps)
  const lineIssue = (index: number) => quote?.issues.find((i) => i.lineIndex === index)
  // The server returns priced lines in cart order, skipping lines that have a problem.
  const pricedByIndex: (PublicQuote['lines'][number] | null)[] = []
  {
    let j = 0
    cart.lines.forEach((_, i) => pricedByIndex.push(lineIssue(i) ? null : (quote?.lines[j++] ?? null)))
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {/* Delivery or pickup */}
        <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          <h2 className="font-display text-2xl font-semibold">How would you like it?</h2>
          <div className="mt-4 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Delivery or pickup">
            {(['delivery', 'pickup'] as const).map((f) => {
              const enabled = f === 'delivery' ? settings?.delivery_enabled : settings?.pickup_enabled
              const Icon = f === 'delivery' ? Bike : Store
              return (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={prefs.fulfilment === f}
                  disabled={!enabled}
                  onClick={() => setPrefs((p) => ({ ...p, fulfilment: f }))}
                  className={cn(
                    'flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-3 font-semibold disabled:opacity-40',
                    prefs.fulfilment === f ? 'border-brand bg-brand-soft/60' : 'border-line',
                  )}
                >
                  <Icon className="size-6" aria-hidden />
                  {f === 'delivery' ? 'Delivery' : 'Pickup'}
                  {!enabled && <span className="text-xs font-normal">Paused</span>}
                </button>
              )
            })}
          </div>

          {prefs.fulfilment === 'delivery' ? (
            <div className="mt-5 space-y-4">
              <Field label="Delivery area" htmlFor="zone" hint={zone ? `Delivery ${formatCedis(zone.fee_pesewas)} · about ${zone.eta_minutes} min after cooking · min. order ${formatCedis(zone.min_order_pesewas)}${zone.areas ? ` · ${zone.areas}` : ''}` : 'Choose the area closest to you'}>
                <Select id="zone" value={prefs.zoneId} onChange={(e) => setPrefs((p) => ({ ...p, zoneId: e.target.value }))}>
                  <option value="">Select your area…</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {formatCedis(z.fee_pesewas)} · {z.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ghana Post GPS address (optional)" htmlFor="gps" error={!gpsOk ? 'Format looks like GA-543-0125' : undefined} hint="Find it in the GhanaPostGPS app">
                <Input
                  id="gps"
                  value={prefs.gps}
                  onChange={(e) => setPrefs((p) => ({ ...p, gps: e.target.value.toUpperCase() }))}
                  onBlur={() => setPrefs((p) => ({ ...p, gps: normalizeGhanaPostGps(p.gps) ?? p.gps }))}
                  placeholder="GA-543-0125"
                  autoCapitalize="characters"
                  maxLength={14}
                />
              </Field>
              <Field label="Landmark" htmlFor="landmark" hint="Something a rider can ask for: a church, school, shop or junction">
                <Input id="landmark" value={prefs.landmark} onChange={(e) => setPrefs((p) => ({ ...p, landmark: e.target.value }))} placeholder="Behind Adenta SDA church" maxLength={200} required />
              </Field>
              <Field label="Directions (optional)" htmlFor="directions">
                <Textarea id="directions" rows={2} value={prefs.directions} onChange={(e) => setPrefs((p) => ({ ...p, directions: e.target.value }))} placeholder="Blue gate, 3rd house after the pharmacy" maxLength={300} />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={useMyLocation} loading={locating}>
                  <LocateFixed className="size-4" aria-hidden /> {prefs.lat ? 'Update my location pin' : 'Pin my current location'}
                </Button>
                {prefs.lat && prefs.lng && (
                  <a className="inline-flex items-center gap-1 text-sm font-semibold text-success" href={`https://www.google.com/maps/search/?api=1&query=${prefs.lat},${prefs.lng}`} target="_blank" rel="noopener noreferrer">
                    <Check className="size-4" aria-hidden /> Pinned — check on map
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-5 flex items-start gap-2 rounded-2xl bg-brand-soft/50 p-4 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              Pick up at: <strong className="ml-1">{settings?.pickup_address}</strong>
            </p>
          )}
        </section>

        {/* When */}
        <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          <h2 className="font-display text-2xl font-semibold">When?</h2>
          <div className="mt-4 grid grid-cols-2 gap-3" role="radiogroup" aria-label="When">
            <button
              type="button"
              role="radio"
              aria-checked={when === 'asap'}
              disabled={!openNow}
              onClick={() => setWhen('asap')}
              className={cn('min-h-14 rounded-2xl border-2 px-3 font-semibold disabled:opacity-40', when === 'asap' ? 'border-brand bg-brand-soft/60' : 'border-line')}
            >
              As soon as possible
              {!openNow && <span className="block text-xs font-normal">We’re closed now</span>}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={when === 'later'}
              disabled={slots.length === 0}
              onClick={() => setWhen('later')}
              className={cn('min-h-14 rounded-2xl border-2 px-3 font-semibold disabled:opacity-40', when === 'later' ? 'border-brand bg-brand-soft/60' : 'border-line')}
            >
              Schedule for later
            </button>
          </div>
          {when === 'later' && slots.length > 0 && (
            <Field className="mt-4" label={prefs.fulfilment === 'delivery' ? 'Deliver at about' : 'Pick up at about'} htmlFor="slot">
              <Select id="slot" value={slot} onChange={(e) => setSlot(e.target.value)}>
                {[...slotDays.entries()].map(([day, list]) => (
                  <optgroup key={day} label={formatSlot(list[0], now).split(',')[0]}>
                    {list.map((s) => (
                      <option key={s.toISOString()} value={s.toISOString()}>
                        {formatSlot(s, now)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
          )}
        </section>

        {/* Contact */}
        <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          <h2 className="font-display text-2xl font-semibold">Your details</h2>
          <div className="mt-4 space-y-4">
            <Field label="Name" htmlFor="name">
              <Input id="name" autoComplete="name" value={prefs.name} onChange={(e) => setPrefs((p) => ({ ...p, name: e.target.value }))} placeholder="Ama Mensah" maxLength={120} required />
            </Field>
            <p className="text-sm text-muted">
              Phone: <strong className="text-ink">{formatGhanaPhone(phone)}</strong> (verified) — order updates come by SMS.
            </p>
            <Field label="Email for receipts (optional)" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" value={prefs.email} onChange={(e) => setPrefs((p) => ({ ...p, email: e.target.value }))} placeholder="you@example.com" />
            </Field>
            <Field label="Order notes (optional)" htmlFor="notes">
              <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else we should know?" maxLength={500} />
            </Field>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 size-5 accent-[var(--brand)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Send me occasional offers and new dishes by SMS/WhatsApp. You can opt out any time.</span>
            </label>
          </div>
        </section>
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          <h2 className="font-display text-2xl font-semibold">Summary</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {cart.lines.map((l, i) => {
              const issue = lineIssue(i)
              const priced = pricedByIndex[i]
              return (
                <li key={l.key}>
                  <div className="flex justify-between gap-3">
                    <span>
                      <strong>{l.quantity}×</strong> {l.name}
                      <span className="block text-xs text-muted">
                        {l.portionName}
                        {l.options.length > 0 && ` · ${l.options.map((o) => o.name).join(', ')}`}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium">{priced ? formatCedis(priced.line_total_pesewas) : '…'}</span>
                  </div>
                  {issue && (
                    <p className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-900">
                      {issue.message}
                      <button type="button" className="font-semibold underline" onClick={() => cart.remove(l.key)}>
                        Remove
                      </button>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt>Food</dt>
              <dd>{quote ? formatCedis(quote.subtotal) : '…'}</dd>
            </div>
            {prefs.fulfilment === 'delivery' && (
              <div className="flex justify-between">
                <dt>Delivery{quote?.zone ? ` (${quote.zone.name})` : ''}</dt>
                <dd>{quote?.zone ? formatCedis(quote.deliveryFee) : '—'}</dd>
              </div>
            )}
            <div className="flex justify-between pt-2 text-lg font-bold">
              <dt>Total</dt>
              <dd>{quote ? formatCedis(quote.total) : '…'}</dd>
            </div>
          </dl>

          {quote && quote.issues.filter((i) => i.lineIndex === undefined).length > 0 && (
            <ul className="mt-4 space-y-2">
              {quote.issues
                .filter((i) => i.lineIndex === undefined)
                .map((i) => (
                  <li key={i.code} className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {i.message}
                  </li>
                ))}
            </ul>
          )}
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-900" role="alert">
              {error}
            </p>
          )}

          <Button size="lg" block className="mt-5" onClick={placeOrder} loading={placing} disabled={!quote?.ok || quoting || placing || !gpsOk}>
            <LockKeyhole className="size-4" aria-hidden />
            {quote?.ok ? `Pay ${formatCedis(quote.total)}` : 'Pay'}
          </Button>
          <p className="mt-3 text-center text-xs text-muted">
            MoMo (MTN, Telecel, AT) or Visa/Mastercard via Paystack. Your order goes to the kitchen once payment is confirmed.
          </p>
        </div>
      </aside>
    </div>
  )
}
