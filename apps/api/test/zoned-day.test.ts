import { describe, expect, it } from 'vitest'
import { zonedDayStart } from '../src/patients/patient-scope.service'

describe('zonedDayStart', () => {
  it('finds when a calendar day begins in the clinic time zone', () => {
    expect(zonedDayStart('2026-11-02', 'Africa/Cairo').toISOString()).toBe('2026-11-01T22:00:00.000Z')
    // Egypt's summer time (UTC+3).
    expect(zonedDayStart('2026-07-01', 'Africa/Cairo').toISOString()).toBe('2026-06-30T21:00:00.000Z')
    expect(zonedDayStart('2026-11-02', 'UTC').toISOString()).toBe('2026-11-02T00:00:00.000Z')
  })

  it('is right on daylight-saving change days', () => {
    // New York springs forward at 02:00 on 8 March 2026: midnight is still UTC-5, the next day UTC-4.
    expect(zonedDayStart('2026-03-08', 'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z')
    expect(zonedDayStart('2026-03-09', 'America/New_York').toISOString()).toBe('2026-03-09T04:00:00.000Z')
  })
})
