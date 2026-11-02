import { useFormat } from '@/components/app/form'
import { useLang } from '@/i18n'
import { localeFor } from '@azza/i18n'
import clsx from 'clsx'
import { useState } from 'react'

export interface ChartPoint {
  period: string
  revenue: string
  expenses: string
  net: string
}

/** A round axis maximum (1, 2 or 5 × 10ⁿ) at or above the largest value. */
function niceCeiling(value: number) {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  return ([1, 2, 5, 10].find((m) => m * power >= value) ?? 10) * power
}

/**
 * Revenue and expenses side by side for each day or month. Plain HTML bars rather than a chart
 * library: they follow the page direction (right to left in Arabic) and shrink to phone width.
 * Hover, tap or focus a column for its numbers.
 */
export function RevenueExpensesChart({
  points,
  label,
  shortLabel,
}: {
  points: ChartPoint[]
  /** Full name of a period, for the tooltip, e.g. "Mon 3 Nov". */
  label: (period: string) => string
  /** Axis label; empty to skip (crowded axes show every few). */
  shortLabel: (period: string, index: number) => string
}) {
  const { t, lang } = useLang()
  const fmt = useFormat()
  const [active, setActive] = useState<number | null>(null)
  const max = niceCeiling(Math.max(0, ...points.flatMap((p) => [Number(p.revenue), Number(p.expenses)])))
  const compact = new Intl.NumberFormat(localeFor(lang), { notation: 'compact', maximumFractionDigits: 1 })
  const grid = [1, 0.75, 0.5, 0.25, 0]
  const shown = active !== null ? points[active] : null

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs/5 text-zinc-600 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand-600" />
          {t('finance.chart.revenue')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-amber-400" />
          {t('finance.chart.expenses')}
        </span>
        {shown && (
          <span className="ms-auto font-medium text-zinc-950 tabular-nums dark:text-white" aria-live="polite">
            {label(shown.period)} · {fmt.money(shown.revenue)} / {fmt.money(shown.expenses)} ·{' '}
            <span
              className={
                Number(shown.net) < 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
              }
            >
              {fmt.money(shown.net)}
            </span>
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {/* Axis values, on the start side. */}
        <div className="relative h-48 w-10 shrink-0 text-end text-[0.6875rem]/none text-zinc-500 tabular-nums sm:h-56">
          {grid.map((g) => (
            <span key={g} className="absolute end-0 -translate-y-1/2" style={{ top: `${(1 - g) * 100}%` }}>
              {compact.format(max * g)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-48 sm:h-56">
            {grid.map((g) => (
              <div
                key={g}
                className={clsx(
                  'absolute inset-x-0 border-t',
                  g === 0
                    ? 'border-zinc-300 dark:border-zinc-600'
                    : 'border-dashed border-zinc-950/5 dark:border-white/5',
                )}
                style={{ top: `${(1 - g) * 100}%` }}
              />
            ))}
            <div className="absolute inset-0 flex items-end" onMouseLeave={() => setActive(null)}>
              {points.map((p, i) => (
                <div
                  key={p.period}
                  tabIndex={0}
                  role="img"
                  aria-label={`${label(p.period)}: ${t('finance.chart.revenue')} ${fmt.money(p.revenue)}, ${t('finance.chart.expenses')} ${fmt.money(p.expenses)}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className={clsx(
                    'flex h-full min-w-0 flex-1 items-end justify-center gap-px rounded-sm px-px outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                    active === i && 'bg-zinc-950/5 dark:bg-white/5',
                  )}
                >
                  <span
                    className="w-full max-w-4 rounded-t-sm bg-brand-600"
                    style={{ height: `${(Number(p.revenue) / max) * 100}%` }}
                  />
                  <span
                    className="w-full max-w-4 rounded-t-sm bg-amber-400"
                    style={{ height: `${(Number(p.expenses) / max) * 100}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex text-[0.6875rem]/4 text-zinc-500 tabular-nums">
            {points.map((p, i) => (
              <span key={p.period} className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">
                {shortLabel(p.period, i)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
