# Server: discovery

> **Document**: 03-04-server.md
> **Parent**: [Index](00-index.md)

## Overview

`bin/lib/discovery-server.mjs` (+ `.d.mts`) owns the process-wide Discovery runtime: one
`node:http` listener shared by every opted-in project in the OpenCode process, the page's HTTP
API, static assets with the CSP nonce, live events, and delivery to registered projects (AR-3,
AR-9, AR-48).

## Architecture

### Current Architecture
The plugin has no HTTP listener; OpenCode offers no plugin routes on its own server (02 §Host
API Evidence).

### Proposed Changes

```text
globalThis[Symbol.for("opencode-codeops.discovery")] = runtime   // spike B
runtime = { listener | null, port, fallback, instanceId, store,
            projects: Map<directory, { slug, deliver(planSlug) }>, viewers: Map<"p/plan", count> }
```

## Implementation Details

### Runtime API

```ts
/** Create a runtime with its own store, assets, and listener; tests use this directly. When the
 *  process-wide slot is empty, the new runtime is installed there, so a later
 *  getDiscoveryRuntime (for example inside setup) returns the same instance. */
export function createDiscoveryRuntime(options: { store: DiscoveryStore; assetsDir: string;
  version: string; port?: number; log?: (message: string) => void }): DiscoveryRuntime

/** The process-wide runtime, created on first use and returned unchanged afterwards. */
export function getDiscoveryRuntime(options: { store: DiscoveryStore; assetsDir: string;
  version: string; port?: number; log?: (message: string) => void }): DiscoveryRuntime

interface DiscoveryRuntime {
  /** Start the listener when needed; concurrent calls share one in-flight attempt. Resolves with
   *  the base URL, or null when no listener can start. */
  ensureListening(): Promise<{ url: string; fallback: boolean } | null>
  /** Register a project's delivery callback; the returned unregister removes only this
   *  registration, so a stale cleanup cannot remove a newer one. */
  registerProject(directory: string, slug: string,
    deliver: (planSlug: string) => Promise<"woken" | "pending" | "failed">): () => void
  /** True when an open page shows this plan (AR-31). */
  hasViewer(projectSlug: string, planSlug: string): boolean
  /** Notify open pages of a plan change (publish, save, submit, resolve, answers claim). */
  notify(projectSlug: string, planSlug: string, event: "changed" | "delivered", data: object): void
  /** End open event streams, close remaining connections, then close the listener when no
   *  project remains registered. Never blocks on an open SSE response. */
  closeIfIdle(): Promise<void>
  planUrl(projectSlug: string, planSlug: string): string | null
  /** The store every handler uses; one instance per process avoids split write queues. */
  readonly store: DiscoveryStore
}
```

`port` defaults to `resolvePort(process.env)`: `CODEOPS_DISCOVERY_PORT` when it parses as an
integer 1–65535, else 4747 (AR-21). `resolvePort` is exported for tests. `ensureListening` binds `127.0.0.1:<port>`; on `EADDRINUSE` it binds `127.0.0.1:0` and
sets `fallback: true` (AR-30); any other failure resolves `null` (skills fall back to chat,
AR-13). `instanceId` is a random value per listener start.

### Request pipeline (AR-4, AR-29, AD-55)

1. **Host**: must equal `127.0.0.1:<port>` or `localhost:<port>` → else `421`.
2. **Route parameters**: `:p` and `:plan` must match `SLUG_PATTERN` (03-02) → else `404` before any
   store call, so a decoded segment can never reach a file path.
3. **Writes** (`PUT`, `POST`, `DELETE`): `Content-Type` must be `application/json` → else `415`;
   `Origin`, when present, must equal `http://127.0.0.1:<port>` or `http://localhost:<port>` →
   else `403`.
4. **Body**: more than 256 KB → `413`; invalid JSON → `400`.
5. **Headers on every response**: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
   `Content-Security-Policy` (below); API responses add `Cache-Control: no-store`. No
   `Access-Control-*` header is ever sent.
6. **Errors**: `{ "error": "<code>", "message": "<text>" }`; no stack traces, paths, or file
   contents. Codes: `forbidden-host` (421), `unsupported-media-type` (415), `forbidden-origin`
   (403), `too-large` (413), `bad-request` (400, unparsable body or missing `confirm`), `invalid`
   (400, validation), `not-found` (404), `stale` / `read-only` / `locked` / `not-ready` /
   `nothing-ready` / `newer-version` / `unreadable` (409), `internal` (500).

### Static assets and CSP (AR-29, AR-37, AD-55)

- `GET /` serves `discovery-ui/dist/index.html` with `__CSP_NONCE__` replaced by a fresh
  base64 nonce of 16 random bytes, and the header
  `default-src 'none'; script-src 'self'; style-src 'self' 'nonce-<n>'; connect-src 'self';
  img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.
- `GET /assets/<name>` serves only names listed from `dist/assets/` at listener start, with MIME
  types `.js` → `text/javascript`, `.css` → `text/css`, `.svg` → `image/svg+xml`; anything else
  `404`.
- When `dist/` is missing, `GET /` serves a static page (no scripts) saying "Discovery UI is not
  built. Run `npm run build:discovery` in the CodeOps checkout." (AR-37). The asset list and the
  `index.html` template are re-read when `dist/` was missing at the previous check, so a build
  performed while OpenCode runs becomes visible without a restart.

### Endpoints (AD-55)

| Method and path | Body | Success | Failures |
| --- | --- | --- | --- |
| `GET /api/health` | — | `{ name: "codeops-discovery", instanceId, version }` | — |
| `GET /api/projects` | — | `{ repositories: [{ name, canonical, projects: [{ slug, name, branch, directory, counts, live }] }] }` | — |
| `GET /api/projects/:p` | — | `{ project, plans: [PlanSummary] }` (archived included, flagged) | 404 |
| `GET /api/projects/:p/plans/:plan` | — | `{ project, plan }` (published content + state + submissions summary) | 404, 409 `unreadable` / `newer-version` |
| `PUT /api/projects/:p/plans/:plan/questions/:key` | `{ baseRevision, patch }` | `{ plan }` | 400 `invalid`, 404, 409 `stale` / `read-only` / `locked` |
| `POST /api/projects/:p/plans/:plan/submit` | `{ group: key \| null, baseRevision: number \| null }` | `{ submission: { id, groups, count }, skipped, delivery: "woken" \| "pending" }` | 404, 409 `not-ready` / `nothing-ready` / `stale` (with `missing`) |
| `POST /api/projects/:p/plans/:plan/archive` | `{ archived: boolean }` | `{ archived }` | 404 |
| `DELETE /api/projects/:p/plans/:plan` | `{ confirm: true }` | `{ deleted: true }` | 400 without `confirm`, 404 |
| `GET /api/projects/:p/plans/:plan/events` | — | SSE stream | 404 |

`live` is true when a plugin instance for that directory is registered in this process. After a
successful submit the server calls the project's `deliver(planSlug)` when the project is
registered here; otherwise the submission stays pending (AR-41, AR-46).

### Live events (AR-24, AR-30, AD-55)

The events stream sends `event: hello` with `{ instanceId, revision }` on connect, then
`event: changed` with `{ revision }` after any mutation of that plan and `event: delivered` with
`{ submissionId }` after a delivery. Each open stream counts as one viewer of its plan until it
closes. The page compares `instanceId` across reconnects to show the restart notice.

### Fallback B (spike B failed, AR-19)

The runtime lives in the plugin instance instead of `globalThis`; `ensureListening` always binds
`127.0.0.1:0`; `GET /api/projects` returns only that instance's project. Everything else is
unchanged.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| --- | --- | --- |
| Port in use | Bind an OS-assigned port; `fallbackPort` carries that port in the tool result and link | AR #30 |
| Invalid route parameter | `404 not-found` before any store call | AR #4, AR #29 |
| Listener cannot start | `ensureListening` → `null`; tools report `unavailable`; skills use chat | AR #13, #30 |
| Foreign Host header (DNS rebinding) | `421` before routing | AR #4 |
| Cross-site write | `403` / `415` before routing | AR #4 |
| Oversized body | `413` | AR #29 |
| Store refuses a file | `409` with `newer-version` or `unreadable`; other plans unaffected | AR #28 |
| Unexpected exception | `500` `{ error: "internal" }`; one content-free log line | AR #29 |

## Testing Requirements

- Spec: 07 ST-27…ST-38. Implementation tests: MIME map, asset allow-list, viewer counting on
  disconnect, `closeIfIdle`.
