import { RequestError, formatPhone, useFormat } from '@/components/app/form'
import { SidePanel } from '@/components/app/side-panel'
import { ToneBadge } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Input } from '@/components/catalyst/input'
import { useLang } from '@/i18n'
import { useFormResponse, usePatients, useUpdateFormResponse } from '@/lib/queries'
import { answerText, type FormResponseDto, visibleFieldIds } from '@azza/shared'
import { CheckIcon, LinkIcon, UserIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import i18n from 'i18next'
import { useDeferredValue, useMemo, useState } from 'react'

/** One response: every question the patient saw, her answers, and who she is (or linking her). */
export function ResponsePanel({ responseId, onClose }: { responseId: string | null; onClose: () => void }) {
  const { t } = useLang()
  const fmt = useFormat()
  const response = useFormResponse(responseId)
  const r = response.data

  return (
    <SidePanel
      open={!!responseId}
      onClose={onClose}
      size="2xl"
      title={r?.form.title ?? t('forms.responses.viewTitle')}
      description={r ? `${fmt.dayTime(r.submittedAt)} · ${t('forms.responses.version', { n: r.version })}` : undefined}
      actions={r ? <ReviewButton response={r} /> : undefined}
    >
      <RequestError error={response.error} />
      {response.isPending && responseId && (
        <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/5" />
      )}
      {r && (
        <div className="space-y-6">
          <Respondent response={r} />
          <Answers response={r} />
        </div>
      )}
    </SidePanel>
  )
}

function ReviewButton({ response }: { response: FormResponseDto }) {
  const { t } = useLang()
  const fmt = useFormat()
  const update = useUpdateFormResponse(response.id)
  return (
    <>
      {response.reviewedAt && (
        <span className="me-auto text-xs/5 text-zinc-500">
          {t('forms.responses.reviewedBy', {
            name: response.reviewedBy?.fullName ?? '—',
            when: fmt.dayTime(response.reviewedAt),
          })}
        </span>
      )}
      {response.reviewedAt ? (
        <Button outline disabled={update.isPending} onClick={() => update.mutate({ reviewed: false })}>
          {t('forms.responses.markNew')}
        </Button>
      ) : (
        <Button color="brand" disabled={update.isPending} onClick={() => update.mutate({ reviewed: true })}>
          <CheckIcon />
          {t('forms.responses.markReviewed')}
        </Button>
      )}
    </>
  )
}

function Respondent({ response: r }: { response: FormResponseDto }) {
  const { t } = useLang()
  const [linking, setLinking] = useState(false)
  const update = useUpdateFormResponse(r.id)

  return (
    <section className="rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-950/5 dark:bg-white/5 dark:ring-white/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {r.patient ? (
            <>
              <p className="text-sm/6 font-semibold text-zinc-950 dark:text-white">{r.patient.fullName}</p>
              <p className="text-xs/5 text-zinc-500">{t('file.fileNo', { file: r.patient.fileNumber })}</p>
            </>
          ) : (
            <p className="text-sm/6 font-semibold text-zinc-600 dark:text-zinc-300">{t('forms.responses.notLinked')}</p>
          )}
          {(r.respondentName || r.respondentPhone) && (
            <p className="mt-1 text-sm/6 text-zinc-600 dark:text-zinc-400">
              {r.respondentName}
              {r.respondentPhone && (
                <>
                  {' · '}
                  <span dir="ltr">{formatPhone(r.respondentPhone)}</span>
                </>
              )}
            </p>
          )}
          {r.matchedBy && (
            <div className="mt-2">
              <ToneBadge tone={r.matchedBy === 'PHONE' ? 'warn' : 'info'}>
                {t(`forms.responses.match.${r.matchedBy}`)}
              </ToneBadge>
            </div>
          )}
          {r.matchedBy === 'PHONE' && (
            <p className="mt-2 text-xs/5 text-zinc-500">{t('forms.responses.matchHint.PHONE')}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {r.patient && (
            <Button outline href={`/patients/${r.patient.id}?tab=forms`}>
              <UserIcon />
              {t('forms.responses.openPatient')}
            </Button>
          )}
          {/* Personal-link responses belong to that patient by construction. */}
          {r.matchedBy !== 'LINK' && (
            <Button plain onClick={() => setLinking((v) => !v)}>
              <LinkIcon />
              {r.patient ? t('forms.responses.changePatient') : t('forms.responses.linkPatient')}
            </Button>
          )}
        </div>
      </div>
      {linking && (
        <PatientPicker
          initialQuery={r.respondentPhone ?? r.respondentName ?? ''}
          pending={update.isPending}
          canUnlink={!!r.patient}
          onPick={async (patientId) => {
            await update.mutateAsync({ patientId })
            setLinking(false)
          }}
        />
      )}
      <RequestError error={update.error} className="mt-3" />
    </section>
  )
}

function PatientPicker({
  initialQuery,
  pending,
  canUnlink,
  onPick,
}: {
  initialQuery: string
  pending: boolean
  canUnlink: boolean
  onPick: (patientId: string | null) => void
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
              onClick={() => onPick(p.id)}
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

/** Questions in order, sections as headings; questions hidden by the patient's answers are left out. */
function Answers({ response: r }: { response: FormResponseDto }) {
  const { t } = useLang()
  const fmt = useFormat()
  // Answer words ("Yes"/"No") in the form's language, like the patient saw them.
  const ft = useMemo(() => i18n.getFixedT(r.language), [r.language])
  const visible = visibleFieldIds(r.fields, r.answers)
  const dir = r.language === 'ar' ? 'rtl' : 'ltr'

  return (
    <dl className="space-y-4" dir={dir}>
      {r.fields.map((field) => {
        if (!visible.has(field.id)) return null
        if (field.type === 'section') {
          return (
            <h3
              key={field.id}
              className="border-b border-brand-600/20 pt-2 pb-1 text-sm/6 font-semibold text-brand-800 dark:text-brand-300"
            >
              {field.label}
            </h3>
          )
        }
        const value = r.answers[field.id]
        const text =
          field.type === 'date' && typeof value === 'string'
            ? fmt.day(value)
            : answerText(field, value, {
                yes: ft('publicForm.yes'),
                no: ft('publicForm.no'),
                separator: r.language === 'ar' ? '، ' : ', ',
              })
        return (
          <div key={field.id}>
            <dt className="text-sm/6 font-medium text-zinc-500 dark:text-zinc-400">{field.label}</dt>
            {/* Aligned with the form's direction; each value keeps its own (numbers, phones, mixed text). */}
            <dd
              className={clsx(
                'mt-0.5 text-base/7 whitespace-pre-line sm:text-sm/6',
                text ? 'text-zinc-950 dark:text-white' : 'text-zinc-400 italic',
              )}
            >
              <bdi dir={field.type === 'phone' ? 'ltr' : undefined}>{text ?? t('forms.responses.noAnswer')}</bdi>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
