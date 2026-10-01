import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="font-display text-7xl font-semibold text-brand">404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">We couldn’t find that page</h1>
        <p className="mt-2 text-muted">The link may be old or mistyped.</p>
        <Link href="/" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-brand px-6 font-semibold text-white">
          Back to the menu
        </Link>
      </div>
    </main>
  )
}
