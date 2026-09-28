import { RequestError } from '@/components/app/form'
import { Card } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Text } from '@/components/catalyst/text'
import { ReminderGroups, ReminderRow } from '@/components/reminders/reminder-list'
import { ReminderPanel } from '@/components/reminders/reminder-panel'
import { useLang } from '@/i18n'
import { useTasks } from '@/lib/queries'
import type { PatientDto, TaskDto } from '@azza/shared'
import { PlusIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'

/** Reminders about this patient, whoever they're assigned to. */
export function RemindersTab({ patient }: { patient: PatientDto }) {
  const { t } = useLang()
  const open = useTasks({ status: 'open', patientId: patient.id })
  const done = useTasks({ status: 'done', patientId: patient.id, limit: 20 })
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<TaskDto | null>(null)
  const ref = {
    id: patient.id,
    fullName: patient.fullName,
    fullNameAr: patient.fullNameAr,
    fileNumber: patient.fileNumber,
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button color="brand" onClick={() => setAdding(true)}>
          <PlusIcon />
          {t('reminders.new')}
        </Button>
      </div>
      <RequestError error={open.error ?? done.error} />
      {open.isSuccess && open.data.items.length === 0 && (
        <div className="rounded-xl py-10 text-center ring-1 ring-zinc-950/8 dark:ring-white/10">
          <Text>{t('reminders.nonePatient')}</Text>
        </div>
      )}
      <ReminderGroups tasks={open.data?.items ?? []} onOpen={setEditing} showPatient={false} />
      {!!done.data?.items.length && (
        <Card title={t('reminders.tabs.done')} bodyClassName="pb-1">
          <ul className="divide-y divide-zinc-950/5 border-t border-zinc-950/5 dark:divide-white/5 dark:border-white/5">
            {done.data.items.map((task) => (
              <ReminderRow key={task.id} task={task} bucket={null} onOpen={setEditing} showPatient={false} />
            ))}
          </ul>
        </Card>
      )}
      {adding && <ReminderPanel open patient={ref} onClose={() => setAdding(false)} />}
      {editing && <ReminderPanel key={editing.id} open task={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
