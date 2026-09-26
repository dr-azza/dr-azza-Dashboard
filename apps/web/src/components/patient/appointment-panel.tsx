import { RequestError, strOrNull, toLocalInputValue } from '@/components/app/form'
import { SidePanel } from '@/components/app/side-panel'
import { Button } from '@/components/catalyst/button'
import { Description, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { Textarea } from '@/components/catalyst/textarea'
import { APPOINTMENT_ICONS } from '@/components/patient/labels'
import { useLang } from '@/i18n'
import { useCreateAppointment, useStaff, useUpdateAppointment } from '@/lib/queries'
import {
  APPOINTMENT_DURATIONS,
  APPOINTMENT_TYPES,
  type AppointmentDto,
  type AppointmentTypeCode,
  CreateAppointmentSchema,
  type UpdateAppointmentInput,
} from '@azza/shared'
import clsx from 'clsx'
import { useState } from 'react'

/** Round up to the next quarter hour, a sensible default start time. */
function nextQuarterHour() {
  const d = new Date()
  d.setMinutes(Math.ceil((d.getMinutes() + 1) / 15) * 15, 0, 0)
  return d
}

/** Book an appointment (no `appointment`) or edit/reschedule one. */
export function AppointmentPanel({
  patientId,
  appointment,
  open,
  onClose,
}: {
  patientId: string
  appointment?: AppointmentDto
  open: boolean
  onClose: () => void
}) {
  const { t } = useLang()
  const staff = useStaff()
  const create = useCreateAppointment(patientId)
  const update = useUpdateAppointment(patientId)
  const [type, setType] = useState<AppointmentTypeCode>(appointment?.type ?? 'VISIT')
  // Controlled, so the current assignee stays selected while the staff list is still loading.
  const [assignee, setAssignee] = useState(appointment?.assignedTo?.id ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const pending = create.isPending || update.isPending

  const [initialStart] = useState(() =>
    toLocalInputValue(appointment ? new Date(appointment.startsAt) : nextQuarterHour()),
  )
  const initialDuration = appointment?.durationMinutes ?? 15
  // Keep a duration booked outside the presets (e.g. 25 or 120 min) selectable instead of losing it.
  const durations = [...new Set<number>([...APPOINTMENT_DURATIONS, initialDuration])].sort((a, b) => a - b)
  // The assignee may no longer be listed (deactivated); still show them rather than "Not assigned".
  const current = appointment?.assignedTo
  const staffOptions = [
    ...(staff.data ?? []),
    ...(current && !staff.data?.some((m) => m.id === current.id) ? [current] : []),
  ]
  const fieldLabel: Record<string, string> = {
    type: t('record.appt.type'),
    title: t('record.appt.title'),
    startsAt: t('record.appt.date'),
    durationMinutes: t('record.appt.duration'),
    assignedToId: t('record.appt.with'),
    notes: t('record.appt.notes'),
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={appointment ? t('record.appt.edit') : t('record.appt.new')}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault()
        const f = new FormData(event.currentTarget)
        const when = String(f.get('startsAt') ?? '')
        const parsed = CreateAppointmentSchema.safeParse({
          type,
          title: strOrNull(f.get('title')),
          // An untouched start keeps the stored instant exactly (the input has no seconds).
          startsAt:
            appointment && when === initialStart ? appointment.startsAt : when ? new Date(when).toISOString() : '',
          durationMinutes: Number(f.get('durationMinutes')),
          assignedToId: assignee || null,
          notes: strOrNull(f.get('notes')),
        })
        if (!parsed.success) {
          const issue = parsed.error.issues[0]
          const field = fieldLabel[String(issue?.path[0])]
          return setFormError(field ? `${field}: ${issue?.message}` : (issue?.message ?? ''))
        }
        setFormError(null)

        if (!appointment) {
          await create.mutateAsync(parsed.data)
          return onClose()
        }
        // Send only what changed, so an edit never rewrites fields nobody touched.
        const d = parsed.data
        const changes: UpdateAppointmentInput = {}
        if (d.type !== appointment.type) changes.type = d.type
        if ((d.title ?? null) !== appointment.title) changes.title = d.title ?? null
        if (d.startsAt !== appointment.startsAt) changes.startsAt = d.startsAt
        if (d.durationMinutes !== appointment.durationMinutes) changes.durationMinutes = d.durationMinutes
        if ((d.assignedToId ?? null) !== (current?.id ?? null)) changes.assignedToId = d.assignedToId ?? null
        if ((d.notes ?? null) !== appointment.notes) changes.notes = d.notes ?? null
        if (Object.keys(changes).length) await update.mutateAsync({ appointmentId: appointment.id, ...changes })
        onClose()
      }}
      actions={
        <>
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
        <Field>
          <Label>{t('record.appt.type')}</Label>
          {/* Big, tappable choices: the type is the first decision and the most common one. */}
          <div
            className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
            role="radiogroup"
            aria-label={t('record.appt.type')}
          >
            {APPOINTMENT_TYPES.map((code) => {
              const Icon = APPOINTMENT_ICONS[code]
              const active = type === code
              return (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setType(code)}
                  className={clsx(
                    'flex items-center gap-2 rounded-lg px-3 py-2.5 text-start text-sm/5 font-medium ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-brand-600',
                    active
                      ? 'bg-brand-50 text-brand-800 ring-2 ring-brand-600 dark:bg-brand-950/50 dark:text-brand-200'
                      : 'bg-white text-zinc-700 ring-zinc-950/10 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {t(`record.appt.types.${code}`)}
                </button>
              )
            })}
          </div>
        </Field>
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <Field>
            <Label>{t('record.appt.date')}</Label>
            <Input type="datetime-local" name="startsAt" required defaultValue={initialStart} />
          </Field>
          <Field>
            <Label>{t('record.appt.duration')}</Label>
            <Select name="durationMinutes" defaultValue={String(initialDuration)}>
              {durations.map((m) => (
                <option key={m} value={m}>
                  {t('record.appt.minutes', { count: m })}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field>
          <Label>{t('record.appt.with')}</Label>
          <Select name="assignedToId" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">{t('record.appt.anyone')}</option>
            {staffOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label>{t('record.appt.title')}</Label>
          <Input name="title" defaultValue={appointment?.title ?? ''} />
          <Description>{t('record.appt.titleHint')}</Description>
        </Field>
        <Field>
          <Label>{t('record.appt.notes')}</Label>
          <Textarea name="notes" rows={3} defaultValue={appointment?.notes ?? ''} />
        </Field>
        {formError && <RequestError error={new Error(formError)} />}
        <RequestError error={create.error ?? update.error} />
      </FieldGroup>
    </SidePanel>
  )
}
