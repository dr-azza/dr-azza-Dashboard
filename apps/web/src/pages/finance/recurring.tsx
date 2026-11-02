import { RequestError, strOrNull, todayInputValue, useFormat } from '@/components/app/form'
import { SidePanel } from '@/components/app/side-panel'
import { Badge } from '@/components/catalyst/badge'
import { Button } from '@/components/catalyst/button'
import { Description, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { Text } from '@/components/catalyst/text'
import { useLang } from '@/i18n'
import {
  useCreateRecurringExpense,
  useFinanceCategories,
  useRecurringExpenses,
  useUpdateRecurringExpense,
} from '@/lib/queries'
import {
  CreateRecurringExpenseSchema,
  PAYMENT_METHODS,
  type RecurringExpenseDto,
  type UpdateRecurringExpenseInput,
} from '@azza/shared'
import { PauseIcon, PlayIcon, PlusIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useState } from 'react'
import { FinanceGate, FinancePageHeader, localToday } from './shared'

export function FinanceRecurringPage() {
  return (
    <FinanceGate>
      <Recurring />
    </FinanceGate>
  )
}

function Recurring() {
  const { t, l } = useLang()
  const fmt = useFormat()
  const list = useRecurringExpenses()
  const update = useUpdateRecurringExpense()
  const [editing, setEditing] = useState<RecurringExpenseDto | null>(null)
  const [adding, setAdding] = useState(false)
  const today = localToday()
  const ended = (r: RecurringExpenseDto) => !!r.endsOn && r.endsOn < today
  const active = (list.data ?? []).filter((r) => !r.paused && !ended(r))
  const monthly = active.reduce((sum, r) => sum + Number(r.amount), 0)

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title={t('finance.recurring.title')}
        subtitle={t('finance.recurring.subtitle')}
        actions={
          <Button color="brand" onClick={() => setAdding(true)}>
            <PlusIcon />
            {t('finance.recurring.new')}
          </Button>
        }
      />
      <RequestError error={list.error ?? update.error} />
      {list.isPending && <div className="h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/5" />}
      {list.isSuccess && list.data.length === 0 && (
        <div className="rounded-xl px-6 py-16 text-center ring-1 ring-zinc-950/8 dark:ring-white/10">
          <Text>{t('finance.recurring.none')}</Text>
        </div>
      )}
      {list.isSuccess && list.data.length > 0 && (
        <>
          <Text>{t('finance.recurring.monthlyTotal', { amount: fmt.money(monthly) })}</Text>
          <ul className="divide-y divide-zinc-950/5 rounded-xl bg-white ring-1 ring-zinc-950/8 dark:divide-white/5 dark:bg-zinc-900 dark:ring-white/10">
            {list.data.map((r) => {
              const off = r.paused || ended(r)
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={() => setEditing(r)}
                    className="min-w-0 flex-1 rounded text-start focus-visible:outline-2 focus-visible:outline-brand-600"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={clsx(
                          'text-sm/6 font-medium',
                          off ? 'text-zinc-500' : 'text-zinc-950 dark:text-white',
                        )}
                      >
                        {r.description}
                      </span>
                      {r.paused && <Badge color="zinc">{t('finance.recurring.paused')}</Badge>}
                      {!r.paused && ended(r) && <Badge color="zinc">{t('finance.recurring.ended')}</Badge>}
                    </span>
                    <span className="mt-0.5 block text-xs/5 text-zinc-500">
                      {l(r.category.name)} · {t('finance.recurring.monthlyOn', { day: r.dayOfMonth })} ·{' '}
                      {t(`record.payments.methods.${r.method}`)}
                      {r.counterparty && ` · ${r.counterparty}`}
                      {r.nextOn && ` · ${t('finance.recurring.next', { date: fmt.day(r.nextOn) })}`}
                    </span>
                  </button>
                  <span className="text-sm/6 font-semibold text-zinc-950 tabular-nums dark:text-white">
                    {fmt.money(r.amount, r.currency)}
                  </span>
                  {!ended(r) && (
                    <Button
                      plain
                      disabled={update.isPending}
                      onClick={() => update.mutate({ recurringId: r.id, paused: !r.paused })}
                    >
                      {r.paused ? <PlayIcon /> : <PauseIcon />}
                      {r.paused ? t('finance.recurring.resume') : t('finance.recurring.pause')}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
      {adding && <RecurringPanel onClose={() => setAdding(false)} />}
      {editing && <RecurringPanel key={editing.id} recurring={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function RecurringPanel({ recurring: r, onClose }: { recurring?: RecurringExpenseDto; onClose: () => void }) {
  const { t, l } = useLang()
  const categories = useFinanceCategories(true)
  const create = useCreateRecurringExpense()
  const update = useUpdateRecurringExpense()
  const [formError, setFormError] = useState<string | null>(null)
  const options = (categories.data ?? []).filter(
    (c) => c.kind === 'EXPENSE' && (!c.archived || c.id === r?.category.id),
  )
  const defaultDay = Math.min(Number(localToday().slice(8)), 28)

  return (
    <SidePanel
      open
      onClose={onClose}
      title={r ? t('finance.recurring.edit') : t('finance.recurring.new')}
      description={r ? t('finance.recurring.changesNote') : undefined}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault()
        const f = new FormData(event.currentTarget)
        const parsed = CreateRecurringExpenseSchema.safeParse({
          categoryId: f.get('categoryId'),
          amount: Number(f.get('amount')),
          method: f.get('method'),
          description: String(f.get('description') ?? ''),
          counterparty: strOrNull(f.get('counterparty')),
          dayOfMonth: Number(f.get('dayOfMonth')),
          startsOn: r?.startsOn ?? f.get('startsOn'),
          endsOn: strOrNull(f.get('endsOn')),
        })
        if (!parsed.success) {
          const issue = parsed.error.issues[0]
          return setFormError(issue?.message ?? '')
        }
        setFormError(null)
        const d = parsed.data
        if (!r) {
          await create.mutateAsync(d)
          return onClose()
        }
        const changes: UpdateRecurringExpenseInput = {}
        if (d.categoryId !== r.category.id) changes.categoryId = d.categoryId
        if (d.amount !== Number(r.amount)) changes.amount = d.amount
        if (d.method !== r.method) changes.method = d.method
        if (d.description !== r.description) changes.description = d.description
        if ((d.counterparty ?? null) !== r.counterparty) changes.counterparty = d.counterparty ?? null
        if (d.dayOfMonth !== r.dayOfMonth) changes.dayOfMonth = d.dayOfMonth
        if ((d.endsOn ?? null) !== r.endsOn) changes.endsOn = d.endsOn ?? null
        if (Object.keys(changes).length) await update.mutateAsync({ recurringId: r.id, ...changes })
        onClose()
      }}
      actions={
        <>
          <Button plain onClick={onClose}>
            {t('record.cancel')}
          </Button>
          <Button type="submit" color="brand" disabled={create.isPending || update.isPending || !options.length}>
            {t('record.save')}
          </Button>
        </>
      }
    >
      <FieldGroup>
        <Field>
          <Label>{t('finance.entry.description')}</Label>
          <Input
            name="description"
            defaultValue={r?.description ?? ''}
            placeholder={t('finance.entry.expensePlaceholder')}
            autoFocus={!r}
            maxLength={200}
          />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <Label>{t('finance.entry.amount')}</Label>
            <Input
              name="amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              defaultValue={r ? Number(r.amount) : ''}
              dir="ltr"
            />
          </Field>
          <Field>
            <Label>{t('finance.recurring.day')}</Label>
            <Select name="dayOfMonth" defaultValue={String(r?.dayOfMonth ?? defaultDay)}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
            <Description>{t('finance.recurring.dayHint')}</Description>
          </Field>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <Label>{t('finance.entry.category')}</Label>
            <Select name="categoryId" defaultValue={r?.category.id ?? options[0]?.id}>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {l(c.name)}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label>{t('finance.entry.method')}</Label>
            <Select name="method" defaultValue={r?.method ?? 'BANK_TRANSFER'}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`record.payments.methods.${m}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field>
          <Label>{t('finance.entry.paidTo')}</Label>
          <Input name="counterparty" defaultValue={r?.counterparty ?? ''} maxLength={120} />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field disabled={!!r}>
            <Label>{t('finance.recurring.startsOn')}</Label>
            <Input name="startsOn" type="date" defaultValue={r?.startsOn ?? todayInputValue()} />
            {!r && <Description>{t('finance.recurring.startsHint')}</Description>}
          </Field>
          <Field>
            <Label>{t('finance.recurring.endsOn')}</Label>
            <Input name="endsOn" type="date" defaultValue={r?.endsOn ?? ''} />
            <Description>{t('finance.recurring.endsHint')}</Description>
          </Field>
        </div>
        {formError && <RequestError error={new Error(formError)} />}
        <RequestError error={create.error ?? update.error} />
      </FieldGroup>
    </SidePanel>
  )
}
