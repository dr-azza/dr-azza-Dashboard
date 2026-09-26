import type { Tone } from '@azza/shared'
import type { CaseTypeCode, PatientStatusCode } from '@azza/shared'

/** API enum codes → i18n keys (the dashboard's earlier sample data used lowercase keys). */
export const caseKey = (code: CaseTypeCode) => `case.${code.toLowerCase()}`
export const statusKey = (code: PatientStatusCode) => `status.${code.toLowerCase()}`

export const statusTone: Record<PatientStatusCode, Tone> = {
  OK: 'ok',
  FLAGGED: 'danger',
  OVERDUE: 'warn',
  AWAITING: 'info',
}
