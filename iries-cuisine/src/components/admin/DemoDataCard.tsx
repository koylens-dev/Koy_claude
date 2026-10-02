'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, FlaskConical, Trash2 } from 'lucide-react'
import { useAdmin } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'

type Status = { orders: number; catering: number; staff: { user_id: string; display_name: string; role: string; is_active: boolean }[] }
type Login = { role: string; name: string; email: string; password: string }

/**
 * Demo / training data: six weeks of realistic orders, live orders on every screen,
 * catering enquiries and a practice login per role. Demo orders never send SMS and
 * never touch Paystack. The owner removes everything in one click before go-live.
 */
export function DemoDataCard() {
  const { role } = useAdmin()
  const toast = useToast()
  const owner = role === 'owner'
  const [status, setStatus] = useState<Status | null>(null)
  const [confirm, setConfirm] = useState<null | 'seed' | 'clear'>(null)
  const [busy, setBusy] = useState(false)
  const [logins, setLogins] = useState<Login[] | null>(null)

  const load = useCallback(
    () =>
      fetch('/api/admin/demo')
        .then((r) => (r.ok ? r.json() : null))
        .then((json: Status | null) => json && setStatus(json))
        .catch(() => undefined),
    [],
  )
  useEffect(() => {
    load()
  }, [load])

  async function run(action: 'seed' | 'clear') {
    setBusy(true)
    const res = await fetch('/api/admin/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }).catch(() => null)
    setBusy(false)
    const json = await res?.json().catch(() => null)
    setConfirm(null)
    if (!res?.ok) {
      toast(json?.error?.message ?? 'Something went wrong. Try again.', 'error')
      return
    }
    if (action === 'seed') {
      setLogins(json.logins ?? [])
      toast(`Demo data loaded: ${(json.seeded.history_orders + json.seeded.live_orders).toLocaleString('en-GH')} orders`, 'success')
    } else {
      toast(`Removed ${json.orders} demo orders, ${json.catering} enquiries and ${json.staff} practice logins`, 'success')
    }
    load()
  }

  const copy = (text: string, label: string) => navigator.clipboard.writeText(text).then(() => toast(`${label} copied`, 'success'))
  const loaded = !!status && (status.orders > 0 || status.catering > 0 || status.staff.some((s) => s.is_active))
  const activeLogins = status?.staff.filter((s) => s.is_active) ?? []

  return (
    <section className="space-y-3 rounded-3xl bg-surface p-5 ring-1 ring-fuchsia-200" aria-labelledby="demo-heading">
      <h2 id="demo-heading" className="flex items-center gap-2 font-sans text-base font-semibold">
        <FlaskConical className="size-5 text-fuchsia-700" aria-hidden /> Demo &amp; training data
      </h2>

      {!status ? (
        <Skeleton className="h-16" />
      ) : loaded ? (
        <>
          <p className="rounded-xl bg-fuchsia-50 p-3 text-sm text-fuchsia-950">
            <strong>Demo data is loaded:</strong> {status.orders.toLocaleString('en-GH')} orders, {status.catering} catering enquiries,{' '}
            {activeLogins.length} practice logins. Reports include these orders. Demo orders are marked <strong>DEMO</strong>, never text
            anyone and never take money.
          </p>
          {owner ? (
            <Button variant="danger" onClick={() => setConfirm('clear')}>
              <Trash2 className="size-4" aria-hidden /> Remove all demo data
            </Button>
          ) : (
            <p className="text-sm text-muted">Only the owner can remove demo data.</p>
          )}
          <p className="text-xs text-muted">Remove it before go-live so your reports show real sales only. Real orders are never touched.</p>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">
            Load six weeks of realistic sample orders so you can explore the reports, plus live orders on the Orders and Kitchen screens
            so staff can practise accepting, cooking, dispatching and refunding. You also get a practice login for each role. Nothing is
            sent to customers and no money moves. Remove it all in one click when you are done.
          </p>
          {owner ? (
            <Button onClick={() => setConfirm('seed')}>
              <FlaskConical className="size-4" aria-hidden /> Load demo data
            </Button>
          ) : (
            <p className="text-sm text-muted">Only the owner can load demo data.</p>
          )}
        </>
      )}

      {logins && logins.length > 0 && (
        <div className="space-y-2 rounded-xl bg-cream p-3">
          <p className="text-sm font-semibold">Practice logins: shown once, copy them now</p>
          <p className="text-xs text-muted">Sign in at /staff/login. They stop working when you remove the demo data.</p>
          <ul className="divide-y divide-line text-sm">
            {logins.map((l) => (
              <li key={l.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="w-24 font-semibold capitalize">{l.role}</span>
                <span className="min-w-0 flex-1 break-all font-mono text-xs">{l.email}</span>
                <span className="font-mono text-xs">{l.password}</span>
                <button
                  type="button"
                  onClick={() => copy(`${l.email}\n${l.password}`, `${l.role} login`)}
                  className="grid size-9 place-items-center rounded-lg ring-1 ring-line hover:bg-black/5"
                  aria-label={`Copy ${l.role} login`}
                >
                  <Copy className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => copy(logins.map((l) => `${l.role}: ${l.email} / ${l.password}`).join('\n'), 'All logins')}
          >
            <Copy className="size-4" aria-hidden /> Copy all
          </Button>
        </div>
      )}

      {confirm === 'seed' && (
        <Dialog
          open
          onClose={() => setConfirm(null)}
          title="Load demo data?"
          footer={
            <Button size="lg" block loading={busy} onClick={() => run('seed')}>
              Load demo data
            </Button>
          }
        >
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>About 1,000 sample orders over six weeks, using your current menu and prices.</li>
            <li>Ten live orders across the Orders and Kitchen screens (two of them ring the new-order alarm).</li>
            <li>Five catering enquiries and four practice logins (attendant, kitchen, dispatcher, manager).</li>
            <li>No SMS, no Paystack charges, no real customers. Takes about 10 seconds.</li>
          </ul>
        </Dialog>
      )}

      {confirm === 'clear' && (
        <Dialog
          open
          onClose={() => setConfirm(null)}
          title="Remove all demo data?"
          footer={
            <Button variant="danger" size="lg" block loading={busy} onClick={() => run('clear')}>
              Remove demo data
            </Button>
          }
        >
          <p className="text-sm text-muted">
            Deletes every order marked DEMO (including practice orders staff created), the demo catering enquiries and the practice
            logins. Real orders, customers, menu and settings stay exactly as they are. If no real orders exist yet, order numbers start
            again from #1001.
          </p>
        </Dialog>
      )}
    </section>
  )
}
