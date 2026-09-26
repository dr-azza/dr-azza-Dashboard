import type { CreatePrescriptionInput, PrescriptionDto } from '@azza/shared'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import type { AuthStaff } from '../auth/auth.types'
import { STAFF_REF_SELECT, staffRef } from '../common/format'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { clinicToday, PatientScope } from './patient-scope.service'

const INCLUDE = {
  prescribedBy: STAFF_REF_SELECT,
  items: { orderBy: { position: 'asc' } },
} satisfies Prisma.PrescriptionInclude

type Row = Prisma.PrescriptionGetPayload<{ include: typeof INCLUDE }>

const toDto = (r: Row): PrescriptionDto => ({
  id: r.id,
  number: r.number,
  issuedAt: r.issuedAt.toISOString(),
  diagnosis: r.diagnosis,
  notes: r.notes,
  voidedAt: r.voidedAt?.toISOString() ?? null,
  voidReason: r.voidReason,
  prescribedBy: staffRef(r.prescribedBy),
  items: r.items.map((i) => ({
    drugName: i.drugName,
    dose: i.dose,
    frequency: i.frequency,
    duration: i.duration,
    instructions: i.instructions,
  })),
})

/** e.g. "RX-260926-7K3Q": date for humans, random suffix for uniqueness without a shared counter. */
function prescriptionNumber(timeZone: string) {
  const day = clinicToday(timeZone).replaceAll('-', '').slice(2)
  const suffix = randomBytes(3).readUIntBE(0, 3).toString(36).toUpperCase().padStart(4, '0').slice(-4)
  return `RX-${day}-${suffix}`
}

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PatientScope,
  ) {}

  async list(staff: AuthStaff, patientId: string) {
    await this.scope.require(staff, patientId)
    const rows = await this.prisma.prescription.findMany({
      where: { patientId },
      orderBy: { issuedAt: 'desc' },
      include: INCLUDE,
    })
    return rows.map(toDto)
  }

  async get(staff: AuthStaff, patientId: string, prescriptionId: string) {
    await this.scope.require(staff, patientId)
    const row = await this.prisma.prescription.findFirst({ where: { id: prescriptionId, patientId }, include: INCLUDE })
    if (!row) throw new NotFoundException('Prescription not found')
    return toDto(row)
  }

  async create(staff: AuthStaff, patientId: string, input: CreatePrescriptionInput) {
    const patient = await this.scope.require(staff, patientId)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const row = await this.prisma.prescription.create({
          data: {
            patientId,
            prescribedById: staff.id,
            number: prescriptionNumber(patient.timeZone),
            diagnosis: input.diagnosis ?? null,
            notes: input.notes ?? null,
            items: {
              create: input.items.map((item, position) => ({
                position,
                drugName: item.drugName.trim(),
                dose: item.dose ?? null,
                frequency: item.frequency ?? null,
                duration: item.duration ?? null,
                instructions: item.instructions ?? null,
              })),
            },
          },
          include: INCLUDE,
        })
        return toDto(row)
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error
      }
    }
    throw new ConflictException('Could not number the prescription, please retry')
  }

  /** Issued prescriptions are immutable; a mistake is voided (kept, marked) and a new one issued. */
  async void(staff: AuthStaff, patientId: string, prescriptionId: string, reason: string) {
    await this.get(staff, patientId, prescriptionId)
    const row = await this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: { voidedAt: new Date(), voidReason: reason },
      include: INCLUDE,
    })
    return toDto(row)
  }
}
