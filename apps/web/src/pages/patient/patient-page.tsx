import { formatPhone, RequestError, useFormat } from '@/components/app/form'
import { PatientAvatar, ToneBadge } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Link } from '@/components/catalyst/link'
import { Text } from '@/components/catalyst/text'
import { AppointmentPanel } from '@/components/patient/appointment-panel'
import { APPOINTMENT_ICONS, statusKey, statusTone } from '@/components/patient/labels'
import { useLang } from '@/i18n'
import { ApiError } from '@/lib/api'
import { usePatient } from '@/lib/queries'
import { FEATURES } from '@/lib/features'
import type { PatientDto } from '@azza/shared'
import * as Headless from '@headlessui/react'
import { CalendarDaysIcon, ChevronLeftIcon, PhoneIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { ActivityTab } from './activity-tab'
import { AppointmentsTab } from './appointments-tab'
import { FilesTab } from './files-tab'
import { FollowUpTab } from './follow-up-tab'
import { HistoryTab } from './history-tab'
import { OverviewTab } from './overview-tab'
import { PaymentsTab } from './payments-tab'
import { PrescriptionsTab } from './prescriptions-tab'

const ALL_TABS = [
  'overview',
  'history',
  'followUp',
  'appointments',
  'prescriptions',
  'payments',
  'files',
  'activity',
] as const
type Tab = (typeof ALL_TABS)[number]
const TABS: readonly Tab[] = ALL_TABS.filter((key) => key !== 'followUp' || FEATURES.followUp)

export function PatientPage() {
  const { id = '' } = useParams()
  const { t, l } = useLang()
  const fmt = useFormat()
  const [params, setParams] = useSearchParams()
  const patient = usePatient(id)
  const [booking, setBooking] = useState(false)
  const tab = TABS.find((key) => key === params.get('tab')) ?? 'overview'

  if (patient.isPending) return <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/5" />
  if (patient.isError) {
    const missing = patient.error instanceof ApiError && patient.error.status === 404
    return (
      <div className="space-y-4 py-16 text-center">
        <Text>{missing ? t('file.notFound') : t('record.loadError')}</Text>
        {!missing && <RequestError error={patient.error} className="mx-auto max-w-md text-start" />}
        <div className="flex justify-center gap-2">
          {!missing && (
            <Button outline onClick={() => patient.refetch()}>
              {t('record.retry')}
            </Button>
          )}
          <Button href="/patients" plain>
            {t('file.backToPatients')}
          </Button>
        </div>
      </div>
    )
  }

  const p = patient.data
  const panel = (key: Tab) => {
    switch (key) {
      case 'overview':
        return <OverviewTab patientId={id} />
      case 'history':
        return <HistoryTab patientId={id} />
      case 'followUp':
        return <FollowUpTab patientId={id} />
      case 'appointments':
        return <AppointmentsTab patientId={id} />
      case 'prescriptions':
        return <PrescriptionsTab patient={p} />
      case 'payments':
        return <PaymentsTab patientId={id} />
      case 'files':
        return <FilesTab patientId={id} />
      case 'activity':
        return <ActivityTab patientId={id} />
    }
  }
  const selectTab = (key: Tab) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', key)
        return next
      },
      { replace: true },
    )

  return (
    <div className="space-y-6">
      <Link
        href="/patients"
        className="inline-flex items-center gap-1 text-sm/6 font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
      >
        <ChevronLeftIcon className="size-4 fill-zinc-400 rtl:rotate-180" />
        {t('nav.patients')}
      </Link>

      <section className="rounded-xl bg-white p-5 ring-1 ring-zinc-950/8 sm:p-6 dark:bg-zinc-900 dark:ring-white/10">
        <div className="flex flex-wrap items-start gap-4">
          <PatientAvatar name={p.fullName} className="size-14" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <Heading>{p.fullName}</Heading>
              {p.fullNameAr && (
                <span lang="ar" className="text-lg/7 text-zinc-500 dark:text-zinc-400">
                  {p.fullNameAr}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm/6 text-zinc-500 dark:text-zinc-400">
              {p.age != null && <span>{t('record.years', { age: p.age })}</span>}
              <span aria-hidden="true">·</span>
              <span>{t('file.fileNo', { file: p.fileNumber })}</span>
              <span aria-hidden="true">·</span>
              <a href={`tel:${p.phone}`} dir="ltr" className="hover:text-zinc-950 dark:hover:text-white">
                {formatPhone(p.phone)}
              </a>
              <ToneBadge tone={statusTone[p.status]}>{t(statusKey(p.status))}</ToneBadge>
              <ToneBadge tone="neutral">{l(p.caseType.name)}</ToneBadge>
              {p.activePregnancy && (
                <ToneBadge tone="info">
                  {t('common.ga', { w: p.activePregnancy.weeks, d: p.activePregnancy.days })}
                </ToneBadge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button outline href={`tel:${p.phone}`}>
              <PhoneIcon />
              {t('common.call')}
            </Button>
            <Button color="brand" onClick={() => setBooking(true)}>
              <CalendarDaysIcon />
              {t('record.appt.new')}
            </Button>
          </div>
        </div>

        {p.nextAppointment && (
          <NextAppointment appointment={p.nextAppointment} onOpen={() => selectTab('appointments')} />
        )}

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ['historyEntries', p.totals.historyEntries],
              ['prescriptions', p.totals.prescriptions],
              ['files', p.totals.files],
              ['paid', fmt.money(p.totals.paid)],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="rounded-lg bg-zinc-50 px-4 py-3 dark:bg-white/5">
              <dt className="text-xs/5 text-zinc-500 dark:text-zinc-400">{t(`record.overview.totals.${key}`)}</dt>
              <dd className="mt-0.5 text-lg/7 font-semibold text-zinc-950 tabular-nums dark:text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Headless.TabGroup selectedIndex={TABS.indexOf(tab)} onChange={(i) => selectTab(TABS[i])}>
        <Headless.TabList className="flex gap-1 overflow-x-auto border-b border-zinc-950/10 dark:border-white/10">
          {TABS.map((key) => (
            <Headless.Tab
              key={key}
              className="-mb-px shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm/6 font-medium whitespace-nowrap text-zinc-500 focus:outline-hidden data-focus:outline-2 data-focus:outline-brand-600 data-hover:text-zinc-950 data-selected:border-brand-600 data-selected:text-brand-700 dark:text-zinc-400 dark:data-hover:text-white dark:data-selected:text-brand-300"
            >
              {t(`record.tabs.${key}`)}
            </Headless.Tab>
          ))}
        </Headless.TabList>
        <Headless.TabPanels className="pt-6">
          {TABS.map((key) => (
            <Headless.TabPanel key={key}>{panel(key)}</Headless.TabPanel>
          ))}
        </Headless.TabPanels>
      </Headless.TabGroup>
      {booking && <AppointmentPanel open patientId={id} onClose={() => setBooking(false)} />}
    </div>
  )
}

function NextAppointment({
  appointment: a,
  onOpen,
}: {
  appointment: NonNullable<PatientDto['nextAppointment']>
  onOpen: () => void
}) {
  const { t } = useLang()
  const fmt = useFormat()
  const Icon = APPOINTMENT_ICONS[a.type]
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm/6 font-medium text-brand-800 ring-1 ring-brand-200 hover:bg-brand-100 dark:bg-brand-950/50 dark:text-brand-200 dark:ring-brand-900"
    >
      <Icon className="size-4 shrink-0" />
      {t('record.appt.next', { what: a.title || t(`record.appt.types.${a.type}`), when: fmt.dayTime(a.startsAt) })}
    </button>
  )
}
