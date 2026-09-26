import { CreatePregnancySchema, CreateVisitSchema } from '@azza/shared'
import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { Audited } from '../audit/audited'
import type { AuthStaff } from '../auth/auth.types'
import { CurrentStaff } from '../auth/decorators'
import { UuidPipe } from '../common/uuid.pipe'
import { FollowUpService } from './follow-up.service'

class CreatePregnancyDto extends createZodDto(CreatePregnancySchema) {}
class CreateVisitDto extends createZodDto(CreateVisitSchema) {}
class EndPregnancyDto extends createZodDto(z.object({ status: z.enum(['DELIVERED', 'ENDED']) })) {}

@ApiTags('patients · follow-up')
@Controller('patients/:patientId')
export class FollowUpController {
  constructor(private readonly followUp: FollowUpService) {}

  @Get('pregnancies')
  @Audited('pregnancy.list', 'pregnancy')
  listPregnancies(@CurrentStaff() staff: AuthStaff, @Param('patientId', UuidPipe) patientId: string) {
    return this.followUp.listPregnancies(staff, patientId)
  }

  @Post('pregnancies')
  @Audited('pregnancy.create', 'pregnancy')
  startPregnancy(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Body() body: CreatePregnancyDto,
  ) {
    return this.followUp.startPregnancy(staff, patientId, body)
  }

  @Post('pregnancies/:itemId/end')
  @Audited('pregnancy.end', 'pregnancy')
  endPregnancy(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Param('itemId', UuidPipe) pregnancyId: string,
    @Body() body: EndPregnancyDto,
  ) {
    return this.followUp.endPregnancy(staff, patientId, pregnancyId, body.status)
  }

  @Get('visits')
  @Audited('visit.list', 'visit')
  listVisits(@CurrentStaff() staff: AuthStaff, @Param('patientId', UuidPipe) patientId: string) {
    return this.followUp.listVisits(staff, patientId)
  }

  @Post('visits')
  @Audited('visit.create', 'visit')
  addVisit(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Body() body: CreateVisitDto,
  ) {
    return this.followUp.addVisit(staff, patientId, body)
  }
}
