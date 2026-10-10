# Execution Plan: live-task-progress

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-10 20:32
> **Progress**: 21/21 tasks (100%)
> **CodeOps Artifact Schema**: 1

## Overview

Deliver the full live CodeOps task-progress feature (slice 2): the progress contracts and run
state (03-01), the server wiring (03-02), the sidebar live view (03-03), and the reporting
protocol plus release notes (03-04), verified by unit/content tests and the live smoke. No
release is performed (01 §Won't Have). The deferred agent-template integration (register row 15)
appears in no task.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Progress core: contracts, state, display | 6 |
| 2 | Server wiring: tool and RPC registration | 5 |
| 3 | Sidebar live view | 4 |
| 4 | Protocol, docs, and live evidence | 6 |

**Total: 21 tasks across 4 phases** (no fabricated hour estimates — scope is bounded by the
task-size criteria in the make-plan quality checklist)

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for progress.
> Every task line appears exactly once in this document. The executing agent MUST:
>
> 1. **On implementation:** mark the task `[~]` with a timestamp.
> 2. **On verify pass:** promote it to `[x]`.
> 3. **Update the Progress header and Last Updated after EVERY task** — never batch updates.
> 4. **Resume** top-to-bottom: the first `[~]` task is resumed first, else the first `[ ]` task.
> 5. **On blocker:** mark `[!]` with `Blocked: <short reason>`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

---

## Phase 1: Progress core: contracts, state, display

> **Phase baseline tree**: 6542695962bdcdf88e6500d048800d2e7b62778b
> **Expected modification set**: `bin/lib/codeops-progress.mjs` (new), `bin/lib/codeops-progress.d.mts` (new), `bin/lib/codeops-rpc.mjs`, `bin/lib/codeops-rpc.d.mts`, `plugin/progress-core.spec.test.mjs` (new), `plugin/progress-core.impl.test.mjs` (new), `plugin/tui-foundation.impl.test.mjs` · **Scope mode**: strict
> **Reasoning**: high — schemas, state semantics, and display text are the contract everything else consumes
> **Phase review**: correctness review — no findings (2026-10-10)

### Step 1.1: Specification-first progress core

**Reference**: 03-01 §Contracts/§Run state/§Normalization/§Display · AR notes A–D, G · Req R1–R5
**Objective**: The shared core module plus the RPC extension, proven in plain Node.

- [x] 1.1.1 [spec-author] Write the specification tests for ST-1…ST-11 — `plugin/progress-core.spec.test.mjs` — and verify the red phase ✅ (completed: 2026-10-10 19:39)
- [x] 1.1.2 Create `bin/lib/codeops-progress.mjs` and `.d.mts` with the contracts: schemas, constants, guards/acceptors, normalization per 03-01 §Contracts/§Normalization — ST-1…ST-4 green ✅ (completed: 2026-10-10 19:40)
- [x] 1.1.3 Extend the module with the runtime: `createCodeOpsProgress`, `mergeRunState`, `isRunStale`, `describeRun` per 03-01 §Run state/§Display — ST-5…ST-8 green ✅ (completed: 2026-10-10 19:41)
- [x] 1.1.4 Extend `bin/lib/codeops-rpc.mjs` and `.d.mts`: the `progress` method, the `updated`/`cleared` events, the runtime option with the emit binding, and `requestProgress` per 03-01 §Helpers — ST-9…ST-11 green; update the definition-shape assertion in `plugin/tui-foundation.impl.test.mjs` to the evolved contract ✅ (completed: 2026-10-10 19:42)
- [x] 1.1.5 Write the implementation tests — `plugin/progress-core.impl.test.mjs` — green ✅ (completed: 2026-10-10 19:43)
- [x] 1.1.6 Full verification: `npm run verify` ✅ (completed: 2026-10-10 19:45)

**Deliverables**:
- The core module with schemas, guards, runtime, display, and typings
- The extended `codeops` RPC definition with handlers, emit binding, and `requestProgress`
- All verification passing

**Verify**: `npm run verify`

---

## Phase 2: Server wiring: tool and RPC registration

> **Phase baseline tree**: dfdb8f0b679b3357d51aa78e00c3aa35d8f009ce
> **Expected modification set**: `plugin/index.ts`, `bin/lib/codeops-progress.mjs`, `bin/lib/codeops-progress.d.mts`, `plugin/progress-server.spec.test.mjs` (new), `plugin/progress-server.impl.test.mjs` (new) · **Scope mode**: strict
> **Reasoning**: high — an always-on plugin gains a new registration surface; containment is the invariant

### Step 2.1: Specification-first server wiring

**Reference**: 03-02 §Tool registration guard/§Wiring/§Error Handling · AR notes A, B, F · Req R1, R2, R9
**Objective**: The tool registers behind a guard, the plugin wires runtime + tool + clearing, and setup never throws.

- [x] 2.1.1 [spec-author] Write the specification tests for ST-12…ST-15 — `plugin/progress-server.spec.test.mjs` — and verify the red phase ✅ (completed: 2026-10-10 19:49)
- [x] 2.1.2 Add `registerCodeOpsProgressTool` to `bin/lib/codeops-progress.mjs` and `.d.mts` per 03-02 §Tool registration guard — ST-12 green ✅ (completed: 2026-10-10 19:50)
- [x] 2.1.3 Wire `plugin/index.ts` per 03-02 §Wiring: runtime creation, the extended RPC call, the guarded tool block, and the `session.deleted` clearing — ST-13…ST-15 green ✅ (completed: 2026-10-10 19:51)
- [x] 2.1.4 Write the implementation tests — `plugin/progress-server.impl.test.mjs` — green (the foundation containment test ST-11 passes unchanged) ✅ (completed: 2026-10-10 19:52)
- [x] 2.1.5 Full verification: `npm run verify` ✅ (completed: 2026-10-10 19:53)

**Deliverables**:
- The guarded tool registration
- The wired server plugin with the clearing path
- All verification passing

**Verify**: `npm run verify`

---

## Phase 3: Sidebar live view

> **Phase baseline tree**: _(recorded by the exec-plan skill)_
> **Expected modification set**: `plugin/tui.tsx`, `plugin/tui-progress.spec.test.mjs` (new), `plugin/tui-progress.impl.test.mjs` (new), `plugin/tui-foundation.spec.test.mjs` · **Scope mode**: strict
> **Reasoning**: high — the user-visible surface; honesty rules and the strip supersession must be exact

### Step 3.1: Specification-first sidebar view

**Reference**: 03-03 §Superseding/§Component design/§Error Handling · AR rows 2, notes C–F · Req R4, R5, R7, R9
**Objective**: The live view replaces the strip, subscribes and merges correctly, and renders the shared display lines.

- [x] 3.1.1 [spec-author] Write the specification tests for ST-16…ST-18 — `plugin/tui-progress.spec.test.mjs` — and verify the red phase ✅ (completed: 2026-10-10 19:57)
- [x] 3.1.2 Rewrite `plugin/tui.tsx` per 03-03 §Component design and supersede the strip assertions in `plugin/tui-foundation.spec.test.mjs` per 03-03 §Superseding the Foundation Strip (retain the slot/import/no-timer invariants; the guard-validated-render contract is owned by `plugin/tui-progress.spec.test.mjs`) — ST-16…ST-18 green ✅ (completed: 2026-10-10 19:58)
- [x] 3.1.3 Write the implementation tests — `plugin/tui-progress.impl.test.mjs` — green ✅ (completed: 2026-10-10 19:59)
- [x] 3.1.4 Full verification: `npm run verify` ✅ (completed: 2026-10-10 19:59)

**Deliverables**:
- The live sidebar view replacing the strip
- The superseded foundation assertions recorded and green
- All verification passing

**Verify**: `npm run verify`

---

## Phase 4: Protocol, docs, and live evidence

> **Phase baseline tree**: _(recorded by the exec-plan skill)_
> **Expected modification set**: `skills/exec-plan/SKILL.md`, `skills/exec-plan/execution-protocol.md`, `README.md`, `CHANGELOG.md`, `scripts/exec-plan-progress-content.spec.test.mjs` (new) + this plan's progress/evidence notes (smoke artifacts stay under the temp root) · **Scope mode**: strict
> **Reasoning**: medium — text contracts plus live evidence with fallback paths

### Step 4.1: Evidence and notes

**Reference**: 03-04 §Protocol/§Docs · 07 ST-19…ST-23 · AR notes D–H, rows 2, 3, 14 · Req R8, R10
**Objective**: The agent protocol reports fail-soft, the docs describe the shipped feature, and the live evidence is recorded.

- [x] 4.1.1 [spec-author] Write the specification tests for ST-19…ST-21 — `scripts/exec-plan-progress-content.spec.test.mjs` — and verify the red phase ✅ (completed: 2026-10-10 20:05)
- [x] 4.1.2 Add the reporting protocol to `skills/exec-plan/SKILL.md` and `execution-protocol.md` per 03-04 §Protocol — ST-19 and ST-20 green ✅ (completed: 2026-10-10 20:07)
- [x] 4.1.3 Update `README.md` and `CHANGELOG.md` per 03-04 §Docs — ST-21 green ✅ (completed: 2026-10-10 20:08)
- [x] 4.1.4 Execute the live smoke ST-22 in two recorded parts — (i) deterministic evidence: pack, load, registration ground truth, control-event round-trip; (ii) live evidence: agent-driven `codeops_progress` call, render capture with the user-assisted fallback — and record the tested build, attribution, and outcome for each part in this task's completion note ✅ (completed: 2026-10-10 20:25)
- [x] 4.1.5 Execute the remote-client acceptance ST-23 (`opencode serve` plus `opencode <project> --server <url>` in the pty) and record the outcome or the named limitation in this task's completion note ✅ (completed: 2026-10-10 20:31)
- [x] 4.1.6 Final full verification: `npm run verify`, then review the Success Criteria below ✅ (completed: 2026-10-10 20:32)

**Deliverables**:
- The reporting protocol in the exec-plan skill files
- README section and `## Unreleased` CHANGELOG entry
- ST-22/ST-23 evidence recorded with the tested OpenCode build
- All verification passing

> **ST-22 note (4.1.4).** Tested build: OpenCode CLI v2.0.26 (scratch project `@opencode/plugin`
> 2.0.26; Node 22.23; Python-pty capture 50×160). Fixture (temp-only): `npm pack` of the fixed
> tree into a scratch project as `plugins/opencode-codeops/` (root `index.ts`/`tui.tsx` shims)
> plus a temp-only `events-probe` plugin (server: control RPC `probechan` with one event and a
> host tool-list snapshot; TUI: subscribes to `updated`/`cleared` and the control event, pings
> the control RPC, reads one `progress` snapshot, appends every payload to ground-truth files,
> and paints marker text in a footer slot).
> **Part (i) deterministic** (run `ses_st22det6…`, 2026-10-10 20:21): both plugins load with no
> failure; `TOOL-TRANSFORM function`; the host tool list contains `codeops_progress` from the
> plugin's own registration (registration ground truth); `REGISTERED probechan emit=function`;
> control round-trip `EMITTED tick` → `TICK {"mark":"control"}` received and painted
> (`P-TICK-OK`); `progress` answers `null` (no run yet); probe markers painted in the capture.
> **Part (ii) live** (re-recorded run `ses_st22live4…`, 2026-10-10 20:36; retained artifacts:
> `st22/gt-client-st22live.log` and `st22/live4-capture.bin`): an agent-driven call
> (`›codeops_progress [plan=st22-smoke, activity=implementing]`, model-reported
> `{"ok": true}`) produced `UPDATED {"plan":"st22-smoke",…,"sessionID":"ses_st22live4…"}` over
> the event channel, and a follow-up `progress` call returned the identical snapshot
> (`UPDATED-SNAPSHOT`); the view text rendered in the capture —
> `CodeOps · st22-smoke`, `implementing`, `as of 20:36` (the `describeRun` output; the sidebar
> pane's visual presentation remains the user-assisted check).
> **Environment attribution (recorded):** the first two live attempts were blocked by the
> machine's globally installed `opencode-codeops@2.1.1` registry plugin being auto-loaded
> alongside the scratch plugin — the duplicate `codeops` RPC id made the scratch plugin fail to
> load ("Plugin failed: opencode-codeops"; the tool was absent and the model's call rejected).
> Re-running with an isolated `XDG_CONFIG_HOME` (empty plugins list) shows no failure and full
> registration; this is a smoke-environment isolation lesson, not a product defect (the RPC id
> predates this plan). A pre-isolation probe double-mount artifact did not reproduce under
> isolation.
>
> **ST-23 note (4.1.5).** Tested build: OpenCode CLI v2.0.26 (same fixture and isolated-config
> setup as ST-22; retained artifacts: `st23/st23-gt-client.log`, `st23/run5.out`,
> `st23/client5-capture.bin`). `opencode serve --port 7799` started from the scratch project (its generated
> password passed to the clients through the environment, never recorded); an interactive remote
> client (`opencode <project> --server http://127.0.0.1:7799`) carried the events probe; the
> agent-driven call ran headless against the same server
> (`opencode run --server … --model deepseek/deepseek-flash`), 2026-10-10 20:30.
> **Outcome — all signals hold across the client/server boundary:** the control event
> round-tripped to the remote client (`TICK {"mark":"control"}`); `progress` answered `null`
> before any run; the agent-driven call reported `{ "ok": true }` on the server and arrived as
> `UPDATED {"plan":"st23-remote",…,"sessionID":"ses_st23run…5"}` in the remote client's
> ground truth, with a follow-up `progress` call returning the identical snapshot; the server
> side registered the tool (`codeops_progress` in the tool list) and the control channel. No
> limitation was required, and the probe-method boundary was respected (no new harness). The
> test server was stopped by exact PID with the port verified closed afterwards.

**Verify**: `npm run verify`

---

## Dependencies

```
Phase 1 (core contracts) ──┬─► Phase 2 (server wiring) ──┐
                            └─► Phase 3 (sidebar view) ───┴─► Phase 4 (protocol + evidence)
```

---

## Success Criteria

**This plan is complete when:**

1. ✅ All phases completed; Progress 21/21
2. ✅ All verification passing: `npm run verify` (typecheck + tests + version parity)
3. ✅ ST-1…ST-21 pass; the red phases were recorded; implementation tests pass
4. ✅ ST-22 records the live smoke evidence (registration, event round-trip, agent-driven call, render path or layer-attributed miss) with the tested OpenCode build
5. ✅ ST-23 records the remote-client outcome or its named limitation
6. ✅ Containment proven: setup and the tool guard never throw without the new APIs (ST-12…ST-15); the foundation suites pass
7. ✅ `CHANGELOG.md` `## Unreleased` entry present; README section present; no release performed
8. ✅ The deferred agent-template integration (register row 15) is absent from all executable artifacts
9. ✅ Code reviewed per the repository's quality flow; no dead code; documentation standards met
10. ✅ Post-completion project re-analysis (handled by the exec-plan skill)
