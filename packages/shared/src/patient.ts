import type { Patient } from './types'
import { addDays, dueDate, gestationalAge, trimester } from './pregnancy'

export interface PregnancyInfo {
  lmp: Date
  edd: Date
  weeks: number
  days: number
  trimester: 1 | 2 | 3
  daysToDue: number
}

/** Pregnancy facts for a patient with an active pregnancy, derived from today's date. */
export function pregnancyInfo(patient: Patient, today: Date): PregnancyInfo | null {
  if (patient.caseType !== 'pregnancy' || patient.gaDays == null) return null
  const lmp = addDays(today, -patient.gaDays)
  const ga = gestationalAge(lmp, today)
  const edd = dueDate(lmp)
  return {
    lmp,
    edd,
    weeks: ga.weeks,
    days: ga.days,
    trimester: trimester(ga.weeks),
    daysToDue: 280 - ga.totalDays,
  }
}
