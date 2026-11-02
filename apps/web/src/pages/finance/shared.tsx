import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'
import { useLang } from '@/i18n'
import { useMe } from '@/lib/queries'
import { canSeeFinance } from '@azza/shared'
import { LockClosedIcon } from '@heroicons/react/24/outline'

/** Finance pages are for owners; anyone else gets a plain explanation instead of errors. */
export function FinanceGate({ children }: { children: React.ReactNode }) {
  const { t } = useLang()
  const me = useMe()
  if (me.isPending) return <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/5" />
  if (!canSeeFinance(me.data?.role ?? '')) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <LockClosedIcon className="mx-auto size-8 text-zinc-400" />
        <Text className="mt-3">{t('finance.ownersOnly')}</Text>
      </div>
    )
  }
  return <>{children}</>
}

export function FinancePageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <Heading className="headline">{title}</Heading>
        <Text className="mt-1">{subtitle}</Text>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** Today as YYYY-MM-DD in the browser's time zone (the clinic's, in practice). */
export function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A calendar day (YYYY-MM-DD) as a Date at local noon, safe for formatting. */
export const dayDate = (day: string) => new Date(`${day}T12:00:00`)
