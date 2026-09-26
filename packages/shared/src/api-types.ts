/**
 * Response shapes of the AZZAH API (v1). The API returns these, and the web and mobile apps
 * consume them. Dates are ISO strings; money is a decimal string (never a float).
 */
import type {
  ALLERGY_SEVERITIES,
  ATTACHMENT_KINDS,
  BLOOD_GROUPS,
  CASE_TYPES,
  DELIVERY_MODES,
  PATIENT_STATUSES,
  PAYMENT_METHODS,
  PREGNANCY_OUTCOMES,
} from './schemas/patient-record.js'

export type CaseTypeCode = (typeof CASE_TYPES)[number]
export type PatientStatusCode = (typeof PATIENT_STATUSES)[number]
export type PaymentMethodCode = (typeof PAYMENT_METHODS)[number]
export type AttachmentKindCode = (typeof ATTACHMENT_KINDS)[number]
export type PregnancyOutcomeCode = (typeof PREGNANCY_OUTCOMES)[number]
export type DeliveryModeCode = (typeof DELIVERY_MODES)[number]
export type BloodGroup = (typeof BLOOD_GROUPS)[number]
export type StaffRoleCode = 'OWNER' | 'DOCTOR' | 'NURSE' | 'RECEPTION'

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
  caseType: CaseTypeCode
  status: PatientStatusCode
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
  totals: { visits: number; prescriptions: number; files: number; paid: string }
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

export type TimelineEventType = 'visit' | 'prescription' | 'payment' | 'file' | 'note' | 'pregnancy'

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

export interface ApiErrorDto {
  statusCode: number
  message: string
  errors?: { path: (string | number)[]; message: string }[]
}
