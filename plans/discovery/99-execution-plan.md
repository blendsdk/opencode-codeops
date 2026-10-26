# Execution Plan: discovery

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-26 09:34
> **Progress**: 24/76 tasks (32%)
> **CodeOps Artifact Schema**: 1

## Overview

Deliver Discovery: the host spike (03-01), the rules module (03-02), the store (03-03), the
shared listener (03-04), the plugin integration and config schema (03-05), the Fluent UI app and
packaging (03-06), the skills protocol with `make-plan` and `preflight` adoption (03-07), and the
docs with live evidence. No release is performed (01 §Won't Have). Items listed as out of scope in
AR-18 appear in no task.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Host spike | 4 |
| 2 | Rules and model | 9 |
| 3 | Store | 11 |
| 4 | Shared listener and API | 11 |
| 5 | Plugin integration and config | 11 |
| 6 | Web UI and packaging | 14 |
| 7 | Skills protocol | 8 |
| 8 | Docs and live evidence | 8 |

**Total: 76 tasks across 8 phases** (no fabricated hour estimates — scope is bounded by the
task-size criteria in the make-plan quality checklist)

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for
> progress. Every task line appears exactly once in this document. The executing agent MUST:
>
> 1. **On implementation:** mark the task `[~]` with a timestamp —
>    `- [~] 1.1.1 Task description ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote it to `[x]` —
>    `- [x] 1.1.1 Task description ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** (`> **Progress**: X/Y tasks (Z%)`) and the Last Updated
>    stamp after EVERY task — never batch updates. Only `[x]` counts as complete.
> 4. **Resume** by scanning the phase sections top-to-bottom: the first `[~]` task is resumed
>    first, else the first `[ ]` task.
> 5. **On blocker:** mark the task `[!]` and append `Blocked: <short reason>` on the same line.
>    The plan lifecycle is `Ready`, `Executing`, `Done`, or `Blocked`, derived from these markers.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented. Failure to keep the marks
> current means progress is invisible after crashes, context resets, or session handoffs.

---

## Phase 1: Host spike

> **Phase baseline tree**: 833828049712ba44207ce3f968cba2029b1a50e2
> **Expected modification set**: this document's Phase 1 note only; every probe file stays under `$CODEOPS_TMPDIR` and is deleted · **Scope mode**: strict
> **Reasoning**: high — unverified host behaviour decides which pre-agreed fallbacks the later phases follow

### Step 1.1: Prove the host assumptions

**Reference**: 03-01 §Assumptions/§Probe Method/§Recording · AR-19, AR-57
**Objective**: Outcomes for assumptions A–F recorded with ground truth; fallbacks and the active spec-test variant set selected.

- [x] 1.1.1 Build the temp-only probe plugin, two `git init` scratch projects, and the isolated `XDG_CONFIG_HOME` per 03-01 §Probe Method — all under `$CODEOPS_TMPDIR` ✅ (completed: 2026-10-24 10:22)
- [x] 1.1.2 Run assumptions A (idle and busy wake through `ctx.session.prompt`), C (tool routing per directory, and that a non-opted-in project's session does not see the Discovery tools), and F (a second process resolving and prompting the first process's session); capture ground-truth lines ✅ (completed: 2026-10-24 10:26)
- [x] 1.1.3 Run assumptions B (shared `globalThis` state across instances), D (service outlives the terminal UI), and E (`ctx.tool.reload` timing); capture ground-truth lines ✅ (completed: 2026-10-24 10:27)
- [x] 1.1.4 Record each outcome A–F, the OpenCode build, the selected fallbacks, and the spec-test variant set in the Phase 1 note below; stop probe processes by exact PID and delete the scratch tree; when C failed, mark this task `[!]` and stop ✅ (completed: 2026-10-24 10:27)

> **Phase 1 note** _(filled by task 1.1.4)_: OpenCode **2.1.3**, model `deepseek/deepseek-flash`.
> Isolation: `opencode serve` with an isolated `XDG_CONFIG_HOME` whose config loaded only the
> temporary probe plugin; clients connected with `--server`; auth and session data stayed in the
> normal data directory so sessions were real. Every probe artifact lived under `$CODEOPS_TMPDIR`
> and was deleted at the end of this phase. The four tasks ran as one interleaved probe; their
> marks were written together at 10:27 with the completion times shown. Evidence timestamps below
> are UTC; completion stamps are local time (UTC+2).
>
> - **A — pass.** *Idle:* `session.get` found the session and
>   `session.prompt({ sessionID, text, delivery: "queue" })` was accepted at 08:24:20.951Z; the
>   user turn "probe wake idle" ran at 08:24:20.997Z and an assistant turn answered at
>   08:24:22.922Z. *Busy:* a turn running `sleep 20` was still active when the wake was accepted
>   at 08:24:55.548Z; the wake's user turn appeared at 08:25:12.404Z, after `BUSY-DONE` at
>   08:25:11.233Z — queued behind the current turn, never interleaved.
> - **B — pass.** Two plugin instances in one process (p1 and p2 locations) shared the
>   `globalThis[Symbol.for("opencode-codeops.discovery")]` slot: in pid 2825615 the p1 setup
>   recorded `globalCount: 1` at 08:23:13.854Z and the p2 setup recorded `globalCount: 2` at
>   08:23:17.655Z.
> - **C — pass.** `probe_where` executed in the instance whose `ctx.location.directory` was the
>   calling session's directory, and the tool list was per instance: the p1 list contained
>   `probe_p1_only`, the p2 list did not (08:23:15.610Z / 08:23:18.909Z). Opt-in visibility
>   therefore holds per location.
> - **D — pass (proxy).** `opencode service status` reports a running background service
>   (`http://127.0.0.1:49374`), and the probe listeners kept answering after every client
>   exited. The user's live TUI was not restarted for the spike; the fallback is
>   documentation-only, so this does not change a design decision.
> - **E — pass.** `ctx.tool.reload()` called from a `context` hook changed the instance tool list
>   immediately (08:25:37.999Z), but the model catalog for that same request did not include the
>   new tool; the next request did and the tool executed (08:25:47.395Z). AR-45's "next request"
>   wording is therefore correct.
> - **F — pass, with a recorded mechanism.** The second process (pid 2829871) resolved the p1
>   session at 08:26:03.267Z and its `session.prompt` call was accepted at 08:26:03.594Z. That
>   call made the second process attach the session's p1 location: it set up a p1 runtime at
>   08:26:03.435Z, the wake ran there (`probe_where` and `probe_p1_only` executed in pid 2829871
>   with `directory` = p1 at 08:26:05.583Z), and the assistant answered at 08:26:05.653Z and
>   08:26:07.638Z. So a process that calls `session.prompt` becomes the host of a session it did
>   not host before; the wake is never silently lost, and no fallback is selected. The
>   one-process-per-project recommendation stays because two processes can now each hold a
>   runtime (and a listener) for the same project.
> - **Fallbacks selected:** none — all six assumptions held.
> - **Spec-test variants active:** none (ST-27B/34B/37B and ST-44A/45A/62A are not used).
> - **Probe defects (not host results):** the first wake used the wrong `session.prompt` shape
>   (`prompt: { text }`) and was rejected with a SchemaError; the corrected probe used the
>   top-level `text` field. A missing output schema made `probe_where` return an error to the
>   model, but its ground-truth record was still written before the host rejected the result.

**Deliverables**:
- Recorded outcomes for A–F, the fallback selection, and the active variant set
- No probe artifact left in the repository or the temp root

**Verify**: the Phase 1 note is complete; `git status` shows only this document changed

---

## Phase 2: Rules and model

> **Phase baseline tree**: _(recorded by the exec-plan skill)_
> **Expected modification set**: `bin/lib/discovery-rules.mjs` (new), `bin/lib/discovery-rules.d.mts` (new), `bin/discovery-rules.spec.test.mjs` (new), `bin/discovery-rules.impl.test.mjs` (new) · **Scope mode**: strict
> **Reasoning**: high — the contract every other component and the page depend on

### Step 2.1: Specification tests

**Reference**: 07 ST-1…ST-12 · 03-02 · AR-6, AR-16, AR-24–AR-26, AR-29, AR-42, AR-43, AR-50, AR-51
**Objective**: The rules contract encoded before any implementation exists.

- [x] 2.1.1 [spec-author] Write the specification tests for ST-1…ST-12 — `bin/discovery-rules.spec.test.mjs` ✅ (completed: 2026-10-24 21:04)
- [x] 2.1.2 Run the spec tests and verify they fail (red phase); document any that pass with justification ✅ (completed: 2026-10-24 21:05) — one suite fails at import (`ERR_MODULE_NOT_FOUND`); zero cases pass

### Step 2.2: Implementation

- [x] 2.2.1 Create `bin/lib/discovery-rules.mjs` and `.d.mts` with the constants, `DiscoveryPublishSchema`, and `validatePublish` rules 1–5 and 8 per 03-02 §Constants/§Publish contract/§validatePublish rules ✅ (completed: 2026-10-24 21:05)
- [x] 2.2.2 Add `validatePublish` rules 6–7, `toAnswer`, `validateAnswer`, `validateDefer`, and `questionFingerprint` per 03-02 §Answer shape/§Functions ✅ (completed: 2026-10-24 21:05)
- [x] 2.2.3 Add `evaluatePlan` per 03-02 §evaluatePlan semantics ✅ (completed: 2026-10-24 21:05)
- [x] 2.2.4 Add `groupReadiness` and `planCounts` per 03-02 §groupReadiness semantics ✅ (completed: 2026-10-24 21:05)

  > Tasks 2.2.1–2.2.4 were implemented as one module write; their marks were written together.
- [x] 2.2.5 Run the spec tests and verify they pass (green phase); on a failure fix the implementation, never the test ✅ (completed: 2026-10-24 21:06) — 19/19 pass

### Step 2.3: Implementation tests and hardening

- [x] 2.3.1 Write the implementation tests — `bin/discovery-rules.impl.test.mjs` (normalization edges, every error path, cap boundaries) ✅ (completed: 2026-10-24 21:06) — 17/17 pass
- [x] 2.3.2 Full verification: `npm run verify` ✅ (completed: 2026-10-24 21:07; re-verified 23:33 after the phase review) — typecheck, 469 tests, version parity pass

**Deliverables**:
- The browser-safe rules module with typings
- All verification passing

**Verify**: `npm run verify`

---

## Phase 3: Store

> **Phase baseline tree**: d0e0453f9a52b21f414aa892e865baa2becd31a5
> **Expected modification set**: `bin/lib/discovery-store.mjs` (new), `bin/lib/discovery-store.d.mts` (new), `bin/discovery-store.spec.test.mjs` (new), `bin/discovery-store.impl.test.mjs` (new) · **Scope mode**: strict
> **Reasoning**: high — durable data, ownership, and exactly-once delivery

### Step 3.1: Specification tests

**Reference**: 07 ST-13…ST-26 · 03-03 · AR-5, AR-15, AR-22–AR-24, AR-27–AR-29, AR-40, AR-42, AR-46, AR-47, AR-49, AR-52, AR-53, AD-54
**Objective**: The store contract encoded before implementation.

- [x] 3.1.1 [spec-author] Write the specification tests for ST-13…ST-26 — `bin/discovery-store.spec.test.mjs` ✅ (completed: 2026-10-25 23:37)
- [x] 3.1.2 Run the spec tests and verify they fail (red phase); document any that pass with justification ✅ (completed: 2026-10-25 23:37) — one suite fails at import (`ERR_MODULE_NOT_FOUND`); zero cases pass

### Step 3.2: Implementation

- [x] 3.2.1 Create `bin/lib/discovery-store.mjs` and `.d.mts` with `resolveDataDir`, `createDiscoveryStore`, the process-wide per-file queue, atomic writes, containment checks, permissions, and the typed `DiscoveryDataError` refusals per 03-03 §Durability — ST-13 green ✅ (completed: 2026-10-25 23:38)
- [x] 3.2.2 Add projects: `registerProject`, slugs, `listProjects`, `getProject`, `findProjectByDirectory` per 03-03 §Identity — ST-14, ST-15 green ✅ (completed: 2026-10-25 23:38)
- [x] 3.2.3 Add `publish` (plan identity, ownership, full-set merge, submitted-question retention, type-change refusal, unarchive) per 03-03 §Identity/§Transitions — ST-16 green ✅ (completed: 2026-10-25 23:38)
- [x] 3.2.4 Add `getPlan`, `findPlan`, `listPlans`, `setArchived`, `deletePlan` per 03-03 §API/§Transitions — ST-19 green ✅ (completed: 2026-10-25 23:38)
- [x] 3.2.5 Add `saveAnswer` (including re-validating `reconfirm`) and `submit` with `baseRevision` per 03-03 §Transitions — ST-20…ST-22 green ✅ (completed: 2026-10-25 23:38)
- [x] 3.2.6 Add `pendingDeliveries`, `claimDelivery`/`releaseDelivery` (claim → prompt → `deliveredAt`, dead-claim sweep), `readAnswers`, `resolve`, `markOrphaned` per 03-03 §Transitions — ST-17, ST-23, ST-24, ST-26 green ✅ (completed: 2026-10-25 23:38)
- [x] 3.2.7 Run the spec tests and verify they pass (green phase) — ST-18 and ST-25 green ✅ (completed: 2026-10-25 23:38) — 16/16 pass

  > Tasks 3.2.1–3.2.6 were implemented as one module write; their marks were written together.

### Step 3.3: Implementation tests and hardening

- [x] 3.3.1 Write the implementation tests — `bin/discovery-store.impl.test.mjs` (slug edge cases, temp-file cleanup on failure, queue ordering, dead-claim release) ✅ (completed: 2026-10-25 23:40) — 12/12 pass
- [x] 3.3.2 Full verification: `npm run verify` ✅ (completed: 2026-10-25 23:42; re-verified after the phase review) — typecheck, 500 tests, version parity pass

**Deliverables**:
- The store with typings and permission-hardened, crash-safe writes
- All verification passing

**Verify**: `npm run verify`

---

## Phase 4: Shared listener and API

> **Phase baseline tree**: _(recorded by the exec-plan skill)_
> **Expected modification set**: `bin/lib/discovery-server.mjs` (new), `bin/lib/discovery-server.d.mts` (new), `bin/discovery-server.spec.test.mjs` (new), `bin/discovery-server.impl.test.mjs` (new) · **Scope mode**: strict
> **Reasoning**: max — a local network listener whose protections must hold against browser-originated attacks, plus live delivery

### Step 4.1: Specification tests

**Reference**: 07 ST-27…ST-38 · 03-04 (and §Fallback B when Phase 1 selected it) · AR-3, AR-4, AR-21, AR-29–AR-31, AR-37, AR-41, AR-48, AD-55
**Objective**: The listener contract encoded before implementation.

- [ ] 4.1.1 [spec-author] Write the specification tests for ST-27…ST-38 (plus the fallback variants when Phase 1 selected them) — `bin/discovery-server.spec.test.mjs`
- [ ] 4.1.2 Run the spec tests and verify they fail (red phase); document any that pass with justification

### Step 4.2: Implementation

- [ ] 4.2.1 Create `bin/lib/discovery-server.mjs` and `.d.mts` with `resolvePort`, `createDiscoveryRuntime`, the `getDiscoveryRuntime` wrapper, `ensureListening` with single-flight and the port fallback, `registerProject` (identity-checked unregister), `closeIfIdle` (ends SSE first) per 03-04 §Runtime API — ST-27, ST-28, ST-37, ST-38 green
- [ ] 4.2.2 Add the request pipeline (Host, route-slug validation, write checks, body cap, headers, error envelope, internal 500) and `GET /api/health` per 03-04 §Request pipeline — ST-29 green
- [ ] 4.2.3 Add static assets, the per-request nonce and CSP, the asset re-list after a missing `dist/`, and the not-built page per 03-04 §Static assets and CSP — ST-32, ST-33 green
- [ ] 4.2.4 Add the read endpoints per 03-04 §Endpoints — ST-34 green
- [ ] 4.2.5 Add the write endpoints (including `baseRevision` and the `woken`/`pending` result) and the delivery hook per 03-04 §Endpoints — ST-30, ST-31, ST-35 green
- [ ] 4.2.6 Add the events stream, viewer counting, `notify` (changed/delivered) per 03-04 §Live events — ST-36 green
- [ ] 4.2.7 Run the spec tests and verify they pass (green phase)

### Step 4.3: Implementation tests and hardening

- [ ] 4.3.1 Write the implementation tests — `bin/discovery-server.impl.test.mjs` (MIME map, asset allow-list, viewer counting on disconnect, internal-error path, single-flight bind)
- [ ] 4.3.2 Full verification: `npm run verify`

**Deliverables**:
- The shared listener with the approved local protections
- All verification passing

**Verify**: `npm run verify`

---

## Phase 5: Plugin integration and config

> **Phase baseline tree**: _(recorded by the exec-plan skill)_
> **Expected modification set**: `bin/lib/discovery-tools.mjs` (new), `bin/lib/discovery-tools.d.mts` (new), `plugin/index.ts`, `schemas/codeops-config.schema.json`, `plugin/discovery-plugin.spec.test.mjs` (new), `plugin/discovery-plugin.impl.test.mjs` (new) · **Scope mode**: strict
> **Reasoning**: high — an always-on plugin gains an opt-in surface; containment and exactly-once waking are the invariants

### Step 5.1: Specification tests

**Reference**: 07 ST-39…ST-47 · 03-05 (and §Fallback A when Phase 1 selected it) · AR-1, AR-5, AR-11, AR-13, AR-14, AR-20, AR-23, AR-27, AR-31, AR-40, AR-41, AR-45, AR-46, AR-48, AD-56, AD-57
**Objective**: The integration contract encoded before implementation.

- [ ] 5.1.1 [spec-author] Write the specification tests for ST-39…ST-47 — `plugin/discovery-plugin.spec.test.mjs`
- [ ] 5.1.2 Run the spec tests and verify they fail (red phase); document any that pass with justification (ST-41's negative checks are expected to pass)

### Step 5.2: Implementation

- [ ] 5.2.1 Add the `discovery` object to `schemas/codeops-config.schema.json` per 03-05 §Config schema — ST-39 green
- [ ] 5.2.2 Create `bin/lib/discovery-tools.mjs` and `.d.mts` with `readDiscoveryConfig` and `createDiscoveryController` (lazy store/runtime on first enable, `sync`, enable/disable, project registration with branch and repository, `dispose`) per 03-05 §Opt-in check — ST-40 green
- [ ] 5.2.3 Add `registerDiscoveryTools`, the publish handler with `fallbackPort`, and the browser opener per 03-05 §Tools/§Browser opener — ST-43 green
- [ ] 5.2.4 Add the answers and resolve handlers, including their `runtime.notify` calls, per 03-05 §Tools — ST-44 green
- [ ] 5.2.5 Add the reachability check, delivery points, one claim-then-prompt per plan with release on failure, the dead-claim sweep, the wake text, and orphaning per 03-05 §Waking and delivery — ST-45 green
- [ ] 5.2.6 Wire `plugin/index.ts`: the guarded setup block with an early-declared controller, the `context` hook, the `session.deleted` branch, and `dispose()` in the returned cleanup per 03-05 §Code Examples — ST-41, ST-42, ST-46, ST-47 green
- [ ] 5.2.7 Run the spec tests and verify they pass (green phase); the existing progress suites pass unchanged

### Step 5.3: Implementation tests and hardening

- [ ] 5.3.1 Write the implementation tests — `plugin/discovery-plugin.impl.test.mjs` (transform guard paths, reload on toggle, release on prompt failure)
- [ ] 5.3.2 Full verification: `npm run verify`

**Deliverables**:
- Opt-in tools, waking, and delivery wired into the plugin behind feature detection
- All verification passing

**Verify**: `npm run verify`

---

## Phase 6: Web UI and packaging

> **Phase baseline tree**: _(recorded by the exec-plan skill)_
> **Expected modification set**: `discovery-ui/` (new: `index.html`, `tsconfig.json`, `src/**`), `scripts/build-discovery-ui.mjs` (new), `scripts/discovery-ui.spec.test.mjs` (new), `scripts/discovery-ui.impl.test.mjs` (new), `package.json`, `package-lock.json`, `.gitignore`, `plugin/tui-foundation.spec.test.mjs` (adds `--ignore-scripts`) · **Scope mode**: strict
> **Reasoning**: high — a new build pipeline, CSP nonce wiring, and the user-visible surface

Executors load the `fluentui` and `fluentui-design` skills before writing view code (03-06 §Overview).

### Step 6.1: Specification tests

**Reference**: 07 ST-48…ST-55 · 03-06 · AR-3, AR-6, AR-24–AR-26, AR-29, AR-30, AR-32, AR-36, AR-37, AR-41, AR-43, AR-44, AR-47, AR-52, AR-53, AD-58, AD-59
**Objective**: The UI contract encoded before implementation.

- [ ] 6.1.1 [spec-author] Write the specification tests for ST-48…ST-55 — `scripts/discovery-ui.spec.test.mjs`
- [ ] 6.1.2 Run the spec tests and verify they fail (red phase); document any that pass with justification

### Step 6.2: Implementation

- [ ] 6.2.1 Add the devDependencies (`package.json`, `package-lock.json`, including `@griffel/react`), `discovery-ui/tsconfig.json` (with `allowImportingTsExtensions` and `erasableSyntaxOnly`), and `discovery-ui/index.html` per 03-06 §Proposed Changes
- [ ] 6.2.2 Add `scripts/build-discovery-ui.mjs` (with the metafile result), the `package.json` scripts and `files` entry, the `.gitignore` entry, and `--ignore-scripts` in `plugin/tui-foundation.spec.test.mjs` per 03-06 §Build — ST-54 green
- [ ] 6.2.3 Add `src/renderer.ts` (injectable document), `src/route.ts`, and `src/hooks.ts` (`useHashRoute`, `useSystemTheme` touched only from effects) per 03-06 §Routes/§CSP nonce and theme — ST-48, ST-52 green
- [ ] 6.2.4 Add `src/main.tsx` and the `src/app.tsx` shell with `{ route, api, initial }` props (header, breadcrumb, routed view) per 03-06 §Views (PAT-001)
- [ ] 6.2.5 Add `src/api.ts` (submit sends `baseRevision`) and `src/view-models.ts` per 03-06 §Data flow/§Views — ST-49, ST-55 green
- [ ] 6.2.6 Add `ProjectsPage` and `ProjectPage` per 03-06 §Views (PAT-002)
- [ ] 6.2.7 Add `QuestionCard` and `DeferFields` per 03-06 §Views/§Data flow (PAT-004)
- [ ] 6.2.8 Add `PlanPage` and `GroupSection` with the archive/delete menu per 03-06 §Views (PAT-004)
- [ ] 6.2.9 Add `SubmitDialog`, `ConnectionBanner`, and `usePlanEvents` per 03-06 §Views/§Data flow — ST-51 green
- [ ] 6.2.10 Run the spec tests and verify they pass (green phase), including ST-50 against the complete shell and ST-53 against a fresh build with `--ignore-scripts`

### Step 6.3: Implementation tests and hardening

- [ ] 6.3.1 Write the implementation tests — `scripts/discovery-ui.impl.test.mjs` (route encoding edges, view-model edge states)
- [ ] 6.3.2 Full verification: `npm run verify`, then `npm pack --dry-run`

**Deliverables**:
- The Fluent UI app, its build, and packaging
- All verification passing

**Verify**: `npm run verify`

---

## Phase 7: Skills protocol

> **Phase baseline tree**: _(recorded by the exec-plan skill)_
> **Expected modification set**: `_shared/discovery.md` (new), `_shared/zero-ambiguity-gate.md`, `skills/make-plan/SKILL.md`, `skills/preflight/SKILL.md`, `skills/preflight/report-format.md`, `skills/analyze-project/SKILL.md`, `scripts/discovery-content.spec.test.mjs` (new) · **Scope mode**: strict
> **Reasoning**: high — protocol text that changes how gate decisions are collected and recorded
> **Specialist**: `agent-pipeline-reviewer` (required: changes the `AGENTS.md` managed-block contract) — see 00-index §Specialist Agents

### Step 7.1: Specification tests

**Reference**: 07 ST-56…ST-60 · 03-07 · AR-11, AR-13, AR-20, AR-23, AR-27, AR-35, AR-38, AR-39, AD-62
**Objective**: The protocol contracts encoded before the text is written.

- [ ] 7.1.1 [spec-author] Write the content specification tests for ST-56…ST-60 — `scripts/discovery-content.spec.test.mjs`
- [ ] 7.1.2 Run the spec tests and verify they fail (red phase); document any that pass with justification

### Step 7.2: Implementation

- [ ] 7.2.1 Write `_shared/discovery.md` per 03-07 §`_shared/discovery.md` — ST-56 green
- [ ] 7.2.2 Add the Discovery section to `_shared/zero-ambiguity-gate.md` and the Discovery option plus Phase 1.1/1C references to `skills/make-plan/SKILL.md` per 03-07 — ST-57, ST-58 green
- [ ] 7.2.3 Add the Discovery option to `skills/preflight/SKILL.md` and the Step 5 Discovery path to `skills/preflight/report-format.md` per 03-07 — ST-59 green
- [ ] 7.2.4 Add the `--with-discovery` / `--without-discovery` step to `skills/analyze-project/SKILL.md` per 03-07 — ST-60 green
- [ ] 7.2.5 Run the spec tests and verify they pass (green phase)

### Step 7.3: Hardening

- [ ] 7.3.1 Full verification: `npm run verify` (content contracts only — the text has no internals to test separately)

**Deliverables**:
- The shared protocol and both skill adoptions, plus the `analyze-project` switch
- All verification passing

**Verify**: `npm run verify`

---

## Phase 8: Docs and live evidence

> **Phase baseline tree**: _(recorded by the exec-plan skill)_
> **Expected modification set**: `README.md`, `CHANGELOG.md`, `scripts/discovery-content.spec.test.mjs`, `scripts/exec-plan-progress-content.spec.test.mjs` (CHANGELOG assertion only) + this plan's evidence notes (live-run artifacts stay under the temp root) · **Scope mode**: strict
> **Reasoning**: medium — documentation plus live evidence with recorded fallbacks

### Step 8.1: Docs, evidence, and final verification

**Reference**: 07 ST-61…ST-63 · 03-07 §`README.md`/§`CHANGELOG.md` · 03-06 §Manual checklist · AR-33 · Req R16, Acceptance 4–7
**Objective**: The shipped feature is documented and proven live.

- [ ] 8.1.1 [spec-author] Add the specification test for ST-61 to `scripts/discovery-content.spec.test.mjs`
- [ ] 8.1.2 Run ST-61 and verify it fails (red phase)
- [ ] 8.1.3 Amend the `## Unreleased` branch of `scripts/exec-plan-progress-content.spec.test.mjs` so it accepts either feature group and pins the progress facts document-wide; the released branch already reads the whole document
- [ ] 8.1.4 Add the README section (including the single-user-machine assumption) and the `## Unreleased` CHANGELOG entry per 03-07
- [ ] 8.1.5 Run ST-61 and the progress content test, and verify they pass (green phase)
- [ ] 8.1.6 Execute the live end-to-end run ST-62 (packed tarball, isolated config, opted-in scratch project) and record the build, steps, and outcome in a note under this task
- [ ] 8.1.7 Run the manual checklist ST-63 with the user and record each item's outcome in a note under this task
- [ ] 8.1.8 Final full verification: `npm run verify` and `npm pack --dry-run`, then review the Success Criteria below

**Deliverables**:
- README section and CHANGELOG entry
- ST-62 and ST-63 evidence recorded
- All verification passing

**Verify**: `npm run verify`

---

## Dependencies

```
Phase 1 (spike) ─► Phase 2 (rules) ─► Phase 3 (store) ─► Phase 4 (listener) ─► Phase 5 (plugin)
                          │                                                          │
                          └──────────────────────────► Phase 6 (web UI) ◄────────────┘
                                                              │
                                    Phase 7 (skills) ◄────────┘
                                          │
                                    Phase 8 (docs + live evidence)
```

Phase 6 needs the rules module (shared with the page) and the listener's API (Phases 4–5).
Phase 7 needs the tool names and behaviour of Phase 5. Phase 8 needs everything.

---

## Success Criteria

**This plan is complete when:**

1. ✅ All phases completed; Progress 76/76
2. ✅ All verification passing: `npm run verify` (typecheck including `discovery-ui`, tests, version parity)
3. ✅ ST-1…ST-61 pass plus the variants selected in Phase 1 (ST-27B/34B/37B, ST-44A/45A, ST-62A); red phases recorded; implementation tests pass
4. ✅ The Phase 1 note records A–F, the fallbacks followed, and the active variant set
5. ✅ ST-62 live evidence and ST-63 manual checklist recorded
6. ✅ With Discovery off, nothing new is registered or started (ST-41)
7. ✅ `npm pack --dry-run` lists the built UI assets and no UI sources
8. ✅ README section and CHANGELOG entry present; no release performed
9. ✅ Out-of-scope items (AR-18, AR-2, AR-3, AR-36) absent from all executable artifacts
10. ✅ Code reviewed per the repository's quality flow; Phase 7 reviewed by `agent-pipeline-reviewer`; no dead code; documentation standards met
11. ✅ Post-completion project re-analysis (handled by the exec-plan skill)
