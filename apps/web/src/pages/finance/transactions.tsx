import { RequestError, useFormat } from '@/components/app/form'
import { StatCard } from '@/components/app/ui'
import { Badge } from '@/components/catalyst/badge'
import { Button } from '@/components/catalyst/button'
import { Field, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Link } from '@/components/catalyst/link'
import { Select } from '@/components/catalyst/select'
import { Text } from '@/components/catalyst/text'
import { FinanceEntryPanel } from '@/components/finance/entry-panel'
import { useLang } from '@/i18n'
import { financeExportUrl } from '@/lib/api'
import { useFinanceSummary, useFinanceTransactions } from '@/lib/queries'
import {
  addMonths,
  type FinanceEntryDto,
  type FinanceKindCode,
  type FinanceTransactionDto,
  MAX_FINANCE_RANGE_DAYS,
  monthBounds,
} from '@azza/shared'
import { ArrowDownTrayIcon, ArrowPathIcon, PaperClipIcon, PlusIcon, UserIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { dayDate, FinanceGate, FinancePageHeader, localToday } from './shared'

export function FinanceTransactionsPage() {
  return (
    <FinanceGate>
      <Transactions />
    </FinanceGate>
  )
}

function Transactions() {
  const { t, lang, formatDate } = useLang()
  const fmt = useFormat()
  const [params, setParams] = useSearchParams()
  const today = localToday()
  const thisMonth = monthBounds(today.slice(0, 7))
  const from = params.get('from') ?? thisMonth.from
  const to = params.get('to') ?? thisMonth.to
  const type = (['revenue', 'expense'] as const).find((v) => v === params.get('type'))
  const [adding, setAdding] = useState<FinanceKindCode | null>(null)
  const [editing, setEditing] = useState<FinanceEntryDto | null>(null)

  const rangeError =
    from > to
      ? t('finance.tx.rangeInvalid')
      : (Date.parse(to) - Date.parse(from)) / 86_400_000 >= MAX_FINANCE_RANGE_DAYS
        ? t('finance.tx.rangeTooLong', { days: MAX_FINANCE_RANGE_DAYS })
        : null
  const list = useFinanceTransactions({ from, to, type }, !rangeError)
  const summary = useFinanceSummary(from, to, 'day', !rangeError)
  const items = list.data?.items ?? []

  const set = (next: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(next)) {
          if (v) p.set(k, v)
          else p.delete(k)
        }
        return p
      },
      { replace: true },
    )

  const yesterday = new Date(dayDate(today).getTime() - 86_400_000)
  const yesterdayDay = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
  const lastMonth = monthBounds(addMonths(today.slice(0, 7), -1))
  const presets = [
    { key: 'today', from: today, to: today },
    { key: 'yesterday', from: yesterdayDay, to: yesterdayDay },
    { key: 'thisMonth', ...thisMonth },
    { key: 'lastMonth', ...lastMonth },
  ] as const

  // Day groups, newest first, with what came in and went out (voided lines don't count).
  const days = useMemo(() => {
    const out: { date: string; items: FinanceTransactionDto[]; inflow: number; outflow: number }[] = []
    for (const tx of list.data?.items ?? []) {
      if (out.at(-1)?.date !== tx.date) out.push({ date: tx.date, items: [], inflow: 0, outflow: 0 })
      const day = out.at(-1)!
      day.items.push(tx)
      if (!tx.voided) {
        if (tx.kind === 'INCOME') day.inflow += Number(tx.amount)
        else day.outflow += Number(tx.amount)
      }
    }
    return out
  }, [list.data])

  const totals = summary.data?.totals

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title={t('finance.tx.title')}
        subtitle={t('finance.tx.subtitle')}
        actions={
          <>
            <Button outline href={financeExportUrl(from, to, lang)} download disabled={!!rangeError}>
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

      <div className="space-y-4 rounded-xl bg-white p-4 ring-1 ring-zinc-950/8 sm:p-5 dark:bg-zinc-900 dark:ring-white/10">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={from === p.from && to === p.to}
              onClick={() => set({ from: p.from, to: p.to })}
              className={clsx(
                'rounded-full px-3 py-1 text-sm/6 font-medium ring-1 transition-colors',
                from === p.from && to === p.to
                  ? 'bg-brand-600 text-white ring-brand-600'
                  : 'bg-white text-zinc-700 ring-zinc-950/10 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10',
              )}
            >
              {t(`finance.tx.presets.${p.key}`)}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <Label>{t('finance.tx.from')}</Label>
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(e) => e.target.value && set({ from: e.target.value })}
            />
          </Field>
          <Field>
            <Label>{t('finance.tx.to')}</Label>
            <Input type="date" value={to} min={from} onChange={(e) => e.target.value && set({ to: e.target.value })} />
          </Field>
          <Field>
            <Label>{t('finance.tx.show')}</Label>
            <Select value={type ?? ''} onChange={(e) => set({ type: e.target.value || null })}>
              <option value="">{t('finance.tx.types.all')}</option>
              <option value="revenue">{t('finance.tx.types.revenue')}</option>
              <option value="expense">{t('finance.tx.types.expense')}</option>
            </Select>
          </Field>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard size="md" label={t('finance.cards.revenue')} value={totals ? fmt.moneyWhole(totals.revenue) : '—'} />
        <StatCard
          size="md"
          label={t('finance.cards.expenses')}
          value={totals ? fmt.moneyWhole(totals.expenses) : '—'}
        />
        <StatCard
          size="md"
          label={t('finance.cards.net')}
          value={totals ? fmt.moneyWhole(totals.net) : '—'}
          tone={Number(totals?.net ?? 0) < 0 ? 'danger' : 'brand'}
          tinted={!!totals && Number(totals.net) !== 0}
        />
      </div>

      {rangeError && <RequestError error={new Error(rangeError)} />}
      <RequestError error={list.error ?? summary.error} />
      {list.data?.truncated && <Text>{t('finance.tx.truncated', { count: items.length })}</Text>}
      {list.isPending && !rangeError && <div className="h-48 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/5" />}
      {list.isSuccess && items.length === 0 && (
        <div className="rounded-xl py-16 text-center ring-1 ring-zinc-950/8 dark:ring-white/10">
          <Text>{t('finance.tx.none')}</Text>
        </div>
      )}

      <div className={clsx('space-y-4', list.isFetching && !list.isPending && 'opacity-70')}>
        {days.map((day) => (
          <section
            key={day.date}
            className="rounded-xl bg-white ring-1 ring-zinc-950/8 dark:bg-zinc-900 dark:ring-white/10"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zinc-950/5 px-4 py-2.5 sm:px-5 dark:border-white/5">
              <h2 className="text-sm/6 font-semibold text-zinc-950 dark:text-white">
                {formatDate(dayDate(day.date), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h2>
              <span className="flex gap-3 text-xs/5 font-medium tabular-nums">
                <span className="text-brand-700 dark:text-brand-300">
                  {t('finance.tx.dayIn', { amount: fmt.money(day.inflow) })}
                </span>
                <span className="text-amber-700 dark:text-amber-400">
                  {t('finance.tx.dayOut', { amount: fmt.money(day.outflow) })}
                </span>
              </span>
            </header>
            <ul className="divide-y divide-zinc-950/5 dark:divide-white/5">
              {day.items.map((tx) => (
                <TransactionRow key={`${tx.source}-${tx.id}`} tx={tx} onOpen={setEditing} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {adding && <FinanceEntryPanel kind={adding} onClose={() => setAdding(null)} />}
      {editing && <FinanceEntryPanel key={editing.id} entry={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** A patient payment links to the patient's payments; an entry opens for editing. */
function TransactionRow({ tx, onOpen }: { tx: FinanceTransactionDto; onOpen: (entry: FinanceEntryDto) => void }) {
  const { t, l, lang } = useLang()
  const fmt = useFormat()
  const income = tx.kind === 'INCOME'
  const receipts = tx.entry?.receipts.length ?? 0

  const body = (
    <>
      <span
        className={clsx(
          'mt-1.5 size-2 shrink-0 rounded-full',
          tx.voided ? 'bg-zinc-300 dark:bg-zinc-600' : income ? 'bg-brand-600' : 'bg-amber-400',
        )}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={clsx(
              'text-sm/6 font-medium',
              tx.voided ? 'text-zinc-500 line-through' : 'text-zinc-950 dark:text-white',
            )}
          >
            {tx.label}
          </span>
          {tx.voided && <Badge color="zinc">{t('finance.tx.voided')}</Badge>}
          {tx.entry?.recurringId && (
            <Badge color="sky">
              <ArrowPathIcon className="size-3" />
              {t('finance.tx.monthly')}
            </Badge>
          )}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs/5 text-zinc-500">
          {tx.patient ? (
            <span className="inline-flex items-center gap-1">
              <UserIcon className="size-3 fill-zinc-400" />
              {(lang === 'ar' && tx.patient.fullNameAr) || tx.patient.fullName} · {tx.patient.fileNumber}
            </span>
          ) : (
            tx.category && <span>{l(tx.category.name)}</span>
          )}
          <span aria-hidden="true">·</span>
          <span>{t(`record.payments.methods.${tx.method}`)}</span>
          {tx.counterparty && (
            <>
              <span aria-hidden="true">·</span>
              <span>{tx.counterparty}</span>
            </>
          )}
          {receipts > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <PaperClipIcon className="size-3 fill-zinc-400" />
              {t('finance.tx.receipts', { count: receipts })}
            </span>
          )}
        </span>
      </span>
      <span
        className={clsx(
          'shrink-0 text-sm/6 font-semibold tabular-nums',
          tx.voided
            ? 'text-zinc-400 line-through'
            : income
              ? 'text-brand-700 dark:text-brand-300'
              : 'text-zinc-950 dark:text-white',
        )}
        dir="ltr"
      >
        {income ? '+' : '−'}
        {fmt.money(tx.amount, tx.currency)}
      </span>
    </>
  )
  const row = 'flex w-full items-start gap-3 px-4 py-3 text-start hover:bg-zinc-50 sm:px-5 dark:hover:bg-white/5'

  return (
    <li>
      {tx.entry ? (
        <button type="button" className={row} onClick={() => onOpen(tx.entry!)}>
          {body}
        </button>
      ) : (
        <Link href={`/patients/${tx.patient!.id}?tab=payments`} className={row} title={t('finance.tx.patientPayment')}>
          {body}
        </Link>
      )}
    </li>
  )
}
