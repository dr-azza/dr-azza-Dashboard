import { RequestError } from '@/components/app/form'
import { Checkbox, CheckboxField } from '@/components/catalyst/checkbox'
import { Label } from '@/components/catalyst/fieldset'
import { Heading } from '@/components/catalyst/heading'
import { Select } from '@/components/catalyst/select'
import { Text } from '@/components/catalyst/text'
import { RESPONSE_STATUSES, type ResponseStatus, ResponsesTable, StatusTabs } from '@/components/forms/responses-table'
import { useLang } from '@/i18n'
import { useForms, useFormResponsesSummary } from '@/lib/queries'
import clsx from 'clsx'
import { useSearchParams } from 'react-router'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WEEK = 7

interface Filters {
  status: ResponseStatus
  form: string
  unlinked: boolean
  lastWeek: boolean
}

/** Every form's answers in one place: what's new, what isn't on a patient yet, and the latest week. */
export function ResponsesPage() {
  const { t } = useLang()
  const [params, setParams] = useSearchParams()
  // Anything malformed in the URL (a hand-edited or stale link) is ignored, never sent.
  const filters: Filters = {
    status: RESPONSE_STATUSES.find((s) => s === params.get('status')) ?? 'new',
    form: UUID.test(params.get('form') ?? '') ? params.get('form')! : '',
    unlinked: params.get('linked') === 'false',
    lastWeek: params.get('days') === String(WEEK),
  }
  const summary = useFormResponsesSummary()
  const active = useForms(false)
  const archived = useForms(true)

  /** Filters live in the URL, so a filtered view can be bookmarked or shared with a colleague. */
  const apply = (next: Partial<Filters>) => {
    const f = { ...filters, ...next }
    const out = new URLSearchParams()
    if (f.status !== 'new') out.set('status', f.status)
    if (f.form) out.set('form', f.form)
    if (f.unlinked) out.set('linked', 'false')
    if (f.lastWeek) out.set('days', String(WEEK))
    setParams(out, { replace: true })
  }

  const cards: { key: string; value: number | undefined; color: string; filters: Filters }[] = [
    {
      key: 'new',
      value: summary.data?.newCount,
      color: 'text-red-700 dark:text-red-400',
      filters: { status: 'new', form: '', unlinked: false, lastWeek: false },
    },
    {
      key: 'unlinked',
      value: summary.data?.unlinkedCount,
      color: 'text-amber-700 dark:text-amber-400',
      filters: { status: 'all', form: '', unlinked: true, lastWeek: false },
    },
    {
      key: 'week',
      value: summary.data?.lastWeekCount,
      color: 'text-zinc-950 dark:text-white',
      filters: { status: 'all', form: '', unlinked: false, lastWeek: true },
    },
  ]
  const isCurrent = (f: Filters) =>
    f.status === filters.status &&
    f.form === filters.form &&
    f.unlinked === filters.unlinked &&
    f.lastWeek === filters.lastWeek

  return (
    <div className="space-y-6">
      <div>
        <Heading className="headline">{t('responsesPage.title')}</Heading>
        <Text className="mt-1">{t('responsesPage.subtitle')}</Text>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => apply(c.filters)}
            aria-pressed={isCurrent(c.filters)}
            className={clsx(
              'rounded-xl bg-white p-5 text-start ring-1 transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-brand-600 dark:bg-zinc-900',
              isCurrent(c.filters) ? 'ring-2 ring-brand-600' : 'ring-zinc-950/8 dark:ring-white/10',
            )}
          >
            <div className="text-sm/6 font-medium text-zinc-500 dark:text-zinc-400">
              {t(`responsesPage.stats.${c.key}`)}
            </div>
            <div
              className={clsx(
                'mt-2 font-display text-4xl/10 font-semibold tabular-nums',
                c.value ? c.color : 'text-zinc-950 dark:text-white',
              )}
            >
              {c.value ?? '—'}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <StatusTabs value={filters.status} onChange={(status) => apply({ status })} />
        <Select
          aria-label={t('responsesPage.filterForm')}
          className="sm:max-w-64"
          value={filters.form}
          onChange={(e) => apply({ form: e.target.value })}
        >
          <option value="">{t('responsesPage.allForms')}</option>
          {active.data?.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
          {/* Archived forms are left out of "All forms" but can still be looked at one by one. */}
          {!!archived.data?.length && (
            <optgroup label={t('forms.archivedTab')}>
              {archived.data.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
        <CheckboxField>
          <Checkbox color="brand" checked={filters.unlinked} onChange={(unlinked) => apply({ unlinked })} />
          <Label>{t('responsesPage.unlinkedOnly')}</Label>
        </CheckboxField>
        <CheckboxField>
          <Checkbox color="brand" checked={filters.lastWeek} onChange={(lastWeek) => apply({ lastWeek })} />
          <Label>{t('responsesPage.lastWeekOnly')}</Label>
        </CheckboxField>
      </div>

      <RequestError error={summary.error} />
      <ResponsesTable
        showForm
        emptyText={t('responsesPage.empty')}
        filters={{
          formId: filters.form || undefined,
          status: filters.status === 'all' ? undefined : filters.status,
          linked: filters.unlinked ? false : undefined,
          days: filters.lastWeek ? WEEK : undefined,
        }}
      />
    </div>
  )
}
