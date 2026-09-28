import { useFormat } from '@/components/app/form'
import { Badge } from '@/components/catalyst/badge'
import { Link } from '@/components/catalyst/link'
import { useLang } from '@/i18n'
import { useSetTaskDone } from '@/lib/queries'
import { type TaskBucket, type TaskDto, taskBucket } from '@azza/shared'
import { CheckIcon, UserIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'

export const BUCKETS: TaskBucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later']

/** Open reminders split by when they're due, in the viewer's local time. */
export function groupTasks(tasks: TaskDto[], now = new Date()) {
  const groups = new Map<TaskBucket, TaskDto[]>(BUCKETS.map((b) => [b, []]))
  for (const task of tasks) groups.get(taskBucket(new Date(task.dueAt), now))!.push(task)
  // High priority first within a group; the list is already soonest first.
  for (const list of groups.values()) list.sort((a, b) => Number(b.priority === 'HIGH') - Number(a.priority === 'HIGH'))
  return groups
}

/** "14:30" for today and tomorrow, "Thu 14:30" this week, a full date further out or overdue. */
function useDueLabel() {
  const { formatDate } = useLang()
  const fmt = useFormat()
  return (task: TaskDto, bucket: TaskBucket | null) => {
    const due = new Date(task.dueAt)
    if (bucket === 'today' || bucket === 'tomorrow') return fmt.time(task.dueAt)
    if (bucket === 'week') return formatDate(due, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    return fmt.dayTime(task.dueAt)
  }
}

/** One reminder: a round check to complete it, and the row itself opens it for editing. */
export function ReminderRow({
  task,
  bucket,
  onOpen,
  showPatient = true,
}: {
  task: TaskDto
  /** Null for done reminders. */
  bucket: TaskBucket | null
  onOpen: (task: TaskDto) => void
  showPatient?: boolean
}) {
  const { t, lang } = useLang()
  const fmt = useFormat()
  const setDone = useSetTaskDone()
  const dueLabel = useDueLabel()
  const done = !!task.completedAt
  const overdue = bucket === 'overdue'
  const high = task.priority === 'HIGH'

  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:px-5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? t('reminders.markOpen') : t('reminders.markDone')}
        title={done ? t('reminders.markOpen') : t('reminders.markDone')}
        disabled={setDone.isPending}
        onClick={() => setDone.mutate({ taskId: task.id, done: !done })}
        className={clsx(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50',
          done
            ? 'bg-brand-600 ring-brand-600'
            : high
              ? 'ring-red-500 hover:bg-red-50 dark:hover:bg-red-950/40'
              : 'ring-zinc-300 hover:bg-zinc-100 dark:ring-zinc-600 dark:hover:bg-white/5',
        )}
      >
        {done && <CheckIcon className="size-3.5 fill-white" />}
      </button>
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="min-w-0 flex-1 rounded text-start focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={clsx(
              'text-sm/6 font-medium',
              done ? 'text-zinc-500 line-through' : 'text-zinc-950 dark:text-white',
            )}
          >
            {task.title}
          </span>
          {high && !done && <Badge color="red">{t('reminders.high')}</Badge>}
        </span>
        {task.notes && <span className="line-clamp-2 block text-sm/6 text-zinc-500">{task.notes}</span>}
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs/5 text-zinc-500">
          {done ? (
            <span>
              {task.completedBy
                ? t('reminders.doneBy', { date: fmt.dayTime(task.completedAt!), name: task.completedBy.fullName })
                : t('reminders.doneAt', { date: fmt.dayTime(task.completedAt!) })}
            </span>
          ) : (
            <span className={clsx('font-medium tabular-nums', overdue && 'text-red-700 dark:text-red-400')}>
              {dueLabel(task, bucket)}
            </span>
          )}
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <UserIcon className="size-3 fill-zinc-400" />
            {task.assignee?.fullName ?? t('reminders.unassigned')}
          </span>
        </span>
      </button>
      {showPatient && task.patient && (
        <Link
          href={`/patients/${task.patient.id}?tab=reminders`}
          className="mt-0.5 max-w-[40%] shrink-0 truncate rounded-full bg-brand-50 px-2.5 text-xs/6 font-medium text-brand-800 hover:bg-brand-100 dark:bg-brand-950/50 dark:text-brand-200"
        >
          {(lang === 'ar' && task.patient.fullNameAr) || task.patient.fullName}
        </Link>
      )}
    </li>
  )
}

/** Open reminders as Overdue / Today / Tomorrow / This week / Later sections; empty ones are skipped. */
export function ReminderGroups({
  tasks,
  onOpen,
  showPatient = true,
}: {
  tasks: TaskDto[]
  onOpen: (task: TaskDto) => void
  showPatient?: boolean
}) {
  const { t } = useLang()
  const groups = groupTasks(tasks)
  return (
    <div className="space-y-4">
      {BUCKETS.map((bucket) => {
        const items = groups.get(bucket)!
        if (!items.length) return null
        return (
          <section
            key={bucket}
            className={clsx(
              'rounded-xl bg-white ring-1 dark:bg-zinc-900',
              bucket === 'overdue'
                ? 'ring-red-200 dark:ring-red-900'
                : bucket === 'today'
                  ? 'ring-brand-200 dark:ring-brand-900'
                  : 'ring-zinc-950/8 dark:ring-white/10',
            )}
          >
            <header
              className={clsx(
                'flex items-baseline justify-between gap-3 rounded-t-xl border-b px-4 py-2.5 sm:px-5',
                bucket === 'overdue'
                  ? 'border-red-100 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
                  : bucket === 'today'
                    ? 'border-brand-100 bg-brand-50 text-brand-800 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-200'
                    : 'border-zinc-950/5 text-zinc-950 dark:border-white/5 dark:text-white',
              )}
            >
              <h2 className="text-sm/6 font-semibold">{t(`reminders.buckets.${bucket}`)}</h2>
              <span className="text-xs/5 font-medium tabular-nums opacity-80">{items.length}</span>
            </header>
            <ul className="divide-y divide-zinc-950/5 dark:divide-white/5">
              {items.map((task) => (
                <ReminderRow key={task.id} task={task} bucket={bucket} onOpen={onOpen} showPatient={showPatient} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/** How many of these are overdue or due today: what needs attention now. */
export function dueNowCount(tasks: TaskDto[] | undefined, now = new Date()) {
  return (tasks ?? []).filter((task) => {
    const b = taskBucket(new Date(task.dueAt), now)
    return b === 'overdue' || b === 'today'
  }).length
}
