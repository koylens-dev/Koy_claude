'use client'

import { useEffect } from 'react'

export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300)
    return () => clearTimeout(t)
  }, [])
  return (
    <button type="button" onClick={() => window.print()} className="no-print mb-2 w-full rounded border border-black py-2 font-sans text-sm">
      Print again
    </button>
  )
}
