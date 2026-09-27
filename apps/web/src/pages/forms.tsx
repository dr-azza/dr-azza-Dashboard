import { RequestError, useFormat } from '@/components/app/form'
import { SidePanel } from '@/components/app/side-panel'
import { ToneBadge } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Description, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Heading } from '@/components/catalyst/heading'
import { Input } from '@/components/catalyst/input'
import { Radio, RadioField, RadioGroup } from '@/components/catalyst/radio'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { useLang } from '@/i18n'
import { CopyLinkButton } from '@/components/forms/copy-link-button'
import { formLinkUrl, useCreateForm, useForms } from '@/lib/queries'
import type { FormLanguage } from '@azza/shared'
import { ClipboardDocumentListIcon, PlusIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

/** All the clinic's forms, with how many answers are waiting. */
export function FormsPage() {
  const { t } = useLang()
  const fmt = useFormat()
  const [params, setParams] = useSearchParams()
  const archived = params.get('view') === 'archived'
  const forms = useForms(archived)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading className="headline">{t('forms.title')}</Heading>
          <Text className="mt-1">{t('forms.subtitle')}</Text>
        </div>
        <Button color="brand" onClick={() => setCreating(true)}>
          <PlusIcon />
          {t('forms.newForm')}
        </Button>
      </div>

      <nav className="flex gap-1 border-b border-zinc-950/10 dark:border-white/10" aria-label={t('forms.title')}>
        {([false, true] as const).map((isArchived) => (
          <button
            key={String(isArchived)}
            type="button"
            aria-current={archived === isArchived ? 'page' : undefined}
            onClick={() => setParams(isArchived ? { view: 'archived' } : {}, { replace: true })}
            className={clsx(
              '-mb-px border-b-2 px-3 py-2.5 text-sm/6 font-medium',
              archived === isArchived
                ? 'border-brand-600 text-brand-700 dark:text-brand-300'
                : 'border-transparent text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white',
            )}
          >
            {isArchived ? t('forms.archivedTab') : t('forms.active')}
          </button>
        ))}
      </nav>

      <RequestError error={forms.error} />
      {forms.isPending && <div className="h-48 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/5" />}

      {forms.data?.length === 0 && (
        <div className="rounded-xl bg-white px-6 py-16 text-center ring-1 ring-zinc-950/8 dark:bg-zinc-900 dark:ring-white/10">
          <ClipboardDocumentListIcon className="mx-auto size-7 text-brand-500" />
          <p className="mt-3 text-sm/6 font-semibold text-zinc-950 dark:text-white">
            {archived ? t('forms.emptyArchived') : t('forms.empty')}
          </p>
          {!archived && (
            <>
              <Text className="mx-auto mt-1 max-w-sm">{t('forms.emptyHint')}</Text>
              <Button color="brand" className="mt-5" onClick={() => setCreating(true)}>
                <PlusIcon />
                {t('forms.newForm')}
              </Button>
            </>
          )}
        </div>
      )}

      {!!forms.data?.length && (
        <Table className="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
          <TableHead>
            <TableRow>
              <TableHeader>{t('forms.formTitle')}</TableHeader>
              <TableHeader className="max-sm:hidden">{t('forms.language')}</TableHeader>
              <TableHeader>{t('forms.tabs.responses')}</TableHeader>
              <TableHeader className="max-md:hidden">{t('forms.responses.status')}</TableHeader>
              <TableHeader className="text-end">
                <span className="sr-only">{t('forms.sharedLink')}</span>
              </TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {forms.data.map((f) => (
              <TableRow key={f.id} href={`/forms/${f.id}`} title={f.title}>
                <TableCell>
                  <div className="font-medium text-zinc-950 dark:text-white">
                    <bdi>{f.title}</bdi>
                  </div>
                  <div className="text-xs/5 text-zinc-500">
                    {t('forms.questions', { count: f.questionCount })} ·{' '}
                    {t('forms.updated', { when: fmt.day(f.updatedAt) })}
                  </div>
                </TableCell>
                <TableCell className="text-zinc-500 max-sm:hidden">{t(`forms.languages.${f.language}`)}</TableCell>
                <TableCell>
                  <span className="tabular-nums">{t('forms.responseCount', { count: f.responseCount })}</span>
                  {f.newCount > 0 && (
                    <span className="ms-2 inline-flex">
                      <ToneBadge tone="danger">{t('forms.newResponses', { count: f.newCount })}</ToneBadge>
                    </span>
                  )}
                </TableCell>
                <TableCell className="max-md:hidden">
                  <ToneBadge tone={f.acceptingResponses ? 'ok' : 'neutral'}>
                    {f.acceptingResponses ? t('forms.accepting') : t('forms.closed')}
                  </ToneBadge>
                </TableCell>
                <TableCell className="text-end">
                  {/* Archived forms have no working link. */}
                  {!f.archived && <CopyLinkButton compact url={formLinkUrl(f.publicToken)} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {creating && <CreateFormPanel onClose={() => setCreating(false)} />}
    </div>
  )
}

function CreateFormPanel({ onClose }: { onClose: () => void }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const create = useCreateForm()
  const [language, setLanguage] = useState<FormLanguage>(lang)
  const [titleError, setTitleError] = useState(false)

  return (
    <SidePanel
      open
      onClose={onClose}
      size="md"
      title={t('forms.createTitle')}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault()
        const title = String(new FormData(event.currentTarget).get('title') ?? '').trim()
        if (!title) return setTitleError(true)
        const form = await create.mutateAsync({ title, language, fields: [] })
        navigate(`/forms/${form.id}`)
      }}
      actions={
        <>
          <Button plain onClick={onClose}>
            {t('record.cancel')}
          </Button>
          <Button type="submit" color="brand" disabled={create.isPending}>
            {t('forms.newForm')}
          </Button>
        </>
      }
    >
      <FieldGroup>
        <Field>
          <Label>{t('forms.formTitle')}</Label>
          <Input
            name="title"
            autoFocus
            invalid={titleError}
            placeholder={t('forms.formTitlePlaceholder')}
            onChange={() => setTitleError(false)}
          />
          {titleError && <p className="mt-2 text-sm/6 text-red-600">{t('forms.builder.errors.title')}</p>}
        </Field>
        <Field>
          <Label>{t('forms.language')}</Label>
          <Description>{t('forms.languageHint')}</Description>
          <RadioGroup value={language} onChange={(v) => setLanguage(v as FormLanguage)} className="mt-3">
            {(['ar', 'en'] as const).map((l) => (
              <RadioField key={l}>
                <Radio value={l} color="brand" />
                <Label>{t(`forms.languages.${l}`)}</Label>
              </RadioField>
            ))}
          </RadioGroup>
        </Field>
        <RequestError error={create.error} />
      </FieldGroup>
    </SidePanel>
  )
}
