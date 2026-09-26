import { useLang } from '@/i18n'
import * as Headless from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import type React from 'react'

const WIDTHS = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '4xl': 'sm:max-w-4xl',
}

/**
 * Side panel (drawer) used for every create/edit/confirm flow in the dashboard, instead of
 * centred pop-ups: the page stays visible for context, and long forms get the full height.
 * Slides in from the end edge (right in English, left in Arabic). Pass `onSubmit` to make
 * the whole panel a form, so the footer buttons submit it.
 */
export function SidePanel({
  open,
  onClose,
  title,
  description,
  size = 'lg',
  onSubmit,
  actions,
  children,
}: {
  open: boolean
  /** Called with `false`, so a state setter like `setOpen` can be passed directly. */
  onClose: (open: false) => void
  title: React.ReactNode
  description?: React.ReactNode
  size?: keyof typeof WIDTHS
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  const { t } = useLang()
  const content = (
    <>
      <header className="flex items-start gap-4 border-b border-zinc-950/5 px-6 py-5 dark:border-white/10">
        <div className="min-w-0 flex-1">
          <Headless.DialogTitle className="text-lg/7 font-semibold text-zinc-950 sm:text-base/6 dark:text-white">
            {title}
          </Headless.DialogTitle>
          {description && (
            <Headless.Description className="mt-1 text-sm/6 text-zinc-500 dark:text-zinc-400">
              {description}
            </Headless.Description>
          )}
        </div>
        <button
          type="button"
          onClick={() => onClose(false)}
          aria-label={t('record.cancel')}
          className="-m-1.5 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <XMarkIcon className="size-5" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      {actions && (
        <footer className="flex flex-col-reverse gap-3 border-t border-zinc-950/5 bg-zinc-50/80 px-6 py-4 sm:flex-row sm:justify-end dark:border-white/10 dark:bg-white/2.5">
          {actions}
        </footer>
      )}
    </>
  )

  return (
    <Headless.Dialog open={open} onClose={() => onClose(false)} className="relative z-50">
      <Headless.DialogBackdrop
        transition
        className="fixed inset-0 bg-zinc-950/25 transition duration-300 data-closed:opacity-0 dark:bg-zinc-950/60"
      />
      <div className="fixed inset-0 overflow-hidden">
        <div className="pointer-events-none fixed inset-y-0 end-0 flex max-w-full sm:ps-10">
          <Headless.DialogPanel
            transition
            className={clsx(
              WIDTHS[size],
              'pointer-events-auto flex h-full w-screen flex-col bg-white shadow-xl ring-1 ring-zinc-950/10 transition duration-300 ease-in-out data-closed:translate-x-full rtl:data-closed:-translate-x-full dark:bg-zinc-900 dark:ring-white/10',
            )}
          >
            {onSubmit ? (
              <form noValidate onSubmit={onSubmit} className="flex h-full flex-col">
                {content}
              </form>
            ) : (
              content
            )}
          </Headless.DialogPanel>
        </div>
      </div>
    </Headless.Dialog>
  )
}
