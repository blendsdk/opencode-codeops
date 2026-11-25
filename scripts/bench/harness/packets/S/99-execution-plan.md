# Task T-03: Opt-in reasoning-effort request trace

> **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Progress**: 0/3 tasks (0%)
> **Reasoning**: medium — bounded helper addition following existing project patterns
> **Last Updated**: 2026-10-04 12:00

## Objective

Make the applied reasoning level directly observable for acceptance checks. When the
`CODEOPS_EFFORT_TRACE` environment variable is `1` or `true` (case-insensitive), the plugin
appends one content-free JSON line per marker capture and per request application to the
session's scratch directory. Without the variable, behavior is unchanged.

**Smallest viable design:** one append-only helper in the existing reasoning-effort module plus
two call sites in the existing plugin hooks. No new dependency, no new configuration surface,
no default behavior change. Trace lines carry only a timestamp, event name, message id, agent
name, level, source, and applied flag — never prompt text.

## Interface (fixed)

Add to `bin/lib/reasoning-effort.mjs`, with declarations in `bin/lib/reasoning-effort.d.mts`:

```ts
/** Check whether the optional trace environment switch is on. */
export declare function isEffortTraceEnabled(value: unknown): boolean
/** Compute the trace-file path inside the session temp directory. */
export declare function sessionEffortTracePath(sessionID?: string, base?: string): string
/** Append one content-free trace entry to the session trace file. */
export declare function appendEffortTrace(sessionID: string | undefined, entry: unknown, base?: string): boolean
```

- `isEffortTraceEnabled` is true only for the strings `1` and `true` (any case); every other value,
  including non-strings, is false.
- `sessionEffortTracePath(sessionID, base)` is the file `reasoning-effort-trace.jsonl` inside the
  same per-session directory `sessionEffortPath(sessionID, base)` uses.
- `appendEffortTrace` appends one JSON line per call and returns `true`; it returns `false` and
  never throws when the file cannot be written.
- `plugin/index.ts` reads `CODEOPS_EFFORT_TRACE` and calls the helper at marker capture and at
  request application.
- `_shared/reasoning-effort.md` documents the switch.

## Tasks

- [ ] T-03.1 Write spec tests for the trace helper (enabled check, path, append, blocked write)
- [ ] T-03.2 Implement the helper, its type declarations, the plugin wiring, and the contract note
- [ ] T-03.3 Full verification (`npm run verify`)

**Verify**: `npm run verify`
