import { ThemeToggleButton } from '@/components/app/theme-switcher'
import { AzzahAppIcon, AzzahLockup } from '@/components/brand/logo'
import { Button } from '@/components/catalyst/button'
import { Checkbox, CheckboxField, CheckboxGroup } from '@/components/catalyst/checkbox'
import { Field, Fieldset, Label, Legend } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Textarea } from '@/components/catalyst/textarea'
import { findPatient } from '@/data/mock'
import { useLang } from '@/i18n'
import { CHECKIN_SYMPTOMS, isUrgentCheckin, pregnancyInfo, type CheckinSymptom } from '@azza/shared'
import { CheckCircleIcon, ExclamationTriangleIcon, PhoneIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { useMemo, useState } from 'react'

const FEELINGS = ['fine', 'tired', 'unwell'] as const

// Demo placeholder until the clinic's real number is configured.
const CLINIC_PHONE = 'tel:+200000000000'

/**
 * The page a patient opens from the link the clinic sends. It needs no login;
 * in production the token in the URL resolves to one patient and one form.
 */
export function PublicFormPage() {
  const { t, l, toggle } = useLang()
  const today = useMemo(() => new Date(), [])
  const patient = findPatient('p-1187')!
  const info = pregnancyInfo(patient, today)

  const [feeling, setFeeling] = useState<(typeof FEELINGS)[number] | null>(null)
  const [symptoms, setSymptoms] = useState<CheckinSymptom[]>([])
  const [systolic, setSystolic] = useState('')
  const [diastolic, setDiastolic] = useState('')
  const [question, setQuestion] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const toggleSymptom = (s: CheckinSymptom, on: boolean) => {
    if (s === 'none') return setSymptoms(on ? ['none'] : [])
    setSymptoms((prev) => (on ? [...prev.filter((x) => x !== 'none'), s] : prev.filter((x) => x !== s)))
  }

  const urgent = isUrgentCheckin({ symptoms, systolic: Number(systolic) || null, diastolic: Number(diastolic) || null })
  const answered = feeling !== null || symptoms.length > 0 || systolic !== '' || question !== ''
  const firstName = l(patient.name).split(' ')[0]

  return (
    <div className="min-h-svh bg-seashell dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-950/5 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <AzzahAppIcon className="size-8" />
          <span className="flex-1 text-base/6 font-semibold text-zinc-950 dark:text-white">{t('app.clinicName')}</span>
          <ThemeToggleButton />
          <Button plain onClick={toggle}>
            {t('app.switchLanguage')}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-6 pb-16">
        {submitted ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
            <AzzahLockup className="mx-auto h-24 text-zinc-900 dark:text-white" />
            <CheckCircleIcon className="mx-auto mt-6 size-10 fill-teal-600" />
            <h1 className="mt-4 text-xl/8 font-semibold text-zinc-950 dark:text-white">
              {t('publicForm.thanksTitle')}
            </h1>
            <p className="mt-2 text-base/7 text-zinc-600 dark:text-zinc-400">{t('publicForm.thanksBody')}</p>
            {urgent && (
              <div className="mt-6 rounded-xl bg-red-50 p-4 text-start text-sm/6 font-medium text-red-900 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900">
                {t('publicForm.thanksUrgent')}
                <Button color="red" href={CLINIC_PHONE} className="mt-3 w-full">
                  <PhoneIcon />
                  {t('publicForm.callClinic')}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              setSubmitted(true)
            }}
          >
            <div className="px-1">
              <p className="text-sm/6 text-zinc-500 dark:text-zinc-400">{t('publicForm.hello', { name: firstName })}</p>
              <h1 className="mt-0.5 text-2xl/8 font-semibold text-zinc-950 dark:text-white">{t('publicForm.title')}</h1>
              {info && (
                <p className="mt-1 text-sm/6 text-zinc-500 dark:text-zinc-400">
                  {t('publicForm.meta', { w: info.weeks, d: info.days })}
                </p>
              )}
            </div>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
              <Fieldset>
                <Legend className="text-base/7!">{t('publicForm.feel')}</Legend>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {FEELINGS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={feeling === f}
                      onClick={() => setFeeling(f)}
                      className={clsx(
                        'min-h-12 rounded-xl px-2 text-sm/5 font-medium ring-1 transition',
                        feeling === f
                          ? 'bg-brand-50 text-brand-800 ring-2 ring-brand-600 dark:bg-brand-950/50 dark:text-brand-200'
                          : 'bg-white text-zinc-700 ring-zinc-950/10 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10',
                      )}
                    >
                      {t(`publicForm.${f}`)}
                    </button>
                  ))}
                </div>
              </Fieldset>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
              <Fieldset>
                <Legend className="text-base/7!">{t('publicForm.symptoms')}</Legend>
                <CheckboxGroup className="mt-4">
                  {CHECKIN_SYMPTOMS.map((s) => (
                    <CheckboxField key={s}>
                      <Checkbox color="brand" checked={symptoms.includes(s)} onChange={(on) => toggleSymptom(s, on)} />
                      <Label className="text-base/6!">{t(`publicForm.${s}`)}</Label>
                    </CheckboxField>
                  ))}
                </CheckboxGroup>
              </Fieldset>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
              <Fieldset>
                <Legend className="text-base/7!">{t('publicForm.bp')}</Legend>
                <div className="mt-4 grid grid-cols-2 gap-3" dir="ltr">
                  <Field>
                    <Label>{t('publicForm.systolic')}</Label>
                    <Input
                      inputMode="numeric"
                      type="number"
                      min={60}
                      max={250}
                      value={systolic}
                      onChange={(e) => setSystolic(e.target.value)}
                      placeholder="120"
                    />
                  </Field>
                  <Field>
                    <Label>{t('publicForm.diastolic')}</Label>
                    <Input
                      inputMode="numeric"
                      type="number"
                      min={30}
                      max={160}
                      value={diastolic}
                      onChange={(e) => setDiastolic(e.target.value)}
                      placeholder="80"
                    />
                  </Field>
                </div>
              </Fieldset>
            </section>

            {urgent && (
              <div
                role="alert"
                className="flex gap-3 rounded-2xl bg-red-50 p-5 text-red-900 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900"
              >
                <ExclamationTriangleIcon className="size-6 shrink-0 fill-red-600" />
                <div className="space-y-3">
                  <p className="text-sm/6 font-medium">{t('publicForm.warning')}</p>
                  <Button color="red" href={CLINIC_PHONE} className="w-full">
                    <PhoneIcon />
                    {t('publicForm.callClinic')}
                  </Button>
                </div>
              </div>
            )}

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
              <Field>
                <Label className="text-base/7! font-semibold!">{t('publicForm.question')}</Label>
                <Textarea
                  rows={3}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t('publicForm.questionPlaceholder')}
                  className="mt-3"
                />
              </Field>
            </section>

            <Button type="submit" color="brand" disabled={!answered} className="w-full py-3! text-base/6!">
              {t('publicForm.submit')}
            </Button>
            <p className="px-2 text-center text-xs/5 text-zinc-500 dark:text-zinc-400">
              {t('publicForm.privacy')}
              <br />
              {t('publicForm.emergency')}
            </p>
          </form>
        )}
      </main>
    </div>
  )
}
