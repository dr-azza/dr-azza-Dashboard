import { CreateHistoryEntrySchema, UpdateHistoryEntrySchema } from '@azza/shared'
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { Audited } from '../audit/audited'
import type { AuthStaff } from '../auth/auth.types'
import { CurrentStaff } from '../auth/decorators'
import { UuidPipe } from '../common/uuid.pipe'
import { HistoryEntriesService } from './history-entries.service'

class CreateHistoryEntryDto extends createZodDto(CreateHistoryEntrySchema) {}
class UpdateHistoryEntryDto extends createZodDto(UpdateHistoryEntrySchema) {}

@ApiTags('patients · history')
@Controller('patients/:patientId/history-entries')
export class HistoryEntriesController {
  constructor(private readonly entries: HistoryEntriesService) {}

  @Get()
  @Audited('history_entry.list', 'history_entry')
  list(@CurrentStaff() staff: AuthStaff, @Param('patientId', UuidPipe) patientId: string) {
    return this.entries.list(staff, patientId)
  }

  @Post()
  @Audited('history_entry.create', 'history_entry')
  create(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Body() body: CreateHistoryEntryDto,
  ) {
    return this.entries.create(staff, patientId, body)
  }

  @Patch(':entryId')
  @Audited('history_entry.update', 'history_entry')
  update(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Param('entryId', UuidPipe) entryId: string,
    @Body() body: UpdateHistoryEntryDto,
  ) {
    return this.entries.update(staff, patientId, entryId, body)
  }

  @Delete(':entryId')
  @Audited('history_entry.delete', 'history_entry')
  remove(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Param('entryId', UuidPipe) entryId: string,
  ) {
    return this.entries.remove(staff, patientId, entryId)
  }
}
