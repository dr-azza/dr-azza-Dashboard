import { describe, expect, it } from 'vitest'
import { checkinFlags, isHighBloodPressure, isUrgentCheckin } from '../src/clinical.js'

describe('blood pressure threshold (140/90)', () => {
  it.each([
    [139, 89, false],
    [140, 80, true],
    [120, 90, true],
    [null, null, false],
  ])('%s/%s → high: %s', (sys, dia, expected) => {
    expect(isHighBloodPressure(sys, dia)).toBe(expected)
  })
})

describe('check-in flags', () => {
  it('flags high BP and red-flag symptoms in a stable order', () => {
    expect(checkinFlags({ symptoms: ['movement', 'headache', 'swelling'], systolic: 145, diastolic: 95 })).toEqual([
      'high-bp',
      'headache',
      'movement',
    ])
  })

  it('does not flag swelling alone (shown to the doctor, not urgent)', () => {
    expect(isUrgentCheckin({ symptoms: ['swelling'] })).toBe(false)
  })

  it('does not flag an answer with no symptoms and normal BP', () => {
    expect(checkinFlags({ symptoms: ['none'], systolic: 118, diastolic: 76 })).toEqual([])
  })
})
