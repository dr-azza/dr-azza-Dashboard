import type { AppointmentStatusCode, AppointmentTypeCode, PatientStatusCode, Tone } from '@azza/shared'
import {
  BeakerIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  PhoneIcon,
  ViewfinderCircleIcon,
} from '@heroicons/react/16/solid'

/** API status codes → i18n keys. */
export const statusKey = (code: PatientStatusCode) => `status.${code.toLowerCase()}`

export const statusTone: Record<PatientStatusCode, Tone> = {
  OK: 'ok',
  FLAGGED: 'danger',
  OVERDUE: 'warn',
  AWAITING: 'info',
}

export const appointmentTone: Record<AppointmentStatusCode, Tone> = {
  SCHEDULED: 'info',
  COMPLETED: 'ok',
  CANCELLED: 'neutral',
  NO_SHOW: 'warn',
}

export const APPOINTMENT_ICONS: Record<AppointmentTypeCode, typeof PhoneIcon> = {
  VISIT: BuildingOffice2Icon,
  CALL: PhoneIcon,
  SCAN: ViewfinderCircleIcon,
  LAB: BeakerIcon,
  FOLLOW_UP: ClipboardDocumentCheckIcon,
  OTHER: CalendarDaysIcon,
}
