import { RequestError, useFormat } from '@/components/app/form'
import { ToneBadge } from '@/components/app/ui'
import { Heading } from '@/components/catalyst/heading'
import { Link } from '@/components/catalyst/link'
import { Select } from '@/components/catalyst/select'
import { Text } from '@/components/catalyst/text'
import { APPOINTMENT_ICONS, appointmentTone } from '@/components/patient/labels'
import { useLang } from '@/i18n'
import { useClinicAppointments, useStaff } from '@/lib/queries'
import type { AppointmentDto } from '@azza/shared'
import clsx from 'clsx'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'

const DAYS = 14

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** The clinic's schedule for the next two weeks, grouped by day, optionally for one staff member. */
export function AppointmentsPage() {
  const { t, lang, formatDate } = useLang()
  const fmt = useFormat()
  const [params, setParams] = useSearchParams()
  const assignee = params.get('staff') ?? ''
  const staff = useStaff()

  // Stable for the lifetime of the page: from local midnight today, DAYS days ahead.
  const [from, to, todayKey, tomorrowKey] = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + DAYS)
    const tomorrow = new Date(start)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return [start.toISOString(), end.toISOString(), dayKey(start), dayKey(tomorrow)]
  }, [])
  const list = useClinicAppointments(from, to, assignee || undefined)

  const groups = useMemo(() => {
    const out: { key: string; date: Date; items: AppointmentDto[] }[] = []
    for (const a of list.data?.items ?? []) {
      const date = new Date(a.startsAt)
      const key = dayKey(date)
      if (out.at(-1)?.key !== key) out.push({ key, date, items: [] })
      out.at(-1)!.items.push(a)
    }
    return out
  }, [list.data])

  const dayLabel = (g: (typeof groups)[number]) => {
    const long = formatDate(g.date, { weekday: 'long', day: 'numeric', month: 'long' })
    if (g.key === todayKey) return `${t('appointments.today')} · ${long}`
    if (g.key === tomorrowKey) return `${t('appointments.tomorrow')} · ${long}`
    return long
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading className="headline">{t('appointments.title')}</Heading>
          <Text className="mt-1">{t('appointments.subtitle')}</Text>
        </div>
        <Select
          aria-label={t('appointments.filterBy')}
          className="sm:max-w-56"
          value={assignee}
          onChange={(e) =>
            setParams(
              (prev) => {
                const next = new URLSearchParams(prev)
                if (e.target.value) next.set('staff', e.target.value)
                else next.delete('staff')
                return next
              },
              { replace: true },
            )
          }
        >
          <option value="">{t('appointments.everyone')}</option>
          {staff.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.fullName}
            </option>
          ))}
        </Select>
      </div>

      <RequestError error={list.error} />
      {list.data?.truncated && (
        <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-sm/6 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900">
          {t('appointments.truncated', { count: list.data.items.length })}
        </p>
      )}
      {list.isPending && <div className="h-48 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/5" />}
      {list.isSuccess && groups.length === 0 && (
        <div className="rounded-xl py-16 text-center ring-1 ring-zinc-950/8 dark:ring-white/10">
          <Text>{t('appointments.none')}</Text>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="rounded-xl bg-white ring-1 ring-zinc-950/8 dark:bg-zinc-900 dark:ring-white/10">
          <header className="flex items-baseline justify-between gap-3 border-b border-zinc-950/5 px-5 py-3 dark:border-white/5">
            <h2
              className={clsx(
                'text-sm/6 font-semibold',
                g.key === todayKey ? 'text-brand-700 dark:text-brand-300' : 'text-zinc-950 dark:text-white',
              )}
            >
              {dayLabel(g)}
            </h2>
            <span className="text-xs/5 text-zinc-500">{t('appointments.count', { count: g.items.length })}</span>
          </header>
          <ul className="divide-y divide-zinc-950/5 dark:divide-white/5">
            {g.items.map((a) => {
              const Icon = APPOINTMENT_ICONS[a.type]
              const closed = a.status !== 'SCHEDULED'
              return (
                <li key={a.id}>
                  <Link
                    href={`/patients/${a.patient.id}?tab=appointments`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-white/5"
                  >
                    <span className="w-24 shrink-0 text-sm/6 font-semibold text-zinc-950 tabular-nums dark:text-white">
                      {fmt.time(a.startsAt)}
                      <span className="block text-xs/5 font-normal text-zinc-500">
                        {t('record.appt.minutes', { count: a.durationMinutes })}
                      </span>
                    </span>
                    <Icon className="size-4 shrink-0 text-zinc-400" />
                    <span className="min-w-0 flex-1">
                      <span
                        className={clsx(
                          'block truncate text-sm/6 font-medium',
                          closed ? 'text-zinc-500' : 'text-zinc-950 dark:text-white',
                        )}
                      >
                        {(lang === 'ar' && a.patient.fullNameAr) || a.patient.fullName}
                      </span>
                      <span className="block truncate text-sm/6 text-zinc-500">
                        {a.title || t(`record.appt.types.${a.type}`)}
                        {a.assignedTo && ` · ${a.assignedTo.fullName}`}
                      </span>
                    </span>
                    <ToneBadge tone={appointmentTone[a.status]}>{t(`record.appt.statuses.${a.status}`)}</ToneBadge>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
