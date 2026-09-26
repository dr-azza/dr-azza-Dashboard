/**
 * Per-browser preferences (language, theme). Storage can be blocked (private mode,
 * strict settings), so every access is guarded and falls back to the default.
 */
export function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
  } catch {
    return fallback
  }
}

export function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not persisted; the choice lasts for this visit only.
  }
}
