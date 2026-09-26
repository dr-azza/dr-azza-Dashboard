import { CreatePrescriptionSchema, VoidSchema } from '@azza/shared'
import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { Audited } from '../audit/audited'
import type { AuthStaff } from '../auth/auth.types'
import { CurrentStaff } from '../auth/decorators'
import { UuidPipe } from '../common/uuid.pipe'
import { PrescriptionsService } from './prescriptions.service'

class CreatePrescriptionDto extends createZodDto(CreatePrescriptionSchema) {}
class VoidDto extends createZodDto(VoidSchema) {}

@ApiTags('patients · prescriptions')
@Controller('patients/:patientId/prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Get()
  @Audited('prescription.list', 'prescription')
  list(@CurrentStaff() staff: AuthStaff, @Param('patientId', UuidPipe) patientId: string) {
    return this.prescriptions.list(staff, patientId)
  }

  @Post()
  @Audited('prescription.create', 'prescription')
  create(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Body() body: CreatePrescriptionDto,
  ) {
    return this.prescriptions.create(staff, patientId, body)
  }

  @Get(':itemId')
  @Audited('prescription.view', 'prescription')
  get(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Param('itemId', UuidPipe) id: string,
  ) {
    return this.prescriptions.get(staff, patientId, id)
  }

  @Post(':itemId/void')
  @Audited('prescription.void', 'prescription')
  void(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Param('itemId', UuidPipe) id: string,
    @Body() body: VoidDto,
  ) {
    return this.prescriptions.void(staff, patientId, id, body.reason)
  }
}
