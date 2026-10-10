# Progress Core: live-task-progress

> **Document**: 03-01-progress-core.md
> **Parent**: [Index](00-index.md)
> **Files**: `bin/lib/codeops-progress.mjs` (new), `bin/lib/codeops-progress.d.mts` (new), `bin/lib/codeops-rpc.mjs`, `bin/lib/codeops-rpc.d.mts`

## Overview

The shared core the server plugin and the TUI both build on: the `codeops_progress` tool
contract, the extended `codeops` RPC definition (a `progress` method plus `updated` and
`cleared` events), the in-memory run-state runtime, the guards, and the honesty display
function. Everything here is plain data and pure functions so `node --test` can exercise it
without a host (register notes A, C).

## Architecture

```text
agent (exec-plan)                server plugin (per location)            terminal (TUI)
    │  codeops_progress call         │                                      │
    └────── tool handler ───────────►│ runtime.report(input, sessionID)     │
                                     │   ├─ state = merge/normalize         │
                                     │   └─ emit("updated", snapshot) ────►│ events.on("updated")
                                     │                                      │   mergeRunState (monotonic)
    sidebar snapshot call            │                                      │
    ◄──── progress() ────────────────┤ runtime.snapshot()                   │
    session deleted ─► clearSession ─┤ emit("cleared", {plan,sessionID,clearedAt}) ──►│ clears matching run
```

Data flow rules: the run state lives only in the server plugin's memory; every emitted event
carries the full snapshot; the TUI subscribes before requesting the snapshot, merges snapshots
monotonically by `updatedAt`, and ignores any update or snapshot at or before the last accepted
`clearedAt`, so late or duplicate delivery (including across a clear) cannot regress the view
(register note C). No file is read anywhere in this feature (R6).

## Contracts

### The `codeops_progress` tool (R1)

| Field | Value |
| ----- | ----- |
| Name | `codeops_progress` |
| Description | "Report live CodeOps task progress so the sidebar shows the current run. Use at run, phase, and task transitions, and for blocked, waiting, delegating, reviewing, and done states." |
| Input schema | see below |
| Output schema | `ProgressOutputSchema` (below) |

Tool input schema (verbatim; register note C):

```js
export const ProgressReportSchema = {
  type: "object",
  additionalProperties: false,
  required: ["plan", "activity"],
  properties: {
    plan: { type: "string" },
    phase: { type: "string" },
    task: { type: "string" },
    activity: {
      type: "string",
      enum: ["starting", "implementing", "verifying", "reviewing", "delegating", "waiting", "blocked", "done"],
    },
    detail: { type: "string" },
    verified: { type: "integer", minimum: 0 },
    total: { type: "integer", minimum: 0 },
  },
}
```

The tool output schema is a named constant next to the input schema:

```js
export const ProgressOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok"],
  properties: { ok: { type: "boolean" } },
}
```

The host is expected to validate input against `ProgressReportSchema` before the handler runs
(not directly verifiable from the installed typings); the runtime additionally normalizes
defensively regardless (see §Normalization) because the schema result types as `unknown` in the
handler. The contract also relies on the host accepting the JSON Schema forms used here —
nullable `type` arrays and `anyOf`; if the host's schema codec rejects any form, registration is
contained (the sidebar stays hidden), and the ST-22 smoke asserts that `progress`, `updated`, and
`cleared` actually register on the tested build.

### The extended `codeops` RPC definition (R3)

`CodeOpsRpc` grows one method and two events; `status` is unchanged (register note C):

```js
export const RunStateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["plan", "phase", "task", "activity", "detail", "verified", "total", "startedAt", "updatedAt", "sessionID"],
  properties: {
    plan: { type: "string" },
    phase: { type: ["string", "null"] },
    task: { type: ["string", "null"] },
    detail: { type: ["string", "null"] },
    activity: { type: "string", enum: [/* the eight activities above */] },
    verified: { type: "integer", minimum: 0 },
    total: { type: ["integer", "null"], minimum: 0 },
    startedAt: { type: "integer", minimum: 0 },
    updatedAt: { type: "integer", minimum: 0 },
    sessionID: { type: "string" },
  },
}

export const RunClearedSchema = {
  type: "object",
  additionalProperties: false,
  required: ["plan", "sessionID", "clearedAt"],
  properties: {
    plan: { type: "string" },
    sessionID: { type: "string" },
    clearedAt: { type: "integer", minimum: 0 },
  },
}

// in CodeOpsRpc:
// methods.progress = { input: { type: "object", additionalProperties: false },
//                      output: { anyOf: [RunStateSchema, { type: "null" }] } }
// events.updated  = { schema: RunStateSchema }
// events.cleared  = { schema: RunClearedSchema }
```

`events.updated` and `events.cleared` are the two pushes; the TUI filters both by
`event.location.directory` (R4; 03-03). Event delivery is the host's ephemeral live channel;
the snapshot method plus monotonic merging covers gaps (register note C).

### Helpers

| Export | Signature | Contract |
| ------ | --------- | -------- |
| `registerCodeOpsRpc` (extended) | `(ctx, { pluginVersion, runtime }?) => Promise<boolean>` | Registers `status`, `progress` (returns `runtime?.snapshot() ?? null`), and — when the returned registration exposes a function `events.emit` and a runtime is present — binds emission through it. Boolean contract, never throws (foundation note C preserved). |
| `requestProgress` | `(client, options?) => Promise<CodeOpsRunState \| null>` | Calls `progress` with the caller's location; returns a validated snapshot, or `null` for "no run", an invalid payload, or any transport failure. Never throws. |
| `createCodeOpsProgress` | `() => CodeOpsProgressRuntime` | Creates one in-memory runtime (see §Run state). |
| `mergeRunState` | `(current \| null, incoming) => CodeOpsRunState` | Monotonic merge: returns `incoming` when it is at least as new (`incoming.updatedAt >= current.updatedAt`), else `current` (R4 honesty; register note C). |
| `isRunStale` | `(snapshot, nowMs) => boolean` | `nowMs - snapshot.updatedAt >= CODE_OPS_STALE_MS` (register note D). |
| `describeRun` | `(snapshot, nowMs) => { lines: string[], stale: boolean }` | The single display source (see §Display; register row 2). |
| `normalizeProgressReport` | `(value) => NormalizedReport \| null` | Validates shape and applies §Normalization; `null` means reject. |

Guards and acceptors (defensive against unknown input):

| Guard | Accepts |
| ----- | ------- |
| `isCodeOpsProgressReport` | A plain object matching `ProgressReportSchema`'s required fields and enum exactly (no extra keys). |
| `isCodeOpsRunState` | A plain object matching `RunStateSchema` exactly (all ten required fields, correct types, enum-bounded activity, non-negative integers). |
| `acceptRunUpdate` | `(event, directory) => CodeOpsRunState \| null` — returns the validated snapshot when the envelope's `location.directory` matches and `data` passes `isCodeOpsRunState`; otherwise `null`. A plain function (not a predicate) so the narrowed value type-checks at the call site. |
| `acceptRunCleared` | `(event, directory) => { plan: string, sessionID: string, clearedAt: number } \| null` — the same envelope/location rule for the `cleared` event. |

Constants and schemas: `CODE_OPS_TOOL_NAME`, `CODE_OPS_TOOL_DESCRIPTION`,
`ProgressReportSchema`, `ProgressOutputSchema`, `RunStateSchema`, `RunClearedSchema`,
`CODE_OPS_STRING_CAP = 200`, `CODE_OPS_COUNT_MAX = 1_000_000`, `CODE_OPS_STALE_MS = 600_000`.

## Run state (R2)

`createCodeOpsProgress()` returns:

| Member | Behavior |
| ------ | -------- |
| `report(input, sessionID, nowMs?)` | Normalizes; on reject returns `null` (state untouched). On accept: creates or merges the run, sets `updatedAt = nowMs ?? Date.now()`, records `sessionID`, and — when an emit is bound — emits `updated` with the new snapshot (failures swallowed). Returns the snapshot. |
| `snapshot()` | The current snapshot, or `null`. |
| `clearSession(sessionID)` | When the current run's `sessionID` matches: clears it, emits `cleared` through the bound emit (when one is bound), and returns the cleared identity `{ plan, sessionID, clearedAt }` for logging and tests; otherwise `null`. |
| `bindEmit(emit)` | Binds `(name, payload) => void|Promise<void>`; every later emission call is wrapped so a throwing or rejecting emit is swallowed (register note F). |

Merge semantics (register note B):

| Case | Behavior |
| ---- | -------- |
| No current run | Create: `startedAt = updatedAt = now`; `phase/task/detail` from the report or `null`; `verified` from the report or `0`; `total` from the report or `null`; `activity` from the report. |
| Current run, same `plan` | Merge: every optional report field present replaces its state field; absent optional fields carry; counts replace independently when provided; `plan` and `activity` are present on every report by contract. |
| Current run, different `plan` | The report starts a new run; the previous run is discarded (last reporter owns; register note B). |
| Invalid report | `null`; no state change, no emission. |

`total: null` means "counts unknown" and suppresses the count segment in the display (R5).

## Normalization

| Input | Rule |
| ----- | ---- |
| `plan`, `phase`, `task`, `detail` strings | Trimmed; truncated at `CODE_OPS_STRING_CAP`; empty-after-trim optional strings become absent (`phase`/`task`/`detail` → `null`); an empty-after-trim `plan` rejects the report. |
| `verified`, `total` | Floored to integers, clamped to `0…CODE_OPS_COUNT_MAX` (defense in depth; the host already validates integers ≥ 0). |
| Unknown/extra fields | Rejected (schema `additionalProperties: false` plus the guard). |

## Display (R4, R5 — register rows 2, note D)

`describeRun(snapshot, nowMs)` is the single source of the visible text; the TUI renders its
lines as plain text nodes.

```
line 1:  CodeOps · <plan>
line 2:  <phase> · <activityLabel>          (phase segment omitted when phase is null)
line 3:  <task> · <N>/<M> verified · as of HH:MM          (segments omitted when absent)
```

| Activity | Label |
| -------- | ----- |
| `starting` / `implementing` / `verifying` / `reviewing` | the word itself |
| `delegating` | `delegating to <detail>` when detail is present, else `delegating` (R7) |
| `waiting` | `waiting (<detail>)` when detail is present, else `waiting` |
| `blocked` | `blocked: <detail>` when detail is present, else `blocked` |
| `done` | `done` |

- The count segment appears only when `total !== null` (R5). `verified` counts come from
  reports only; the display never infers completion from anything else.
- `as of HH:MM` is derived from `updatedAt` in the viewer's local time; when
  `isRunStale(snapshot, nowMs)` the segment ends ` (stale)` (register note D — no timers:
  the text is recomputed whenever the component re-renders).
- `stale` is also returned as a boolean for callers that want to style the line.
- When the snapshot is `null` the caller renders nothing (R5); `describeRun` is only called
  with a snapshot.

## Integration Points

- **Server wiring** (03-02): `plugin/index.ts` creates one runtime, passes it to
  `registerCodeOpsRpc` and to `registerCodeOpsProgressTool`, and calls
  `runtime.clearSession(...)` from the existing `session.deleted` loop.
- **TUI** (03-03): imports `describeRun`, `mergeRunState`, `acceptRunUpdate`,
  `acceptRunCleared`, and `requestProgress`; the `CodeOpsRpc` definition stays in
  `codeops-rpc.mjs` (import direction `codeops-rpc → codeops-progress` only; no cycle).
- **Typings**: `codeops-progress.d.mts` declares `CodeOpsRunState`, `CodeOpsActivity`,
  `CodeOpsProgressReport`, `CodeOpsProgressRuntime`, and every function's signature, following
  the foundation `.d.mts` pattern so `plugin/tui.tsx` typechecks under `npm run verify`.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Invalid or empty report | `report` returns `null`; state untouched; no emission | Register note F |
| Emission throws or rejects | Swallowed inside the bound emit; reports stay successful | Register note F |
| No emit bound (older host without events) | Report/clear still work; the state changes, no push | Register note F |
| `progress` call fails or returns garbage | `requestProgress` returns `null`; the view renders nothing | Register notes C, F |
| Event from another location | Guards return false; the view ignores it | R4; register note C |
| Oversized or out-of-range values | Normalization truncates/clamps | Register note G |
| Clock | Timestamps come from the server (`Date.now()` at report time); the display derives only local text | Register note D |

> **Traceability:** contract, state, normalization, and display choices reference the Ambiguity
> Register entries above; only zero-semantic formatting is uncited.

## Testing Requirements

- Spec tests ST-1…ST-11 in `plugin/progress-core.spec.test.mjs` (07).
- Implementation tests in `plugin/progress-core.impl.test.mjs`: guard matrices (extra keys,
  wrong types, boundary integers), normalization edges (exactly-200 strings, whitespace-only
  optional strings, count clamping), merge ties (`updatedAt` equal), runtime isolation (two
  runtimes do not share state), and display text for every activity label.
