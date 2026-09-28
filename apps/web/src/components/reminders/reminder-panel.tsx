import { RequestError, strOrNull, toLocalInputValue } from '@/components/app/form'
import { SidePanel } from '@/components/app/side-panel'
import { Button } from '@/components/catalyst/button'
import { Description, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { Switch, SwitchField } from '@/components/catalyst/switch'
import { Textarea } from '@/components/catalyst/textarea'
import { PatientPicker } from '@/components/patient/patient-picker'
import { useLang } from '@/i18n'
import { useCreateTask, useDeleteTask, useMe, useStaff, useUpdateTask } from '@/lib/queries'
import { CreateTaskSchema, type TaskDto, type UpdateTaskInput } from '@azza/shared'
import { LinkIcon, TrashIcon, XMarkIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'

type PatientRef = NonNullable<TaskDto['patient']>

/** Due-time shortcuts, the common cases in one tap. */
const QUICK = {
  inTwoHours: () => {
    const d = new Date(Date.now() + 2 * 3_600_000)
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
    return d
  },
  tomorrow: () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d
  },
  nextWeek: () => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    d.setHours(9, 0, 0, 0)
    return d
  },
} as const

/**
 * Add a reminder (no `task`) or edit one. `patient` fixes the patient, for reminders added from
 * a patient's record; otherwise a patient can be linked or removed here.
 */
export function ReminderPanel({
  open,
  onClose,
  task,
  patient: fixedPatient,
}: {
  open: boolean
  onClose: () => void
  task?: TaskDto
  patient?: PatientRef
}) {
  const { t } = useLang()
  const me = useMe().data
  const staff = useStaff()
  const create = useCreateTask()
  const update = useUpdateTask()
  const remove = useDeleteTask()

  const [due, setDue] = useState(() => toLocalInputValue(task ? new Date(task.dueAt) : QUICK.tomorrow()))
  const [initialDue] = useState(due)
  const [high, setHigh] = useState(task?.priority === 'HIGH')
  // New reminders default to the person adding them; they can hand it to someone else.
  const [assignee, setAssignee] = useState(task ? (task.assignee?.id ?? '') : (me?.id ?? ''))
  const [patient, setPatient] = useState<PatientRef | null>(fixedPatient ?? task?.patient ?? null)
  const [picking, setPicking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const pending = create.isPending || update.isPending || remove.isPending

  // A deactivated assignee is no longer listed, but stays visible on their reminders.
  const current = task?.assignee
  const staffOptions = [
    ...(staff.data ?? []),
    ...(current && !staff.data?.some((m) => m.id === current.id) ? [current] : []),
  ]
  const canDelete = !!task && !!me && (task.createdBy?.id === me.id || me.role === 'OWNER')

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={task ? t('reminders.edit') : t('reminders.new')}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault()
        const f = new FormData(event.currentTarget)
        const parsed = CreateTaskSchema.safeParse({
          title: String(f.get('title') ?? ''),
          notes: strOrNull(f.get('notes')),
          // An untouched time keeps the stored instant exactly (the input has no seconds).
          dueAt: task && due === initialDue ? task.dueAt : due ? new Date(due).toISOString() : '',
          priority: high ? 'HIGH' : 'NORMAL',
          assigneeId: assignee || null,
          patientId: patient?.id ?? null,
        })
        if (!parsed.success) {
          const field = String(parsed.error.issues[0]?.path[0])
          return setFormError(
            `${field === 'dueAt' ? t('reminders.due') : t('reminders.what')}: ${parsed.error.issues[0]?.message}`,
          )
        }
        setFormError(null)
        const d = parsed.data
        if (!task) {
          await create.mutateAsync(d)
          return onClose()
        }
        // Send only what changed, so an edit never rewrites fields nobody touched.
        const changes: UpdateTaskInput = {}
        if (d.title !== task.title) changes.title = d.title
        if ((d.notes ?? null) !== task.notes) changes.notes = d.notes ?? null
        if (d.dueAt !== task.dueAt) changes.dueAt = d.dueAt
        if (d.priority !== task.priority) changes.priority = d.priority
        if ((d.assigneeId ?? null) !== (task.assignee?.id ?? null)) changes.assigneeId = d.assigneeId ?? null
        if ((d.patientId ?? null) !== (task.patient?.id ?? null)) changes.patientId = d.patientId ?? null
        if (Object.keys(changes).length) await update.mutateAsync({ taskId: task.id, ...changes })
        onClose()
      }}
      actions={
        <>
          {canDelete && !confirmDelete && (
            <Button plain className="me-auto" onClick={() => setConfirmDelete(true)}>
              <TrashIcon className="fill-red-600!" />
              <span className="text-red-600 dark:text-red-400">{t('reminders.delete')}</span>
            </Button>
          )}
          <Button plain onClick={onClose}>
            {t('record.cancel')}
          </Button>
          <Button type="submit" color="brand" disabled={pending}>
            {t('record.save')}
          </Button>
        </>
      }
    >
      <FieldGroup>
        {confirmDelete && task && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-red-50 px-4 py-3 ring-1 ring-red-200 dark:bg-red-950/40 dark:ring-red-900">
            <p className="flex-1 text-sm/6 font-medium text-red-900 dark:text-red-200">
              {t('reminders.deleteConfirm')}
            </p>
            <Button plain onClick={() => setConfirmDelete(false)}>
              {t('record.cancel')}
            </Button>
            <Button
              color="red"
              disabled={pending}
              onClick={async () => {
                await remove.mutateAsync(task.id)
                onClose()
              }}
            >
              {t('reminders.delete')}
            </Button>
          </div>
        )}
        <Field>
          <Label>{t('reminders.what')}</Label>
          <Input
            name="title"
            defaultValue={task?.title ?? ''}
            placeholder={t('reminders.whatPlaceholder')}
            autoFocus={!task}
            maxLength={200}
          />
        </Field>

        <Field>
          <Label>{t('reminders.due')}</Label>
          <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(QUICK) as (keyof typeof QUICK)[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setDue(toLocalInputValue(QUICK[key]()))}
                className="rounded-full bg-zinc-100 px-3 py-1 text-sm/5 font-medium text-zinc-700 hover:bg-brand-50 hover:text-brand-800 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10"
              >
                {t(`reminders.quick.${key}`)}
              </button>
            ))}
          </div>
        </Field>

        <Field>
          <Label>{t('reminders.assignTo')}</Label>
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">{t('reminders.anyone')}</option>
            {staffOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === me?.id ? t('reminders.me', { name: m.fullName }) : m.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <SwitchField>
          <Label>{t('reminders.highPriority')}</Label>
          <Description>{t('reminders.highPriorityHint')}</Description>
          <Switch color="red" checked={high} onChange={setHigh} />
        </SwitchField>

        <Field>
          <Label>{t('reminders.patient')}</Label>
          {patient ? (
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-white/5">
              <span className="min-w-0 flex-1 truncate text-sm/6 font-medium text-zinc-950 dark:text-white">
                {patient.fullName}
                <span className="ms-2 text-xs/5 font-normal text-zinc-500">{patient.fileNumber}</span>
              </span>
              {!fixedPatient && (
                <Button plain onClick={() => setPatient(null)}>
                  <XMarkIcon />
                  {t('reminders.removePatient')}
                </Button>
              )}
            </div>
          ) : picking ? (
            <PatientPicker
              initialQuery=""
              pending={false}
              canUnlink={false}
              onPick={(_, p) => {
                if (p)
                  setPatient({ id: p.id, fullName: p.fullName, fullNameAr: p.fullNameAr, fileNumber: p.fileNumber })
                setPicking(false)
              }}
            />
          ) : (
            <div className="mt-3">
              <Button outline onClick={() => setPicking(true)}>
                <LinkIcon />
                {t('reminders.addPatient')}
              </Button>
            </div>
          )}
          {!fixedPatient && <Description>{t('reminders.patientOptional')}</Description>}
        </Field>

        <Field>
          <Label>{t('reminders.notes')}</Label>
          <Textarea name="notes" rows={3} defaultValue={task?.notes ?? ''} maxLength={2000} />
        </Field>
        {formError && <RequestError error={new Error(formError)} />}
        <RequestError error={create.error ?? update.error ?? remove.error} />
      </FieldGroup>
    </SidePanel>
  )
}
