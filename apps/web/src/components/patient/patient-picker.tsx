import { Button } from '@/components/catalyst/button'
import { Input } from '@/components/catalyst/input'
import { useLang } from '@/i18n'
import { usePatients } from '@/lib/queries'
import type { PatientListItemDto } from '@azza/shared'
import { useDeferredValue, useState } from 'react'

/** Search-as-you-type patient chooser (name, phone or file number). */
export function PatientPicker({
  initialQuery,
  pending,
  canUnlink,
  onPick,
}: {
  initialQuery: string
  pending: boolean
  canUnlink: boolean
  onPick: (patientId: string | null, patient?: PatientListItemDto) => void
}) {
  const { t } = useLang()
  const [q, setQ] = useState(initialQuery)
  const query = useDeferredValue(q.trim())
  const patients = usePatients({ q: query }, { enabled: query.length >= 2 })
  const items = patients.data?.pages.flatMap((p) => p.items).slice(0, 8) ?? []

  return (
    <div className="mt-4 space-y-2">
      <Input
        autoFocus
        placeholder={t('forms.responses.searchPatient')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="divide-y divide-zinc-950/5 overflow-hidden rounded-lg bg-white ring-1 ring-zinc-950/10 empty:hidden dark:divide-white/5 dark:bg-zinc-900 dark:ring-white/10">
        {items.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => onPick(p.id, p)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm/6 hover:bg-brand-50 focus-visible:bg-brand-50 focus-visible:outline-hidden dark:hover:bg-white/5"
            >
              <span className="min-w-0 truncate font-medium text-zinc-950 dark:text-white">{p.fullName}</span>
              <span className="shrink-0 text-xs/5 text-zinc-500">{p.fileNumber}</span>
            </button>
          </li>
        ))}
      </ul>
      {canUnlink && (
        <Button plain disabled={pending} onClick={() => onPick(null)}>
          {t('forms.responses.unlink')}
        </Button>
      )}
    </div>
  )
}
