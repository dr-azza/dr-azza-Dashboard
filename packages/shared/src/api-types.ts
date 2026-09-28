import type { StaffStatus } from './team.js'
import type { Answers, FormField } from './forms.js'
/**
 * Response shapes of the AZZAH API (v1). The API returns these, and the web and mobile apps
 * consume them. Dates are ISO strings; money is a decimal string (never a float).
 */
import type {
  ALLERGY_SEVERITIES,
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  ATTACHMENT_KINDS,
  BLOOD_GROUPS,
  DELIVERY_MODES,
  PATIENT_STATUSES,
  PATIENT_VISIT_MODES,
  PAYMENT_METHODS,
  PREGNANCY_OUTCOMES,
  SYSTEM_CASE_KEYS,
} from './schemas/patient-record.js'

export type SystemCaseKey = (typeof SYSTEM_CASE_KEYS)[number]

/** A case as shown on a patient: enough to label and filter. */
export interface CaseTypeRefDto {
  id: string
  name: { en: string; ar: string }
  systemKey: SystemCaseKey | null
}

export interface CaseTypeDto extends CaseTypeRefDto {
  sortOrder: number
  archived: boolean
  /** Active (non-archived) patients currently in this case. */
  patientCount: number
}
export type PatientStatusCode = (typeof PATIENT_STATUSES)[number]
export type PatientVisitModeCode = (typeof PATIENT_VISIT_MODES)[number]
export type PaymentMethodCode = (typeof PAYMENT_METHODS)[number]
export type AttachmentKindCode = (typeof ATTACHMENT_KINDS)[number]
export type PregnancyOutcomeCode = (typeof PREGNANCY_OUTCOMES)[number]
export type DeliveryModeCode = (typeof DELIVERY_MODES)[number]
export type BloodGroup = (typeof BLOOD_GROUPS)[number]
export type StaffRoleCode = 'OWNER' | 'DOCTOR' | 'NURSE' | 'RECEPTION'
export type AppointmentTypeCode = (typeof APPOINTMENT_TYPES)[number]
export type AppointmentStatusCode = (typeof APPOINTMENT_STATUSES)[number]

export interface StaffRef {
  id: string
  fullName: string
}

export interface MeDto extends StaffRef {
  email: string
  role: StaffRoleCode
  clinic: { id: string; name: string }
}

export interface ActivePregnancyDto {
  id: string
  lmp: string
  edd: string
  weeks: number
  days: number
  trimester: 1 | 2 | 3
}

export interface AllergyDto {
  substance: string
  reaction: string | null
  severity: (typeof ALLERGY_SEVERITIES)[number]
}

export interface PatientListItemDto {
  id: string
  fileNumber: string
  fullName: string
  fullNameAr: string | null
  phone: string
  age: number | null
  caseType: CaseTypeRefDto
  status: PatientStatusCode
  visitMode: PatientVisitModeCode
  activePregnancy: ActivePregnancyDto | null
  lastVisitAt: string | null
}

export interface PatientDto extends PatientListItemDto {
  dateOfBirth: string | null
  consentAt: string | null
  createdAt: string
  allergies: AllergyDto[]
  bloodGroup: BloodGroup | null
  gravida: number
  para: number
  totals: { visits: number; historyEntries: number; prescriptions: number; files: number; paid: string }
  /** The next scheduled appointment from now, if any. */
  nextAppointment: { id: string; type: AppointmentTypeCode; title: string | null; startsAt: string } | null
}

export interface MedicalHistoryDto {
  allergies: AllergyDto[]
  chronicConditions: string[]
  currentMedications: string[]
  surgeries: { name: string; year: number | null }[]
  bloodGroup: BloodGroup | null
  familyHistory: string | null
  smoking: boolean | null
  menarcheAge: number | null
  cycleLengthDays: number | null
  periodLengthDays: number | null
  cycleRegular: boolean | null
  contraception: string | null
  lastPapSmearAt: string | null
  lastPapSmearResult: string | null
  gynNotes: string | null
  updatedAt: string | null
}

export interface ObstetricEntryDto {
  id: string
  year: number | null
  outcome: PregnancyOutcomeCode
  deliveryMode: DeliveryModeCode | null
  gestationWeeks: number | null
  birthWeightG: number | null
  complications: string | null
  notes: string | null
}

export interface PregnancyDto {
  id: string
  lmp: string
  edd: string
  eddOverride: string | null
  status: 'ACTIVE' | 'DELIVERED' | 'ENDED'
  riskNotes: string | null
  weeks: number
  days: number
  createdAt: string
}

export interface VisitDto {
  id: string
  visitedAt: string
  pregnancyId: string | null
  /** Gestational age at the visit, when it belongs to a pregnancy. */
  gestation: { weeks: number; days: number } | null
  weightKg: string | null
  systolic: number | null
  diastolic: number | null
  highBloodPressure: boolean
  fundalHeightCm: string | null
  fetalHeartRate: number | null
  notes: string | null
  isPatientReport: boolean
  recordedBy: StaffRef | null
}

export interface PrescriptionItemDto {
  drugName: string
  dose: string | null
  frequency: string | null
  duration: string | null
  instructions: string | null
}

export interface PrescriptionDto {
  id: string
  number: string
  issuedAt: string
  diagnosis: string | null
  notes: string | null
  voidedAt: string | null
  voidReason: string | null
  prescribedBy: StaffRef | null
  items: PrescriptionItemDto[]
}

export interface AttachmentDto {
  id: string
  kind: AttachmentKindCode
  title: string
  fileName: string
  mimeType: string
  sizeBytes: number
  takenAt: string | null
  paymentId: string | null
  createdAt: string
  uploadedBy: StaffRef | null
}

export interface PaymentDto {
  id: string
  amount: string
  currency: string
  method: PaymentMethodCode
  purpose: string
  reference: string | null
  paidAt: string
  notes: string | null
  voidedAt: string | null
  voidReason: string | null
  receivedBy: StaffRef | null
  proofs: AttachmentDto[]
}

export interface PaymentsDto {
  items: PaymentDto[]
  /** Sum of payments that are not voided, as a decimal string. */
  totalPaid: string
  currency: string
}

export interface NoteDto {
  id: string
  body: string
  pinned: boolean
  createdAt: string
  author: StaffRef | null
}

export interface HistoryEntryDto {
  id: string
  /** YYYY-MM-DD */
  recordedOn: string
  title: string | null
  /** Sanitized HTML, safe to render. */
  bodyHtml: string
  createdAt: string
  author: StaffRef | null
  /** Set once the entry has been changed after it was written. */
  editedAt: string | null
  editedBy: StaffRef | null
}

export type TimelineEventType =
  'visit' | 'prescription' | 'payment' | 'file' | 'note' | 'pregnancy' | 'history' | 'form'

/**
 * One entry in a patient's activity feed. Clients build the visible title from `type` and
 * `code` in their own language; `label` and `detail` carry record data (numbers, drug names, notes).
 */
export interface TimelineEventDto {
  type: TimelineEventType
  id: string
  at: string
  /** Record identifier to show with the title: prescription number, file title. */
  label: string | null
  /** Free text from the record: drug names, payment purpose, note excerpt, readings. */
  detail: string | null
  /** Payment method, file kind, or "patient-report" for readings a patient sent in. */
  code: string | null
  /** Payments only: decimal amount and currency. */
  amount?: string
  currency?: string
  by: StaffRef | null
  flag?: 'warning' | 'voided'
}

export interface StaffListItemDto extends StaffRef {
  role: StaffRoleCode
}

export interface AppointmentDto {
  id: string
  patient: { id: string; fullName: string; fullNameAr: string | null; fileNumber: string }
  type: AppointmentTypeCode
  title: string | null
  startsAt: string
  endsAt: string
  durationMinutes: number
  status: AppointmentStatusCode
  notes: string | null
  cancelReason: string | null
  assignedTo: StaffRef | null
  createdBy: StaffRef | null
  closedAt: string | null
  createdAt: string
}

/** One entry of a patient's activity log (from the audit trail): who did what, when. */
/** A calendar range; `truncated` means more appointments matched than the limit returned. */
export interface AppointmentRangeDto {
  items: AppointmentDto[]
  truncated: boolean
}

export interface ActivityDto {
  id: string
  at: string
  /** Dotted action code, e.g. "prescription.create"; clients turn it into words. */
  action: string
  entity: string
  entityId: string | null
  actor: StaffRef | null
  /** For appointment entries: what was booked, as it stands now (so the log can say which one). */
  appointment: { type: AppointmentTypeCode; title: string | null; startsAt: string } | null
}

export interface ApiErrorDto {
  statusCode: number
  message: string
  errors?: { path: (string | number)[]; message: string }[]
}

// --- Forms ---------------------------------------------------------------------------

export type FormLanguageCode = 'ar' | 'en'
export type FormResponseMatchCode = 'LINK' | 'PHONE' | 'STAFF'

export interface FormListItemDto {
  id: string
  title: string
  language: FormLanguageCode
  acceptingResponses: boolean
  archived: boolean
  questionCount: number
  responseCount: number
  /** Responses nobody has reviewed yet. */
  newCount: number
  publicToken: string
  updatedAt: string
}

export interface FormDto {
  id: string
  title: string
  description: string | null
  language: FormLanguageCode
  fields: FormField[]
  version: number
  acceptingResponses: boolean
  archived: boolean
  publicToken: string
  responseCount: number
  updatedAt: string
  updatedBy: StaffRef | null
}

export interface FormResponsePatientRef {
  id: string
  fullName: string
  fileNumber: string
}

export interface FormResponseListItemDto {
  id: string
  form: { id: string; title: string }
  version: number
  submittedAt: string
  patient: FormResponsePatientRef | null
  matchedBy: FormResponseMatchCode | null
  respondentName: string | null
  respondentPhone: string | null
  reviewedAt: string | null
  reviewedBy: StaffRef | null
  /** Personal link or the shared one. */
  viaLink: boolean
}

export interface FormResponseDto extends FormResponseListItemDto {
  language: FormLanguageCode
  /** The questions exactly as the patient saw them (that version's snapshot). */
  fields: FormField[]
  answers: Answers
}

export type FormLinkStatus = 'waiting' | 'opened' | 'submitted' | 'expired' | 'revoked'

export interface FormLinkDto {
  id: string
  form: { id: string; title: string }
  status: FormLinkStatus
  createdAt: string
  expiresAt: string
  openedAt: string | null
  responseId: string | null
  createdBy: StaffRef | null
}

/** Returned once, when a personal link is created: the raw token exists nowhere else. */
export interface CreatedFormLinkDto extends FormLinkDto {
  token: string
}

export type PublicFormState = 'open' | 'closed' | 'submitted' | 'expired'

/** What the patient page needs; never includes other patients' data or staff details. */
export interface PublicFormDto {
  mode: 'shared' | 'personal'
  state: PublicFormState
  versionId: string
  title: string
  description: string | null
  language: FormLanguageCode
  fields: FormField[]
  clinicName: string
  /** Personal links: the patient's first name for the greeting. */
  greetingName: string | null
}

// --- Team ----------------------------------------------------------------------------

export interface TeamMemberDto {
  id: string
  fullName: string
  email: string
  phone: string | null
  role: StaffRoleCode
  /** invited: added but hasn't set a password yet; inactive: can't sign in. */
  status: StaffStatus
  lastLoginAt: string | null
  createdAt: string
  /** The latest unused set-password link, if any (invite or reset). */
  /** Who sent it is shown to the whole team, so a reset is never silent. */
  pendingInvite: { expiresAt: string; sentBy: string | null } | null
  isYou: boolean
}

/** Returned when a set-password link is made: the raw token exists nowhere else. */
export interface StaffInviteDto {
  member: TeamMemberDto
  token: string
  expiresAt: string
}

export interface PublicInviteDto {
  fullName: string
  email: string
  clinicName: string
  /** welcome: first password; reset: replacing an existing one. */
  kind: 'welcome' | 'reset'
}
