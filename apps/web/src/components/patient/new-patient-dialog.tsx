import { RequestError, strOrNull } from '@/components/app/form'
import { Button } from '@/components/catalyst/button'
import { Checkbox, CheckboxField } from '@/components/catalyst/checkbox'
import { Dialog, DialogActions, DialogBody, DialogDescription, DialogTitle } from '@/components/catalyst/dialog'
import { Description, ErrorMessage, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { useLang } from '@/i18n'
import { useCreatePatient } from '@/lib/queries'
import { CASE_TYPES, type CaseTypeCode, CreatePatientSchema } from '@azza/shared'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { caseKey } from './labels'

export function NewPatientDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const create = useCreatePatient()
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const f = new FormData(event.currentTarget)
    const parsed = CreatePatientSchema.safeParse({
      fullName: f.get('fullName'),
      fullNameAr: strOrNull(f.get('fullNameAr')),
      phone: f.get('phone'),
      dateOfBirth: strOrNull(f.get('dateOfBirth')),
      caseType: f.get('caseType') as CaseTypeCode,
      fileNumber: strOrNull(f.get('fileNumber')) ?? undefined,
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
    <Dialog open={open} onClose={onClose} size="xl">
      <form onSubmit={onSubmit} noValidate>
        <DialogTitle>{t('record.new.title')}</DialogTitle>
        <DialogDescription>{t('record.new.description')}</DialogDescription>
        <DialogBody>
          <FieldGroup>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field>
                <Label>{t('record.new.fullName')}</Label>
                <Input name="fullName" autoComplete="off" invalid={!!errors.fullName} dir="ltr" autoFocus />
                {errors.fullName && <ErrorMessage>{errors.fullName}</ErrorMessage>}
              </Field>
              <Field>
                <Label>{t('record.new.fullNameAr')}</Label>
                <Input name="fullNameAr" autoComplete="off" dir="rtl" lang="ar" />
              </Field>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field>
                <Label>{t('record.new.phone')}</Label>
                <Input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="+20 10…"
                  invalid={!!errors.phone}
                  dir="ltr"
                />
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
            <div className="grid gap-6 sm:grid-cols-2">
              <Field>
                <Label>{t('record.new.caseType')}</Label>
                <Select name="caseType" defaultValue="PREGNANCY">
                  {CASE_TYPES.map((c) => (
                    <option key={c} value={c}>
                      {t(caseKey(c))}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field>
                <Label>{t('record.new.fileNumber')}</Label>
                <Input name="fileNumber" dir="ltr" placeholder="P-0001" />
                <Description>{t('record.new.fileNumberHint')}</Description>
              </Field>
            </div>
            <CheckboxField>
              <Checkbox name="consent" color="brand" />
              <Label>{t('record.new.consent')}</Label>
              {errors.consentGiven && <ErrorMessage>{errors.consentGiven}</ErrorMessage>}
            </CheckboxField>
            <RequestError error={create.error} />
          </FieldGroup>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={onClose}>
            {t('record.cancel')}
          </Button>
          <Button type="submit" color="brand" disabled={create.isPending}>
            {t('record.new.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
