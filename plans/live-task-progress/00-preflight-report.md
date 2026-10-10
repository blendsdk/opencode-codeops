# Preflight Report: live-task-progress

> **Status**: ✅ PASSED WITH NOTES — iteration 2: all 29 findings resolved and fixes applied +
> verified; zero carried forward and zero new blocking findings. Three informational wording
> observations from the iteration-2 scan were handled in place (two applied, one documented as a
> harmless shorthand).
> **Iteration**: 2 (re-scan after fixes)
> **Artifact**: implementation plan at `plans/live-task-progress/` (10 documents; committed at
> `8835f5c`)
> **Content hash**: `f5f3c2229fa24fc86e98d0cc369fb561597e0c4e69556ec710c2906e3e14888b` — sha256
> over the sorted per-file sha256 lines of the ten artifact documents, computed from within the
> plan directory (iteration-1 revision: `e1b07ab9a93058a4d95c60f0ff04a99b3169ef89817696b7eef63cfa06a75dec`)
> **Codebase Grounded**: ≈45 repository/registry files examined; every artifact reference mapped —
> all verified except the explicitly flagged unverifiable claims under Verification Notes
> **Scope mode**: `strict` (no `--explore-scope`); no optional additions reported
> **Auto-design**: active — root invocation ID `AD-PF-LTP-20261010-1`, policy version 1. Eligible
> technical resolutions are recorded as delegated; reserved decisions remain user-owned (none were
> triggered in this scan). Fix application + commit + push were explicitly authorized by the user
> for this run.
> **Suggested reasoning**: `high` — adversarial multi-dimension audit (not applied; no
> `--auto-effort` token)
> **Last Updated**: 2026-10-10 19:18

### Audit scope contract

| Term | Value |
|---|---|
| **Audit target** | `plans/live-task-progress/` — all 10 documents (00-ambiguity-register, 00-index, 01-requirements, 02-current-state, 03-01-progress-core, 03-02-server-wiring, 03-03-sidebar-view, 03-04-protocol-and-docs, 07-testing-strategy, 99-execution-plan) |
| **Context documents** | `AGENTS.md`; `bin/lib/codeops-rpc.{mjs,d.mts}`; `plugin/index.ts`; `plugin/tui.tsx`; `plugin/tui-foundation.{spec,impl}.test.mjs`; `package.json`; `package-lock.json`; `tsconfig.json`; `skills/exec-plan/{SKILL.md,execution-protocol.md}`; `README.md`; `CHANGELOG.md`; `plans/live-task-sidebar/*`; installed `node_modules/@opencode/**` `.d.ts` files (nested client included); npm registry probe; `@opencode/plugin@2.0.26` tarball diff |
| **Modification set** | The 10 audit-target documents — fixes applied under the user's explicit authorization (apply + commit + push). No context document was modified. |
| **Frozen product baseline** | Slice 2 as re-derived in register row 1: core pillars (progress tool + run state + RPC events, sidebar view, exec-plan protocol integration) + delegation display + remote-client acceptance run; agent-template integration deferred (row 15) and absent from every executable artifact. |

### Codebase Context Summary

**Tech stack:** OpenCode v2 plugin (`opencode-codeops` 2.1.1) — TypeScript server plugin
(`plugin/index.ts`), plain-JS helpers under `bin/lib/` (`*.mjs` + `.d.mts`), TUI entry
(`plugin/tui.tsx`), Python tooling under `scripts/`, Markdown skills, `node --test` (Node 22.23
locally / 24 in CI). **Version facts (verified):** installed `@opencode/plugin` = 2.0.24
(lockfile-pinned; registry latest 2.0.26); local `opencode` CLI = v2.0.26; the cited host `.d.ts`
files are byte-identical between 2.0.24 and 2.0.26; `@opencode/client` is nested under
`@opencode/plugin/node_modules/`.
**Architecture:** server plugin registers hooks and a custom `codeops` RPC behind feature
detection; `bin/lib/codeops-rpc.mjs` owns the runtime-free RPC definition, the never-throwing
registration guard, the payload guard, and the location-scoped `requestStatus`; `plugin/tui.tsx`
claims `sidebar.content` and renders a version strip from a validated payload. The plan adds
`bin/lib/codeops-progress.mjs` (contracts/state/display), a `codeops_progress` tool, a `progress`
method, `updated`/`cleared` events, and the live view.
**Key files examined:** `plugin/index.ts` (session.deleted loop :241-252; RPC try/catch
:394-404), `plugin/tui.tsx`, `bin/lib/codeops-rpc.mjs` + `.d.mts`,
`plugin/tui-foundation.{spec,impl}.test.mjs` (:122-134 strip assertions; :119-128 definition
shape), `package.json`, `skills/exec-plan/execution-protocol.md` (mandate :384; quality step
:163-218), `plans/live-task-sidebar/` (AR #1/#5/#9/#14/#16/#18/#20/#21/#22; notes E/G/I/J;
05-findings RV-001/SA-004), the installed SDK `.d.ts` files, `CHANGELOG.md` (foundation
"Verified end-to-end on OpenCode v2.0.26").
**Independent verification beyond the lead scan:** the 13 dimensions were audited by 5 independent
cluster dispatches (① soundness ② grounding ③ delivery ④ risk ⑤ fit — the `preflight-auditor`
role was unavailable, so complete generic packets were used, as the shared profile allows); the
CRITICAL/MAJOR batch was hardened by one blind challenger (converged on both); iteration 2 was
verified by an independent re-scan dispatch plus lead re-checks.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 4 | 🟡 |
| 2 | Implicit Assumptions | 4 | 🟡 |
| 3 | Logical Contradictions | 3 | 🔴 |
| 4 | Completeness Gaps | 0 | — |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 1 | 🟡 |
| 7 | Testability | 3 | 🟡 |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 | 🟡 |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 1 | 🟠 |
| 12 | Consistency | 7 | 🟡 |
| 13 | Codebase Alignment | 5 | 🟡 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1 | resolved by delegated decision (PF-001) |
| MAJOR | 1 | resolved by delegated decision (PF-002) |
| MINOR | 18 | all resolved by delegated decision |
| OBSERVATION | 9 | all resolved by delegated decision |

### Same-model bias & external-standard notes

- The artifact was authored earlier on 2026-10-10 (previous session), almost certainly by this
  same model family. Mitigations: five independent cluster audits, one blind challenger, one
  independent iteration-2 verifier, and lead re-verification of every surviving finding against
  the installed `.d.ts` files, the working tree, the npm registry, and the CHANGELOG.
- External standards were verified by citation, not memory: the host API claims against the
  installed `@opencode/plugin` `.d.ts` files (and the byte-identical 2.0.26 tarball); the
  OpenCode CLI docs page for slots/client/events (fetched). Claims that could not be verified
  locally are flagged in Verification Notes and were corrected or marked inherited.
- Adversarial checklist: the assumed "host validates tool input first" was challenged and
  softened (PF-025); "events are ephemeral" was challenged and marked inherited (PF-026);
  the JSON-Schema form dependency was challenged and recorded for the ST-22 check (PF-027).

---

## Findings

Every `PF-NNN` below was resolved. "Delegated" means the resolution was selected under
`_shared/auto-design.md` (policy version 1, root `AD-PF-LTP-20261010-1`) because the finding
concerned an eligible implementation mechanism, interface, failure design, testing strategy, or
documentation correction within the confirmed scope; each record carries the required
provenance. No reserved (user-owned) decision was triggered, so no finding paused for a ruling.
`Sources` lists the merged auditor findings (PA-NNN across clusters).

### PF-001: Required `plan`/`activity` vs partial-report semantics [🔴 CRITICAL]

**Dimension:** 3 (Logical Contradictions; also Completeness 4 and Testability 7)
**Location:** `03-04-protocol-and-docs.md` §Protocol table (all rows); `07-testing-strategy.md`
ST-2 and ST-5; `03-01-progress-core.md` §Contracts / §Run state merge table
**Codebase evidence:** the tool input schema requires both fields; `normalizeProgressReport`
rejects an empty-after-trim `plan` and an absent `activity`; a report without `activity` is
rejected by the runtime guard regardless of host validation.
**The Problem:** The plan's own artifacts disagreed about required fields. The protocol table
omitted `plan` on nine of ten rows (header: "absent fields are carried by the state"), so those
calls would be rejected at the schema/guard and the sidebar would never update past the first
report. Separately, ST-5's third call omitted `activity` yet expected acceptance, contradicting
ST-2 — the immutable spec oracle could not be satisfied as authored, blocking Phase 1.
**Options:** A — keep both fields required on every call; add `plan` to every protocol row, fix
ST-5's third input, clarify the merge-table wording. B — make `activity` optional on merge
(contradicts note C and weakens the host-validates-first guarantee; a create-time-only requirement
is not expressible in the JSON Schema). C — make both optional with carry-forward (changes note
C, the schema, the guard, and new-run detection).
**Resolution:** Option A. `plan` and `activity` are always present; the merge model covers only
optional fields; ST-5's third call carries `activity:"implementing"` with its expectation
unchanged; ST-2/ST-3 stand; note B/C wording aligned; the protocol table and its header were
rewritten accordingly.
**Provenance:** Authority: AI — delegated by `--auto-design` (`AD-PF-LTP-20261010-1`, policy v1).
Eligibility: internal interface semantics and testing strategy within the confirmed contract; no
reserved consequence. Evidence: schema `required` list; ST-2 rejection rule; nine protocol rows
omitting `plan`. Rejected: options B (schema cannot express create-only requirements; splits one
contract across two layers) and C (contradicts note C; enlarges the change). Confidence: High.
Hardening: single blind challenger for the CRITICAL/MAJOR batch — **Challenger: converged**
(High; noted the strict immutable-oracle reading and rebutted it: the contradiction exists before
any code, and the smallest correction edits an input that mirrors no real protocol moment).
Reopen triggers: a real protocol moment requiring an activity-less report; a future host schema
grammar that forbids role-dependent `required` lists.
**Sources:** PA-001, PA-401, PA-801.
**User Decision:** — (delegated; applied)

### PF-002: Phase 3 supersession sequenced after the code change that forces it red [🟠 MAJOR]

**Dimension:** 11 (Ordering & Sequencing)
**Location:** `99-execution-plan.md` Phase 3 tasks; `03-03-sidebar-view.md` §Superseding
**Codebase evidence:** `plugin/tui-foundation.spec.test.mjs:122-134` asserts
`/isCodeOpsStatus/` and exactly one `CodeOps v` literal against `plugin/tui.tsx`; the Phase 3
rewrite removes both, so `npm run verify` fails after task 3.1.2 and it could not be promoted to
`[x]` before task 3.1.3 (the per-task verify gate). Phase 1 avoids the same window by bundling
its analogous foundation-test update into task 1.1.4.
**Resolution:** Option A — merge the rewrite and the supersession into one task (3.1.2), with
ST-16…ST-18 green as the criterion; the phase drops to 4 tasks and the plan to 21 total
(header 0/21, success criteria 21/21 updated).
**Provenance:** Authority: AI — delegated by `--auto-design` (policy v1). Eligibility:
implementation sequencing. Evidence: the foundation assertions and the per-task verify rule;
Phase 1 precedent. Rejected: swap order (B — leaves the supersession with an empty completion
criterion and weakens the oracle earlier than needed); paired promotion (C — leaves a
known-unverifiable `[~]` task the resume rule re-selects). Confidence: High. Hardening:
**Challenger: converged** (High; required the task-count bookkeeping and ST-16/17/18 naming in
the merged task). Reopen triggers: ST-17 rewritten to own only the TSX (would make the swap
equally clean).
**Sources:** PA-402.
**User Decision:** — (delegated; applied)

### PF-003: Installed SDK version mislabeled as 2.0.26 [🟡 MINOR]

**Dimension:** 13 (Dependency Reality)
**Location:** `02-current-state.md:32`; `00-index.md:100`; `00-ambiguity-register.md` note A
**Codebase evidence:** `package.json` declares `^2.0.24`; `package-lock.json` pins 2.0.24;
`node_modules/@opencode/plugin/package.json` reports 2.0.24; npm registry latest is 2.0.26; the
CLI is v2.0.26; the cited `.d.ts` files are byte-identical across the two versions.
**Resolution:** Corrected to the installed SDK 2.0.24 (lockfile-pinned) with the OpenCode build
v2.0.26 stated separately; the byte-identical note added. Foundation build claims (v2.0.26) kept.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: documentation
correction; no behavior change. Evidence: lockfile + registry + CLI probes. Rejected: bumping the
dependency (option 2 — unnecessary support-surface change). Confidence: High. Reopen triggers:
the SDK dependency is updated.
**Sources:** PA-006, PA-201, PA-404, PA-604.
**User Decision:** — (delegated; applied)

### PF-004: `subscribe(...)` helper undefined and in conflict with the spec oracle [🟡 MINOR]

**Dimension:** 13 (Phantom Reference / Test Impact)
**Location:** `03-03-sidebar-view.md` §Component design
**Codebase evidence:** no `subscribe` export exists in the 03-01 contracts; ST-16 is a content
inspection of `plugin/tui.tsx` requiring the `events.on("updated"/"cleared")` calls in the TSX.
**Resolution:** The snippet now shows the inline guarded handlers (with the PF-008 clear guard),
matching the behavioral contract and ST-16/ST-17.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: internal interface
and test alignment. Evidence: ST-16; 03-01 export list. Rejected: adding a helper export and
relaxing the content tests (larger surface; contradicted the thin-renderer intent). Confidence:
High. Reopen triggers: the view outgrows the TSX and moves to a tested helper.
**Sources:** PA-203, PA-603.
**User Decision:** — (delegated; applied)

### PF-005: Strip-supersession retained invariants listed inconsistently [🟡 MINOR]

**Dimension:** 12 (Consistency; also Testability)
**Location:** `03-03-sidebar-view.md` §Superseding; `99-execution-plan.md` task 3.1.3 (pre-merge
wording); `07-testing-strategy.md` ST-17
**Codebase evidence:** the current foundation assertions include a guard assertion
(`/isCodeOpsStatus/`) that the rewritten TSX no longer uses; the retained-set contract differed
(4 vs 3 items) and left the guard's fate unspecified.
**Resolution:** Retained in the foundation file: slot claim, helper import, no timers. The
guard-validated-render contract is owned by `plugin/tui-progress.spec.test.mjs` (ST-16…ST-18).
All three documents now agree.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: testing strategy and
documentation alignment within the approved supersession. Evidence: foundation assertions;
rewritten view contracts. Rejected: keeping a restated guard assertion in the foundation file
(duplicates the new spec's ownership). Confidence: High. Reopen triggers: the supersession set is
revisited.
**Sources:** PA-004, PA-804.
**User Decision:** — (delegated; applied)

### PF-006: ST-13 emit-binding precondition unstated [🟡 MINOR]

**Dimension:** 7 (Testability)
**Location:** `07-testing-strategy.md` ST-13
**Codebase evidence:** `report` emits only when an emit is bound; binding happens through
`registerCodeOpsRpc` returning a registration exposing `events.emit`; ST-13 named only the tool
registration.
**Resolution:** ST-13 now states the bound-emit precondition.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: testing strategy.
Evidence: 03-01 binding contract. Rejected: moving the emission assertion to ST-14 (loses the
tool-handler-level coverage). Confidence: High. Reopen triggers: none.
**Sources:** PA-013, PA-405, PA-803.
**User Decision:** — (delegated; applied)

### PF-007: `clearSession` emission ownership ambiguous [🟡 MINOR]

**Dimension:** 1 (Ambiguities)
**Location:** `03-01-progress-core.md` §Run state; `03-02-server-wiring.md` step 4
**Codebase evidence:** the emit handle is bound inside the runtime; `plugin/index.ts` never
receives it, so the caller cannot emit.
**Resolution:** The runtime emits `cleared` internally through the bound emit and returns the
cleared identity for logging/tests; both documents now state this.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: failure/interfaces
design. Evidence: binding contract in 03-01; no caller emit handle. Rejected: caller-side emission
(impossible with the bound handle; contradicted ST-10). Confidence: High. Reopen triggers: the
clearing path moves out of the runtime.
**Sources:** PA-014, PA-806.
**User Decision:** — (delegated; applied)

### PF-008: Cleared-vs-late-update resurrection; "cannot regress" overclaim [🟡 MINOR]

**Dimension:** 9 (Edge Cases; also honesty)
**Location:** `00-ambiguity-register.md` note C; `03-01-progress-core.md` RunClearedSchema /
clearSession; `03-03-sidebar-view.md` merge/cleared rows; `07-testing-strategy.md` ST-9/ST-10/ST-17
**Codebase evidence:** the host wraps `registration.events.emit` in an async scheduler
(`dist/promise/adapter.js:96`), so a pending `updated` can fire after `cleared`; the initial
`progress` snapshot can also resolve after a `cleared` event (subscribe-before-snapshot), and
`mergeRunState(null, incoming)` would re-materialize the cleared run. `RunClearedSchema` had no
timestamp, so neither race was guardable.
**Options:** (a) carry a server-stamped `clearedAt` on the cleared payload and ignore updates or
snapshots at or before it; (b) document the ordering assumption and narrow the claim; (c) accept
the ghost run as a bounded glitch.
**Resolution:** Option (a). `RunClearedSchema` = `{plan, sessionID, clearedAt}`; `clearSession`
returns/emits `clearedAt`; both view merge paths ignore snapshots at or before the last accepted
`clearedAt`; the monotonic claim now also holds across a clear; ST-9/ST-10/ST-17 and AR note C
updated.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: failure/consistency
design and internal event schema; no retention or ownership change. Evidence: adapter scheduling;
snapshot race; ST-6 merge semantics. Rejected: (b) because the snapshot race exists even with
perfect event ordering (the client apply order, not the stream order, causes it); (c) because a
visible false claim contradicts the feature's honesty rule. Confidence: Med-High. Hardening:
in-context layers (a MINOR finding does not draw the challenger budget); **disclosure:
Confidence Med-High** — if a same-connection ordering guarantee were documented AND the initial
snapshot were resolved before clear application, the doc-only option would become defensible.
Reopen triggers: the team prefers zero new schema fields; the host adds replay/ordering
guarantees.
**Sources:** PA-015, PA-601.
**User Decision:** — (delegated; applied)

### PF-009: Evidence citation pointers imprecise or wrong [🟡 MINOR]

**Dimension:** 13 (Stale Assumptions)
**Location:** `02-current-state.md:36`; `00-ambiguity-register.md` notes A and C
**Codebase evidence:** `registration.d.ts:6` is `providerID` (Transform is at :12; Registration at
:1-3); `tool.d.ts:16-45` covers ToolEditor/hooks (transform is ToolDomain :53-61); `rpc.d.ts:10-22`
covers handlers + registration (events.emit is :12-16); `rpc.d.ts:36-49` is Definition
(PortableMethod is :15-18; event schemas :23-35).
**Resolution:** All four pointers corrected.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: evidence accuracy.
Rejected: none viable (leaving wrong pointers undermines the evidence trail). Confidence: High.
Reopen triggers: SDK line layouts change.
**Sources:** PA-012, PA-205.
**User Decision:** — (delegated; applied)

### PF-010: `@opencode/client` citations not resolvable at the top level [🟡 MINOR]

**Dimension:** 13 (Phantom Reference path)
**Location:** `02-current-state.md`; `00-ambiguity-register.md` note A
**Codebase evidence:** no top-level `@opencode/client`; it is nested at
`node_modules/@opencode/plugin/node_modules/@opencode/client`; content matches the citations.
**Resolution:** Citations now use the nested path.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: evidence accuracy.
Rejected: adding the package as a direct dependency (dependency-surface change; not warranted).
Confidence: High. Reopen triggers: the client becomes a direct dependency.
**Sources:** PA-202.
**User Decision:** — (delegated; applied)

### PF-011: `ProgressOutputSchema` referenced but never defined [🟡 MINOR]

**Dimension:** 12 (Consistency)
**Location:** `03-02-server-wiring.md`; `07-testing-strategy.md` ST-12; `03-01-progress-core.md`
**Codebase evidence:** the output schema existed only inline in a table; 03-02/ST-12 used a
symbol name no document defined.
**Resolution:** `ProgressOutputSchema` is now a named constant in 03-01 (code block + constants
row) and referenced consistently.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: naming/internal
interface. Rejected: removing the symbol from 03-02 (leaves the schema unnamed for tests).
Confidence: High. Reopen triggers: none.
**Sources:** PA-005, PA-204, PA-406.
**User Decision:** — (delegated; applied)

### PF-012: AR note B field model diverged from the executable schema [🟡 MINOR]

**Dimension:** 12 (Consistency)
**Location:** `00-ambiguity-register.md` note B
**Codebase evidence:** the runtime schema uses `plan: string`, `task: string|null`; note B
described `plan {name, directory}` and `task {id, title}` and a "second run replaces" sentence
that did not distinguish same-plan merges.
**Resolution:** Note B now matches the executable model and states the required-field and
merge/replace semantics.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: decision-record
consistency (no decision changed). Rejected: leaving the register stale (invites implementation
drift). Confidence: High. Reopen triggers: the state model changes.
**Sources:** PA-002.
**User Decision:** — (delegated; applied)

### PF-013: AR note H run-start wording conflicted with the protocol table [🟡 MINOR]

**Dimension:** 3 (Logical Contradictions)
**Location:** `00-ambiguity-register.md` note H vs `03-04-protocol-and-docs.md` table
**Codebase evidence:** the table defines a single run-start call with `activity:"implementing"`;
note H's "starting→implementing" implied an undefined two-step sequence or an extra call.
**Resolution:** Note H now matches the table (single `implementing` call; the first phase's start
is covered by it).
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: decision-record
consistency. Rejected: defining a two-call sequence (contradicts the one-call rule and the
ten-point ST-19 contract). Confidence: High. Reopen triggers: the protocol adds a start state.
**Sources:** PA-003.
**User Decision:** — (delegated; applied)

### PF-014: `01` §Compatibility overclaims [🟡 MINOR]

**Dimension:** 3 (Logical Contradictions; also Consistency)
**Location:** `01-requirements.md` §Compatibility
**Codebase evidence:** the plan edits two foundation test files (impl definition shape in Phase 1;
spec strip assertions in Phase 3, user-approved); the new `bin/lib` helpers ship via the `bin/`
glob (verified with `npm pack --dry-run`), so the shipped file set grows.
**Resolution:** Reworded: the status RPC and `requestStatus` unchanged; the foundation suites keep
passing with the two recorded assertion evolutions; exports, dependency declarations, and packaged
`files` patterns unchanged, with new helper files shipping through the existing `bin/` inclusion.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: requirement-statement
accuracy without semantic change. Rejected: literal claims kept (false statements). Confidence:
High. Reopen triggers: packaging patterns change.
**Sources:** PA-007, PA-008, PA-403.
**User Decision:** — (delegated; applied)

### PF-015: Stale-threshold boundary wording vs the pinned oracle [🟡 MINOR]

**Dimension:** 1 (Ambiguities)
**Location:** `01-requirements.md` R5; `00-ambiguity-register.md` row 2; `03-01-progress-core.md`
**Codebase evidence:** `isRunStale` uses `nowMs - updatedAt >= 600_000`; ST-7 pins
`now=600000 → stale`.
**Resolution:** Prose now reads "10 minutes old or older" (row 2: "stale at ≥10 min"), aligning
documents with the pinned oracle; semantics unchanged.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: wording correction to
the already-pinned behavior. Rejected: changing `isRunStale` to a strict `>` (contradicts ST-7;
more complex rule). Confidence: High. Reopen triggers: the threshold changes.
**Sources:** PA-011.
**User Decision:** — (delegated; applied)

### PF-016: Quick Reference example vs the display contract [🟡 MINOR]

**Dimension:** 12 (Consistency; also acceptance criterion 1)
**Location:** `00-index.md` §Quick Reference; `00-ambiguity-register.md` row 2 shorthand
**Codebase evidence:** the display contract and ST-8 render the full phase string and the word
`verified`; the example showed an abbreviated phase and `6/21` without `verified`.
**Resolution:** The example now renders `Phase 2: Server wiring · implementing` and
`6/21 verified · as of 18:37`; the row-2 shorthand was aligned where it was not a deliberate
abbreviation.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: example alignment
with the confirmed presentation (row 2 user decision; no behavior change). Rejected: declaring
the example illustrative (acceptance criterion 1 binds it to the rendered output). Confidence:
High. Reopen triggers: the presentation changes.
**Sources:** PA-010, PA-407, PA-802.
**User Decision:** — (delegated; applied)

### PF-017: Related Files inventory incomplete [🟡 MINOR]

**Dimension:** 12 (Consistency)
**Location:** `00-index.md` §Related Files
**Codebase evidence:** the execution plan's Phase 1/3 modification sets include
`plugin/tui-foundation.impl.test.mjs` and `plugin/tui-foundation.spec.test.mjs`; the Changed list
omitted both.
**Resolution:** Both files added to Changed. `plans/00-roadmap.md` deliberately excluded — the
roadmap row is synced procedurally by the roadmap skill, not a feature deliverable.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: inventory accuracy.
Rejected: adding the roadmap to the feature file set (mixes bookkeeping into the deliverable
surface). Confidence: High. Reopen triggers: none.
**Sources:** PA-009, PA-210.
**User Decision:** — (delegated; applied)

### PF-018: "Server clock is the single time reference" vs client-side staleness [🟡 MINOR]

**Dimension:** 2 (Implicit Assumptions; also consistency of claims)
**Location:** `00-ambiguity-register.md` note D
**Codebase evidence:** timestamps are server-stamped; `isRunStale` compares against the viewer's
`Date.now()`, so a remote client's clock skew would affect the stale marker (ST-23's remote run).
**Resolution:** Note D now states: timestamps server-stamped; staleness uses the viewer's clock —
exact for a same-host client, approximate for a remote client.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: documentation
correction; the mechanism is unchanged (a server-computed staleness field would need fresh
emissions per tick, contradicting the no-timer rule). Rejected: server-computed staleness
(disproportionate machinery); naming skew as a limitation only (still overclaims "single time
reference" elsewhere). Confidence: High. Reopen triggers: the host gains a staleness surface.
**Sources:** PA-602.
**User Decision:** — (delegated; applied)

### PF-019: ST-22 "footer probe" undefined; agent-driven-call fallback missing [🟡 MINOR]

**Dimension:** 7 (Testability)
**Location:** `07-testing-strategy.md` ST-22; `00-ambiguity-register.md` note E
**Codebase evidence:** "footer probe" appeared nowhere else in the repository; the foundation
method used ground-truth files under the temp root; the render signal had a fallback but the
agent-driven call did not.
**Resolution:** The probe is now defined (a temp-only `prompt.footer` contribution in the scratch
project's plugin that subscribes to the RPC events and appends each received event to a
ground-truth file under the temp root), and the agent-driven call gained a bounded fallback
(re-prompt once, then record a layer-attributed inconclusive miss).
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: testing strategy
within the recorded method and no-committed-harness boundary. Rejected: committing an instrument
(boundary violation); leaving the probe implicit (no objective pass criterion). Confidence:
High. Reopen triggers: the smoke shows the footer contribution cannot render in capture.
**Sources:** PA-805.
**User Decision:** — (delegated; applied)

### PF-020: Task 4.1.4 done-criterion lumpy (deterministic + live evidence) [🟡 MINOR]

**Dimension:** 6 (Feasibility / task atomicity)
**Location:** `99-execution-plan.md` task 4.1.4
**Codebase evidence:** the task bundles pack/load/registration/control round-trip (deterministic)
with an agent-driven call and render capture (non-deterministic, user-assisted fallback).
**Resolution:** The task now states two recorded parts — (i) deterministic evidence and (ii) live
evidence — each with its outcome recorded in the completion note. Kept as one task (splitting
would not change the evidence-verification pattern; the sub-acceptances remove the ambiguity).
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: plan
structure/testing mechanics. Rejected: splitting into two tasks (adds checklist churn without a
real verify boundary). Confidence: High. Reopen triggers: the smoke evidence needs finer resume
granularity.
**Sources:** PA-605.
**User Decision:** — (delegated; applied)

### PF-021: AR row 2 "two-line" label vs the three-line view [🔵 OBSERVATION]

**Dimension:** 12 (Consistency)
**Location:** `00-ambiguity-register.md` row 2
**Resolution:** Relabeled "three-line compact view"; the draft renders three lines.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: terminology. Evidence:
the presentation block. Rejected: none viable. Confidence: High. Reopen triggers: none.
**Sources:** PA-016.
**User Decision:** — (delegated; applied)

### PF-022: R5 staleness wording vs the render-trigger limitation [🔵 OBSERVATION]

**Dimension:** 1 (Ambiguities)
**Location:** `01-requirements.md` R5
**Resolution:** R5 now reads "shown whenever the view renders with a last update 10 minutes old or
older (no timers — it refreshes on the next render)", matching note D's recorded trade-off.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: requirement wording
correction within the confirmed no-timer design. Rejected: unconditional wording (overclaims).
Confidence: High. Reopen triggers: auto-ticking staleness is requested (a timer decision reopens
note D).
**Sources:** PA-017.
**User Decision:** — (delegated; applied)

### PF-023: Note D clearing triggers omitted session deletion [🔵 OBSERVATION]

**Dimension:** 12 (Consistency)
**Location:** `00-ambiguity-register.md` note D
**Resolution:** "done persists until the next run, the reporting session's deletion, or a
restart".
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: decision-record
completeness. Evidence: note B and 03-02 clearing path. Rejected: none viable. Confidence: High.
Reopen triggers: none.
**Sources:** PA-018.
**User Decision:** — (delegated; applied)

### PF-024: "warning-once" ambiguous for repeated setups [🔵 OBSERVATION]

**Dimension:** 1 (Ambiguities)
**Location:** `03-02-server-wiring.md` §Testing
**Resolution:** Now "one warning per failed registration (no cross-call deduplication; repeated
setups each warn once)", matching the per-call `warnContentFree` pattern.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: testing wording.
Rejected: module-level dedup (unneeded machinery). Confidence: High. Reopen triggers: none.
**Sources:** PA-019.
**User Decision:** — (delegated; applied)

### PF-025: "Host validates input before execute" unverifiable [🔵 OBSERVATION]

**Dimension:** 2 (Implicit Assumptions)
**Location:** `03-01-progress-core.md`; `00-ambiguity-register.md` note F
**Resolution:** Softened to "expected but not verifiable from the installed typings"; containment
holds regardless (the handler-side guard normalizes and answers `{ok:false}` without throwing).
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: claim accuracy.
Evidence: the promise `execute` types the input as `unknown` for JSON Schema. Rejected: keeping
the unqualified claim. Confidence: High. Reopen triggers: the host's validation behavior is
documented or disproven.
**Sources:** PA-206.
**User Decision:** — (delegated; applied)

### PF-026: "Events ephemeral / backpressure" evidence not present locally [🔵 OBSERVATION]

**Dimension:** 2 (Implicit Assumptions)
**Location:** `02-current-state.md`; `00-ambiguity-register.md` note A
**Resolution:** Marked inherited from the foundation's client-docs evidence and not verifiable
from the installed packages. Not load-bearing: the design subscribes before the snapshot and
merges monotonically with the clear guard, so loss of a live event is tolerated.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: evidence labeling.
Rejected: re-fetching upstream docs as a gate (the method is unaffected). Confidence: High.
Reopen triggers: the smoke shows event loss beyond the design's tolerance.
**Sources:** PA-207.
**User Decision:** — (delegated; applied)

### PF-027: JSON-Schema form acceptance assumed [🔵 OBSERVATION]

**Dimension:** 2 (Implicit Assumptions)
**Location:** `03-01-progress-core.md` §Contracts
**Resolution:** Recorded the dependency: nullable `type` arrays and `anyOf` must be accepted by
the host's schema codec; rejection is contained (hidden sidebar), and the ST-22 smoke asserts
that `progress`, `updated`, and `cleared` actually register on the tested build.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: risk documentation;
no design change. Evidence: the SDK accepts `JsonSchema.JsonSchema` structurally; codec behavior
is not visible in the typings. Rejected: preemptively rewriting the schemas (no evidence of
rejection; the smoke decides). Confidence: High. Reopen triggers: registration fails on a tested
build.
**Sources:** PA-208.
**User Decision:** — (delegated; applied)

### PF-028: Docs spec-test filename deviates from the `-content` convention [🔵 OBSERVATION]

**Dimension:** 13 (Convention Violations)
**Location:** `00-index.md`; `02-current-state.md`; `03-04-protocol-and-docs.md`;
`07-testing-strategy.md`; `99-execution-plan.md`
**Resolution:** Renamed to `scripts/exec-plan-progress-content.spec.test.mjs` (matching
`analyze-agents-content`, `hygiene-content`, `reasoning-effort-content`, `specialist-content`).
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: naming/convention.
Rejected: accepting the deviation (consistency with existing conventions is non-negotiable).
Confidence: High. Reopen triggers: none.
**Sources:** PA-209.
**User Decision:** — (delegated; applied)

### PF-029: R6 (no file reads in the TUI) not directly asserted [🔵 OBSERVATION]

**Dimension:** 7 (Testability)
**Location:** `07-testing-strategy.md` ST-16
**Resolution:** ST-16 now asserts `plugin/tui.tsx` imports no filesystem module
(`node:fs`, `fs`, `readFile`), closing the R6 verification gap.
**Provenance:** Authority: AI — delegated by `--auto-design`. Eligibility: testing strategy
(coverage correction for an authorized requirement). Rejected: relying on construction alone
(security-relevant constraints get an assertion). Confidence: High. Reopen triggers: none.
**Sources:** PA-807.
**User Decision:** — (delegated; applied)

---

## Iteration 2 — verification of fixes and regressions

An independent iteration-2 dispatch verified all 27 fix rows (29 findings; two rows covered
paired findings) against the full document set, cross-references, checkboxes, and the working
tree. Result: **fixes verified** — all present and internally consistent; task counts
(4 Phase-3 tasks, 21 total, `0/21`, `21/21`), ST numbering (contiguous ST-1…ST-23), code fences,
and cross-references all clean; no stale filename, no stale required-field wording, no stale
version label, and no leftover `22`/`5` counts.

The scan surfaced three informational wording items, none contradicting any other statement:

1. `00-ambiguity-register.md` row 2 renders the phase as the shorthand `Phase <n> · <activity>`
   (the user-decision cell). Recorded as a deliberate shorthand — no change.
2. `00-ambiguity-register.md` note C said the sidebar "subscribes to `updated` first"; tightened
   to "subscribes to the events before requesting an initial `progress` snapshot".
3. `03-04-protocol-and-docs.md` README description "stale marker after 10 minutes" aligned to
   "at 10 minutes" (agrees at the ≥600 000 ms boundary).

Convergence: no unresolved 🔴/🟠; zero 🟡/🔵 remain open (all resolved and applied; the two
iteration-2 tightenings included). **PASSED WITH NOTES.**

## Verification Notes

- Every `file:line` reference in `02-current-state.md` §What Exists and the note evidence blocks
  was re-checked against the working tree by the lead; the corrected pointers match the installed
  SDK.
- The `bin/` packaging fact was verified mechanically (`npm pack --dry-run --json`): new
  `bin/lib/*.mjs` helpers ship via the existing glob.
- Unverifiable-from-installed-artifacts claims are explicitly flagged: host-side tool-input
  pre-validation (PF-025), events-ephemeral/backpressure (PF-026, inherited), JSON-Schema codec
  acceptance of nullable `type` arrays / `anyOf` (PF-027, decided by the ST-22 smoke), and the
  sidebar pane paint (user-assisted fallback per ST-22).
- Same-session authorship: the artifact was created in an earlier session today, not the current
  one; independence was provided by the cluster dispatches, the challenger, and the iteration-2
  verifier.

## Roadmap sync

`plans/00-roadmap.md` row `REQ-LIVE-TASK-PROGRESS` advanced to **Plan Preflighted** (🔬) with the
timestamp update. A BLOCKED outcome would not have advanced the row; this scan passed.

## Related documents

- Ambiguity Register: `00-ambiguity-register.md` (creation-time decisions; separate from this
  report). Findings PF-012/PF-013 corrected register notes B/H wording; the register's decisions
  themselves were not re-litigated.
