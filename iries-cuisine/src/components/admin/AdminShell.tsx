'use client'

import Image from 'next/image'
import Link from 'next/link'
import { logoOnLight } from '@/lib/brand'
import { usePathname } from 'next/navigation'
import { createContext, useContext } from 'react'
import { BarChart3, ClipboardList, UtensilsCrossed, ListPlus, MapPinned, Settings, Users, Contact, PartyPopper, ScrollText, ArrowLeft } from 'lucide-react'
import type { StaffRole } from '@/lib/types'
import { cn } from '@/lib/cn'

const AdminContext = createContext<{ role: StaffRole; name: string }>({ role: 'manager', name: '' })
export const useAdmin = () => useContext(AdminContext)

const NAV = [
  { href: '/admin', label: 'Sales', icon: BarChart3, exact: true },
  { href: '/admin/orders', label: 'Orders & refunds', icon: ClipboardList },
  { href: '/admin/menu', label: 'Menu', icon: UtensilsCrossed },
  { href: '/admin/modifiers', label: 'Extras & spice', icon: ListPlus },
  { href: '/admin/zones', label: 'Delivery zones', icon: MapPinned },
  { href: '/admin/settings', label: 'Hours & settings', icon: Settings },
  { href: '/admin/staff', label: 'Staff', icon: Users },
  { href: '/admin/customers', label: 'Customers', icon: Contact },
  { href: '/admin/catering', label: 'Catering', icon: PartyPopper },
  { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
]

export function AdminShell({ role, name, children }: { role: StaffRole; name: string; children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <AdminContext.Provider value={{ role, name }}>
      <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-[240px_1fr]">
        <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-4 py-3 lg:block">
            <p className="flex items-end gap-2">
              <Image src={logoOnLight} alt="Irie's Cuisine" className="h-9 w-auto" sizes="120px" />
              <span className="pb-0.5 text-xs font-bold uppercase tracking-widest text-muted">Admin</span>
            </p>
            <p className="hidden text-xs text-muted lg:block">
              {name} · {role}
            </p>
            <Link href="/staff" className="inline-flex items-center gap-1 text-sm font-semibold text-brand lg:mt-2">
              <ArrowLeft className="size-4" aria-hidden /> Staff screens
            </Link>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none] lg:flex-col lg:overflow-visible" aria-label="Admin">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.href : pathname.startsWith(n.href)
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold',
                    active ? 'bg-ink text-white' : 'text-ink hover:bg-black/5',
                  )}
                >
                  <n.icon className="size-4" aria-hidden />
                  {n.label}
                </Link>
              )
            })}
          </nav>
        </aside>
        <main className="min-w-0 px-4 pb-16 pt-6 lg:px-8">{children}</main>
      </div>
    </AdminContext.Provider>
  )
}

export function PageTitle({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-4xl font-semibold">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  )
}
