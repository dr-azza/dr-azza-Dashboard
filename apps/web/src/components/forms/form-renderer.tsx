import { Button } from '@/components/catalyst/button'
import { Input } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import { Textarea } from '@/components/catalyst/textarea'
import { ApiError } from '@/lib/api'
import {
  type AnswerError,
  type Answers,
  type AnswerValue,
  type FormField,
  type FormLanguage,
  normalizePhone,
  validateAnswers,
  visibleFieldIds,
} from '@azza/shared'
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import i18n from 'i18next'
import { useId, useMemo, useState } from 'react'

export interface Respondent {
  name: string
  phone: string
}

/**
 * A form as the patient sees and fills it: conditional questions appear and disappear as she
 * answers, and answers are checked with the same shared rules the API applies. Used by the patient
 * page and by the builder's preview (with `onSubmit` omitted), so the preview is the real thing.
 */
export function FormRenderer({
  fields,
  language,
  askIdentity,
  onSubmit,
}: {
  fields: FormField[]
  language: FormLanguage
  /** Shared link: ask for name and phone first so the clinic can match the answers. */
  askIdentity: boolean
  /** Omitted in preview: the button validates but sends nothing. */
  onSubmit?: (answers: Answers, respondent: Respondent | null) => Promise<void>
}) {
  const t = useMemo(() => i18n.getFixedT(language), [language])
  const [answers, setAnswers] = useState<Answers>({})
  const [respondent, setRespondent] = useState<Respondent>({ name: '', phone: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [previewOk, setPreviewOk] = useState(false)
  const visible = visibleFieldIds(fields, answers)

  const message = (field: FormField | undefined, code: AnswerError) =>
    code === 'out_of_range'
      ? t('publicForm.errors.out_of_range', { min: field?.min ?? '', max: field?.max ?? '' })
      : field?.type === 'phone' && code === 'invalid'
        ? t('publicForm.errors.phone')
        : t(`publicForm.errors.${code}`)

  const setAnswer = (id: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
    setPreviewOk(false)
    if (errors[id]) setErrors(({ [id]: _, ...rest }) => rest)
  }

  const showErrors = (found: Record<string, string>) => {
    setErrors(found)
    setSummary(t('publicForm.errors.summary'))
    // Bring the first problem into view and focus it, in page order.
    const order = ['respondent-name', 'respondent-phone', ...fields.map((f) => f.id)]
    const first = order.find((id) => found[id])
    if (first) {
      const el = document.getElementById(`q-${first}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.querySelector<HTMLElement>('input, textarea, select, button')?.focus({ preventScroll: true })
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSummary(null)
    const found: Record<string, string> = {}
    if (askIdentity) {
      if (!respondent.name.trim()) found['respondent-name'] = t('publicForm.errors.required')
      if (!normalizePhone(respondent.phone)) found['respondent-phone'] = t('publicForm.errors.phone')
    }
    const result = validateAnswers(fields, answers)
    for (const [id, code] of Object.entries(result.errors)) {
      found[id] = message(
        fields.find((f) => f.id === id),
        code,
      )
    }
    if (Object.keys(found).length) return showErrors(found)
    setErrors({})
    if (!onSubmit) return setPreviewOk(true)

    setSending(true)
    try {
      await onSubmit(result.answers, askIdentity ? { name: respondent.name.trim(), phone: respondent.phone } : null)
    } catch (error) {
      const body = error instanceof ApiError ? (error.body as { fieldErrors?: Record<string, AnswerError> }) : null
      if (body?.fieldErrors && Object.keys(body.fieldErrors).length) {
        const serverFound: Record<string, string> = {}
        for (const [id, code] of Object.entries(body.fieldErrors)) {
          if (id === 'respondent') serverFound['respondent-phone'] = t('publicForm.errors.phone')
          else
            serverFound[id] = message(
              fields.find((f) => f.id === id),
              code,
            )
        }
        showErrors(serverFound)
      } else {
        setSummary(t('publicForm.errors.failed'))
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4" lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {askIdentity && (
        <QuestionCard title={t('publicForm.yourDetails')} section>
          <div className="grid gap-4 sm:grid-cols-2">
            <SimpleField id="respondent-name" label={t('publicForm.name')} required error={errors['respondent-name']}>
              {(props) => (
                <Input
                  {...props}
                  autoComplete="name"
                  value={respondent.name}
                  onChange={(e) => {
                    setRespondent((r) => ({ ...r, name: e.target.value }))
                    setErrors(({ 'respondent-name': _, ...rest }) => rest)
                  }}
                />
              )}
            </SimpleField>
            <SimpleField
              id="respondent-phone"
              label={t('publicForm.phone')}
              hint={t('publicForm.phoneHint')}
              required
              error={errors['respondent-phone']}
            >
              {(props) => (
                <Input
                  {...props}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  className="[&_input]:text-start"
                  value={respondent.phone}
                  onChange={(e) => {
                    setRespondent((r) => ({ ...r, phone: e.target.value }))
                    setErrors(({ 'respondent-phone': _, ...rest }) => rest)
                  }}
                />
              )}
            </SimpleField>
          </div>
        </QuestionCard>
      )}

      {fields.map((field) =>
        visible.has(field.id) ? (
          <Question
            key={field.id}
            field={field}
            value={answers[field.id] ?? null}
            error={errors[field.id]}
            onChange={(v) => setAnswer(field.id, v)}
            t={t}
          />
        ) : null,
      )}

      {summary && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm/6 font-medium text-red-800 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900"
        >
          <ExclamationCircleIcon className="size-5 shrink-0" />
          {summary}
        </p>
      )}
      {previewOk && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm/6 font-medium text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900"
        >
          <CheckCircleIcon className="size-5 shrink-0" />
          {t('forms.previewNote')}
        </p>
      )}
      <Button type="submit" color="brand" className="w-full py-3! text-base/6!" disabled={sending}>
        {sending ? t('publicForm.sending') : t('publicForm.submit')}
      </Button>
    </form>
  )
}

type T = ReturnType<typeof i18n.getFixedT>

function QuestionCard({
  id,
  title,
  description,
  required,
  error,
  section,
  children,
}: {
  id?: string
  title: string
  description?: string | null
  required?: boolean
  error?: string
  section?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      id={id}
      className={clsx(
        'scroll-mt-24 rounded-2xl p-5 sm:p-6',
        section ? 'bg-transparent px-1! pb-0!' : 'bg-white shadow-xs ring-1 dark:bg-zinc-900',
        !section && (error ? 'ring-2 ring-red-500' : 'ring-zinc-950/8 dark:ring-white/10'),
      )}
    >
      {section ? (
        <div className="border-b-2 border-brand-600/30 pb-2">
          <h2 className="text-lg/7 font-semibold text-brand-800 dark:text-brand-200">{title}</h2>
          {description && (
            <p className="mt-1 text-sm/6 whitespace-pre-line text-zinc-600 dark:text-zinc-400">{description}</p>
          )}
        </div>
      ) : (
        <>
          <p className="text-base/7 font-semibold text-zinc-950 dark:text-white">
            {title}
            {required && (
              <span className="ms-1 text-red-600" aria-hidden="true">
                *
              </span>
            )}
          </p>
          {description && (
            <p className="mt-1 text-sm/6 whitespace-pre-line text-zinc-600 dark:text-zinc-400">{description}</p>
          )}
        </>
      )}
      {children && <div className={clsx(section ? 'mt-4' : 'mt-4')}>{children}</div>}
      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm/6 font-medium text-red-600 dark:text-red-400">
          <ExclamationCircleIcon className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

/** Label + control + hint + error for the identity fields. */
function SimpleField({
  id,
  label,
  hint,
  required,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  required?: boolean
  error?: string
  children: (props: {
    id: string
    'aria-invalid'?: boolean
    'aria-describedby'?: string
    invalid?: boolean
  }) => React.ReactNode
}) {
  const hintId = `${id}-hint`
  return (
    <div id={`q-${id}`} className="scroll-mt-24">
      <label htmlFor={id} className="block text-sm/6 font-medium text-zinc-950 dark:text-white">
        {label}
        {required && (
          <span className="ms-1 text-red-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="mt-2">
        {children({
          id,
          invalid: !!error,
          'aria-invalid': !!error || undefined,
          'aria-describedby': hint || error ? hintId : undefined,
        })}
      </div>
      {(error || hint) && (
        <p
          id={hintId}
          className={clsx(
            'mt-1.5 text-sm/6',
            error ? 'font-medium text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400',
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

function Question({
  field,
  value,
  error,
  onChange,
  t,
}: {
  field: FormField
  value: AnswerValue
  error?: string
  onChange: (value: AnswerValue) => void
  t: T
}) {
  const inputId = useId()
  if (field.type === 'section') {
    return <QuestionCard id={`q-${field.id}`} title={field.label} description={field.description} section />
  }
  const invalid = !!error
  const text = typeof value === 'string' ? value : ''

  let control: React.ReactNode
  switch (field.type) {
    case 'short_text':
      control = (
        <Input
          id={inputId}
          aria-label={field.label}
          invalid={invalid}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      )
      break
    case 'long_text':
      control = (
        <Textarea
          id={inputId}
          aria-label={field.label}
          rows={4}
          invalid={invalid}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      )
      break
    case 'phone':
      control = (
        <Input
          id={inputId}
          aria-label={field.label}
          type="tel"
          inputMode="tel"
          dir="ltr"
          className="[&_input]:text-start"
          invalid={invalid}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      )
      break
    case 'date':
      control = (
        <Input
          id={inputId}
          aria-label={field.label}
          type="date"
          className="sm:max-w-56"
          invalid={invalid}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      )
      break
    case 'number':
      control = (
        <Input
          id={inputId}
          aria-label={field.label}
          type="number"
          inputMode="decimal"
          className="sm:max-w-56"
          min={field.min ?? undefined}
          max={field.max ?? undefined}
          invalid={invalid}
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      )
      break
    case 'dropdown':
      control = (
        <Select
          id={inputId}
          aria-label={field.label}
          invalid={invalid}
          value={text}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">{t('publicForm.selectPlaceholder')}</option>
          {field.options?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
      )
      break
    case 'yes_no':
      control = (
        <ChoiceGroup label={field.label} className="grid grid-cols-2 gap-3">
          {(['yes', 'no'] as const).map((v) => (
            <ChoiceCard key={v} type="radio" name={field.id} checked={value === v} onChange={() => onChange(v)} center>
              {t(`publicForm.${v}`)}
            </ChoiceCard>
          ))}
        </ChoiceGroup>
      )
      break
    case 'single_choice':
      control = (
        <ChoiceGroup label={field.label} className="grid gap-2">
          {field.options?.map((o) => (
            <ChoiceCard
              key={o.id}
              type="radio"
              name={field.id}
              checked={value === o.id}
              onChange={() => onChange(o.id)}
            >
              {o.label}
            </ChoiceCard>
          ))}
        </ChoiceGroup>
      )
      break
    case 'multi_choice': {
      const picked = Array.isArray(value) ? value : []
      control = (
        <ChoiceGroup label={field.label} className="grid gap-2">
          {field.options?.map((o) => (
            <ChoiceCard
              key={o.id}
              type="checkbox"
              name={field.id}
              checked={picked.includes(o.id)}
              onChange={(on) => onChange(on ? [...picked, o.id] : picked.filter((p) => p !== o.id))}
            >
              {o.label}
            </ChoiceCard>
          ))}
        </ChoiceGroup>
      )
      break
    }
    case 'scale': {
      const min = field.min ?? 0
      const max = field.max ?? 10
      const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i)
      control = (
        <div>
          <ChoiceGroup label={field.label} className="flex flex-wrap gap-1.5">
            {steps.map((n) => (
              <ChoiceCard
                key={n}
                type="radio"
                name={field.id}
                checked={value === n}
                onChange={() => onChange(n)}
                compact
              >
                {n}
              </ChoiceCard>
            ))}
          </ChoiceGroup>
          {(field.minLabel || field.maxLabel) && (
            <div className="mt-2 flex justify-between gap-4 text-xs/5 text-zinc-500 dark:text-zinc-400">
              <span>{field.minLabel}</span>
              <span className="text-end">{field.maxLabel}</span>
            </div>
          )}
        </div>
      )
      break
    }
  }

  return (
    <QuestionCard
      id={`q-${field.id}`}
      title={field.label}
      description={field.description}
      required={field.required}
      error={error}
    >
      {control}
    </QuestionCard>
  )
}

function ChoiceGroup({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className={className}>
      {children}
    </div>
  )
}

/** A big, tappable option backed by a real radio/checkbox input (keyboard and screen readers work natively). */
function ChoiceCard({
  type,
  name,
  checked,
  onChange,
  center,
  compact,
  children,
}: {
  type: 'radio' | 'checkbox'
  name: string
  checked: boolean
  onChange: (checked: boolean) => void
  center?: boolean
  compact?: boolean
  children: React.ReactNode
}) {
  return (
    <label
      className={clsx(
        'flex cursor-pointer items-center gap-3 rounded-xl text-base/6 font-medium ring-1 transition-colors select-none has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-600',
        compact ? 'size-11 justify-center sm:size-12' : 'px-4 py-3',
        center && 'justify-center',
        checked
          ? 'bg-brand-50 text-brand-900 ring-2 ring-brand-600 dark:bg-brand-950/60 dark:text-brand-100'
          : 'bg-white text-zinc-800 ring-zinc-950/10 hover:bg-zinc-50 dark:bg-zinc-800/60 dark:text-zinc-200 dark:ring-white/10 dark:hover:bg-zinc-800',
      )}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {!compact && !center && (
        <span
          aria-hidden="true"
          className={clsx(
            'flex size-5 shrink-0 items-center justify-center ring-1',
            type === 'radio' ? 'rounded-full' : 'rounded-md',
            checked ? 'bg-brand-600 ring-brand-600' : 'bg-white ring-zinc-950/20 dark:bg-zinc-900 dark:ring-white/20',
          )}
        >
          {checked &&
            (type === 'radio' ? (
              <span className="size-2 rounded-full bg-white" />
            ) : (
              <svg viewBox="0 0 14 14" fill="none" className="size-3.5 stroke-white">
                <path d="M3 8L6 11L11 3.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ))}
        </span>
      )}
      <span className="min-w-0">{children}</span>
    </label>
  )
}
