import { Module } from '@nestjs/common'
import { AttachmentsController } from './attachments.controller'
import { AttachmentsService } from './attachments.service'
import { FollowUpController } from './follow-up.controller'
import { FollowUpService } from './follow-up.service'
import { HistoryController } from './history.controller'
import { HistoryService } from './history.service'
import { NotesController } from './notes.controller'
import { NotesService } from './notes.service'
import { PatientScope } from './patient-scope.service'
import { PatientsController } from './patients.controller'
import { PatientsService } from './patients.service'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { PrescriptionsController } from './prescriptions.controller'
import { PrescriptionsService } from './prescriptions.service'

/** The patient record: identity, history, follow-up, prescriptions, payments, files and notes. */
@Module({
  controllers: [
    PatientsController,
    HistoryController,
    FollowUpController,
    PrescriptionsController,
    PaymentsController,
    AttachmentsController,
    NotesController,
  ],
  providers: [
    PatientScope,
    PatientsService,
    HistoryService,
    FollowUpService,
    PrescriptionsService,
    PaymentsService,
    AttachmentsService,
    NotesService,
  ],
})
export class PatientsModule {}
