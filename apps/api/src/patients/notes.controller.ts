import { CreateNoteSchema } from '@azza/shared'
import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { Audited } from '../audit/audited'
import type { AuthStaff } from '../auth/auth.types'
import { CurrentStaff } from '../auth/decorators'
import { UuidPipe } from '../common/uuid.pipe'
import { NotesService } from './notes.service'

class CreateNoteDto extends createZodDto(CreateNoteSchema) {}

@ApiTags('patients · notes')
@Controller('patients/:patientId/notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  @Audited('note.list', 'clinical_note')
  list(@CurrentStaff() staff: AuthStaff, @Param('patientId', UuidPipe) patientId: string) {
    return this.notes.list(staff, patientId)
  }

  @Post()
  @Audited('note.create', 'clinical_note')
  create(
    @CurrentStaff() staff: AuthStaff,
    @Param('patientId', UuidPipe) patientId: string,
    @Body() body: CreateNoteDto,
  ) {
    return this.notes.create(staff, patientId, body)
  }
}
