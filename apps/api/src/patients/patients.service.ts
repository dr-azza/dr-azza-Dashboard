import {
  type AllergyDto,
  type CreatePatientInput,
  isHighBloodPressure,
  type ListPatientsQuery,
  type Page,
  type PatientDto,
  type PatientListItemDto,
  type TimelineEventDto,
  type UpdatePatientInput,
} from '@azza/shared'
import { ConflictException, Injectable } from '@nestjs/common'
import type { AuthStaff } from '../auth/auth.types'
import {
  ageFrom,
  decimalString,
  fromIsoDayOrNull,
  STAFF_REF_SELECT,
  staffRef,
  toIsoDay,
  toIsoDayOrNull,
} from '../common/format'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AppointmentsService } from '../appointments/appointments.service'
import { CaseTypesService, toCaseTypeRef } from '../case-types/case-types.service'
import { PatientScope, pregnancyFacts } from './patient-scope.service'

const LIST_SELECT = {
  id: true,
  fileNumber: true,
  fullName: true,
  fullNameAr: true,
  phone: true,
  dateOfBirth: true,
  caseType: { select: { id: true, nameEn: true, nameAr: true, systemKey: true } },
  status: true,
  pregnancies: {
    where: { status: 'ACTIVE' },
    orderBy: { lmp: 'desc' },
    take: 1,
    select: { id: true, lmp: true, eddOverride: true },
  },
  visits: { orderBy: { visitedAt: 'desc' }, take: 1, select: { visitedAt: true } },
} satisfies Prisma.PatientSelect

type ListRow = Prisma.PatientGetPayload<{ select: typeof LIST_SELECT }>

function toListItem(p: ListRow): PatientListItemDto {
  const pregnancy = p.pregnancies[0]
  const facts = pregnancy ? pregnancyFacts(pregnancy.lmp, pregnancy.eddOverride) : null
  return {
    id: p.id,
    fileNumber: p.fileNumber,
    fullName: p.fullName,
    fullNameAr: p.fullNameAr,
    phone: p.phone,
    age: ageFrom(p.dateOfBirth),
    caseType: toCaseTypeRef(p.caseType),
    status: p.status,
    activePregnancy:
      pregnancy && facts
        ? {
            id: pregnancy.id,
            lmp: toIsoDay(pregnancy.lmp),
            edd: facts.edd,
            weeks: facts.weeks,
            days: facts.days,
            trimester: facts.trimester,
          }
        : null,
    lastVisitAt: p.visits[0]?.visitedAt.toISOString() ?? null,
  }
}

/** Opaque keyset cursor: (fullName, id) of the last row, so pages stay stable while data changes. */
const encodeCursor = (row: { fullName: string; id: string }) =>
  Buffer.from(JSON.stringify([row.fullName, row.id])).toString('base64url')
function decodeCursor(cursor?: string): [string, string] | null {
  if (!cursor) return null
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    return Array.isArray(value) && value.length === 2 ? (value as [string, string]) : null
  } catch {
    return null
  }
}

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PatientScope,
    private readonly caseTypes: CaseTypesService,
    private readonly appointments: AppointmentsService,
  ) {}

  async list(staff: AuthStaff, query: ListPatientsQuery): Promise<Page<PatientListItemDto>> {
    const limit = query.limit
    const q = query.q?.trim()
    const digits = q?.replace(/\D/g, '')
    const after = decodeCursor(query.cursor)

    const where: Prisma.PatientWhereInput = {
      clinicId: staff.clinicId,
      archivedAt: null,
      ...(query.caseTypeId && { caseTypeId: query.caseTypeId }),
      ...(query.status && { status: query.status }),
      ...(q && {
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { fullNameAr: { contains: q } },
          { fileNumber: { contains: q, mode: 'insensitive' } },
          ...(digits && digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        ],
      }),
      ...(after && {
        AND: [{ OR: [{ fullName: { gt: after[0] } }, { fullName: after[0], id: { gt: after[1] } }] }],
      }),
    }

    const rows = await this.prisma.patient.findMany({
      where,
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      select: LIST_SELECT,
    })
    const page = rows.slice(0, limit)
    return { items: page.map(toListItem), nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null }
  }

  /** File numbers are always assigned by the clinic, never typed, so they stay unique and sequential. */
  async create(staff: AuthStaff, input: CreatePatientInput) {
    const caseType = await this.caseTypes.requireAssignable(staff, input.caseTypeId)
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const patient = await this.prisma.patient.create({
          data: {
            clinicId: staff.clinicId,
            fileNumber: await this.nextFileNumber(staff.clinicId),
            fullName: input.fullName.trim(),
            fullNameAr: input.fullNameAr?.trim() || null,
            phone: input.phone,
            dateOfBirth: fromIsoDayOrNull(input.dateOfBirth),
            caseTypeId: caseType.id,
            consentAt: new Date(),
          },
          select: { id: true },
        })
        return this.get(staff, patient.id)
      } catch (error) {
        // Two receptionists saving at the same moment get the same next number; the loser retries.
        const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
        if (!duplicate) throw error
      }
    }
    throw new ConflictException('Could not assign a file number, please retry')
  }

  /** Next "P-0001"-style number for the clinic. */
  private async nextFileNumber(clinicId: string) {
    const [row] = await this.prisma.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(CAST(SUBSTRING(file_number FROM '^P-(\\d+)$') AS INTEGER)) AS max
      FROM patients WHERE clinic_id = ${clinicId}::uuid`
    return `P-${String((row?.max ?? 0) + 1).padStart(4, '0')}`
  }

  async get(staff: AuthStaff, patientId: string): Promise<PatientDto> {
    await this.scope.require(staff, patientId)
    const p = await this.prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      select: {
        ...LIST_SELECT,
        consentAt: true,
        createdAt: true,
        medicalHistory: { select: { allergies: true, bloodGroup: true } },
        obstetricHistory: { select: { outcome: true } },
        _count: {
          select: {
            visits: true,
            prescriptions: { where: { voidedAt: null } },
            attachments: { where: { deletedAt: null } },
            historyEntries: { where: { deletedAt: null } },
          },
        },
      },
    })
    const [paid, next] = await Promise.all([
      this.prisma.payment.aggregate({ where: { patientId, voidedAt: null }, _sum: { amount: true } }),
      this.appointments.next(patientId),
    ])
    const births = p.obstetricHistory.filter((e) => e.outcome === 'LIVE_BIRTH' || e.outcome === 'STILLBIRTH').length

    return {
      ...toListItem(p),
      dateOfBirth: toIsoDayOrNull(p.dateOfBirth),
      consentAt: p.consentAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      allergies: (p.medicalHistory?.allergies ?? []) as unknown as AllergyDto[],
      bloodGroup: (p.medicalHistory?.bloodGroup ?? null) as PatientDto['bloodGroup'],
      gravida: p.obstetricHistory.length + (p.pregnancies.length ? 1 : 0),
      para: births,
      totals: {
        visits: p._count.visits,
        historyEntries: p._count.historyEntries,
        prescriptions: p._count.prescriptions,
        files: p._count.attachments,
        paid: decimalString(paid._sum.amount) ?? '0.00',
      },
      nextAppointment: next
        ? { id: next.id, type: next.type, title: next.title, startsAt: next.startsAt.toISOString() }
        : null,
    }
  }

  async update(staff: AuthStaff, patientId: string, input: UpdatePatientInput) {
    await this.scope.require(staff, patientId)
    // Moving to a different case needs an active one; re-sending the current (even archived) case is fine.
    const current = await this.prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      select: { caseTypeId: true },
    })
    const caseTypeId =
      input.caseTypeId && input.caseTypeId !== current.caseTypeId
        ? (await this.caseTypes.requireAssignable(staff, input.caseTypeId)).id
        : undefined
    await this.prisma.patient.update({
      where: { id: patientId },
      data: {
        ...(input.fullName !== undefined && { fullName: input.fullName.trim() }),
        ...(input.fullNameAr !== undefined && { fullNameAr: input.fullNameAr?.trim() || null }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.dateOfBirth !== undefined && { dateOfBirth: fromIsoDayOrNull(input.dateOfBirth) }),
        ...(caseTypeId && { caseTypeId }),
        ...(input.status !== undefined && { status: input.status }),
      },
    })
    return this.get(staff, patientId)
  }

  /** Everything that happened to the patient, newest first. */
  async timeline(staff: AuthStaff, patientId: string, limit = 60): Promise<TimelineEventDto[]> {
    await this.scope.require(staff, patientId)
    const by = STAFF_REF_SELECT
    const [visits, prescriptions, payments, files, notes, pregnancies, history] = await Promise.all([
      this.prisma.visit.findMany({
        where: { patientId },
        orderBy: { visitedAt: 'desc' },
        take: limit,
        include: { recordedBy: by },
      }),
      this.prisma.prescription.findMany({
        where: { patientId },
        orderBy: { issuedAt: 'desc' },
        take: limit,
        include: { prescribedBy: by, items: { orderBy: { position: 'asc' }, select: { drugName: true } } },
      }),
      this.prisma.payment.findMany({
        where: { patientId },
        orderBy: { paidAt: 'desc' },
        take: limit,
        include: { receivedBy: by },
      }),
      this.prisma.attachment.findMany({
        where: { patientId, deletedAt: null, kind: { not: 'PAYMENT_PROOF' } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { uploadedBy: by },
      }),
      this.prisma.clinicalNote.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { author: by },
      }),
      this.prisma.pregnancy.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' }, take: limit }),
      this.prisma.historyEntry.findMany({
        where: { patientId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, createdAt: true, title: true, bodyText: true, author: by },
      }),
    ])

    const events: TimelineEventDto[] = [
      ...history.map((h) => ({
        type: 'history' as const,
        id: h.id,
        at: h.createdAt.toISOString(),
        label: h.title,
        detail: h.bodyText.length > 200 ? `${h.bodyText.slice(0, 200).trimEnd()}…` : h.bodyText,
        code: null,
        by: staffRef(h.author),
      })),
      ...visits.map((v) => {
        const bp = v.systolic != null && v.diastolic != null ? `BP ${v.systolic}/${v.diastolic}` : null
        const weight = v.weightKg ? `${v.weightKg.toFixed(1)} kg` : null
        return {
          type: 'visit' as const,
          id: v.id,
          at: v.visitedAt.toISOString(),
          label: null,
          detail: [bp, weight, v.notes].filter(Boolean).join(' · ') || null,
          code: v.isPatientReport ? 'patient-report' : null,
          by: staffRef(v.recordedBy),
          ...(isHighBloodPressure(v.systolic, v.diastolic) && { flag: 'warning' as const }),
        }
      }),
      ...prescriptions.map((r) => ({
        type: 'prescription' as const,
        id: r.id,
        at: r.issuedAt.toISOString(),
        label: r.number,
        detail: r.items.map((i) => i.drugName).join(', ') || null,
        code: null,
        by: staffRef(r.prescribedBy),
        ...(r.voidedAt && { flag: 'voided' as const }),
      })),
      ...payments.map((p) => ({
        type: 'payment' as const,
        id: p.id,
        at: p.paidAt.toISOString(),
        label: null,
        detail: p.purpose,
        code: p.method,
        amount: p.amount.toFixed(2),
        currency: p.currency,
        by: staffRef(p.receivedBy),
        ...(p.voidedAt && { flag: 'voided' as const }),
      })),
      ...files.map((f) => ({
        type: 'file' as const,
        id: f.id,
        at: f.createdAt.toISOString(),
        label: f.title,
        detail: null,
        code: f.kind,
        by: staffRef(f.uploadedBy),
      })),
      ...notes.map((n) => ({
        type: 'note' as const,
        id: n.id,
        at: n.createdAt.toISOString(),
        label: null,
        detail: n.body.length > 160 ? `${n.body.slice(0, 157)}…` : n.body,
        code: null,
        by: staffRef(n.author),
      })),
      ...pregnancies.map((p) => ({
        type: 'pregnancy' as const,
        id: p.id,
        at: p.createdAt.toISOString(),
        label: null,
        detail: `LMP ${toIsoDay(p.lmp)}`,
        code: null,
        by: null,
      })),
    ]
    return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
  }
}
