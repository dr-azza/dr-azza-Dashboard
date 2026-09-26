import { MedicalHistorySchema, ObstetricEntrySchema } from '@azza/shared'
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { Audited } from '../audit/audited'
import type { AuthStaff } from '../auth/auth.types'
import { CurrentStaff } from '../auth/decorators'
import { UuidPipe } from '../common/uuid.pipe'
import { HistoryService } from './history.service'

class MedicalHistoryDtoIn extends createZodDto(MedicalHistorySchema) {}
class ObstetricEntryDtoIn extends createZodDto(ObstetricEntrySchema) {}

@ApiTags('patients · history')
@Controller('patients/:patientId')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get('medical-history')
  @Audited('history.view', 'medical_history')
  get(@CurrentStaff() staff: AuthStaff, @Param('patientId', UuidPipe) patientId: string) {
    return this.history.getMedical(staff, patientId)
  }

  @Put('medical-history')
  @Audited('history.update', 'medical_history')
  put(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Body() body: MedicalHistoryDtoIn,
  ) {
    return this.history.putMedical(staff, patientId, body)
  }

  @Get('obstetric-history')
  @Audited('obstetric.view', 'obstetric_history')
  listObstetric(@CurrentStaff() staff: AuthStaff, @Param('patientId', UuidPipe) patientId: string) {
    return this.history.listObstetric(staff, patientId)
  }

  @Post('obstetric-history')
  @Audited('obstetric.create', 'obstetric_history')
  addObstetric(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Body() body: ObstetricEntryDtoIn,
  ) {
    return this.history.addObstetric(staff, patientId, body)
  }

  @Put('obstetric-history/:entryId')
  @Audited('obstetric.update', 'obstetric_history')
  updateObstetric(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Param('entryId', UuidPipe) entryId: string,
    @Body() body: ObstetricEntryDtoIn,
  ) {
    return this.history.updateObstetric(staff, patientId, entryId, body)
  }

  @Delete('obstetric-history/:entryId')
  @HttpCode(204)
  @Audited('obstetric.delete', 'obstetric_history')
  removeObstetric(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Param('entryId', UuidPipe) entryId: string,
  ) {
    return this.history.removeObstetric(staff, patientId, entryId)
  }
}
