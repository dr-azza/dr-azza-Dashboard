import { RequestError, useFormat } from '@/components/app/form'
import { SidePanel } from '@/components/app/side-panel'
import { Card, ToneBadge } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Field, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Text } from '@/components/catalyst/text'
import { AppointmentPanel } from '@/components/patient/appointment-panel'
import { APPOINTMENT_ICONS, appointmentTone } from '@/components/patient/labels'
import { useLang } from '@/i18n'
import { usePatientAppointments, useUpdateAppointment } from '@/lib/queries'
import type { AppointmentDto, AppointmentStatusCode } from '@azza/shared'
import { PlusIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useState } from 'react'

export function AppointmentsTab({ patientId }: { patientId: string }) {
  const { t } = useLang()
  const list = usePatientAppointments(patientId)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button color="brand" onClick={() => setCreating(true)}>
          <PlusIcon />
          {t('record.appt.new')}
        </Button>
      </div>
      <RequestError error={list.error} />
      <Card title={t('record.appt.upcoming')} bodyClassName="px-5 pb-2">
        {list.data?.upcoming.length === 0 && <Text className="pb-3">{t('record.appt.noneUpcoming')}</Text>}
        <ul className="divide-y divide-zinc-950/5 dark:divide-white/5">
          {list.data?.upcoming.map((a) => (
            <AppointmentRow key={a.id} patientId={patientId} appointment={a} />
          ))}
        </ul>
      </Card>
      {!!list.data?.past.length && (
        <Card title={t('record.appt.past')} bodyClassName="px-5 pb-2">
          <ul className="divide-y divide-zinc-950/5 dark:divide-white/5">
            {list.data.past.map((a) => (
              <AppointmentRow key={a.id} patientId={patientId} appointment={a} />
            ))}
          </ul>
        </Card>
      )}
      {creating && <AppointmentPanel open patientId={patientId} onClose={() => setCreating(false)} />}
    </div>
  )
}

function AppointmentRow({ patientId, appointment: a }: { patientId: string; appointment: AppointmentDto }) {
  const { t } = useLang()
  const fmt = useFormat()
  const update = useUpdateAppointment(patientId)
  const [editing, setEditing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const Icon = APPOINTMENT_ICONS[a.type]
  const scheduled = a.status === 'SCHEDULED'
  const start = new Date(a.startsAt).getTime()
  const end = new Date(a.endsAt).getTime()
  const now = Date.now()
  // Open appointments: under way during their slot, past due once the slot ends without being closed.
  const overdue = scheduled && end <= now
  const inProgress = scheduled && start <= now && now < end
  const setStatus = (status: AppointmentStatusCode) => update.mutate({ appointmentId: a.id, status })

  return (
    <li className="flex flex-wrap items-start gap-3 py-3">
      <span
        className={clsx(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          scheduled
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
            : 'bg-zinc-100 text-zinc-500 dark:bg-white/5',
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={clsx(
            'text-sm/6 font-semibold',
            a.status === 'CANCELLED' ? 'text-zinc-400 line-through' : 'text-zinc-950 dark:text-white',
          )}
        >
          {a.title || t(`record.appt.types.${a.type}`)}
        </div>
        <div className="text-sm/6 text-zinc-600 dark:text-zinc-400">
          {fmt.dayTime(a.startsAt)} · {t('record.appt.minutes', { count: a.durationMinutes })}
          {a.assignedTo && ` · ${t('record.appt.with')} ${a.assignedTo.fullName}`}
        </div>
        {a.notes && <p className="text-sm/6 whitespace-pre-line text-zinc-500">{a.notes}</p>}
        {a.cancelReason && <p className="text-xs/5 text-zinc-500">{a.cancelReason}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {overdue ? (
          <ToneBadge tone="warn">{t('record.appt.overdue')}</ToneBadge>
        ) : inProgress ? (
          <ToneBadge tone="ok">{t('record.appt.inProgress')}</ToneBadge>
        ) : (
          <ToneBadge tone={appointmentTone[a.status]}>{t(`record.appt.statuses.${a.status}`)}</ToneBadge>
        )}
        {scheduled ? (
          <>
            <Button plain onClick={() => setStatus('COMPLETED')} disabled={update.isPending}>
              {t('record.appt.markDone')}
            </Button>
            <Button plain onClick={() => setStatus('NO_SHOW')} disabled={update.isPending}>
              {t('record.appt.noShow')}
            </Button>
            <Button plain onClick={() => setEditing(true)}>
              {t('record.appt.reschedule')}
            </Button>
            <Button plain onClick={() => setCancelling(true)}>
              {t('record.cancel')}
            </Button>
          </>
        ) : (
          <Button plain onClick={() => setStatus('SCHEDULED')} disabled={update.isPending}>
            {t('record.appt.reopen')}
          </Button>
        )}
      </div>
      {update.error && <RequestError error={update.error} className="w-full" />}
      {editing && <AppointmentPanel open patientId={patientId} appointment={a} onClose={() => setEditing(false)} />}
      <SidePanel
        open={cancelling}
        onClose={setCancelling}
        size="md"
        title={t('record.appt.cancel')}
        description={`${a.title || t(`record.appt.types.${a.type}`)} · ${fmt.dayTime(a.startsAt)}`}
        onSubmit={async (event) => {
          event.preventDefault()
          const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim()
          await update.mutateAsync({ appointmentId: a.id, status: 'CANCELLED', cancelReason: reason || null })
          setCancelling(false)
        }}
        actions={
          <>
            <Button plain onClick={() => setCancelling(false)}>
              {t('record.cancel')}
            </Button>
            <Button type="submit" color="red" disabled={update.isPending}>
              {t('record.appt.cancel')}
            </Button>
          </>
        }
      >
        <Field>
          <Label>
            {t('record.appt.cancelReason')} <span className="text-zinc-400">({t('record.optional')})</span>
          </Label>
          <Input name="reason" autoFocus />
        </Field>
      </SidePanel>
    </li>
  )
}
