import { ActivityQuerySchema, CreatePatientSchema, ListPatientsQuerySchema, UpdatePatientSchema } from '@azza/shared'
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { Audited } from '../audit/audited'
import type { AuthStaff } from '../auth/auth.types'
import { CurrentStaff } from '../auth/decorators'
import { UuidPipe } from '../common/uuid.pipe'
import { ActivityService } from './activity.service'
import { PatientsService } from './patients.service'

class CreatePatientDto extends createZodDto(CreatePatientSchema) {}
class UpdatePatientDto extends createZodDto(UpdatePatientSchema) {}
class ListPatientsQueryDto extends createZodDto(ListPatientsQuerySchema) {}
class ActivityQueryDto extends createZodDto(ActivityQuerySchema) {}

@ApiTags('patients')
@Controller('patients')
export class PatientsController {
  constructor(
    private readonly patients: PatientsService,
    private readonly activity: ActivityService,
  ) {}

  @Get()
  @Audited('patient.list', 'patient')
  list(@CurrentStaff() staff: AuthStaff, @Query() query: ListPatientsQueryDto) {
    return this.patients.list(staff, query)
  }

  @Post()
  @Audited('patient.create', 'patient')
  create(@CurrentStaff() staff: AuthStaff, @Body() body: CreatePatientDto) {
    return this.patients.create(staff, body)
  }

  @Get(':patientId')
  @Audited('patient.view', 'patient')
  get(@CurrentStaff() staff: AuthStaff, @Param('patientId', UuidPipe) patientId: string) {
    return this.patients.get(staff, patientId)
  }

  @Patch(':patientId')
  @Audited('patient.update', 'patient')
  update(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Body() body: UpdatePatientDto,
  ) {
    return this.patients.update(staff, patientId, body)
  }

  @Get(':patientId/timeline')
  @Audited('patient.timeline.view', 'patient')
  timeline(@CurrentStaff() staff: AuthStaff, @Param('patientId', UuidPipe) patientId: string) {
    return this.patients.timeline(staff, patientId)
  }

  /** Everything done on this patient's record, newest first (from the audit trail). */
  @Get(':patientId/activity')
  @Audited('patient.activity.view', 'patient')
  activityLog(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Query() query: ActivityQueryDto,
  ) {
    return this.activity.list(staff, patientId, query)
  }
}
