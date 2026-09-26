import type { CreateNoteInput, NoteDto } from '@azza/shared'
import { Injectable } from '@nestjs/common'
import type { AuthStaff } from '../auth/auth.types'
import { STAFF_REF_SELECT, staffRef } from '../common/format'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { PatientScope } from './patient-scope.service'

type Row = Prisma.ClinicalNoteGetPayload<{ include: { author: typeof STAFF_REF_SELECT } }>

const toDto = (n: Row): NoteDto => ({
  id: n.id,
  body: n.body,
  pinned: n.pinned,
  createdAt: n.createdAt.toISOString(),
  author: staffRef(n.author),
})

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PatientScope,
  ) {}

  async list(staff: AuthStaff, patientId: string) {
    await this.scope.require(staff, patientId)
    const rows = await this.prisma.clinicalNote.findMany({
      where: { patientId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: { author: STAFF_REF_SELECT },
    })
    return rows.map(toDto)
  }

  async create(staff: AuthStaff, patientId: string, input: CreateNoteInput) {
    await this.scope.require(staff, patientId)
    const row = await this.prisma.clinicalNote.create({
      data: { patientId, authorId: staff.id, body: input.body, pinned: input.pinned ?? false },
      include: { author: STAFF_REF_SELECT },
    })
    return toDto(row)
  }
}
