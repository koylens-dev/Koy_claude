import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

// Keeps Supabase sessions fresh and sends signed-out visitors of staff/admin
// pages to the staff login. Role checks happen again on the server (layouts,
// API routes) and in the database (RLS) — this is only the first gate.
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request)
  const { pathname } = request.nextUrl

  const isStaffArea = (pathname.startsWith('/staff') && !pathname.startsWith('/staff/login')) || pathname.startsWith('/admin')
  if (isStaffArea && !userId) {
    const url = request.nextUrl.clone()
    url.pathname = '/staff/login'
    url.search = `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  }

  const needsCustomer = pathname.startsWith('/checkout') || pathname.startsWith('/orders') || pathname.startsWith('/account')
  if (needsCustomer && !userId) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    // Everything except static assets, images, the service worker, and webhook/cron APIs
    // (those authenticate with their own signatures/secrets).
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|icons/|sw.js|manifest.webmanifest|offline.html|api/webhooks|api/cron|api/auth/sms-hook|api/health|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|woff2?)$).*)',
  ],
}
