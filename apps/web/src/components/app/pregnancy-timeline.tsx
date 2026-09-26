import { useLang } from '@/i18n'
import { addDays, dueDate, gestationalAge, MILESTONES, weekPercent } from '@azza/shared'
import { CheckIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'

/** Horizontal 0–40 week track with trimesters, today's position and antenatal milestones. */
export function PregnancyTimeline({ lmp, today }: { lmp: Date; today: Date }) {
  const { t, l, formatDate } = useLang()
  const ga = gestationalAge(lmp, today)
  const exactWeeks = ga.totalDays / 7
  const todayPct = weekPercent(exactWeeks)
  const edd = dueDate(lmp)
  const short = (d: Date) => formatDate(d, { day: 'numeric', month: 'short' })

  return (
    <div className="relative h-36 select-none" role="img" aria-label={t('file.today', { ga: t('common.ga', { w: ga.weeks, d: ga.days }) })}>
      {/* Today marker */}
      <div
        className="absolute top-0 -translate-x-1/2 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs/5 font-semibold whitespace-nowrap text-white rtl:translate-x-1/2"
        style={{ insetInlineStart: `${todayPct}%` }}
      >
        {t('file.today', { ga: t('common.ga', { w: ga.weeks, d: ga.days }) })}
      </div>

      {/* Trimester labels */}
      <div className="absolute inset-x-0 top-8 text-xs/5 font-medium text-zinc-500 dark:text-zinc-400">
        <span className="absolute start-0">{t('file.trimester1')}</span>
        <span className="absolute ps-2" style={{ insetInlineStart: '35%' }}>
          {t('file.trimester2')}
        </span>
        <span className="absolute ps-2" style={{ insetInlineStart: '70%' }}>
          {t('file.trimester3')}
        </span>
        <span className="absolute end-0">{t('file.eddShort', { date: short(edd) })}</span>
      </div>

      {/* Track */}
      <div className="absolute inset-x-0 top-15 h-2.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${todayPct}%` }} />
      </div>
      {[35, 70].map((pct) => (
        <div
          key={pct}
          className="absolute top-14 h-4.5 w-0.5 bg-white dark:bg-zinc-900"
          style={{ insetInlineStart: `${pct}%` }}
        />
      ))}

      {/* Milestones */}
      {MILESTONES.map((m) => {
        const done = ga.weeks >= m.week
        return (
          <div
            key={m.week}
            className="absolute top-14 flex w-24 -translate-x-1/2 flex-col items-center gap-1.5 text-center rtl:translate-x-1/2"
            style={{ insetInlineStart: `${weekPercent(m.week)}%` }}
          >
            <span
              className={clsx(
                'flex size-4.5 items-center justify-center rounded-full ring-3 ring-white dark:ring-zinc-900',
                done ? 'bg-teal-600 text-white' : 'bg-white outline-1 outline-zinc-400 dark:bg-zinc-800'
              )}
            >
              {done && <CheckIcon className="size-3" />}
            </span>
            <span className="text-xs/4 font-semibold text-zinc-950 dark:text-white">{l(m.name)}</span>
            <span className={clsx('text-xs/4', done ? 'text-teal-700 dark:text-teal-400' : 'text-zinc-500 dark:text-zinc-400')}>
              {done
                ? t('file.milestoneDone', { w: m.week })
                : t('file.milestoneNext', { w: m.week, date: short(addDays(lmp, m.week * 7)) })}
            </span>
          </div>
        )
      })}
    </div>
  )
}
