/**
 * Hash routing for the Discovery app.
 *
 * The routes are tiny and deterministic, so the parser is pure: the browser
 * hook reads `window.location.hash` and hands it here. Unknown or malformed
 * hashes map to the not-found view instead of guessing.
 *
 * @module route
 */

import { SLUG_PATTERN } from "../../bin/lib/discovery-rules.mjs"

/** One of the three app views, or the not-found fallback. */
export type Route =
  | { view: "projects" }
  | { view: "project"; project: string }
  | { view: "plan"; project: string; plan: string }
  | { view: "not-found" }

/** Decode one path segment and validate it as a slug. */
function slug(segment: string): string | null {
  try {
    const decoded = decodeURIComponent(segment)
    return SLUG_PATTERN.test(decoded) ? decoded : null
  } catch {
    return null
  }
}

/**
 * Parse a location hash.
 *
 * @param hash - The raw hash, with or without the leading `#`.
 * @returns The matching route, or `{ view: "not-found" }`.
 */
export function parseRoute(hash: string): Route {
  const raw = String(hash ?? "").replace(/^#/, "")
  if (raw === "" || raw === "/") return { view: "projects" }
  const parts = raw.split("/").filter((part) => part.length > 0)
  if (parts[0] !== "p" || parts.length < 2 || parts.length > 3) {
    return { view: "not-found" }
  }
  const project = slug(parts[1])
  if (project === null) return { view: "not-found" }
  if (parts.length === 2) return { view: "project", project }
  const plan = slug(parts[2])
  if (plan === null) return { view: "not-found" }
  return { view: "plan", project, plan }
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
    return `#/p/${encodeURIComponent(route.project)}/${encodeURIComponent(route.plan)}`
  }
  return "#/"
}
