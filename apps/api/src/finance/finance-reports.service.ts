import {
  eachDay,
  eachMonth,
  type FinanceExportQuery,
  type FinanceKindCode,
  type FinanceSummaryDto,
  type FinanceSummaryQuery,
  type FinanceTotalsDto,
  type FinanceTransactionDto,
  type FinanceTransactionsDto,
  type FinanceTransactionsQuery,
  PAYMENT_METHODS,
  type PaymentMethodCode,
} from '@azza/shared'
import { Injectable } from '@nestjs/common'
import type { AuthStaff } from '../auth/auth.types'
import { fromIsoDay, toIsoDay } from '../common/format'
import { Prisma } from '../generated/prisma/client'
import { clinicToday } from '../patients/patient-scope.service'
import { PrismaService } from '../prisma/prisma.service'
import { categoryName } from './finance-categories.service'
import { ENTRY_INCLUDE, toEntryDto } from './finance-entries.service'
import { RecurringExpensesService } from './recurring-expenses.service'

const { Decimal } = Prisma
type Decimal = Prisma.Decimal

/** The most ledger lines one request returns (the export allows more). */
const LEDGER_LIMIT = 1000
const EXPORT_LIMIT = 20_000

const money = (d: Decimal) => d.toFixed(2)
const add = (map: Map<string, Decimal>, key: string, value: Decimal) =>
  map.set(key, (map.get(key) ?? new Decimal(0)).plus(value))

interface Flow {
  /** Patient payments, by clinic-local day and method. */
  payments: { day: string; method: PaymentMethodCode; total: Decimal }[]
  /** Finance entries, by day, kind, category and method. */
  entries: { day: string; kind: FinanceKindCode; categoryId: string; method: PaymentMethodCode; total: Decimal }[]
}

/**
 * Revenue (patient payments + other income) and expenses. Voided payments and entries never
 * count. Days are calendar days in the clinic's time zone.
 */
@Injectable()
export class FinanceReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recurring: RecurringExpensesService,
  ) {}

  async summary(staff: AuthStaff, q: FinanceSummaryQuery): Promise<FinanceSummaryDto> {
    const { today, timeZone } = await this.prepare(staff)
    const [flow, todayFlow, categories] = await Promise.all([
      this.flow(staff.clinicId, timeZone, q.from, q.to),
      this.flow(staff.clinicId, timeZone, today, today),
      this.prisma.financeCategory.findMany({
        where: { clinicId: staff.clinicId },
        select: { id: true, nameEn: true, nameAr: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ])

    // Series: every period in the range, empty ones included, so charts have no gaps.
    const periods = q.groupBy === 'month' ? eachMonth(q.from, q.to) : eachDay(q.from, q.to)
    const periodOf = (day: string) => (q.groupBy === 'month' ? day.slice(0, 7) : day)
    const revenue = new Map<string, Decimal>()
    const expenses = new Map<string, Decimal>()
    for (const p of flow.payments) add(revenue, periodOf(p.day), p.total)
    for (const e of flow.entries) add(e.kind === 'INCOME' ? revenue : expenses, periodOf(e.day), e.total)

    const byCategory = new Map<string, Decimal>()
    const incomeByCategory = new Map<string, Decimal>()
    const byMethod = new Map<string, Decimal>()
    for (const e of flow.entries) {
      add(e.kind === 'EXPENSE' ? byCategory : incomeByCategory, e.categoryId, e.total)
      if (e.kind === 'INCOME') add(byMethod, e.method, e.total)
    }
    for (const p of flow.payments) add(byMethod, p.method, p.total)
    const name = (id: string) => categoryName(categories.find((c) => c.id === id)!)
    const totals = this.totals(flow)
    const sortDesc = <T extends { total: string }>(rows: T[]) => rows.sort((a, b) => Number(b.total) - Number(a.total))

    return {
      from: q.from,
      to: q.to,
      groupBy: q.groupBy,
      currency: 'EGP',
      today,
      totals,
      todayTotals: this.totals(todayFlow),
      series: periods.map((period) => {
        const r = revenue.get(period) ?? new Decimal(0)
        const x = expenses.get(period) ?? new Decimal(0)
        return { period, revenue: money(r), expenses: money(x), net: money(r.minus(x)) }
      }),
      expensesByCategory: sortDesc([...byCategory].map(([id, total]) => ({ category: name(id), total: money(total) }))),
      revenueBySource: [
        { category: null, total: totals.patientPayments },
        ...sortDesc([...incomeByCategory].map(([id, total]) => ({ category: name(id), total: money(total) }))),
      ],
      revenueByMethod: PAYMENT_METHODS.filter((m) => byMethod.has(m)).map((method) => ({
        method,
        total: money(byMethod.get(method)!),
      })),
    }
  }

  /** Every patient payment and finance entry in the range, newest day first, voided ones marked. */
  async transactions(
    staff: AuthStaff,
    q: FinanceTransactionsQuery,
    limit = LEDGER_LIMIT,
  ): Promise<FinanceTransactionsDto> {
    const { timeZone } = await this.prepare(staff)
    const { start, end } = await this.bounds(timeZone, q.from, q.to)
    const wantPayments = q.type !== 'expense' && !q.categoryId
    const [payments, entries] = await Promise.all([
      wantPayments
        ? this.prisma.payment.findMany({
            where: { patient: { clinicId: staff.clinicId }, paidAt: { gte: start, lt: end } },
            orderBy: { paidAt: 'desc' },
            take: limit + 1,
            include: { patient: { select: { id: true, fullName: true, fullNameAr: true, fileNumber: true } } },
          })
        : [],
      this.prisma.financeEntry.findMany({
        where: {
          clinicId: staff.clinicId,
          occurredOn: { gte: fromIsoDay(q.from), lte: fromIsoDay(q.to) },
          ...(q.type && { kind: q.type === 'revenue' ? 'INCOME' : 'EXPENSE' }),
          ...(q.categoryId && { categoryId: q.categoryId }),
        },
        orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
        take: limit + 1,
        include: ENTRY_INCLUDE,
      }),
    ])

    const rows: (FinanceTransactionDto & { at: number })[] = [
      ...payments.map((p) => ({
        source: 'payment' as const,
        id: p.id,
        kind: 'INCOME' as const,
        date: clinicToday(timeZone, p.paidAt),
        at: p.paidAt.getTime(),
        amount: money(p.amount),
        currency: p.currency,
        method: p.method,
        label: p.purpose,
        category: null,
        patient: p.patient,
        counterparty: null,
        voided: !!p.voidedAt,
        entry: null,
      })),
      ...entries.map((e) => ({
        source: 'entry' as const,
        id: e.id,
        kind: e.kind,
        date: toIsoDay(e.occurredOn),
        at: e.createdAt.getTime(),
        amount: money(e.amount),
        currency: e.currency,
        method: e.method,
        label: e.description,
        category: categoryName(e.category),
        patient: null,
        counterparty: e.counterparty,
        voided: !!e.voidedAt,
        entry: toEntryDto(e),
      })),
    ]
    rows.sort((a, b) => (a.date === b.date ? b.at - a.at : a.date < b.date ? 1 : -1))
    const truncated = payments.length > limit || entries.length > limit || rows.length > limit
    return { items: rows.slice(0, limit).map(({ at: _, ...row }) => row), truncated }
  }

  /** The ledger as CSV for Excel: UTF-8 with a byte-order mark so Arabic opens correctly. */
  async exportCsv(staff: AuthStaff, q: FinanceExportQuery) {
    const L = LABELS[q.lang]
    const { items, truncated } = await this.transactions(staff, { from: q.from, to: q.to }, EXPORT_LIMIT)
    const lines: unknown[][] = [
      [
        L.date,
        L.type,
        L.category,
        L.description,
        L.patient,
        L.fileNo,
        L.counterparty,
        L.method,
        L.revenue,
        L.expense,
        L.status,
        L.voidReason,
      ],
    ]
    let revenue = new Decimal(0)
    let expenses = new Decimal(0)
    for (const t of [...items].reverse()) {
      const income = t.kind === 'INCOME'
      if (!t.voided) {
        if (income) revenue = revenue.plus(t.amount)
        else expenses = expenses.plus(t.amount)
      }
      lines.push([
        t.date,
        t.source === 'payment' ? L.patientPayment : income ? L.otherIncome : L.expenseType,
        t.category ? t.category.name[q.lang] : '',
        t.label,
        t.patient ? (q.lang === 'ar' && t.patient.fullNameAr) || t.patient.fullName : '',
        t.patient?.fileNumber ?? '',
        t.counterparty ?? '',
        L.methods[t.method],
        income ? t.amount : '',
        income ? '' : t.amount,
        t.voided ? L.voided : '',
        t.entry?.voidReason ?? '',
      ])
    }
    lines.push([])
    lines.push([L.totalRevenue, '', '', '', '', '', '', '', money(revenue)])
    lines.push([L.totalExpenses, '', '', '', '', '', '', '', '', money(expenses)])
    lines.push([L.net, '', '', '', '', '', '', '', money(revenue.minus(expenses))])
    if (truncated) lines.push([L.truncated])
    return '﻿' + lines.map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n'
  }

  /** Today in the clinic, after adding any recurring expenses that have come due. */
  private async prepare(staff: AuthStaff) {
    const { today, timeZone } = await this.recurring.today(staff.clinicId)
    await this.recurring.materialize(staff.clinicId, today)
    return { today, timeZone }
  }

  /** The instants where the first day starts and the day after the last begins, in the clinic's zone. */
  private async bounds(timeZone: string, from: string, to: string) {
    const [row] = await this.prisma.$queryRaw<{ start: Date; end: Date }[]>`
      SELECT (${from}::date)::timestamp AT TIME ZONE ${timeZone} AS start,
             (${to}::date + 1)::timestamp AT TIME ZONE ${timeZone} AS "end"`
    return row
  }

  private async flow(clinicId: string, timeZone: string, from: string, to: string): Promise<Flow> {
    const { start, end } = await this.bounds(timeZone, from, to)
    const [payments, entries] = await Promise.all([
      this.prisma.$queryRaw<{ day: Date; method: PaymentMethodCode; total: Decimal }[]>`
        SELECT (p.paid_at AT TIME ZONE ${timeZone})::date AS day, p.method::text AS method, SUM(p.amount) AS total
        FROM payments p JOIN patients pt ON pt.id = p.patient_id
        WHERE pt.clinic_id = ${clinicId}::uuid AND p.voided_at IS NULL
          AND p.paid_at >= ${start} AND p.paid_at < ${end}
        GROUP BY 1, 2`,
      this.prisma.financeEntry.groupBy({
        by: ['occurredOn', 'kind', 'categoryId', 'method'],
        where: { clinicId, voidedAt: null, occurredOn: { gte: fromIsoDay(from), lte: fromIsoDay(to) } },
        _sum: { amount: true },
      }),
    ])
    return {
      payments: payments.map((p) => ({ day: toIsoDay(p.day), method: p.method, total: new Decimal(p.total) })),
      entries: entries.map((e) => ({
        day: toIsoDay(e.occurredOn),
        kind: e.kind,
        categoryId: e.categoryId,
        method: e.method,
        total: e._sum.amount ?? new Decimal(0),
      })),
    }
  }

  private totals(flow: Flow): FinanceTotalsDto {
    const sum = (values: Decimal[]) => values.reduce((a, b) => a.plus(b), new Decimal(0))
    const patientPayments = sum(flow.payments.map((p) => p.total))
    const otherIncome = sum(flow.entries.filter((e) => e.kind === 'INCOME').map((e) => e.total))
    const expenses = sum(flow.entries.filter((e) => e.kind === 'EXPENSE').map((e) => e.total))
    const revenue = patientPayments.plus(otherIncome)
    return {
      revenue: money(revenue),
      patientPayments: money(patientPayments),
      otherIncome: money(otherIncome),
      expenses: money(expenses),
      net: money(revenue.minus(expenses)),
    }
  }
}

/**
 * Quoted, with quotes doubled. Text that a spreadsheet would run as a formula (=, +, -, @) is
 * prefixed with an apostrophe; amounts are written by us and never start with those.
 */
function csvCell(value: unknown) {
  let text = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

const LABELS = {
  en: {
    date: 'Date',
    type: 'Type',
    category: 'Category',
    description: 'Description',
    patient: 'Patient',
    fileNo: 'File no.',
    counterparty: 'Paid to / received from',
    method: 'Method',
    revenue: 'Revenue (EGP)',
    expense: 'Expense (EGP)',
    status: 'Status',
    voidReason: 'Void reason',
    patientPayment: 'Patient payment',
    otherIncome: 'Other income',
    expenseType: 'Expense',
    voided: 'Voided',
    totalRevenue: 'Total revenue',
    totalExpenses: 'Total expenses',
    net: 'Net',
    truncated: 'Only the first rows are included; export a shorter range for the rest.',
    methods: {
      CASH: 'Cash',
      INSTAPAY: 'InstaPay',
      VODAFONE_CASH: 'Vodafone Cash',
      CARD: 'Card',
      BANK_TRANSFER: 'Bank transfer',
      OTHER: 'Other',
    },
  },
  ar: {
    date: 'التاريخ',
    type: 'النوع',
    category: 'الفئة',
    description: 'الوصف',
    patient: 'المريضة',
    fileNo: 'رقم الملف',
    counterparty: 'المستفيد / المصدر',
    method: 'طريقة الدفع',
    revenue: 'إيراد (ج.م)',
    expense: 'مصروف (ج.م)',
    status: 'الحالة',
    voidReason: 'سبب الإلغاء',
    patientPayment: 'دفعة مريضة',
    otherIncome: 'إيراد آخر',
    expenseType: 'مصروف',
    voided: 'ملغى',
    totalRevenue: 'إجمالي الإيرادات',
    totalExpenses: 'إجمالي المصروفات',
    net: 'الصافي',
    truncated: 'تم تضمين الصفوف الأولى فقط؛ صدّر فترة أقصر للباقي.',
    methods: {
      CASH: 'نقدًا',
      INSTAPAY: 'إنستاباي',
      VODAFONE_CASH: 'فودافون كاش',
      CARD: 'بطاقة',
      BANK_TRANSFER: 'تحويل بنكي',
      OTHER: 'أخرى',
    },
  },
} as const
