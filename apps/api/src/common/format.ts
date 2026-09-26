import type { StaffRef } from '@azza/shared'

/** Calendar date (Postgres DATE) → "YYYY-MM-DD". Prisma returns DATE columns as UTC midnight. */
export const toIsoDay = (d: Date) => d.toISOString().slice(0, 10)
export const toIsoDayOrNull = (d: Date | null | undefined) => (d ? toIsoDay(d) : null)

/** "YYYY-MM-DD" → Date at UTC midnight, the form Prisma expects for DATE columns. */
export const fromIsoDay = (s: string) => new Date(`${s}T00:00:00.000Z`)
export const fromIsoDayOrNull = (s: string | null | undefined) => (s ? fromIsoDay(s) : null)

/** Prisma Decimal (or null) → fixed decimal string, e.g. "74.20". */
export const decimalString = (d: { toFixed(dp: number): string } | null | undefined, dp = 2) =>
  d == null ? null : d.toFixed(dp)

export const staffRef = (s: { id: string; fullName: string } | null | undefined): StaffRef | null =>
  s ? { id: s.id, fullName: s.fullName } : null

export const STAFF_REF_SELECT = { select: { id: true, fullName: true } } as const

export function ageFrom(dateOfBirth: Date | null, today = new Date()) {
  if (!dateOfBirth) return null
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear()
  const m = today.getUTCMonth() - dateOfBirth.getUTCMonth()
  if (m < 0 || (m === 0 && today.getUTCDate() < dateOfBirth.getUTCDate())) age--
  return age
}
