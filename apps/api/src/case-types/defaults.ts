import type { SystemCaseKey } from '@azza/shared'

/** The cases every clinic starts with. Kept in sync with the case_types migration; the seed imports this. */
export const DEFAULT_CASE_TYPES: { systemKey: SystemCaseKey; nameEn: string; nameAr: string; sortOrder: number }[] = [
  { systemKey: 'PREGNANCY', nameEn: 'Pregnancy', nameAr: 'حمل', sortOrder: 10 },
  { systemKey: 'GYNECOLOGY', nameEn: 'Gynecology', nameAr: 'أمراض نساء', sortOrder: 20 },
  { systemKey: 'POSTPARTUM', nameEn: 'Postpartum', nameAr: 'بعد الولادة', sortOrder: 30 },
  { systemKey: 'FERTILITY', nameEn: 'Fertility', nameAr: 'خصوبة', sortOrder: 40 },
]
