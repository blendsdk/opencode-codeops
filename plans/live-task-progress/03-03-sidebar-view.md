# Sidebar View: live-task-progress

> **Document**: 03-03-sidebar-view.md
> **Parent**: [Index](00-index.md)
> **Files**: `plugin/tui.tsx`, `plugin/tui-foundation.spec.test.mjs` (superseded content assertions)

## Overview

The TUI entry stops being a version strip and becomes the live view: it subscribes to the
`codeops` RPC's `updated` and `cleared` events, merges snapshots monotonically, fetches one
initial snapshot, and renders the shared display lines. The section renders nothing when there
is no run, when the APIs are unavailable, or when every call fails (R4, R5, R9; register rows 2,
notes C–F).

## Superseding the foundation strip

The user-approved presentation (register row 2) replaces the `CodeOps v<version>` strip. The
foundation's content assertions that pin the strip — the `CodeOps v` literal and the
strip-specific render guard in `plugin/tui-foundation.spec.test.mjs` (`:122-134`) — are
superseded in the same phase the view ships: the retained invariants (slot claim via
`append: "sidebar.content"`, helper import, no timers, rendering only guard-validated data)
stay asserted there, and the live-view content contract is owned by the new ST-16…ST-18 in
`plugin/tui-progress.spec.test.mjs`. The supersession is a consequence of the confirmed scope
decision, executed spec-first: the new spec file is written and red before the TSX changes.

## Component design (R3, R4, R5, R7)

`CodeOpsRpc` stays imported from `codeops-rpc.mjs`; the display and merge logic come from
`codeops-progress.mjs` (03-01) — the TSX is a thin renderer.

```tsx
function CodeOpsProgress() {
  const context = usePlugin()
  const location = context.location ?? context.data.location.default()
  const directory = location?.directory ?? ""
  const [run, setRun] = createSignal<CodeOpsRunState | null>(null)

  // Subscribe BEFORE the snapshot (register note C): events are live-only.
  // Guarded: a host without the events API still renders from the snapshot.
  const dispose = subscribe(context.client, directory, setRun)

  // Initial snapshot; null or a failure means "nothing known".
  const [initial] = createResource(async () => requestProgress(context.client, { location }))
  createEffect(() => {
    const snapshot = initial()
    if (snapshot) setRun((current) => mergeRunState(current, snapshot))
  })

  onCleanup(dispose)

  return (
    <Show when={run()}>
      {(snapshot) => {
        const view = () => describeRun(snapshot(), Date.now())
        return <>{view().lines.map((line) => <text>{line}</text>)}</>
      }}
    </Show>
  )
}
```

Behavioral contract (stories the spec tests pin; the exact Solid idiom is implementation):

| Rule | Behavior |
| ---- | -------- |
| Subscription order | Subscribe to both events before the snapshot call; each handler ignores events whose `location.directory` differs (`acceptRunUpdate` / `acceptRunCleared`). |
| Merge | `updated` events and the snapshot both flow through `mergeRunState` — monotonic by `updatedAt`; late delivery cannot regress the view. |
| Cleared | A `cleared` event removes the run only when `plan` **and** `sessionID` match the current snapshot (a newer run is never wiped). |
| Render source | The visible text comes from `describeRun` only — one display owner (03-01 §Display). Three `<text>` lines; no other literal progress text. |
| Empty states | No run → renders nothing; snapshot `null` or RPC failure → renders nothing; events API missing → snapshot-only view; every failure path silent. |
| No timers | No `setInterval`/`setTimeout` anywhere (foundation invariant kept); the as-of text refreshes on re-renders (register note D). |
| Cleanup | `onCleanup` releases both subscriptions via the `events.on` unsubscribe functions. |
| Location scope | Both the snapshot call and the event filter use the session-derived location (foundation AR #22 pattern) — correct for `cd project && opencode` and `opencode <dir>` alike. |

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `client.rpc` accessor or `events` missing/throwing | Guarded subscription: no subscription; snapshot-only; failures swallowed | Register note F |
| Snapshot call fails | Renders nothing | Register note F |
| Event handler throws | Handler body guarded; a malformed event is ignored | Register note F |
| Events from another location | Filtered by `directory` | R4; register note C |
| Stale run (no updates) | As-of time plus `(stale)` marker in the display; no timers | Register note D |

> **Traceability:** subscription, merge, render, and lifecycle rules reference the register
> notes and rows above.

## Testing Requirements

- Spec tests ST-16…ST-18 in `plugin/tui-progress.spec.test.mjs` (07): content contracts (slot
  claim, helper imports, subscription of both events, location-scoped snapshot call, no
  timers), the render contract (display via `describeRun`, silence on failure), and the
  supersession bookkeeping (the foundation spec file's retained invariants still pass).
- Implementation tests in `plugin/tui-progress.impl.test.mjs`: content-level edge checks
  (handler filter expressions present, cleanup registered, no stray literals), plus the
  helper-side filter/merge behaviors already covered by `progress-core` tests remain the
  behavioral oracle.
- Live verification: ST-22 smoke and ST-23 remote run (07); the sidebar pane paint is
  user-assisted (02 §Risks).
