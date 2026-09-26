import { RequestError } from '@/components/app/form'
import { Button } from '@/components/catalyst/button'
import { Field, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { useLang } from '@/i18n'
import { useCreateCaseType } from '@/lib/queries'
import { type CaseTypeDto, CreateCaseTypeSchema } from '@azza/shared'
import type React from 'react'
import { useState } from 'react'

/**
 * Compact "new case" form (English + Arabic names). Used inside the New patient panel and on
 * the Settings › Cases page. It is not a <form> so it can sit inside another form.
 */
export function NewCaseTypeFields({
  onCreated,
  onCancel,
}: {
  onCreated: (c: CaseTypeDto) => void
  onCancel?: () => void
}) {
  const { t } = useLang()
  const create = useCreateCaseType()
  const [nameEn, setNameEn] = useState('')
  const [nameAr, setNameAr] = useState('')
  const parsed = CreateCaseTypeSchema.safeParse({ nameEn, nameAr })

  const save = async () => {
    if (!parsed.success) return
    const created = await create.mutateAsync(parsed.data)
    setNameEn('')
    setNameAr('')
    onCreated(created)
  }

  // Enter adds the case instead of submitting the surrounding form.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void save()
    }
  }

  return (
    <div className="space-y-3 rounded-lg bg-zinc-50 p-4 ring-1 ring-zinc-950/5 dark:bg-white/5 dark:ring-white/10">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label>{t('record.cases.nameEn')}</Label>
          <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} onKeyDown={onKeyDown} dir="ltr" autoFocus />
        </Field>
        <Field>
          <Label>{t('record.cases.nameAr')}</Label>
          <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} onKeyDown={onKeyDown} dir="rtl" lang="ar" />
        </Field>
      </div>
      <RequestError error={create.error} />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button plain onClick={onCancel}>
            {t('record.cancel')}
          </Button>
        )}
        <Button color="brand" onClick={save} disabled={!parsed.success || create.isPending}>
          {t('record.cases.add')}
        </Button>
      </div>
    </div>
  )
}
