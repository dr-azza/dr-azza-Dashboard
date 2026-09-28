import type {
  ActivityDto,
  CreateStaffInput,
  StaffInviteDto,
  TeamMemberDto,
  UpdateStaffInput,
  CreatedFormLinkDto,
  CreateFormInput,
  FormDto,
  FormLinkDto,
  FormListItemDto,
  FormResponseDto,
  FormResponseListItemDto,
  UpdateFormInput,
  UpdateFormResponseInput,
  AppointmentDto,
  AppointmentRangeDto,
  AttachmentDto,
  CreateAppointmentInput,
  CreateTaskInput,
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
  UpdateTaskInput,
  TaskDto,
  TaskListDto,
  PatientVisitModeCode,
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
  visitMode?: PatientVisitModeCode
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
      if (filters.visitMode) params.set('visitMode', filters.visitMode)
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

// --- Forms -------------------------------------------------------------------------

export const useForms = (archived = false) =>
  useQuery({
    queryKey: ['forms', 'list', { archived }],
    queryFn: () => api<FormListItemDto[]>(`/forms?archived=${archived}`),
  })

export const useForm = (formId: string) =>
  useQuery({ queryKey: ['forms', 'detail', formId], queryFn: () => api<FormDto>(`/forms/${formId}`) })

export function useCreateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFormInput) => api<FormDto>('/forms', { body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms', 'list'] }),
  })
}

/** Saves the form and puts the saved copy straight into the cache (no refetch flash). */
export function useUpdateForm(formId: string) {
  const qc = useQueryClient()
  const onSuccess = (form: FormDto) => {
    qc.setQueryData(['forms', 'detail', formId], form)
    void qc.invalidateQueries({ queryKey: ['forms', 'list'] })
    void qc.invalidateQueries({ queryKey: ['form-responses'] })
  }
  return {
    save: useMutation({
      mutationFn: (input: UpdateFormInput) => api<FormDto>(`/forms/${formId}`, { method: 'PATCH', body: input }),
      onSuccess,
    }),
    rotate: useMutation({
      mutationFn: () => api<FormDto>(`/forms/${formId}/rotate-link`, { method: 'POST' }),
      onSuccess,
    }),
  }
}

export interface ResponseFilters {
  formId?: string
  status?: 'new' | 'reviewed'
  /** false: only responses not tied to a patient yet. */
  linked?: boolean
  /** Only responses from the last N days. */
  days?: number
}

/** Responses across the clinic (or one form), newest first. */
export function useResponses(filters: ResponseFilters) {
  return useInfiniteQuery({
    queryKey: ['form-responses', 'list', filters],
    initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' })
      if (filters.formId) params.set('formId', filters.formId)
      if (filters.status) params.set('status', filters.status)
      if (filters.linked !== undefined) params.set('linked', String(filters.linked))
      if (filters.days) params.set('days', String(filters.days))
      if (pageParam) params.set('cursor', pageParam)
      return api<Page<FormResponseListItemDto>>(`/form-responses?${params}`)
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

export const useFormResponse = (responseId: string | null) =>
  useQuery({
    enabled: !!responseId,
    queryKey: ['form-responses', 'detail', responseId],
    queryFn: () => api<FormResponseDto>(`/form-responses/${responseId}`),
  })

/** Unreviewed responses, for the sidebar badge. */
export const useFormResponsesSummary = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: ['form-responses', 'summary'],
    queryFn: () => api<{ newCount: number; unlinkedCount: number; lastWeekCount: number }>('/form-responses/summary'),
    refetchInterval: 60_000,
  })

export function useUpdateFormResponse(responseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateFormResponseInput) =>
      api<FormResponseDto>(`/form-responses/${responseId}`, { method: 'PATCH', body: input }),
    onSuccess: (response, input) => {
      qc.setQueryData(['form-responses', 'detail', responseId], response)
      void qc.invalidateQueries({ queryKey: ['form-responses'] })
      void qc.invalidateQueries({ queryKey: ['forms', 'list'] })
      // The response may have moved onto (or off) a patient's record.
      void qc.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === 'patient' && ['forms', 'timeline', 'activity'].includes(String(q.queryKey[2])),
      })
      if (input.patientId) void qc.invalidateQueries({ queryKey: keys.part(input.patientId, 'forms') })
    },
  })
}

export const usePatientForms = (id: string) =>
  useQuery(part<{ links: FormLinkDto[]; responses: FormResponseListItemDto[] }>(id, 'forms', '/forms'))

export const useCreateFormLink = (id: string) =>
  usePatientMutation(id, ['forms'], (formId: string) =>
    api<CreatedFormLinkDto>(`/patients/${id}/form-links`, { body: { formId } }),
  )

export const useRevokeFormLink = (id: string) =>
  usePatientMutation(id, ['forms'], (linkId: string) =>
    api<FormLinkDto>(`/patients/${id}/form-links/${linkId}/revoke`, { method: 'POST' }),
  )

/** Absolute URL of a form link, for copying. */
export const formLinkUrl = (token: string) => `${window.location.origin}/f/${token}`

// --- Team --------------------------------------------------------------------------

export const useTeam = () => useQuery({ queryKey: ['team'], queryFn: () => api<TeamMemberDto[]>('/team') })

function useTeamMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['team'] }),
        // Pickers (e.g. "appointment with") list active staff.
        qc.invalidateQueries({ queryKey: ['staff'] }),
        qc.invalidateQueries({ queryKey: keys.me }),
      ]),
  })
}

export const useAddMember = () =>
  useTeamMutation((input: CreateStaffInput) => api<StaffInviteDto>('/team', { body: input }))

export const useUpdateMember = () =>
  useTeamMutation(({ id, ...input }: UpdateStaffInput & { id: string }) =>
    api<TeamMemberDto>(`/team/${id}`, { method: 'PATCH', body: input }),
  )

export const useSendMemberLink = () =>
  useTeamMutation((id: string) => api<StaffInviteDto>(`/team/${id}/link`, { method: 'POST' }))

/** Absolute URL of a set-password link, for copying. */
export const inviteLinkUrl = (token: string) => `${window.location.origin}/invite/${token}`

// --- Reminders (team tasks) ------------------------------------------------------------

export interface TaskFilters {
  status: 'open' | 'done'
  /** A staff id, "me" or "unassigned"; omitted for everyone's. */
  assignee?: string
  patientId?: string
}

export const useTasks = (filters: TaskFilters, options: { refetchInterval?: number; enabled?: boolean } = {}) =>
  useQuery({
    enabled: options.enabled ?? true,
    queryKey: ['reminders', filters],
    queryFn: () => {
      const params = new URLSearchParams({ status: filters.status })
      if (filters.assignee) params.set('assignee', filters.assignee)
      if (filters.patientId) params.set('patientId', filters.patientId)
      return api<TaskListDto>(`/reminders?${params}`)
    },
    refetchInterval: options.refetchInterval,
  })

/** After any change: every reminder list, and activity logs (the reminder may have moved between patients). */
function useTaskMutation<TInput>(fn: (input: TInput) => Promise<TaskDto>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['reminders'] }),
        qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'patient' && q.queryKey[2] === 'activity' }),
      ]),
  })
}

export const useCreateTask = () =>
  useTaskMutation((input: CreateTaskInput) => api<TaskDto>('/reminders', { body: input }))

export const useUpdateTask = () =>
  useTaskMutation(({ taskId, ...input }: UpdateTaskInput & { taskId: string }) =>
    api<TaskDto>(`/reminders/${taskId}`, { method: 'PATCH', body: input }),
  )

export const useSetTaskDone = () =>
  useTaskMutation(({ taskId, done }: { taskId: string; done: boolean }) =>
    api<TaskDto>(`/reminders/${taskId}/${done ? 'complete' : 'reopen'}`, { method: 'POST' }),
  )

export const useDeleteTask = () =>
  useTaskMutation((taskId: string) => api<TaskDto>(`/reminders/${taskId}`, { method: 'DELETE' }))
