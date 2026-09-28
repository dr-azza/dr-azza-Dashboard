import { CreateTaskSchema, ListTasksQuerySchema, UpdateTaskSchema } from '@azza/shared'
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod'
import { Audited } from '../audit/audited'
import type { AuthStaff } from '../auth/auth.types'
import { CurrentStaff } from '../auth/decorators'
import { UuidPipe } from '../common/uuid.pipe'
import { TasksService } from './tasks.service'

class CreateTaskDto extends createZodDto(CreateTaskSchema) {}
class UpdateTaskDto extends createZodDto(UpdateTaskSchema) {}
class ListTasksQueryDto extends createZodDto(ListTasksQuerySchema) {}

/** Team reminders. A reminder about a patient also appears in her activity log. */
@ApiTags('reminders')
@Controller('reminders')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@CurrentStaff() staff: AuthStaff, @Query() query: ListTasksQueryDto) {
    return this.tasks.list(staff, query)
  }

  @Post()
  @Audited('reminder.create', 'reminder')
  create(@CurrentStaff() staff: AuthStaff, @Body() body: CreateTaskDto) {
    return this.tasks.create(staff, body)
  }

  @Patch(':itemId')
  @Audited('reminder.update', 'reminder')
  update(@CurrentStaff() staff: AuthStaff, @Param('itemId', UuidPipe) id: string, @Body() body: UpdateTaskDto) {
    return this.tasks.update(staff, id, body)
  }

  @Post(':itemId/complete')
  @HttpCode(200)
  @Audited('reminder.complete', 'reminder')
  complete(@CurrentStaff() staff: AuthStaff, @Param('itemId', UuidPipe) id: string) {
    return this.tasks.complete(staff, id)
  }

  @Post(':itemId/reopen')
  @HttpCode(200)
  @Audited('reminder.reopen', 'reminder')
  reopen(@CurrentStaff() staff: AuthStaff, @Param('itemId', UuidPipe) id: string) {
    return this.tasks.reopen(staff, id)
  }

  @Delete(':itemId')
  @Audited('reminder.delete', 'reminder')
  remove(@CurrentStaff() staff: AuthStaff, @Param('itemId', UuidPipe) id: string) {
    return this.tasks.remove(staff, id)
  }
}
