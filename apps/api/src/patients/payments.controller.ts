import { CreatePaymentSchema, VoidSchema } from '@azza/shared'
import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { Audited } from '../audit/audited'
import type { AuthStaff } from '../auth/auth.types'
import { CurrentStaff } from '../auth/decorators'
import { UuidPipe } from '../common/uuid.pipe'
import { PaymentsService } from './payments.service'

class CreatePaymentDto extends createZodDto(CreatePaymentSchema) {}
class VoidDto extends createZodDto(VoidSchema) {}

@ApiTags('patients · payments')
@Controller('patients/:patientId/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @Audited('payment.list', 'payment')
  list(@CurrentStaff() staff: AuthStaff, @Param('patientId', UuidPipe) patientId: string) {
    return this.payments.list(staff, patientId)
  }

  @Post()
  @Audited('payment.create', 'payment')
  create(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Body() body: CreatePaymentDto,
  ) {
    return this.payments.create(staff, patientId, body)
  }

  @Post(':itemId/void')
  @Audited('payment.void', 'payment')
  void(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Param('itemId', UuidPipe) id: string,
    @Body() body: VoidDto,
  ) {
    return this.payments.void(staff, patientId, id, body.reason)
  }
}
