import { ThemeToggleButton } from '@/components/app/theme-switcher'
import { AzzahLockup } from '@/components/brand/logo'
import { AuthLayout } from '@/components/catalyst/auth-layout'
import { Button } from '@/components/catalyst/button'
import { Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Text } from '@/components/catalyst/text'
import { useLang } from '@/i18n'
import { ApiError } from '@/lib/api'
import { useLogin, useMe } from '@/lib/queries'
import { LoginSchema } from '@azza/shared'
import { ExclamationTriangleIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'

export function LoginPage() {
  const { t, toggle } = useLang()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Coming from a just-used invite link: the email is already known (passed in state, not the URL).
  const knownEmail = (useLocation().state as { email?: string } | null)?.email
  const me = useMe()
  const login = useLogin()
  const [error, setError] = useState<string | null>(null)

  // Only same-app paths are allowed as a return target (no open redirects).
  const next = params.get('next')
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'

  if (me.data) return <Navigate to={target} replace />

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)
    const parsed = LoginSchema.safeParse({ email: form.get('email'), password: form.get('password') })
    if (!parsed.success) return setError(t('auth.wrong'))
    try {
      await login.mutateAsync(parsed.data)
      navigate(target, { replace: true })
    } catch (e) {
      setError(e instanceof ApiError && e.status === 429 ? t('auth.tooMany') : t('auth.wrong'))
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={onSubmit} className="grid w-full max-w-sm grid-cols-1 gap-8" noValidate>
        <div className="flex items-center justify-between">
          <AzzahLockup tagline={false} className="h-16 text-zinc-900 dark:text-white" />
          <div className="flex items-center gap-1">
            <ThemeToggleButton />
            <Button plain onClick={toggle}>
              {t('app.switchLanguage')}
            </Button>
          </div>
        </div>
        <div>
          <h1 className="text-xl/8 font-semibold text-zinc-950 dark:text-white">{t('auth.title')}</h1>
          <Text className="mt-1">{t('auth.subtitle')}</Text>
        </div>
        <FieldGroup>
          <Field>
            <Label>{t('auth.email')}</Label>
            <Input
              type="email"
              name="email"
              autoComplete="username"
              required
              autoFocus={!knownEmail}
              defaultValue={knownEmail}
              invalid={!!error}
              dir="ltr"
            />
          </Field>
          <Field>
            <Label>{t('auth.password')}</Label>
            <Input
              type="password"
              name="password"
              autoFocus={!!knownEmail}
              autoComplete="current-password"
              required
              invalid={!!error}
              dir="ltr"
            />
          </Field>
        </FieldGroup>
        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm/6 font-medium text-red-700 dark:text-red-400">
            <ExclamationTriangleIcon className="size-4 shrink-0" />
            {error}
          </p>
        )}
        <Button type="submit" color="brand" className="w-full" disabled={login.isPending}>
          {t('auth.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
