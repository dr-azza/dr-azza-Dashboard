import { formatPhone, RequestError, useFormat } from '@/components/app/form'
import { PatientAvatar, ToneBadge } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Input, InputGroup } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { statusKey, statusTone } from '@/components/patient/labels'
import { NewPatientPanel } from '@/components/patient/new-patient-panel'
import { useLang } from '@/i18n'
import { useCaseTypes, usePatients } from '@/lib/queries'
import { PATIENT_STATUSES, PATIENT_VISIT_MODES, type PatientStatusCode, type PatientVisitModeCode } from '@azza/shared'
import { MagnifyingGlassIcon, PlusIcon, VideoCameraIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Waits until typing pauses, so search doesn't fire a request per keystroke. */
function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

export function PatientsPage() {
  const { t, l } = useLang()
  const fmt = useFormat()
  const cases = useCaseTypes()
  const [params, setParams] = useSearchParams()
  const [newOpen, setNewOpen] = useState(false)
  const [q, setQ] = useState(params.get('q') ?? '')
  // ?case= holds a case id; older links used built-in keys (e.g. PREGNANCY), which still resolve.
  const caseParam = params.get('case') ?? undefined
  const caseTypeId = caseParam
    ? (cases.data?.find((c) => c.id === caseParam || c.systemKey === caseParam)?.id ??
      (UUID.test(caseParam) ? caseParam : undefined))
    : undefined
  const status = (params.get('status') ?? undefined) as PatientStatusCode | undefined
  const visitMode = (params.get('type') ?? undefined) as PatientVisitModeCode | undefined
  const query = useDebounced(q.trim())

  const update = (key: string, value?: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }
  // Keep the search in the URL so it survives reloads and can be shared.
  useEffect(() => update('q', query || undefined), [query]) // eslint-disable-line react-hooks/exhaustive-deps

  // Legacy keys need the case list to resolve; wait for it rather than querying unfiltered.
  const patients = usePatients(
    { q: query || undefined, caseTypeId, status, visitMode },
    { enabled: !caseParam || !!caseTypeId || cases.isFetched },
  )
  const rows = patients.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <Heading className="headline">{t('patients.title')}</Heading>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <InputGroup className="flex-1 sm:w-80">
            <MagnifyingGlassIcon data-slot="icon" />
            <Input
              type="search"
              aria-label={t('common.search')}
              placeholder={t('common.searchPatients')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </InputGroup>
          <Button color="brand" onClick={() => setNewOpen(true)}>
            <PlusIcon />
            {t('common.newPatient')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Filters come from the clinic's own cases, including ones added in Settings or while adding a patient. */}
        {[
          { id: undefined, label: t('patients.all'), count: undefined as number | undefined },
          ...(cases.data ?? []).map((c) => ({ id: c.id, label: l(c.name), count: c.patientCount })),
        ].map((c) => (
          <button
            key={c.id ?? 'all'}
            type="button"
            aria-pressed={caseTypeId === c.id}
            onClick={() => update('case', c.id)}
            className={clsx(
              'rounded-full px-3.5 py-1.5 text-sm/6 font-medium ring-1 transition-colors',
              caseTypeId === c.id
                ? 'bg-brand-600 text-white ring-brand-600'
                : 'bg-white text-zinc-700 ring-zinc-950/10 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10',
            )}
          >
            {c.label}
            {c.count !== undefined && <span className="ms-1.5 tabular-nums opacity-70">{c.count}</span>}
          </button>
        ))}
        <div className="ms-auto w-44">
          <Select
            aria-label={t('patients.typeFilter')}
            value={visitMode ?? ''}
            onChange={(e) => update('type', e.target.value || undefined)}
          >
            <option value="">{t('patients.allTypes')}</option>
            {PATIENT_VISIT_MODES.map((m) => (
              <option key={m} value={m}>
                {t(`record.visitModes.${m}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-44">
          <Select
            aria-label={t('patients.statusFilter')}
            value={status ?? ''}
            onChange={(e) => update('status', e.target.value || undefined)}
          >
            <option value="">{t('patients.allStatuses')}</option>
            {PATIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(statusKey(s))}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <RequestError error={patients.error} />

      <Table
        striped
        className={clsx(
          '[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]',
          patients.isFetching && !patients.isFetchingNextPage && 'opacity-70',
        )}
      >
        <TableHead>
          <TableRow>
            <TableHeader>{t('patients.colPatient')}</TableHeader>
            <TableHeader className="max-md:hidden">{t('patients.colAge')}</TableHeader>
            <TableHeader className="max-lg:hidden">{t('patients.colPhone')}</TableHeader>
            <TableHeader>{t('patients.colCase')}</TableHeader>
            <TableHeader>{t('patients.colStage')}</TableHeader>
            <TableHeader className="max-md:hidden">{t('patients.colLast')}</TableHeader>
            <TableHeader>{t('patients.colStatus')}</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id} href={`/patients/${p.id}`} title={p.fullName}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <PatientAvatar name={p.fullName} className="size-9" />
                  <div>
                    <div className="font-medium">{p.fullName}</div>
                    <div className="text-xs/5 text-zinc-500 dark:text-zinc-400">
                      {p.fileNumber}
                      {p.fullNameAr && <span lang="ar"> · {p.fullNameAr}</span>}
                      {p.visitMode === 'ONLINE' && (
                        <span className="ms-1 inline-flex items-center gap-0.5 font-medium text-sky-700 dark:text-sky-400">
                          <VideoCameraIcon className="size-3 fill-current" />
                          {t('record.visitModes.ONLINE')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="tabular-nums max-md:hidden">{p.age ?? '—'}</TableCell>
              <TableCell className="text-zinc-500 tabular-nums max-lg:hidden" dir="ltr">
                {formatPhone(p.phone)}
              </TableCell>
              <TableCell>{l(p.caseType.name)}</TableCell>
              <TableCell className="font-medium tabular-nums">
                {p.activePregnancy ? t('common.ga', { w: p.activePregnancy.weeks, d: p.activePregnancy.days }) : '—'}
              </TableCell>
              <TableCell className="text-zinc-500 max-md:hidden">
                {p.lastVisitAt ? fmt.day(p.lastVisitAt) : '—'}
              </TableCell>
              <TableCell>
                <ToneBadge tone={statusTone[p.status]}>{t(statusKey(p.status))}</ToneBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {!patients.isPending && rows.length === 0 && <Text className="py-10 text-center">{t('patients.empty')}</Text>}
      {patients.hasNextPage && (
        <div className="flex justify-center">
          <Button outline onClick={() => patients.fetchNextPage()} disabled={patients.isFetchingNextPage}>
            {t('record.loadMore')}
          </Button>
        </div>
      )}

      <NewPatientPanel open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  )
}
