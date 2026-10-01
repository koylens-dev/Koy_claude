import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar'
import { publicEnv } from '@/lib/public-env'

const montserrat = localFont({
  src: '../fonts/montserrat-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-montserrat',
  display: 'swap',
})

const cormorant = localFont({
  src: [
    { path: '../fonts/cormorant-garamond-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/cormorant-garamond-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: '../fonts/cormorant-garamond-latin-500-italic.woff2', weight: '500', style: 'italic' },
  ],
  variable: '--font-cormorant',
  display: 'swap',
})

const description =
  "Order authentic Ghanaian food from Irie's Cuisine in Adenta, Accra — jollof, waakye, banku & tilapia and more. Pay with MoMo or card, track your order live."

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: "Irie's Cuisine — Ghanaian food delivery in Adenta, Accra", template: "%s · Irie's Cuisine" },
  description,
  applicationName: "Irie's Cuisine",
  appleWebApp: { capable: true, title: "Irie's", statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: "Irie's Cuisine",
    locale: 'en_GH',
    title: "Irie's Cuisine — Ghanaian food, delivered",
    description,
  },
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = {
  themeColor: '#9e3b22',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GH" className={`${montserrat.variable} ${cormorant.variable}`}>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
