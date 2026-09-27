import { RequestError, useFormat } from '@/components/app/form'
import { SidePanel } from '@/components/app/side-panel'
import { Card, ToneBadge } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Description, Field, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { Text } from '@/components/catalyst/text'
import { CopyLinkButton } from '@/components/forms/copy-link-button'
import { ResponsePanel } from '@/components/forms/response-panel'
import { useLang } from '@/i18n'
import { formLinkUrl, useCreateFormLink, useForms, usePatientForms, useRevokeFormLink } from '@/lib/queries'
import { FORM_LINK_TTL_DAYS, type FormLinkStatus, type Tone } from '@azza/shared'
import { PaperAirplaneIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'

const linkTone: Record<FormLinkStatus, Tone> = {
  waiting: 'neutral',
  opened: 'info',
  submitted: 'ok',
  expired: 'warn',
  revoked: 'neutral',
}

/** Forms for one patient: personal links sent to her, and every response on her record. */
export function FormsTab({ patientId }: { patientId: string }) {
  const { t } = useLang()
  const fmt = useFormat()
  const data = usePatientForms(patientId)
  const revoke = useRevokeFormLink(patientId)
  const [sending, setSending] = useState(false)
  const [openResponse, setOpenResponse] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button color="brand" onClick={() => setSending(true)}>
          <PaperAirplaneIcon className="rtl:-scale-x-100" />
          {t('forms.patientTab.send')}
        </Button>
      </div>
      <RequestError error={data.error ?? revoke.error} />

      <Card title={t('forms.patientTab.responses')} bodyClassName="px-5 pb-2">
        {data.data?.responses.length === 0 && <Text className="pb-3">{t('forms.patientTab.noResponses')}</Text>}
        <ul className="divide-y divide-zinc-950/5 dark:divide-white/5">
          {data.data?.responses.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpenResponse(r.id)}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-3 text-start focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm/6 font-semibold text-zinc-950 dark:text-white">
                    <bdi>{r.form.title}</bdi>
                  </span>
                  <span className="block text-xs/5 text-zinc-500">
                    {fmt.dayTime(r.submittedAt)}
                    {r.matchedBy && ` · ${t(`forms.responses.match.${r.matchedBy}`)}`}
                  </span>
                </span>
                <ToneBadge tone={r.reviewedAt ? 'neutral' : 'danger'}>
                  {r.reviewedAt ? t('forms.responses.reviewed') : t('forms.responses.new')}
                </ToneBadge>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={t('forms.patientTab.links')} bodyClassName="px-5 pb-2">
        {data.data?.links.length === 0 && <Text className="pb-3">{t('forms.patientTab.noLinks')}</Text>}
        <ul className="divide-y divide-zinc-950/5 dark:divide-white/5">
          {data.data?.links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm/6 font-medium text-zinc-950 dark:text-white">
                  <bdi>{l.form.title}</bdi>
                </span>
                <span className="block text-xs/5 text-zinc-500">
                  {t('forms.patientTab.sentOn', { when: fmt.dayTime(l.createdAt) })}
                  {(l.status === 'waiting' || l.status === 'opened') &&
                    ` · ${t('forms.patientTab.expiresOn', { when: fmt.day(l.expiresAt) })}`}
                  {l.createdBy && ` · ${l.createdBy.fullName}`}
                </span>
              </span>
              <ToneBadge tone={linkTone[l.status]}>{t(`forms.patientTab.status.${l.status}`)}</ToneBadge>
              {l.responseId && (
                <Button plain onClick={() => setOpenResponse(l.responseId)}>
                  {t('forms.patientTab.view')}
                </Button>
              )}
              {(l.status === 'waiting' || l.status === 'opened') && (
                <Button plain disabled={revoke.isPending} onClick={() => revoke.mutate(l.id)}>
                  {t('forms.patientTab.revoke')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {sending && <SendFormPanel patientId={patientId} onClose={() => setSending(false)} />}
      <ResponsePanel responseId={openResponse} onClose={() => setOpenResponse(null)} />
    </div>
  )
}

/**
 * Makes personal links, as many as needed: pick a form, create its link, copy it, then send the
 * next one (another form, or the same form again). Links made here stay listed until the panel
 * closes, because each is shown only once.
 */
function SendFormPanel({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const { t } = useLang()
  const forms = useForms()
  const create = useCreateFormLink(patientId)
  const [formId, setFormId] = useState('')
  const [created, setCreated] = useState<{ id: string; title: string; url: string }[]>([])
  const open = forms.data?.filter((f) => f.acceptingResponses) ?? []

  return (
    <SidePanel
      open
      onClose={onClose}
      size="lg"
      title={t('forms.patientTab.sendTitle')}
      description={t('forms.patientTab.sendHint', { days: FORM_LINK_TTL_DAYS })}
      actions={
        <>
          <Button plain onClick={onClose}>
            {created.length ? t('common.done') : t('record.cancel')}
          </Button>
          <Button
            color="brand"
            disabled={!formId || create.isPending}
            onClick={() =>
              // Errors (e.g. the form was closed meanwhile) show below via create.error.
              create.mutate(formId, {
                onSuccess: (link) => {
                  setCreated((list) => [{ id: link.id, title: link.form.title, url: formLinkUrl(link.token) }, ...list])
                  setFormId('')
                },
              })
            }
          >
            {t('forms.patientTab.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Field>
          <Label>{created.length ? t('forms.patientTab.pickAnother') : t('forms.patientTab.pickForm')}</Label>
          <Select value={formId} onChange={(e) => setFormId(e.target.value)}>
            <option value="">{t('forms.patientTab.pickFormPlaceholder')}</option>
            {open.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </Select>
          {forms.isSuccess && open.length === 0 && <Description>{t('forms.patientTab.noForms')}</Description>}
        </Field>
        {created.length > 0 && (
          <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900">
            <p className="text-sm/6 font-medium text-emerald-900 dark:text-emerald-200">
              {t('forms.patientTab.linkReady')}
            </p>
            <ul className="mt-3 space-y-3">
              {created.map((c) => (
                <li key={c.id}>
                  <p className="mb-1 text-xs/5 font-medium text-emerald-900 dark:text-emerald-200">
                    <bdi>{c.title}</bdi>
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      className="min-w-0 flex-1"
                      readOnly
                      value={c.url}
                      dir="ltr"
                      aria-label={c.title}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <CopyLinkButton url={c.url} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <RequestError error={create.error ?? forms.error} />
      </div>
    </SidePanel>
  )
}
