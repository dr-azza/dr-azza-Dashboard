import type { CreateTaskInput, ListTasksQuery, TaskDto, TaskListDto, UpdateTaskInput } from '@azza/shared'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { AuditService } from '../audit/audit.service'
import type { AuthStaff } from '../auth/auth.types'
import { STAFF_REF_SELECT, staffRef } from '../common/format'
import type { Prisma } from '../generated/prisma/client'
import { PatientScope } from '../patients/patient-scope.service'
import { PrismaService } from '../prisma/prisma.service'

const INCLUDE = {
  patient: { select: { id: true, fullName: true, fullNameAr: true, fileNumber: true, archivedAt: true } },
  assignee: STAFF_REF_SELECT,
  createdBy: STAFF_REF_SELECT,
  completedBy: STAFF_REF_SELECT,
} satisfies Prisma.TaskInclude

type Row = Prisma.TaskGetPayload<{ include: typeof INCLUDE }>

const toDto = (t: Row): TaskDto => ({
  id: t.id,
  title: t.title,
  notes: t.notes,
  dueAt: t.dueAt.toISOString(),
  priority: t.priority,
  assignee: staffRef(t.assignee),
  patient: t.patient
    ? {
        id: t.patient.id,
        fullName: t.patient.fullName,
        fullNameAr: t.patient.fullNameAr,
        fileNumber: t.patient.fileNumber,
        archived: !!t.patient.archivedAt,
      }
    : null,
  createdBy: staffRef(t.createdBy),
  completedAt: t.completedAt?.toISOString() ?? null,
  completedBy: staffRef(t.completedBy),
  createdAt: t.createdAt.toISOString(),
})

/** Reminders for the team. Everyone in the clinic sees and works them; only the author or an owner deletes. */
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PatientScope,
    private readonly audit: AuditService,
  ) {}

  /** Open reminders soonest first (overdue on top), or done ones most recent first. */
  async list(staff: AuthStaff, query: ListTasksQuery): Promise<TaskListDto> {
    if (query.patientId) await this.scope.require(staff, query.patientId)
    const open = query.status === 'open'
    const assigneeId =
      query.assignee === 'me' ? staff.id : query.assignee === 'unassigned' ? null : (query.assignee ?? undefined)
    const rows = await this.prisma.task.findMany({
      where: {
        clinicId: staff.clinicId,
        completedAt: open ? null : { not: null },
        ...(assigneeId !== undefined && { assigneeId }),
        ...(query.patientId && { patientId: query.patientId }),
      },
      orderBy: open ? [{ dueAt: 'asc' }, { createdAt: 'asc' }] : [{ completedAt: 'desc' }],
      take: query.limit + 1,
      include: INCLUDE,
    })
    return { items: rows.slice(0, query.limit).map(toDto), truncated: rows.length > query.limit }
  }

  async create(staff: AuthStaff, input: CreateTaskInput) {
    await this.requireAssignee(staff, input.assigneeId)
    if (input.patientId) await this.scope.require(staff, input.patientId)
    const row = await this.prisma.task.create({
      data: {
        clinicId: staff.clinicId,
        title: input.title,
        notes: input.notes ?? null,
        dueAt: new Date(input.dueAt),
        priority: input.priority ?? 'NORMAL',
        assigneeId: input.assigneeId ?? null,
        patientId: input.patientId ?? null,
        createdById: staff.id,
      },
      include: INCLUDE,
    })
    return toDto(row)
  }

  /**
   * The audit entry follows the reminder's patient after the change; moving it off a patient
   * also records the change on the patient it left, so her activity log isn't missing a step.
   */
  async update(staff: AuthStaff, taskId: string, input: UpdateTaskInput, ip?: string) {
    const before = await this.require(staff, taskId)
    if (input.assigneeId) await this.requireAssignee(staff, input.assigneeId)
    if (input.patientId) await this.scope.require(staff, input.patientId)
    const row = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.dueAt !== undefined && { dueAt: new Date(input.dueAt) }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.assigneeId !== undefined && { assigneeId: input.assigneeId }),
        ...(input.patientId !== undefined && { patientId: input.patientId }),
      },
      include: INCLUDE,
    })
    if (before.patientId && before.patientId !== row.patientId) {
      await this.audit.log({
        clinicId: staff.clinicId,
        actorId: staff.id,
        action: 'reminder.update',
        entity: 'reminder',
        entityId: taskId,
        patientId: before.patientId,
        ip,
      })
    }
    return toDto(row)
  }

  /**
   * Done by whoever marks it. Conditional on the current state, so two people ticking it at the
   * same moment can't overwrite each other, and a repeat (stale screen) is refused rather than
   * logged as a second completion.
   */
  complete(staff: AuthStaff, taskId: string) {
    return this.setDone(staff, taskId, true)
  }

  reopen(staff: AuthStaff, taskId: string) {
    return this.setDone(staff, taskId, false)
  }

  private async setDone(staff: AuthStaff, taskId: string, done: boolean) {
    await this.require(staff, taskId)
    const { count } = await this.prisma.task.updateMany({
      where: { id: taskId, completedAt: done ? null : { not: null } },
      data: done ? { completedAt: new Date(), completedById: staff.id } : { completedAt: null, completedById: null },
    })
    if (!count) throw new ConflictException(done ? 'This reminder is already done' : 'This reminder is already open')
    return toDto(await this.prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: INCLUDE }))
  }

  async remove(staff: AuthStaff, taskId: string) {
    const task = await this.require(staff, taskId)
    if (task.createdById !== staff.id && staff.role !== 'OWNER') {
      throw new ForbiddenException('Only the person who added this reminder, or an owner, can delete it')
    }
    const row = await this.prisma.task.delete({ where: { id: taskId }, include: INCLUDE })
    return toDto(row)
  }

  private async require(staff: AuthStaff, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, clinicId: staff.clinicId },
      select: { id: true, createdById: true, patientId: true },
    })
    if (!task) throw new NotFoundException('Reminder not found')
    return task
  }

  private async requireAssignee(staff: AuthStaff, staffId?: string | null) {
    if (!staffId) return
    const ok = await this.prisma.staffMember.count({ where: { id: staffId, clinicId: staff.clinicId, isActive: true } })
    if (!ok) throw new BadRequestException('That staff member is not part of this clinic')
  }
}
