import { useLang } from '@/i18n'
import { localeFor } from '@azza/i18n'
import { ApiError } from '@/lib/api'
import { ExclamationTriangleIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'

/** Shows a failed request's message (and field errors) in a consistent way. */
export function RequestError({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null
  const message = error instanceof ApiError ? error.message : String((error as Error)?.message ?? error)
  const fields = error instanceof ApiError ? error.fieldErrors : []
  return (
    <div
      role="alert"
      className={clsx(
        className,
        'flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm/6 text-red-800 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900',
      )}
    >
      <ExclamationTriangleIcon className="mt-1 size-4 shrink-0" />
      <div>
        <div className="font-medium">{message}</div>
        {fields.length > 0 && (
          <ul className="mt-1 list-disc ps-4">
            {fields.map((f, i) => (
              <li key={i}>
                {f.path.join('.')}: {f.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Locale-aware formatters for money, dates and file sizes. */
export function useFormat() {
  const { lang, formatDate } = useLang()
  const locale = localeFor(lang)
  return {
    money: (amount: string | number, currency = 'EGP') =>
      new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount)),
    day: (iso: string) =>
      formatDate(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    dayTime: (iso: string) =>
      formatDate(new Date(iso), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    time: (iso: string) => formatDate(new Date(iso), { hour: '2-digit', minute: '2-digit' }),
    bytes: (n: number) =>
      n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`,
  }
}

/** Value for <input type="datetime-local"> from a Date, in the browser's local time. */
export function toLocalInputValue(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const todayInputValue = () => toLocalInputValue().slice(0, 10)

/** Number input → number | null (empty means "not recorded"). */
export const numOrNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim()
  return s === '' ? null : Number(s)
}

export const strOrNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}

/** Groups an E.164 number for reading: "+201012344410" → "+20 101 234 4410". */
export function formatPhone(e164: string) {
  const m = /^\+20(\d{3})(\d{3})(\d{4})$/.exec(e164)
  if (m) return `+20 ${m[1]} ${m[2]} ${m[3]}`
  return e164.replace(/^(\+\d{1,3})(\d{3})(\d{3})(\d+)$/, '$1 $2 $3 $4')
}
