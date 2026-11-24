# Current State: Right-Sized Verification (Wave 1)

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `_shared/spec-first-ordering.md` | Canonical spec-first ordering; line 64 "Small features (compressed form)"; "NEVER negotiable, regardless of feature size" | Add tier section (03-01) |
| `skills/make-plan/SKILL.md` | Plan creation; line 169 hard rule "Specification-first testing ordering is non-negotiable" | Tier derivation + recording (03-01); description (03-04) |
| `skills/make-plan/templates.md` | 00-index template (lines 43–116); 07 "Coverage Goals" 90/80/60 (lines 316–328); 99 phase header (lines 487–494) | Tier line, AC-based coverage, balance line (03-01, 03-03) |
| `skills/make-plan/quality-checklist.md` | Line 41 "Test coverage goals defined"; lines 43–51 spec-first block incl. "distinct red-phase task" | Tier-aware wording (03-01) |
| `_shared/quality-profile.md` | Activation rows `:78`, `:80`, `:81` (every non-trivial phase reviewed; docs-only still reviewed); packet table `:107-116` gives a profile excerpt only to phase-reviewer/security/perf; dispatch header `:92-104` is pinned by `effort-disclosure-content.spec.test.mjs` | Tier review timing (03-01); calibration, packet rows, refute row — header unchanged (03-02) |
| `skills/exec-plan/execution-protocol.md` | Post-phase quality step (lines 176–234): dispatch, merge, ledger, one re-review | Tier trigger, refute step, balance line (03-01..03-03) |
| `skills/exec-plan/SKILL.md` | Resume rules (`:153`); per-phase review sentence (`:236-238`); "Finding gate (load-bearing)" — every 🔴/🟠 pauses (`:249-254`) | Tier-aware review sentence (03-01); "Confirmed" gate (03-02); compaction re-read sentence (03-05); description (03-04) |
| `skills/exec-plan/commit-modes.md` | 🔴/🟠 pause rule (`:35-37`, `:86-87`) | "Confirmed 🔴/🟠" (03-02) |
| `skills/upgrade-plan/upgrade-checklists.md` | Adds missing plan sections against current templates | Never derive a tier for an existing plan (03-01) |
| `codeops/test-map/content.json` | `content.guidance` runs a fixed file list (no glob) | Add the new content spec file (07) |
| `agent-templates/phase-reviewer.md` | Reviewer contract; findings rules lines 43–48 | Calibration reference + refute mode (03-02) |
| `agents/correctness-reviewer.md` | Packaged copy of the agent generated from `phase-reviewer` (`ROLE_TO_TEMPLATE`, `scripts/install_agents.py:38`); the installer writes and checks only `.opencode/agents/` (gitignored); `scripts/hygiene-content.spec.test.mjs:139` checks the packaged body | Generate, copy, check (03-02); never hand-edit |
| `schemas/codeops-config.schema.json` | `quality` (line 20): `independentReview`, `minimumReviewers`, `stopOnMajorFinding`; `additionalProperties: false` | Add `verificationTier` (03-01) |
| `skills/*/SKILL.md` (18) | Folded descriptions 343–1,001 chars; 7 over 700; 9 inline plain, 9 `>-` blocks; most summarize workflow | Rewrite (03-04) |
| `bin/lib/codeops-progress.mjs` / `.d.mts` | `createCodeOpsProgress().snapshot()` (line 437) returns `CodeOpsRunState` `{plan, phase, task, sessionID, updatedAt, …}` or `null`; `isRunStale` (line 490) | Add pure `buildCompactionNote` (03-05) |
| `plugin/index.ts` | `compaction` hook (lines 308–310) pushes standards only; `progress` instance in scope | Push the note (03-05) |

### Code Analysis

- The Complexity Escalation Gate (`_shared/zero-ambiguity-gate.md:31–55`) already names "custom
  test harness, runner, generator, validator, policy gate" but exempts "tests that directly prove
  accepted behavior", so test volume accumulates without triggering it.
- `SessionCompaction` extends `SessionContext` (`node_modules/@opencode/plugin/dist/promise/session.d.ts:42`) and carries `sessionID`.
- Existing spec tests pin wording that this plan must keep: `scripts/organize-tests-content.spec.test.mjs:49`
  (`description: .*test-impact map`), `scripts/analyze-agents-content.spec.test.mjs:39`
  (non-empty description), `scripts/test-selection-content.spec.test.mjs:112`
  (`spec-first-ordering.md` links `test-selection.md`), and the severity triplet
  `CRITICAL…MAJOR…MINOR` (`analyze-agents-content.spec.test.mjs:119`).
- Spec test files are immutable: any edit to a `*.spec.test.*` file is a 🔴 CRITICAL review
  finding (`agent-templates/phase-reviewer.md:26–28`), hence AR-27.
- `CHANGELOG.md` is written by `scripts/release.mjs` from conventional commits; it is not
  hand-edited. It has no "Changed" group: AR-25's entry lands under "Features", and only a `feat`
  commit makes the release MINOR (`scripts/release.mjs:33-45`, `:131`).
- Agent regeneration precedent: commit `feca77d` changed `agent-templates/preflight-auditor.md`
  and updated `agents/preflight-auditor.md` in the same commit.
- Plan-file parsers (`scripts/codeops_plan.py`, `codeops_plan_migrate.py`, roadmap sync) read only
  `**Implements**`, the schema stamp, and task lines; new `>` header lines do not affect them.
- No test seam exists for making a plugin helper throw (no `mock.module` use; plain `node --test`).

## Gaps Identified

### Gap 1: No proportionality
**Current Behavior:** Every full-plan phase runs the same ceremony and review regardless of size.
**Required Behavior:** Standard and critical tiers (R1–R4).

### Gap 2: No cumulative view
**Current Behavior:** Nothing reports how much verification a phase added relative to product code.
**Required Behavior:** A per-phase balance line (R5).

### Gap 3: Review noise
**Current Behavior:** Every 🔴/🟠 finding stops for a ruling; test gaps are routinely raised.
**Required Behavior:** Calibrated findings and a refute pass (R6, R7).

### Gap 4: Descriptions summarize workflows; compaction loses place
**Required Behavior:** R8, R9.

## Dependencies

### Internal Dependencies
- `scripts/install_agents.py` (agent regeneration), `bin/codeops-test.mjs` (map check).

### External Dependencies
- None new.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Rewritten descriptions break an existing pinned phrase | Med | Low | Keep pinned phrases (Code Analysis); run full verify |
| Standard tier lets a defect escape | Low–Med | Med | Critical tier for risky lenses; refuter only filters, never adds risk; assessment in Phase 7 |
| Generated agent drifts from template | Low | Med | Regenerate in the same task; installer check |
| Plugin hook throws during compaction | Low | Med | Helper is pure; call wrapped in try/catch like the existing hooks |
