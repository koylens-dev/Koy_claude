'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Accessible modal built on the native <dialog> element (focus trap, Esc to close,
 * renders above everything). On phones it slides up as a bottom sheet.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={cn(
        'm-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50 sm:m-auto sm:max-h-[88dvh] sm:rounded-3xl',
        wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col sm:max-h-[88dvh]">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <h2 className="font-display text-2xl font-semibold leading-tight">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full hover:bg-black/5"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="border-t border-line px-5 py-4 pb-safe">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}
