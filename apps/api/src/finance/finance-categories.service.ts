import {
  type CreateFinanceCategoryInput,
  type FinanceCategoryDto,
  type FinanceKindCode,
  SYSTEM_FINANCE_CATEGORIES,
  type UpdateFinanceCategoryInput,
} from '@azza/shared'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { AuthStaff } from '../auth/auth.types'
import type { FinanceCategory } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export const toCategoryDto = (c: FinanceCategory): FinanceCategoryDto => ({
  id: c.id,
  kind: c.kind,
  name: { en: c.nameEn, ar: c.nameAr },
  systemKey: c.systemKey,
  archived: !!c.archivedAt,
})

export const CATEGORY_NAME_SELECT = { select: { id: true, nameEn: true, nameAr: true } } as const
export const categoryName = (c: { id: string; nameEn: string; nameAr: string }) => ({
  id: c.id,
  name: { en: c.nameEn, ar: c.nameAr },
})

@Injectable()
export class FinanceCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates the built-in categories the first time a clinic opens finances (idempotent). */
  async ensureDefaults(clinicId: string) {
    const existing = await this.prisma.financeCategory.count({ where: { clinicId, systemKey: { not: null } } })
    if (existing >= SYSTEM_FINANCE_CATEGORIES.length) return
    await this.prisma.financeCategory.createMany({
      data: SYSTEM_FINANCE_CATEGORIES.map((c, i) => ({
        clinicId,
        kind: c.kind,
        nameEn: c.en,
        nameAr: c.ar,
        systemKey: c.key,
        sortOrder: i,
      })),
      skipDuplicates: true,
    })
  }

  async list(staff: AuthStaff, includeArchived: boolean) {
    await this.ensureDefaults(staff.clinicId)
    const rows = await this.prisma.financeCategory.findMany({
      where: { clinicId: staff.clinicId, ...(!includeArchived && { archivedAt: null }) },
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return rows.map(toCategoryDto)
  }

  async create(staff: AuthStaff, input: CreateFinanceCategoryInput) {
    const last = await this.prisma.financeCategory.aggregate({
      where: { clinicId: staff.clinicId, kind: input.kind },
      _max: { sortOrder: true },
    })
    const row = await this.prisma.financeCategory.create({
      data: {
        clinicId: staff.clinicId,
        kind: input.kind,
        nameEn: input.nameEn,
        nameAr: input.nameAr,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
    })
    return toCategoryDto(row)
  }

  async update(staff: AuthStaff, categoryId: string, input: UpdateFinanceCategoryInput) {
    await this.require(staff, categoryId)
    const row = await this.prisma.financeCategory.update({
      where: { id: categoryId },
      data: {
        ...(input.nameEn !== undefined && { nameEn: input.nameEn }),
        ...(input.nameAr !== undefined && { nameAr: input.nameAr }),
        ...(input.archived !== undefined && { archivedAt: input.archived ? new Date() : null }),
      },
    })
    return toCategoryDto(row)
  }

  /** A category of this clinic that can take new money (not archived), optionally of one kind. */
  async requireAssignable(staff: AuthStaff, categoryId: string, kind?: FinanceKindCode) {
    const category = await this.require(staff, categoryId)
    if (category.archivedAt) throw new BadRequestException('That category is archived')
    if (kind && category.kind !== kind) {
      throw new BadRequestException(kind === 'EXPENSE' ? 'Choose an expense category' : 'Choose an income category')
    }
    return category
  }

  private async require(staff: AuthStaff, categoryId: string) {
    const category = await this.prisma.financeCategory.findFirst({
      where: { id: categoryId, clinicId: staff.clinicId },
    })
    if (!category) throw new NotFoundException('Category not found')
    return category
  }
}
