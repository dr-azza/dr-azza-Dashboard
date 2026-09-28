import { RequestError } from '@/components/app/form'
import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Select } from '@/components/catalyst/select'
import { Text } from '@/components/catalyst/text'
import { ReminderGroups, ReminderRow } from '@/components/reminders/reminder-list'
import { ReminderPanel } from '@/components/reminders/reminder-panel'
import { useLang } from '@/i18n'
import { useMe, useStaff, useTasks } from '@/lib/queries'
import { type TaskDto, taskBucket } from '@azza/shared'
import { PlusIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

/** The team's to-do list: what's overdue, due today and coming up, for me or anyone. */
export function RemindersPage() {
  const { t } = useLang()
  const me = useMe().data
  const staff = useStaff()
  const [params, setParams] = useSearchParams()
  const who = params.get('who') ?? 'me'
  const tab = params.get('tab') === 'done' ? 'done' : 'open'
  const [editing, setEditing] = useState<TaskDto | null>(null)
  const [adding, setAdding] = useState(false)

  const list = useTasks({ status: tab, assignee: who === 'all' ? undefined : who })
  const items = list.data?.items ?? []

  const set = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  const now = new Date()
  const count = (...buckets: string[]) =>
    items.filter((i) => buckets.includes(taskBucket(new Date(i.dueAt), now))).length
  const stats = [
    { key: 'overdue', value: count('overdue'), tone: 'danger' },
    { key: 'today', value: count('today'), tone: 'brand' },
    { key: 'week', value: count('today', 'tomorrow', 'week'), tone: 'neutral' },
  ] as const

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading className="headline">{t('reminders.title')}</Heading>
          <Text className="mt-1">{t('reminders.subtitle')}</Text>
        </div>
        <Button color="brand" onClick={() => setAdding(true)}>
          <PlusIcon />
          {t('reminders.new')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-white/5" role="tablist">
          {(['open', 'done'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => set('tab', key === 'open' ? null : key)}
              className={clsx(
                'rounded-md px-4 py-1.5 text-sm/6 font-medium',
                tab === key
                  ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white',
              )}
            >
              {t(`reminders.tabs.${key}`)}
            </button>
          ))}
        </div>
        <Select
          aria-label={t('reminders.show')}
          className="ms-auto sm:max-w-60"
          value={who}
          onChange={(e) => set('who', e.target.value === 'me' ? null : e.target.value)}
        >
          <option value="me">{t('reminders.views.me')}</option>
          <option value="all">{t('reminders.views.all')}</option>
          <option value="unassigned">{t('reminders.views.unassigned')}</option>
          {staff.data
            ?.filter((m) => m.id !== me?.id)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
        </Select>
      </div>

      {tab === 'open' && list.isSuccess && (
        <dl className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div
              key={s.key}
              className={clsx(
                'rounded-xl px-4 py-3 ring-1',
                s.tone === 'danger' && s.value > 0
                  ? 'bg-red-50 ring-red-200 dark:bg-red-950/40 dark:ring-red-900'
                  : s.tone === 'brand' && s.value > 0
                    ? 'bg-brand-50 ring-brand-200 dark:bg-brand-950/40 dark:ring-brand-900'
                    : 'bg-white ring-zinc-950/8 dark:bg-zinc-900 dark:ring-white/10',
              )}
            >
              <dt className="text-xs/5 font-medium text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
                {t(`reminders.stats.${s.key}`)}
              </dt>
              <dd
                className={clsx(
                  'mt-1 font-display text-2xl/8 font-semibold tabular-nums sm:text-3xl/9',
                  s.tone === 'danger' && s.value > 0
                    ? 'text-red-700 dark:text-red-400'
                    : s.tone === 'brand' && s.value > 0
                      ? 'text-brand-700 dark:text-brand-300'
                      : 'text-zinc-950 dark:text-white',
                )}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <RequestError error={list.error} />
      {list.data?.truncated && <Text>{t('reminders.truncated', { count: items.length })}</Text>}
      {list.isPending && <div className="h-48 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/5" />}
      {list.isSuccess && items.length === 0 && (
        <div className="rounded-xl py-16 text-center ring-1 ring-zinc-950/8 dark:ring-white/10">
          <Text>{tab === 'open' ? t('reminders.none') : t('reminders.noneDone')}</Text>
        </div>
      )}

      {tab === 'open' ? (
        <ReminderGroups tasks={items} onOpen={setEditing} />
      ) : (
        items.length > 0 && (
          <ul className="divide-y divide-zinc-950/5 rounded-xl bg-white ring-1 ring-zinc-950/8 dark:divide-white/5 dark:bg-zinc-900 dark:ring-white/10">
            {items.map((task) => (
              <ReminderRow key={task.id} task={task} bucket={null} onOpen={setEditing} />
            ))}
          </ul>
        )
      )}

      {adding && <ReminderPanel open onClose={() => setAdding(false)} />}
      {editing && <ReminderPanel key={editing.id} open task={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
