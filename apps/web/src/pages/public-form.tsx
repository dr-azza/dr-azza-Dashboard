import { ThemeToggleButton } from '@/components/app/theme-switcher'
import { AzzahAppIcon, AzzahLockup } from '@/components/brand/logo'
import { Button } from '@/components/catalyst/button'
import { FormRenderer } from '@/components/forms/form-renderer'
import { api, ApiError } from '@/lib/api'
import { dirFor } from '@azza/i18n'
import type { FormLanguage, PublicFormDto } from '@azza/shared'
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline'
import { useMutation, useQuery } from '@tanstack/react-query'
import i18n from 'i18next'
import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router'

/**
 * The page a patient opens from a form link. No login: the token in the URL is either the form's
 * shared link or her personal one. Everything is shown in the form's own language and direction,
 * whatever language the device or a staff member last used.
 */
export function PublicFormPage() {
  const { token = '' } = useParams()
  const form = useQuery({
    queryKey: ['public-form', token],
    queryFn: () => api<PublicFormDto>(`/public/forms/${encodeURIComponent(token)}`),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
    staleTime: Infinity,
  })
  const submit = useMutation({
    mutationFn: (body: object) => api<{ ok: true }>(`/public/forms/${encodeURIComponent(token)}/responses`, { body }),
    onSuccess: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
  })

  // Before the form loads (or if it can't), speak the language this device last used.
  const language: FormLanguage = form.data?.language ?? (i18n.language === 'ar' ? 'ar' : 'en')
  const t = useMemo(() => i18n.getFixedT(language), [language])
  useDocumentLanguage(language, form.data?.title)

  let body: React.ReactNode
  if (form.isPending) {
    body = <div className="h-72 animate-pulse rounded-2xl bg-white/70 dark:bg-white/5" />
  } else if (form.isError) {
    const missing = form.error instanceof ApiError && form.error.status === 404
    body = missing ? (
      <Notice icon={NoSymbolIcon} title={t('publicForm.notFoundTitle')} body={t('publicForm.notFoundBody')} />
    ) : (
      <Notice icon={ExclamationTriangleIcon} title={t('publicForm.loadError')}>
        <Button color="brand" className="mt-6" onClick={() => form.refetch()}>
          {t('publicForm.retry')}
        </Button>
      </Notice>
    )
  } else if (submit.isSuccess) {
    body = (
      <Notice
        icon={CheckCircleIcon}
        tone="success"
        title={t('publicForm.thanksTitle')}
        body={t('publicForm.thanksBody')}
      />
    )
  } else if (form.data.state !== 'open') {
    const s = form.data.state
    body = (
      <Notice
        icon={s === 'submitted' ? CheckCircleIcon : s === 'expired' ? ClockIcon : LockClosedIcon}
        tone={s === 'submitted' ? 'success' : 'neutral'}
        title={t(`publicForm.${s}Title`)}
        body={t(`publicForm.${s}Body`)}
      />
    )
  } else {
    const f = form.data
    body = (
      <>
        <div className="mb-6 overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-zinc-950/8 dark:bg-zinc-900 dark:ring-white/10">
          <div className="h-2 bg-linear-to-r from-brand-600 via-brand-500 to-zinc-900 rtl:bg-linear-to-l" />
          <div className="p-6 sm:p-8">
            {f.greetingName && (
              <p className="text-sm/6 font-semibold text-brand-700 dark:text-brand-300">
                {t('publicForm.hello', { name: f.greetingName })}
              </p>
            )}
            <h1 className="mt-1 text-2xl/8 font-bold text-zinc-950 sm:text-3xl/9 dark:text-white">{f.title}</h1>
            {f.description && (
              <p className="mt-3 text-base/7 whitespace-pre-line text-zinc-600 dark:text-zinc-300">{f.description}</p>
            )}
            <p className="mt-4 text-xs/5 text-zinc-500 dark:text-zinc-400">
              <span className="text-red-600">*</span> {t('publicForm.required')}
            </p>
          </div>
        </div>
        <FormRenderer
          fields={f.fields}
          language={f.language}
          askIdentity={f.mode === 'shared'}
          onSubmit={async (answers, respondent) => {
            await submit.mutateAsync({ versionId: f.versionId, answers, respondent })
          }}
        />
      </>
    )
  }

  return (
    <div className="min-h-svh bg-seashell dark:bg-zinc-950" lang={language} dir={dirFor(language)}>
      <header className="sticky top-0 z-10 border-b border-zinc-950/5 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <AzzahAppIcon className="size-9 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm/5 font-semibold text-zinc-950 dark:text-white">
                {form.data?.clinicName ?? 'AZZAH'}
              </p>
              <p className="text-xs/5 text-zinc-500 dark:text-zinc-400">{t('publicForm.poweredBy')}</p>
            </div>
          </div>
          <ThemeToggleButton />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">{body}</main>
      <footer className="mx-auto max-w-2xl px-4 pb-10 text-center">
        <p className="flex items-center justify-center gap-1.5 text-xs/5 text-zinc-500 dark:text-zinc-400">
          <LockClosedIcon className="size-3.5" />
          {t('publicForm.privacy')}
        </p>
        <AzzahLockup className="mx-auto mt-6 h-10 text-zinc-400 dark:text-zinc-600" />
      </footer>
    </div>
  )
}

/** Sets the page language, direction and title while the form is open, and restores them after. */
function useDocumentLanguage(language: FormLanguage, title?: string) {
  useEffect(() => {
    const html = document.documentElement
    const previous = { lang: html.lang, dir: html.dir, title: document.title }
    html.lang = language
    html.dir = dirFor(language)
    if (title) document.title = title
    return () => {
      html.lang = previous.lang
      html.dir = previous.dir
      document.title = previous.title
    }
  }, [language, title])
}

function Notice({
  icon: Icon,
  title,
  body,
  tone = 'neutral',
  children,
}: {
  icon: typeof CheckCircleIcon
  title: string
  body?: string
  tone?: 'neutral' | 'success'
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-white px-6 py-12 text-center shadow-xs ring-1 ring-zinc-950/8 dark:bg-zinc-900 dark:ring-white/10">
      <span
        className={
          tone === 'success'
            ? 'mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
            : 'mx-auto flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
        }
      >
        <Icon className="size-7" />
      </span>
      <h1 className="mt-5 text-xl/8 font-bold text-zinc-950 dark:text-white">{title}</h1>
      {body && <p className="mx-auto mt-2 max-w-sm text-base/7 text-zinc-600 dark:text-zinc-400">{body}</p>}
      {children}
    </div>
  )
}
