import {
  BRAND_NAME,
  LOCKUP_VIEWBOX,
  LOCKUP_VIEWBOX_NO_TAGLINE,
  SYMBOL_PATHS,
  SYMBOL_VIEWBOX,
  TAGLINE_PATHS,
  WORDMARK_PATHS,
} from '@azza/brand'
import clsx from 'clsx'

type LogoProps = { className?: string; title?: string }

/*
 * Official AZZAH artwork, drawn in `currentColor`. Only use the brand's variants:
 * Space Cadet on light backgrounds, white on dark or plum backgrounds, plum on light ones.
 */

/** Symbol only, used for app icons, avatars and tight spaces. */
export function AzzahSymbol({ className, title = BRAND_NAME }: LogoProps) {
  return (
    <svg
      viewBox={SYMBOL_VIEWBOX}
      role="img"
      aria-label={title}
      className={clsx(className, 'shrink-0')}
      fill="currentColor"
    >
      {SYMBOL_PATHS.map((d) => (
        <path key={d.slice(0, 24)} d={d} />
      ))}
    </svg>
  )
}

/** Stacked lockup: symbol, AZZAH wordmark and, optionally, the "All about her" tagline. */
export function AzzahLockup({ className, title = BRAND_NAME, tagline = true }: LogoProps & { tagline?: boolean }) {
  const paths = tagline ? [...SYMBOL_PATHS, ...WORDMARK_PATHS, ...TAGLINE_PATHS] : [...SYMBOL_PATHS, ...WORDMARK_PATHS]
  return (
    <svg
      viewBox={tagline ? LOCKUP_VIEWBOX : LOCKUP_VIEWBOX_NO_TAGLINE}
      role="img"
      aria-label={title}
      className={clsx(className, 'shrink-0')}
      fill="currentColor"
    >
      {paths.map((d) => (
        <path key={d.slice(0, 24)} d={d} />
      ))}
    </svg>
  )
}

/** App-icon lockup (guide p.10): white symbol on a plum rounded square. */
export function AzzahAppIcon({ className, title = BRAND_NAME }: LogoProps) {
  return (
    <span
      role="img"
      aria-label={title}
      className={clsx(className, 'flex shrink-0 items-center justify-center rounded-[22%] bg-brand-600 text-white')}
    >
      <AzzahSymbol title="" className="size-[76%]" />
    </span>
  )
}
