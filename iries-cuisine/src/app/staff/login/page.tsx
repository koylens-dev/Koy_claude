import { Suspense } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import { logoOnLight } from '@/lib/brand'
import { StaffLoginForm } from './StaffLoginForm'

export const metadata: Metadata = { title: 'Staff sign-in', robots: { index: false } }

export default function StaffLoginPage() {
  return (
    <main className="brand-chevrons grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl">
        <Image src={logoOnLight} alt="Irie's Cuisine" className="h-14 w-auto" sizes="200px" priority />
        <p className="mt-3 text-sm text-muted">Staff sign-in — attendants, kitchen, riders and managers.</p>
        <Suspense>
          <StaffLoginForm />
        </Suspense>
      </div>
    </main>
  )
}
