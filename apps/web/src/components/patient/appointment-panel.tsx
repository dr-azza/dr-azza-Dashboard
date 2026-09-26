import { RequestError, strOrNull, toLocalInputValue } from '@/components/app/form'
import { SidePanel } from '@/components/app/side-panel'
import { Button } from '@/components/catalyst/button'
import { Description, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { Textarea } from '@/components/catalyst/textarea'
import { useLang } from '@/i18n'
import { useCreateAppointment, useStaff, useUpdateAppointment } from '@/lib/queries'
import {
  APPOINTMENT_DURATIONS,
  APPOINTMENT_TYPES,
  type AppointmentDto,
  type AppointmentTypeCode,
  CreateAppointmentSchema,
} from '@azza/shared'
import {
  BeakerIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  PhoneIcon,
  ViewfinderCircleIcon,
} from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useState } from 'react'

export const APPOINTMENT_ICONS: Record<AppointmentTypeCode, typeof PhoneIcon> = {
  VISIT: BuildingOffice2Icon,
  CALL: PhoneIcon,
  SCAN: ViewfinderCircleIcon,
  LAB: BeakerIcon,
  FOLLOW_UP: ClipboardDocumentCheckIcon,
  OTHER: CalendarDaysIcon,
}

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
  const [formError, setFormError] = useState<string | null>(null)
  const pending = create.isPending || update.isPending

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
          startsAt: when ? new Date(when).toISOString() : '',
          durationMinutes: Number(f.get('durationMinutes')),
          assignedToId: strOrNull(f.get('assignedToId')),
          notes: strOrNull(f.get('notes')),
        })
        if (!parsed.success) return setFormError(`${t('record.appt.date')}: ${parsed.error.issues[0]?.message}`)
        setFormError(null)
        if (appointment) {
          await update.mutateAsync({
            appointmentId: appointment.id,
            ...parsed.data,
            assignedToId: parsed.data.assignedToId ?? null,
          })
        } else {
          await create.mutateAsync(parsed.data)
        }
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
            <Input
              type="datetime-local"
              name="startsAt"
              required
              defaultValue={toLocalInputValue(appointment ? new Date(appointment.startsAt) : nextQuarterHour())}
            />
          </Field>
          <Field>
            <Label>{t('record.appt.duration')}</Label>
            <Select name="durationMinutes" defaultValue={String(appointment?.durationMinutes ?? 15)}>
              {APPOINTMENT_DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {t('record.appt.minutes', { count: m })}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field>
          <Label>{t('record.appt.with')}</Label>
          <Select name="assignedToId" defaultValue={appointment?.assignedTo?.id ?? ''}>
            <option value="">{t('record.appt.anyone')}</option>
            {staff.data?.map((m) => (
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
