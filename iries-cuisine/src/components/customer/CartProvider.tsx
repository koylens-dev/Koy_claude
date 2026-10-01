'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type CartOption = { id: string; groupName: string; name: string; price: number }

export type CartLine = {
  key: string
  itemId: string
  slug: string
  name: string
  imagePath: string | null
  portionId: string
  portionName: string
  portionPrice: number
  options: CartOption[]
  quantity: number
  notes: string
}

export function unitPrice(line: Pick<CartLine, 'portionPrice' | 'options'>) {
  return line.portionPrice + line.options.reduce((s, o) => s + o.price, 0)
}

function lineKey(l: Pick<CartLine, 'itemId' | 'portionId' | 'options' | 'notes'>) {
  return [l.itemId, l.portionId, [...l.options.map((o) => o.id)].sort().join('.'), l.notes.trim().toLowerCase()].join('|')
}

type CartContextValue = {
  lines: CartLine[]
  hydrated: boolean
  count: number
  subtotal: number
  add: (line: Omit<CartLine, 'key'>) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  clear: () => void
  replace: (lines: Omit<CartLine, 'key'>[]) => void
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = 'iries-cart-v1'

function readStorage(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as CartLine[]) : []
    return Array.isArray(parsed) ? parsed.filter((l) => l && l.itemId && l.portionId && l.quantity > 0) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Restore the cart saved on this phone (cart survives closing the browser).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLines(readStorage())
    setHydrated(true)
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLines(readStorage())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      /* private mode / storage full: cart still works for this visit */
    }
  }, [lines, hydrated])

  const add = useCallback((line: Omit<CartLine, 'key'>) => {
    const key = lineKey(line)
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key)
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, l.quantity + line.quantity) } : l))
      }
      return [...prev, { ...line, key }]
    })
  }, [])

  const setQuantity = useCallback((key: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, quantity) } : l)),
    )
  }, [])

  const remove = useCallback((key: string) => setLines((prev) => prev.filter((l) => l.key !== key)), [])
  const clear = useCallback(() => setLines([]), [])
  const replace = useCallback((next: Omit<CartLine, 'key'>[]) => setLines(next.map((l) => ({ ...l, key: lineKey(l) }))), [])

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      hydrated,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      subtotal: lines.reduce((s, l) => s + unitPrice(l) * l.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
      replace,
    }),
    [lines, hydrated, add, setQuantity, remove, clear, replace],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
