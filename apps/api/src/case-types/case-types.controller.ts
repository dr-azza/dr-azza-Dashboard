import { CreateCaseTypeSchema, UpdateCaseTypeSchema } from '@azza/shared'
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { Audited } from '../audit/audited'
import type { AuthStaff } from '../auth/auth.types'
import { CurrentStaff } from '../auth/decorators'
import { UuidPipe } from '../common/uuid.pipe'
import { CaseTypesService } from './case-types.service'

class CreateCaseTypeDto extends createZodDto(CreateCaseTypeSchema) {}
class UpdateCaseTypeDto extends createZodDto(UpdateCaseTypeSchema) {}

@ApiTags('case types')
@Controller('case-types')
export class CaseTypesController {
  constructor(private readonly caseTypes: CaseTypesService) {}

  @Get()
  list(@CurrentStaff() staff: AuthStaff, @Query('includeArchived') includeArchived?: string) {
    return this.caseTypes.list(staff, includeArchived === 'true')
  }

  @Post()
  @Audited('case_type.create', 'case_type')
  create(@CurrentStaff() staff: AuthStaff, @Body() body: CreateCaseTypeDto) {
    return this.caseTypes.create(staff, body)
  }

  @Patch(':itemId')
  @Audited('case_type.update', 'case_type')
  update(@CurrentStaff() staff: AuthStaff, @Param('itemId', UuidPipe) id: string, @Body() body: UpdateCaseTypeDto) {
    return this.caseTypes.update(staff, id, body)
  }
}
