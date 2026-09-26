/**
 * Request contracts for the patient record, shared by the API (validation) and the web and
 * mobile apps (forms). Enum values match the database enums.
 */
import { z } from 'zod'
import { isoDate, optionalText, phoneE164, requiredText } from './common.js'

/** Built-in cases every clinic starts with. Clinics can add their own on top. */
export const SYSTEM_CASE_KEYS = ['PREGNANCY', 'GYNECOLOGY', 'POSTPARTUM', 'FERTILITY'] as const
export const PATIENT_STATUSES = ['OK', 'FLAGGED', 'OVERDUE', 'AWAITING'] as const
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const

// --- Patient ----------------------------------------------------------------

export const CreatePatientSchema = z.object({
  fullName: requiredText(120),
  fullNameAr: optionalText(120),
  phone: phoneE164,
  dateOfBirth: isoDate.nullish(),
  caseTypeId: z.uuid(),
  consentGiven: z.boolean().refine((v) => v, { message: 'Consent is required to create a medical record' }),
})
export type CreatePatientInput = z.input<typeof CreatePatientSchema>

export const UpdatePatientSchema = z
  .object({
    fullName: requiredText(120),
    fullNameAr: optionalText(120),
    phone: phoneE164,
    dateOfBirth: isoDate.nullable(),
    caseTypeId: z.uuid(),
    status: z.enum(PATIENT_STATUSES),
  })
  .partial()
export type UpdatePatientInput = z.input<typeof UpdatePatientSchema>

export const ListPatientsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  caseTypeId: z.uuid().optional(),
  status: z.enum(PATIENT_STATUSES).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})
export type ListPatientsQuery = z.output<typeof ListPatientsQuerySchema>

// --- Case types ---------------------------------------------------------------

export const CreateCaseTypeSchema = z.object({
  nameEn: requiredText(60),
  nameAr: requiredText(60),
})
export type CreateCaseTypeInput = z.input<typeof CreateCaseTypeSchema>

export const UpdateCaseTypeSchema = z
  .object({
    nameEn: requiredText(60),
    nameAr: requiredText(60),
    archived: z.boolean(),
    sortOrder: z.number().int().min(0).max(10_000),
  })
  .partial()
export type UpdateCaseTypeInput = z.input<typeof UpdateCaseTypeSchema>

// --- Medical history --------------------------------------------------------

export const ALLERGY_SEVERITIES = ['mild', 'moderate', 'severe'] as const

export const MedicalHistorySchema = z.object({
  allergies: z
    .array(
      z.object({
        substance: requiredText(100),
        reaction: optionalText(200),
        severity: z.enum(ALLERGY_SEVERITIES),
      }),
    )
    .max(50)
    .default([]),
  chronicConditions: z.array(requiredText(120)).max(50).default([]),
  currentMedications: z.array(requiredText(160)).max(50).default([]),
  surgeries: z
    .array(z.object({ name: requiredText(160), year: z.number().int().min(1900).max(2100).nullish() }))
    .max(50)
    .default([]),
  bloodGroup: z.enum(BLOOD_GROUPS).nullish(),
  familyHistory: optionalText(),
  smoking: z.boolean().nullish(),

  menarcheAge: z.number().int().min(6).max(25).nullish(),
  cycleLengthDays: z.number().int().min(10).max(120).nullish(),
  periodLengthDays: z.number().int().min(1).max(20).nullish(),
  cycleRegular: z.boolean().nullish(),
  contraception: optionalText(200),
  lastPapSmearAt: isoDate.nullish(),
  lastPapSmearResult: optionalText(200),
  gynNotes: optionalText(),
})
export type MedicalHistoryInput = z.input<typeof MedicalHistorySchema>

export const PREGNANCY_OUTCOMES = [
  'LIVE_BIRTH',
  'STILLBIRTH',
  'MISCARRIAGE',
  'ECTOPIC',
  'TERMINATION',
  'MOLAR',
] as const
export const DELIVERY_MODES = ['VAGINAL', 'ASSISTED', 'CESAREAN'] as const

export const ObstetricEntrySchema = z.object({
  year: z.number().int().min(1950).max(2100).nullish(),
  outcome: z.enum(PREGNANCY_OUTCOMES),
  deliveryMode: z.enum(DELIVERY_MODES).nullish(),
  gestationWeeks: z.number().int().min(4).max(45).nullish(),
  birthWeightG: z.number().int().min(200).max(7000).nullish(),
  complications: optionalText(500),
  notes: optionalText(),
})
export type ObstetricEntryInput = z.input<typeof ObstetricEntrySchema>

// --- Follow-up ---------------------------------------------------------------

export const CreatePregnancySchema = z.object({
  lmp: isoDate,
  eddOverride: isoDate.nullish(),
  riskNotes: optionalText(),
})
export type CreatePregnancyInput = z.input<typeof CreatePregnancySchema>

export const CreateVisitSchema = z
  .object({
    visitedAt: z.iso.datetime({ offset: true }),
    pregnancyId: z.uuid().nullish(),
    weightKg: z.number().min(25).max(250).nullish(),
    systolic: z.number().int().min(50).max(260).nullish(),
    diastolic: z.number().int().min(30).max(180).nullish(),
    fundalHeightCm: z.number().min(5).max(50).nullish(),
    fetalHeartRate: z.number().int().min(60).max(220).nullish(),
    notes: optionalText(),
  })
  .refine((v) => (v.systolic == null) === (v.diastolic == null), {
    message: 'Enter both blood pressure numbers or neither',
    path: ['diastolic'],
  })
export type CreateVisitInput = z.input<typeof CreateVisitSchema>

// --- Prescriptions -----------------------------------------------------------

export const PrescriptionItemSchema = z.object({
  drugName: requiredText(160),
  dose: optionalText(80),
  frequency: optionalText(80),
  duration: optionalText(80),
  instructions: optionalText(300),
})

export const CreatePrescriptionSchema = z.object({
  diagnosis: optionalText(300),
  notes: optionalText(),
  items: z.array(PrescriptionItemSchema).min(1, 'Add at least one medicine').max(20),
})
export type CreatePrescriptionInput = z.input<typeof CreatePrescriptionSchema>

export const VoidSchema = z.object({ reason: requiredText(300) })

// --- Payments ------------------------------------------------------------------

export const PAYMENT_METHODS = ['CASH', 'INSTAPAY', 'VODAFONE_CASH', 'CARD', 'BANK_TRANSFER', 'OTHER'] as const

export const CreatePaymentSchema = z.object({
  /** Amount in EGP with at most two decimals. */
  amount: z
    .number()
    .positive()
    .max(10_000_000)
    .refine((v) => Math.round(v * 100) === v * 100, 'At most two decimals'),
  method: z.enum(PAYMENT_METHODS),
  purpose: requiredText(120),
  reference: optionalText(120),
  paidAt: z.iso.datetime({ offset: true }),
  notes: optionalText(500),
})
export type CreatePaymentInput = z.input<typeof CreatePaymentSchema>

// --- Files and notes -------------------------------------------------------------

export const ATTACHMENT_KINDS = ['PAYMENT_PROOF', 'LAB_RESULT', 'SCAN', 'REPORT', 'PRESCRIPTION_SCAN', 'OTHER'] as const
export const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'] as const
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const AttachmentMetaSchema = z.object({
  kind: z.enum(ATTACHMENT_KINDS),
  title: requiredText(160),
  takenAt: isoDate.nullish(),
  paymentId: z.uuid().nullish(),
})
export type AttachmentMetaInput = z.input<typeof AttachmentMetaSchema>

export const CreateNoteSchema = z.object({
  body: requiredText(5000),
  pinned: z.boolean().default(false),
})
export type CreateNoteInput = z.input<typeof CreateNoteSchema>

// --- Appointments ------------------------------------------------------------------

export const APPOINTMENT_TYPES = ['VISIT', 'CALL', 'SCAN', 'LAB', 'FOLLOW_UP', 'OTHER'] as const
export const APPOINTMENT_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const
export const APPOINTMENT_DURATIONS = [5, 10, 15, 20, 30, 45, 60, 90] as const

export const CreateAppointmentSchema = z.object({
  type: z.enum(APPOINTMENT_TYPES),
  title: optionalText(120),
  startsAt: z.iso.datetime({ offset: true }),
  durationMinutes: z.number().int().min(5).max(480).default(15),
  assignedToId: z.uuid().nullish(),
  notes: optionalText(1000),
})
export type CreateAppointmentInput = z.input<typeof CreateAppointmentSchema>

export const UpdateAppointmentSchema = z
  .object({
    type: z.enum(APPOINTMENT_TYPES),
    title: optionalText(120),
    startsAt: z.iso.datetime({ offset: true }),
    durationMinutes: z.number().int().min(5).max(480),
    assignedToId: z.uuid().nullable(),
    notes: optionalText(1000),
    status: z.enum(APPOINTMENT_STATUSES),
    cancelReason: optionalText(300),
  })
  .partial()
export type UpdateAppointmentInput = z.input<typeof UpdateAppointmentSchema>

export const ListAppointmentsQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  assignedToId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
})
export type ListAppointmentsQuery = z.output<typeof ListAppointmentsQuerySchema>

// --- Activity log --------------------------------------------------------------------

export const ActivityQuerySchema = z.object({
  /** Include read-only events (who opened the record, downloaded a file). */
  includeViews: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
export type ActivityQuery = z.output<typeof ActivityQuerySchema>

// --- Auth ------------------------------------------------------------------------

export const LoginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(200),
})
export type LoginInput = z.input<typeof LoginSchema>
