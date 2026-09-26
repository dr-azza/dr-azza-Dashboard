import { StatusBadge } from '@/components/app/ui'
import { Heading } from '@/components/catalyst/heading'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { findPatient, reminders, schedule } from '@/data/mock'
import { useLang } from '@/i18n'

export function RemindersPage() {
  const { t, l } = useLang()
  return (
    <div className="space-y-6">
      <div>
        <Heading className="headline">{t('reminders.title')}</Heading>
        <Text className="mt-1">{t('reminders.subtitle')}</Text>
      </div>
      <Table className="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
        <TableHead>
          <TableRow>
            <TableHeader>{t('reminders.colWhen')}</TableHeader>
            <TableHeader>{t('reminders.colMessage')}</TableHeader>
            <TableHeader>{t('reminders.colTo')}</TableHeader>
            <TableHeader className="max-sm:hidden">{t('reminders.colChannel')}</TableHeader>
            <TableHeader>{t('reminders.colStatus')}</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {reminders.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="tabular-nums">{l(r.when)}</TableCell>
              <TableCell className="font-medium">
                {l(r.message)}
                {r.detail && <div className="text-xs/5 font-normal text-red-700 dark:text-red-400">{l(r.detail)}</div>}
              </TableCell>
              <TableCell>{l(r.to)}</TableCell>
              <TableCell className="text-zinc-500 max-sm:hidden">{t(`forms.${r.channel}`)}</TableCell>
              <TableCell>
                <StatusBadge kind="delivery" status={r.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function AppointmentsPage() {
  const { t, l } = useLang()
  return (
    <div className="space-y-6">
      <div>
        <Heading className="headline">{t('appointments.title')}</Heading>
        <Text className="mt-1">{t('appointments.subtitle')}</Text>
      </div>
      <Table className="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
        <TableHead>
          <TableRow>
            <TableHeader>{t('overview.colTime')}</TableHeader>
            <TableHeader>{t('overview.colPatient')}</TableHeader>
            <TableHeader>{t('overview.colType')}</TableHeader>
            <TableHeader>{t('overview.colStatus')}</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {schedule.map((s) => {
            const p = findPatient(s.patientId)!
            return (
              <TableRow key={s.time} href={`/patients/${p.id}`} title={l(p.name)}>
                <TableCell className="font-semibold tabular-nums">{s.time}</TableCell>
                <TableCell>
                  <div className="font-medium">{l(p.name)}</div>
                  <div className="text-zinc-500">{l(s.reason)}</div>
                </TableCell>
                <TableCell className="text-zinc-500">{t(`case.${s.type}`)}</TableCell>
                <TableCell>
                  <StatusBadge kind="appointment" status={s.status} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function SettingsPage() {
  const { t } = useLang()
  return (
    <div className="space-y-2">
      <Heading className="headline">{t('settings.title')}</Heading>
      <Text>{t('common.comingSoon')}</Text>
    </div>
  )
}
