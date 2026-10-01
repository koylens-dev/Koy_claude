'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useContext } from 'react'
import { ClipboardList, ChefHat, PlusCircle, Ban, LayoutDashboard, LogOut } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import type { StaffRole } from '@/lib/types'
import { cn } from '@/lib/cn'

const StaffContext = createContext<{ role: StaffRole; name: string }>({ role: 'attendant', name: '' })
export const useStaff = () => useContext(StaffContext)

const NAV: { href: string; label: string; icon: typeof ClipboardList; roles: StaffRole[] }[] = [
  { href: '/staff/orders', label: 'Orders', icon: ClipboardList, roles: ['attendant', 'dispatcher', 'manager', 'owner'] },
  { href: '/staff/kitchen', label: 'Kitchen', icon: ChefHat, roles: ['kitchen', 'attendant', 'manager', 'owner'] },
  { href: '/staff/new-order', label: 'New order', icon: PlusCircle, roles: ['attendant', 'manager', 'owner'] },
  { href: '/staff/availability', label: 'Sold out', icon: Ban, roles: ['attendant', 'kitchen', 'manager', 'owner'] },
  { href: '/admin', label: 'Admin', icon: LayoutDashboard, roles: ['manager', 'owner'] },
]

export function StaffShell({ role, name, children }: { role: StaffRole; name: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const kitchen = pathname.startsWith('/staff/kitchen')

  async function signOut() {
    await getBrowserSupabase().auth.signOut()
    router.replace('/staff/login')
    router.refresh()
  }

  return (
    <StaffContext.Provider value={{ role, name }}>
      <div className={cn('min-h-dvh', kitchen ? 'bg-neutral-950 text-white' : 'bg-cream')}>
        <header className={cn('sticky top-0 z-30 border-b', kitchen ? 'border-white/10 bg-neutral-950' : 'border-line bg-surface')}>
          <div className="flex h-14 items-center gap-2 px-3">
            <span className="mr-2 hidden font-display text-xl font-semibold sm:block">
              <span className={kitchen ? 'text-orange-300' : 'text-brand'}>Irie’s</span> staff
            </span>
            <nav className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="Staff">
              {NAV.filter((n) => n.roles.includes(role)).map((n) => {
                const active = pathname.startsWith(n.href)
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={cn(
                      'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold',
                      active ? (kitchen ? 'bg-white text-neutral-950' : 'bg-ink text-white') : kitchen ? 'text-white/80 hover:bg-white/10' : 'hover:bg-black/5',
                    )}
                  >
                    <n.icon className="size-4" aria-hidden />
                    {n.label}
                  </Link>
                )
              })}
            </nav>
            <span className={cn('hidden text-xs md:block', kitchen ? 'text-white/60' : 'text-muted')}>
              {name} · {role}
            </span>
            <button type="button" onClick={signOut} className={cn('grid size-10 place-items-center rounded-xl', kitchen ? 'hover:bg-white/10' : 'hover:bg-black/5')} aria-label="Sign out">
              <LogOut className="size-4" />
            </button>
          </div>
        </header>
        {children}
      </div>
    </StaffContext.Provider>
  )
}
