import { Module } from '@nestjs/common'
import { AppointmentsController, PatientAppointmentsController } from '../appointments/appointments.controller'
import { AppointmentsService } from '../appointments/appointments.service'
import { ActivityService } from './activity.service'
import { AttachmentsController } from './attachments.controller'
import { AttachmentsService } from './attachments.service'
import { FollowUpController } from './follow-up.controller'
import { FollowUpService } from './follow-up.service'
import { HistoryController } from './history.controller'
import { HistoryService } from './history.service'
import { HistoryEntriesController } from './history-entries.controller'
import { HistoryEntriesService } from './history-entries.service'
import { NotesController } from './notes.controller'
import { NotesService } from './notes.service'
import { PatientScope } from './patient-scope.service'
import { PatientsController } from './patients.controller'
import { PatientsService } from './patients.service'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { PrescriptionsController } from './prescriptions.controller'
import { PrescriptionsService } from './prescriptions.service'

/** The patient record: identity, history, follow-up, prescriptions, payments, files, notes, appointments and activity. */
@Module({
  controllers: [
    PatientsController,
    HistoryController,
    FollowUpController,
    PrescriptionsController,
    PaymentsController,
    AttachmentsController,
    NotesController,
    HistoryEntriesController,
    PatientAppointmentsController,
    AppointmentsController,
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
    HistoryEntriesService,
    AppointmentsService,
    ActivityService,
  ],
  // Other modules reach patient data only through the clinic-scoped lookup.
  exports: [PatientScope],
})
export class PatientsModule {}
