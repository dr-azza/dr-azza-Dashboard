import { RequestError, useFormat } from '@/components/app/form'
import { ToneBadge } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { ResponsePanel } from '@/components/forms/response-panel'
import { useLang } from '@/i18n'
import { type ResponseFilters, useResponses } from '@/lib/queries'
import { InboxIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useState } from 'react'

export const RESPONSE_STATUSES = ['new', 'reviewed', 'all'] as const
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number]

/** New / Reviewed / All as a segmented control. */
export function StatusTabs({ value, onChange }: { value: ResponseStatus; onChange: (status: ResponseStatus) => void }) {
  const { t } = useLang()
  return (
    <div className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-white/5" role="tablist">
      {RESPONSE_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={value === s}
          onClick={() => onChange(s)}
          className={clsx(
            'rounded-md px-3 py-1.5 text-sm/5 font-medium',
            value === s
              ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white',
          )}
        >
          {t(`forms.responses.filter${s[0].toUpperCase()}${s.slice(1)}`)}
        </button>
      ))}
    </div>
  )
}

/**
 * Responses as a table (newest first) with paging; a row opens the response panel.
 * `showForm` adds the form column for lists that span several forms.
 */
export function ResponsesTable({
  filters,
  showForm = false,
  emptyText,
}: {
  filters: ResponseFilters
  showForm?: boolean
  emptyText: string
}) {
  const { t } = useLang()
  const fmt = useFormat()
  const [openId, setOpenId] = useState<string | null>(null)
  const responses = useResponses(filters)
  const items = responses.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <>
      <RequestError error={responses.error} />
      {responses.isPending && <div className="h-48 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/5" />}
      {responses.isSuccess && items.length === 0 && (
        <div className="rounded-xl bg-white px-6 py-14 text-center ring-1 ring-zinc-950/8 dark:bg-zinc-900 dark:ring-white/10">
          <InboxIcon className="mx-auto size-6 text-brand-500" />
          <Text className="mt-2">{emptyText}</Text>
        </div>
      )}
      {items.length > 0 && (
        <Table className="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
          <TableHead>
            <TableRow>
              <TableHeader>{t('forms.responses.submitted')}</TableHeader>
              {showForm && <TableHeader>{t('responsesPage.form')}</TableHeader>}
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
                  {/* The keyboard way into the row; the row itself handles mouse clicks. */}
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
                {showForm && (
                  <TableCell className="max-w-56 truncate">
                    <bdi>{r.form.title}</bdi>
                  </TableCell>
                )}
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
    </>
  )
}
