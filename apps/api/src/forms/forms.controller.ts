import {
  CreateFormLinkSchema,
  CreateFormSchema,
  ListFormResponsesQuerySchema,
  SubmitFormSchema,
  UpdateFormResponseSchema,
  UpdateFormSchema,
} from '@azza/shared'
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { RouteConfig } from '@nestjs/platform-fastify'
import { ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { Audited } from '../audit/audited'
import type { AuthStaff } from '../auth/auth.types'
import { CurrentStaff, Public } from '../auth/decorators'
import { UuidPipe } from '../common/uuid.pipe'
import { FormResponsesService } from './form-responses.service'
import { FormsService } from './forms.service'
import { PublicFormsService } from './public-forms.service'

class CreateFormDto extends createZodDto(CreateFormSchema) {}
class UpdateFormDto extends createZodDto(UpdateFormSchema) {}
class ListFormsQueryDto extends createZodDto(
  z.object({
    archived: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  }),
) {}
class ListResponsesQueryDto extends createZodDto(ListFormResponsesQuerySchema) {}
class UpdateResponseDto extends createZodDto(UpdateFormResponseSchema) {}
class CreateLinkDto extends createZodDto(CreateFormLinkSchema) {}
class SubmitFormDto extends createZodDto(SubmitFormSchema) {}

@ApiTags('forms')
@Controller('forms')
export class FormsController {
  constructor(
    private readonly forms: FormsService,
    private readonly responses: FormResponsesService,
  ) {}

  @Get()
  list(@CurrentStaff() staff: AuthStaff, @Query() query: ListFormsQueryDto) {
    return this.forms.list(staff, query.archived as unknown as boolean)
  }

  @Post()
  @Audited('form.create', 'form')
  create(@CurrentStaff() staff: AuthStaff, @Body() body: CreateFormDto) {
    return this.forms.create(staff, body)
  }

  @Get(':formId')
  get(@CurrentStaff() staff: AuthStaff, @Param('formId', UuidPipe) formId: string) {
    return this.forms.get(staff, formId)
  }

  @Patch(':formId')
  @Audited('form.update', 'form')
  update(@CurrentStaff() staff: AuthStaff, @Param('formId', UuidPipe) formId: string, @Body() body: UpdateFormDto) {
    return this.forms.update(staff, formId, body)
  }

  @Post(':formId/rotate-link')
  @HttpCode(200)
  @Audited('form.link.rotate', 'form')
  rotateLink(@CurrentStaff() staff: AuthStaff, @Param('formId', UuidPipe) formId: string) {
    return this.forms.rotateLink(staff, formId)
  }

  @Get(':formId/responses')
  @Audited('form.response.list', 'form_response')
  listResponses(
    @CurrentStaff() staff: AuthStaff,
    @Param('formId', UuidPipe) formId: string,
    @Query() query: ListResponsesQueryDto,
  ) {
    return this.responses.list(staff, { ...query, formId })
  }
}

@ApiTags('forms')
@Controller('form-responses')
export class FormResponsesController {
  constructor(private readonly responses: FormResponsesService) {}

  @Get()
  @Audited('form.response.list', 'form_response')
  list(@CurrentStaff() staff: AuthStaff, @Query() query: ListResponsesQueryDto) {
    return this.responses.list(staff, query)
  }

  @Get('summary')
  summary(@CurrentStaff() staff: AuthStaff) {
    return this.responses.summary(staff)
  }

  @Get(':responseId')
  @Audited('form.response.view', 'form_response')
  get(@CurrentStaff() staff: AuthStaff, @Param('responseId', UuidPipe) responseId: string) {
    return this.responses.get(staff, responseId)
  }

  @Patch(':responseId')
  @Audited('form.response.update', 'form_response')
  update(
    @CurrentStaff() staff: AuthStaff,
    @Param('responseId', UuidPipe) responseId: string,
    @Body() body: UpdateResponseDto,
  ) {
    return this.responses.update(staff, responseId, body)
  }
}

@ApiTags('patients · forms')
@Controller('patients/:patientId')
export class PatientFormsController {
  constructor(private readonly responses: FormResponsesService) {}

  @Get('forms')
  @Audited('form.patient.list', 'form_link')
  list(@CurrentStaff() staff: AuthStaff, @Param('patientId', UuidPipe) patientId: string) {
    return this.responses.listForPatient(staff, patientId)
  }

  @Post('form-links')
  @Audited('form.link.create', 'form_link')
  createLink(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Body() body: CreateLinkDto,
  ) {
    return this.responses.createLink(staff, patientId, body.formId)
  }

  @Post('form-links/:itemId/revoke')
  @HttpCode(200)
  @Audited('form.link.revoke', 'form_link')
  revokeLink(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Param('itemId', UuidPipe) linkId: string,
  ) {
    return this.responses.revokeLink(staff, patientId, linkId)
  }
}

/** The patient page. No login; tighter rate limits than the rest of the API. */
@ApiTags('public forms')
@Controller('public/forms')
@Public()
export class PublicFormsController {
  constructor(private readonly publicForms: PublicFormsService) {}

  @Get(':token')
  @RouteConfig({ rateLimit: { max: 60, timeWindow: '1 minute' } })
  get(@Param('token') token: string) {
    return this.publicForms.get(token)
  }

  @Post(':token/responses')
  @RouteConfig({ rateLimit: { max: 10, timeWindow: '1 minute' } })
  submit(@Param('token') token: string, @Body() body: SubmitFormDto) {
    return this.publicForms.submit(token, body)
  }
}
