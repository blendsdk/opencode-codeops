# Current State: live-task-progress

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

**Foundation surface (slices 0–1, shipped).** `bin/lib/codeops-rpc.mjs` owns the `codeops` RPC
definition — one `status` method, no events (`:20-38`) — the never-throwing registration guard
`registerCodeOpsRpc` (`:60-76`), the payload guard `isCodeOpsStatus` (`:85-93`), and
`requestStatus` with the session-location pass-through (`:114-120`). `plugin/tui.tsx` claims
`sidebar.content` (`:47-52`) and renders the one-line `CodeOps v<version>` strip only when the
location-scoped status call returns a valid payload (`:29-41`). `plugin/index.ts` registers the
RPC through the guard in a try/catch with a content-free warning (`:394-404`), subscribes to
host events for `session.deleted` (`:241-252`), and already uses the tool domain for an
`execute.before` hook (`:369-386`).

**Packaging.** `package.json` exports `.`, `./server`, and `./tui` (`:11-15`); test files are
excluded from the tarball by `!plugin/*.spec.test.mjs` / `!plugin/*.test.mjs` negations (`:26-47`).

**Tests pinning the current contract.** `plugin/tui-foundation.spec.test.mjs` (packaging ST-8,
TUI/index content ST-9, RPC helper ST-10, setup containment ST-11) and
`plugin/tui-foundation.impl.test.mjs` (payload guard, `requestStatus`, definition invariants).
Two assertion groups pin the foundation-era shape and must evolve with this plan's approved
behavior change: the impl test's definition lookup (one method, no events — `:119-128`) in
Phase 1, and the spec test's version-strip content assertions (`CodeOps v` literal, strip-only
render site — `:122-134`) in Phase 3, where the live view replaces the strip (register row 2;
03-03 §Superseding the Foundation Strip).

**Host surface (installed `@opencode/plugin` 2.0.24 — lockfile-pinned; the local OpenCode
build is v2.0.26; the cited `.d.ts` files are byte-identical in 2.0.24 and 2.0.26, verified
against the installed files).**

| Capability | Evidence |
| ---------- | -------- |
| Tool registration: `ctx.tool.transform((editor) => editor.add({ name, description, input, output, execute }))`; `Transform<Input>` returns a `Registration` | `dist/promise/tool.d.ts:16-28,53-61`; `dist/promise/registration.d.ts:1-3,12` |
| Tool handler context carries the calling `sessionID` and `agent`; promise flavor adds `signal` + `progress` | `dist/promise/tool.d.ts:9-15`; `@opencode/schema/dist/tool.d.ts:10-16` |
| RPC registration returns `RpcRegistration` with `events.emit` | `dist/promise/rpc.d.ts:10-22` |
| Client-side event subscription: `client.rpc(def).events.on(name, handler)` (unsubscribe function) and `subscribe(name)` (async iterable) | nested `@opencode/plugin/node_modules/@opencode/client/dist/promise/rpc.d.ts:14-17` |
| RPC event payload: `{ type: "rpc.<id>.<name>", data, location }` with a required location | nested `@opencode/plugin/node_modules/@opencode/client/dist/promise/rpc.d.ts:19-25`; `@opencode/schema/dist/rpc.d.ts:101-111` |
| Events are ephemeral: live-only, no replay; slow consumers create backpressure | inherited — client docs cited by the foundation's smoke work; not verifiable from the installed packages |
| RPC calls and registrations are location-scoped; the session location must be passed explicitly | foundation AR #22 (proven on v2.0.26) |
| `sidebar.content` slot input carries `{ sessionID }` | `dist/tui/context.d.ts:161-178` |

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `bin/lib/codeops-rpc.mjs` / `.d.mts` | RPC definition, guards, request helper | Add `progress` method + `updated`/`cleared` events; wire runtime handlers and emit binding; add `requestProgress` (03-01) |
| `bin/lib/codeops-progress.mjs` / `.d.mts` (new) | Progress contracts, run state, display | Create (03-01) |
| `plugin/index.ts` | Server plugin | Create runtime; register the tool and extend the RPC wiring; clear runs on session deletion (03-02) |
| `plugin/tui.tsx` | TUI entry | Replace the strip with the live view: subscribe, snapshot, merge, render (03-03) |
| `skills/exec-plan/SKILL.md`, `execution-protocol.md` | Reporting protocol | Add the fail-soft reporting points (03-04) |
| `README.md`, `CHANGELOG.md` | Docs | README section; `## Unreleased` entry (03-04) |
| `plugin/tui-foundation.spec.test.mjs`, `plugin/tui-foundation.impl.test.mjs` | Foundation tests | Two assertion groups superseded by this plan's approved behavior (see §What Exists) |
| Test files (new) | Spec/impl coverage | `plugin/progress-core.*`, `plugin/progress-server.*`, `plugin/tui-progress.*`, `scripts/exec-plan-progress-content.spec.test.mjs` (07) |

### Code Analysis

The helper pattern (`bin/lib/reasoning-effort.mjs` + `.d.mts`; foundation `codeops-rpc.mjs`) is
the established shape for runtime-free, Node-testable plugin logic: plain `.mjs` modules with
`.d.mts` typings consumed by `plugin/index.ts` and `plugin/tui.tsx`. `node --test` discovers
`*.spec.test.mjs` / `*.impl.test.mjs` files under `plugin/` and `scripts/`; the tarball
negations already exclude them. The test toolchain runs Node ≥22.18 (type stripping for `.ts`
imports) with CI on Node 24 (foundation 02 §Code Analysis).

## Gaps Identified

### Gap 1: No reporting surface for live progress

**Current Behavior:** The plugin knows only static identity (versions, directory); nothing
records what a run is doing.
**Required Behavior:** An agent-callable `codeops_progress` tool feeds a per-location run state
(R1, R2; register notes A–B).
**Fix Required:** Create the contracts/state module and register the tool (03-01, 03-02).

### Gap 2: The sidebar shows only the version strip

**Current Behavior:** `sidebar.content` renders `CodeOps v<version>` once per mount; no live
data, no events.
**Required Behavior:** The section renders the live run with plan, phase, activity, task,
counts, and as-of time, and honors the honesty rules (R4, R5; register rows 2, notes C–D).
**Fix Required:** Rewrite `plugin/tui.tsx` to subscribe, snapshot, merge, and render (03-03).

### Gap 3: exec-plan has no reporting protocol

**Current Behavior:** The execution protocol updates only the Markdown plan; nothing informs a
live view.
**Required Behavior:** Reporting points at the defined transitions, fail-soft, without changing
the progress authority (R8; register note H).
**Fix Required:** Edit the exec-plan skill documents (03-04).

## Dependencies

### Internal Dependencies

- Foundation helpers and their guards (`bin/lib/codeops-rpc.mjs`), the fake-context test
  patterns (`plugin/tui-foundation.spec.test.mjs`), and the temp-root probe method (foundation
  AR #14, note I/J evidence).

### External Dependencies

- OpenCode v2 plugin surface: `ctx.tool.transform`, RPC events, `sidebar.content` (versions and
  evidence in §What Exists); Python 3 for the pty probe method; no new packages (register
  note A).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| The sidebar pane still does not render in pty captures | Med | Low | The pane never rendered in captures on any build; the render path is proven to the RPC/event layer and the visual check is user-assisted (ST-22; foundation note I) |
| Ephemeral events lost around subscription/reconnect | Low | Med | Subscribe before the snapshot; full-snapshot payloads merge monotonically by `updatedAt` (register note C) |
| The agent skips a reporting call | Med | Low | Fail-soft by design; the view shows the as-of time, so a stale view is visibly stale (register note D); the protocol instructs the calls (note H) |
| Remote connect specifics (`--server`) need more than the probe method | Med | Low | Bounded: ST-23 records the outcome or the named limitation; new machinery would stop at the complexity gate (register note E) |
| Host API drift on newer builds | Low | Med | Every new capability is feature-detected; containment tests (ST-12…ST-15); the tested build is recorded from the smoke |
| `plugin/tui.tsx` grows past a reviewable size | Low | Low | Display and merge logic live in the Node-testable helper; the TSX stays a thin renderer; split only if it outgrows review (register note I) |
