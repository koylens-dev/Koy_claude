'use client'

import { cn } from '@/lib/cn'

/** Accessible on/off switch with a 44px-wide touch target. */
export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn('relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50', on ? 'bg-success' : 'bg-stone-300')}
    >
      <span className={cn('absolute top-1 size-6 rounded-full bg-white shadow transition-all', on ? 'left-7' : 'left-1')} />
    </button>
  )
}
