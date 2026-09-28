import type { CreateTaskInput, ListTasksQuery, TaskDto, TaskListDto, UpdateTaskInput } from '@azza/shared'
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { AuthStaff } from '../auth/auth.types'
import { STAFF_REF_SELECT, staffRef } from '../common/format'
import type { Prisma } from '../generated/prisma/client'
import { PatientScope } from '../patients/patient-scope.service'
import { PrismaService } from '../prisma/prisma.service'

const INCLUDE = {
  patient: { select: { id: true, fullName: true, fullNameAr: true, fileNumber: true } },
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
  patient: t.patient,
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

  async update(staff: AuthStaff, taskId: string, input: UpdateTaskInput) {
    await this.require(staff, taskId)
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
    return toDto(row)
  }

  /** Done by whoever marks it; marking an already-done reminder keeps the original completion. */
  async complete(staff: AuthStaff, taskId: string) {
    const task = await this.require(staff, taskId)
    const row = await this.prisma.task.update({
      where: { id: taskId },
      data: task.completedAt ? {} : { completedAt: new Date(), completedById: staff.id },
      include: INCLUDE,
    })
    return toDto(row)
  }

  async reopen(staff: AuthStaff, taskId: string) {
    await this.require(staff, taskId)
    const row = await this.prisma.task.update({
      where: { id: taskId },
      data: { completedAt: null, completedById: null },
      include: INCLUDE,
    })
    return toDto(row)
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
      select: { id: true, createdById: true, completedAt: true },
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
