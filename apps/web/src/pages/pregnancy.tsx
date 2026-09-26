import { PatientAvatar, StatusBadge } from '@/components/app/ui'
import { Heading } from '@/components/catalyst/heading'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { patients } from '@/data/mock'
import { useLang } from '@/i18n'
import { addDays, MILESTONES, pregnancyInfo, weekPercent } from '@azza/shared'
import { useMemo } from 'react'

/** All active pregnancies, sorted by due date, with the next antenatal milestone for each. */
export function PregnancyPage() {
  const { t, l, formatDate } = useLang()
  const today = useMemo(() => new Date(), [])
  const rows = patients
    .map((p) => ({ patient: p, info: pregnancyInfo(p, today) }))
    .filter((x): x is { patient: typeof x.patient; info: NonNullable<typeof x.info> } => x.info !== null)
    .sort((a, b) => a.info.daysToDue - b.info.daysToDue)
  const short = (d: Date) => formatDate(d, { day: 'numeric', month: 'short' })

  return (
    <div className="space-y-6">
      <div>
        <Heading className="headline">{t('nav.pregnancy')}</Heading>
        <Text className="mt-1">
          {t('overview.statPregnancies')}: {rows.length}
        </Text>
      </div>
      <Table className="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
        <TableHead>
          <TableRow>
            <TableHeader>{t('patients.colPatient')}</TableHeader>
            <TableHeader>{t('file.ga')}</TableHeader>
            <TableHeader className="w-1/4 max-md:hidden">{t('file.timeline')}</TableHeader>
            <TableHeader>{t('file.edd')}</TableHeader>
            <TableHeader className="max-lg:hidden">{t('file.tasks')}</TableHeader>
            <TableHeader>{t('patients.colStatus')}</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(({ patient, info }) => {
            const next = MILESTONES.find((m) => m.week > info.weeks)
            return (
              <TableRow key={patient.id} href={`/patients/${patient.id}`} title={l(patient.name)}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <PatientAvatar name={patient.name.en} className="size-8" />
                    <span className="font-medium">{l(patient.name)}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium tabular-nums">
                  {t('common.ga', { w: info.weeks, d: info.days })}
                </TableCell>
                <TableCell className="max-md:hidden">
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className="h-full rounded-full bg-brand-600"
                      style={{ width: `${weekPercent(info.weeks + info.days / 7)}%` }}
                    />
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">{short(info.edd)}</TableCell>
                <TableCell className="text-zinc-500 max-lg:hidden dark:text-zinc-400">
                  {next
                    ? `${l(next.name)} · ${short(addDays(info.lmp, next.week * 7))}`
                    : patient.dueNote
                      ? l(patient.dueNote)
                      : '—'}
                </TableCell>
                <TableCell>
                  <StatusBadge kind="patient" status={patient.status} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
