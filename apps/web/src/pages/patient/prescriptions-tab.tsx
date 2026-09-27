import { RequestError, useFormat } from '@/components/app/form'
import { Card } from '@/components/app/ui'
import { Badge } from '@/components/catalyst/badge'
import { Button } from '@/components/catalyst/button'
import { SidePanel } from '@/components/app/side-panel'
import { Field, FieldGroup, Fieldset, Label, Legend } from '@/components/catalyst/fieldset'
import { Subheading } from '@/components/catalyst/heading'
import { Input } from '@/components/catalyst/input'
import { Text } from '@/components/catalyst/text'
import { Textarea } from '@/components/catalyst/textarea'
import { useLang } from '@/i18n'
import { useCreatePrescription, usePrescriptions, useVoidPrescription } from '@/lib/queries'
import { CreatePrescriptionSchema, type PatientDto, type PrescriptionDto, searchDrugs } from '@azza/shared'
import { PlusIcon, PrinterIcon, TrashIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useState } from 'react'

type Item = { drugName: string; dose: string; frequency: string; duration: string; instructions: string }
const emptyItem = (): Item => ({ drugName: '', dose: '', frequency: '', duration: '', instructions: '' })

export function PrescriptionsTab({ patient }: { patient: PatientDto }) {
  const { t } = useLang()
  const list = usePrescriptions(patient.id)
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button color="brand" onClick={() => setOpen(true)}>
          <PlusIcon />
          {t('record.rx.new')}
        </Button>
      </div>
      <RequestError error={list.error} />
      {list.data?.length === 0 && <Text>{t('record.rx.none')}</Text>}
      <div className="grid gap-4 lg:grid-cols-2">
        {list.data?.map((rx) => (
          <PrescriptionCard key={rx.id} patientId={patient.id} rx={rx} />
        ))}
      </div>
      {open && <NewPrescriptionDialog patient={patient} onClose={() => setOpen(false)} />}
    </div>
  )
}

function PrescriptionCard({ patientId, rx }: { patientId: string; rx: PrescriptionDto }) {
  const { t } = useLang()
  const fmt = useFormat()
  const voidRx = useVoidPrescription(patientId)
  const [voidOpen, setVoidOpen] = useState(false)
  const voided = !!rx.voidedAt

  return (
    <Card
      className={clsx(voided && 'opacity-70')}
      title={
        <span className="flex items-center gap-2">
          {t('record.rx.number', { number: rx.number })}
          {voided && <Badge color="zinc">{t('record.rx.voided')}</Badge>}
        </span>
      }
      action={
        !voided && (
          <div className="flex gap-1">
            <Button plain href={`/print/prescription/${patientId}/${rx.id}`} target="_blank" rel="noopener">
              <PrinterIcon />
              {t('record.rx.print')}
            </Button>
            <Button plain onClick={() => setVoidOpen(true)}>
              {t('record.rx.void')}
            </Button>
          </div>
        )
      }
    >
      <p className="text-xs/5 text-zinc-500">
        {fmt.dayTime(rx.issuedAt)}
        {rx.prescribedBy && ` · ${t('record.by', { name: rx.prescribedBy.fullName })}`}
      </p>
      {rx.diagnosis && <p className="mt-2 text-sm/6 font-medium text-zinc-950 dark:text-white">{rx.diagnosis}</p>}
      <ol className={clsx('mt-3 space-y-2', voided && 'line-through')}>
        {rx.items.map((i, n) => (
          <li key={n} dir="auto" className="text-sm/6">
            <span className="font-semibold text-zinc-950 dark:text-white">{i.drugName}</span>
            {i.dose && <span> {i.dose}</span>}
            <span className="text-zinc-600 dark:text-zinc-400">
              {[i.frequency, i.duration].filter(Boolean).map((s) => ` · ${s}`)}
            </span>
            {i.instructions && <span className="block text-zinc-500">{i.instructions}</span>}
          </li>
        ))}
      </ol>
      {rx.notes && <p className="mt-3 text-sm/6 text-zinc-600 dark:text-zinc-400">{rx.notes}</p>}
      {voided && rx.voidReason && <p className="mt-3 text-xs/5 text-zinc-500">{rx.voidReason}</p>}

      <SidePanel
        open={voidOpen}
        onClose={setVoidOpen}
        size="md"
        title={t('record.rx.voidTitle')}
        description={<>{t('record.rx.voidHint')}</>}
        onSubmit={async (event) => {
          event.preventDefault()
          const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim()
          if (!reason) return
          await voidRx.mutateAsync({ prescriptionId: rx.id, reason })
          setVoidOpen(false)
        }}
        actions={
          <>
            <Button plain onClick={() => setVoidOpen(false)}>
              {t('record.cancel')}
            </Button>
            <Button type="submit" color="red" disabled={voidRx.isPending}>
              {t('record.rx.void')}
            </Button>
          </>
        }
      >
        <Field>
          <Label>{t('record.rx.voidReason')}</Label>
          <Input name="reason" required autoFocus />
        </Field>
        <RequestError error={voidRx.error} className="mt-4" />
      </SidePanel>
    </Card>
  )
}

function NewPrescriptionDialog({ patient, onClose }: { patient: PatientDto; onClose: () => void }) {
  const { t } = useLang()
  const create = useCreatePrescription(patient.id)
  const [items, setItems] = useState<Item[]>([emptyItem()])
  const [diagnosis, setDiagnosis] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const suggestions = searchDrugs(search, 10)

  const setItem = (i: number, patch: Partial<Item>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const addSuggestion = (s: (typeof suggestions)[number]) => {
    const item = {
      drugName: s.drugName,
      dose: s.dose,
      frequency: s.frequency,
      duration: s.duration ?? '',
      instructions: '',
    }
    const firstEmpty = items.findIndex((x) => !x.drugName.trim())
    setItems(firstEmpty >= 0 ? items.map((x, j) => (j === firstEmpty ? item : x)) : [...items, item])
  }

  return (
    <SidePanel
      noValidate
      open
      onClose={onClose}
      size="4xl"
      title={
        <>
          {t('record.rx.new')} · {patient.fullName}
        </>
      }
      onSubmit={async (event) => {
        event.preventDefault()
        const parsed = CreatePrescriptionSchema.safeParse({
          diagnosis: diagnosis || null,
          notes: notes || null,
          items: items.filter((i) => i.drugName.trim()),
        })
        if (!parsed.success) return setFormError(parsed.error.issues[0]?.message ?? 'Invalid')
        setFormError(null)
        await create.mutateAsync(parsed.data)
        onClose()
      }}
      actions={
        <>
          <Button plain onClick={onClose}>
            {t('record.cancel')}
          </Button>
          <Button type="submit" color="brand" disabled={create.isPending}>
            {t('record.rx.issue')}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <FieldGroup>
          <Field>
            <Label>{t('record.rx.diagnosis')}</Label>
            <Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
          </Field>
          {/* A group of inputs, so it gets a fieldset legend rather than a field label. */}
          <Fieldset className="space-y-3">
            <Legend>{t('record.rx.medicines')}</Legend>
            {items.map((item, i) => (
              <div key={i} className="space-y-2 rounded-lg bg-zinc-50 p-3 dark:bg-white/5">
                <div className="flex gap-2">
                  <Input
                    aria-label={t('record.rx.drug')}
                    placeholder={t('record.rx.drug')}
                    value={item.drugName}
                    onChange={(e) => setItem(i, { drugName: e.target.value })}
                  />
                  <Button
                    plain
                    aria-label={t('record.remove')}
                    onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : [emptyItem()])}
                  >
                    <TrashIcon />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    aria-label={t('record.rx.dose')}
                    placeholder={t('record.rx.dose')}
                    value={item.dose}
                    onChange={(e) => setItem(i, { dose: e.target.value })}
                  />
                  <Input
                    aria-label={t('record.rx.frequency')}
                    placeholder={t('record.rx.frequency')}
                    value={item.frequency}
                    onChange={(e) => setItem(i, { frequency: e.target.value })}
                  />
                  <Input
                    aria-label={t('record.rx.duration')}
                    placeholder={t('record.rx.duration')}
                    value={item.duration}
                    onChange={(e) => setItem(i, { duration: e.target.value })}
                  />
                </div>
                <Input
                  aria-label={t('record.rx.instructions')}
                  placeholder={t('record.rx.instructions')}
                  value={item.instructions}
                  onChange={(e) => setItem(i, { instructions: e.target.value })}
                />
              </div>
            ))}
            <Button outline onClick={() => setItems([...items, emptyItem()])}>
              <PlusIcon />
              {t('record.rx.addMedicine')}
            </Button>
          </Fieldset>
          <Field>
            <Label>{t('record.rx.notes')}</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </FieldGroup>

        <aside className="space-y-2">
          <Subheading level={3}>{t('record.rx.quickPick')}</Subheading>
          <Input
            type="search"
            aria-label={t('common.search')}
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {suggestions.map((s) => (
              <li key={s.drugName}>
                <button
                  type="button"
                  onClick={() => addSuggestion(s)}
                  className="w-full rounded-lg px-3 py-2 text-start hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:bg-brand-950/40"
                >
                  <span className="block text-sm/5 font-medium text-zinc-950 dark:text-white">{s.drugName}</span>
                  <span className="block text-xs/5 text-zinc-500">
                    {s.dose} · {s.frequency}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Text className="text-xs/5!">{t('record.rx.quickPickHint')}</Text>
        </aside>
      </div>
      {formError && <RequestError error={new Error(formError)} className="mt-4" />}
      <RequestError error={create.error} className="mt-4" />
    </SidePanel>
  )
}
