/**
 * Theme preference parsing and browser-storage access.
 *
 * The preference is the smallest possible piece of browser state: one of
 * three strings stored under one key. Keeping the parser and the storage seam
 * pure lets the Node tests exercise invalid values and failing storage without
 * a DOM.
 *
 * @module theme
 */

/** The preference the user selected. */
export type ThemePreference = "system" | "light" | "dark"

/** The concrete theme applied to the page. */
export type ResolvedTheme = "light" | "dark"

/** The minimal storage surface the theme helpers use. */
export interface ThemeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** The local-storage key for the Discovery theme preference. */
export const THEME_STORAGE_KEY = "codeops.discovery.theme"

/** Every allowed preference value. */
const PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"]

/**
 * Normalize an unknown stored value to an allowed preference.
 *
 * Missing values, legacy values, and corrupted strings all resolve to System.
 * That is the only safe default: it never forces a theme the user did not ask
 * for.
 *
 * @param value - The raw stored value.
 * @returns One of the three allowed preferences.
 */
export function parseThemePreference(value: unknown): ThemePreference {
  return PREFERENCES.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : "system"
}

/**
 * Resolve a preference against the current OS theme.
 *
 * @param preference - The stored or selected preference.
 * @param systemTheme - The OS theme reported by `matchMedia`.
 * @returns The concrete light or dark theme.
 */
export function resolveTheme(
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference
  return systemTheme
}

/**
 * Read the preference without letting storage failures escape.
 *
 * @param storage - The storage object, or null when the browser has none.
 * @returns The stored preference, or System when it cannot be read.
 */
export function readThemePreference(storage: ThemeStorage | null | undefined): ThemePreference {
  if (storage === null || storage === undefined) return "system"
  try {
    return parseThemePreference(storage.getItem(THEME_STORAGE_KEY))
  } catch {
    return "system"
  }
}

/**
 * Persist one allowed preference.
 *
 * The value is normalized first, so only the documented strings are ever
 * written. A blocked or unavailable storage returns `false`; the caller keeps
 * the in-memory selection instead.
 *
 * @param storage - The storage object, or null when the browser has none.
 * @param preference - The preference to persist.
 * @returns True when the write succeeded.
 */
export function writeThemePreference(
  storage: ThemeStorage | null | undefined,
  preference: string,
): boolean {
  if (storage === null || storage === undefined) return false
  try {
    storage.setItem(THEME_STORAGE_KEY, parseThemePreference(preference))
    return true
  } catch {
    return false
  }
}
