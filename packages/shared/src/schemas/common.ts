import { z } from 'zod'

/** Optional free text: trims, and turns an empty string into `null` so "cleared" is stored as no value. */
export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish()

export const requiredText = (max = 200) => z.string().trim().min(1).max(max)

/** Calendar date as YYYY-MM-DD (no time zone). */
export const isoDate = z.iso.date()

/** Egyptian and international numbers in E.164, e.g. +201012345678. */
export const phoneE164 = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ''))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use international format, e.g. +201012345678'))

export const uuid = z.uuid()

export const paginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}
