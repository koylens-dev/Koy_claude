import { describe, expect, it } from 'vitest'
import { formatSlot, isOpenForAsap, isValidScheduledTime, localParts, nextOpening, scheduleSlots, zonedToUtc, type HoursConfig } from '../time'

// Mon–Sat 10:00–21:30, Sunday 12:00–20:00 (Accra = GMT, no DST)
const cfg: HoursConfig = {
  hours: [
    ...[1, 2, 3, 4, 5, 6].map((d) => ({ day_of_week: d, opens_at: '10:00:00', closes_at: '21:30:00' })),
    { day_of_week: 0, opens_at: '12:00', closes_at: '20:00' },
  ],
  closedDates: [],
  acceptingOrders: true,
  lastOrderMinutesBeforeClose: 30,
  schedulingEnabled: true,
  scheduleDaysAhead: 2,
  slotMinutes: 30,
  minScheduleLeadMinutes: 60,
}

// 2026-10-01 is a Thursday
const at = (iso: string) => new Date(iso)

describe('opening hours (Africa/Accra)', () => {
  it('reads local parts in Accra time', () => {
    const p = localParts(at('2026-10-01T09:15:00Z'))
    expect(p.weekday).toBe(4)
    expect(p.minutes).toBe(9 * 60 + 15)
    expect(p.dateKey).toBe('2026-10-01')
  })

  it('round-trips local time to UTC', () => {
    expect(zonedToUtc('2026-10-01', 13 * 60 + 30).toISOString()).toBe('2026-10-01T13:30:00.000Z')
  })

  it('is open between opening and the last-order cutoff', () => {
    expect(isOpenForAsap(at('2026-10-01T09:59:00Z'), cfg)).toBe(false)
    expect(isOpenForAsap(at('2026-10-01T10:00:00Z'), cfg)).toBe(true)
    expect(isOpenForAsap(at('2026-10-01T20:59:00Z'), cfg)).toBe(true)
    expect(isOpenForAsap(at('2026-10-01T21:00:00Z'), cfg)).toBe(false) // 30 min before close
  })

  it('respects the pause switch and closed dates', () => {
    expect(isOpenForAsap(at('2026-10-01T12:00:00Z'), { ...cfg, acceptingOrders: false })).toBe(false)
    expect(isOpenForAsap(at('2026-10-01T12:00:00Z'), { ...cfg, closedDates: ['2026-10-01'] })).toBe(false)
  })

  it('finds the next opening', () => {
    expect(nextOpening(at('2026-10-01T22:00:00Z'), cfg)?.toISOString()).toBe('2026-10-02T10:00:00.000Z')
    expect(nextOpening(at('2026-10-03T23:00:00Z'), cfg)?.toISOString()).toBe('2026-10-04T12:00:00.000Z') // Saturday night -> Sunday noon
  })
})

describe('scheduled-order slots', () => {
  it('starts one slot after opening and respects the lead time', () => {
    const slots = scheduleSlots(at('2026-10-01T07:00:00Z'), cfg)
    expect(slots[0].toISOString()).toBe('2026-10-01T10:30:00.000Z')
    expect(slots.at(-1)!.toISOString()).toBe('2026-10-03T21:30:00.000Z') // 2 days ahead, until closing
  })

  it('skips slots inside the lead time', () => {
    const slots = scheduleSlots(at('2026-10-01T12:10:00Z'), cfg)
    expect(slots[0].toISOString()).toBe('2026-10-01T13:30:00.000Z')
  })

  it('validates a chosen slot exactly', () => {
    const now = at('2026-10-01T07:00:00Z')
    expect(isValidScheduledTime(at('2026-10-01T13:00:00Z'), now, cfg)).toBe(true)
    expect(isValidScheduledTime(at('2026-10-01T13:10:00Z'), now, cfg)).toBe(false)
    expect(isValidScheduledTime(at('2026-10-01T23:00:00Z'), now, cfg)).toBe(false)
  })

  it('is empty when scheduling is off or the shop is paused', () => {
    expect(scheduleSlots(at('2026-10-01T07:00:00Z'), { ...cfg, schedulingEnabled: false })).toHaveLength(0)
    expect(scheduleSlots(at('2026-10-01T07:00:00Z'), { ...cfg, acceptingOrders: false })).toHaveLength(0)
  })

  it('labels slots for people', () => {
    const now = at('2026-10-01T07:00:00Z')
    expect(formatSlot(at('2026-10-01T13:00:00Z'), now)).toBe('Today, 1:00 pm')
    expect(formatSlot(at('2026-10-02T12:30:00Z'), now)).toBe('Tomorrow, 12:30 pm')
  })
})
