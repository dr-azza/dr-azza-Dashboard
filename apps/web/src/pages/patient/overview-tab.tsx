import { RequestError, useFormat } from '@/components/app/form'
import { Card } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Checkbox, CheckboxField } from '@/components/catalyst/checkbox'
import { Label } from '@/components/catalyst/fieldset'
import { Textarea } from '@/components/catalyst/textarea'
import { Text } from '@/components/catalyst/text'
import { useLang } from '@/i18n'
import { useAddNote, useNotes, useTimeline } from '@/lib/queries'
import type { TimelineEventDto, TimelineEventType } from '@azza/shared'
import {
  BanknotesIcon,
  BeakerIcon,
  BookOpenIcon,
  ClipboardDocumentListIcon,
  ChatBubbleLeftEllipsisIcon,
  ClipboardDocumentCheckIcon,
  DocumentIcon,
  HeartIcon,
} from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useState } from 'react'

const ICONS: Record<TimelineEventType, typeof HeartIcon> = {
  visit: ClipboardDocumentCheckIcon,
  prescription: BeakerIcon,
  payment: BanknotesIcon,
  file: DocumentIcon,
  note: ChatBubbleLeftEllipsisIcon,
  pregnancy: HeartIcon,
  history: BookOpenIcon,
  form: ClipboardDocumentListIcon,
}

/** Title in the viewer's language, built from the event's type and codes (the API sends no prose). */
function useEventTitle() {
  const { t } = useLang()
  const fmt = useFormat()
  return (e: TimelineEventDto) => {
    switch (e.type) {
      case 'visit':
        return t(e.code === 'patient-report' ? 'record.overview.patientReport' : 'record.overview.event.visit')
      case 'prescription':
        return `${t('record.overview.event.prescription')} ${e.label ?? ''}`.trim()
      case 'payment':
        return `${t('record.overview.event.payment')} ${e.amount ? fmt.money(e.amount, e.currency) : ''} · ${t(`record.payments.methods.${e.code}`)}`
      case 'file':
        return `${e.label ?? t('record.overview.event.file')} · ${t(`record.files.kinds.${e.code}`)}`
      case 'form':
        return `${t('record.overview.event.form')} · ${e.label ?? ''}`
      case 'history':
        return e.label ? `${t('record.overview.event.history')} · ${e.label}` : t('record.overview.event.history')
      default:
        return t(`record.overview.event.${e.type}`)
    }
  }
}

export function OverviewTab({ patientId }: { patientId: string }) {
  const { t } = useLang()
  const fmt = useFormat()
  const titleOf = useEventTitle()
  const timeline = useTimeline(patientId)
  const notes = useNotes(patientId)
  const addNote = useAddNote(patientId)
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card title={t('record.overview.activity')} bodyClassName="px-5 pb-4">
        <RequestError error={timeline.error} />
        {timeline.data?.length === 0 && <Text>{t('record.overview.noActivity')}</Text>}
        <ol className="relative ms-3 border-s border-zinc-950/10 dark:border-white/10">
          {timeline.data?.map((e) => {
            const Icon = ICONS[e.type]
            return (
              <li key={`${e.type}-${e.id}`} className="ms-6 py-3">
                <span
                  className={clsx(
                    'absolute -start-3 flex size-6 items-center justify-center rounded-full ring-4 ring-white dark:ring-zinc-900',
                    e.flag === 'warning'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={clsx(
                      'text-sm/6 font-semibold',
                      e.flag === 'voided' ? 'text-zinc-400 line-through' : 'text-zinc-950 dark:text-white',
                    )}
                  >
                    {titleOf(e)}
                  </span>
                  {e.flag === 'voided' && (
                    <span className="text-xs/5 text-zinc-500">{t('record.overview.voided')}</span>
                  )}
                  <time className="text-xs/5 text-zinc-500 dark:text-zinc-400">{fmt.dayTime(e.at)}</time>
                </div>
                {e.detail && (
                  <p
                    className={clsx(
                      'text-sm/6',
                      e.flag === 'warning'
                        ? 'font-medium text-red-700 dark:text-red-400'
                        : 'text-zinc-600 dark:text-zinc-400',
                    )}
                  >
                    {e.detail}
                  </p>
                )}
                {e.by && <p className="text-xs/5 text-zinc-500">{t('record.by', { name: e.by.fullName })}</p>}
              </li>
            )
          })}
        </ol>
      </Card>

      <Card title={t('record.overview.notes')} bodyClassName="px-5 pb-4 space-y-4">
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!body.trim()) return
            await addNote.mutateAsync({ body: body.trim(), pinned })
            setBody('')
            setPinned(false)
          }}
        >
          <Textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('record.overview.notePlaceholder')}
            aria-label={t('record.overview.addNote')}
          />
          <div className="flex items-center justify-between gap-3">
            <CheckboxField>
              <Checkbox color="brand" checked={pinned} onChange={setPinned} />
              <Label>{t('record.overview.pin')}</Label>
            </CheckboxField>
            <Button type="submit" color="brand" disabled={!body.trim() || addNote.isPending}>
              {t('record.overview.addNote')}
            </Button>
          </div>
          <RequestError error={addNote.error} />
        </form>
        <ul className="space-y-3">
          {notes.data?.map((n) => (
            <li
              key={n.id}
              className={clsx(
                'rounded-lg px-4 py-3 text-sm/6',
                n.pinned
                  ? 'bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-950/40 dark:ring-brand-900'
                  : 'bg-zinc-50 dark:bg-white/5',
              )}
            >
              <p className="whitespace-pre-line text-zinc-800 dark:text-zinc-200">{n.body}</p>
              <p className="mt-1 text-xs/5 text-zinc-500">
                {n.pinned && (
                  <span className="font-semibold text-brand-700 dark:text-brand-300">
                    {t('record.overview.pinned')} ·{' '}
                  </span>
                )}
                {n.author?.fullName} · {fmt.dayTime(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
