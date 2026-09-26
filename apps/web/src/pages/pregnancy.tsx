import { RequestError, useFormat } from '@/components/app/form'
import { PatientAvatar, ToneBadge } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { statusKey, statusTone } from '@/components/patient/labels'
import { useLang } from '@/i18n'
import { usePatients } from '@/lib/queries'
import { addDays, MILESTONES, parseDay, weekPercent } from '@azza/shared'

/** All active pregnancies, sorted by due date, with the next antenatal milestone for each. */
export function PregnancyPage() {
  const { t, l, formatDate } = useLang()
  const fmt = useFormat()
  const patients = usePatients({ caseType: 'PREGNANCY' })
  const rows = (patients.data?.pages.flatMap((p) => p.items) ?? [])
    .filter((p) => p.activePregnancy)
    .sort((a, b) => a.activePregnancy!.edd.localeCompare(b.activePregnancy!.edd))
  const short = (d: Date) => formatDate(d, { day: 'numeric', month: 'short' })

  return (
    <div className="space-y-6">
      <div>
        <Heading className="headline">{t('nav.pregnancy')}</Heading>
        <Text className="mt-1">
          {t('overview.statPregnancies')}: {rows.length}
        </Text>
      </div>
      <RequestError error={patients.error} />
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
          {rows.map((p) => {
            const preg = p.activePregnancy!
            const next = MILESTONES.find((m) => m.week > preg.weeks)
            return (
              <TableRow key={p.id} href={`/patients/${p.id}?tab=followUp`} title={p.fullName}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <PatientAvatar name={p.fullName} className="size-8" />
                    <span className="font-medium">{p.fullName}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium tabular-nums">
                  {t('common.ga', { w: preg.weeks, d: preg.days })}
                </TableCell>
                <TableCell className="max-md:hidden">
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className="h-full rounded-full bg-brand-600"
                      style={{ width: `${weekPercent(preg.weeks + preg.days / 7)}%` }}
                    />
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">{fmt.day(preg.edd)}</TableCell>
                <TableCell className="text-zinc-500 max-lg:hidden dark:text-zinc-400">
                  {next ? `${l(next.name)} · ${short(addDays(parseDay(preg.lmp), next.week * 7))}` : '—'}
                </TableCell>
                <TableCell>
                  <ToneBadge tone={statusTone[p.status]}>{t(statusKey(p.status))}</ToneBadge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {patients.hasNextPage && (
        <div className="flex justify-center">
          <Button outline onClick={() => patients.fetchNextPage()}>
            {t('record.loadMore')}
          </Button>
        </div>
      )}
    </div>
  )
}
