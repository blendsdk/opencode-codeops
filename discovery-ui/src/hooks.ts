/**
 * Browser hooks for the Discovery app.
 *
 * These are the only modules that touch `window`, `matchMedia`, or
 * `EventSource`. Keeping them here lets the views and the App stay
 * render-only, which is what makes the server-side render test possible.
 *
 * @module hooks
 */

import { useEffect, useRef, useState } from "react"

/** Read and subscribe to the location hash. */
export function useHashRoute(): string {
  const [hash, setHash] = useState(() =>
    typeof window === "undefined" ? "#/" : window.location.hash || "#/",
  )
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || "#/")
    window.addEventListener("hashchange", onChange)
    return () => window.removeEventListener("hashchange", onChange)
  }, [])
  return hash
}

/** The OS colour scheme, read from inside an effect. */
export function useSystemTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light")
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

/** The connection state shown by the banner. */
export interface PlanEventsState {
  status: "live" | "reconnecting" | "restarted"
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
