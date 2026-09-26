import { PatientAvatar, StatusBadge } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Input, InputGroup } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { patients } from '@/data/mock'
import { useLang } from '@/i18n'
import { pregnancyInfo, type CaseType, type PatientStatus } from '@azza/shared'
import { ArrowDownTrayIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'

const CASES: (CaseType | 'all')[] = ['all', 'pregnancy', 'gynecology', 'postpartum', 'fertility']
const STATUSES: (PatientStatus | 'all')[] = ['all', 'flagged', 'overdue', 'awaiting', 'ok']
const STATUS_ORDER: Record<PatientStatus, number> = { flagged: 0, overdue: 1, awaiting: 2, ok: 3 }

export function PatientsPage() {
  const { t, l } = useLang()
  const today = useMemo(() => new Date(), [])
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const caseFilter = (params.get('case') ?? 'all') as CaseType | 'all'
  const statusFilter = (params.get('status') ?? 'all') as PatientStatus | 'all'

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const query = q.trim().toLowerCase()
  const rows = patients
    .filter((p) => caseFilter === 'all' || p.caseType === caseFilter)
    .filter((p) => statusFilter === 'all' || p.status === statusFilter)
    .filter(
      (p) =>
        !query ||
        p.name.en.toLowerCase().includes(query) ||
        p.name.ar.includes(q.trim()) ||
        p.file.toLowerCase().includes(query) ||
        p.phone.replace(/\s/g, '').includes(query.replace(/\s/g, '')),
    )
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

  const count = (c: CaseType | 'all') =>
    c === 'all' ? patients.length : patients.filter((p) => p.caseType === c).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <Heading className="headline">{t('patients.title')}</Heading>
          <Text className="mt-1">
            {t('patients.subtitle', {
              total: patients.length,
              preg: patients.filter((p) => p.caseType === 'pregnancy').length,
              overdue: patients.filter((p) => p.status === 'overdue').length,
            })}
          </Text>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <InputGroup className="flex-1 sm:w-72">
            <MagnifyingGlassIcon data-slot="icon" />
            <Input
              type="search"
              aria-label={t('common.search')}
              placeholder={t('common.searchPatients')}
              value={q}
              onChange={(e) => update('q', e.target.value)}
            />
          </InputGroup>
          <Button outline>
            <ArrowDownTrayIcon />
            {t('common.export')}
          </Button>
          <Button color="brand">
            <PlusIcon />
            {t('common.newPatient')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {CASES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={caseFilter === c}
            onClick={() => update('case', c)}
            className={clsx(
              'rounded-full px-3.5 py-1.5 text-sm/6 font-medium ring-1 transition-colors',
              caseFilter === c
                ? 'bg-brand-600 text-white ring-brand-600'
                : 'bg-white text-zinc-700 ring-zinc-950/10 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10',
            )}
          >
            {c === 'all' ? t('patients.all') : t(`case.${c}`)}{' '}
            <span className="tabular-nums opacity-70">· {count(c)}</span>
          </button>
        ))}
        <div className="ms-auto w-48">
          <Select
            aria-label={t('patients.statusFilter')}
            value={statusFilter}
            onChange={(e) => update('status', e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? t('patients.allStatuses') : t(`status.${s}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Table striped className="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
        <TableHead>
          <TableRow>
            <TableHeader>{t('patients.colPatient')}</TableHeader>
            <TableHeader className="max-md:hidden">{t('patients.colAge')}</TableHeader>
            <TableHeader className="max-lg:hidden">{t('patients.colPhone')}</TableHeader>
            <TableHeader>{t('patients.colCase')}</TableHeader>
            <TableHeader>{t('patients.colStage')}</TableHeader>
            <TableHeader className="max-md:hidden">{t('patients.colNext')}</TableHeader>
            <TableHeader className="max-xl:hidden">{t('patients.colLast')}</TableHeader>
            <TableHeader>{t('patients.colStatus')}</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((p) => {
            const info = pregnancyInfo(p, today)
            return (
              <TableRow key={p.id} href={`/patients/${p.id}`} title={l(p.name)}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <PatientAvatar name={p.name.en} className="size-9" />
                    <div>
                      <div className="font-medium">{l(p.name)}</div>
                      <div className="text-xs/5 text-zinc-500 dark:text-zinc-400">{p.file}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="tabular-nums max-md:hidden">{p.age}</TableCell>
                <TableCell className="text-zinc-500 tabular-nums max-lg:hidden" dir="ltr">
                  {p.phone}
                </TableCell>
                <TableCell>{t(`case.${p.caseType}`)}</TableCell>
                <TableCell className="font-medium">
                  {info ? t('common.ga', { w: info.weeks, d: info.days }) : p.stage && l(p.stage)}
                </TableCell>
                <TableCell className="max-md:hidden">
                  {p.nextVisit ? l(p.nextVisit) : <span className="text-amber-700">{t('patients.notBooked')}</span>}
                </TableCell>
                <TableCell className="text-zinc-500 max-xl:hidden">{l(p.lastContact)}</TableCell>
                <TableCell>
                  <StatusBadge kind="patient" status={p.status} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {rows.length === 0 ? (
        <Text className="py-10 text-center">{t('patients.empty')}</Text>
      ) : (
        <Text>{t('patients.showing', { shown: rows.length, total: patients.length })}</Text>
      )}
    </div>
  )
}
