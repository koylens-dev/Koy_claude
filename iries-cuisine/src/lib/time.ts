// Opening hours, "open now" checks and scheduled-order slots, all in Africa/Accra time.
// Ghana is on GMT all year (no daylight saving) but we still go through Intl so the
// code stays correct if it is ever reused elsewhere.

export const TZ = 'Africa/Accra'

export type OpeningWindow = {
  day_of_week: number // 0 = Sunday … 6 = Saturday
  opens_at: string // "HH:MM" or "HH:MM:SS"
  closes_at: string
}

export type HoursConfig = {
  hours: OpeningWindow[]
  closedDates: string[] // YYYY-MM-DD (Accra calendar)
  acceptingOrders: boolean
  lastOrderMinutesBeforeClose: number
  schedulingEnabled: boolean
  scheduleDaysAhead: number
  slotMinutes: number
  minScheduleLeadMinutes: number
}

type LocalParts = {
  year: number
  month: number
  day: number
  weekday: number
  minutes: number // minutes since local midnight
  dateKey: string // YYYY-MM-DD
}

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
})

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function localParts(date: Date): LocalParts {
  const p: Record<string, string> = {}
  for (const part of partsFormatter.formatToParts(date)) p[part.type] = part.value
  const year = Number(p.year)
  const month = Number(p.month)
  const day = Number(p.day)
  return {
    year,
    month,
    day,
    weekday: WEEKDAYS[p.weekday],
    minutes: Number(p.hour) * 60 + Number(p.minute),
    dateKey: `${p.year}-${p.month}-${p.day}`,
  }
}

function offsetMinutes(date: Date): number {
  const p = localParts(date)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, Math.floor(p.minutes / 60), p.minutes % 60)
  const actual = Math.floor(date.getTime() / 60000) * 60000
  return Math.round((asUtc - actual) / 60000)
}

/** Accra local date + minutes-since-midnight -> the real instant. */
export function zonedToUtc(dateKey: string, minutesOfDay: number): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  const guess = new Date(Date.UTC(y, m - 1, d, 0, minutesOfDay))
  return new Date(guess.getTime() - offsetMinutes(guess) * 60000)
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

function addDays(dateKey: string, days: number): { dateKey: string; weekday: number } {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12))
  const key = dt.toISOString().slice(0, 10)
  return { dateKey: key, weekday: dt.getUTCDay() }
}

function windowsFor(dateKey: string, weekday: number, cfg: HoursConfig) {
  if (cfg.closedDates.includes(dateKey)) return []
  return cfg.hours
    .filter((h) => h.day_of_week === weekday)
    .map((h) => ({ open: toMinutes(h.opens_at), close: toMinutes(h.closes_at) }))
    .sort((a, b) => a.open - b.open)
}

/** Can an ASAP order be placed right now? */
export function isOpenForAsap(now: Date, cfg: HoursConfig): boolean {
  if (!cfg.acceptingOrders) return false
  const p = localParts(now)
  return windowsFor(p.dateKey, p.weekday, cfg).some(
    (w) => p.minutes >= w.open && p.minutes < w.close - cfg.lastOrderMinutesBeforeClose,
  )
}

/** When do we next open (for "Opens tomorrow at 10:00 AM")? Null if no hours configured in the next week. */
export function nextOpening(now: Date, cfg: HoursConfig): Date | null {
  const p = localParts(now)
  for (let i = 0; i <= 7; i++) {
    const { dateKey, weekday } = addDays(p.dateKey, i)
    for (const w of windowsFor(dateKey, weekday, cfg)) {
      const start = zonedToUtc(dateKey, w.open)
      if (start.getTime() > now.getTime()) return start
      if (i === 0 && p.minutes < w.close - cfg.lastOrderMinutesBeforeClose) return now
    }
  }
  return null
}

/**
 * Times a customer may choose for a scheduled order (the time they want the food).
 * Slots start one slot after opening (the kitchen needs time) and run until closing.
 */
export function scheduleSlots(now: Date, cfg: HoursConfig): Date[] {
  if (!cfg.schedulingEnabled || !cfg.acceptingOrders) return []
  const p = localParts(now)
  const earliest = now.getTime() + cfg.minScheduleLeadMinutes * 60000
  const slots: Date[] = []
  for (let i = 0; i <= cfg.scheduleDaysAhead; i++) {
    const { dateKey, weekday } = addDays(p.dateKey, i)
    for (const w of windowsFor(dateKey, weekday, cfg)) {
      const first = Math.ceil((w.open + cfg.slotMinutes) / cfg.slotMinutes) * cfg.slotMinutes
      for (let t = first; t <= w.close; t += cfg.slotMinutes) {
        const at = zonedToUtc(dateKey, t)
        if (at.getTime() >= earliest) slots.push(at)
      }
    }
  }
  return slots
}

export function isValidScheduledTime(when: Date, now: Date, cfg: HoursConfig): boolean {
  return scheduleSlots(now, cfg).some((s) => s.getTime() === when.getTime())
}

const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true })
const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/** "1:30 pm" */
export function formatTime(date: Date | string): string {
  return timeFmt.format(new Date(date))
}

/** "1 Oct 2026, 1:30 pm" */
export function formatDateTime(date: Date | string): string {
  return dateTimeFmt.format(new Date(date))
}

/** "Today, 1:30 pm" / "Tomorrow, 12:00 pm" / "Sat 3 Oct, 12:00 pm" */
export function formatSlot(date: Date | string, now: Date = new Date()): string {
  const d = new Date(date)
  const today = localParts(now).dateKey
  const key = localParts(d).dateKey
  const label =
    key === today ? 'Today' : key === addDays(today, 1).dateKey ? 'Tomorrow' : dayFmt.format(d)
  return `${label}, ${formatTime(d)}`
}

/** Accra calendar date (YYYY-MM-DD) for a timestamp. */
export function accraDateKey(date: Date | string = new Date()): string {
  return localParts(new Date(date)).dateKey
}

export function minutesBetween(from: Date | string, to: Date | string = new Date()): number {
  return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 60000)
}
