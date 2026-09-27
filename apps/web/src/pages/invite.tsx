import { ThemeToggleButton } from '@/components/app/theme-switcher'
import { AzzahLockup } from '@/components/brand/logo'
import { Button } from '@/components/catalyst/button'
import { Description, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { useLang } from '@/i18n'
import { api, ApiError } from '@/lib/api'
import { PASSWORD_MIN, type PublicInviteDto } from '@azza/shared'
import { CheckCircleIcon, ClockIcon, LanguageIcon, NoSymbolIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

/**
 * Where a new team member (or someone resetting a password) lands from their one-time link.
 * No session needed; the token itself is the permission, and it works once.
 */
export function InvitePage() {
  const { token = '' } = useParams()
  const { t, toggle } = useLang()
  const navigate = useNavigate()
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api<PublicInviteDto>(`/public/invites/${encodeURIComponent(token)}`),
    retry: false,
    staleTime: Infinity,
  })
  const accept = useMutation({
    mutationFn: (password: string) =>
      api<{ email: string }>(`/public/invites/${encodeURIComponent(token)}`, { body: { password } }),
  })

  let body: React.ReactNode
  if (invite.isPending) {
    body = <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/5" />
  } else if (invite.isError || (accept.error instanceof ApiError && accept.error.status === 410)) {
    const gone =
      (invite.error ?? accept.error) instanceof ApiError && ((invite.error ?? accept.error) as ApiError).status === 410
    body = (
      <Notice
        icon={gone ? ClockIcon : NoSymbolIcon}
        title={gone ? t('invite.goneTitle') : t('invite.notFoundTitle')}
        body={gone ? t('invite.goneBody') : t('invite.notFoundBody')}
      />
    )
  } else if (accept.isSuccess) {
    body = (
      <Notice
        icon={CheckCircleIcon}
        success
        title={t('invite.doneTitle')}
        body={t('invite.doneBody', { email: accept.data.email })}
      >
        {/* The email rides in navigation state, never in the URL (history, logs). */}
        <Button
          color="brand"
          className="mt-6"
          onClick={() => navigate('/login', { state: { email: accept.data.email } })}
        >
          {t('invite.signIn')}
        </Button>
      </Notice>
    )
  } else {
    const i = invite.data
    body = (
      <form
        noValidate
        className="rounded-2xl bg-white p-6 shadow-xs ring-1 ring-zinc-950/8 sm:p-8 dark:bg-zinc-900 dark:ring-white/10"
        onSubmit={(event) => {
          event.preventDefault()
          const f = new FormData(event.currentTarget)
          const password = String(f.get('password') ?? '')
          if (password.length < PASSWORD_MIN) return setError(t('invite.tooShort', { min: PASSWORD_MIN }))
          if (password !== String(f.get('confirm') ?? '')) return setError(t('invite.mismatch'))
          setError(null)
          accept.mutate(password)
        }}
      >
        <h1 className="text-2xl/8 font-bold text-zinc-950 dark:text-white">
          {i.kind === 'welcome'
            ? t('invite.welcomeTitle', { name: i.fullName.split(/\s+/)[0] })
            : t('invite.resetTitle')}
        </h1>
        <p className="mt-2 text-base/7 text-zinc-600 dark:text-zinc-400">
          {i.kind === 'welcome'
            ? t('invite.welcomeBody', { clinic: i.clinicName })
            : t('invite.resetBody', { email: i.email })}
        </p>
        <FieldGroup className="mt-6">
          {/* Lets password managers save the new password against the right account. */}
          <input type="email" name="username" autoComplete="username" value={i.email} readOnly hidden />
          <Field>
            <div className="flex items-center justify-between">
              <Label>{t('invite.password')}</Label>
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="text-sm/6 font-medium text-brand-700 dark:text-brand-300"
              >
                {show ? t('invite.hide') : t('invite.show')}
              </button>
            </div>
            <Input
              name="password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              autoFocus
              invalid={!!error}
              dir="ltr"
            />
            <Description>{t('invite.hint', { min: PASSWORD_MIN })}</Description>
          </Field>
          <Field>
            <Label>{t('invite.confirm')}</Label>
            <Input
              name="confirm"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              invalid={!!error}
              dir="ltr"
            />
          </Field>
          {(error || accept.isError) && (
            <p role="alert" className="text-sm/6 font-medium text-red-600 dark:text-red-400">
              {error ?? t('invite.failed')}
            </p>
          )}
          <Button type="submit" color="brand" className="w-full" disabled={accept.isPending}>
            {accept.isPending ? t('invite.submitting') : t('invite.submit')}
          </Button>
        </FieldGroup>
      </form>
    )
  }

  return (
    <div className="flex min-h-svh flex-col bg-seashell dark:bg-zinc-950">
      <header className="flex items-center justify-end gap-2 p-4">
        <Button plain onClick={toggle} aria-label="Language">
          <LanguageIcon />
        </Button>
        <ThemeToggleButton />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-12">
        <AzzahLockup className="mx-auto mb-8 h-20 text-zinc-900 dark:text-white" />
        {body}
      </main>
    </div>
  )
}

function Notice({
  icon: Icon,
  title,
  body,
  success = false,
  children,
}: {
  icon: typeof CheckCircleIcon
  title: string
  body: string
  success?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-xs ring-1 ring-zinc-950/8 dark:bg-zinc-900 dark:ring-white/10">
      <span
        className={
          success
            ? 'mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
            : 'mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
        }
      >
        <Icon className="size-6" />
      </span>
      <h1 className="mt-4 text-xl/8 font-bold text-zinc-950 dark:text-white">{title}</h1>
      <p className="mt-2 text-base/7 text-zinc-600 dark:text-zinc-400">{body}</p>
      {children}
    </div>
  )
}
