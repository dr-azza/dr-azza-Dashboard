import { RequestError, strOrNull, todayInputValue, useFormat } from '@/components/app/form'
import { SidePanel } from '@/components/app/side-panel'
import { Button } from '@/components/catalyst/button'
import { Description, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { Textarea } from '@/components/catalyst/textarea'
import { useLang } from '@/i18n'
import { financeReceiptUrl } from '@/lib/api'
import {
  useCreateFinanceEntry,
  useFinanceCategories,
  useFinanceEntry,
  useRemoveFinanceReceipt,
  useUpdateFinanceEntry,
  useUploadFinanceReceipt,
  useVoidFinanceEntry,
} from '@/lib/queries'
import { uploadMaxMb } from '@/lib/upload-limit'
import {
  ALLOWED_UPLOAD_TYPES,
  CreateFinanceEntrySchema,
  type FinanceEntryDto,
  type FinanceKindCode,
  PAYMENT_METHODS,
  type UpdateFinanceEntryInput,
} from '@azza/shared'
import { ArrowPathIcon, DocumentIcon, PaperClipIcon, XMarkIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useRef, useState } from 'react'

/** Add income or an expense (no `entry`), or view, edit and void one. */
export function FinanceEntryPanel({
  entry: initialEntry,
  kind: initialKind = 'EXPENSE',
  onClose,
}: {
  entry?: FinanceEntryDto
  kind?: FinanceKindCode
  onClose: () => void
}) {
  const { t, l } = useLang()
  const fmt = useFormat()
  const categories = useFinanceCategories(true)
  const create = useCreateFinanceEntry()
  const update = useUpdateFinanceEntry()
  const voidEntry = useVoidFinanceEntry()
  const upload = useUploadFinanceReceipt()
  const removeReceipt = useRemoveFinanceReceipt()
  // Once a new entry is saved, the panel works on it: retrying failed receipts must not create
  // the entry a second time. The query keeps its receipts current while the panel is open.
  const [createdId, setCreatedId] = useState<string | undefined>()
  const live = useFinanceEntry(initialEntry?.id ?? createdId, initialEntry)
  const entry = live.data

  const [kind, setKind] = useState<FinanceKindCode>(entry?.kind ?? initialKind)
  const [categoryId, setCategoryId] = useState(entry?.category.id ?? '')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [voiding, setVoiding] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const voided = !!entry?.voidedAt
  const pending = create.isPending || update.isPending || upload.isPending || voidEntry.isPending

  // Active categories of this kind, plus the entry's own even if since archived.
  const options = (categories.data ?? []).filter((c) => c.kind === kind && (!c.archived || c.id === entry?.category.id))
  const selected = options.some((c) => c.id === categoryId) ? categoryId : (options[0]?.id ?? '')

  /** Uploads files one by one; returns the names that failed. */
  async function uploadAll(entryId: string, files: File[]) {
    const failed: string[] = []
    for (const file of files) {
      try {
        await upload.mutateAsync({ entryId, file })
      } catch {
        failed.push(file.name)
      }
    }
    return failed
  }

  const title = entry
    ? t(kind === 'EXPENSE' ? 'finance.entry.editExpense' : 'finance.entry.editIncome')
    : t(kind === 'EXPENSE' ? 'finance.entry.newExpense' : 'finance.entry.newIncome')

  return (
    <SidePanel
      open
      onClose={onClose}
      title={title}
      description={
        entry ? (
          <>
            {entry.createdBy && t('finance.entry.addedBy', { name: entry.createdBy.fullName })}
            {entry.recurringId && <> · {t('finance.entry.fromRecurring')}</>}
          </>
        ) : undefined
      }
      noValidate
      onSubmit={async (event) => {
        event.preventDefault()
        if (voided) return
        const f = new FormData(event.currentTarget)
        const parsed = CreateFinanceEntrySchema.safeParse({
          categoryId: selected,
          amount: Number(f.get('amount')),
          method: f.get('method'),
          occurredOn: f.get('occurredOn'),
          description: String(f.get('description') ?? ''),
          counterparty: strOrNull(f.get('counterparty')),
          reference: strOrNull(f.get('reference')),
          notes: strOrNull(f.get('notes')),
        })
        if (!parsed.success) {
          const issue = parsed.error.issues[0]
          const field = String(issue?.path[0])
          const names: Record<string, string> = {
            amount: t('finance.entry.amount'),
            occurredOn: t('finance.entry.date'),
            description: t('finance.entry.description'),
            categoryId: t('finance.entry.category'),
          }
          return setFormError(`${names[field] ?? field}: ${issue?.message}`)
        }
        setFormError(null)
        const d = parsed.data
        let saved: FinanceEntryDto
        if (!entry) {
          saved = await create.mutateAsync(d)
          setCreatedId(saved.id)
        } else {
          // Send only what changed, so an edit never rewrites fields nobody touched.
          const changes: UpdateFinanceEntryInput = {}
          if (d.categoryId !== entry.category.id) changes.categoryId = d.categoryId
          if (d.amount !== Number(entry.amount)) changes.amount = d.amount
          if (d.method !== entry.method) changes.method = d.method
          if (d.occurredOn !== entry.occurredOn) changes.occurredOn = d.occurredOn
          if (d.description !== entry.description) changes.description = d.description
          if ((d.counterparty ?? null) !== entry.counterparty) changes.counterparty = d.counterparty ?? null
          if ((d.reference ?? null) !== entry.reference) changes.reference = d.reference ?? null
          if ((d.notes ?? null) !== entry.notes) changes.notes = d.notes ?? null
          saved = Object.keys(changes).length ? await update.mutateAsync({ entryId: entry.id, ...changes }) : entry
        }
        const failed = await uploadAll(saved.id, pendingFiles)
        if (failed.length) {
          // The entry is saved; keep the panel open on it so the receipts can be retried.
          setPendingFiles(pendingFiles.filter((file) => failed.includes(file.name)))
          return setFormError(t('finance.entry.uploadFailed', { names: failed.join(', ') }))
        }
        onClose()
      }}
      actions={
        <>
          {entry && !voided && !voiding && (
            <Button plain className="me-auto" onClick={() => setVoiding(true)}>
              <span className="text-red-600 dark:text-red-400">{t('finance.entry.void')}</span>
            </Button>
          )}
          <Button plain onClick={onClose}>
            {t('record.cancel')}
          </Button>
          {!voided && (
            <Button type="submit" color="brand" disabled={pending || !selected}>
              {t('record.save')}
            </Button>
          )}
        </>
      }
    >
      <FieldGroup>
        {voided && entry && (
          <p className="rounded-lg bg-zinc-100 px-4 py-3 text-sm/6 text-zinc-700 dark:bg-white/5 dark:text-zinc-300">
            <span className="font-semibold">{t('finance.tx.voided')}.</span>{' '}
            {t('finance.entry.voidedBy', { name: entry.voidedBy?.fullName ?? '—', reason: entry.voidReason ?? '' })}
          </p>
        )}
        {voiding && entry && (
          <VoidBox
            pending={voidEntry.isPending}
            error={voidEntry.error}
            onCancel={() => setVoiding(false)}
            onVoid={async (reason) => {
              await voidEntry.mutateAsync({ entryId: entry.id, reason })
              onClose()
            }}
          />
        )}

        <fieldset disabled={voided} className="space-y-8 disabled:opacity-70">
          {!entry && (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('finance.entry.type')}>
              {(['EXPENSE', 'INCOME'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={clsx(
                    'rounded-lg px-3 py-2.5 text-sm/5 font-medium ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-brand-600',
                    kind === k
                      ? k === 'EXPENSE'
                        ? 'bg-amber-50 text-amber-900 ring-2 ring-amber-500 dark:bg-amber-950/40 dark:text-amber-200'
                        : 'bg-brand-50 text-brand-800 ring-2 ring-brand-600 dark:bg-brand-950/50 dark:text-brand-200'
                      : 'bg-white text-zinc-700 ring-zinc-950/10 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10',
                  )}
                >
                  {t(k === 'EXPENSE' ? 'finance.entry.expense' : 'finance.entry.income')}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <Field>
              <Label>{t('finance.entry.amount')}</Label>
              <Input
                name="amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                defaultValue={entry ? Number(entry.amount) : ''}
                autoFocus={!entry}
                dir="ltr"
              />
            </Field>
            <Field>
              <Label>{t('finance.entry.date')}</Label>
              <Input name="occurredOn" type="date" defaultValue={entry?.occurredOn ?? todayInputValue()} />
            </Field>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field>
              <Label>{t('finance.entry.category')}</Label>
              <Select value={selected} onChange={(e) => setCategoryId(e.target.value)}>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {l(c.name)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>{t('finance.entry.method')}</Label>
              <Select name="method" defaultValue={entry?.method ?? 'CASH'}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(`record.payments.methods.${m}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field>
            <Label>{t('finance.entry.description')}</Label>
            <Input
              name="description"
              defaultValue={entry?.description ?? ''}
              placeholder={t(
                kind === 'EXPENSE' ? 'finance.entry.expensePlaceholder' : 'finance.entry.incomePlaceholder',
              )}
              maxLength={200}
            />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field>
              <Label>{t(kind === 'EXPENSE' ? 'finance.entry.paidTo' : 'finance.entry.receivedFrom')}</Label>
              <Input name="counterparty" defaultValue={entry?.counterparty ?? ''} maxLength={120} />
            </Field>
            <Field>
              <Label>{t('finance.entry.reference')}</Label>
              <Input name="reference" defaultValue={entry?.reference ?? ''} maxLength={120} dir="auto" />
              <Description>{t('finance.entry.referenceHint')}</Description>
            </Field>
          </div>

          <Field>
            <Label>{t('finance.entry.notes')}</Label>
            <Textarea name="notes" rows={2} defaultValue={entry?.notes ?? ''} maxLength={1000} />
          </Field>
        </fieldset>

        <Field>
          <Label>{t('finance.entry.receipts')}</Label>
          <Description>{t('finance.entry.receiptHint', { mb: uploadMaxMb })}</Description>
          <ul className="mt-3 space-y-2">
            {entry?.receipts.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-white/5">
                <DocumentIcon className="size-4 shrink-0 fill-zinc-400" />
                <a
                  href={financeReceiptUrl(r.id)}
                  target="_blank"
                  rel="noopener"
                  className="min-w-0 flex-1 truncate text-sm/6 font-medium text-brand-700 hover:underline dark:text-brand-300"
                >
                  {r.fileName}
                </a>
                <span className="text-xs/5 text-zinc-500">{fmt.bytes(r.sizeBytes)}</span>
                {!voided && (
                  <Button plain disabled={removeReceipt.isPending} onClick={() => removeReceipt.mutate(r.id)}>
                    <XMarkIcon />
                    <span className="sr-only sm:not-sr-only">{t('finance.entry.removeReceipt')}</span>
                  </Button>
                )}
              </li>
            ))}
            {pendingFiles.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="ring-dashed flex items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-zinc-950/10 dark:ring-white/10"
              >
                {upload.isPending ? (
                  <ArrowPathIcon className="size-4 shrink-0 animate-spin fill-zinc-400" />
                ) : (
                  <PaperClipIcon className="size-4 shrink-0 fill-zinc-400" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm/6">{file.name}</span>
                <span className="text-xs/5 text-zinc-500">{fmt.bytes(file.size)}</span>
                <Button plain onClick={() => setPendingFiles(pendingFiles.filter((_, j) => j !== i))}>
                  <XMarkIcon />
                </Button>
              </li>
            ))}
          </ul>
          {!voided && (
            <div className="mt-3">
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                accept={ALLOWED_UPLOAD_TYPES.join(',')}
                onChange={(e) => {
                  setPendingFiles([...pendingFiles, ...Array.from(e.target.files ?? [])])
                  e.target.value = ''
                }}
              />
              <Button outline onClick={() => fileInput.current?.click()}>
                <PaperClipIcon />
                {t('finance.entry.addReceipt')}
              </Button>
            </div>
          )}
        </Field>

        {formError && <RequestError error={new Error(formError)} />}
        <RequestError error={create.error ?? update.error ?? removeReceipt.error} />
      </FieldGroup>
    </SidePanel>
  )
}

/** Inline confirmation with a reason: no pop-ups. */
function VoidBox({
  pending,
  error,
  onCancel,
  onVoid,
}: {
  pending: boolean
  error: unknown
  onCancel: () => void
  onVoid: (reason: string) => void
}) {
  const { t } = useLang()
  const [reason, setReason] = useState('')
  return (
    <div className="space-y-3 rounded-lg bg-red-50 p-4 ring-1 ring-red-200 dark:bg-red-950/40 dark:ring-red-900">
      <p className="text-sm/6 font-semibold text-red-900 dark:text-red-200">{t('finance.entry.voidTitle')}</p>
      <p className="text-sm/6 text-red-800 dark:text-red-300">{t('finance.entry.voidHint')}</p>
      <Field>
        <Label>{t('finance.entry.voidReason')}</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus maxLength={300} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button plain onClick={onCancel}>
          {t('record.cancel')}
        </Button>
        <Button color="red" disabled={pending || !reason.trim()} onClick={() => onVoid(reason.trim())}>
          {t('finance.entry.void')}
        </Button>
      </div>
      <RequestError error={error} />
    </div>
  )
}
