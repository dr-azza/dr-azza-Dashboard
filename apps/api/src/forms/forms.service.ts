import type { CreateFormInput, FormDto, FormField, FormListItemDto, UpdateFormInput } from '@azza/shared'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import type { AuthStaff } from '../auth/auth.types'
import { STAFF_REF_SELECT, staffRef } from '../common/format'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

/** 128 random bits: the shareable link is public by design, but must not be guessable. */
export const newPublicToken = () => randomBytes(16).toString('base64url')

const INCLUDE = { updatedBy: STAFF_REF_SELECT, _count: { select: { responses: true } } } as const
type Row = Prisma.FormGetPayload<{ include: typeof INCLUDE }>

const toDto = (f: Row): FormDto => ({
  id: f.id,
  title: f.title,
  description: f.description,
  language: f.language,
  fields: f.fields as unknown as FormField[],
  version: f.version,
  acceptingResponses: f.acceptingResponses,
  archived: f.archivedAt != null,
  publicToken: f.publicToken,
  responseCount: f._count.responses,
  updatedAt: f.updatedAt.toISOString(),
  updatedBy: staffRef(f.updatedBy),
})

const countQuestions = (fields: unknown) => (fields as { type: string }[]).filter((q) => q.type !== 'section').length

/** JSON with object keys sorted, so equal content compares equal (jsonb does not keep key order). */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    // A missing key and a null one mean the same ("not set"), so neither counts as a change.
    const entries = Object.entries(value).filter(([, v]) => v != null)
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** What patients see; a change to any of it makes a new version. */
const content = (f: { title: string; description: string | null; language: string; fields: unknown }) =>
  canonical([f.title, f.description, f.language, f.fields])

@Injectable()
export class FormsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(staff: AuthStaff, archived: boolean): Promise<FormListItemDto[]> {
    const [forms, unreviewed] = await Promise.all([
      this.prisma.form.findMany({
        where: { clinicId: staff.clinicId, archivedAt: archived ? { not: null } : null },
        orderBy: { updatedAt: 'desc' },
        // Never the questions themselves: the list only needs their count.
        select: {
          id: true,
          title: true,
          language: true,
          acceptingResponses: true,
          archivedAt: true,
          questionCount: true,
          publicToken: true,
          updatedAt: true,
          _count: { select: { responses: true } },
        },
      }),
      this.prisma.formResponse.groupBy({
        by: ['formId'],
        where: { clinicId: staff.clinicId, reviewedAt: null },
        _count: { _all: true },
      }),
    ])
    const newByForm = new Map(unreviewed.map((r) => [r.formId, r._count._all]))
    return forms.map((f) => ({
      id: f.id,
      title: f.title,
      language: f.language,
      acceptingResponses: f.acceptingResponses,
      archived: f.archivedAt != null,
      questionCount: f.questionCount,
      responseCount: f._count.responses,
      newCount: newByForm.get(f.id) ?? 0,
      publicToken: f.publicToken,
      updatedAt: f.updatedAt.toISOString(),
    }))
  }

  async get(staff: AuthStaff, formId: string) {
    return toDto(await this.require(staff, formId))
  }

  async create(staff: AuthStaff, input: CreateFormInput) {
    const data = {
      title: input.title,
      description: input.description ?? null,
      language: input.language,
      fields: (input.fields ?? []) as Prisma.InputJsonValue,
    }
    const form = await this.prisma.form.create({
      data: {
        ...data,
        questionCount: countQuestions(data.fields),
        clinicId: staff.clinicId,
        publicToken: newPublicToken(),
        createdById: staff.id,
        updatedById: staff.id,
        versions: { create: { ...data, version: 1, createdById: staff.id } },
      },
      include: INCLUDE,
    })
    return toDto(form)
  }

  /**
   * Saves changes. If what patients see changed, the version goes up and a snapshot is kept, so
   * responses to earlier versions still show the questions they actually answered.
   */
  async update(staff: AuthStaff, formId: string, input: UpdateFormInput) {
    const current = await this.require(staff, formId)
    if (input.expectedVersion !== undefined && input.expectedVersion !== current.version) {
      throw new ConflictException('This form was changed by someone else. Reload to see the latest version.')
    }
    const next = {
      title: input.title ?? current.title,
      description: input.description !== undefined ? (input.description ?? null) : current.description,
      language: input.language ?? current.language,
      fields: (input.fields ?? current.fields) as Prisma.InputJsonValue,
    }
    const changed = content(next) !== content(current)
    const version = changed ? current.version + 1 : current.version

    try {
      const form = await this.prisma.$transaction(async (tx) => {
        // Compare-and-set on the version: of two saves racing from the same version, one wins
        // and the other gets a clear conflict instead of silently overwriting it.
        const { count } = await tx.form.updateMany({
          where: { id: formId, version: current.version },
          data: {
            ...next,
            version,
            questionCount: countQuestions(next.fields),
            updatedById: staff.id,
            ...(input.acceptingResponses !== undefined && { acceptingResponses: input.acceptingResponses }),
            ...(input.archived !== undefined && { archivedAt: input.archived ? new Date() : null }),
          },
        })
        if (count === 0)
          throw new ConflictException('This form was just changed by someone else. Reload and try again.')
        if (changed) await tx.formVersion.create({ data: { formId, version, ...next, createdById: staff.id } })
        return tx.form.findUniqueOrThrow({ where: { id: formId }, include: INCLUDE })
      })
      return toDto(form)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This form was just changed by someone else. Reload and try again.')
      }
      throw error
    }
  }

  /** Issues a new shareable link; the old one stops working immediately. */
  async rotateLink(staff: AuthStaff, formId: string) {
    await this.require(staff, formId)
    const form = await this.prisma.form.update({
      where: { id: formId },
      data: { publicToken: newPublicToken(), updatedById: staff.id },
      include: INCLUDE,
    })
    return toDto(form)
  }

  private async require(staff: AuthStaff, formId: string) {
    const form = await this.prisma.form.findFirst({ where: { id: formId, clinicId: staff.clinicId }, include: INCLUDE })
    if (!form) throw new NotFoundException('Form not found')
    return form
  }
}
