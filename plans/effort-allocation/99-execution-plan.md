# Execution Plan: Effort Allocation

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-11-24 01:10
> **Progress**: 21/39 tasks (54%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement RD-03 in four phases: vocabulary/flags (including the AR-9 test-map correction), provider
resolution and capability line, disclosure and specialist default, then documentation and final
verification. Each behavior phase follows spec tests → red → implementation → impl tests → gate.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
|-------|-------|-------|
| 1 | Vocabulary and Flags | 12 |
| 2 | Provider Resolution and Capability Line | 9 |
| 3 | Disclosure and Specialist Default | 11 |
| 4 | Documentation and Final Verification | 7 |

**Total: 39 tasks across 4 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for progress.
> Every task line appears exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark `[~]` with a timestamp —
>    `- [~] 1.1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`.
> 2. **On verify pass:** promote to `[x]` —
>    `- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`.
> 3. **Update the Progress header and Last Updated stamp after EVERY task.**
> 4. **Resume** at the first `[~]`, else the first `[ ]` task.
> 5. **On blocker:** mark `[!]` and append `Blocked: <short reason>`.

---

## Phase 1: Vocabulary and Flags

> **Phase baseline tree**: 5891062963ac43317c6547a2cc7825d34125c568
> **Reasoning**: high — changes the canonical vocabulary, helper, type declarations, and shared contract

### Step 1.1: Test-map correction (AR-9)

**Reference**: AR-9 · 03-01 §Scope
**Objective**: Make the test map own/ignore requirements documentation so the task gate is usable.

- [x] 1.1.1 Add `requirements/**` to `codeops/test-map/policy.json` `ignorePaths` with reason “requirements documentation” — `codeops/test-map/policy.json` ✅ (completed: 2026-11-24 00:58)
- [x] 1.1.2 Run `node bin/codeops-test.mjs check --strict` and `node --test scripts/test-selection-docs.spec.test.mjs`; confirm pass — ST-26, AR-9 ✅ (completed: 2026-11-24 00:59)

### Step 1.2: Specification tests

**Reference**: 07 §ST-1–ST-6 · 03-01
**Objective**: Write the vocabulary, marker, helper, and parity specs and confirm red.

- [x] 1.2.1 [spec-author] Write spec tests for five levels, marker, existing four, and parity — `bin/effort-vocabulary.spec.test.mjs` (ST-1–ST-6) ✅ (completed: 2026-11-24 00:59)
- [x] 1.2.2 [spec-author] Extend helper tests for `xhigh`, invalid level, and state file — `scripts/effort.spec.test.mjs` (ST-4, ST-5) ✅ (completed: 2026-11-24 00:59)
- [x] 1.2.3 Run the new specs and record the red-phase failure — `node --test bin/effort-vocabulary.spec.test.mjs scripts/effort.spec.test.mjs` ✅ (completed: 2026-11-24 00:59)

### Step 1.3: Implementation

**Reference**: 03-01 §Data and interfaces · AR-19, AR-24
**Objective**: Implement the five-level vocabulary and helper.

- [x] 1.3.1 Expand `EFFORT_LEVELS`, marker regex, `isEffortLevel`, and `EffortLevel` — `bin/lib/reasoning-effort.mjs`, `bin/lib/reasoning-effort.d.mts` ✅ (completed: 2026-11-24 00:59)
- [x] 1.3.2 Accept `xhigh` in the Python session helper — `scripts/codeops_effort.py` ✅ (completed: 2026-11-24 01:00)
- [x] 1.3.3 Update the level table, marker grammar, and flag examples in the shared contract; leave the skill/plan tables to Phase 3 — `_shared/reasoning-effort.md` ✅ (completed: 2026-11-24 01:00)
- [x] 1.3.4 Update skill `--auto-effort` flag text to list five levels — `skills/preflight/SKILL.md`, `skills/make-plan/SKILL.md`, `skills/exec-plan/SKILL.md` ✅ (completed: 2026-11-24 01:00)

### Step 1.4: Impl tests and phase gate

**Reference**: 07 §ST-1–ST-6 · 03-01 §Error handling
**Objective**: Cover edge cases and run the phase gate.

- [x] 1.4.1 Write impl tests for invalid markers, helper failure, and parity drift — `bin/effort-vocabulary.impl.test.mjs`, `scripts/effort.spec.test.mjs` ✅ (completed: 2026-11-24 01:01)
- [x] 1.4.2 Extend content tests for the five-level contract and skill text — `scripts/reasoning-effort-content.spec.test.mjs` ✅ (completed: 2026-11-24 01:01)
- [x] 1.4.3 Run task verify and the full phase gate — `npm run verify` ✅ (completed: 2026-11-24 01:01)

**Deliverables**:
- [x] Five levels accepted in JS, Python, types, and skill text ✅ (2026-11-24 01:09)
- [x] AR-9 map correction verified ✅ (2026-11-24 01:09)
- [x] All verification passing ✅ (2026-11-24 01:09)

**Test slices**: `bin.runtime`, `scripts.tooling`, `content.guidance` (07)
**Task verify**: `node bin/codeops-test.mjs run --gate task --baseline HEAD --include bin/effort-vocabulary.spec.test.mjs --include scripts/effort.spec.test.mjs --include scripts/reasoning-effort-content.spec.test.mjs`
**Verify (gate)**: `npm run verify`
**Verify**: `npm run verify`

---

## Phase 2: Provider Resolution and Capability Line

> **Phase baseline tree**: `340abbdb817bbee2b685a89111fdc7fd736f06ba`
> **Reasoning**: high — semantic resolver, max guard, and prompt-bound disclosure

### Step 2.1: Specification tests

**Reference**: 07 §ST-7–ST-19 · 03-02
**Objective**: Write provider fixtures, max-guard, no-variant, and capability-line specs; confirm red.

- [x] 2.1.1 [spec-author] Write provider fixtures for OpenAI/Anthropic/DeepSeek and fail-open sets — `bin/effort-provider.spec.test.mjs` (ST-7–ST-15) ✅ (completed: 2026-11-24 01:09)
- [x] 2.1.2 [spec-author] Write max-guard, no-variant, capability-line, dedupe, and sanitization specs — `bin/effort-provider.impl.test.mjs`, `plugin/effort-capability.spec.test.mjs` (ST-11–ST-19) ✅ (completed: 2026-11-24 01:09)
- [x] 2.1.3 Run the new specs and record the red-phase failure — `node --test bin/effort-provider.spec.test.mjs bin/effort-provider.impl.test.mjs plugin/effort-capability.spec.test.mjs` ✅ (completed: 2026-11-24 01:09)

### Step 2.2: Implementation

**Reference**: 03-02 §Resolution algorithm, §Capability line · AR-1, AR-3, AR-23–25
**Objective**: Implement the verified table, max guard, fail-open path, and capability line.

- [x] 2.2.1 Add the frozen provider table, resolver, max guard, and no-distant-jump rule — `bin/lib/reasoning-effort.mjs` ✅ (completed: 2026-11-24 01:07)
- [x] 2.2.2 Remove the raw `reasoningEffort` passthrough; return original options on no variant — `bin/lib/reasoning-effort.mjs` ✅ (completed: 2026-11-24 01:07)
- [x] 2.2.3 Pass `providerID`/`modelID`, add the deduped capability line, sanitize identifiers, and clear state on `session.deleted` — `plugin/index.ts` ✅ (completed: 2026-11-24 01:09)
- [x] 2.2.4 Update resolver type declarations — `bin/lib/reasoning-effort.d.mts` ✅ (completed: 2026-11-24 01:07)

### Step 2.3: Impl tests and phase gate

**Reference**: 07 §ST-11–ST-19 · 03-02 §Edge cases
**Objective**: Cover partial sets, malformed variants, dedupe, and session clearing.

- [x] 2.3.1 Write impl tests for partial sets, only-max, malformed variants, dedupe, and sanitization — `bin/effort-provider.impl.test.mjs`, `plugin/effort-capability.impl.test.mjs` ✅ (completed: 2026-11-24 01:10)
- [x] 2.3.2 Run task verify and the full phase gate — `npm run verify` ✅ (completed: 2026-11-24 01:10)

**Deliverables**:
- [x] Verified provider table and max guard ✅ (2026-11-24 01:10)
- [x] No raw passthrough ✅ (2026-11-24 01:10)
- [x] Capability line emitted once per changed tuple ✅ (2026-11-24 01:10)
- [x] All verification passing ✅ (2026-11-24 01:10)

**Test slices**: `bin.runtime`, `plugin.runtime` (07)
**Task verify**: `node bin/codeops-test.mjs run --gate task --baseline HEAD --include bin/effort-provider.spec.test.mjs --include bin/effort-provider.impl.test.mjs --include plugin/effort-capability.spec.test.mjs --include plugin/effort-capability.impl.test.mjs`
**Verify (gate)**: `npm run verify`
**Verify**: `npm run verify`

---

## Phase 3: Disclosure and Specialist Default

> **Phase baseline tree**: _(recorded by exec-plan at phase start)_
> **Reasoning**: high — cross-cutting header/report/installer compatibility
> **Specialist review**: `agent-pipeline-reviewer` (installer/generated-agent changes)

### Step 3.1: Specification tests

**Reference**: 07 §ST-20–ST-25 · 03-03
**Objective**: Write content and installer specs; confirm red.

- [ ] 3.1.1 [spec-author] Write content tests for the single header, preflight report, exec summary, templates, and setup-routing text — `scripts/effort-disclosure-content.spec.test.mjs` (ST-20–ST-22, ST-28)
- [ ] 3.1.2 [spec-author] Extend installer tests for `xhigh` default, version marker, legacy `max`, and versioned stale — `scripts/install_agents.spec.test.mjs` (ST-23–ST-25)
- [ ] 3.1.3 Run the new specs and record the red-phase failure — `node --test scripts/effort-disclosure-content.spec.test.mjs scripts/install_agents.spec.test.mjs`

### Step 3.2: Implementation

**Reference**: 03-03 §Dispatch header, §Preflight disclosure, §Specialist default · AR-2, AR-19, AR-22, AR-24
**Objective**: Implement disclosure and the specialist default.

- [ ] 3.2.1 Update the single dispatch header and mode-aware preflight-auditor packet — `_shared/quality-profile.md`
- [ ] 3.2.2 Update the shared skill/plan tables, preflight `--thorough` text, and report disclosure lines — `_shared/reasoning-effort.md`, `skills/preflight/SKILL.md`, `skills/preflight/report-format.md`
- [ ] 3.2.3 Update exec-plan session summary disclosure — `skills/exec-plan/execution-protocol.md`
- [ ] 3.2.4 Update make-plan Reasoning template and effort checklist item — `skills/make-plan/templates.md`, `skills/make-plan/quality-checklist.md`
- [ ] 3.2.5 Update setup-routing effort/diversity/specialist text — `skills/setup-routing/SKILL.md`, `skills/setup-routing/routing.md`
- [ ] 3.2.6 Implement the `xhigh` default, the post-frontmatter version marker, and the legacy `max` check — `scripts/install_agents.py`

### Step 3.3: Impl tests and phase gate

**Reference**: 07 §ST-20–ST-25 · 03-03 §Error handling
**Objective**: Cover disclosure and installer edge cases; run the phase gate.

- [ ] 3.3.1 Write impl tests for disclosure omission, legacy marker, and versioned stale cases — `scripts/effort-disclosure-content.spec.test.mjs`, `scripts/install_agents.spec.test.mjs`
- [ ] 3.3.2 Run task verify and the full phase gate — `npm run verify`

**Deliverables**:
- [ ] One header contract and disclosure surfaces
- [ ] New specialist default `xhigh`; legacy `max` accepted
- [ ] setup-routing and template text updated
- [ ] All verification passing

**Test slices**: `scripts.tooling`, `content.guidance` (07)
**Task verify**: `node bin/codeops-test.mjs run --gate task --baseline HEAD --include scripts/effort-disclosure-content.spec.test.mjs --include scripts/install_agents.spec.test.mjs`
**Verify (gate)**: `npm run verify`
**Verify**: `npm run verify`

---

## Phase 4: Documentation and Final Verification

> **Phase baseline tree**: _(recorded by exec-plan at phase start)_
> **Reasoning**: medium — documentation and final gate; no new behavior

### Step 4.1: Documentation

**Reference**: 03-03 §Documentation · RD-03 FR-18
**Objective**: Publish the user-facing documentation and changelog.

- [ ] 4.1.1 Update README with five levels, max guard, provider table, optional diversity, and specialist default — `README.md`
- [ ] 4.1.2 Add the behavior change to CHANGELOG — `CHANGELOG.md`
- [ ] 4.1.3 Run `install_agents.py --check`; confirm legacy `max` is accepted and no hand-authored file changes — `scripts/install_agents.py`

### Step 4.2: Final verification

**Reference**: 07 §Verify commands · 03-03 §Acceptance
**Objective**: Run the full gate and confirm the plan is complete.

- [ ] 4.2.1 Run `npm run verify` — full typecheck, tests, and version parity
- [ ] 4.2.2 Run `node bin/codeops-test.mjs check --strict` and `node bin/codeops-test.mjs run --gate phase --baseline HEAD`
- [ ] 4.2.3 Review changed docs for stale four-level statements and confirm ST-27 — `README.md`, `_shared/reasoning-effort.md`, `skills/setup-routing/routing.md`
- [ ] 4.2.4 Clean up verify logs and scratch; report `Cleanup: done` — `$CODEOPS_TMPDIR`

**Deliverables**:
- [ ] README and CHANGELOG updated
- [ ] Full gate green
- [ ] No stale four-level statements
- [ ] Cleanup complete

**Test slices**: `full` (07)
**Task verify**: `node bin/codeops-test.mjs run --gate task --baseline HEAD`
**Verify (gate)**: `npm run verify`
**Verify**: `npm run verify`

---

## Dependencies

```
Phase 1 (vocabulary + AR-9)
    ↓
Phase 2 (provider resolution)
    ↓
Phase 3 (disclosure + specialist)
    ↓
Phase 4 (docs + final gate)
```

---

## Success Criteria

1. ✅ All 39 tasks completed
2. ✅ `npm run verify` passes
3. ✅ Five levels accepted across JS, Python, types, skills, and docs
4. ✅ Max guard and fail-open behavior verified by fixtures
5. ✅ Capability line deduped, sanitized, and cleared on session deletion
6. ✅ New specialists default to `xhigh`; legacy `max` remains valid
7. ✅ Test map owns/ignores `requirements/**` and `check --strict` passes
8. ✅ No dead code, no raw passthrough, no secrets in disclosure
9. ✅ README/CHANGELOG updated
10. ✅ Post-completion re-analysis handled by exec-plan
