import { Avatar } from '@/components/catalyst/avatar'
import { Badge } from '@/components/catalyst/badge'
import type { AppointmentStatus, DeliveryStatus, PatientStatus, ResponseStatus, Tone } from '@azza/shared'
import { useLang } from '@/i18n'
import clsx from 'clsx'
import type React from 'react'

type BadgeColor = React.ComponentProps<typeof Badge>['color']

const toneColor: Record<Tone, BadgeColor> = {
  neutral: 'zinc',
  warn: 'amber',
  danger: 'red',
  ok: 'teal',
  info: 'sky',
}

export function ToneBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <Badge color={toneColor[tone]}>{children}</Badge>
}

const patientTone: Record<PatientStatus, Tone> = { ok: 'ok', flagged: 'danger', overdue: 'warn', awaiting: 'info' }
const appointmentTone: Record<AppointmentStatus, Tone> = { done: 'ok', checkedIn: 'info', upcoming: 'neutral' }
const deliveryTone: Record<DeliveryStatus, Tone> = { queued: 'neutral', sent: 'ok', failed: 'danger' }
const responseTone: Record<ResponseStatus, Tone> = {
  flagged: 'danger',
  new: 'info',
  reviewed: 'ok',
  noAnswer: 'neutral',
}

type StatusProps =
  | { kind: 'patient'; status: PatientStatus }
  | { kind: 'appointment'; status: AppointmentStatus }
  | { kind: 'delivery'; status: DeliveryStatus }
  | { kind: 'response'; status: ResponseStatus }

export function StatusBadge(props: StatusProps) {
  const { t } = useLang()
  const tone =
    props.kind === 'patient'
      ? patientTone[props.status]
      : props.kind === 'appointment'
        ? appointmentTone[props.status]
        : props.kind === 'delivery'
          ? deliveryTone[props.status]
          : responseTone[props.status]
  return <ToneBadge tone={tone}>{t(`status.${props.status}`)}</ToneBadge>
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
}

export function PatientAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar
      initials={initials(name)}
      className={clsx(className, 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200')}
    />
  )
}

/** A bordered panel used for dashboard sections. */
export function Card({
  title,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={clsx(className, 'rounded-xl bg-white ring-1 ring-zinc-950/8 dark:bg-zinc-900 dark:ring-white/10')}
    >
      {(title || action) && (
        <header className="flex items-center gap-3 px-5 pt-4 pb-2">
          <h2 className="flex-1 text-base/7 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white">{title}</h2>
          {action}
        </header>
      )}
      <div className={clsx(bodyClassName ?? 'px-5 pb-4')}>{children}</div>
    </section>
  )
}

export function StatCard({
  label,
  value,
  note,
  tone = 'neutral',
}: {
  label: string
  value: React.ReactNode
  note: string
  tone?: 'neutral' | 'danger' | 'brand'
}) {
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-950/8 dark:bg-zinc-900 dark:ring-white/10">
      <div className="text-sm/6 font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
      <div
        className={clsx(
          'mt-2 font-display text-4xl/10 font-semibold tabular-nums',
          tone === 'danger' ? 'text-red-700 dark:text-red-400' : 'text-zinc-950 dark:text-white',
        )}
      >
        {value}
      </div>
      <div
        className={clsx(
          'mt-2 text-sm/6',
          tone === 'danger' && 'text-red-700 dark:text-red-400',
          tone === 'brand' && 'font-medium text-brand-700 dark:text-brand-300',
          tone === 'neutral' && 'text-zinc-500 dark:text-zinc-400',
        )}
      >
        {note}
      </div>
    </div>
  )
}

/** A list row with a divider above it, used inside cards. */
export function ListRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={clsx(className, 'flex items-center gap-3 border-t border-zinc-950/5 py-3 dark:border-white/5')}>
      {children}
    </div>
  )
}

export function Dot({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'size-2.5 shrink-0 rounded-full',
        severity === 'high' && 'bg-red-600',
        severity === 'medium' && 'bg-amber-500',
        severity === 'low' && 'bg-zinc-400',
      )}
    />
  )
}
