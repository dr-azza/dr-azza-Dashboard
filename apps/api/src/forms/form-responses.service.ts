import {
  type CreatedFormLinkDto,
  FORM_LINK_TTL_DAYS,
  type FormField,
  type FormLinkDto,
  type FormLinkStatus,
  type FormResponseDto,
  type FormResponseListItemDto,
  type ListFormResponsesQuery,
  type Page,
  type UpdateFormResponseInput,
} from '@azza/shared'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { hashToken } from '../auth/auth.service'
import type { AuthStaff } from '../auth/auth.types'
import { STAFF_REF_SELECT, staffRef } from '../common/format'
import type { Prisma } from '../generated/prisma/client'
import { PatientScope } from '../patients/patient-scope.service'
import { PrismaService } from '../prisma/prisma.service'

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000)

const LIST_INCLUDE = {
  form: { select: { id: true, title: true } },
  version: { select: { version: true } },
  patient: { select: { id: true, fullName: true, fileNumber: true } },
  reviewedBy: STAFF_REF_SELECT,
} as const
type ListRow = Prisma.FormResponseGetPayload<{ include: typeof LIST_INCLUDE }>

const toListDto = (r: ListRow): FormResponseListItemDto => ({
  id: r.id,
  form: r.form,
  version: r.version.version,
  submittedAt: r.submittedAt.toISOString(),
  patient: r.patient,
  matchedBy: r.matchedBy,
  respondentName: r.respondentName,
  respondentPhone: r.respondentPhone,
  reviewedAt: r.reviewedAt?.toISOString() ?? null,
  reviewedBy: staffRef(r.reviewedBy),
  viaLink: r.linkId != null,
})

const LINK_INCLUDE = {
  form: { select: { id: true, title: true } },
  response: { select: { id: true } },
  createdBy: STAFF_REF_SELECT,
} as const
type LinkRow = Prisma.FormLinkGetPayload<{ include: typeof LINK_INCLUDE }>

function linkStatus(l: LinkRow, now = new Date()): FormLinkStatus {
  if (l.response) return 'submitted'
  if (l.revokedAt) return 'revoked'
  if (l.expiresAt <= now) return 'expired'
  return l.openedAt ? 'opened' : 'waiting'
}

const toLinkDto = (l: LinkRow): FormLinkDto => ({
  id: l.id,
  form: l.form,
  status: linkStatus(l),
  createdAt: l.createdAt.toISOString(),
  expiresAt: l.expiresAt.toISOString(),
  openedAt: l.openedAt?.toISOString() ?? null,
  responseId: l.response?.id ?? null,
  createdBy: staffRef(l.createdBy),
})

@Injectable()
export class FormResponsesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PatientScope,
  ) {}

  /** Responses across the clinic (or one form), newest first. */
  async list(staff: AuthStaff, query: ListFormResponsesQuery): Promise<Page<FormResponseListItemDto>> {
    const rows = await this.prisma.formResponse.findMany({
      where: {
        clinicId: staff.clinicId,
        // Across forms, only forms still in use (as the counts and badge); one form: always its responses.
        ...(query.formId ? { formId: query.formId } : { form: { archivedAt: null } }),
        ...(query.status && { reviewedAt: query.status === 'new' ? null : { not: null } }),
        ...(query.linked && { patientId: query.linked === 'true' ? { not: null } : null }),
        ...(query.days && { submittedAt: { gte: daysAgo(query.days) } }),
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      include: LIST_INCLUDE,
    })
    const page = rows.slice(0, query.limit)
    return { items: page.map(toListDto), nextCursor: rows.length > query.limit ? page[page.length - 1].id : null }
  }

  /** Counts for the sidebar badge and the Responses overview (forms still in use only). */
  async summary(staff: AuthStaff) {
    const inUse = { clinicId: staff.clinicId, form: { archivedAt: null } }
    const [newCount, unlinkedCount, lastWeekCount] = await Promise.all([
      this.prisma.formResponse.count({ where: { ...inUse, reviewedAt: null } }),
      this.prisma.formResponse.count({ where: { ...inUse, patientId: null } }),
      this.prisma.formResponse.count({
        where: { ...inUse, submittedAt: { gte: daysAgo(7) } },
      }),
    ])
    return { newCount, unlinkedCount, lastWeekCount }
  }

  async get(staff: AuthStaff, responseId: string): Promise<FormResponseDto> {
    const r = await this.prisma.formResponse.findFirst({
      where: { id: responseId, clinicId: staff.clinicId },
      include: { ...LIST_INCLUDE, version: { select: { version: true, fields: true, language: true } } },
    })
    if (!r) throw new NotFoundException('Response not found')
    return {
      ...toListDto(r),
      language: r.version.language,
      fields: r.version.fields as unknown as FormField[],
      answers: r.answers as FormResponseDto['answers'],
    }
  }

  async update(staff: AuthStaff, responseId: string, input: UpdateFormResponseInput) {
    const current = await this.prisma.formResponse.findFirst({ where: { id: responseId, clinicId: staff.clinicId } })
    if (!current) throw new NotFoundException('Response not found')
    if (input.patientId !== undefined && current.linkId) {
      // A personal link was made for one patient; its response belongs to her.
      throw new BadRequestException('This response came from a personal link and is already on the right patient')
    }
    if (input.patientId) await this.scope.require(staff, input.patientId)

    await this.prisma.formResponse.update({
      where: { id: responseId },
      data: {
        ...(input.reviewed !== undefined && {
          reviewedAt: input.reviewed ? new Date() : null,
          reviewedById: input.reviewed ? staff.id : null,
        }),
        ...(input.patientId !== undefined && {
          patientId: input.patientId,
          matchedBy: input.patientId ? 'STAFF' : null,
          linkedById: input.patientId ? staff.id : null,
        }),
      },
    })
    return this.get(staff, responseId)
  }

  // --- Per patient ------------------------------------------------------------------

  async listForPatient(staff: AuthStaff, patientId: string) {
    await this.scope.require(staff, patientId)
    const [links, responses] = await Promise.all([
      this.prisma.formLink.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: LINK_INCLUDE,
      }),
      this.prisma.formResponse.findMany({
        where: { patientId },
        orderBy: { submittedAt: 'desc' },
        take: 100,
        include: LIST_INCLUDE,
      }),
    ])
    return { links: links.map(toLinkDto), responses: responses.map(toListDto) }
  }

  /** A single-use link for one patient. The raw token is returned here once and never stored. */
  async createLink(staff: AuthStaff, patientId: string, formId: string): Promise<CreatedFormLinkDto> {
    await this.scope.require(staff, patientId)
    const form = await this.prisma.form.findFirst({ where: { id: formId, clinicId: staff.clinicId, archivedAt: null } })
    if (!form) throw new NotFoundException('Form not found')
    if (!form.acceptingResponses) throw new BadRequestException('This form is closed to new responses')

    const token = randomBytes(32).toString('base64url')
    const link = await this.prisma.formLink.create({
      data: {
        formId,
        patientId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + FORM_LINK_TTL_DAYS * 24 * 60 * 60 * 1000),
        createdById: staff.id,
      },
      include: LINK_INCLUDE,
    })
    return { ...toLinkDto(link), token }
  }

  async revokeLink(staff: AuthStaff, patientId: string, linkId: string) {
    await this.scope.require(staff, patientId)
    const link = await this.prisma.formLink.findFirst({ where: { id: linkId, patientId }, include: LINK_INCLUDE })
    if (!link) throw new NotFoundException('Link not found')
    if (link.response) throw new BadRequestException('This link has already been used')
    const updated = await this.prisma.formLink.update({
      where: { id: linkId },
      data: { revokedAt: link.revokedAt ?? new Date() },
      include: LINK_INCLUDE,
    })
    return toLinkDto(updated)
  }
}
