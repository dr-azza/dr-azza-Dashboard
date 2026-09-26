import { AzzahAppIcon } from '@/components/brand/logo'
import { Button } from '@/components/catalyst/button'
import { Text } from '@/components/catalyst/text'
import { useLang } from '@/i18n'
import { useEffect } from 'react'
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router'

type Audience = 'staff' | 'patient'
type Placement = 'page' | 'screen'

/** A readable description of whatever was thrown (Errors, route responses, plain objects). */
function describe(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message)
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/**
 * Shown instead of React Router's developer page when a screen throws.
 * - `placement="page"` renders inside the staff layout (sidebar and session handling stay alive);
 *   `"screen"` fills the window, for routes outside the layout.
 * - `audience="patient"` speaks to patients (public form links) instead of clinic staff.
 * The technical detail is shown in development only, and always logged to the console.
 */
export function RouteError({
  audience = 'staff',
  placement = 'screen',
}: {
  audience?: Audience
  placement?: Placement
}) {
  const error = useRouteError()
  const navigate = useNavigate()
  const { t } = useLang()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  useEffect(() => {
    if (!notFound) console.error('[AZZAH] Screen error:', error)
  }, [error, notFound])

  // A tab opened from a link (print page, WhatsApp form link) has nothing to go back to.
  const canGoBack = window.history.length > 1
  const title = notFound
    ? t('errors.notFoundTitle')
    : audience === 'patient'
      ? t('errors.patientTitle')
      : t('errors.title')
  const body = notFound ? t('errors.notFoundBody') : audience === 'patient' ? t('errors.patientBody') : t('errors.body')

  const card = (
    <div className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <AzzahAppIcon className="mx-auto size-12" />
      <h1 className="text-lg/7 font-semibold text-zinc-950 dark:text-white">{title}</h1>
      <Text>{body}</Text>
      {import.meta.env.DEV && !notFound && (
        <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-3 text-start text-xs/5 whitespace-pre-wrap text-red-700 dark:bg-white/5 dark:text-red-400">
          {describe(error)}
        </pre>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {canGoBack && (
          <Button outline onClick={() => navigate(-1)}>
            {t('errors.back')}
          </Button>
        )}
        {audience === 'staff' && (notFound || !canGoBack) && (
          <Button outline href="/">
            {t('errors.home')}
          </Button>
        )}
        {!notFound && (
          <Button color="brand" onClick={() => window.location.reload()}>
            {t('errors.reload')}
          </Button>
        )}
      </div>
    </div>
  )

  return placement === 'page' ? (
    <div className="flex justify-center py-16">{card}</div>
  ) : (
    <div className="flex min-h-svh items-center justify-center bg-seashell p-6 dark:bg-zinc-950">{card}</div>
  )
}
