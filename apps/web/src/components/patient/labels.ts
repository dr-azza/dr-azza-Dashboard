import type { PatientStatusCode, Tone } from '@azza/shared'

/** API status codes → i18n keys. */
export const statusKey = (code: PatientStatusCode) => `status.${code.toLowerCase()}`

export const statusTone: Record<PatientStatusCode, Tone> = {
  OK: 'ok',
  FLAGGED: 'danger',
  OVERDUE: 'warn',
  AWAITING: 'info',
}
