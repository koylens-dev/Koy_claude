import { Suspense } from 'react'
import type { Metadata } from 'next'
import { StaffLoginForm } from './StaffLoginForm'

export const metadata: Metadata = { title: 'Staff sign-in', robots: { index: false } }

export default function StaffLoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-4">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl">
        <p className="font-display text-3xl font-semibold">
          <span className="text-brand">Irie’s</span> <em>staff</em>
        </p>
        <p className="mt-1 text-sm text-muted">Attendants, kitchen, riders and managers.</p>
        <Suspense>
          <StaffLoginForm />
        </Suspense>
      </div>
    </main>
  )
}
