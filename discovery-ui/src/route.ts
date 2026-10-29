/**
 * Hash routing for the Discovery app.
 *
 * The routes are tiny and deterministic, so the parser is pure: the browser
 * hook reads `window.location.hash` and hands it here. Unknown or malformed
 * hashes map to the not-found view instead of guessing.
 *
 * A plan route may also carry an explicit workspace destination. The legacy
 * plan URL stays valid and omits that property, so existing published links
 * keep their original meaning.
 *
 * @module route
 */

import { KEY_PATTERN, SLUG_PATTERN } from "../../bin/lib/discovery-rules.mjs"

/** A selected plan group or the decision summary. */
export type WorkspaceTarget =
  | { kind: "group"; key: string }
  | { kind: "summary" }

/** One of the three app views, or the not-found fallback. */
export type Route =
  | { view: "projects" }
  | { view: "project"; project: string }
  | {
      view: "plan"
      project: string
      plan: string
      /** Omitted by legacy plan links and by routes without a destination. */
      target?: WorkspaceTarget
    }
  | { view: "not-found" }

/** Decode one path segment and validate it against a pattern. */
function decodeSegment(segment: string, pattern: RegExp): string | null {
  try {
    const decoded = decodeURIComponent(segment)
    return pattern.test(decoded) ? decoded : null
  } catch {
    return null
  }
}

/** Decode one project or plan segment and validate it as a slug. */
function slug(segment: string): string | null {
  return decodeSegment(segment, SLUG_PATTERN)
}

/** Decode one group key. */
function groupKey(segment: string): string | null {
  return decodeSegment(segment, KEY_PATTERN)
}

/**
 * Parse a location hash.
 *
 * Empty segments are removed before validation. That keeps the historical
 * tolerance for trailing and doubled slashes; it is not a new route form.
 *
 * @param hash - The raw hash, with or without the leading `#`.
 * @returns The matching route, or `{ view: "not-found" }`.
 */
export function parseRoute(hash: string): Route {
  const raw = String(hash ?? "").replace(/^#/, "")
  if (raw === "" || raw === "/") return { view: "projects" }
  const parts = raw.split("/").filter((part) => part.length > 0)
  if (parts[0] !== "p" || parts.length < 2) return { view: "not-found" }
  const project = slug(parts[1])
  if (project === null) return { view: "not-found" }
  if (parts.length === 2) return { view: "project", project }
  const plan = slug(parts[2])
  if (plan === null) return { view: "not-found" }
  if (parts.length === 3) return { view: "plan", project, plan }
  if (parts.length === 4 && parts[3] === "summary") {
    return { view: "plan", project, plan, target: { kind: "summary" } }
  }
  if (parts.length === 5 && parts[3] === "groups") {
    const key = groupKey(parts[4])
    if (key === null) return { view: "not-found" }
    return { view: "plan", project, plan, target: { kind: "group", key } }
  }
  return { view: "not-found" }
}

/**
 * Format a route as a hash.
 *
 * Valid routes round-trip through {@link parseRoute}; the not-found view has no
 * URL of its own and links back to the projects root.
 *
 * @param route - The route to format.
 * @returns The absolute hash.
 */
export function formatRoute(route: Route): string {
  if (route.view === "project") return `#/p/${encodeURIComponent(route.project)}`
  if (route.view === "plan") {
    const base = `#/p/${encodeURIComponent(route.project)}/${encodeURIComponent(route.plan)}`
    if (route.target === undefined) return base
    if (route.target.kind === "summary") return `${base}/summary`
    return `${base}/groups/${encodeURIComponent(route.target.key)}`
  }
  return "#/"
}
