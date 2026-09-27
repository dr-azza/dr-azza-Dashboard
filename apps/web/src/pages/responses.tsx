import { RequestError, useFormat } from '@/components/app/form'
import { ToneBadge } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Checkbox, CheckboxField } from '@/components/catalyst/checkbox'
import { Label } from '@/components/catalyst/fieldset'
import { Heading } from '@/components/catalyst/heading'
import { Select } from '@/components/catalyst/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { ResponsePanel } from '@/components/forms/response-panel'
import { useLang } from '@/i18n'
import { useForms, useFormResponsesSummary, useResponses } from '@/lib/queries'
import { InboxIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

const STATUSES = ['new', 'reviewed', 'all'] as const
type Status = (typeof STATUSES)[number]

/** Every form's answers in one place: what's new, what isn't on a patient yet, and the latest week. */
export function ResponsesPage() {
  const { t } = useLang()
  const fmt = useFormat()
  const [params, setParams] = useSearchParams()
  const status: Status = STATUSES.find((s) => s === params.get('status')) ?? 'new'
  const formId = params.get('form') ?? ''
  const unlinkedOnly = params.get('linked') === 'false'
  const [openId, setOpenId] = useState<string | null>(null)

  const summary = useFormResponsesSummary()
  const forms = useForms()
  const responses = useResponses({
    formId: formId || undefined,
    status: status === 'all' ? undefined : status,
    linked: unlinkedOnly ? false : undefined,
  })
  const items = responses.data?.pages.flatMap((p) => p.items) ?? []

  /** Changes filters in the URL, so a filtered view can be bookmarked or shared with a colleague. */
  const setFilters = (patch: { status?: Status; form?: string; linked?: boolean }) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (patch.status === 'new') next.delete('status')
        else if (patch.status) next.set('status', patch.status)
        if (patch.form) next.set('form', patch.form)
        else if (patch.form === '') next.delete('form')
        if (patch.linked === true) next.delete('linked')
        else if (patch.linked === false) next.set('linked', 'false')
        return next
      },
      { replace: true },
    )

  const stats = [
    {
      key: 'new',
      value: summary.data?.newCount,
      tone: 'danger' as const,
      active: status === 'new' && !unlinkedOnly && !formId,
      onClick: () => setFilters({ status: 'new', form: '', linked: true }),
    },
    {
      key: 'unlinked',
      value: summary.data?.unlinkedCount,
      tone: 'warn' as const,
      active: unlinkedOnly && status === 'all' && !formId,
      onClick: () => setFilters({ status: 'all', form: '', linked: false }),
    },
    {
      key: 'week',
      value: summary.data?.lastWeekCount,
      tone: 'neutral' as const,
      active: false,
      onClick: () => setFilters({ status: 'all', form: '', linked: true }),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <Heading className="headline">{t('responsesPage.title')}</Heading>
        <Text className="mt-1">{t('responsesPage.subtitle')}</Text>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={s.onClick}
            aria-pressed={s.active}
            className={clsx(
              'rounded-xl bg-white p-5 text-start ring-1 transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-brand-600 dark:bg-zinc-900',
              s.active ? 'ring-2 ring-brand-600' : 'ring-zinc-950/8 dark:ring-white/10',
            )}
          >
            <div className="text-sm/6 font-medium text-zinc-500 dark:text-zinc-400">
              {t(`responsesPage.stats.${s.key}`)}
            </div>
            <div
              className={clsx(
                'mt-2 font-display text-4xl/10 font-semibold tabular-nums',
                s.tone === 'danger' && s.value ? 'text-red-700 dark:text-red-400' : '',
                s.tone === 'warn' && s.value ? 'text-amber-700 dark:text-amber-400' : '',
                (!s.value || s.tone === 'neutral') && 'text-zinc-950 dark:text-white',
              )}
            >
              {s.value ?? '—'}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-white/5" role="tablist">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={status === s}
              onClick={() => setFilters({ status: s })}
              className={clsx(
                'rounded-md px-3 py-1.5 text-sm/5 font-medium',
                status === s
                  ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white',
              )}
            >
              {t(`forms.responses.filter${s[0].toUpperCase()}${s.slice(1)}`)}
            </button>
          ))}
        </div>
        <Select
          aria-label={t('responsesPage.filterForm')}
          className="sm:max-w-64"
          value={formId}
          onChange={(e) => setFilters({ form: e.target.value })}
        >
          <option value="">{t('responsesPage.allForms')}</option>
          {forms.data?.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </Select>
        <CheckboxField>
          <Checkbox color="brand" checked={unlinkedOnly} onChange={(on) => setFilters({ linked: !on })} />
          <Label>{t('responsesPage.unlinkedOnly')}</Label>
        </CheckboxField>
      </div>

      <RequestError error={responses.error ?? summary.error} />
      {responses.isPending && <div className="h-48 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/5" />}
      {responses.isSuccess && items.length === 0 && (
        <div className="rounded-xl bg-white px-6 py-14 text-center ring-1 ring-zinc-950/8 dark:bg-zinc-900 dark:ring-white/10">
          <InboxIcon className="mx-auto size-6 text-brand-500" />
          <Text className="mt-2">{t('responsesPage.empty')}</Text>
        </div>
      )}

      {items.length > 0 && (
        <Table className="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
          <TableHead>
            <TableRow>
              <TableHeader>{t('forms.responses.submitted')}</TableHeader>
              <TableHeader>{t('responsesPage.form')}</TableHeader>
              <TableHeader>{t('forms.responses.from')}</TableHeader>
              <TableHeader className="max-sm:hidden">{t('forms.responses.status')}</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer hover:bg-zinc-950/2.5 dark:hover:bg-white/2.5"
                onClick={() => setOpenId(r.id)}
              >
                <TableCell className="tabular-nums">
                  <button
                    type="button"
                    className="text-start font-medium focus-visible:outline-2 focus-visible:outline-brand-600"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenId(r.id)
                    }}
                  >
                    {fmt.dayTime(r.submittedAt)}
                  </button>
                </TableCell>
                <TableCell className="max-w-56 truncate">
                  <bdi>{r.form.title}</bdi>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{r.patient?.fullName ?? r.respondentName ?? '—'}</div>
                  <div
                    className={clsx(
                      'text-xs/5',
                      r.patient ? 'text-zinc-500' : 'font-medium text-amber-700 dark:text-amber-400',
                    )}
                  >
                    {r.patient ? t(`forms.responses.match.${r.matchedBy ?? 'STAFF'}`) : t('forms.responses.notLinked')}
                  </div>
                </TableCell>
                <TableCell className="max-sm:hidden">
                  <ToneBadge tone={r.reviewedAt ? 'neutral' : 'danger'}>
                    {r.reviewedAt ? t('forms.responses.reviewed') : t('forms.responses.new')}
                  </ToneBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {responses.hasNextPage && (
        <div className="flex justify-center">
          <Button outline onClick={() => responses.fetchNextPage()} disabled={responses.isFetchingNextPage}>
            {t('forms.responses.loadMore')}
          </Button>
        </div>
      )}
      <ResponsePanel responseId={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}
