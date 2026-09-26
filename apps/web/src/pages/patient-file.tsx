import { PregnancyTimeline } from '@/components/app/pregnancy-timeline'
import { Card, ListRow, PatientAvatar, StatusBadge, ToneBadge } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Link } from '@/components/catalyst/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { findPatient } from '@/data/mock'
import { useLang } from '@/i18n'
import { addDays, pregnancyInfo } from '@azza/shared'
import { ChevronLeftIcon, ExclamationTriangleIcon, PhoneIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useMemo } from 'react'
import { useParams } from 'react-router'

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-4 py-3 dark:bg-white/5">
      <dt className="text-xs/5 text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-base/6 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white">{value}</dd>
    </div>
  )
}

export function PatientFilePage() {
  const { id = '' } = useParams()
  const { t, l, formatDate } = useLang()
  const today = useMemo(() => new Date(), [])
  const patient = findPatient(id)

  if (!patient) {
    return (
      <div className="py-20 text-center">
        <Text>{t('file.notFound')}</Text>
        <Button href="/patients" outline className="mt-4">
          {t('file.backToPatients')}
        </Button>
      </div>
    )
  }

  const info = pregnancyInfo(patient, today)
  const long = (d: Date) => formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' })
  const name = l(patient.name)

  return (
    <div className="space-y-6">
      <Link
        href="/patients"
        className="inline-flex items-center gap-1 text-sm/6 font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
      >
        <ChevronLeftIcon className="size-4 fill-zinc-400 rtl:rotate-180" />
        {t('nav.patients')}
      </Link>

      {patient.alert && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-4 rounded-xl bg-red-50 px-5 py-4 text-red-900 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900"
        >
          <ExclamationTriangleIcon className="size-5 shrink-0 fill-red-600" />
          <div className="min-w-0 flex-1">
            <div className="text-sm/6 font-semibold">
              {l(patient.alert.title)}
              {info && ` · ${t('common.ga', { w: info.weeks, d: info.days })}`}
            </div>
            <div className="text-sm/6">{l(patient.alert.body)}</div>
          </div>
          <Button outline href="/forms">
            {t('file.openResponse')}
          </Button>
          <Button color="red" href={`tel:${patient.phone.replace(/[^\d+]/g, '')}`}>
            <PhoneIcon />
            {t('file.callPatient')}
          </Button>
        </div>
      )}

      <Card bodyClassName="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <PatientAvatar name={patient.name.en} className="size-14" />
          <div className="min-w-0 flex-1">
            <Heading>{name}</Heading>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm/6 text-zinc-500 dark:text-zinc-400">
              <span>{t('file.years', { age: patient.age })}</span>
              <span aria-hidden="true">·</span>
              <span>{t('file.fileNo', { file: patient.file })}</span>
              <span aria-hidden="true">·</span>
              <span dir="ltr">{patient.phone}</span>
              <StatusBadge kind="patient" status={patient.status} />
              {patient.tags?.map((tag) => (
                <ToneBadge key={tag.label.en} tone={tag.tone}>
                  {l(tag.label)}
                </ToneBadge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button outline>{t('file.addNote')}</Button>
            <Button outline>{t('file.scheduleVisit')}</Button>
            <Button color="brand" href="/forms">
              {t('file.sendForm')}
            </Button>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {info ? (
            <>
              <Fact label={t('file.lmp')} value={long(info.lmp)} />
              <Fact label={t('file.edd')} value={long(info.edd)} />
              <Fact label={t('file.ga')} value={t('file.gaLong', { w: info.weeks, d: info.days })} />
            </>
          ) : (
            <Fact label={t('patients.colStage')} value={patient.stage ? l(patient.stage) : t(`case.${patient.caseType}`)} />
          )}
          <Fact label={t('file.nextVisit')} value={patient.nextVisit ? l(patient.nextVisit) : t('patients.notBooked')} />
        </dl>
      </Card>

      {info ? (
        <Card
          title={t('file.timeline')}
          action={
            <span className="text-sm/6 text-zinc-500 dark:text-zinc-400">
              {t('file.weekOf', { w: info.weeks, days: info.daysToDue })}
            </span>
          }
          bodyClassName="overflow-x-auto px-5 pt-2 pb-5"
        >
          <div className="min-w-[640px] px-10">
            <PregnancyTimeline lmp={info.lmp} today={today} />
          </div>
        </Card>
      ) : (
        <Text>{t('file.noPregnancy')}</Text>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {patient.visits && (
            <Card title={t('file.visits')} action={<Button outline>{t('file.addVisit')}</Button>} bodyClassName="px-5 pb-2">
              <Table dense className="[--gutter:--spacing(5)]">
                <TableHead>
                  <TableRow>
                    <TableHeader>{t('file.colDate')}</TableHeader>
                    <TableHeader>{t('file.colWeek')}</TableHeader>
                    <TableHeader>{t('file.colWeight')}</TableHeader>
                    <TableHeader>{t('file.colBp')}</TableHeader>
                    <TableHeader className="max-md:hidden">{t('file.colFundal')}</TableHeader>
                    <TableHeader className="max-md:hidden">{t('file.colFhr')}</TableHeader>
                    <TableHeader className="max-lg:hidden">{t('file.colNotes')}</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {patient.visits.map((v) => {
                    const date = addDays(today, -v.daysAgo)
                    const gaDays = (patient.gaDays ?? 0) - v.daysAgo
                    return (
                      <TableRow key={v.daysAgo}>
                        <TableCell className="font-medium tabular-nums">{long(date)}</TableCell>
                        <TableCell className="tabular-nums">
                          {Math.floor(gaDays / 7)}+{gaDays % 7}
                        </TableCell>
                        <TableCell className="tabular-nums">{v.weightKg ? `${v.weightKg.toFixed(1)} kg` : '—'}</TableCell>
                        <TableCell className={clsx('tabular-nums', v.bpHigh && 'font-bold text-red-700 dark:text-red-400')} dir="ltr">
                          {v.bp ?? '—'}
                        </TableCell>
                        <TableCell className="tabular-nums max-md:hidden">{v.fundalCm ? `${v.fundalCm} cm` : '—'}</TableCell>
                        <TableCell className="tabular-nums max-md:hidden">{v.fhr ?? '—'}</TableCell>
                        <TableCell className="text-zinc-500 max-lg:hidden dark:text-zinc-400">{l(v.note)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
          )}

          {patient.labs && (
            <Card title={t('file.labs')} action={<Button outline>{t('file.upload')}</Button>} bodyClassName="px-5 pb-2">
              {patient.labs.map((lab) => (
                <ListRow key={lab.name.en}>
                  <span className="flex-1 text-sm/6 font-medium text-zinc-950 dark:text-white">{l(lab.name)}</span>
                  <span className="text-sm/6 text-zinc-500 max-sm:hidden">{l(lab.date)}</span>
                  <ToneBadge tone={lab.tone}>{l(lab.result)}</ToneBadge>
                </ListRow>
              ))}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {patient.tasks && (
            <Card title={t('file.tasks')} bodyClassName="px-5 pb-2">
              {patient.tasks.map((task) => (
                <ListRow key={task.title.en} className="items-start">
                  <div
                    className={clsx(
                      'w-16 shrink-0 text-sm/6 font-semibold',
                      task.urgent ? 'text-red-700 dark:text-red-400' : 'text-zinc-950 dark:text-white'
                    )}
                  >
                    {l(task.when)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm/6 font-medium text-zinc-950 dark:text-white">{l(task.title)}</div>
                    <div className="text-sm/5 text-zinc-500 dark:text-zinc-400">{l(task.meta)}</div>
                  </div>
                </ListRow>
              ))}
            </Card>
          )}

          {patient.responses && (
            <Card title={t('file.responses')} bodyClassName="px-5 pb-2">
              {patient.responses.map((r) => (
                <ListRow key={r.when.en}>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm/6 font-medium text-zinc-950 dark:text-white">
                      {l(r.form)} · {l(r.when)}
                    </div>
                    <div className={clsx('text-sm/5', r.status === 'flagged' ? 'text-red-700 dark:text-red-400' : 'text-zinc-500')}>
                      {l(r.summary)}
                    </div>
                  </div>
                  <StatusBadge kind="response" status={r.status} />
                </ListRow>
              ))}
            </Card>
          )}

          {patient.note && (
            <Card title={t('file.notes')}>
              <p className="text-sm/6 text-zinc-700 dark:text-zinc-300">{l(patient.note.text)}</p>
              <p className="mt-2 text-xs/5 text-zinc-500">
                {l(patient.note.by)} · {l(patient.note.date)}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
