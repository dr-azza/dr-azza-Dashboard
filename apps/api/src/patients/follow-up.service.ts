import {
  type CreatePregnancyInput,
  type CreateVisitInput,
  isHighBloodPressure,
  type PregnancyDto,
  type VisitDto,
} from '@azza/shared'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { AuthStaff } from '../auth/auth.types'
import {
  decimalString,
  fromIsoDay,
  fromIsoDayOrNull,
  STAFF_REF_SELECT,
  staffRef,
  toIsoDay,
  toIsoDayOrNull,
} from '../common/format'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { gestationOn, PatientScope, pregnancyFacts } from './patient-scope.service'

type PregnancyRow = Prisma.PregnancyGetPayload<object>
type VisitRow = Prisma.VisitGetPayload<{
  include: { recordedBy: typeof STAFF_REF_SELECT; pregnancy: { select: { lmp: true } } }
}>

function toPregnancyDto(p: PregnancyRow): PregnancyDto {
  const facts = pregnancyFacts(p.lmp, p.eddOverride)
  return {
    id: p.id,
    lmp: toIsoDay(p.lmp),
    edd: facts.edd,
    eddOverride: toIsoDayOrNull(p.eddOverride),
    status: p.status,
    riskNotes: p.riskNotes,
    weeks: facts.weeks,
    days: facts.days,
    createdAt: p.createdAt.toISOString(),
  }
}

function toVisitDto(v: VisitRow, timeZone: string): VisitDto {
  return {
    id: v.id,
    visitedAt: v.visitedAt.toISOString(),
    pregnancyId: v.pregnancyId,
    gestation: v.pregnancy ? gestationOn(v.pregnancy.lmp, v.visitedAt, timeZone) : null,
    weightKg: decimalString(v.weightKg, 1),
    systolic: v.systolic,
    diastolic: v.diastolic,
    highBloodPressure: isHighBloodPressure(v.systolic, v.diastolic),
    fundalHeightCm: decimalString(v.fundalHeightCm, 1),
    fetalHeartRate: v.fetalHeartRate,
    notes: v.notes,
    isPatientReport: v.isPatientReport,
    recordedBy: staffRef(v.recordedBy),
  }
}

@Injectable()
export class FollowUpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PatientScope,
  ) {}

  async listPregnancies(staff: AuthStaff, patientId: string) {
    await this.scope.require(staff, patientId)
    const rows = await this.prisma.pregnancy.findMany({ where: { patientId }, orderBy: { lmp: 'desc' } })
    return rows.map(toPregnancyDto)
  }

  async startPregnancy(staff: AuthStaff, patientId: string, input: CreatePregnancyInput) {
    await this.scope.require(staff, patientId)
    const active = await this.prisma.pregnancy.count({ where: { patientId, status: 'ACTIVE' } })
    if (active) throw new ConflictException('This patient already has an active pregnancy')
    const lmp = fromIsoDay(input.lmp)
    if (lmp.getTime() > Date.now()) throw new BadRequestException('The last period date cannot be in the future')
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.pregnancy.create({
        data: { patientId, lmp, eddOverride: fromIsoDayOrNull(input.eddOverride), riskNotes: input.riskNotes ?? null },
      })
      await tx.patient.update({ where: { id: patientId }, data: { caseType: 'PREGNANCY' } })
      return created
    })
    return toPregnancyDto(row)
  }

  async endPregnancy(staff: AuthStaff, patientId: string, pregnancyId: string, status: 'DELIVERED' | 'ENDED') {
    await this.scope.require(staff, patientId)
    const found = await this.prisma.pregnancy.findFirst({ where: { id: pregnancyId, patientId, status: 'ACTIVE' } })
    if (!found) throw new NotFoundException('Active pregnancy not found')
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.pregnancy.update({ where: { id: pregnancyId }, data: { status, endedAt: new Date() } })
      if (status === 'DELIVERED')
        await tx.patient.update({ where: { id: patientId }, data: { caseType: 'POSTPARTUM' } })
      return updated
    })
    return toPregnancyDto(row)
  }

  async listVisits(staff: AuthStaff, patientId: string) {
    const patient = await this.scope.require(staff, patientId)
    const rows = await this.prisma.visit.findMany({
      where: { patientId },
      orderBy: { visitedAt: 'desc' },
      include: { recordedBy: STAFF_REF_SELECT, pregnancy: { select: { lmp: true } } },
    })
    return rows.map((v) => toVisitDto(v, patient.timeZone))
  }

  async addVisit(staff: AuthStaff, patientId: string, input: CreateVisitInput) {
    const patient = await this.scope.require(staff, patientId)
    let pregnancyId = input.pregnancyId ?? null
    if (pregnancyId) {
      const ok = await this.prisma.pregnancy.count({ where: { id: pregnancyId, patientId } })
      if (!ok) throw new BadRequestException('Pregnancy does not belong to this patient')
    } else {
      // Visits during an active pregnancy belong to it by default.
      pregnancyId =
        (await this.prisma.pregnancy.findFirst({ where: { patientId, status: 'ACTIVE' }, select: { id: true } }))?.id ??
        null
    }
    const row = await this.prisma.visit.create({
      data: {
        patientId,
        pregnancyId,
        recordedById: staff.id,
        visitedAt: new Date(input.visitedAt),
        weightKg: input.weightKg ?? null,
        systolic: input.systolic ?? null,
        diastolic: input.diastolic ?? null,
        fundalHeightCm: input.fundalHeightCm ?? null,
        fetalHeartRate: input.fetalHeartRate ?? null,
        notes: input.notes ?? null,
      },
      include: { recordedBy: STAFF_REF_SELECT, pregnancy: { select: { lmp: true } } },
    })
    return toVisitDto(row, patient.timeZone)
  }
}
