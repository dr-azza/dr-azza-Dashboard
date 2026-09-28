/**
 * Reminders for the team: something to do by a time, for someone, optionally about a patient.
 * Stored as "tasks"; the app calls them reminders.
 */
import { z } from 'zod'
import type { StaffRef } from './api-types.js'
import { optionalText, requiredText } from './schemas/common.js'

export const TASK_PRIORITIES = ['NORMAL', 'HIGH'] as const
export type TaskPriorityCode = (typeof TASK_PRIORITIES)[number]

export const CreateTaskSchema = z.object({
  title: requiredText(200),
  notes: optionalText(2000),
  dueAt: z.iso.datetime({ offset: true }),
  priority: z.enum(TASK_PRIORITIES).default('NORMAL'),
  /** Null: anyone on the team. */
  assigneeId: z.uuid().nullish(),
  patientId: z.uuid().nullish(),
})
export type CreateTaskInput = z.input<typeof CreateTaskSchema>

export const UpdateTaskSchema = z
  .object({
    title: requiredText(200),
    notes: optionalText(2000),
    dueAt: z.iso.datetime({ offset: true }),
    priority: z.enum(TASK_PRIORITIES),
    assigneeId: z.uuid().nullable(),
    patientId: z.uuid().nullable(),
  })
  .partial()
export type UpdateTaskInput = z.input<typeof UpdateTaskSchema>

export const ListTasksQuerySchema = z.object({
  /** open: not done yet, soonest first. done: most recently done first. */
  status: z.enum(['open', 'done']).default('open'),
  /** A staff id, "me", or "unassigned". Omitted: everyone's. */
  assignee: z.union([z.uuid(), z.enum(['me', 'unassigned'])]).optional(),
  patientId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(300),
})
export type ListTasksQuery = z.output<typeof ListTasksQuerySchema>

export interface TaskDto {
  id: string
  title: string
  notes: string | null
  dueAt: string
  priority: TaskPriorityCode
  assignee: StaffRef | null
  /** `archived` patients have no record page to link to. */
  patient: { id: string; fullName: string; fullNameAr: string | null; fileNumber: string; archived: boolean } | null
  createdBy: StaffRef | null
  completedAt: string | null
  completedBy: StaffRef | null
  createdAt: string
}

export interface TaskListDto {
  items: TaskDto[]
  /** More matched than `limit`. */
  truncated: boolean
}

/** Where an open reminder falls relative to now, in the viewer's local time. */
export type TaskBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later'

export function taskBucket(dueAt: Date, now: Date): TaskBucket {
  if (dueAt.getTime() < now.getTime()) return 'overdue'
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const dayOffset = (n: number) => {
    const d = new Date(startOfDay)
    d.setDate(d.getDate() + n)
    return d.getTime()
  }
  const t = dueAt.getTime()
  if (t < dayOffset(1)) return 'today'
  if (t < dayOffset(2)) return 'tomorrow'
  if (t < dayOffset(7)) return 'week'
  return 'later'
}
