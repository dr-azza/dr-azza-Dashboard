import type {
  AppointmentDto,
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from '@azza/shared'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { AuthStaff } from '../auth/auth.types'
import { STAFF_REF_SELECT, staffRef } from '../common/format'
import type { Prisma } from '../generated/prisma/client'
import { PatientScope } from '../patients/patient-scope.service'
import { PrismaService } from '../prisma/prisma.service'

const INCLUDE = {
  patient: { select: { id: true, fullName: true, fullNameAr: true, fileNumber: true } },
  assignedTo: STAFF_REF_SELECT,
  createdBy: STAFF_REF_SELECT,
} satisfies Prisma.AppointmentInclude

type Row = Prisma.AppointmentGetPayload<{ include: typeof INCLUDE }>

const toDto = (a: Row): AppointmentDto => ({
  id: a.id,
  patient: a.patient,
  type: a.type,
  title: a.title,
  startsAt: a.startsAt.toISOString(),
  endsAt: new Date(a.startsAt.getTime() + a.durationMinutes * 60_000).toISOString(),
  durationMinutes: a.durationMinutes,
  status: a.status,
  notes: a.notes,
  cancelReason: a.cancelReason,
  assignedTo: staffRef(a.assignedTo),
  createdBy: staffRef(a.createdBy),
  closedAt: a.closedAt?.toISOString() ?? null,
  createdAt: a.createdAt.toISOString(),
})

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PatientScope,
  ) {}

  /** Upcoming first (soonest at the top), then past appointments newest first. */
  async listForPatient(staff: AuthStaff, patientId: string) {
    await this.scope.require(staff, patientId)
    const now = new Date()
    const [upcoming, past] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { patientId, status: 'SCHEDULED', startsAt: { gte: now } },
        orderBy: { startsAt: 'asc' },
        include: INCLUDE,
      }),
      this.prisma.appointment.findMany({
        where: { patientId, OR: [{ status: { not: 'SCHEDULED' } }, { startsAt: { lt: now } }] },
        orderBy: { startsAt: 'desc' },
        take: 100,
        include: INCLUDE,
      }),
    ])
    return { upcoming: upcoming.map(toDto), past: past.map(toDto) }
  }

  /** The clinic's calendar for a time range (the Appointments page). */
  async listForClinic(staff: AuthStaff, query: ListAppointmentsQuery) {
    const rows = await this.prisma.appointment.findMany({
      where: {
        clinicId: staff.clinicId,
        patient: { archivedAt: null },
        ...(query.status && { status: query.status }),
        ...(query.assignedToId && { assignedToId: query.assignedToId }),
        ...((query.from || query.to) && {
          startsAt: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lt: new Date(query.to) }) },
        }),
      },
      orderBy: { startsAt: 'asc' },
      take: query.limit,
      include: INCLUDE,
    })
    return rows.map(toDto)
  }

  async create(staff: AuthStaff, patientId: string, input: CreateAppointmentInput) {
    const patient = await this.scope.require(staff, patientId)
    await this.requireStaff(staff, input.assignedToId)
    const row = await this.prisma.appointment.create({
      data: {
        clinicId: patient.clinicId,
        patientId,
        type: input.type,
        title: input.title ?? null,
        startsAt: new Date(input.startsAt),
        durationMinutes: input.durationMinutes ?? 15,
        assignedToId: input.assignedToId ?? null,
        notes: input.notes ?? null,
        createdById: staff.id,
      },
      include: INCLUDE,
    })
    return toDto(row)
  }

  async update(staff: AuthStaff, patientId: string, appointmentId: string, input: UpdateAppointmentInput) {
    await this.scope.require(staff, patientId)
    const current = await this.prisma.appointment.findFirst({ where: { id: appointmentId, patientId } })
    if (!current) throw new NotFoundException('Appointment not found')
    if (input.assignedToId) await this.requireStaff(staff, input.assignedToId)

    const status = input.status ?? current.status
    const statusChanged = input.status !== undefined && input.status !== current.status
    const row = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        ...(input.type !== undefined && { type: input.type }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.startsAt !== undefined && { startsAt: new Date(input.startsAt) }),
        ...(input.durationMinutes !== undefined && { durationMinutes: input.durationMinutes }),
        ...(input.assignedToId !== undefined && { assignedToId: input.assignedToId }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(statusChanged && {
          status,
          closedAt: status === 'SCHEDULED' ? null : new Date(),
          // A reason only belongs to a cancellation; reopening or completing clears it.
          cancelReason: status === 'CANCELLED' ? (input.cancelReason ?? null) : null,
        }),
        ...(!statusChanged &&
          input.cancelReason !== undefined &&
          status === 'CANCELLED' && { cancelReason: input.cancelReason }),
      },
      include: INCLUDE,
    })
    return toDto(row)
  }

  /** The next scheduled appointment from now, for the patient header. */
  async next(patientId: string) {
    return this.prisma.appointment.findFirst({
      where: { patientId, status: 'SCHEDULED', startsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
      select: { id: true, type: true, title: true, startsAt: true },
    })
  }

  private async requireStaff(staff: AuthStaff, staffId?: string | null) {
    if (!staffId) return
    const ok = await this.prisma.staffMember.count({ where: { id: staffId, clinicId: staff.clinicId, isActive: true } })
    if (!ok) throw new BadRequestException('That staff member is not part of this clinic')
  }
}
