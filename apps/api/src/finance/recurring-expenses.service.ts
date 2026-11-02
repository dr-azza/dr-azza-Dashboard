import {
  addMonths,
  shiftDay,
  type CreateRecurringExpenseInput,
  eachMonth,
  recurrenceDay,
  type RecurringExpenseDto,
  type UpdateRecurringExpenseInput,
} from '@azza/shared'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { AuthStaff } from '../auth/auth.types'
import { fromIsoDay, fromIsoDayOrNull, toIsoDay, toIsoDayOrNull } from '../common/format'
import type { Prisma } from '../generated/prisma/client'
import { clinicToday } from '../patients/patient-scope.service'
import { PrismaService } from '../prisma/prisma.service'
import { CATEGORY_NAME_SELECT, categoryName, FinanceCategoriesService } from './finance-categories.service'

/** How far back a new recurring expense may start (its past months are added at once). */
const MAX_BACKFILL_DAYS = 366

const INCLUDE = { category: CATEGORY_NAME_SELECT } satisfies Prisma.RecurringExpenseInclude
type Row = Prisma.RecurringExpenseGetPayload<{ include: typeof INCLUDE }>

const plain = (r: Row) => ({
  dayOfMonth: r.dayOfMonth,
  startsOn: toIsoDay(r.startsOn),
  endsOn: toIsoDayOrNull(r.endsOn),
})

/** The next day on or after `today` it will be added, or null if paused or past its end. */
function nextOn(r: Row, today: string) {
  if (r.pausedAt) return null
  const rule = plain(r)
  let month = (rule.startsOn > today ? rule.startsOn : today).slice(0, 7)
  for (let i = 0; i < 13; i++, month = addMonths(month, 1)) {
    if (rule.endsOn && `${month}-01` > rule.endsOn) return null
    const day = recurrenceDay(rule, month)
    if (day && day >= today) return day
  }
  return null
}

const toDto = (r: Row, today: string): RecurringExpenseDto => ({
  id: r.id,
  category: categoryName(r.category),
  amount: r.amount.toFixed(2),
  currency: r.currency,
  method: r.method,
  description: r.description,
  counterparty: r.counterparty,
  dayOfMonth: r.dayOfMonth,
  startsOn: toIsoDay(r.startsOn),
  endsOn: toIsoDayOrNull(r.endsOn),
  paused: !!r.pausedAt,
  nextOn: nextOn(r, today),
  createdAt: r.createdAt.toISOString(),
})

/**
 * Monthly expenses (rent, salaries). There is no scheduler: whenever finances are read, every
 * occurrence due by today is added. The unique (recurring expense, month) key makes this
 * idempotent and safe when two requests do it at once; an occurrence that was voided stays voided.
 */
@Injectable()
export class RecurringExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: FinanceCategoriesService,
  ) {}

  async today(clinicId: string) {
    const clinic = await this.prisma.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { timezone: true } })
    return { today: clinicToday(clinic.timezone), timeZone: clinic.timezone }
  }

  /**
   * Adds every occurrence due by today that isn't there yet. Each rule remembers how far it was
   * brought up to date, so this only looks at days since then; paused rules are skipped and do
   * not advance (resuming moves them past the paused days instead).
   */
  async materialize(clinicId: string, today: string) {
    const todayDate = fromIsoDay(today)
    const due = await this.prisma.recurringExpense.findMany({
      where: {
        clinicId,
        pausedAt: null,
        startsOn: { lte: todayDate },
        OR: [{ materializedThrough: null }, { materializedThrough: { lt: todayDate } }],
      },
    })
    if (!due.length) return
    const data: Prisma.FinanceEntryCreateManyInput[] = []
    for (const r of due) {
      const rule = { dayOfMonth: r.dayOfMonth, startsOn: toIsoDay(r.startsOn), endsOn: toIsoDayOrNull(r.endsOn) }
      const after = toIsoDayOrNull(r.materializedThrough)
      for (const month of eachMonth(after ?? rule.startsOn, today)) {
        const day = recurrenceDay(rule, month)
        if (!day || day > today || (after && day <= after)) continue
        data.push({
          clinicId,
          kind: 'EXPENSE',
          categoryId: r.categoryId,
          amount: r.amount,
          currency: r.currency,
          method: r.method,
          occurredOn: fromIsoDay(day),
          description: r.description,
          counterparty: r.counterparty,
          recurringId: r.id,
          recurrenceMonth: fromIsoDay(`${month}-01`),
          createdById: r.createdById,
        })
      }
    }
    // Racing requests both insert; the unique (recurring expense, month) key keeps one.
    if (data.length) await this.prisma.financeEntry.createMany({ data, skipDuplicates: true })
    await this.prisma.recurringExpense.updateMany({
      where: { id: { in: due.map((r) => r.id) }, pausedAt: null },
      data: { materializedThrough: todayDate },
    })
  }

  async list(staff: AuthStaff) {
    const { today } = await this.today(staff.clinicId)
    await this.materialize(staff.clinicId, today)
    const rows = await this.prisma.recurringExpense.findMany({
      where: { clinicId: staff.clinicId },
      orderBy: [{ pausedAt: { sort: 'asc', nulls: 'first' } }, { dayOfMonth: 'asc' }, { createdAt: 'asc' }],
      include: INCLUDE,
    })
    return rows.map((r) => toDto(r, today))
  }

  async create(staff: AuthStaff, input: CreateRecurringExpenseInput) {
    await this.categories.requireAssignable(staff, input.categoryId, 'EXPENSE')
    const { today } = await this.today(staff.clinicId)
    const earliest = new Date(Date.parse(`${today}T00:00:00Z`) - MAX_BACKFILL_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10)
    if (input.startsOn < earliest) throw new BadRequestException('A recurring expense can start at most a year ago')
    const row = await this.prisma.recurringExpense.create({
      data: {
        clinicId: staff.clinicId,
        categoryId: input.categoryId,
        amount: input.amount,
        method: input.method,
        description: input.description,
        counterparty: input.counterparty ?? null,
        dayOfMonth: input.dayOfMonth,
        startsOn: fromIsoDay(input.startsOn),
        endsOn: fromIsoDayOrNull(input.endsOn),
        createdById: staff.id,
      },
      include: INCLUDE,
    })
    await this.materialize(staff.clinicId, today)
    return toDto(row, today)
  }

  /**
   * Changes apply from now on; entries already added keep their amounts. Resuming, or extending
   * one that had ended, continues from today: the months it was off are not added afterwards.
   */
  async update(staff: AuthStaff, id: string, input: UpdateRecurringExpenseInput) {
    const current = await this.require(staff, id)
    if (input.categoryId && input.categoryId !== current.categoryId) {
      await this.categories.requireAssignable(staff, input.categoryId, 'EXPENSE')
    }
    if (input.endsOn && input.endsOn < toIsoDay(current.startsOn)) {
      throw new BadRequestException('The end date must be on or after the start date')
    }
    const { today } = await this.today(staff.clinicId)
    // Bring it up to date first, so months already due use the old terms.
    await this.materialize(staff.clinicId, today)
    const resuming = input.paused === false && !!current.pausedAt
    const yesterday = fromIsoDay(shiftDay(today, -1))
    const row = await this.prisma.recurringExpense.update({
      where: { id },
      data: {
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.method !== undefined && { method: input.method }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.counterparty !== undefined && { counterparty: input.counterparty }),
        ...(input.dayOfMonth !== undefined && { dayOfMonth: input.dayOfMonth }),
        ...(input.endsOn !== undefined && { endsOn: fromIsoDayOrNull(input.endsOn) }),
        ...(input.paused === true && !current.pausedAt && { pausedAt: new Date() }),
        // Paused days are skipped, not owed: pick up from today (today's own occurrence included).
        ...(resuming && { pausedAt: null, materializedThrough: yesterday }),
      },
      include: INCLUDE,
    })
    if (resuming) await this.materialize(staff.clinicId, today)
    return toDto(row, today)
  }

  private async require(staff: AuthStaff, id: string) {
    const row = await this.prisma.recurringExpense.findFirst({ where: { id, clinicId: staff.clinicId } })
    if (!row) throw new NotFoundException('Recurring expense not found')
    return row
  }
}
