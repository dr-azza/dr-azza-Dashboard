import type { ActivityDto, ActivityQuery, Page } from '@azza/shared'
import { Injectable } from '@nestjs/common'
import type { AuthStaff } from '../auth/auth.types'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { PatientScope } from './patient-scope.service'

/** Read-only events: opening the record, lists, downloads. Hidden unless asked for. */
const isView = (action: string) =>
  /\.(view|list)$/.test(action) || action === 'file.download' || action.endsWith('.calendar.view')

/**
 * A patient's activity log, built from the append-only audit trail, so it records every action
 * taken through the API — including ones no screen shows (downloads, views, voids).
 */
@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PatientScope,
  ) {}

  async list(staff: AuthStaff, patientId: string, query: ActivityQuery): Promise<Page<ActivityDto>> {
    await this.scope.require(staff, patientId)
    const before = query.cursor && /^\d+$/.test(query.cursor) ? BigInt(query.cursor) : undefined

    const where: Prisma.AuditLogWhereInput = {
      clinicId: staff.clinicId,
      // Entries about this patient: anything under /patients/:id/… plus the patient record itself.
      OR: [{ meta: { path: ['patientId'], equals: patientId } }, { entity: 'patient', entityId: patientId }],
      ...(before && { id: { lt: before } }),
      ...(!query.includeViews && {
        NOT: [{ action: { endsWith: '.view' } }, { action: { endsWith: '.list' } }, { action: 'file.download' }],
      }),
    }
    const rows = await this.prisma.auditLog.findMany({ where, orderBy: { id: 'desc' }, take: query.limit + 1 })
    const page = rows.slice(0, query.limit)

    const actorIds = [...new Set(page.map((r) => r.actorId).filter((id): id is string => !!id))]
    const actors = await this.prisma.staffMember.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, fullName: true },
    })
    const byId = new Map(actors.map((a) => [a.id, a]))

    const appointmentIds = [
      ...new Set(page.filter((r) => r.entity === 'appointment' && r.entityId).map((r) => r.entityId!)),
    ]
    const appointments = appointmentIds.length
      ? await this.prisma.appointment.findMany({
          where: { id: { in: appointmentIds }, patientId },
          select: { id: true, type: true, title: true, startsAt: true },
        })
      : []
    const apptById = new Map(appointments.map((a) => [a.id, a]))

    return {
      items: page
        .filter((r) => query.includeViews || !isView(r.action))
        .map((r) => ({
          id: r.id.toString(),
          at: r.at.toISOString(),
          action: r.action,
          entity: r.entity,
          entityId: r.entityId,
          actor: r.actorId ? (byId.get(r.actorId) ?? null) : null,
          appointment: (() => {
            const a = r.entity === 'appointment' && r.entityId ? apptById.get(r.entityId) : undefined
            return a ? { type: a.type, title: a.title, startsAt: a.startsAt.toISOString() } : null
          })(),
        })),
      nextCursor: rows.length > query.limit ? page[page.length - 1].id.toString() : null,
    }
  }
}
