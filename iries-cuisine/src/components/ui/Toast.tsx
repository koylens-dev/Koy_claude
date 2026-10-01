'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'info' | 'success' | 'error'
type ToastItem = { id: number; message: string; tone: Tone }

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const toast = useCallback((message: string, tone: Tone = 'info') => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev.slice(-2), { id, message, tone }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), tone === 'error' ? 7000 : 4000)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto w-full max-w-md rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ring-1',
              t.tone === 'error' && 'bg-red-50 text-red-900 ring-red-200',
              t.tone === 'success' && 'bg-emerald-50 text-emerald-900 ring-emerald-200',
              t.tone === 'info' && 'bg-ink text-white ring-black/10',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
