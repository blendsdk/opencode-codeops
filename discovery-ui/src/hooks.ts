/**
 * Browser hooks for the Discovery app.
 *
 * These are the only modules that touch `window`, `matchMedia`, or
 * `EventSource`. Keeping them here lets the views and the App stay
 * render-only, which is what makes the server-side render test possible.
 *
 * @module hooks
 */

import { useCallback, useEffect, useRef, useState } from "react"

import {
  readThemePreference,
  resolveTheme,
  writeThemePreference,
} from "./theme.ts"
import type { ResolvedTheme, ThemePreference } from "./theme.ts"

/** The current hash plus the two ways the app may change it. */
export interface HashRouteState {
  /** The current location hash, always starting with `#`. */
  hash: string
  /**
   * Move to another hash.
   *
   * @param hash - The destination, with or without `#`.
   * @param options - `replace` rewrites the current history entry.
   */
  navigate(hash: string, options?: { replace?: boolean }): void
}

/** Read and subscribe to the location hash. */
export function useHashRoute(): HashRouteState {
  const [hash, setHash] = useState(() =>
    typeof window === "undefined" ? "#/" : window.location.hash || "#/",
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    const read = () => setHash(window.location.hash || "#/")
    // A history traversal can fire both events for one move. Reading the
    // location and letting React drop the identical value keeps one update.
    window.addEventListener("popstate", read)
    window.addEventListener("hashchange", read)
    return () => {
      window.removeEventListener("popstate", read)
      window.removeEventListener("hashchange", read)
    }
  }, [])

  const navigate = useCallback((next: string, options?: { replace?: boolean }) => {
    if (typeof window === "undefined") return
    const target = next.startsWith("#") ? next : `#${next}`
    if (options?.replace === true) {
      window.history.replaceState(null, "", target)
    } else {
      window.location.hash = target
    }
    setHash(target)
  }, [])

  return { hash, navigate }
}

/** The OS colour scheme, read from inside an effect. */
export function useSystemTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>("light")
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const query = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => setTheme(query.matches ? "dark" : "light")
    apply()
    query.addEventListener?.("change", apply)
    return () => query.removeEventListener?.("change", apply)
  }, [])
  return theme
}

/** The selected preference, its resolved theme, and the setter. */
export interface ThemeState {
  /** System, Light, or Dark as chosen by the user. */
  preference: ThemePreference
  /** The concrete theme currently applied. */
  resolved: ResolvedTheme
  /** Select and persist a preference, remembering it in memory on failure. */
  setPreference(preference: ThemePreference): void
}

/**
 * Read the stored theme preference and keep it in sync with the OS.
 *
 * Storage is read once in an effect and written from the setter; neither runs
 * during render. If the browser blocks storage the selected preference still
 * applies for this tab.
 */
export function useThemePreference(): ThemeState {
  const [preference, setPreferenceState] = useState<ThemePreference>("system")
  const systemTheme = useSystemTheme()

  useEffect(() => {
    if (typeof window === "undefined") return
    let storage: Storage | null = null
    try {
      storage = window.localStorage
    } catch {
      storage = null
    }
    setPreferenceState(readThemePreference(storage))
  }, [])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    if (typeof window === "undefined") return
    let storage: Storage | null = null
    try {
      storage = window.localStorage
    } catch {
      storage = null
    }
    writeThemePreference(storage, next)
  }, [])

  return { preference, resolved: resolveTheme(preference, systemTheme), setPreference }
}

/** The connection state shown by the banner. */
export interface PlanEventsState {
  status: "live" | "reconnecting" | "restarted"
}

/**
 * Warn before a tab close or reload while local work is unfinished.
 *
 * The listener is effect-scoped and never persists an answer. Browsers decide
 * whether to show their native confirmation; the app never claims a write
 * completed after the page is gone.
 *
 * @param active - True while drafts, incomplete work, or a recheck remain.
 */
export function useUnloadGuard(active: boolean): void {
  useEffect(() => {
    if (!active || typeof window === "undefined") return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [active])
}

/**
 * Subscribe to a plan's server-sent events.
 *
 * `changed` calls `onChanged`; `delivered` calls `onDelivered`. A connection
 * error raises the reconnecting banner; a new `instanceId` after a reconnect
 * means the listener restarted.
 */
export function usePlanEvents(
  url: string | null,
  onChanged: () => void,
  onDelivered: () => void,
): PlanEventsState {
  const [status, setStatus] = useState<PlanEventsState["status"]>("live")
  const handlers = useRef({ onChanged, onDelivered })
  handlers.current = { onChanged, onDelivered }

  useEffect(() => {
    if (url === null || typeof EventSource === "undefined") return
    let instanceId: string | null = null
    const source = new EventSource(url)
    source.addEventListener("hello", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { instanceId?: string }
        if (instanceId !== null && data.instanceId !== instanceId) setStatus("restarted")
        instanceId = data.instanceId ?? instanceId
        setStatus((current) => (current === "restarted" ? current : "live"))
      } catch {
        setStatus("live")
      }
    })
    source.addEventListener("changed", () => handlers.current.onChanged())
    source.addEventListener("delivered", () => handlers.current.onDelivered())
    source.onerror = () => setStatus("reconnecting")
    return () => source.close()
  }, [url])

  return { status }
}
