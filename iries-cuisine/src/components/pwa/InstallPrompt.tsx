'use client'

import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
const DISMISS_KEY = 'iries-install-dismissed'

/** "Install the app" nudge: native prompt on Android/Chrome, instructions on iPhone Safari. */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
    let dismissed = false
    try {
      dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now() - 14 * 86400000
    } catch {}
    if (standalone || dismissed) return

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)
    if (isIos) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIos(true)
      setHidden(false)
    }
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setHidden(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {}
  }

  if (hidden || (!deferred && !ios)) return null
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface p-3 pr-2 text-sm shadow-sm ring-1 ring-line">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
        {ios ? <Share className="size-5" aria-hidden /> : <Download className="size-5" aria-hidden />}
      </div>
      <p className="flex-1 leading-snug">
        {ios ? (
          <>Install the app: tap <strong>Share</strong> then <strong>Add to Home Screen</strong>.</>
        ) : (
          <>Get the Irie’s app on your home screen — faster ordering, no app store needed.</>
        )}
      </p>
      {!ios && deferred && (
        <button
          type="button"
          className="min-h-10 rounded-xl bg-ink px-3 font-semibold text-white"
          onClick={async () => {
            await deferred.prompt()
            setDeferred(null)
            setHidden(true)
          }}
        >
          Install
        </button>
      )}
      <button type="button" onClick={dismiss} className="grid size-10 place-items-center rounded-full hover:bg-black/5" aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  )
}
