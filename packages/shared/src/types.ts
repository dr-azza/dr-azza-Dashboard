/** Domain types shared by the web dashboard, the API and the mobile app. */

export type Lang = 'en' | 'ar'

/** Content stored in both languages (patient names, notes, reminder text…). */
export type L = { en: string; ar: string }

export type CaseType = 'pregnancy' | 'gynecology' | 'postpartum' | 'fertility'
export type PatientStatus = 'ok' | 'flagged' | 'overdue' | 'awaiting'
export type Tone = 'neutral' | 'warn' | 'danger' | 'ok' | 'info'

export interface Visit {
  daysAgo: number
  weightKg?: number
  bp?: string
  bpHigh?: boolean
  fundalCm?: number
  fhr?: number
  note: L
}

export interface Lab {
  name: L
  date: L
  result: L
  tone: Tone
}

export interface Task {
  when: L
  urgent?: boolean
  title: L
  meta: L
}

export type ResponseStatus = 'flagged' | 'new' | 'reviewed' | 'noAnswer'

export interface ResponseSummary {
  form: L
  when: L
  summary: L
  status: ResponseStatus
}

export interface Patient {
  id: string
  file: string
  name: L
  age: number
  phone: string
  caseType: CaseType
  /** Days pregnant today, for active pregnancies. */
  gaDays?: number
  /** Free-text stage for everything that is not an active pregnancy. */
  stage?: L
  nextVisit: L | null
  lastContact: L
  status: PatientStatus
  tags?: { label: L; tone: Tone }[]
  alert?: { title: L; body: L }
  visits?: Visit[]
  labs?: Lab[]
  tasks?: Task[]
  responses?: ResponseSummary[]
  note?: { text: L; by: L; date: L }
  dueNote?: L
}

export type AppointmentStatus = 'done' | 'checkedIn' | 'upcoming'
export type AppointmentType = CaseType | 'scan'

export interface Appointment {
  time: string
  patientId: string
  reason: L
  type: AppointmentType
  status: AppointmentStatus
}

export type Severity = 'high' | 'medium' | 'low'
export type AttentionAction = 'review' | 'call' | 'resend' | 'open'

export interface AttentionItem {
  patientId: string
  severity: Severity
  title: L
  detail: L
  action: AttentionAction
}

export type DeliveryStatus = 'queued' | 'sent' | 'failed'
export type Channel = 'whatsapp' | 'sms'

export interface Reminder {
  when: L
  message: L
  to: L
  channel: Channel
  status: DeliveryStatus
  detail?: L
}

export interface FormTemplate {
  id: string
  name: L
  questions: number
  meta: L
}

export interface FormResponse {
  patientId: string
  when: L
  summary: L
  status: ResponseStatus
}
