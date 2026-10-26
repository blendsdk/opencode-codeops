# Plugin Integration: discovery

> **Document**: 03-05-plugin-integration.md
> **Parent**: [Index](00-index.md)

## Overview

`bin/lib/discovery-tools.mjs` (+ `.d.mts`) connects Discovery to OpenCode: the opt-in check, the
three agent tools, waking sessions, delivery, orphaning, and opening the browser.
`plugin/index.ts` wires it in behind feature detection, and
`schemas/codeops-config.schema.json` gains the `discovery` settings.

## Architecture

### Current Architecture
`plugin/index.ts` registers the `codeops_progress` tool through a guarded helper
(`:428-438`), reads `codeops/codeops.json` per request (`:161-167`), and handles
`session.deleted` (`:251-263`).

### Proposed Changes
One more guarded block in `setup`, one more `context` hook, one more branch in the existing
`session.deleted` handler, and a `dispose()` call in the returned cleanup. All Discovery state
stays inside `setup` closures or the process-wide runtime (03-04); nothing is module-level in
`plugin/index.ts`.

## Implementation Details

### Config schema (AR-1, AR-13, AR-34)

```json
"discovery": {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "enabled": { "type": "boolean" },
    "chatMaxQuestions": { "type": "integer", "minimum": 0 }
  }
}
```

### Opt-in check (AR-13, AR-45, AR-48, AD-57)

```ts
/** Read the project's Discovery settings. An unreadable file or a missing/non-boolean
 *  `enabled` means disabled; an invalid `chatMaxQuestions` falls back to 3. */
export function readDiscoveryConfig(directory: string): { enabled: boolean; chatMaxQuestions: number }

/** Create the per-instance controller; never throws. */
export function createDiscoveryController(ctx: unknown, deps: {
  directory: string; dataDir: string; assetsDir: string; version: string;
  openBrowser?: (url: string) => boolean; branchOf?: (directory: string) => string | null;
  warn?: (message: string) => void;
}): DiscoveryController

interface DiscoveryController {
  /** Re-read the setting; on a change enable or disable Discovery for this project. */
  sync(): Promise<void>
  isEnabled(): boolean
  onSessionDeleted(sessionID: string): Promise<void>
  /** The runtime this controller owns, or null until Discovery is first enabled. */
  readonly runtime: DiscoveryRuntime | null
  /** Unregister this project, reload the tool list, and close the listener when idle. */
  dispose(): Promise<void>
  /** Publish a plan round; the tool handler delegates here so the injected opener and delivery stay in one place. */
  publish(input: unknown, sessionID: string): Promise<DiscoveryToolResult>
  /** Read submitted answers; the tool handler delegates here. */
  answers(input: unknown, sessionID: string): Promise<DiscoveryToolResult>
  /** Record or retire questions; the tool handler delegates here. */
  resolve(input: unknown, sessionID: string): Promise<DiscoveryToolResult>
}
```

The controller owns the process-wide runtime and its store; both are created on the first
**enabled** `sync()` and never while the project is disabled (R1, AD-57).

- `sync()` runs once during `setup` and at the start of every request from a `context` hook.
  Enabling creates the store (`createDiscoveryStore({ dataDir })`, which creates the directory),
  obtains the process-wide runtime, registers the project in the store (directory, branch,
  `ctx.location.project`), `runtime.ensureListening()`, `runtime.registerProject(...)`, delivers
  pending submissions (below), then `ctx.tool.reload()`. Disabling unregisters (its own
  registration only), starts `runtime.closeIfIdle()` without awaiting it inside the hook, then
  `ctx.tool.reload()`. No change → nothing.
- `chatMaxQuestions` defaults to 3 (AR-11) and is passed to the skills through the protocol text
  (03-07); the plugin does not enforce it.

### Tools (AR-14, AR-27, AD-56)

`registerDiscoveryTools(ctx, controller)` feature-detects `ctx.tool.transform`; its transform
adds the three tools only while `controller.isEnabled()`; it never throws and returns a boolean
like `registerCodeOpsProgressTool`. The transform wires each tool to the matching controller
method, which uses `runtime.store` (never a second store) and resolves the project from
`ctx.location.directory`; every handler is `async` and returns `{ output: … }`:

| Tool | Input | Output (success) |
| --- | --- | --- |
| `codeops_discovery_publish` | `DiscoveryPublishSchema` (03-02) | `{ ok: true, url, plan, revision, opened, fallbackPort: number \| null, warnings }` |
| `codeops_discovery_answers` | `{ artifact, kind }` | `{ ok: true, plan, submissions }` (AD-56 shape) |
| `codeops_discovery_resolve` | `{ artifact, kind, recorded?: [{ key, as }], retire?: [key] }` | `{ ok: true, recorded, retired }` |

Failures: `{ ok: false, reason, message }` with `reason` one of `disabled`, `unavailable`,
`invalid` (+ `errors`), `owned` (+ `owner`), `not-found`, `error`. The `message` is a short
sentence the agent can relay ("Discovery is unavailable on this machine; ask in chat.").

After a successful publish: `runtime.notify(..., "changed")`; `opened` is true only when
`runtime.hasViewer()` was false and the opener succeeded (AR-31). `answers` and `resolve` also call
`runtime.notify(..., "changed")` so an open page moves to "Recorded as …", and a completed delivery
sends `"delivered"`. Tool descriptions state when to use each tool and point to `_shared/discovery.md`.

### Waking and delivery (AR-5, AR-20, AR-40, AR-41, AR-46)

- **Reachability**: a session is reachable when `ctx.session.get({ sessionID })` resolves. The host
  API exposes no owning-process identity, so this is an existence check; Phase 1 assumption F
  measures the cross-process case and selects the pre-agreed fallback in 03-01.
- **Deliver (plan)**: claim every undelivered submission of the plan (`claimDelivery`), then send
  **one** `ctx.session.prompt({ sessionID, text, delivery: "queue" })` per plan covering all claimed
  submissions. On success call
  `store.markDelivered(projectSlug, planSlug, ids, ownerSessionID)` for the claimed ids; when the
  prompt rejects, release every claim so the next delivery point retries. A submission with a live claim held by this
  process is never prompted twice; claims left by a dead pid are released when the store is created.
- **Delivery points**: after a page submit (the server calls the project's `deliver`), at enable /
  setup, and at the next Discovery tool call for that plan. `codeops_discovery_answers` also claims
  submissions directly and records `deliveredAt` (AD-56).
- **Wake text** (AR-20): one message per plan:
  `Discovery: <n> answers submitted for <project name> › <plan title> (<group titles>). Read them
  with codeops_discovery_answers.` Here `<project name>` is the registered directory basename,
  `<n>` counts the submitted questions in the claimed submissions (singular "1 answer"), and the
  group titles are joined with ", ".
- **Orphaning**: the existing `session.deleted` handler also calls
  `controller.onSessionDeleted(sessionID)` → `store.markOrphaned` (AR-40).

### Browser opener (AR-31, AD-57)

`openBrowser(url)` uses `execFile` without a shell: `xdg-open <url>` on Linux, `open <url>` on
macOS, `cmd /c start "" <url>` on Windows; detached, output ignored; returns `false` on any error.
Tests inject a fake opener.

### Fallback A (spike A failed, AR-19)

No waker. `codeops_discovery_answers` accepts `wait: true`; with it the handler resolves when the
plan has an undelivered submission or `context.signal` aborts (`{ ok: false, reason: "aborted" }`).
`_shared/discovery.md` then tells skills to call `answers` with `wait: true` after publishing.

## Code Examples

```ts
// plugin/index.ts — declare before the event subscription so session.deleted can reach it
let discovery: ReturnType<typeof createDiscoveryController> | null = null

// inside setup, after the progress tool block
try {
  discovery = createDiscoveryController(ctx, {
    directory,
    dataDir: resolveDataDir(process.env),
    assetsDir: join(PACKAGE_ROOT, "discovery-ui", "dist"),
    version: packageVersion,
  })
  await discovery.sync()
  await ctx.session.hook("context", async () => {
    await discovery?.sync()
  })
  const registered = await registerDiscoveryTools(ctx, discovery)
  if (!registered) warnContentFree("The Discovery tools are unavailable in this OpenCode build.")
} catch {
  warnContentFree("Could not set up Discovery.")
}

// in the existing session.deleted branch
await discovery?.onSessionDeleted(event.data.sessionID)

// in the returned cleanup, before controller.abort()
await discovery?.dispose()
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| --- | --- | --- |
| Host lacks `tool.transform` / `session.prompt` / `session.get` | Feature-detected; one content-free warning; no tools or no waking | AR #13, AD-57 |
| Config unreadable, or `enabled` missing/non-boolean | Treated as disabled | AR #13 |
| `chatMaxQuestions` invalid | Falls back to 3; Discovery stays enabled | R1 |
| Listener cannot start | Tools return `unavailable`; skills ask in chat | AR #13, #30 |
| Publish by a non-owner | `owned` with the owner; agent asks the user about takeover | AR #23 |
| Prompt fails after claim | Release every claim; retried at the next delivery point | AR #5, AD-57 |
| Any handler exception | `{ ok: false, reason: "error" }`; never thrown into the agent turn | AD-56 |

## Testing Requirements

- Spec: 07 ST-39…ST-47 (fake context, injected opener, temp data directory, port 0).
- Implementation tests: transform guard paths, reload on toggle, release-on-failure.
