import type { MedicalHistoryDto, MedicalHistoryInput, ObstetricEntryDto, ObstetricEntryInput } from '@azza/shared'
import { Injectable, NotFoundException } from '@nestjs/common'
import type { AuthStaff } from '../auth/auth.types'
import { fromIsoDayOrNull, toIsoDayOrNull } from '../common/format'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { PatientScope } from './patient-scope.service'

const EMPTY_HISTORY: MedicalHistoryDto = {
  allergies: [],
  chronicConditions: [],
  currentMedications: [],
  surgeries: [],
  bloodGroup: null,
  familyHistory: null,
  smoking: null,
  menarcheAge: null,
  cycleLengthDays: null,
  periodLengthDays: null,
  cycleRegular: null,
  contraception: null,
  lastPapSmearAt: null,
  lastPapSmearResult: null,
  gynNotes: null,
  updatedAt: null,
}

type ObstetricRow = Prisma.ObstetricHistoryEntryGetPayload<object>

const toObstetricDto = (e: ObstetricRow): ObstetricEntryDto => ({
  id: e.id,
  year: e.year,
  outcome: e.outcome,
  deliveryMode: e.deliveryMode,
  gestationWeeks: e.gestationWeeks,
  birthWeightG: e.birthWeightG,
  complications: e.complications,
  notes: e.notes,
})

const obstetricData = (input: ObstetricEntryInput) => ({
  year: input.year ?? null,
  outcome: input.outcome,
  deliveryMode: input.deliveryMode ?? null,
  gestationWeeks: input.gestationWeeks ?? null,
  birthWeightG: input.birthWeightG ?? null,
  complications: input.complications ?? null,
  notes: input.notes ?? null,
})

@Injectable()
export class HistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PatientScope,
  ) {}

  async getMedical(staff: AuthStaff, patientId: string): Promise<MedicalHistoryDto> {
    await this.scope.require(staff, patientId)
    const h = await this.prisma.medicalHistory.findUnique({ where: { patientId } })
    if (!h) return EMPTY_HISTORY
    return {
      allergies: h.allergies as unknown as MedicalHistoryDto['allergies'],
      chronicConditions: h.chronicConditions,
      currentMedications: h.currentMedications,
      surgeries: h.surgeries as unknown as MedicalHistoryDto['surgeries'],
      bloodGroup: h.bloodGroup as MedicalHistoryDto['bloodGroup'],
      familyHistory: h.familyHistory,
      smoking: h.smoking,
      menarcheAge: h.menarcheAge,
      cycleLengthDays: h.cycleLengthDays,
      periodLengthDays: h.periodLengthDays,
      cycleRegular: h.cycleRegular,
      contraception: h.contraception,
      lastPapSmearAt: toIsoDayOrNull(h.lastPapSmearAt),
      lastPapSmearResult: h.lastPapSmearResult,
      gynNotes: h.gynNotes,
      updatedAt: h.updatedAt.toISOString(),
    }
  }

  /** Replaces the whole medical history (the form always sends the full picture). */
  async putMedical(staff: AuthStaff, patientId: string, input: MedicalHistoryInput) {
    await this.scope.require(staff, patientId)
    const data = {
      allergies: (input.allergies ?? []).map((a) => ({
        substance: a.substance,
        reaction: a.reaction ?? null,
        severity: a.severity,
      })),
      chronicConditions: input.chronicConditions ?? [],
      currentMedications: input.currentMedications ?? [],
      surgeries: (input.surgeries ?? []).map((s) => ({ name: s.name, year: s.year ?? null })),
      bloodGroup: input.bloodGroup ?? null,
      familyHistory: input.familyHistory ?? null,
      smoking: input.smoking ?? null,
      menarcheAge: input.menarcheAge ?? null,
      cycleLengthDays: input.cycleLengthDays ?? null,
      periodLengthDays: input.periodLengthDays ?? null,
      cycleRegular: input.cycleRegular ?? null,
      contraception: input.contraception ?? null,
      lastPapSmearAt: fromIsoDayOrNull(input.lastPapSmearAt),
      lastPapSmearResult: input.lastPapSmearResult ?? null,
      gynNotes: input.gynNotes ?? null,
      updatedById: staff.id,
    }
    await this.prisma.medicalHistory.upsert({ where: { patientId }, create: { patientId, ...data }, update: data })
    return this.getMedical(staff, patientId)
  }

  async listObstetric(staff: AuthStaff, patientId: string) {
    await this.scope.require(staff, patientId)
    const rows = await this.prisma.obstetricHistoryEntry.findMany({
      where: { patientId },
      orderBy: [{ year: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
    })
    return rows.map(toObstetricDto)
  }

  async addObstetric(staff: AuthStaff, patientId: string, input: ObstetricEntryInput) {
    await this.scope.require(staff, patientId)
    return toObstetricDto(
      await this.prisma.obstetricHistoryEntry.create({ data: { patientId, ...obstetricData(input) } }),
    )
  }

  async updateObstetric(staff: AuthStaff, patientId: string, entryId: string, input: ObstetricEntryInput) {
    await this.requireEntry(staff, patientId, entryId)
    return toObstetricDto(
      await this.prisma.obstetricHistoryEntry.update({ where: { id: entryId }, data: obstetricData(input) }),
    )
  }

  async removeObstetric(staff: AuthStaff, patientId: string, entryId: string) {
    await this.requireEntry(staff, patientId, entryId)
    await this.prisma.obstetricHistoryEntry.delete({ where: { id: entryId } })
  }

  private async requireEntry(staff: AuthStaff, patientId: string, entryId: string) {
    await this.scope.require(staff, patientId)
    const found = await this.prisma.obstetricHistoryEntry.count({ where: { id: entryId, patientId } })
    if (!found) throw new NotFoundException('History entry not found')
  }
}
