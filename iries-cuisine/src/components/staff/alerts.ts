'use client'

// Loud, attention-grabbing alerts for a busy kitchen. Browsers only allow sound
// after a tap, so staff screens start with a "Start shift" button that unlocks audio.

let ctx: AudioContext | null = null

export async function unlockAudio(): Promise<boolean> {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = ctx ?? new AC()
    if (ctx.state === 'suspended') await ctx.resume()
    return ctx.state === 'running'
  } catch {
    return false
  }
}

function tone(freq: number, start: number, duration: number, volume: number) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

/** Urgent three-note alarm for a new paid order. */
export function playNewOrderAlarm() {
  if (!ctx || ctx.state !== 'running') return
  const t = ctx.currentTime
  for (let r = 0; r < 2; r++) {
    tone(988, t + r * 0.75, 0.18, 0.9)
    tone(1319, t + r * 0.75 + 0.22, 0.18, 0.9)
    tone(1568, t + r * 0.75 + 0.44, 0.26, 0.9)
  }
  navigator.vibrate?.([300, 120, 300, 120, 500])
}

/** Short double beep for the kitchen (new ticket). */
export function playTicketBeep() {
  if (!ctx || ctx.state !== 'running') return
  const t = ctx.currentTime
  tone(880, t, 0.15, 0.7)
  tone(880, t + 0.25, 0.15, 0.7)
}

let wakeLock: { release: () => Promise<void> } | null = null

/** Keep the tablet screen on while a staff screen is open. */
export async function keepScreenOn() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
    if (nav.wakeLock && document.visibilityState === 'visible') wakeLock = await nav.wakeLock.request('screen')
  } catch {
    /* not supported or denied */
  }
}

export function releaseScreen() {
  wakeLock?.release().catch(() => {})
  wakeLock = null
}
