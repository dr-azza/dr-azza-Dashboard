import { Card, Dot, ListRow, StatCard, StatusBadge } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Input, InputGroup } from '@/components/catalyst/input'
import { Link } from '@/components/catalyst/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { attention, findPatient, formResponses, patients, reminders, schedule } from '@/data/mock'
import { useLang } from '@/i18n'
import { FEATURES } from '@/lib/features'
import { pregnancyInfo } from '@azza/shared'
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/16/solid'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'

export function OverviewPage() {
  const { t, l, formatDate } = useLang()
  const navigate = useNavigate()
  const today = useMemo(() => new Date(), [])

  const pregnancies = patients
    .map((p) => ({ patient: p, info: pregnancyInfo(p, today) }))
    .filter((x): x is { patient: typeof x.patient; info: NonNullable<typeof x.info> } => x.info !== null)
  const byTrimester = [1, 2, 3].map((tr) => pregnancies.filter((x) => x.info.trimester === tr).length)
  const postpartum = patients.filter((p) => p.caseType === 'postpartum').length
  const dueSoon = pregnancies.filter((x) => x.info.daysToDue <= 30).sort((a, b) => a.info.daysToDue - b.info.daysToDue)

  const done = schedule.filter((s) => s.status === 'done').length
  const inClinic = schedule.filter((s) => s.status === 'checkedIn').length
  const flagged = formResponses.filter((r) => r.status === 'flagged').length
  const fresh = formResponses.filter((r) => r.status === 'flagged' || r.status === 'new').length
  const overdue = patients.filter((p) => p.status === 'overdue').length

  const hour = today.getHours()
  const greeting = hour < 12 ? t('overview.morning') : hour < 17 ? t('overview.afternoon') : t('overview.evening')
  const total = Math.max(1, pregnancies.length)
  // Brand secondary Melon, then plum tints: distinct in lightness, not just hue.
  const tint = ['bg-melon', 'bg-brand-400', 'bg-brand-700']

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <Heading className="headline">{greeting}</Heading>
          <Text className="mt-1">
            {formatDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ·{' '}
            {t('overview.summary', { appts: schedule.length, flags: flagged })}
          </Text>
        </div>
        <div className="flex w-full gap-3 sm:w-auto">
          <InputGroup className="flex-1 sm:w-72">
            <MagnifyingGlassIcon data-slot="icon" />
            <Input
              type="search"
              aria-label={t('common.search')}
              placeholder={t('common.searchPatients')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/patients?q=${encodeURIComponent(e.currentTarget.value)}`)
              }}
            />
          </InputGroup>
          <Button color="brand">
            <PlusIcon />
            {t('common.newPatient')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('overview.statAppointments')}
          value={schedule.length}
          note={t('overview.statAppointmentsNote', { done, inClinic, left: schedule.length - done - inClinic })}
        />
        <StatCard
          label={t('overview.statPregnancies')}
          value={pregnancies.length}
          note={t('overview.statPregnanciesNote', { t1: byTrimester[0], t2: byTrimester[1], t3: byTrimester[2] })}
        />
        <StatCard
          label={t('overview.statOverdue')}
          value={overdue}
          note={t('overview.statOverdueNote')}
          tone="danger"
        />
        <StatCard
          label={t('overview.statResponses')}
          value={fresh}
          note={t('overview.statResponsesNote', { count: flagged })}
          tone="brand"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card
          title={t('overview.schedule')}
          action={
            <Link
              href="/appointments"
              className="text-sm/6 font-medium text-brand-700 hover:text-brand-900 dark:text-brand-300"
            >
              {t('overview.openCalendar')}
            </Link>
          }
          bodyClassName="px-5 pb-2"
        >
          <Table dense className="[--gutter:--spacing(5)]">
            <TableHead>
              <TableRow>
                <TableHeader>{t('overview.colTime')}</TableHeader>
                <TableHeader>{t('overview.colPatient')}</TableHeader>
                <TableHeader className="max-sm:hidden">{t('overview.colType')}</TableHeader>
                <TableHeader>{t('overview.colStatus')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedule.map((s) => {
                const p = findPatient(s.patientId)!
                const info = pregnancyInfo(p, today)
                return (
                  <TableRow key={s.time} href={`/patients?q=${encodeURIComponent(p.name.en)}`} title={l(p.name)}>
                    <TableCell className="font-semibold tabular-nums">{s.time}</TableCell>
                    <TableCell>
                      <div className="font-medium">{l(p.name)}</div>
                      <div className="text-zinc-500 dark:text-zinc-400">
                        {l(s.reason)}
                        {info && ` · ${t('common.ga', { w: info.weeks, d: info.days })}`}
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-500 max-sm:hidden dark:text-zinc-400">
                      {t(`case.${s.type}`)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="appointment" status={s.status} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>

        <Card
          title={t('overview.attention')}
          action={<span className="text-sm/6 text-zinc-500">{t('overview.items', { count: attention.length })}</span>}
          bodyClassName="px-5 pb-2"
        >
          {attention.map((a) => {
            const p = findPatient(a.patientId)!
            return (
              <ListRow key={a.patientId + a.action}>
                <Dot severity={a.severity} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm/6 font-semibold text-zinc-950 dark:text-white">{l(a.title)}</div>
                  <div className="truncate text-sm/5 text-zinc-500 dark:text-zinc-400">
                    {l(p.name)} · {l(a.detail)}
                  </div>
                </div>
                <Button outline href={`/patients?q=${encodeURIComponent(p.name.en)}`}>
                  {t(`common.${a.action}`)}
                </Button>
              </ListRow>
            )
          })}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('overview.byStage')}>
          <div className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full">
            {byTrimester.map((count, i) => (
              <div key={i} className={tint[i]} style={{ width: `${(count / total) * 100}%` }} />
            ))}
          </div>
          <dl className="mt-5 space-y-3 text-sm/6">
            {(['t1', 't2', 't3'] as const).map((key, i) => (
              <div key={key} className="flex items-center gap-2.5">
                <span className={`size-3 rounded-sm ${tint[i]}`} />
                <dt className="flex-1 text-zinc-700 dark:text-zinc-300">{t(`overview.${key}`)}</dt>
                <dd className="font-semibold tabular-nums">{byTrimester[i]}</dd>
              </div>
            ))}
            <div className="flex items-center gap-2.5 border-t border-zinc-950/5 pt-3 dark:border-white/5">
              <dt className="flex-1 text-zinc-500 dark:text-zinc-400">{t('overview.postpartum6w')}</dt>
              <dd className="font-semibold tabular-nums">{postpartum}</dd>
            </div>
          </dl>
        </Card>

        <Card
          title={t('overview.dueSoon')}
          action={
            FEATURES.followUp && (
              <Link
                href="/pregnancy"
                className="text-sm/6 font-medium text-brand-700 hover:text-brand-900 dark:text-brand-300"
              >
                {t('common.viewAll')}
              </Link>
            )
          }
          bodyClassName="px-5 pb-2"
        >
          {dueSoon.map(({ patient, info }) => (
            <ListRow key={patient.id}>
              <div className="w-12 shrink-0 text-center">
                <div className="text-lg/6 font-semibold tabular-nums">{formatDate(info.edd, { day: 'numeric' })}</div>
                <div className="text-xs/4 text-zinc-500">{formatDate(info.edd, { month: 'short' })}</div>
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/patients?q=${encodeURIComponent(patient.name.en)}`}
                  className="text-sm/6 font-medium text-zinc-950 hover:underline dark:text-white"
                >
                  {l(patient.name)}
                </Link>
                <div className="truncate text-sm/5 text-zinc-500 dark:text-zinc-400">
                  {t('overview.gaToday', { ga: t('common.ga', { w: info.weeks, d: info.days }) })}
                  {patient.dueNote && ` · ${l(patient.dueNote)}`}
                </div>
              </div>
            </ListRow>
          ))}
        </Card>

        <Card
          title={t('overview.reminders')}
          action={
            <Link
              href="/reminders"
              className="text-sm/6 font-medium text-brand-700 hover:text-brand-900 dark:text-brand-300"
            >
              {t('common.manage')}
            </Link>
          }
          bodyClassName="px-5 pb-2"
        >
          {reminders.slice(0, 4).map((r, i) => (
            <ListRow key={i}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm/6 font-medium text-zinc-950 dark:text-white">
                  {l(r.message)}: {l(r.to)}
                </div>
                <div className="truncate text-sm/5 text-zinc-500 dark:text-zinc-400">
                  {l(r.when)} · {t(`forms.${r.channel}`)}
                  {r.detail && ` · ${l(r.detail)}`}
                </div>
              </div>
              <StatusBadge kind="delivery" status={r.status} />
            </ListRow>
          ))}
        </Card>
      </div>
    </div>
  )
}
