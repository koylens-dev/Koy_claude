'use client'

import { usePathname } from 'next/navigation'
import { publicEnv } from '@/lib/public-env'
import { whatsappLink } from '@/lib/phone'

export function WhatsAppButton() {
  const pathname = usePathname()
  if (!publicEnv.whatsappNumber) return null
  const raised = pathname === '/' || pathname.startsWith('/menu')
  return (
    <a
      href={whatsappLink(publicEnv.whatsappNumber, "Hello Irie's Cuisine, I need help with")}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed right-4 z-30 grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg ring-4 ring-white/70 hover:brightness-95 ${raised ? 'bottom-24' : 'bottom-5'}`}
      aria-label="Chat with us on WhatsApp"
    >
      <svg viewBox="0 0 24 24" className="size-7 fill-current" aria-hidden>
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35ZM12.04 21.8h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.72.98 1-3.63-.24-.37a9.76 9.76 0 0 1-1.5-5.2c0-5.4 4.4-9.8 9.83-9.8a9.8 9.8 0 0 1 9.82 9.8c0 5.42-4.4 9.8-9.82 9.8Zm8.36-18.16A11.74 11.74 0 0 0 12.04.2C5.5.2.2 5.5.2 12.03c0 2.09.55 4.12 1.59 5.92L.1 24l6.2-1.62a11.82 11.82 0 0 0 5.73 1.46h.01c6.53 0 11.83-5.3 11.84-11.83 0-3.16-1.23-6.13-3.47-8.37Z" />
      </svg>
    </a>
  )
}
