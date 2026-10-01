'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, KeyRound } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { PageTitle, useAdmin } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import type { StaffRole } from '@/lib/types'

type Row = { user_id: string; display_name: string; role: StaffRole; is_active: boolean; created_at: string }
const ROLES: { id: StaffRole; label: string; can: string }[] = [
  { id: 'attendant', label: 'Attendant', can: 'Accept/reject orders, phone orders, sold-out, dispatch' },
  { id: 'kitchen', label: 'Kitchen', can: 'Kitchen display, sold-out' },
  { id: 'dispatcher', label: 'Dispatcher / rider', can: 'Send out and mark delivered' },
  { id: 'manager', label: 'Manager', can: 'Everything above + menu, prices, refunds, reports, staff' },
  { id: 'owner', label: 'Owner', can: 'Everything, including managers' },
]

async function call(method: 'POST' | 'PATCH', body: unknown) {
  const res = await fetch('/api/admin/staff', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, message: json.error?.message as string | undefined }
}

export function StaffAdmin() {
  const { role: myRole } = useAdmin()
  const toast = useToast()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', displayName: '', role: 'attendant' as StaffRole })
  const [reset, setReset] = useState<{ userId: string; name: string; password: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    () =>
      getBrowserSupabase()
        .from('staff')
        .select('*')
        .order('created_at')
        .then(({ data }) => setRows((data ?? []) as Row[])),
    [],
  )
  useEffect(() => {
    load()
  }, [load])

  const allowedRoles = ROLES.filter((r) => myRole === 'owner' || (r.id !== 'manager' && r.id !== 'owner'))

  async function create() {
    setBusy(true)
    const r = await call('POST', form)
    setBusy(false)
    if (!r.ok) return toast(r.message ?? 'Could not create', 'error')
    toast(`Account created for ${form.displayName}. Share the email and password with them privately.`, 'success')
    setAdding(false)
    setForm({ email: '', password: '', displayName: '', role: 'attendant' })
    load()
  }

  async function patch(body: Record<string, unknown>) {
    const r = await call('PATCH', body)
    if (!r.ok) toast(r.message ?? 'Could not update', 'error')
    load()
    return r.ok
  }

  return (
    <div className="max-w-3xl">
      <PageTitle
        title="Staff"
        description="Each person gets their own login so every action is traceable. Deactivate people who leave — their history stays."
        actions={<Button onClick={() => setAdding(true)}><Plus className="size-4" aria-hidden /> Add staff</Button>}
      />
      {!rows ? (
        <Skeleton className="h-64" />
      ) : (
        <ul className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
          {rows.map((r) => {
            const locked = myRole !== 'owner' && (r.role === 'manager' || r.role === 'owner')
            return (
              <li key={r.user_id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-40 flex-1">
                  <p className="font-semibold">{r.display_name}</p>
                  <p className="text-xs text-muted">{ROLES.find((x) => x.id === r.role)?.can}</p>
                </div>
                <Select aria-label={`Role for ${r.display_name}`} value={r.role} disabled={locked} onChange={(e) => patch({ userId: r.user_id, role: e.target.value })} className="w-48">
                  {(locked ? ROLES : allowedRoles).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </Select>
                <Toggle on={r.is_active} disabled={locked} onChange={(v) => patch({ userId: r.user_id, isActive: v })} label={`${r.display_name} active`} />
                <Button variant="ghost" size="sm" disabled={locked} onClick={() => setReset({ userId: r.user_id, name: r.display_name, password: '' })} aria-label={`Reset password for ${r.display_name}`}>
                  <KeyRound className="size-4" aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {adding && (
        <Dialog open onClose={() => setAdding(false)} title="Add staff member" footer={<Button block size="lg" loading={busy} onClick={create}>Create account</Button>}>
          <div className="space-y-4">
            <Field label="Name" htmlFor="s-name"><Input id="s-name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></Field>
            <Field label="Email (used to sign in)" htmlFor="s-email"><Input id="s-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Temporary password (10+ characters)" htmlFor="s-pass"><Input id="s-pass" type="text" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            <Field label="Role" htmlFor="s-role">
              <Select id="s-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}>
                {allowedRoles.map((r) => <option key={r.id} value={r.id}>{r.label} — {r.can}</option>)}
              </Select>
            </Field>
          </div>
        </Dialog>
      )}
      {reset && (
        <Dialog
          open
          onClose={() => setReset(null)}
          title={`New password for ${reset.name}`}
          footer={
            <Button
              block
              size="lg"
              disabled={reset.password.length < 10}
              onClick={async () => {
                if (await patch({ userId: reset.userId, password: reset.password })) {
                  toast('Password changed', 'success')
                  setReset(null)
                }
              }}
            >
              Set password
            </Button>
          }
        >
          <Field label="New password (10+ characters)" htmlFor="r-pass"><Input id="r-pass" type="text" autoComplete="new-password" value={reset.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} /></Field>
        </Dialog>
      )}
    </div>
  )
}
