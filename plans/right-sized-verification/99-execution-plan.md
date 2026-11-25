# Execution Plan: Right-Sized Verification (Wave 1)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-11-25 02:56
> **Progress**: 21/31 tasks (68%)
> **CodeOps Artifact Schema**: 1

## Overview

Implements R1–R10 of [01-requirements.md](01-requirements.md). All spec tests are written first in
Phase 1 (one content spec file, one plugin spec file — AR-24, AR-27); each later phase turns its
own ST set green with a scoped green check (07 §Conventions). Every Task verify and gate line
names its expected-red remainder; `npm run verify` is fully green from Phase 6 (PF-001, PF-034).
Until Phase 5 the plugin spec file fails at file level (its import does not exist yet), not per
ST case.

**Commits:** behavior changes use `feat(<scope>)` so the release is MINOR (AR-25, PF-018);
Phase 1 uses `test(<scope>)`; tracking uses `chore(<scope>)`. The task 2.1.4 commit body states
that `quality.verificationTier` needs this release or later, because older installations reject
the property (PF-030).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Specification tests (red) | 4 |
| 2 | Verification tiers | 8 |
| 3 | Review calibration & refuter | 6 |
| 4 | Verification balance | 3 |
| 5 | Compaction note | 4 |
| 6 | Skill descriptions | 3 |
| 7 | Tracking & assessment | 3 |

**Total: 31 tasks across 7 phases**

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

## Phase 1: Specification tests (red)

> **Phase baseline tree**: cc8324732766ae285c862145bc6aba24984b93a1
> **Review**: reviewed 2026-11-25 00:24 — correctness review + one re-review; RV-001..RV-007 fixed (05-findings.md)
> **Reasoning**: high — the oracle for every later phase

### Step 1.1: Write, register, and red-check all spec tests

**Reference**: 07 (all ST-cases, §Conventions) · AR-24 · AR-27
**Objective**: The full oracle exists, is mapped, and fails before any implementation.

- [x] 1.1.1 [spec-author] Write `scripts/right-sized-verification-content.spec.test.mjs` from 07 ST-1..ST-16 and ST-23..ST-24, one flat `it("ST-<n> — …")` per case ✅ (completed: 2026-11-25 00:13)
- [x] 1.1.2 [spec-author] Write `plugin/compaction-note.spec.test.mjs` from 07 ST-17..ST-22 (imports `buildCompactionNote` from `bin/lib/codeops-progress.mjs`) ✅ (completed: 2026-11-25 00:12)
- [x] 1.1.3 Add the content spec file to the `content.guidance` run list in `codeops/test-map/content.json`; `node bin/codeops-test.mjs check --strict` passes ✅ (completed: 2026-11-25 00:12)
- [x] 1.1.4 Red check: run both spec files and record the result on this line — every case fails except ST-3 (the order statement already exists; the test guards it) ✅ (completed: 2026-11-25 00:12) — result: 23 fail (each on a missing token or export), ST-3 pass as expected

**Deliverables**:
- [x] Two spec files, mapped; red result recorded

**Task verify**: `node --test scripts/right-sized-verification-content.spec.test.mjs plugin/compaction-note.spec.test.mjs` (expected RED except ST-3)
**Verify (gate)**: `npm run verify` — expected red: ST-1, ST-2, ST-4..ST-24 only

---

## Phase 2: Verification tiers

> **Phase baseline tree**: c190a513ddcfa321e70790157b988a1a70bd54b9
> **Review**: reviewed 2026-11-25 00:32 — correctness review + one re-review; RV-001..RV-003 fixed (05-findings.md)
> **Reasoning**: high — changes the core planning contract

### Step 2.1: Tier definition, authoring, and review timing

**Reference**: 03-01 · AR-11..AR-15, AR-29, AR-30
**Objective**: Plans carry a tier that sizes ceremony and review timing.

- [x] 2.1.1 `_shared/spec-first-ordering.md`: `## Verification tiers` section, reworded order sentence, tier-aware REQUIRED list and compressed form (03-01 §Text changes) ✅ (completed: 2026-11-25 00:25)
- [x] 2.1.2 `skills/make-plan/SKILL.md`: hard rule `:169`, provisional/final tier, derivation and override (03-01 §Derivation) ✅ (completed: 2026-11-25 00:25)
- [x] 2.1.3 `skills/make-plan/templates.md` (tier line, `Review` line, 07 coverage rule, spec-first paragraph `:551-558`) and `skills/make-plan/quality-checklist.md` (`:41`, `:51`) (03-01 §Text changes) ✅ (completed: 2026-11-25 00:26)
- [x] 2.1.4 `schemas/codeops-config.schema.json`: `quality.verificationTier` (03-01 §Schema) ✅ (completed: 2026-11-25 00:26)
- [x] 2.1.5 `_shared/quality-profile.md`: activation rows `:78`, `:80`, `:81` and the standard trigger row (03-01 §Tier set) ✅ (completed: 2026-11-25 00:26)
- [x] 2.1.6 `skills/exec-plan/execution-protocol.md` post-phase step 1, `Review` line, completion review, `:182`, `:312`; `skills/exec-plan/SKILL.md` `:236-238` (03-01 §Review status line, §Error Handling) ✅ (completed: 2026-11-25 00:27)
- [x] 2.1.7 `skills/upgrade-plan/upgrade-checklists.md`: never derive a tier for an existing plan (03-01 §Derivation step 6) ✅ (completed: 2026-11-25 00:27)
- [x] 2.1.8 Green check: `node --test --test-name-pattern "^ST-[1-9]\b" scripts/right-sized-verification-content.spec.test.mjs` passes ✅ (completed: 2026-11-25 00:28)

**Deliverables**:
- [x] ST-1..ST-9 green

**Task verify**: `node --test --test-name-pattern "^ST-[1-9]\b" scripts/right-sized-verification-content.spec.test.mjs` (this and earlier phases' ST cases, all green) and `node bin/codeops-test.mjs run --gate task --baseline HEAD`, whose only allowed failures are the expected-red ST cases named on the gate line and, until Phase 5, `plugin/compaction-note.spec.test.mjs` as a whole file (its import fails at file level)
**Verify (gate)**: `npm run verify` — expected red: ST-10..ST-24 only

---

## Phase 3: Review calibration & refuter

> **Phase baseline tree**: 28237bf6bfd6c92f7a0dc8468d135bd971f5b4ed
> **Review**: reviewed 2026-11-25 00:43 — correctness review + agent-pipeline-reviewer + one re-review; RV-001..RV-004, RV-006, SR-001 fixed; RV-005 deferred to Phase 6 (05-findings.md)
> **Reasoning**: high — changes reviewer behavior
> **Specialist reviewer**: agent-pipeline-reviewer (00-index §Specialist Agents)

### Step 3.1: Calibration, refute mode, and gate wording

**Reference**: 03-02 · AR-6, AR-18..AR-20, AR-28
**Objective**: Fewer, challenged findings; no finding silently dismissed.

- [x] 3.1.1 `_shared/quality-profile.md`: `## Finding calibration`, calibration in the named reviewer packet rows (not `preflight-auditor`), `refute` packet row (03-02 §Calibration rules, §Refute mode) ✅ (completed: 2026-11-25 00:33)
- [x] 3.1.2 `agent-templates/phase-reviewer.md`: `Mode: refute` bullet with output contract and insufficiency rule; calibration reference (03-02 §Template and agent) ✅ (completed: 2026-11-25 00:34)
- [x] 3.1.3 Regenerate: `python3 scripts/install_agents.py --project . --roles correctness-reviewer`, copy `.opencode/agents/correctness-reviewer.md` to `agents/correctness-reviewer.md`, then `--check` (03-02 §Template and agent) ✅ (completed: 2026-11-25 00:34) — run with `CODEOPS_PLUGIN_ROOT=$(pwd)`: the session's variable points at the installed package, whose older template the generator would otherwise use
- [x] 3.1.4 `skills/exec-plan/execution-protocol.md` steps 3–4: calibration at merge, refute step, outcomes, ledger vocabulary, "dismissed silently" rewording (03-02 §Refute mode, §Error Handling) ✅ (completed: 2026-11-25 00:35)
- [x] 3.1.5 `skills/exec-plan/SKILL.md` finding gate `:249-254` and `skills/exec-plan/commit-modes.md` `:35-37`, `:86-87`: "Confirmed 🔴/🟠" (03-02 §Refute mode) ✅ (completed: 2026-11-25 00:35)
- [x] 3.1.6 Green check: `node --test --test-name-pattern "^ST-1[0-4]\b" scripts/right-sized-verification-content.spec.test.mjs` passes ✅ (completed: 2026-11-25 00:35)

**Deliverables**:
- [x] ST-10..ST-14 green; packaged agent matches the template (hygiene spec test)

**Task verify**: `node --test --test-name-pattern "^ST-([1-9]|1[0-4])\b" scripts/right-sized-verification-content.spec.test.mjs` (this and earlier phases' ST cases, all green) and `node bin/codeops-test.mjs run --gate task --baseline HEAD`, whose only allowed failures are the expected-red ST cases named on the gate line and, until Phase 5, `plugin/compaction-note.spec.test.mjs` as a whole file (its import fails at file level)
**Verify (gate)**: `npm run verify` — expected red: ST-15..ST-24 only

---

## Phase 4: Verification balance

> **Phase baseline tree**: 34b84043bcb9222dd371e900cd79e8a405d8412d
> **Verification balance**: 0 test / 22 product lines (0.0:1)
> **Review**: reviewed 2026-11-25 02:56 — correctness review; RV-001..RV-002 (minor) fixed (05-findings.md)
> **Reasoning**: medium — documented counting rule, no code

### Step 4.1: Report-only balance line

**Reference**: 03-03 · AR-5, AR-16, AR-17, AR-30
**Objective**: Every phase states its test-to-product balance.

- [x] 4.1.1 `skills/exec-plan/execution-protocol.md` post-phase step 1: classification, counts, balance line (03-03 §File classification, §Counts, §Output, §Error Handling) ✅ (completed: 2026-11-25 00:44)
- [x] 4.1.2 `skills/make-plan/templates.md`: `> **Verification balance**:` in the 99 phase header (03-03 §Text changes) ✅ (completed: 2026-11-25 00:45)
- [x] 4.1.3 Green check: `node --test --test-name-pattern "^ST-1[56]\b" scripts/right-sized-verification-content.spec.test.mjs` passes ✅ (completed: 2026-11-25 00:45)

**Deliverables**:
- [x] ST-15..ST-16 green

**Task verify**: `node --test --test-name-pattern "^ST-([1-9]|1[0-6])\b" scripts/right-sized-verification-content.spec.test.mjs` (this and earlier phases' ST cases, all green) and `node bin/codeops-test.mjs run --gate task --baseline HEAD`, whose only allowed failures are the expected-red ST cases named on the gate line and, until Phase 5, `plugin/compaction-note.spec.test.mjs` as a whole file (its import fails at file level)
**Verify (gate)**: `npm run verify` — expected red: ST-17..ST-24 only

---

## Phase 5: Compaction note

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Reasoning**: medium — small pure helper and one hook call

### Step 5.1: Helper, hook, and resume sentence

**Reference**: 03-05 · AR-22
**Objective**: A compacted run keeps its place.

- [ ] 5.1.1 `buildCompactionNote` in `bin/lib/codeops-progress.mjs` plus its declaration in `bin/lib/codeops-progress.d.mts` (03-05 §New function); ST-17..ST-22 pass
- [ ] 5.1.2 Push the note from the `compaction` hook in `plugin/index.ts` with try/catch (03-05 §Plugin change); `npx tsc --noEmit` passes
- [ ] 5.1.3 `skills/exec-plan/SKILL.md` resume rules: the compaction re-read sentence (03-05 §Skill change)
- [ ] 5.1.4 Write `plugin/compaction-note.impl.test.mjs` (07 §Implementation Tests); `npm run verify` — expected red: ST-23..ST-24 only

**Deliverables**:
- [ ] ST-17..ST-22 green; impl test green; type-check clean

**Task verify**: `node --test --test-name-pattern "^ST-([1-9]|1[0-6])\b" scripts/right-sized-verification-content.spec.test.mjs` (earlier phases' content ST cases, all green) plus `node --test plugin/compaction-note.spec.test.mjs plugin/compaction-note.impl.test.mjs` and `node bin/codeops-test.mjs run --gate task --baseline HEAD`, whose only allowed failures are the expected-red ST cases named on the gate line
**Verify (gate)**: `npm run verify` — expected red: ST-23..ST-24 only

---

## Phase 6: Skill descriptions

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Reasoning**: medium — text rewrite with fact-preservation check; runs after Phases 2, 3, 5 changed skill bodies

### Step 6.1: Rewrite descriptions

**Reference**: 03-04 · AR-21, AR-27
**Objective**: Trigger-only descriptions ≤500 characters.

- [ ] 6.1.1 Rewrite the descriptions of make-requirements, make-plan, exec-plan, preflight, grill-me, retro-requirements, roadmap, techdocs, setup-codeops; move any fact missing from a body into that body (03-04 §Rules)
- [ ] 6.1.2 Rewrite the descriptions of analyze-agents, analyze-project, clean-comments, git-commit, github-issues, organize-tests (single line, keeps `test-impact map`), outcome-review, setup-routing, upgrade-plan (03-04 §Rules)
- [ ] 6.1.3 Green check: ST-23..ST-24 pass; `npm run verify` fully green

**Deliverables**:
- [ ] ST-23..ST-24 green; full verify green

**Task verify**: `node bin/codeops-test.mjs run --gate task --baseline HEAD` — allowed failures: ST-23..ST-24 only, until 6.1.3; none after
**Verify (gate)**: `npm run verify`

---

## Phase 7: Tracking & assessment

> **Phase baseline tree**: _(recorded by exec-plan)_
> **Reasoning**: medium — bookkeeping and measurement

### Step 7.1: Roadmap, Wave 2 issue, assessment

**Reference**: 00-index §Assessment · AR-8, AR-23, AR-26
**Objective**: Track follow-up work and measure the result.

- [ ] 7.1.1 Confirm `plans/00-roadmap.md` shows `REQ-RIGHT-SIZED-VERIFICATION` at its final stage and `REQ-WAVE2-ENTRY-AND-FLOWS` at ⬜ Backlog (rows added at plan creation; AR-26)
- [ ] 7.1.2 Draft the Wave 2 GitHub issue (router + status CLI, lightweight change path, bug flow, converge pass; deferred list), show it to the user, and post it only after explicit approval (AR-8)
- [ ] 7.1.3 Assessment replay in `$CODEOPS_TMPDIR` (00-index §Assessment): replay `make-plan` for `live-task-sidebar`, answering from its original `00-ambiguity-register.md`; record the derived tier; produce it once as `standard` (config override if it derived `critical`) and once as `critical`; record the verification share of both against the baseline and confirm the critical replay keeps today's ordering; replay `fix-shared-reference-install` as the mini-plan control; delete the replay output

**Deliverables**:
- [ ] Roadmap rows; issue posted or withheld by the user; assessment recorded in 00-index

**Verify (gate)**: `npm run verify`; `node bin/codeops-test.mjs check --strict`; `python3 scripts/install_agents.py --project . --check`

---

## Dependencies

```
Phase 1 (oracle)
    ↓
Phase 2 → Phase 3 → Phase 4   (shared files: execution-protocol.md, quality-profile.md, templates.md)
    ↓
Phase 5 (independent of 2–4; ordered here)
    ↓
Phase 6 (after 2, 3, 5 changed skill bodies)
    ↓
Phase 7
```

Run sequentially; no parallel phases.

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ `npm run verify`, `node bin/codeops-test.mjs check --strict`, and `install_agents.py --check` pass
3. ✅ No warnings/errors
4. ✅ No dead code
5. ✅ No new script, agent, ledger file, or tool beyond the three test files and one test-map entry
6. ✅ Assessment recorded in 00-index
7. ✅ Code reviewed — every phase, under today's review rules
8. ✅ Post-completion project re-analysis (handled by the exec-plan skill)
