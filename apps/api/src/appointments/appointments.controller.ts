import { CreateAppointmentSchema, ListAppointmentsQuerySchema, UpdateAppointmentSchema } from '@azza/shared'
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { Audited } from '../audit/audited'
import type { AuthStaff } from '../auth/auth.types'
import { CurrentStaff } from '../auth/decorators'
import { UuidPipe } from '../common/uuid.pipe'
import { AppointmentsService } from './appointments.service'

class CreateAppointmentDto extends createZodDto(CreateAppointmentSchema) {}
class UpdateAppointmentDto extends createZodDto(UpdateAppointmentSchema) {}
class ListAppointmentsQueryDto extends createZodDto(ListAppointmentsQuerySchema) {}

@ApiTags('appointments')
@Controller('patients/:patientId/appointments')
export class PatientAppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @Audited('appointment.list', 'appointment')
  list(@CurrentStaff() staff: AuthStaff, @Param('patientId', UuidPipe) patientId: string) {
    return this.appointments.listForPatient(staff, patientId)
  }

  @Post()
  @Audited('appointment.create', 'appointment')
  create(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Body() body: CreateAppointmentDto,
  ) {
    return this.appointments.create(staff, patientId, body)
  }

  @Patch(':itemId')
  @Audited('appointment.update', 'appointment')
  update(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Param('itemId', UuidPipe) id: string,
    @Body() body: UpdateAppointmentDto,
  ) {
    return this.appointments.update(staff, patientId, id, body)
  }
}

@ApiTags('appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @Audited('appointment.calendar.view', 'appointment')
  list(@CurrentStaff() staff: AuthStaff, @Query() query: ListAppointmentsQueryDto) {
    return this.appointments.listForClinic(staff, query)
  }
}
