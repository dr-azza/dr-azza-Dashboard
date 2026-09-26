import { numOrNull, RequestError, strOrNull, useFormat } from '@/components/app/form'
import { Card } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Description, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { Text } from '@/components/catalyst/text'
import { Textarea } from '@/components/catalyst/textarea'
import { useLang } from '@/i18n'
import {
  useAddObstetricEntry,
  useMedicalHistory,
  useObstetricHistory,
  useRemoveObstetricEntry,
  useSaveMedicalHistory,
} from '@/lib/queries'
import {
  ALLERGY_SEVERITIES,
  BLOOD_GROUPS,
  DELIVERY_MODES,
  type MedicalHistoryDto,
  MedicalHistorySchema,
  ObstetricEntrySchema,
  PREGNANCY_OUTCOMES,
} from '@azza/shared'
import { CheckIcon, PlusIcon, TrashIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'

export function HistoryTab({ patientId }: { patientId: string }) {
  const history = useMedicalHistory(patientId)
  return (
    <div className="space-y-4">
      <RequestError error={history.error} />
      {/* Re-mount on save so the form shows exactly what was stored. */}
      {history.data && (
        <MedicalHistoryForm key={history.data.updatedAt ?? 'new'} patientId={patientId} history={history.data} />
      )}
      <ObstetricHistory patientId={patientId} />
    </div>
  )
}

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

const triState = (v: FormDataEntryValue | null) => (v === 'yes' ? true : v === 'no' ? false : null)
const triValue = (v: boolean | null) => (v === true ? 'yes' : v === false ? 'no' : '')

/** Yes / No / Unknown. Defined at module level so typing elsewhere never remounts it (and resets it). */
function TriSelect({ name, value }: { name: string; value: boolean | null }) {
  const { t } = useLang()
  return (
    <Select name={name} defaultValue={triValue(value)}>
      <option value="">{t('record.unknown')}</option>
      <option value="yes">{t('record.yes')}</option>
      <option value="no">{t('record.no')}</option>
    </Select>
  )
}

function MedicalHistoryForm({ patientId, history }: { patientId: string; history: MedicalHistoryDto }) {
  const { t } = useLang()
  const fmt = useFormat()
  const save = useSaveMedicalHistory(patientId)
  const [allergies, setAllergies] = useState(history.allergies)
  const [surgeries, setSurgeries] = useState(history.surgeries)
  const [saved, setSaved] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault()
        const f = new FormData(event.currentTarget)
        const parsed = MedicalHistorySchema.safeParse({
          allergies: allergies.filter((a) => a.substance.trim()),
          chronicConditions: lines(f.get('chronicConditions')),
          currentMedications: lines(f.get('currentMedications')),
          surgeries: surgeries.filter((s) => s.name.trim()),
          bloodGroup: strOrNull(f.get('bloodGroup')),
          familyHistory: strOrNull(f.get('familyHistory')),
          smoking: triState(f.get('smoking')),
          menarcheAge: numOrNull(f.get('menarcheAge')),
          cycleLengthDays: numOrNull(f.get('cycleLengthDays')),
          periodLengthDays: numOrNull(f.get('periodLengthDays')),
          cycleRegular: triState(f.get('cycleRegular')),
          contraception: strOrNull(f.get('contraception')),
          lastPapSmearAt: strOrNull(f.get('lastPapSmearAt')),
          lastPapSmearResult: strOrNull(f.get('lastPapSmearResult')),
          gynNotes: strOrNull(f.get('gynNotes')),
        })
        if (!parsed.success) {
          const issue = parsed.error.issues[0]
          return setFormError(`${issue?.path.join('.')}: ${issue?.message}`)
        }
        setFormError(null)
        await save.mutateAsync(parsed.data)
        setSaved(true)
      }}
    >
      <Card title={t('record.history.general')} bodyClassName="px-5 pb-5">
        <FieldGroup>
          <Field>
            <Label>{t('record.history.allergies')}</Label>
            <div className="mt-3 space-y-2">
              {allergies.map((a, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_9rem_auto] gap-2">
                  <Input
                    aria-label={t('record.history.substance')}
                    placeholder={t('record.history.substance')}
                    value={a.substance}
                    onChange={(e) =>
                      setAllergies(allergies.map((x, j) => (j === i ? { ...x, substance: e.target.value } : x)))
                    }
                  />
                  <Input
                    aria-label={t('record.history.reaction')}
                    placeholder={t('record.history.reaction')}
                    value={a.reaction ?? ''}
                    onChange={(e) =>
                      setAllergies(allergies.map((x, j) => (j === i ? { ...x, reaction: e.target.value } : x)))
                    }
                  />
                  <Select
                    aria-label={t('record.history.severity')}
                    value={a.severity}
                    onChange={(e) =>
                      setAllergies(
                        allergies.map((x, j) =>
                          j === i ? { ...x, severity: e.target.value as typeof a.severity } : x,
                        ),
                      )
                    }
                  >
                    {ALLERGY_SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {t(`record.history.severities.${s}`)}
                      </option>
                    ))}
                  </Select>
                  <Button
                    plain
                    aria-label={t('record.remove')}
                    onClick={() => setAllergies(allergies.filter((_, j) => j !== i))}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              ))}
              <Button
                outline
                onClick={() => setAllergies([...allergies, { substance: '', reaction: null, severity: 'moderate' }])}
              >
                <PlusIcon />
                {t('record.history.addAllergy')}
              </Button>
            </div>
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field>
              <Label>{t('record.history.chronic')}</Label>
              <Textarea name="chronicConditions" rows={3} defaultValue={history.chronicConditions.join('\n')} />
              <Description>{t('record.history.chronicHint')}</Description>
            </Field>
            <Field>
              <Label>{t('record.history.medications')}</Label>
              <Textarea name="currentMedications" rows={3} defaultValue={history.currentMedications.join('\n')} />
              <Description>{t('record.history.chronicHint')}</Description>
            </Field>
          </div>

          <Field>
            <Label>{t('record.history.surgeries')}</Label>
            <div className="mt-3 space-y-2">
              {surgeries.map((s, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] gap-2">
                  <Input
                    aria-label={t('record.history.surgeryName')}
                    placeholder={t('record.history.surgeryName')}
                    value={s.name}
                    onChange={(e) =>
                      setSurgeries(surgeries.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  <Input
                    aria-label={t('record.history.year')}
                    placeholder={t('record.history.year')}
                    type="number"
                    value={s.year ?? ''}
                    onChange={(e) =>
                      setSurgeries(
                        surgeries.map((x, j) =>
                          j === i ? { ...x, year: e.target.value ? Number(e.target.value) : null } : x,
                        ),
                      )
                    }
                  />
                  <Button
                    plain
                    aria-label={t('record.remove')}
                    onClick={() => setSurgeries(surgeries.filter((_, j) => j !== i))}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              ))}
              <Button outline onClick={() => setSurgeries([...surgeries, { name: '', year: null }])}>
                <PlusIcon />
                {t('record.history.addSurgery')}
              </Button>
            </div>
          </Field>

          <div className="grid gap-6 sm:grid-cols-3">
            <Field>
              <Label>{t('record.history.bloodGroup')}</Label>
              <Select name="bloodGroup" defaultValue={history.bloodGroup ?? ''}>
                <option value="">{t('record.unknown')}</option>
                {BLOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>{t('record.history.smoking')}</Label>
              <TriSelect name="smoking" value={history.smoking} />
            </Field>
          </div>
          <Field>
            <Label>{t('record.history.familyHistory')}</Label>
            <Textarea name="familyHistory" rows={2} defaultValue={history.familyHistory ?? ''} />
          </Field>
        </FieldGroup>
      </Card>

      <Card title={t('record.history.gyn')} bodyClassName="px-5 pb-5">
        <FieldGroup>
          <div className="grid gap-6 sm:grid-cols-4">
            <Field>
              <Label>{t('record.history.menarche')}</Label>
              <Input type="number" name="menarcheAge" min="6" max="25" defaultValue={history.menarcheAge ?? ''} />
            </Field>
            <Field>
              <Label>{t('record.history.cycleLength')}</Label>
              <Input
                type="number"
                name="cycleLengthDays"
                min="10"
                max="120"
                defaultValue={history.cycleLengthDays ?? ''}
              />
            </Field>
            <Field>
              <Label>{t('record.history.periodLength')}</Label>
              <Input
                type="number"
                name="periodLengthDays"
                min="1"
                max="20"
                defaultValue={history.periodLengthDays ?? ''}
              />
            </Field>
            <Field>
              <Label>{t('record.history.cycleRegular')}</Label>
              <TriSelect name="cycleRegular" value={history.cycleRegular} />
            </Field>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <Field>
              <Label>{t('record.history.contraception')}</Label>
              <Input name="contraception" defaultValue={history.contraception ?? ''} />
            </Field>
            <Field>
              <Label>{t('record.history.lastPap')}</Label>
              <Input type="date" name="lastPapSmearAt" defaultValue={history.lastPapSmearAt ?? ''} />
            </Field>
            <Field>
              <Label>{t('record.history.lastPapResult')}</Label>
              <Input name="lastPapSmearResult" defaultValue={history.lastPapSmearResult ?? ''} />
            </Field>
          </div>
          <Field>
            <Label>{t('record.history.gynNotes')}</Label>
            <Textarea name="gynNotes" rows={2} defaultValue={history.gynNotes ?? ''} />
          </Field>
        </FieldGroup>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {formError && <RequestError error={new Error(formError)} />}
        <RequestError error={save.error} />
        {history.updatedAt && (
          <Text className="me-auto">{t('record.history.lastUpdated', { date: fmt.dayTime(history.updatedAt) })}</Text>
        )}
        {saved && !save.isPending && (
          <span className="flex items-center gap-1 text-sm/6 font-medium text-teal-700 dark:text-teal-400">
            <CheckIcon className="size-4" />
            {t('record.saved')}
          </span>
        )}
        <Button type="submit" color="brand" disabled={save.isPending}>
          {t('record.history.saveHistory')}
        </Button>
      </div>
    </form>
  )
}

function ObstetricHistory({ patientId }: { patientId: string }) {
  const { t } = useLang()
  const entries = useObstetricHistory(patientId)
  const add = useAddObstetricEntry(patientId)
  const remove = useRemoveObstetricEntry(patientId)
  const [adding, setAdding] = useState(false)

  return (
    <Card
      title={t('record.history.obstetric')}
      action={
        !adding && (
          <Button outline onClick={() => setAdding(true)}>
            <PlusIcon />
            {t('record.history.addPregnancy')}
          </Button>
        )
      }
      bodyClassName="px-5 pb-5 space-y-3"
    >
      <RequestError error={entries.error ?? remove.error} />
      {entries.data?.length === 0 && !adding && <Text>{t('record.history.noObstetric')}</Text>}
      <ul className="divide-y divide-zinc-950/5 dark:divide-white/5">
        {entries.data?.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm/6">
            <span className="w-14 font-semibold tabular-nums">{e.year ?? '—'}</span>
            <span className="flex-1">
              <span className="font-medium text-zinc-950 dark:text-white">
                {t(`record.history.outcomes.${e.outcome}`)}
              </span>
              {e.deliveryMode && (
                <span className="text-zinc-500"> · {t(`record.history.deliveries.${e.deliveryMode}`)}</span>
              )}
              {e.gestationWeeks && <span className="text-zinc-500"> · {e.gestationWeeks}w</span>}
              {e.birthWeightG && <span className="text-zinc-500"> · {e.birthWeightG} g</span>}
              {e.complications && <span className="block text-zinc-500">{e.complications}</span>}
            </span>
            <Button
              plain
              aria-label={t('record.remove')}
              onClick={() => remove.mutate(e.id)}
              disabled={remove.isPending}
            >
              <TrashIcon />
            </Button>
          </li>
        ))}
      </ul>

      {adding && (
        <form
          className="rounded-lg bg-zinc-50 p-4 dark:bg-white/5"
          onSubmit={async (event) => {
            event.preventDefault()
            const f = new FormData(event.currentTarget)
            const input = ObstetricEntrySchema.parse({
              year: numOrNull(f.get('year')),
              outcome: f.get('outcome'),
              deliveryMode: strOrNull(f.get('deliveryMode')),
              gestationWeeks: numOrNull(f.get('gestationWeeks')),
              birthWeightG: numOrNull(f.get('birthWeightG')),
              complications: strOrNull(f.get('complications')),
            })
            await add.mutateAsync(input)
            setAdding(false)
          }}
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-5">
              <Field>
                <Label>{t('record.history.year')}</Label>
                <Input type="number" name="year" min="1950" max="2100" />
              </Field>
              <Field className="sm:col-span-2">
                <Label>{t('record.history.outcome')}</Label>
                <Select name="outcome" defaultValue="LIVE_BIRTH">
                  {PREGNANCY_OUTCOMES.map((o) => (
                    <option key={o} value={o}>
                      {t(`record.history.outcomes.${o}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field className="sm:col-span-2">
                <Label>{t('record.history.delivery')}</Label>
                <Select name="deliveryMode" defaultValue="">
                  <option value="">—</option>
                  {DELIVERY_MODES.map((d) => (
                    <option key={d} value={d}>
                      {t(`record.history.deliveries.${d}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-5">
              <Field>
                <Label>{t('record.history.gestationWeeks')}</Label>
                <Input type="number" name="gestationWeeks" min="4" max="45" />
              </Field>
              <Field>
                <Label>{t('record.history.birthWeight')}</Label>
                <Input type="number" name="birthWeightG" min="200" max="7000" />
              </Field>
              <Field className="sm:col-span-3">
                <Label>{t('record.history.complications')}</Label>
                <Input name="complications" />
              </Field>
            </div>
            <RequestError error={add.error} />
            <div className="flex justify-end gap-2">
              <Button plain onClick={() => setAdding(false)}>
                {t('record.cancel')}
              </Button>
              <Button type="submit" color="brand" disabled={add.isPending}>
                {t('record.add')}
              </Button>
            </div>
          </FieldGroup>
        </form>
      )}
    </Card>
  )
}
