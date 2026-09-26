import { AzzahAppIcon } from '@/components/brand/logo'
import { Button } from '@/components/catalyst/button'
import { Text } from '@/components/catalyst/text'
import { useLang } from '@/i18n'
import { isRouteErrorResponse, useRouteError } from 'react-router'

/**
 * Shown instead of React Router's developer page when a screen throws. Staff get a clear way
 * out (reload or go back); the technical message is shown only in development.
 */
export function RouteError() {
  const error = useRouteError()
  const { t } = useLang()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  const detail = error instanceof Error ? error.message : isRouteErrorResponse(error) ? error.statusText : String(error)

  return (
    <div className="flex min-h-svh items-center justify-center bg-seashell p-6 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
        <AzzahAppIcon className="mx-auto size-12" />
        <h1 className="text-lg/7 font-semibold text-zinc-950 dark:text-white">
          {notFound ? t('errors.notFoundTitle') : t('errors.title')}
        </h1>
        <Text>{notFound ? t('errors.notFoundBody') : t('errors.body')}</Text>
        {import.meta.env.DEV && !notFound && (
          <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-3 text-start text-xs/5 text-red-700 dark:bg-white/5 dark:text-red-400">
            {detail}
          </pre>
        )}
        <div className="flex justify-center gap-2">
          <Button outline onClick={() => window.history.back()}>
            {t('errors.back')}
          </Button>
          <Button color="brand" onClick={() => window.location.reload()}>
            {t('errors.reload')}
          </Button>
        </div>
      </div>
    </div>
  )
}
