# Execution Plan: analyze-agents (specialist discovery)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-09 15:02
> **Progress**: 0/8 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Overview

Deliver the `analyze-agents` skill and its two records (findings ledger, check state) as
documented in 03-01 and 03-02, pin them with content spec tests, smoke them end to end, and
release the feature. **Prerequisite: T-07 (`plans/specialist-awareness/`) must be complete** — it
ships the proposal format, the state-file interface, and the `analyze-project` coverage line this
feature consumes.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Skill and protocol wiring | 3 |
| 2 | Findings ledger wiring (exec-plan) | 3 |
| 3 | Smoke and release | 2 |

**Total: 8 tasks across 3 phases** (no fabricated hour estimates — scope is bounded by the
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

---

## Phase 1: Skill and protocol wiring

> **Phase baseline tree**: _(recorded by the exec-plan skill from a temporary-index snapshot)_
> **Reasoning**: max — carries the AR #15 approved complexity machinery (skill + records), where a wrong contract propagates to every project check

### Step 1.1: Skill contract and shared protocol

**Reference**: 03-01 §Skill Contract · 03-02 §Check State · AR #1, #2, #4, #9, #10, #12, #13, #15
**Objective**: Pin and then implement the skill contract and the shared-protocol additions.

- [ ] 1.1.1 [spec-author] Write the content spec tests for ST-1 … ST-7 and ST-9 — `scripts/analyze-agents-content.spec.test.mjs` — and verify the red phase
- [ ] 1.1.2 Implement `skills/analyze-agents/SKILL.md`, the `_shared/specialist-agents.md` updates (ledger convention, check-state consumption, execution surface), and the detection delegation in `skills/make-plan/SKILL.md` and `skills/make-requirements/SKILL.md` (additive to T-07's edits; manual criteria fallback retained) — green on the new tests
- [ ] 1.1.3 Full verification: `npm run verify`

**Deliverables**:
- [ ] `skills/analyze-agents/SKILL.md` exists with the pinned contract
- [ ] `_shared/specialist-agents.md` carries the ledger/state/execution-surface sections
- [ ] `make-plan` and `make-requirements` detection steps name the `analyze-agents` flow
- [ ] All verification passing

**Verify**: `npm run verify`

---

## Phase 2: Findings ledger wiring (exec-plan)

> **Phase baseline tree**: _(recorded by the exec-plan skill from a temporary-index snapshot)_
> **Reasoning**: medium — one protocol edit with deterministic content assertions

### Step 2.1: Ruling step writes the ledger

**Reference**: 03-02 §Ledger · AR #3, #8
**Objective**: Concretize the undefined "durable finding artifact" into the per-plan ledger.

- [ ] 2.1.1 [spec-author] Extend the content tests with ST-8 (exec-plan ruling step writes `plans/<plan>/05-findings.md` rows; no undefined artifact reference) — verify the red phase
- [ ] 2.1.2 Implement the `skills/exec-plan/execution-protocol.md` ruling-step edits — green on the new tests
- [ ] 2.1.3 Full verification: `npm run verify`

**Deliverables**:
- [ ] The ruling step names the ledger path and row format
- [ ] All verification passing

**Verify**: `npm run verify`

---

## Phase 3: Smoke and release

> **Phase baseline tree**: _(recorded by the exec-plan skill from a temporary-index snapshot)_
> **Reasoning**: low — verification and release mechanics with deterministic outcomes

### Step 3.1: Live smoke and release

**Reference**: 07 §ST-11 · Acceptance Criteria §4–5
**Objective**: Prove the end-to-end behavior on a scratch repository, then release.

- [ ] 3.1.1 Live smoke (ST-11): recurrence candidate and `None` paths in scratch repositories; state file written both times; coverage line reads it
- [ ] 3.1.2 Full verification + minor release through the repo release flow (project release convention: every user-facing change ships in a version with CHANGELOG notes; T-07 bundles into this release), with notes covering the new skill and records

**Deliverables**:
- [ ] ST-11 result recorded
- [ ] Release published with notes

**Verify**: `npm run verify`

---

## Dependencies

```
T-07 (specialist-awareness) — proposal format, state interface, coverage line
    ↓
Phase 1 (skill + protocol)
    ↓
Phase 2 (ledger wiring)
    ↓
Phase 3 (smoke + release)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ All verification passing (`npm run verify`)
3. ✅ No dead code — no unused files, sections, or duplicated conventions
4. ✅ Security/privacy rules honored (local reads only; identifiers/areas only; no metrics writes)
5. ✅ Documentation updated (`_shared`, skills, CHANGELOG)
6. ✅ Code reviewed (post-phase quality step)
7. ✅ Post-completion project re-analysis (handled by the exec-plan skill)
