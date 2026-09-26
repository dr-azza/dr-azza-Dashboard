import {
  numOrNull,
  RequestError,
  strOrNull,
  toLocalInputValue,
  todayInputValue,
  useFormat,
} from '@/components/app/form'
import { PregnancyTimeline } from '@/components/app/pregnancy-timeline'
import { Card } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { SidePanel } from '@/components/app/side-panel'
import { Description, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { Textarea } from '@/components/catalyst/textarea'
import { useLang } from '@/i18n'
import { useAddVisit, useEndPregnancy, usePregnancies, useStartPregnancy, useVisits } from '@/lib/queries'
import { CreatePregnancySchema, CreateVisitSchema, parseDay, type PregnancyDto } from '@azza/shared'
import { PlusIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useMemo, useState } from 'react'

export function FollowUpTab({ patientId }: { patientId: string }) {
  const { t } = useLang()
  const pregnancies = usePregnancies(patientId)
  const active = pregnancies.data?.find((p) => p.status === 'ACTIVE')
  const past = pregnancies.data?.filter((p) => p.status !== 'ACTIVE') ?? []

  return (
    <div className="space-y-4">
      <RequestError error={pregnancies.error} />
      {active ? (
        <ActivePregnancy patientId={patientId} pregnancy={active} />
      ) : (
        pregnancies.isSuccess && <StartPregnancy patientId={patientId} />
      )}
      {past.length > 0 && (
        <Card title={t('record.followUp.past')}>
          <ul className="divide-y divide-zinc-950/5 text-sm/6 dark:divide-white/5">
            {past.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>LMP {p.lmp}</span>
                <span className="text-zinc-500">
                  {t(p.status === 'DELIVERED' ? 'record.followUp.delivered' : 'record.followUp.ended')}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Visits patientId={patientId} />
    </div>
  )
}

function ActivePregnancy({ patientId, pregnancy }: { patientId: string; pregnancy: PregnancyDto }) {
  const { t } = useLang()
  const fmt = useFormat()
  const today = useMemo(() => new Date(), [])
  const end = useEndPregnancy(patientId)
  const [endOpen, setEndOpen] = useState(false)
  const daysToDue = Math.round((parseDay(pregnancy.edd).getTime() - parseDay(todayInputValue()).getTime()) / 86_400_000)

  return (
    <Card
      title={t('record.followUp.pregnancy')}
      action={
        <Button plain onClick={() => setEndOpen(true)}>
          {t('record.followUp.end')}
        </Button>
      }
      bodyClassName="px-5 pb-5"
    >
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          [t('file.lmp'), fmt.day(pregnancy.lmp)],
          [t('file.edd'), fmt.day(pregnancy.edd)],
          [t('file.ga'), t('file.gaLong', { w: pregnancy.weeks, d: pregnancy.days })],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-zinc-50 px-4 py-3 dark:bg-white/5">
            <dt className="text-xs/5 text-zinc-500 dark:text-zinc-400">{label}</dt>
            <dd className="mt-0.5 text-sm/6 font-semibold text-zinc-950 dark:text-white">{value}</dd>
          </div>
        ))}
      </dl>
      <Text className="mt-3">{t('file.weekOf', { w: pregnancy.weeks, days: Math.max(0, daysToDue) })}</Text>
      {pregnancy.riskNotes && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-2 text-sm/6 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900">
          {pregnancy.riskNotes}
        </p>
      )}
      <div className="mt-6 overflow-x-auto">
        <div className="min-w-[640px] px-10">
          <PregnancyTimeline lmp={parseDay(pregnancy.lmp)} today={today} />
        </div>
      </div>

      <SidePanel
        open={endOpen}
        onClose={setEndOpen}
        size="sm"
        title={t('record.followUp.endConfirm')}
        actions={
          <>
            <Button plain onClick={() => setEndOpen(false)}>
              {t('record.cancel')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          {(['DELIVERED', 'ENDED'] as const).map((status) => (
            <Button
              key={status}
              outline
              disabled={end.isPending}
              onClick={() => end.mutate({ pregnancyId: pregnancy.id, status }, { onSuccess: () => setEndOpen(false) })}
            >
              {t(status === 'DELIVERED' ? 'record.followUp.delivered' : 'record.followUp.ended')}
            </Button>
          ))}
          <RequestError error={end.error} />
        </div>
      </SidePanel>
    </Card>
  )
}

function StartPregnancy({ patientId }: { patientId: string }) {
  const { t } = useLang()
  const start = useStartPregnancy(patientId)
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
        <Text>{t('record.followUp.noPregnancy')}</Text>
        <Button color="brand" onClick={() => setOpen(true)}>
          <PlusIcon />
          {t('record.followUp.start')}
        </Button>
      </div>
      <SidePanel
        open={open}
        onClose={setOpen}
        title={t('record.followUp.start')}
        onSubmit={async (event) => {
          event.preventDefault()
          const f = new FormData(event.currentTarget)
          const input = CreatePregnancySchema.parse({
            lmp: f.get('lmp'),
            eddOverride: strOrNull(f.get('eddOverride')),
            riskNotes: strOrNull(f.get('riskNotes')),
          })
          await start.mutateAsync(input)
          setOpen(false)
        }}
        actions={
          <>
            <Button plain onClick={() => setOpen(false)}>
              {t('record.cancel')}
            </Button>
            <Button type="submit" color="brand" disabled={start.isPending}>
              {t('record.save')}
            </Button>
          </>
        }
      >
        <FieldGroup>
          <Field>
            <Label>{t('record.followUp.lmp')}</Label>
            <Input type="date" name="lmp" required max={todayInputValue()} />
          </Field>
          <Field>
            <Label>
              {t('record.followUp.eddOverride')} <span className="text-zinc-400">({t('record.optional')})</span>
            </Label>
            <Input type="date" name="eddOverride" />
            <Description>{t('record.followUp.eddOverrideHint')}</Description>
          </Field>
          <Field>
            <Label>{t('record.followUp.riskNotes')}</Label>
            <Textarea name="riskNotes" rows={2} />
          </Field>
          <RequestError error={start.error} />
        </FieldGroup>
      </SidePanel>
    </Card>
  )
}

function Visits({ patientId }: { patientId: string }) {
  const { t } = useLang()
  const fmt = useFormat()
  const visits = useVisits(patientId)
  const add = useAddVisit(patientId)
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  return (
    <Card
      title={t('record.followUp.visits')}
      action={
        <Button color="brand" onClick={() => setOpen(true)}>
          <PlusIcon />
          {t('record.followUp.addVisit')}
        </Button>
      }
      bodyClassName="px-5 pb-2"
    >
      <RequestError error={visits.error} />
      {visits.data?.length === 0 && <Text className="pb-4">{t('record.followUp.noVisits')}</Text>}
      {!!visits.data?.length && (
        <Table dense className="[--gutter:--spacing(5)]">
          <TableHead>
            <TableRow>
              <TableHeader>{t('file.colDate')}</TableHeader>
              <TableHeader>{t('record.followUp.week')}</TableHeader>
              <TableHeader>{t('file.colWeight')}</TableHeader>
              <TableHeader>{t('file.colBp')}</TableHeader>
              <TableHeader className="max-md:hidden">{t('file.colFundal')}</TableHeader>
              <TableHeader className="max-md:hidden">{t('file.colFhr')}</TableHeader>
              <TableHeader className="max-lg:hidden">{t('file.colNotes')}</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {visits.data.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium tabular-nums">
                  {fmt.day(v.visitedAt)}
                  {v.isPatientReport && (
                    <div className="text-xs/5 font-normal text-zinc-500">{t('record.followUp.patientReport')}</div>
                  )}
                </TableCell>
                <TableCell className="tabular-nums" dir="ltr">
                  {v.gestation ? `${v.gestation.weeks}+${v.gestation.days}` : '—'}
                </TableCell>
                <TableCell className="tabular-nums">{v.weightKg ? `${v.weightKg} kg` : '—'}</TableCell>
                <TableCell
                  dir="ltr"
                  className={clsx('tabular-nums', v.highBloodPressure && 'font-bold text-red-700 dark:text-red-400')}
                  title={v.highBloodPressure ? t('record.followUp.highBp') : undefined}
                >
                  {v.systolic != null ? `${v.systolic}/${v.diastolic}` : '—'}
                </TableCell>
                <TableCell className="tabular-nums max-md:hidden">
                  {v.fundalHeightCm ? `${v.fundalHeightCm} cm` : '—'}
                </TableCell>
                <TableCell className="tabular-nums max-md:hidden">{v.fetalHeartRate ?? '—'}</TableCell>
                <TableCell className="whitespace-normal text-zinc-500 max-lg:hidden dark:text-zinc-400">
                  {v.notes}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <SidePanel
        open={open}
        onClose={setOpen}
        size="xl"
        title={t('record.followUp.addVisit')}
        onSubmit={async (event) => {
          event.preventDefault()
          const f = new FormData(event.currentTarget)
          const parsed = CreateVisitSchema.safeParse({
            visitedAt: new Date(String(f.get('visitedAt'))).toISOString(),
            weightKg: numOrNull(f.get('weightKg')),
            systolic: numOrNull(f.get('systolic')),
            diastolic: numOrNull(f.get('diastolic')),
            fundalHeightCm: numOrNull(f.get('fundalHeightCm')),
            fetalHeartRate: numOrNull(f.get('fetalHeartRate')),
            notes: strOrNull(f.get('notes')),
          })
          if (!parsed.success) return setFormError(parsed.error.issues[0]?.message ?? 'Invalid')
          setFormError(null)
          await add.mutateAsync(parsed.data)
          setOpen(false)
        }}
        actions={
          <>
            <Button plain onClick={() => setOpen(false)}>
              {t('record.cancel')}
            </Button>
            <Button type="submit" color="brand" disabled={add.isPending}>
              {t('record.save')}
            </Button>
          </>
        }
      >
        <FieldGroup>
          <Field>
            <Label>{t('record.followUp.visitedAt')}</Label>
            <Input type="datetime-local" name="visitedAt" required defaultValue={toLocalInputValue()} />
          </Field>
          <div className="grid gap-6 sm:grid-cols-3">
            <Field>
              <Label>{t('record.followUp.weight')}</Label>
              <Input type="number" name="weightKg" step="0.1" min="25" max="250" inputMode="decimal" />
            </Field>
            <Field>
              <Label>{t('record.followUp.systolic')}</Label>
              <Input type="number" name="systolic" min="50" max="260" inputMode="numeric" />
            </Field>
            <Field>
              <Label>{t('record.followUp.diastolic')}</Label>
              <Input type="number" name="diastolic" min="30" max="180" inputMode="numeric" />
            </Field>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field>
              <Label>{t('record.followUp.fundal')}</Label>
              <Input type="number" name="fundalHeightCm" step="0.5" min="5" max="50" inputMode="decimal" />
            </Field>
            <Field>
              <Label>{t('record.followUp.fhr')}</Label>
              <Input type="number" name="fetalHeartRate" min="60" max="220" inputMode="numeric" />
            </Field>
          </div>
          <Field>
            <Label>{t('record.followUp.notes')}</Label>
            <Textarea name="notes" rows={3} />
          </Field>
          {formError && <RequestError error={new Error(formError)} />}
          <RequestError error={add.error} />
        </FieldGroup>
      </SidePanel>
    </Card>
  )
}
