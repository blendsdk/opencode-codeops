# Testing Strategy: live-task-progress

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Core logic (`bin/lib/codeops-progress.mjs`) | 90% |
| Supporting modules (`bin/lib/codeops-rpc.mjs` extension, `plugin/index.ts` wiring) | 80% |
| UI / glue (`plugin/tui.tsx`, protocol/docs text) | 60% — content contracts plus the live smoke |

- Test names state behavior: `should [expected behavior] when [condition]`.
- E2E: the live smoke (ST-22) and the remote-client run (ST-23) are the end-to-end proofs; no
  committed harness (register note E; foundation boundary).
- Language: helper modules are plain `.mjs` and run directly under `node --test`; `plugin/index.ts`
  is imported via Node type stripping in fake-context tests (test toolchain floor Node ≥22.18;
  CI Node 24). `.tsx` is never executed in unit tests — its contract is content-level, with all
  logic delegated to the helper (03-01, 03-03).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from 01-requirements.md, 03-01…03-04, and the Ambiguity Register.
> **IMMUTABLE ORACLE RULE:** if the implementation does not match a spec test, the implementation
> is wrong — never adjust the expectation. (The one recorded supersession — the foundation
> strip's content assertions, 03-03 §Superseding — is a user-approved requirement change, not
> an expectation adjustment.)

### Progress core (03-01)

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-1 | Structural inspection of `ProgressReportSchema` | Required `plan` + `activity`; activity enum exactly `starting, implementing, verifying, reviewing, delegating, waiting, blocked, done`; `additionalProperties: false`; optional `phase`/`task`/`detail` strings and `verified`/`total` integers with minimum 0 | R1; 03-01 §Contracts |
| ST-2 | `normalizeProgressReport` edge inputs: `plan: " p "`; a 500-character plan; `verified: 7.9`; `total: 2000000`; `task: "   "`; a report without `activity` | Trims to `"p"`; truncates at 200; floors to 7; clamps to 1000000; whitespace-only optional strings become absent; a report without `activity` is rejected (`null`) | R1; 03-01 §Normalization; register note G |
| ST-3 | `isCodeOpsProgressReport` matrix | Accepts a valid report; rejects missing `plan`, missing `activity`, unknown activity, wrong field types, and extra properties | R1; register note C |
| ST-4 | `isCodeOpsRunState` matrix | Accepts a complete snapshot; rejects a missing field, wrong types, an out-of-enum activity, negative timestamps, and extra keys | R2; register note C |
| ST-5 | Runtime: fresh `report({plan:"p",activity:"implementing"}, "s1", 1000)`, then `report({plan:"p",activity:"verifying",task:"T"}, "s1", 2000)`, then `report({plan:"p",phase:"Ph",verified:2,total:5,activity:"implementing"}, "s1", 3000)` | Create: `startedAt=updatedAt=1000`, `sessionID="s1"`, `phase/task/detail=null`, `verified=0`, `total=null`. Merge: activity and task replaced, counts carried. Counts report: `verified=2`, `total=5`, `task` carried `"T"`, `phase` replaced, `activity` replaced (`implementing`) | R2; register note B |
| ST-6 | `mergeRunState(current@2000, incoming@1000 / @2000 / @3000)` | Older → returns `current`; equal → returns `incoming`; newer → returns `incoming` | R4; register note C |
| ST-7 | `isRunStale({updatedAt:0}, now)` with `now = 599999` and `now = 600000` | `false`, then `true` | R5; register note D |
| ST-8 | `describeRun` with fixed snapshots: implementing with task+counts; delegating with detail; blocked with detail; waiting without detail; done; `total=null`; a stale snapshot | Exact lines: `["CodeOps · p", "Phase 2: Server wiring · implementing", "1.1.2 X · 3/14 verified · as of HH:MM"]`; `delegating to executor`; `blocked: tests fail`; `waiting`; `done`; the count segment is omitted when `total` is null; `stale=true` and the ` (stale)` suffix when aged beyond the threshold. The `HH:MM` expectation derives from the same `Date` object (local time) | R4, R5, R7; register row 2 |
| ST-9 | Structural inspection of `CodeOpsRpc` | Methods `status` + `progress` (both empty-object inputs); `events.updated.schema` requires exactly the snapshot fields; `events.cleared.schema` requires `plan` + `sessionID` + `clearedAt`; the `status` output schema is unchanged | R3; register note C |
| ST-10 | `registerCodeOpsRpc` with a fake ctx capturing the definition and handlers and returning a registration exposing `events.emit`; call `progress()` before any report, after a report, then `clearSession` matching and non-matching | `progress()` returns `null` then the snapshot; `emit` captured `("updated", snapshot)` after the accepted report; `("cleared", {plan,sessionID,clearedAt})` on the matching clear and no emission on the non-matching one; with a registration lacking `events`, reports still succeed | R3; register notes C, F |
| ST-11 | `requestProgress` with a fake client resolving a snapshot / `null` / garbage, rejecting, and an rpc accessor that throws; capture the forwarded options | Returns the snapshot / `null` / `null` / `null` / `null`; the location options are forwarded to the call | R4; register note C |

### Server wiring (03-02)

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-12 | `registerCodeOpsProgressTool` with: no `tool` domain; `tool` without `transform`; a throwing `transform`; a capturing `transform` | `false`; `false`; `false`; `true` with the editor receiving one `add` carrying name `codeops_progress`, the description, and the two schemas (`ProgressReportSchema`, `ProgressOutputSchema`) — never throwing | R1, R9; register note F |
| ST-13 | A runtime with a bound emit (via `registerCodeOpsRpc` exposing `events.emit`); the captured tool's `execute({plan:"p",activity:"implementing"}, {sessionID:"s1"})`, then `execute({}, {sessionID:"s1"})` | First: state updated, one `updated` emission, result `{ output: { ok: true } }`; second: `{ output: { ok: false } }`, no emission, no throw | R1; register note F |
| ST-14 | `plugin.setup(fakeCtx)` with capturing `tool.transform` + `rpc.register` and a scripted `session.deleted` event; then the captured tool executes and the event fires | Setup resolves with a cleanup; the tool and definition are registered; after the captured execute the emit captured `updated`; after the scripted deletion the run is cleared and `cleared` was emitted; `progress()` then returns `null` | R2, R9; register notes B, F |
| ST-15 | `plugin.setup(fakeCtx)` without `tool.transform`/`rpc.register` and with a throwing `transform` | Resolves with a cleanup every time; the existing session/shell/tool hooks are still registered; nothing throws | R9; register note F |

### Sidebar view (03-03)

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-16 | Content inspection of `plugin/tui.tsx` | Claims `append: "sidebar.content"`; imports from `codeops-progress.mjs`; subscribes `events.on("updated", …)` and `events.on("cleared", …)`; calls `requestProgress` with `{ location }`; contains no `setInterval`/`setTimeout`; imports no filesystem module (`node:fs`, `fs`, `readFile`) | R4, R6, R9; register note C |
| ST-17 | Content inspection of `plugin/tui.tsx` plus the foundation spec file | Display text only via `describeRun` (no `CodeOps v` literal; one display call site); renders nothing without a run; `mergeRunState` merges both events and the snapshot; `acceptRunUpdate`/`acceptRunCleared` filter by directory; the cleared handler records `clearedAt` and both merge paths ignore updates/snapshots at or before it; the foundation spec file retains its slot/import/no-timer invariants with the strip-specific assertions superseded | R4, R5; register row 2; 03-03 §Superseding |
| ST-18 | Content inspection of `plugin/tui.tsx` lifecycle | `onCleanup` is present and disposes both event subscriptions | R4; register note F |

### Protocol and docs (03-04)

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-19 | Read `skills/exec-plan/execution-protocol.md` and `SKILL.md` | A Progress Reporting section names the `codeops_progress` tool and lists all ten transition points (run start, phase start, task implemented, verifying, verified, blocked, delegating, reviewing, waiting, done); `SKILL.md` references the section in the per-task loop | R8; register note H |
| ST-20 | The same files | Fail-soft wording is present: reporting never blocks verify/commit/plan updates and the Markdown execution plan remains the single progress source of truth | R8; register note H |
| ST-21 | Read `README.md` and `CHANGELOG.md` | README carries the live-sidebar section (what shows, as-of/stale honesty, nothing-when-idle); `## Unreleased` has the `### Added` entry; the `### Notes` foundation entry no longer describes the replaced strip | R8; register rows 2, 3 |

### Live evidence (executed in Phase 4, not committed test files)

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-22 | Live smoke: `npm pack` the fixed tree into the temp root; scratch project loads the packed entries through the host's file routes; pty launch (`--standalone`, `--print-logs`); ground-truth registration capture; a control `events.emit` plus a temp-only probe subscription (a `prompt.footer` contribution in the scratch project's plugin writing received events to a ground-truth file under the temp root); an agent-driven `codeops_progress` call (if the live model does not call the tool, re-prompt once, then record the miss as layer-attributed inconclusive); render capture | Registration ground truth present; the control event reaches the subscribing probe; the agent-driven call changes the state and pushes an event; the strip/view text or a layer-attributed miss; the tested OpenCode build and timestamp recorded in the completion note; the sidebar pane paint handed to the user-assisted check (user-assisted fallback recorded if pty capture misses it) | R10; register note E; foundation ST-12 method |
| ST-23 | Remote-client acceptance: `opencode serve` (isolated XDG, fixed port) plus `opencode <project> --server <url>` in the pty; repeat the ST-22 assertions | The same signals hold across the client/server boundary, or the run records the named limitation with the probe-method boundary respected (no new harness machinery) | R10; register note E |

## Test Categories

### Specification Tests (from ST-cases above)
> Written BEFORE implementation. Filed as `[feature].spec.test.[ext]`.

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `plugin/progress-core.spec.test.mjs` | ST-1…ST-11 | Contracts, state, display, RPC extension |
| `plugin/progress-server.spec.test.mjs` | ST-12…ST-15 | Tool guard and plugin wiring containment |
| `plugin/tui-progress.spec.test.mjs` | ST-16…ST-18 | Sidebar view content contracts |
| `scripts/exec-plan-progress-content.spec.test.mjs` | ST-19…ST-21 | Protocol and docs content |

ST-22 and ST-23 are executed during Phase 4 as evidence tasks, not committed test files
(register note E).

### Implementation Tests (edge cases, internals)
> Written AFTER implementation.

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `plugin/progress-core.impl.test.mjs` | Guard matrices (extra keys, wrong types, boundary integers, `updatedAt` ties, whitespace-only optional strings, exactly-200 strings, count clamping), runtime isolation (two runtimes do not share state), display text for every activity label and both stale states | High |
| `plugin/progress-server.impl.test.mjs` | Registration-failure matrix (missing/throwing transform), double-setup tolerance, emission-failure swallowing, session-deletion with a non-matching session ID leaving the run intact | High |
| `plugin/tui-progress.impl.test.mjs` | Content-level edges: removal of the strip literal, subscription cleanup presence, directory filter expressions, no stray timers | Med |

### Integration Tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| ST-10/ST-14 | runtime + `registerCodeOpsRpc` + plugin setup | A report flows from the tool through the runtime to the bound emit; deletion clears through the event loop |
| ST-21 | docs + skill files | Protocol points, README, and CHANGELOG agree with the shipped contract |

### End-to-End Tests

| Scenario | Steps | Expected Result |
| -------- | ----- | --------------- |
| Live sidebar smoke (ST-22) | Pack, load, launch in pty, capture | Registration + event round-trip + agent-driven call proven; render attributed; user-assisted paint check |
| Remote-client run (ST-23) | `opencode serve` + `--server` client in pty | Same signals across the boundary, or the named limitation recorded |

## Test Data

### Fixtures Needed

- Fake progress reports and snapshots built inline (plain objects per 03-01 schemas).
- Temp fake contexts extending the foundation pattern with `tool.transform` (capturing editor),
  `rpc.register` (capturing handlers, returning `{ events: { emit } }` capture), and scripted
  `event.subscribe` async generators yielding `session.deleted` payloads — all under `TMPDIR`/
  `HOME` fixture overrides.
- Scratch project for ST-22/ST-23 under the execution temp root with the packed tarball and the
  established probe layout (foundation note I/J evidence).

### Mock Requirements

- No mocking framework. Real helper modules are used everywhere; only the host contexts/clients
  are hand-written fakes (foundation pattern). The TUI itself is not executed in unit tests —
  its logic lives in the helper.

## Verification Checklist

- [ ] All specification test cases (ST-*) defined with concrete input/output pairs
- [ ] Every ST case traces to a requirement, spec doc, or AR entry
- [ ] Specification tests written BEFORE implementation
- [ ] Specification tests verified to FAIL before implementation (red phase)
- [ ] All specification tests pass after implementation (green phase)
- [ ] Implementation tests written for edge cases and internals
- [ ] All unit / integration / E2E tests pass
- [ ] No regressions in existing tests (including the foundation spec/impl suites)
- [ ] Security assertions covered (ST-2/ST-3: normalization and rejection; ST-9: payload shape)
