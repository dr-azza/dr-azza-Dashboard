import { useSyncExternalStore } from 'react'
import { readPref, writePref } from './prefs'

export type ThemePref = 'light' | 'dark' | 'system'
export const THEME_PREFS: readonly ThemePref[] = ['light', 'dark', 'system']

// Keep the key and logic in sync with the inline script in index.html, which applies
// the theme before first paint so the page never flashes the wrong colors.
const STORAGE_KEY = 'theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

let pref: ThemePref = readPref(STORAGE_KEY, THEME_PREFS, 'system')

function apply() {
  const dark = pref === 'dark' || (pref === 'system' && media.matches)
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#171926' : '#f8edeb')
}

media.addEventListener('change', () => {
  if (pref === 'system') apply()
  listeners.forEach((l) => l())
})
apply()

export function setTheme(next: ThemePref) {
  pref = next
  writePref(STORAGE_KEY, next)
  apply()
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => pref)
  const resolved = useSyncExternalStore(subscribe, () =>
    pref === 'dark' || (pref === 'system' && media.matches) ? 'dark' : 'light',
  )
  return { theme, resolved, setTheme }
}
