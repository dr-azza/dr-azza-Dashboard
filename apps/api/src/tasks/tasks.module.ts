import { Module } from '@nestjs/common'
import { PatientsModule } from '../patients/patients.module'
import { TasksController } from './tasks.controller'
import { TasksService } from './tasks.service'

@Module({
  imports: [PatientsModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
