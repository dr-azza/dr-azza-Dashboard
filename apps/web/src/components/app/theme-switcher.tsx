import { useLang } from '@/i18n'
import { THEME_PREFS, useTheme, type ThemePref } from '@/lib/theme'
import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/16/solid'
import { MoonIcon as MoonIcon20, SunIcon as SunIcon20 } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { AnimatePresence, LayoutGroup, motion, MotionConfig } from 'framer-motion'
import { useId } from 'react'

const ICONS: Record<ThemePref, typeof SunIcon> = { light: SunIcon, dark: MoonIcon, system: ComputerDesktopIcon }
const SPRING = { type: 'spring', bounce: 0.2, duration: 0.35 } as const

/**
 * Sidebar row: "Appearance" label with an icon-only Light / Dark / System pill.
 * The white thumb slides to the selected option.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { t } = useLang()
  const { theme, resolved, setTheme } = useTheme()
  const groupId = useId()
  const LabelIcon = resolved === 'dark' ? MoonIcon20 : SunIcon20

  return (
    <MotionConfig reducedMotion="user">
      <div className={clsx(className, 'flex items-center gap-3 rounded-lg px-2 py-1.5')}>
        <LabelIcon aria-hidden="true" className="size-5 shrink-0 fill-zinc-500 dark:fill-zinc-400" />
        <span className="flex-1 truncate text-base/6 font-medium text-zinc-950 sm:text-sm/5 dark:text-white">
          {t('theme.label')}
        </span>

        <LayoutGroup id={groupId}>
          <div
            role="radiogroup"
            aria-label={t('theme.label')}
            className="flex shrink-0 items-center gap-0.5 rounded-full bg-zinc-950/5 p-0.5 ring-1 ring-zinc-950/5 ring-inset dark:bg-white/5 dark:ring-white/10"
          >
            {THEME_PREFS.map((pref) => {
              const Icon = ICONS[pref]
              const active = theme === pref
              return (
                <button
                  key={pref}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={t(`theme.${pref}`)}
                  title={t(`theme.${pref}`)}
                  onClick={() => setTheme(pref)}
                  className={clsx(
                    'relative flex size-7 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600',
                    active
                      ? 'text-brand-700 dark:text-brand-200'
                      : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="theme-thumb"
                      transition={SPRING}
                      className="absolute inset-0 rounded-full bg-white shadow-sm ring-1 ring-zinc-950/10 dark:bg-zinc-700 dark:ring-white/10"
                    />
                  )}
                  <Icon aria-hidden="true" className="relative size-4" />
                </button>
              )
            })}
          </div>
        </LayoutGroup>
      </div>
    </MotionConfig>
  )
}

/** Compact header button that flips between light and dark, with the icon rotating in. */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { t } = useLang()
  const { resolved, setTheme } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'
  const Icon = resolved === 'dark' ? MoonIcon20 : SunIcon20

  return (
    <MotionConfig reducedMotion="user">
      <button
        type="button"
        onClick={() => setTheme(next)}
        aria-label={t(`theme.${next}`)}
        title={t(`theme.${next}`)}
        className={clsx(
          className,
          'relative flex size-10 items-center justify-center overflow-hidden rounded-full text-zinc-600 ring-1 ring-zinc-950/10 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-zinc-300 dark:ring-white/15 dark:hover:bg-white/10 dark:hover:text-white'
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={resolved}
            initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
            transition={SPRING}
            className="flex"
          >
            <Icon aria-hidden="true" className="size-5" />
          </motion.span>
        </AnimatePresence>
      </button>
    </MotionConfig>
  )
}
