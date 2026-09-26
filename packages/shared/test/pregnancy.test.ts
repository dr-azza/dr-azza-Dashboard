import { describe, expect, it } from 'vitest'
import { addDays, dueDate, gestationalAge, parseDay, trimester, weekPercent } from '../src/pregnancy.js'

describe('gestational age (Naegele)', () => {
  const lmp = parseDay('2026-02-23')

  it('counts completed weeks and days from the LMP', () => {
    expect(gestationalAge(lmp, parseDay('2026-09-26'))).toEqual({ weeks: 30, days: 5, totalDays: 215 })
  })

  it('never goes negative before the LMP', () => {
    expect(gestationalAge(lmp, parseDay('2026-01-01')).totalDays).toBe(0)
  })

  it('puts the due date 280 days after the LMP', () => {
    expect(dueDate(lmp)).toEqual(parseDay('2026-11-30'))
  })

  it('is not shifted by daylight-saving changes', () => {
    // Egypt moves clocks forward on the last Friday of April.
    expect(gestationalAge(parseDay('2026-04-20'), parseDay('2026-05-04')).totalDays).toBe(14)
    expect(addDays(parseDay('2026-04-20'), 14)).toEqual(parseDay('2026-05-04'))
  })
})

describe('trimester boundaries', () => {
  it.each([
    [0, 1],
    [13, 1],
    [14, 2],
    [27, 2],
    [28, 3],
    [41, 3],
  ])('week %i is trimester %i', (week, expected) => {
    expect(trimester(week)).toBe(expected)
  })
})

describe('timeline position', () => {
  it('clamps to the 0–40 week track', () => {
    expect(weekPercent(-1)).toBe(0)
    expect(weekPercent(20)).toBe(50)
    expect(weekPercent(42)).toBe(100)
  })
})
