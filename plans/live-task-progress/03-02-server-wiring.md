# Server Wiring: live-task-progress

> **Document**: 03-02-server-wiring.md
> **Parent**: [Index](00-index.md)
> **Files**: `plugin/index.ts`, `bin/lib/codeops-progress.mjs` (tool registration guard), `bin/lib/codeops-rpc.mjs` (runtime option)

## Overview

How the always-on server plugin (`plugin/index.ts`) hosts the progress feature without ever
risking its existing behavior: the runtime is created per plugin instance, the tool and the RPC
extensions register behind feature-detection, and the existing `session.deleted` loop clears a
run when its reporting session ends (R1, R2, R9; register notes A, B, F).

## Tool registration guard (R1, R9)

`registerCodeOpsProgressTool(ctx, runtime)` lives in `bin/lib/codeops-progress.mjs` (same
plain-helper pattern as the RPC guard; register note F).

| Step | Contract |
| ---- | -------- |
| Feature detection | `typeof ctx?.tool?.transform !== "function"` → return `false` without throwing. |
| Registration | `await ctx.tool.transform((tool) => tool.add({ name, description, input, output, execute }))` using `CODE_OPS_TOOL_NAME`, `CODE_OPS_TOOL_DESCRIPTION`, `ProgressReportSchema`, `ProgressOutputSchema` (03-01 §Contracts). |
| Handler | `execute(input, toolContext)` calls `runtime.report(input, toolContext?.sessionID ?? "")` inside try/catch; returns `{ output: { ok: accepted } }` — never throws, so a reporting failure can never break an agent turn. |
| Result | `true` on a completed registration, `false` on a missing API or any failure; never throws. |

## `plugin/index.ts` wiring (R2, R9)

Inside `setup(ctx)`, alongside the existing blocks (order matters only for the emit binding):

1. **Create the runtime** — `const progress = createCodeOpsProgress()` next to the existing
   per-instance state (the effort maps), with a short comment explaining the memory-only
   lifetime.
2. **Extend the existing RPC registration block** — the current try/catch around
   `registerCodeOpsRpc` keeps its exact shape (the foundation's content assertion requires
   `registerCodeOpsRpc` inside try/catch with `warnContentFree`, and no direct `.rpc.register`
   call); the call becomes `registerCodeOpsRpc(ctx, { pluginVersion: packageVersion, runtime:
   progress })`. The helper binds `events.emit` into the runtime when the host exposes it
   (03-01 §Helpers).
3. **Add one new guarded block** after it — `registerCodeOpsProgressTool(ctx, progress)` in a
   try/catch; a `false` result logs one content-free warning ("The codeops progress tool is
   unavailable in this OpenCode build; the sidebar stays hidden."), a thrown error a second
   one; setup always completes.
4. **Extend the existing event loop** — in the `session.deleted` branch (currently deleting the
   effort marker), add `progress.clearSession(event.data.sessionID)`; when it returns an
   identity the bound emit pushes `cleared` (03-01 §Run state).
5. **Cleanup** — unchanged: the returned cleanup aborts the event subscription; the runtime is
   per-instance memory and needs no disposal.

Registration failure combinations (all acceptable, all honest):

| RPC registration | Tool registration | Result |
| ---------------- | ----------------- | ------ |
| ok | ok | Full feature. |
| ok | fails | State updates via tool calls are emitted; no agent-facing tool means reports only arrive if some other caller invokes handlers — in practice the sidebar stays hidden (no reports). |
| fails | ok | Reports update state; with no registered events the push never fires; the sidebar stays hidden even though the tool works (tool output still `ok`). |
| fails | fails | Today's behavior; nothing changes. |

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `ctx.tool.transform` missing or throwing | Guard returns `false`; one content-free warning; setup completes | Register note F |
| Tool handler receives invalid input | Defensive `report` returns `null`; handler answers `{ ok: false }` without throwing | Register note F |
| Event emission fails | Swallowed at the binding | Register note F |
| Session ends mid-run | `clearSession` clears the run and emits `cleared`; a newer run from another session is untouched (identity match only) | Register note B |
| Server restart | State is memory-only; the sidebar shows nothing until the next report | Register note B |

> **Traceability:** wiring, ordering, and failure choices reference the register notes above.

## Testing Requirements

- Spec tests ST-12…ST-15 in `plugin/progress-server.spec.test.mjs` (07): guard containment,
  handler behavior through a captured transform, full setup containment with and without the
  new APIs (fake context extended with `tool.transform` and a capturing `rpc.register`), and
  the `session.deleted` clearing path through a scripted event stream.
- Implementation tests in `plugin/progress-server.impl.test.mjs`: registration-failure matrix,
  warning-once behavior for repeated setup calls, double-registration tolerance, and the
  existing foundation containment tests (ST-11 there) still passing unchanged.
