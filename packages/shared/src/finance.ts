/**
 * Clinic finances: revenue (patient payments plus other income) and expenses, by day and month.
 * Owners only. Days are calendar days in the clinic's time zone, as YYYY-MM-DD.
 */
import { z } from 'zod'
import type { PaymentMethodCode, StaffRef } from './api-types.js'
import { isoDate, moneyAmount, optionalText, requiredText } from './schemas/common.js'
import { PAYMENT_METHODS } from './schemas/patient-record.js'

export const FINANCE_KINDS = ['INCOME', 'EXPENSE'] as const
export type FinanceKindCode = (typeof FINANCE_KINDS)[number]

/** Who can see and manage clinic finances. Everyone still records patient payments. */
export const FINANCE_ROLES = ['OWNER'] as const
export const canSeeFinance = (role: string) => (FINANCE_ROLES as readonly string[]).includes(role)

/** The longest range one report or export covers (a little over a year). */
export const MAX_FINANCE_RANGE_DAYS = 400

/** Built-in categories every clinic starts with; owners rename, add or archive. */
export const SYSTEM_FINANCE_CATEGORIES = [
  { key: 'RENT', kind: 'EXPENSE', en: 'Rent', ar: 'الإيجار' },
  { key: 'SALARIES', kind: 'EXPENSE', en: 'Salaries', ar: 'الرواتب' },
  { key: 'SUPPLIES', kind: 'EXPENSE', en: 'Medical supplies', ar: 'مستلزمات طبية' },
  { key: 'UTILITIES', kind: 'EXPENSE', en: 'Utilities', ar: 'المرافق' },
  { key: 'EQUIPMENT', kind: 'EXPENSE', en: 'Equipment and maintenance', ar: 'الأجهزة والصيانة' },
  { key: 'MARKETING', kind: 'EXPENSE', en: 'Marketing', ar: 'التسويق' },
  { key: 'OTHER_EXPENSE', kind: 'EXPENSE', en: 'Other expenses', ar: 'مصروفات أخرى' },
  { key: 'LAB_COMMISSION', kind: 'INCOME', en: 'Lab and pharmacy commissions', ar: 'عمولات المعامل والصيدليات' },
  { key: 'OTHER_INCOME', kind: 'INCOME', en: 'Other income', ar: 'إيرادات أخرى' },
] as const satisfies readonly { key: string; kind: FinanceKindCode; en: string; ar: string }[]

const Range = z.object({ from: isoDate, to: isoDate })

/** from ≤ to, and not longer than MAX_FINANCE_RANGE_DAYS. */
function checkRange(q: { from: string; to: string }, ctx: z.RefinementCtx) {
  if (q.from > q.to) ctx.addIssue({ code: 'custom', message: '"from" must be on or before "to"', path: ['to'] })
  else if ((Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 >= MAX_FINANCE_RANGE_DAYS) {
    ctx.addIssue({ code: 'custom', message: `A range can cover at most ${MAX_FINANCE_RANGE_DAYS} days`, path: ['to'] })
  }
}

export const FinanceSummaryQuerySchema = Range.extend({ groupBy: z.enum(['day', 'month']).default('day') }).superRefine(
  checkRange,
)
export type FinanceSummaryQuery = z.output<typeof FinanceSummaryQuerySchema>

export const FinanceTransactionsQuerySchema = Range.extend({
  /** revenue: patient payments and other income; expense: expenses. Omitted: both. */
  type: z.enum(['revenue', 'expense']).optional(),
  categoryId: z.uuid().optional(),
}).superRefine(checkRange)
export type FinanceTransactionsQuery = z.output<typeof FinanceTransactionsQuerySchema>

export const FinanceExportQuerySchema = Range.extend({ lang: z.enum(['en', 'ar']).default('en') }).superRefine(
  checkRange,
)
export type FinanceExportQuery = z.output<typeof FinanceExportQuerySchema>

// --- Entries ---------------------------------------------------------------------

/** Income or expense follows from the category. */
export const CreateFinanceEntrySchema = z.object({
  categoryId: z.uuid(),
  amount: moneyAmount,
  method: z.enum(PAYMENT_METHODS),
  occurredOn: isoDate,
  description: requiredText(200),
  counterparty: optionalText(120),
  reference: optionalText(120),
  notes: optionalText(1000),
})
export type CreateFinanceEntryInput = z.input<typeof CreateFinanceEntrySchema>

export const UpdateFinanceEntrySchema = CreateFinanceEntrySchema.partial()
export type UpdateFinanceEntryInput = z.input<typeof UpdateFinanceEntrySchema>

export const VoidFinanceEntrySchema = z.object({ reason: requiredText(300) })

// --- Categories ------------------------------------------------------------------

export const CreateFinanceCategorySchema = z.object({
  kind: z.enum(FINANCE_KINDS),
  nameEn: requiredText(60),
  nameAr: requiredText(60),
})
export type CreateFinanceCategoryInput = z.input<typeof CreateFinanceCategorySchema>

export const UpdateFinanceCategorySchema = z
  .object({
    nameEn: requiredText(60),
    nameAr: requiredText(60),
    archived: z.boolean(),
  })
  .partial()
export type UpdateFinanceCategoryInput = z.input<typeof UpdateFinanceCategorySchema>

// --- Recurring expenses ----------------------------------------------------------

export const CreateRecurringExpenseSchema = z
  .object({
    categoryId: z.uuid(),
    amount: moneyAmount,
    method: z.enum(PAYMENT_METHODS),
    description: requiredText(200),
    counterparty: optionalText(120),
    /** Up to the 28th, so every month has the day. */
    dayOfMonth: z.number().int().min(1).max(28),
    startsOn: isoDate,
    endsOn: isoDate.nullish(),
  })
  .refine((r) => !r.endsOn || r.endsOn >= r.startsOn, {
    message: 'The end date must be on or after the start date',
    path: ['endsOn'],
  })
export type CreateRecurringExpenseInput = z.input<typeof CreateRecurringExpenseSchema>

export const UpdateRecurringExpenseSchema = z
  .object({
    categoryId: z.uuid(),
    amount: moneyAmount,
    method: z.enum(PAYMENT_METHODS),
    description: requiredText(200),
    counterparty: optionalText(120),
    dayOfMonth: z.number().int().min(1).max(28),
    endsOn: isoDate.nullable(),
    paused: z.boolean(),
  })
  .partial()
export type UpdateRecurringExpenseInput = z.input<typeof UpdateRecurringExpenseSchema>

// --- Responses -------------------------------------------------------------------

type Name = { en: string; ar: string }

export interface FinanceCategoryDto {
  id: string
  kind: FinanceKindCode
  name: Name
  systemKey: string | null
  archived: boolean
}

export interface FinanceReceiptDto {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export interface FinanceEntryDto {
  id: string
  kind: FinanceKindCode
  category: { id: string; name: Name }
  /** Decimal string, e.g. "1500.00". */
  amount: string
  currency: string
  method: PaymentMethodCode
  occurredOn: string
  description: string
  counterparty: string | null
  reference: string | null
  notes: string | null
  /** Set when it was added by a recurring expense. */
  recurringId: string | null
  createdBy: StaffRef | null
  createdAt: string
  voidedAt: string | null
  voidReason: string | null
  voidedBy: StaffRef | null
  receipts: FinanceReceiptDto[]
}

/** One line of the ledger: a patient payment or a finance entry. */
export interface FinanceTransactionDto {
  source: 'payment' | 'entry'
  id: string
  kind: FinanceKindCode
  /** The clinic-local day. */
  date: string
  amount: string
  currency: string
  method: PaymentMethodCode
  /** Payment purpose or entry description. */
  label: string
  category: { id: string; name: Name } | null
  patient: { id: string; fullName: string; fullNameAr: string | null; fileNumber: string } | null
  counterparty: string | null
  voided: boolean
  /** The full entry, for editing; null for patient payments (edited on the patient's record). */
  entry: FinanceEntryDto | null
}

export interface FinanceTransactionsDto {
  items: FinanceTransactionDto[]
  /** More matched than the list returns; narrow the range. */
  truncated: boolean
}

export interface FinanceTotalsDto {
  /** Patient payments plus other income. */
  revenue: string
  patientPayments: string
  otherIncome: string
  expenses: string
  /** Revenue minus expenses; may be negative. */
  net: string
}

export interface FinanceSummaryDto {
  from: string
  to: string
  groupBy: 'day' | 'month'
  currency: string
  /** Today in the clinic's time zone. */
  today: string
  totals: FinanceTotalsDto
  todayTotals: FinanceTotalsDto
  /** Every day (or month, as YYYY-MM) in the range, including empty ones. */
  series: { period: string; revenue: string; expenses: string; net: string }[]
  expensesByCategory: { category: { id: string; name: Name }; total: string }[]
  /** Patient payments first (category null), then each income category. */
  revenueBySource: { category: { id: string; name: Name } | null; total: string }[]
  revenueByMethod: { method: PaymentMethodCode; total: string }[]
}

export interface RecurringExpenseDto {
  id: string
  category: { id: string; name: Name }
  amount: string
  currency: string
  method: PaymentMethodCode
  description: string
  counterparty: string | null
  dayOfMonth: number
  startsOn: string
  endsOn: string | null
  paused: boolean
  /** The next day it will be added, or null if paused or ended. */
  nextOn: string | null
  createdAt: string
}

// --- Calendar helpers (pure, no time zone: days are already clinic-local) --------

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-11" → first and last day, "2026-11-01" and "2026-11-30". */
export function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` }
}

/** "2026-11" + n months → "2027-01". */
export function addMonths(month: string, n: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}

/** A calendar day moved by n days: shiftDay("2026-03-01", -1) → "2026-02-28". */
export function shiftDay(day: string, n: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}

/** Every day from `from` to `to`, inclusive. */
export function eachDay(from: string, to: string) {
  const out: string[] = []
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

/** Every month (YYYY-MM) touched by the range. */
export function eachMonth(from: string, to: string) {
  const out: string[] = []
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = addMonths(m, 1)) out.push(m)
  return out
}

/**
 * The day a recurring expense falls on in a month, if that day is within its start and end;
 * otherwise null.
 */
export function recurrenceDay(r: { dayOfMonth: number; startsOn: string; endsOn: string | null }, month: string) {
  const day = `${month}-${pad(r.dayOfMonth)}`
  if (day < r.startsOn) return null
  if (r.endsOn && day > r.endsOn) return null
  return day
}
