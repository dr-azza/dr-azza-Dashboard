import type { CaseTypeDto, CreateCaseTypeInput, SystemCaseKey, UpdateCaseTypeInput } from '@azza/shared'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { AuthStaff } from '../auth/auth.types'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

/** The cases every clinic starts with (kept in sync with the case_types migration). */
export const DEFAULT_CASE_TYPES: { systemKey: SystemCaseKey; nameEn: string; nameAr: string; sortOrder: number }[] = [
  { systemKey: 'PREGNANCY', nameEn: 'Pregnancy', nameAr: 'حمل', sortOrder: 10 },
  { systemKey: 'GYNECOLOGY', nameEn: 'Gynecology', nameAr: 'أمراض نساء', sortOrder: 20 },
  { systemKey: 'POSTPARTUM', nameEn: 'Postpartum', nameAr: 'بعد الولادة', sortOrder: 30 },
  { systemKey: 'FERTILITY', nameEn: 'Fertility', nameAr: 'خصوبة', sortOrder: 40 },
]

type Row = Prisma.CaseTypeGetPayload<object> & { _count?: { patients: number } }

export const toCaseTypeRef = (c: { id: string; nameEn: string; nameAr: string; systemKey: string | null }) => ({
  id: c.id,
  name: { en: c.nameEn, ar: c.nameAr },
  systemKey: c.systemKey as SystemCaseKey | null,
})

const toDto = (c: Row): CaseTypeDto => ({
  ...toCaseTypeRef(c),
  sortOrder: c.sortOrder,
  archived: c.archivedAt !== null,
  patientCount: c._count?.patients ?? 0,
})

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'

@Injectable()
export class CaseTypesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates the built-in cases for a clinic that has none yet. Safe to call repeatedly. */
  async ensureDefaults(clinicId: string) {
    await this.prisma.caseType.createMany({
      data: DEFAULT_CASE_TYPES.map((c) => ({ ...c, clinicId })),
      skipDuplicates: true,
    })
  }

  async list(staff: AuthStaff, includeArchived = false) {
    await this.ensureDefaults(staff.clinicId)
    const rows = await this.prisma.caseType.findMany({
      where: { clinicId: staff.clinicId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
      include: { _count: { select: { patients: { where: { archivedAt: null } } } } },
    })
    return rows.map(toDto)
  }

  async create(staff: AuthStaff, input: CreateCaseTypeInput) {
    await this.ensureDefaults(staff.clinicId)
    const last = await this.prisma.caseType.aggregate({
      where: { clinicId: staff.clinicId },
      _max: { sortOrder: true },
    })
    try {
      const row = await this.prisma.caseType.create({
        data: {
          clinicId: staff.clinicId,
          nameEn: input.nameEn.trim(),
          nameAr: input.nameAr.trim(),
          sortOrder: (last._max.sortOrder ?? 0) + 10,
        },
      })
      return toDto(row)
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException(`A case named "${input.nameEn}" already exists`)
      throw e
    }
  }

  async update(staff: AuthStaff, id: string, input: UpdateCaseTypeInput) {
    const current = await this.require(staff, id)
    if (input.archived && current.systemKey) {
      throw new BadRequestException('Built-in cases can be renamed but not archived')
    }
    try {
      const row = await this.prisma.caseType.update({
        where: { id },
        data: {
          ...(input.nameEn !== undefined && { nameEn: input.nameEn.trim() }),
          ...(input.nameAr !== undefined && { nameAr: input.nameAr.trim() }),
          ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
          ...(input.archived !== undefined && { archivedAt: input.archived ? new Date() : null }),
        },
        include: { _count: { select: { patients: { where: { archivedAt: null } } } } },
      })
      return toDto(row)
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException(`A case named "${input.nameEn}" already exists`)
      throw e
    }
  }

  /** A case of the staff member's clinic, for assigning to a patient. Archived cases can't take new patients. */
  async requireAssignable(staff: AuthStaff, id: string) {
    const row = await this.prisma.caseType.findFirst({ where: { id, clinicId: staff.clinicId, archivedAt: null } })
    if (!row) throw new BadRequestException('Unknown or archived case')
    return row
  }

  /** The clinic's built-in case with this key (e.g. to move a patient to POSTPARTUM on delivery). */
  async systemCase(clinicId: string, systemKey: SystemCaseKey) {
    await this.ensureDefaults(clinicId)
    return this.prisma.caseType.findFirstOrThrow({ where: { clinicId, systemKey } })
  }

  private async require(staff: AuthStaff, id: string) {
    const row = await this.prisma.caseType.findFirst({ where: { id, clinicId: staff.clinicId } })
    if (!row) throw new NotFoundException('Case not found')
    return row
  }
}
