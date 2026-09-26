import { RequestError } from '@/components/app/form'
import { SidePanel } from '@/components/app/side-panel'
import { Card, ToneBadge } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Checkbox, CheckboxField } from '@/components/catalyst/checkbox'
import { Description, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Heading } from '@/components/catalyst/heading'
import { Input } from '@/components/catalyst/input'
import { Text } from '@/components/catalyst/text'
import { NewCaseTypeFields } from '@/components/patient/case-type-form'
import { useLang } from '@/i18n'
import { useCaseTypes, useUpdateCaseType } from '@/lib/queries'
import { type CaseTypeDto, UpdateCaseTypeSchema } from '@azza/shared'
import { PlusIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useState } from 'react'

export function SettingsPage() {
  const { t } = useLang()
  return (
    <div className="space-y-6">
      <Heading className="headline">{t('settings.title')}</Heading>
      <CaseTypesSettings />
    </div>
  )
}

function CaseTypesSettings() {
  const { t, l } = useLang()
  const [showArchived, setShowArchived] = useState(false)
  const cases = useCaseTypes(showArchived)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CaseTypeDto | null>(null)

  return (
    <Card
      title={t('record.cases.title')}
      action={
        <Button color="brand" onClick={() => setAdding(true)}>
          <PlusIcon />
          {t('record.cases.add')}
        </Button>
      }
      bodyClassName="px-5 pb-4"
    >
      <Text>{t('record.cases.subtitle')}</Text>
      <div className="mt-3">
        <CheckboxField>
          <Checkbox color="brand" checked={showArchived} onChange={setShowArchived} />
          <Label>{t('record.cases.showArchived')}</Label>
        </CheckboxField>
      </div>
      <RequestError error={cases.error} className="mt-3" />
      <ul className="mt-3 divide-y divide-zinc-950/5 dark:divide-white/5">
        {cases.data?.map((c) => (
          <li key={c.id} className={clsx('flex flex-wrap items-center gap-3 py-3', c.archived && 'opacity-60')}>
            <div className="min-w-0 flex-1">
              <div className="text-sm/6 font-semibold text-zinc-950 dark:text-white">{l(c.name)}</div>
              <div className="text-xs/5 text-zinc-500">
                <span dir="ltr">{c.name.en}</span> · <span lang="ar">{c.name.ar}</span>
              </div>
            </div>
            {c.systemKey && <ToneBadge tone="info">{t('record.cases.builtIn')}</ToneBadge>}
            {c.archived && <ToneBadge tone="neutral">{t('record.cases.archived')}</ToneBadge>}
            <span className="w-24 text-end text-sm/6 text-zinc-500 tabular-nums">
              {t('record.cases.patients', { count: c.patientCount })}
            </span>
            <Button plain onClick={() => setEditing(c)}>
              {t('record.cases.edit')}
            </Button>
          </li>
        ))}
      </ul>

      <SidePanel
        open={adding}
        onClose={() => setAdding(false)}
        title={t('record.cases.add')}
        description={t('record.cases.subtitle')}
      >
        <NewCaseTypeFields onCreated={() => setAdding(false)} onCancel={() => setAdding(false)} />
      </SidePanel>
      {editing && <EditCaseTypePanel caseType={editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function EditCaseTypePanel({ caseType, onClose }: { caseType: CaseTypeDto; onClose: () => void }) {
  const { t } = useLang()
  const update = useUpdateCaseType()
  const [archived, setArchived] = useState(caseType.archived)
  const [formError, setFormError] = useState<string | null>(null)

  return (
    <SidePanel
      open
      onClose={onClose}
      title={t('record.cases.edit')}
      onSubmit={async (event) => {
        event.preventDefault()
        const f = new FormData(event.currentTarget)
        const parsed = UpdateCaseTypeSchema.safeParse({
          nameEn: f.get('nameEn'),
          nameAr: f.get('nameAr'),
          ...(!caseType.systemKey && { archived }),
        })
        if (!parsed.success)
          return setFormError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '))
        setFormError(null)
        await update.mutateAsync({ id: caseType.id, ...parsed.data })
        onClose()
      }}
      actions={
        <>
          <Button plain onClick={onClose}>
            {t('record.cancel')}
          </Button>
          <Button type="submit" color="brand" disabled={update.isPending}>
            {t('record.save')}
          </Button>
        </>
      }
    >
      <FieldGroup>
        <Field>
          <Label>{t('record.cases.nameEn')}</Label>
          <Input name="nameEn" defaultValue={caseType.name.en} required dir="ltr" />
        </Field>
        <Field>
          <Label>{t('record.cases.nameAr')}</Label>
          <Input name="nameAr" defaultValue={caseType.name.ar} required dir="rtl" lang="ar" />
        </Field>
        {caseType.systemKey ? (
          <Text>{t('record.cases.builtInHint')}</Text>
        ) : (
          <CheckboxField>
            <Checkbox color="brand" checked={archived} onChange={setArchived} />
            <Label>{t('record.cases.archive')}</Label>
            <Description>{t('record.cases.archiveHint')}</Description>
          </CheckboxField>
        )}
        {formError && <RequestError error={new Error(formError)} />}
        <RequestError error={update.error} />
      </FieldGroup>
    </SidePanel>
  )
}
