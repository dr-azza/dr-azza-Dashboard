import { RequestError, strOrNull, useFormat } from '@/components/app/form'
import { Card } from '@/components/app/ui'
import { Badge } from '@/components/catalyst/badge'
import { Button } from '@/components/catalyst/button'
import { SidePanel } from '@/components/app/side-panel'
import { Description, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { Text } from '@/components/catalyst/text'
import { useLang } from '@/i18n'
import { attachmentUrl } from '@/lib/api'
import { useAttachments, useDeleteAttachment, useUploadAttachment } from '@/lib/queries'
import { uploadMaxBytes, uploadMaxMb } from '@/lib/upload-limit'
import { ALLOWED_UPLOAD_TYPES, type AttachmentDto, type AttachmentKindCode } from '@azza/shared'
import { ArrowDownTrayIcon, ArrowUpTrayIcon, DocumentIcon, PhotoIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useState } from 'react'

const UPLOAD_KINDS: AttachmentKindCode[] = ['LAB_RESULT', 'SCAN', 'REPORT', 'PRESCRIPTION_SCAN', 'OTHER']

export function FilesTab({ patientId }: { patientId: string }) {
  const { t } = useLang()
  const fmt = useFormat()
  const files = useAttachments(patientId)
  const [kind, setKind] = useState<AttachmentKindCode | ''>('')
  const [open, setOpen] = useState(false)
  const [removing, setRemoving] = useState<AttachmentDto | null>(null)
  const shown = files.data?.filter((f) => !kind || f.kind === kind) ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['', ...UPLOAD_KINDS] as const).map((k) => (
          <button
            key={k || 'all'}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={clsx(
              'rounded-full px-3.5 py-1.5 text-sm/6 font-medium ring-1 transition-colors',
              kind === k
                ? 'bg-brand-600 text-white ring-brand-600'
                : 'bg-white text-zinc-700 ring-zinc-950/10 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10',
            )}
          >
            {k ? t(`record.files.kinds.${k}`) : t('record.files.all')}
          </button>
        ))}
        <Button color="brand" className="ms-auto" onClick={() => setOpen(true)}>
          <ArrowUpTrayIcon />
          {t('record.files.upload')}
        </Button>
      </div>
      <RequestError error={files.error} />
      {files.isSuccess && shown.length === 0 && <Text>{t('record.files.none')}</Text>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((f) => {
          const Icon = f.mimeType.startsWith('image/') ? PhotoIcon : DocumentIcon
          return (
            <Card key={f.id} bodyClassName="p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm/6 font-semibold text-zinc-950 dark:text-white">{f.title}</div>
                  <div className="truncate text-xs/5 text-zinc-500">
                    {f.fileName} · {fmt.bytes(f.sizeBytes)}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs/5 text-zinc-500">
                    <Badge color="zinc">{t(`record.files.kinds.${f.kind}`)}</Badge>
                    {f.takenAt ? fmt.day(f.takenAt) : fmt.day(f.createdAt)}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-1">
                <Button plain href={attachmentUrl(patientId, f.id)} target="_blank" rel="noopener">
                  {t('record.files.open')}
                </Button>
                <Button plain href={attachmentUrl(patientId, f.id, true)}>
                  <ArrowDownTrayIcon />
                  {t('record.files.download')}
                </Button>
                <Button plain className="ms-auto" onClick={() => setRemoving(f)}>
                  {t('record.files.delete')}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
      {open && <UploadDialog patientId={patientId} onClose={() => setOpen(false)} />}
      {removing && <RemoveDialog patientId={patientId} file={removing} onClose={() => setRemoving(null)} />}
    </div>
  )
}

function UploadDialog({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const { t } = useLang()
  const upload = useUploadAttachment(patientId)
  const [formError, setFormError] = useState<string | null>(null)
  return (
    <SidePanel
      open
      onClose={onClose}
      title={t('record.files.upload')}
      onSubmit={async (event) => {
        event.preventDefault()
        const f = new FormData(event.currentTarget)
        const file = f.get('file')
        const title = String(f.get('title') ?? '').trim()
        if (!(file instanceof File) || file.size === 0 || !title)
          return setFormError(`${t('record.files.file')} · ${t('record.files.title')}`)
        if (file.size > uploadMaxBytes) return setFormError(t('record.files.allowed', { mb: uploadMaxMb }))
        setFormError(null)
        await upload.mutateAsync({
          file,
          title,
          kind: f.get('kind') as AttachmentKindCode,
          takenAt: strOrNull(f.get('takenAt')) ?? undefined,
        })
        onClose()
      }}
      actions={
        <>
          <Button plain onClick={onClose}>
            {t('record.cancel')}
          </Button>
          <Button type="submit" color="brand" disabled={upload.isPending}>
            {t('record.files.upload')}
          </Button>
        </>
      }
    >
      <FieldGroup>
        <Field>
          <Label>{t('record.files.file')}</Label>
          <Input name="file" type="file" required accept={ALLOWED_UPLOAD_TYPES.join(',')} />
          <Description>{t('record.files.allowed', { mb: uploadMaxMb })}</Description>
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <Label>{t('record.files.kind')}</Label>
            <Select name="kind" defaultValue="LAB_RESULT">
              {UPLOAD_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`record.files.kinds.${k}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label>{t('record.files.takenAt')}</Label>
            <Input name="takenAt" type="date" />
          </Field>
        </div>
        <Field>
          <Label>{t('record.files.title')}</Label>
          <Input name="title" required />
        </Field>
        {formError && <RequestError error={new Error(formError)} />}
        <RequestError error={upload.error} />
      </FieldGroup>
    </SidePanel>
  )
}

function RemoveDialog({ patientId, file, onClose }: { patientId: string; file: AttachmentDto; onClose: () => void }) {
  const { t } = useLang()
  const remove = useDeleteAttachment(patientId)
  return (
    <SidePanel
      open
      onClose={onClose}
      size="md"
      title={t('record.files.deleteTitle')}
      description={
        <>
          {file.title}. {t('record.files.deleteHint')}
        </>
      }
      actions={
        <>
          <Button plain onClick={onClose}>
            {t('record.cancel')}
          </Button>
          <Button
            color="red"
            disabled={remove.isPending}
            onClick={() => remove.mutate(file.id, { onSuccess: onClose })}
          >
            {t('record.files.delete')}
          </Button>
        </>
      }
    >
      <RequestError error={remove.error} className="mt-4" />
    </SidePanel>
  )
}
