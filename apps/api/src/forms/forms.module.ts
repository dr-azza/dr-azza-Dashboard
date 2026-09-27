import { Module } from '@nestjs/common'
import { PatientsModule } from '../patients/patients.module'
import {
  FormResponsesController,
  FormsController,
  PatientFormsController,
  PublicFormsController,
} from './forms.controller'
import { FormResponsesService } from './form-responses.service'
import { FormsService } from './forms.service'
import { PublicFormsService } from './public-forms.service'

@Module({
  imports: [PatientsModule],
  controllers: [FormsController, FormResponsesController, PatientFormsController, PublicFormsController],
  providers: [FormsService, FormResponsesService, PublicFormsService],
})
export class FormsModule {}
