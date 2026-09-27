import type { CreateHistoryEntryInput, HistoryEntryDto, UpdateHistoryEntryInput } from '@azza/shared'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { AuthStaff } from '../auth/auth.types'
import { STAFF_REF_SELECT, staffRef } from '../common/format'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { PatientScope } from './patient-scope.service'
import { sanitizeRichText } from './rich-text'

const INCLUDE = { author: STAFF_REF_SELECT, editedBy: STAFF_REF_SELECT } as const
type Row = Prisma.HistoryEntryGetPayload<{ include: typeof INCLUDE }>

const toDto = (e: Row): HistoryEntryDto => ({
  id: e.id,
  recordedOn: e.recordedOn.toISOString().slice(0, 10),
  title: e.title,
  bodyHtml: e.bodyHtml,
  createdAt: e.createdAt.toISOString(),
  author: staffRef(e.author),
  editedAt: e.editedById ? e.updatedAt.toISOString() : null,
  editedBy: staffRef(e.editedBy),
})

/** Sanitized body, or a 400 when nothing readable is left (empty editor, only markup). */
function body(html: string) {
  const clean = sanitizeRichText(html)
  if (!clean.text) throw new BadRequestException('Write something in the history before saving')
  return { bodyHtml: clean.html, bodyText: clean.text }
}

/** Free-text patient history: as many dated rich-text entries as needed, newest first. */
@Injectable()
export class HistoryEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PatientScope,
  ) {}

  async list(staff: AuthStaff, patientId: string) {
    await this.scope.require(staff, patientId)
    const rows = await this.prisma.historyEntry.findMany({
      where: { patientId, deletedAt: null },
      orderBy: [{ recordedOn: 'desc' }, { createdAt: 'desc' }],
      include: INCLUDE,
    })
    return rows.map(toDto)
  }

  async create(staff: AuthStaff, patientId: string, input: CreateHistoryEntryInput) {
    await this.scope.require(staff, patientId)
    const row = await this.prisma.historyEntry.create({
      data: {
        patientId,
        authorId: staff.id,
        recordedOn: new Date(input.recordedOn),
        title: input.title ?? null,
        ...body(input.bodyHtml),
      },
      include: INCLUDE,
    })
    return toDto(row)
  }

  async update(staff: AuthStaff, patientId: string, entryId: string, input: UpdateHistoryEntryInput) {
    await this.require(staff, patientId, entryId)
    const row = await this.prisma.historyEntry.update({
      where: { id: entryId },
      data: {
        editedById: staff.id,
        ...(input.recordedOn !== undefined && { recordedOn: new Date(input.recordedOn) }),
        ...(input.title !== undefined && { title: input.title ?? null }),
        ...(input.bodyHtml !== undefined && body(input.bodyHtml)),
      },
      include: INCLUDE,
    })
    return toDto(row)
  }

  /** Hides the entry; the row is kept because it is part of the medical record. */
  async remove(staff: AuthStaff, patientId: string, entryId: string) {
    await this.require(staff, patientId, entryId)
    await this.prisma.historyEntry.update({
      where: { id: entryId },
      data: { deletedAt: new Date(), editedById: staff.id },
    })
    return { id: entryId }
  }

  private async require(staff: AuthStaff, patientId: string, entryId: string) {
    await this.scope.require(staff, patientId)
    const found = await this.prisma.historyEntry.count({ where: { id: entryId, patientId, deletedAt: null } })
    if (!found) throw new NotFoundException('History entry not found')
  }
}
