import { RequestError, useFormat } from '@/components/app/form'
import { Card, StatCard } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Text } from '@/components/catalyst/text'
import { RevenueExpensesChart } from '@/components/finance/bar-chart'
import { FinanceEntryPanel } from '@/components/finance/entry-panel'
import { useLang } from '@/i18n'
import { financeExportUrl } from '@/lib/api'
import { useFinanceSummary } from '@/lib/queries'
import { addMonths, type FinanceKindCode, monthBounds } from '@azza/shared'
import { ArrowDownTrayIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { dayDate, FinanceGate, FinancePageHeader, localToday } from './shared'

type View = 'month' | 'year'

/**
 * The period to show after switching view: a month's year, or for a year this month (if it's the
 * current year) or January.
 */
function switchPeriod(period: string, to: View, today: string) {
  const year = period.slice(0, 4)
  if (to === 'year') return year
  if (period.length > 4) return period
  return year === today.slice(0, 4) ? today.slice(0, 7) : `${year}-01`
}

export function FinanceOverviewPage() {
  return (
    <FinanceGate>
      <Overview />
    </FinanceGate>
  )
}

function Overview() {
  const { t, l, lang, formatDate } = useLang()
  const fmt = useFormat()
  const [params, setParams] = useSearchParams()
  const today = localToday()
  const view: View = params.get('view') === 'year' ? 'year' : 'month'
  const current = view === 'year' ? today.slice(0, 4) : today.slice(0, 7)
  const period = params.get('period') ?? current
  const [adding, setAdding] = useState<FinanceKindCode | null>(null)

  const from = view === 'year' ? `${period}-01-01` : monthBounds(period).from
  const to = view === 'year' ? `${period}-12-31` : monthBounds(period).to
  const summary = useFinanceSummary(from, to, view === 'year' ? 'month' : 'day')
  const s = summary.data

  const go = (next: { view?: View; period?: string }) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        const v = next.view ?? view
        p.set('view', v)
        p.set('period', next.period ?? period)
        return p
      },
      { replace: true },
    )
  const step = (n: number) => go({ period: view === 'year' ? String(Number(period) + n) : addMonths(period, n) })

  const periodLabel = view === 'year' ? period : formatDate(dayDate(`${period}-01`), { month: 'long', year: 'numeric' })
  const net = Number(s?.totals.net ?? 0)
  const Prev = lang === 'ar' ? ChevronRightIcon : ChevronLeftIcon
  const Next = lang === 'ar' ? ChevronLeftIcon : ChevronRightIcon

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title={t('finance.title')}
        subtitle={t('finance.subtitle')}
        actions={
          <>
            <Button outline href={financeExportUrl(from, to, lang)} download>
              <ArrowDownTrayIcon />
              {t('finance.export')}
            </Button>
            <Button outline onClick={() => setAdding('INCOME')}>
              <PlusIcon />
              {t('finance.addIncome')}
            </Button>
            <Button color="brand" onClick={() => setAdding('EXPENSE')}>
              <PlusIcon />
              {t('finance.addExpense')}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-white/5" role="tablist">
          {(['month', 'year'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => go({ view: v, period: switchPeriod(period, v, today) })}
              className={clsx(
                'rounded-md px-4 py-1.5 text-sm/6 font-medium',
                view === v
                  ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white',
              )}
            >
              {t(`finance.view.${v}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button plain onClick={() => step(-1)} aria-label={t('finance.previous')}>
            <Prev />
          </Button>
          <span className="min-w-36 text-center text-base/7 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white">
            {periodLabel}
          </span>
          <Button plain onClick={() => step(1)} aria-label={t('finance.next')}>
            <Next />
          </Button>
        </div>
        {period !== current && (
          <Button plain onClick={() => go({ period: current })}>
            {t(`finance.current.${view}`)}
          </Button>
        )}
      </div>

      <RequestError error={summary.error} />

      <div className={clsx('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', summary.isFetching && 'opacity-70')}>
        <StatCard
          size="md"
          label={t('finance.cards.revenue')}
          value={s ? fmt.moneyWhole(s.totals.revenue) : '—'}
          note={
            s
              ? t('finance.cards.revenueSplit', {
                  patients: fmt.money(s.totals.patientPayments),
                  other: fmt.money(s.totals.otherIncome),
                })
              : ''
          }
        />
        <StatCard
          size="md"
          label={t('finance.cards.expenses')}
          value={s ? fmt.moneyWhole(s.totals.expenses) : '—'}
          note={t('finance.cards.expensesNote')}
        />
        <StatCard
          size="md"
          label={t('finance.cards.net')}
          value={s ? fmt.moneyWhole(s.totals.net) : '—'}
          tone={net < 0 ? 'danger' : 'brand'}
          tinted={!!s && net !== 0}
          note={s && net !== 0 ? t(net < 0 ? 'finance.cards.loss' : 'finance.cards.profit') : undefined}
        />
        <StatCard
          size="md"
          label={t('finance.cards.today')}
          value={s ? fmt.moneyWhole(s.todayTotals.net) : '—'}
          tone={Number(s?.todayTotals.net ?? 0) < 0 ? 'danger' : 'neutral'}
          note={
            s
              ? t('finance.cards.todayNote', {
                  revenue: fmt.money(s.todayTotals.revenue),
                  expenses: fmt.money(s.todayTotals.expenses),
                })
              : ''
          }
        />
      </div>

      <Card title={t('finance.chart.title')}>
        {s && s.series.every((p) => p.revenue === '0.00' && p.expenses === '0.00') ? (
          <Text className="py-12 text-center">{t('finance.chart.empty')}</Text>
        ) : s ? (
          <RevenueExpensesChart
            points={s.series}
            label={(p) =>
              view === 'year'
                ? formatDate(dayDate(`${p}-01`), { month: 'long', year: 'numeric' })
                : formatDate(dayDate(p), { weekday: 'short', day: 'numeric', month: 'short' })
            }
            shortLabel={(p, i) => {
              if (view === 'year') return formatDate(dayDate(`${p}-01`), { month: 'narrow' })
              const day = Number(p.slice(8))
              // Every day would crowd the axis: label the 1st and every 5th.
              return i === 0 || day % 5 === 0 ? formatDate(dayDate(p), { day: 'numeric' }) : ''
            }}
          />
        ) : (
          <div className="h-56 animate-pulse rounded-lg bg-zinc-100 dark:bg-white/5" />
        )}
      </Card>

      {s && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Breakdown
            title={t('finance.breakdown.expenses')}
            tone="expense"
            rows={s.expensesByCategory.map((r) => ({ key: r.category.id, label: l(r.category.name), total: r.total }))}
          />
          <Breakdown
            title={t('finance.breakdown.revenue')}
            tone="revenue"
            rows={s.revenueBySource
              .filter((r) => Number(r.total) > 0)
              .map((r) => ({
                key: r.category?.id ?? 'patients',
                label: r.category ? l(r.category.name) : t('finance.breakdown.patients'),
                total: r.total,
              }))}
          />
          <Breakdown
            title={t('finance.breakdown.methods')}
            tone="revenue"
            rows={s.revenueByMethod.map((r) => ({
              key: r.method,
              label: t(`record.payments.methods.${r.method}`),
              total: r.total,
            }))}
          />
        </div>
      )}

      {adding && <FinanceEntryPanel kind={adding} onClose={() => setAdding(null)} />}
    </div>
  )
}

/** Rows with a proportional bar, largest first. */
function Breakdown({
  title,
  rows,
  tone,
}: {
  title: string
  rows: { key: string; label: string; total: string }[]
  tone: 'revenue' | 'expense'
}) {
  const { t } = useLang()
  const fmt = useFormat()
  const sum = rows.reduce((a, r) => a + Number(r.total), 0)
  return (
    <Card title={title}>
      {rows.length === 0 && <Text>{t('finance.breakdown.none')}</Text>}
      <ul className="space-y-3">
        {rows.map((r) => {
          const share = sum > 0 ? Number(r.total) / sum : 0
          return (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm/6">
                <span className="min-w-0 truncate text-zinc-950 dark:text-white">{r.label}</span>
                <span className="shrink-0 font-medium text-zinc-950 tabular-nums dark:text-white">
                  {fmt.money(r.total)}
                  <span className="ms-2 text-xs/5 font-normal text-zinc-500">{Math.round(share * 100)}%</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-white/5">
                <div
                  className={clsx('h-full rounded-full', tone === 'expense' ? 'bg-amber-400' : 'bg-brand-600')}
                  style={{ width: `${Math.max(share * 100, 1)}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
