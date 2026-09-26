#!/usr/bin/env node
/**
 * Builds apps/web/src/components/catalyst from a licensed copy of the Catalyst UI Kit.
 *
 * Catalyst (Tailwind Plus) is a paid product whose source may not be published, so it is not
 * committed to this repository. Each developer puts their own licensed kit in ./catalyst-ui-kit
 * (git-ignored) and runs:  pnpm setup:catalyst
 *
 * The script copies the TypeScript components and applies the AZZAH adaptations:
 *  - physical → logical classes (pl→ps, left→start, …) so Arabic right-to-left works
 *  - direction-aware transforms (mobile sidebar slide, switch thumb, pagination arrows)
 *  - a `brand` colour for Button, Badge, Checkbox, Radio and Switch; brand focus and highlight colours
 *  - brand sidebar indicator and Seashell app canvas
 *  - a Link component wired to React Router
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'catalyst-ui-kit', 'typescript')
const target = path.join(root, 'apps', 'web', 'src', 'components', 'catalyst')
const SKIP = new Set(['application-layout.tsx']) // demo-only, depends on Next.js

if (!fs.existsSync(source)) {
  console.error(
    `Catalyst UI Kit not found at ${path.relative(root, source)}.\n` +
      'Download it from your Tailwind Plus account and unzip it to ./catalyst-ui-kit, then run this again.',
  )
  process.exit(1)
}

const PHYSICAL_TO_LOGICAL = {
  pl: 'ps',
  pr: 'pe',
  ml: 'ms',
  mr: 'me',
  left: 'start',
  right: 'end',
  'border-l': 'border-s',
  'border-r': 'border-e',
  'rounded-l': 'rounded-s',
  'rounded-r': 'rounded-e',
  'rounded-tl': 'rounded-ss',
  'rounded-tr': 'rounded-se',
  'rounded-bl': 'rounded-es',
  'rounded-br': 'rounded-ee',
  'text-left': 'text-start',
  'text-right': 'text-end',
  'scroll-pl': 'scroll-ps',
  'scroll-pr': 'scroll-pe',
}
const utilities = Object.keys(PHYSICAL_TO_LOGICAL)
  .sort((a, b) => b.length - a.length)
  .join('|')
// A class token (optionally after variants ending in ':' and a '-' negative), followed by a value or the token end.
const CLASS_RE = new RegExp(`(^|[\\s"'\`:])(-?)(${utilities})(?=-[\\w\\[(.]|[\\s"'\`]|$)`, 'gm')

/** Replace `from` with `to`, failing loudly if the kit changed and the pattern no longer matches. */
function replace(src, from, to, file) {
  const next = typeof from === 'string' ? src.split(from).join(to) : src.replace(from, to)
  if (next === src) throw new Error(`${file}: pattern not found: ${from}`)
  return next
}

/** Clone the `indigo` colour entry as `brand`, shifted one step darker to centre on brand-600. */
function addBrandColor(src, file) {
  const match = src.match(/\n(\s+)indigo:([\s\S]*?)(?=\n\s+[a-z]+:)/)
  if (!match) throw new Error(`${file}: indigo colour entry not found`)
  const body = match[2]
    .replace(/indigo-600/g, 'brand-700')
    .replace(/indigo-500/g, 'brand-600')
    .replace(/indigo/g, 'brand')
  return src.replace(match[0], `\n${match[1]}brand:${body}${match[0]}`)
}

const perFile = {
  'button.tsx': (s, f) =>
    // The touch target is centred with translate-x; centring is direction-neutral, so keep it physical.
    replace(
      addBrandColor(s, f),
      'absolute top-1/2 start-1/2 size-[max(100%,2.75rem)]',
      'absolute top-1/2 left-1/2 size-[max(100%,2.75rem)]',
      f,
    ),
  'badge.tsx': addBrandColor,
  'checkbox.tsx': addBrandColor,
  'radio.tsx': addBrandColor,
  'switch.tsx': (s, f) =>
    replace(
      addBrandColor(s, f),
      "'group-data-checked:translate-x-4 sm:group-data-checked:translate-x-3',",
      "'group-data-checked:translate-x-4 sm:group-data-checked:translate-x-3 rtl:group-data-checked:-translate-x-4 sm:rtl:group-data-checked:-translate-x-3',",
      f,
    ),
  'pagination.tsx': (s, f) =>
    replace(
      s,
      '<svg className="stroke-current" data-slot="icon"',
      '<svg className="stroke-current rtl:rotate-180" data-slot="icon"',
      f,
    ),
  'sidebar.tsx': (s, f) =>
    replace(
      replace(
        s,
        "'data-current:*:data-[slot=icon]:fill-zinc-950',",
        "'data-current:*:data-[slot=icon]:fill-brand-600',",
        f,
      ),
      'absolute inset-y-2 -start-4 w-0.5 rounded-full bg-zinc-950 dark:bg-white',
      'absolute inset-y-2 -start-4 w-0.5 rounded-full bg-brand-600 dark:bg-brand-400',
      f,
    ),
  'sidebar-layout.tsx': (s, f) =>
    replace(mobilePanel(s, f), 'lg:bg-zinc-100 dark:bg-zinc-900', 'lg:bg-seashell dark:bg-zinc-900', f),
  'stacked-layout.tsx': (s, f) => mobilePanel(s, f),
}

function mobilePanel(s, f) {
  return replace(
    s,
    'className="fixed inset-y-0 w-full max-w-80 p-2 transition duration-300 ease-in-out data-closed:-translate-x-full"',
    'className="fixed inset-y-0 start-0 w-full max-w-80 p-2 transition duration-300 ease-in-out data-closed:-translate-x-full rtl:data-closed:translate-x-full"',
    f,
  )
}

fs.mkdirSync(target, { recursive: true })
let count = 0
for (const file of fs.readdirSync(source)) {
  if (!file.endsWith('.tsx') || SKIP.has(file)) continue
  let src = fs.readFileSync(path.join(source, file), 'utf8')
  src = src.replace(CLASS_RE, (_m, pre, neg, util) => pre + neg + PHYSICAL_TO_LOGICAL[util])
  src = src
    .replace(/(outline|ring)-blue-500/g, '$1-brand-600')
    .replace(/data-focus:bg-blue-500/g, 'data-focus:bg-brand-600')
  if (perFile[file]) src = perFile[file](src, file)
  fs.writeFileSync(path.join(target, file), src)
  count++
}
fs.copyFileSync(path.join(root, 'scripts', 'catalyst', 'link.tsx'), path.join(target, 'link.tsx'))
console.log(`Catalyst ready: ${count} components written to ${path.relative(root, target)}`)
