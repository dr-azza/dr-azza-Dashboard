const DAY = 24 * 60 * 60 * 1000
export const FULL_TERM_DAYS = 280

/** Parse an ISO date (YYYY-MM-DD) as a local calendar day. */
export function parseDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function daysBetween(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY)
}

export function addDays(date: Date, days: number) {
  const next = startOfDay(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Gestational age from the last menstrual period (Naegele's rule). */
export function gestationalAge(lmp: Date, today: Date) {
  const days = Math.max(0, daysBetween(lmp, today))
  return { weeks: Math.floor(days / 7), days: days % 7, totalDays: days }
}

export function dueDate(lmp: Date) {
  return addDays(lmp, FULL_TERM_DAYS)
}

export function trimester(weeks: number): 1 | 2 | 3 {
  if (weeks < 14) return 1
  if (weeks < 28) return 2
  return 3
}

/** Position of a gestational week on a 0–40 week track, as a percentage. */
export function weekPercent(weeks: number) {
  return Math.min(100, Math.max(0, (weeks / 40) * 100))
}
