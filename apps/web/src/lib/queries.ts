import type {
  ActivityDto,
  AppointmentDto,
  AppointmentRangeDto,
  AttachmentDto,
  CreateAppointmentInput,
  AttachmentKindCode,
  CaseTypeDto,
  CreateCaseTypeInput,
  CreateHistoryEntryInput,
  CreateNoteInput,
  CreatePatientInput,
  CreatePaymentInput,
  CreatePregnancyInput,
  CreatePrescriptionInput,
  CreateVisitInput,
  HistoryEntryDto,
  LoginInput,
  MeDto,
  NoteDto,
  Page,
  PatientDto,
  PatientListItemDto,
  PatientStatusCode,
  PaymentDto,
  PaymentsDto,
  PregnancyDto,
  PrescriptionDto,
  StaffListItemDto,
  TimelineEventDto,
  UpdateAppointmentInput,
  UpdateCaseTypeInput,
  UpdateHistoryEntryInput,
  UpdatePatientInput,
  VisitDto,
} from '@azza/shared'
import {
  keepPreviousData,
  type QueryKey,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from './api'

/** Query keys in one place, so invalidation after a change is exact. */
export const keys = {
  me: ['me'] as const,
  patients: (filters: object) => ['patients', filters] as const,
  patient: (id: string) => ['patient', id] as const,
  part: (id: string, part: string) => ['patient', id, part] as const,
}

// --- Auth ---------------------------------------------------------------------

export const useMe = () =>
  useQuery({ queryKey: keys.me, queryFn: () => api<MeDto>('/auth/me'), retry: false, staleTime: 5 * 60_000 })

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => api<void>('/auth/login', { body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => qc.clear(),
  })
}

// --- Patients -----------------------------------------------------------------

// --- Case types ---------------------------------------------------------------

export const useCaseTypes = (includeArchived = false) =>
  useQuery({
    queryKey: ['case-types', { includeArchived }],
    queryFn: () => api<CaseTypeDto[]>(`/case-types${includeArchived ? '?includeArchived=true' : ''}`),
    staleTime: 60_000,
  })

function useCaseTypeMutation<TInput>(fn: (input: TInput) => Promise<CaseTypeDto>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['case-types'] }),
        qc.invalidateQueries({ queryKey: ['patients'] }),
      ]),
  })
}

export const useCreateCaseType = () =>
  useCaseTypeMutation((input: CreateCaseTypeInput) => api<CaseTypeDto>('/case-types', { body: input }))

export const useUpdateCaseType = () =>
  useCaseTypeMutation(({ id, ...input }: UpdateCaseTypeInput & { id: string }) =>
    api<CaseTypeDto>(`/case-types/${id}`, { method: 'PATCH', body: input }),
  )

export interface PatientFilters {
  q?: string
  caseTypeId?: string
  status?: PatientStatusCode
}

export function usePatients(filters: PatientFilters, options: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    enabled: options.enabled ?? true,
    queryKey: keys.patients(filters),
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: '25' })
      if (filters.q) params.set('q', filters.q)
      if (filters.caseTypeId) params.set('caseTypeId', filters.caseTypeId)
      if (filters.status) params.set('status', filters.status)
      if (pageParam) params.set('cursor', pageParam)
      return api<Page<PatientListItemDto>>(`/patients?${params}`, { signal })
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  })
}

export const usePatient = (id: string) =>
  useQuery({ queryKey: keys.patient(id), queryFn: () => api<PatientDto>(`/patients/${id}`) })

export function useCreatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePatientInput) => api<PatientDto>('/patients', { body: input }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['patients'] }),
        qc.invalidateQueries({ queryKey: ['case-types'] }),
      ]),
  })
}

export function useUpdatePatient(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdatePatientInput) => api<PatientDto>(`/patients/${id}`, { method: 'PATCH', body: input }),
    onSuccess: (data) => {
      qc.setQueryData(keys.patient(id), data)
      void qc.invalidateQueries({ queryKey: keys.part(id, 'activity') })
      void qc.invalidateQueries({ queryKey: ['patients'] })
      void qc.invalidateQueries({ queryKey: ['case-types'] })
    },
  })
}

// --- Patient record parts -----------------------------------------------------

const part = <T>(id: string, name: string, path: string) =>
  ({ queryKey: keys.part(id, name), queryFn: () => api<T>(`/patients/${id}${path}`) }) as const

export const useTimeline = (id: string) => useQuery(part<TimelineEventDto[]>(id, 'timeline', '/timeline'))
export const useVisits = (id: string) => useQuery(part<VisitDto[]>(id, 'visits', '/visits'))
export const usePregnancies = (id: string) => useQuery(part<PregnancyDto[]>(id, 'pregnancies', '/pregnancies'))
export const useHistoryEntries = (id: string) =>
  useQuery(part<HistoryEntryDto[]>(id, 'history-entries', '/history-entries'))
export const usePrescriptions = (id: string) => useQuery(part<PrescriptionDto[]>(id, 'prescriptions', '/prescriptions'))
export const usePayments = (id: string) => useQuery(part<PaymentsDto>(id, 'payments', '/payments'))
export const useNotes = (id: string) => useQuery(part<NoteDto[]>(id, 'notes', '/notes'))
export const useAttachments = (id: string) =>
  useQuery({
    ...part<AttachmentDto[]>(id, 'attachments', '/attachments'),
    select: (files) => files.filter((f) => f.kind !== 'PAYMENT_PROOF'),
  })

/**
 * A change to any part refreshes the header totals and the timeline too. `listsToo` also
 * refreshes the patient list and case counts, for changes that can move a patient between cases.
 */
function usePatientMutation<TInput, TResult>(
  id: string,
  parts: string[],
  fn: (input: TInput) => Promise<TResult>,
  { listsToo = false, alsoInvalidate = [] as QueryKey[] } = {},
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: keys.patient(id), exact: true }),
        qc.invalidateQueries({ queryKey: keys.part(id, 'timeline') }),
        // Every change lands in the activity log (both the changes-only and with-views variants).
        qc.invalidateQueries({ queryKey: keys.part(id, 'activity') }),
        ...parts.map((p) => qc.invalidateQueries({ queryKey: keys.part(id, p) })),
        ...(listsToo
          ? [qc.invalidateQueries({ queryKey: ['patients'] }), qc.invalidateQueries({ queryKey: ['case-types'] })]
          : []),
        ...alsoInvalidate.map((queryKey) => qc.invalidateQueries({ queryKey })),
      ]),
  })
}

export const useAddVisit = (id: string) =>
  usePatientMutation(id, ['visits'], (input: CreateVisitInput) =>
    api<VisitDto>(`/patients/${id}/visits`, { body: input }),
  )

export const useStartPregnancy = (id: string) =>
  usePatientMutation(
    id,
    ['pregnancies', 'visits'],
    (input: CreatePregnancyInput) => api<PregnancyDto>(`/patients/${id}/pregnancies`, { body: input }),
    { listsToo: true },
  )

export const useEndPregnancy = (id: string) =>
  usePatientMutation(
    id,
    ['pregnancies'],
    ({ pregnancyId, status }: { pregnancyId: string; status: 'DELIVERED' | 'ENDED' }) =>
      api<PregnancyDto>(`/patients/${id}/pregnancies/${pregnancyId}/end`, { body: { status } }),
    { listsToo: true },
  )

export const useCreateHistoryEntry = (id: string) =>
  usePatientMutation(id, ['history-entries'], (input: CreateHistoryEntryInput) =>
    api<HistoryEntryDto>(`/patients/${id}/history-entries`, { body: input }),
  )

export const useUpdateHistoryEntry = (id: string) =>
  usePatientMutation(id, ['history-entries'], ({ entryId, ...input }: UpdateHistoryEntryInput & { entryId: string }) =>
    api<HistoryEntryDto>(`/patients/${id}/history-entries/${entryId}`, { method: 'PATCH', body: input }),
  )

export const useRemoveHistoryEntry = (id: string) =>
  usePatientMutation(id, ['history-entries'], (entryId: string) =>
    api<{ id: string }>(`/patients/${id}/history-entries/${entryId}`, { method: 'DELETE' }),
  )

export const useCreatePrescription = (id: string) =>
  usePatientMutation(id, ['prescriptions'], (input: CreatePrescriptionInput) =>
    api<PrescriptionDto>(`/patients/${id}/prescriptions`, { body: input }),
  )

export const useVoidPrescription = (id: string) =>
  usePatientMutation(id, ['prescriptions'], ({ prescriptionId, reason }: { prescriptionId: string; reason: string }) =>
    api<PrescriptionDto>(`/patients/${id}/prescriptions/${prescriptionId}/void`, { body: { reason } }),
  )

export const useCreatePayment = (id: string) =>
  usePatientMutation(id, ['payments'], (input: CreatePaymentInput) =>
    api<PaymentDto>(`/patients/${id}/payments`, { body: input }),
  )

export const useVoidPayment = (id: string) =>
  usePatientMutation(id, ['payments'], ({ paymentId, reason }: { paymentId: string; reason: string }) =>
    api<PaymentDto>(`/patients/${id}/payments/${paymentId}/void`, { body: { reason } }),
  )

export interface UploadInput {
  file: File
  kind: AttachmentKindCode
  title: string
  takenAt?: string
  paymentId?: string
}

export const useUploadAttachment = (id: string) =>
  usePatientMutation(id, ['attachments', 'payments'], (input: UploadInput) => {
    const form = new FormData()
    // Fields first, file last: the API reads the metadata before streaming the file.
    form.set('kind', input.kind)
    form.set('title', input.title)
    if (input.takenAt) form.set('takenAt', input.takenAt)
    if (input.paymentId) form.set('paymentId', input.paymentId)
    form.set('file', input.file)
    return api<AttachmentDto>(`/patients/${id}/attachments`, { body: form })
  })

export const useDeleteAttachment = (id: string) =>
  usePatientMutation(id, ['attachments'], (attachmentId: string) =>
    api<void>(`/patients/${id}/attachments/${attachmentId}`, { method: 'DELETE' }),
  )

export const useAddNote = (id: string) =>
  usePatientMutation(id, ['notes'], (input: CreateNoteInput) => api<NoteDto>(`/patients/${id}/notes`, { body: input }))

// --- Staff, appointments and activity ---------------------------------------------

export const useStaff = () =>
  useQuery({ queryKey: ['staff'], queryFn: () => api<StaffListItemDto[]>('/staff'), staleTime: 5 * 60_000 })

export const usePatientAppointments = (id: string) =>
  useQuery(part<{ upcoming: AppointmentDto[]; past: AppointmentDto[] }>(id, 'appointments', '/appointments'))

/** The clinic calendar between two instants (the Appointments page). */
export const useClinicAppointments = (from: string, to: string, assignedToId?: string) =>
  useQuery({
    queryKey: ['appointments', { from, to, assignedToId }],
    queryFn: () =>
      api<AppointmentRangeDto>(
        `/appointments?${new URLSearchParams({ from, to, ...(assignedToId && { assignedToId }) })}`,
      ),
  })

export const useCreateAppointment = (id: string) =>
  usePatientMutation(
    id,
    ['appointments'],
    (input: CreateAppointmentInput) => api<AppointmentDto>(`/patients/${id}/appointments`, { body: input }),
    { alsoInvalidate: [['appointments']] },
  )

export const useUpdateAppointment = (id: string) =>
  usePatientMutation(
    id,
    ['appointments'],
    ({ appointmentId, ...input }: UpdateAppointmentInput & { appointmentId: string }) =>
      api<AppointmentDto>(`/patients/${id}/appointments/${appointmentId}`, { method: 'PATCH', body: input }),
    { alsoInvalidate: [['appointments']] },
  )

export function useActivity(id: string, includeViews: boolean) {
  return useInfiniteQuery({
    queryKey: [...keys.part(id, 'activity'), { includeViews }],
    initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ includeViews: String(includeViews), limit: '50' })
      if (pageParam) params.set('cursor', pageParam)
      return api<Page<ActivityDto>>(`/patients/${id}/activity?${params}`)
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}
