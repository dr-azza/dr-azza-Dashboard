/**
 * Clinical rules used everywhere a patient answer is judged: the patient's form shows a
 * warning with them, and the API will use the same functions to flag a response.
 */
import type { L } from './types.js'

/** Standard antenatal milestones shown on the pregnancy timeline. */
export const MILESTONES: { week: number; name: L }[] = [
  { week: 12, name: { en: 'NT scan', ar: 'سونار الشفافية' } },
  { week: 20, name: { en: 'Anomaly scan', ar: 'السونار التفصيلي' } },
  { week: 26, name: { en: 'Glucose test', ar: 'تحليل السكر' } },
  { week: 32, name: { en: 'Growth scan', ar: 'سونار النمو' } },
  { week: 36, name: { en: 'GBS swab', ar: 'مسحة GBS' } },
]

export const CHECKIN_SYMPTOMS = ['headache', 'vision', 'swelling', 'bleeding', 'movement', 'none'] as const
export type CheckinSymptom = (typeof CHECKIN_SYMPTOMS)[number]

/** Symptoms that make a check-in urgent on their own. */
export const RED_FLAG_SYMPTOMS: readonly CheckinSymptom[] = ['headache', 'vision', 'bleeding', 'movement']

export const BP_SYSTOLIC_LIMIT = 140
export const BP_DIASTOLIC_LIMIT = 90

export function isHighBloodPressure(systolic?: number | null, diastolic?: number | null) {
  return (systolic ?? 0) >= BP_SYSTOLIC_LIMIT || (diastolic ?? 0) >= BP_DIASTOLIC_LIMIT
}

export interface CheckinVitals {
  symptoms: readonly CheckinSymptom[]
  systolic?: number | null
  diastolic?: number | null
}

export type CheckinFlag = 'high-bp' | Exclude<CheckinSymptom, 'none'>

/** Every reason a check-in needs clinical attention, in a stable order. Empty means no flags. */
export function checkinFlags(answer: CheckinVitals): CheckinFlag[] {
  const flags: CheckinFlag[] = []
  if (isHighBloodPressure(answer.systolic, answer.diastolic)) flags.push('high-bp')
  for (const s of RED_FLAG_SYMPTOMS) if (s !== 'none' && answer.symptoms.includes(s)) flags.push(s)
  return flags
}

export function isUrgentCheckin(answer: CheckinVitals) {
  return checkinFlags(answer).length > 0
}
