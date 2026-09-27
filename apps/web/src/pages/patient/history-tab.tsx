import { RequestError, strOrNull, todayInputValue, useFormat } from '@/components/app/form'
import { RichText } from '@/components/app/rich-text'
import { RichTextEditor } from '@/components/app/rich-text-editor'
import { SidePanel } from '@/components/app/side-panel'
import { Button } from '@/components/catalyst/button'
import { Description, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Text } from '@/components/catalyst/text'
import { useLang } from '@/i18n'
import { useCreateHistoryEntry, useHistoryEntries, useRemoveHistoryEntry, useUpdateHistoryEntry } from '@/lib/queries'
import { CreateHistoryEntrySchema, type HistoryEntryDto } from '@azza/shared'
import { BookOpenIcon, PencilSquareIcon, PlusIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'

/** Free-text history: as many dated rich-text entries as the doctor wants, newest first. */
export function HistoryTab({ patientId }: { patientId: string }) {
  const { t } = useLang()
  const entries = useHistoryEntries(patientId)
  const [editing, setEditing] = useState<HistoryEntryDto | 'new' | null>(null)

  return (
    <div className="space-y-4">
      {!!entries.data?.length && (
        <div className="flex justify-end">
          <Button color="brand" onClick={() => setEditing('new')}>
            <PlusIcon />
            {t('record.entries.add')}
          </Button>
        </div>
      )}
      <RequestError error={entries.error} />
      {entries.isPending && <div className="h-48 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/5" />}

      {entries.data?.length === 0 && (
        <div className="rounded-xl bg-white px-6 py-14 text-center ring-1 ring-zinc-950/8 dark:bg-zinc-900 dark:ring-white/10">
          <BookOpenIcon className="mx-auto size-6 text-brand-500" />
          <p className="mt-3 text-sm/6 font-semibold text-zinc-950 dark:text-white">{t('record.entries.empty')}</p>
          <Text className="mx-auto mt-1 max-w-sm">{t('record.entries.emptyHint')}</Text>
          <Button color="brand" className="mt-5" onClick={() => setEditing('new')}>
            <PlusIcon />
            {t('record.entries.add')}
          </Button>
        </div>
      )}

      {entries.data?.map((entry) => (
        <HistoryEntryCard key={entry.id} entry={entry} onEdit={() => setEditing(entry)} />
      ))}

      {editing && (
        <HistoryEntryPanel
          // A fresh editor per entry, so switching entries never carries text over.
          key={editing === 'new' ? 'new' : editing.id}
          patientId={patientId}
          entry={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function HistoryEntryCard({ entry, onEdit }: { entry: HistoryEntryDto; onEdit: () => void }) {
  const { t } = useLang()
  const fmt = useFormat()
  return (
    <article className="rounded-xl bg-white ring-1 ring-zinc-950/8 dark:bg-zinc-900 dark:ring-white/10">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-950/5 px-5 py-3 dark:border-white/5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <time dateTime={entry.recordedOn} className="text-sm/6 font-semibold text-brand-700 dark:text-brand-300">
              {fmt.day(entry.recordedOn)}
            </time>
            {entry.title && (
              <h3 className="text-sm/6 font-semibold text-zinc-950 [unicode-bidi:plaintext] dark:text-white">
                {entry.title}
              </h3>
            )}
          </div>
          <p className="text-xs/5 text-zinc-500 dark:text-zinc-400">
            {entry.author && t('record.entries.by', { name: entry.author.fullName })}
            {entry.editedAt &&
              ` · ${t('record.entries.edited', { when: fmt.dayTime(entry.editedAt), name: entry.editedBy?.fullName ?? '—' })}`}
          </p>
        </div>
        <Button plain onClick={onEdit}>
          <PencilSquareIcon />
          {t('record.entries.edit')}
        </Button>
      </header>
      <RichText html={entry.bodyHtml} className="px-5 py-4" />
    </article>
  )
}

function HistoryEntryPanel({
  patientId,
  entry,
  onClose,
}: {
  patientId: string
  entry?: HistoryEntryDto
  onClose: () => void
}) {
  const { t } = useLang()
  const create = useCreateHistoryEntry(patientId)
  const update = useUpdateHistoryEntry(patientId)
  const remove = useRemoveHistoryEntry(patientId)
  const [html, setHtml] = useState(entry?.bodyHtml ?? '')
  const [isEmpty, setIsEmpty] = useState(!entry)
  const [bodyError, setBodyError] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const pending = create.isPending || update.isPending || remove.isPending

  return (
    <SidePanel
      open
      onClose={onClose}
      size="4xl"
      title={entry ? t('record.entries.editTitle') : t('record.entries.newTitle')}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault()
        if (isEmpty) return setBodyError(true)
        const f = new FormData(event.currentTarget)
        const parsed = CreateHistoryEntrySchema.safeParse({
          recordedOn: String(f.get('recordedOn') ?? ''),
          title: strOrNull(f.get('title')),
          bodyHtml: html,
        })
        if (!parsed.success) {
          const issue = parsed.error.issues[0]
          const field = { recordedOn: 'date', title: 'title', bodyHtml: 'body' }[String(issue?.path[0])]
          return setFormError(field ? `${t(`record.entries.${field}`)}: ${issue?.message}` : (issue?.message ?? ''))
        }
        setFormError(null)
        if (!entry) {
          await create.mutateAsync(parsed.data)
          return onClose()
        }
        // Send only what changed; saving an untouched entry must not mark it as edited.
        const d = parsed.data
        const changes = {
          ...(d.recordedOn !== entry.recordedOn && { recordedOn: d.recordedOn }),
          ...((d.title ?? null) !== entry.title && { title: d.title ?? null }),
          ...(d.bodyHtml !== entry.bodyHtml && { bodyHtml: d.bodyHtml }),
        }
        if (Object.keys(changes).length) await update.mutateAsync({ entryId: entry.id, ...changes })
        onClose()
      }}
      actions={
        confirmRemove && entry ? (
          <>
            <span className="me-auto text-sm/6 text-zinc-600 dark:text-zinc-400">
              {t('record.entries.removeConfirm')}
            </span>
            <Button plain onClick={() => setConfirmRemove(false)}>
              {t('record.cancel')}
            </Button>
            <Button
              color="red"
              disabled={pending}
              onClick={async () => {
                await remove.mutateAsync(entry.id)
                onClose()
              }}
            >
              {t('record.entries.removeYes')}
            </Button>
          </>
        ) : (
          <>
            {entry && (
              <Button plain className="me-auto" onClick={() => setConfirmRemove(true)}>
                <span className="text-red-600 dark:text-red-400">{t('record.entries.remove')}</span>
              </Button>
            )}
            <Button plain onClick={onClose}>
              {t('record.cancel')}
            </Button>
            <Button type="submit" color="brand" disabled={pending}>
              {t('record.save')}
            </Button>
          </>
        )
      }
    >
      <FieldGroup>
        <div className="grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <Field>
            <Label>{t('record.entries.date')}</Label>
            <Input type="date" name="recordedOn" required defaultValue={entry?.recordedOn ?? todayInputValue()} />
          </Field>
          <Field>
            <Label>{t('record.entries.title')}</Label>
            <Input name="title" defaultValue={entry?.title ?? ''} maxLength={160} />
            <Description>{t('record.entries.titleHint')}</Description>
          </Field>
        </div>
        <div>
          {/* The editor is not a form control, so it is labelled directly rather than via <Field>. */}
          <p className="mb-3 text-base/6 font-medium text-zinc-950 select-none sm:text-sm/6 dark:text-white">
            {t('record.entries.body')}
          </p>
          <RichTextEditor
            aria-label={t('record.entries.body')}
            defaultValue={entry?.bodyHtml}
            placeholder={t('record.entries.placeholder')}
            autoFocus={!entry}
            invalid={bodyError}
            onChange={(value, empty) => {
              setHtml(value)
              setIsEmpty(empty)
              if (!empty) setBodyError(false)
            }}
          />
          {bodyError && <p className="mt-2 text-sm/6 text-red-600 dark:text-red-500">{t('record.entries.required')}</p>}
        </div>
        {formError && <RequestError error={new Error(formError)} />}
        <RequestError error={create.error ?? update.error ?? remove.error} />
      </FieldGroup>
    </SidePanel>
  )
}
