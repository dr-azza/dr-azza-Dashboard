import { RequestError, strOrNull } from '@/components/app/form'
import { SidePanel } from '@/components/app/side-panel'
import { Button } from '@/components/catalyst/button'
import { Checkbox, CheckboxField } from '@/components/catalyst/checkbox'
import { Description, ErrorMessage, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { useLang } from '@/i18n'
import { useCaseTypes, useCreatePatient } from '@/lib/queries'
import { CreatePatientSchema } from '@azza/shared'
import { PlusIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { NewCaseTypeFields } from './case-type-form'

export function NewPatientPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, l } = useLang()
  const navigate = useNavigate()
  const create = useCreatePatient()
  const cases = useCaseTypes()
  const [caseTypeId, setCaseTypeId] = useState('')
  const [addingCase, setAddingCase] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const selectedCase = caseTypeId || cases.data?.[0]?.id || ''

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const f = new FormData(event.currentTarget)
    const parsed = CreatePatientSchema.safeParse({
      fullName: f.get('fullName'),
      fullNameAr: strOrNull(f.get('fullNameAr')),
      phone: f.get('phone'),
      dateOfBirth: strOrNull(f.get('dateOfBirth')),
      caseTypeId: selectedCase,
      consentGiven: f.get('consent') === 'on',
    })
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])))
      return
    }
    setErrors({})
    const patient = await create.mutateAsync(parsed.data)
    onClose()
    navigate(`/patients/${patient.id}`)
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      size="xl"
      title={t('record.new.title')}
      description={t('record.new.description')}
      onSubmit={onSubmit}
      noValidate
      actions={
        <>
          <Button plain onClick={onClose}>
            {t('record.cancel')}
          </Button>
          <Button type="submit" color="brand" disabled={create.isPending || !selectedCase}>
            {t('record.new.create')}
          </Button>
        </>
      }
    >
      <FieldGroup>
        <Field>
          <Label>{t('record.new.fullName')}</Label>
          <Input name="fullName" autoComplete="off" invalid={!!errors.fullName} dir="ltr" autoFocus />
          {errors.fullName && <ErrorMessage>{errors.fullName}</ErrorMessage>}
        </Field>
        <Field>
          <Label>{t('record.new.fullNameAr')}</Label>
          <Input name="fullNameAr" autoComplete="off" dir="rtl" lang="ar" />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <Label>{t('record.new.phone')}</Label>
            <Input name="phone" type="tel" inputMode="tel" placeholder="+20 10…" invalid={!!errors.phone} dir="ltr" />
            {errors.phone ? (
              <ErrorMessage>{errors.phone}</ErrorMessage>
            ) : (
              <Description>{t('record.new.phoneHint')}</Description>
            )}
          </Field>
          <Field>
            <Label>{t('record.new.dob')}</Label>
            <Input name="dateOfBirth" type="date" />
          </Field>
        </div>

        <Field>
          <div className="flex items-center justify-between gap-3">
            <Label>{t('record.new.caseType')}</Label>
            {!addingCase && (
              <Button plain onClick={() => setAddingCase(true)}>
                <PlusIcon />
                {t('record.cases.newInline')}
              </Button>
            )}
          </div>
          <Select value={selectedCase} onChange={(e) => setCaseTypeId(e.target.value)} invalid={!!errors.caseTypeId}>
            {cases.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {l(c.name)}
              </option>
            ))}
          </Select>
        </Field>
        {addingCase && (
          <NewCaseTypeFields
            onCancel={() => setAddingCase(false)}
            onCreated={(c) => {
              setCaseTypeId(c.id)
              setAddingCase(false)
            }}
          />
        )}

        <CheckboxField>
          <Checkbox name="consent" color="brand" />
          <Label>{t('record.new.consent')}</Label>
          {errors.consentGiven && <ErrorMessage>{errors.consentGiven}</ErrorMessage>}
        </CheckboxField>
        <RequestError error={create.error ?? cases.error} />
      </FieldGroup>
    </SidePanel>
  )
}
