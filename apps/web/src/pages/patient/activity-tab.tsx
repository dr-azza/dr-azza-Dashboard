import { RequestError, useFormat } from '@/components/app/form'
import { Card } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Checkbox, CheckboxField } from '@/components/catalyst/checkbox'
import { Label } from '@/components/catalyst/fieldset'
import { Text } from '@/components/catalyst/text'
import { useLang } from '@/i18n'
import { useActivity } from '@/lib/queries'
import { type ActivityDto, isReadAction as isRead } from '@azza/shared'
import { EyeIcon, PencilSquareIcon, PlusCircleIcon, TrashIcon, XCircleIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useState } from 'react'

function iconFor(action: string) {
  if (isRead(action)) return EyeIcon
  if (/\.(void|delete)$/.test(action) || action === 'pregnancy.end')
    return action.endsWith('.delete') ? TrashIcon : XCircleIcon
  if (/\.(create|upload)$/.test(action)) return PlusCircleIcon
  return PencilSquareIcon
}

/** The patient's full activity log: every change (and optionally every view), who did it, when. */
export function ActivityTab({ patientId }: { patientId: string }) {
  const { t, formatDate } = useLang()
  const fmt = useFormat()
  const [includeViews, setIncludeViews] = useState(false)
  const activity = useActivity(patientId, includeViews)
  const items = activity.data?.pages.flatMap((p) => p.items) ?? []

  // Group by calendar day for easier scanning.
  const groups: { day: string; items: ActivityDto[] }[] = []
  for (const item of items) {
    const day = formatDate(new Date(item.at), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] })
    groups.at(-1)!.items.push(item)
  }

  const describe = (a: ActivityDto) => {
    const key = `record.activity.actions.${a.action.replaceAll('.', '_')}`
    const text = t(key)
    return text === key ? a.action : text
  }

  return (
    <Card
      title={t('record.activity.tab')}
      action={
        <CheckboxField>
          <Checkbox color="brand" checked={includeViews} onChange={setIncludeViews} />
          <Label>{t('record.activity.showViews')}</Label>
        </CheckboxField>
      }
      bodyClassName="px-5 pb-5"
    >
      <Text>{t('record.activity.subtitle')}</Text>
      <RequestError error={activity.error} className="mt-3" />
      {activity.isSuccess && items.length === 0 && <Text className="mt-4">{t('record.activity.none')}</Text>}
      <div className="mt-4 space-y-6">
        {groups.map((g) => (
          <section key={g.day}>
            <h3 className="mb-2 text-xs/5 font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              {g.day}
            </h3>
            <ol className="relative ms-3 border-s border-zinc-950/10 dark:border-white/10">
              {g.items.map((a) => {
                const Icon = iconFor(a.action)
                const read = isRead(a.action)
                return (
                  <li key={a.id} className="ms-6 py-2">
                    <span
                      className={clsx(
                        'absolute -start-3 flex size-6 items-center justify-center rounded-full ring-4 ring-white dark:ring-zinc-900',
                        read
                          ? 'bg-zinc-100 text-zinc-500 dark:bg-white/10'
                          : 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span
                        className={clsx(
                          'text-sm/6',
                          read ? 'text-zinc-500' : 'font-medium text-zinc-950 dark:text-white',
                        )}
                      >
                        <span className="font-semibold">{a.actor?.fullName ?? t('record.activity.system')}</span> ·{' '}
                        {describe(a)}
                      </span>
                      {a.appointment && (
                        <span className="text-sm/6 text-zinc-500 dark:text-zinc-400">
                          ({a.appointment.title || t(`record.appt.types.${a.appointment.type}`)} ·{' '}
                          {fmt.dayTime(a.appointment.startsAt)})
                        </span>
                      )}
                      <time className="text-xs/5 text-zinc-500 tabular-nums" dateTime={a.at}>
                        {fmt.time(a.at)}
                      </time>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        ))}
      </div>
      {activity.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button outline onClick={() => activity.fetchNextPage()} disabled={activity.isFetchingNextPage}>
            {t('record.loadMore')}
          </Button>
        </div>
      )}
    </Card>
  )
}
