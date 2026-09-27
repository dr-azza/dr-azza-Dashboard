import { type FormField, normalizePhone, type PublicFormDto, type SubmitFormInput, validateAnswers } from '@azza/shared'
import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common'
import { AuditService } from '../audit/audit.service'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { hashToken } from '../auth/auth.service'

const FORM_SELECT = {
  id: true,
  clinicId: true,
  title: true,
  description: true,
  language: true,
  fields: true,
  version: true,
  acceptingResponses: true,
  archivedAt: true,
  clinic: { select: { name: true } },
  versions: { orderBy: { version: 'desc' }, take: 1, select: { id: true } },
} as const

/**
 * The patient side: no login, reached only through a link. A token is either a form's shared
 * link or one patient's personal link (stored hashed). Nothing here returns staff or other
 * patients' data, and an unknown token is a plain 404.
 */
@Injectable()
export class PublicFormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(token: string): Promise<PublicFormDto> {
    const target = await this.resolve(token)
    if (target.mode === 'personal' && !target.link.openedAt && target.state === 'open') {
      await this.prisma.formLink.update({ where: { id: target.link.id }, data: { openedAt: new Date() } })
    }
    const { form } = target
    return {
      mode: target.mode,
      state: target.state,
      versionId: form.versions[0].id,
      title: form.title,
      description: form.description,
      language: form.language,
      fields: form.fields as unknown as FormField[],
      clinicName: form.clinic.name,
      greetingName: target.mode === 'personal' ? target.greetingName : null,
    }
  }

  async submit(token: string, input: SubmitFormInput) {
    const target = await this.resolve(token)
    if (target.state === 'submitted') throw new ConflictException('This form has already been submitted')
    if (target.state !== 'open') throw new GoneException('This form is no longer accepting responses')
    const { form } = target

    // Checked against the exact version the patient loaded, even if the form changed since.
    const version = await this.prisma.formVersion.findFirst({ where: { id: input.versionId, formId: form.id } })
    if (!version) throw new BadRequestException('Unknown form version; reload the page')
    const result = validateAnswers(version.fields as unknown as FormField[], input.answers)
    if (!result.ok)
      throw new BadRequestException({ message: 'Some answers need attention', fieldErrors: result.errors })

    let patientId: string | null = null
    let matchedBy: 'LINK' | 'PHONE' | null = null
    let respondent: { name: string; phone: string } | null = null
    if (target.mode === 'personal') {
      patientId = target.link.patientId
      matchedBy = 'LINK'
    } else {
      const phone = input.respondent ? normalizePhone(input.respondent.phone) : null
      if (!input.respondent || !phone) {
        throw new BadRequestException({
          message: 'Enter your name and a valid phone number',
          fieldErrors: { respondent: 'invalid' },
        })
      }
      respondent = { name: input.respondent.name, phone }
      // Only an unambiguous match; it is shown to staff as "matched by phone" until reviewed.
      const matches = await this.prisma.patient.findMany({
        where: { clinicId: form.clinicId, phone, archivedAt: null },
        select: { id: true },
        take: 2,
      })
      if (matches.length === 1) {
        patientId = matches[0].id
        matchedBy = 'PHONE'
      }
    }

    try {
      const response = await this.prisma.formResponse.create({
        data: {
          clinicId: form.clinicId,
          formId: form.id,
          versionId: version.id,
          linkId: target.mode === 'personal' ? target.link.id : null,
          patientId,
          matchedBy,
          respondentName: respondent?.name ?? null,
          respondentPhone: respondent?.phone ?? null,
          answers: result.answers as Prisma.InputJsonValue,
        },
        select: { id: true },
      })
      await this.audit.log({
        clinicId: form.clinicId,
        action: 'form.submit',
        entity: 'form_response',
        entityId: response.id,
        patientId,
      })
      return { ok: true }
    } catch (error) {
      // Two submissions racing on one personal link: the second loses on the unique link id.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This form has already been submitted')
      }
      throw error
    }
  }

  private async resolve(token: string) {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw new NotFoundException('Form not found')

    const shared = await this.prisma.form.findUnique({ where: { publicToken: token }, select: FORM_SELECT })
    if (shared) {
      if (shared.archivedAt) throw new NotFoundException('Form not found')
      return {
        mode: 'shared' as const,
        form: shared,
        state: shared.acceptingResponses ? ('open' as const) : ('closed' as const),
      }
    }

    const link = await this.prisma.formLink.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        form: { select: FORM_SELECT },
        response: { select: { id: true } },
        patient: { select: { fullName: true, fullNameAr: true } },
      },
    })
    if (!link || link.form.archivedAt) throw new NotFoundException('Form not found')
    const state = link.response
      ? ('submitted' as const)
      : link.revokedAt || link.expiresAt <= new Date()
        ? ('expired' as const)
        : link.form.acceptingResponses
          ? ('open' as const)
          : ('closed' as const)
    const name = (link.form.language === 'ar' && link.patient.fullNameAr) || link.patient.fullName
    return {
      mode: 'personal' as const,
      form: link.form,
      link,
      state,
      greetingName: name.trim().split(/\s+/)[0] ?? null,
    }
  }
}
