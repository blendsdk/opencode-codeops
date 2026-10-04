# Execution Plan: Specialist Agents

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-04 00:52
> **Progress**: 37/41 tasks (90%)
> **CodeOps Artifact Schema**: 1

## Overview

Deliver the specialist-agent capability across five phases: protocol and layout, deterministic
generation, check/removal/AGENTS.md sync, skill wiring and execution routing, then documentation
and final verification. The repository has no quality profile, so `[spec-author]` markers are
inert and the executing session writes the spec tests itself; specification-first ordering still
applies. All accepted preflight fixes (PF-001 … PF-032) are folded in; the durable finding record
is `00-preflight-report.md`.

**Commit mode (recorded intent, AR #23):** execute with `exec-plan specialist-agents
--auto-commit` (commit + push after each verified task). The commit-mode flag is supplied at
execution time; `make-plan` writes no commits. Manual scenarios (ST-34, ST-35, ST-43, ST-44) are
user-owned acceptance evidence and are never self-certified by the executor (PF-018).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Protocol and layout | 5 |
| 2 | Generation core | 9 |
| 3 | Check, removal, sync, and migration | 12 |
| 4 | Skill wiring and execution routing | 13 |
| 5 | Documentation and final verification | 2 |

**Total: 41 tasks across 5 phases** (no fabricated hour estimates — scope is bounded by the
task-size criteria in [quality-checklist.md](../../skills/make-plan/quality-checklist.md))

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for progress.
> Every task line appears exactly once in this document. The executing agent MUST:
>
> 1. **On implementation:** mark the task `[~]` with a timestamp —
>    `- [~] 1.1.1 Task description ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote it to `[x]` —
>    `- [x] 1.1.1 Task description ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** (`> **Progress**: X/Y tasks (Z%)`) and the Last Updated stamp
>    after EVERY task — never batch updates. Only `[x]` counts as complete.
> 4. **Resume** by scanning the phase sections top-to-bottom: the first `[~]` task is resumed
>    first, else the first `[ ]` task.
> 5. **On blocker:** mark the task `[!]` and append `Blocked: <short reason>` on the same line.
>    The plan lifecycle is `Ready`, `Executing`, `Done`, or `Blocked`, derived from these markers.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented. Failure to keep the marks
> current means progress is invisible after crashes, context resets, or session handoffs.

---

## Phase 1: Protocol and layout

> **Phase baseline tree**: 187e0be1875220cb9853f04f04facc4ab97c6fd9
> **Expected modification set** (strict scope): `scripts/specialist-content.spec.test.mjs`,
> `_shared/specialist-agents.md`, `_shared/layout-convention.md`, and this plan's progress marks.

### Step 1.1: Specification tests (content)

**Reference**: [03-01](03-01-specialist-protocol.md) §Detection criteria, §Routing layers · AR #6, #20, PF-001
**Objective**: Pin the protocol document's existence, stamp, and required clauses, and the layout path, before writing them. Link assertions are deferred to ST-32 in Phase 4.

- [x] 1.1.1 Write content spec tests ST-30 and ST-31 — `scripts/specialist-content.spec.test.mjs` ✅ (completed: 2026-10-04 00:52)
- [x] 1.1.2 Run the spec tests and verify they FAIL (red phase) ✅ (completed: 2026-10-04 00:53)

### Step 1.2: Implementation

**Reference**: [03-01](03-01-specialist-protocol.md) · AR #6, #7, #20
**Objective**: Author the canonical detection/routing/lifecycle protocol and register the specialists path.

- [x] 1.2.1 Write `_shared/specialist-agents.md` (criteria, disqualifiers, candidate packet, authority/budget per AR #24, routing layers, lifecycle, test hooks) ✅ (completed: 2026-10-04 00:53)
- [x] 1.2.2 Add `codeops/specialists/` to `_shared/layout-convention.md` (project-level, both layouts) ✅ (completed: 2026-10-04 00:53)
- [x] 1.2.3 Run the content spec tests and verify they PASS (green phase) ✅ (completed: 2026-10-04 00:54)

**Deliverables**:
- `_shared/specialist-agents.md` exists with the schema stamp and all required sections
- `codeops/specialists/` documented as layout-independent
- ST-30 and ST-31 pass

**Verify**: `npm run verify`

---

## Phase 2: Generation core

> **Phase baseline tree**: f44ee8ffdabc1d01291469f3e64ee3a6a36c1175
> **Expected modification set** (strict scope): `scripts/install_agents.spec.test.mjs`,
> `scripts/install_agents.impl.test.mjs`, `scripts/install_agents.py`,
> `agent-templates/domain-specialist-reviewer.md`, `agent-templates/domain-specialist-executor.md`,
> `schemas/codeops-config.schema.json`, `scripts/fixtures/catalog-executor.golden.md` (AR #25),
> `plans/specialist-agents/03-02-installer-and-templates.md` (spec wording correction, AR #26), and
> this plan's progress marks.

### Step 2.1: Specification tests (generation and validation)

**Reference**: [03-02](03-02-installer-and-templates.md) §Project brief, §Generated agent · AR #9, #10, #12, #13, #15, #19, PF-002, PF-009, PF-025
**Objective**: Define the observable behavior of `--custom` generation before implementing it.

- [x] 2.1.1 Write installer spec tests ST-1 … ST-16 and the catalog regression ST-42 (spawning `python3` with an overridden `CODEOPS_PLUGIN_ROOT`; ST-42 compares against the pre-refactor golden fixture per AR #25) — `scripts/install_agents.spec.test.mjs` ✅ (completed: 2026-10-04 01:00)
- [x] 2.1.2 Run the spec tests and verify they FAIL (red phase) ✅ (completed: 2026-10-04 01:00)

### Step 2.2: Implementation

**Reference**: [03-02](03-02-installer-and-templates.md) §Frontmatter rules, §Generated agent, §CLI surface · AR #12, #15, PF-006, PF-008, PF-010, PF-019, PF-024, PF-026
**Objective**: Parse and validate briefs, add the two templates and schema enum, and generate specialist agents deterministically with the existing plain-write pattern.

- [x] 2.2.1 Add the brief parser and validation to `scripts/install_agents.py` (fullmatch slug, reserved/built-in/DOS names, `schema`, `kind`, required fields, unknown keys, fixed-point sanitization, 16384-byte body cap, canonical paths, `from __future__ import annotations`) ✅ (completed: 2026-10-04 01:02)
- [x] 2.2.2 Add `agent-templates/domain-specialist-reviewer.md` and `agent-templates/domain-specialist-executor.md` with their contracts ✅ (completed: 2026-10-04 01:02)
- [x] 2.2.3 Add the `reasoning` enum to `routing.roles.<role>` in `schemas/codeops-config.schema.json` (before generation consumes it) ✅ (completed: 2026-10-04 01:02)
- [x] 2.2.4 Implement `--custom` generation: template by `kind`, quoted/escaped frontmatter, reasoning/effort/sandbox/model resolution, reviewer write clamp, marker, hand-authored refusal, no comma lists ✅ (completed: 2026-10-04 01:04)
- [x] 2.2.5 Run the spec tests and verify they PASS (green phase) ✅ (completed: 2026-10-04 01:04)

### Step 2.3: Implementation tests and hardening

**Reference**: [03-02](03-02-installer-and-templates.md) §Error handling, §Security · AR #17, #18
**Objective**: Cover parser, sanitization, and quoting boundaries.

- [x] 2.3.1 Write implementation tests for fixed-point sanitization, YAML quoting, parser edge cases (colons, CRLF, BOM), and idempotent writes — `scripts/install_agents.impl.test.mjs` ✅ (completed: 2026-10-04 01:07)
- [x] 2.3.2 Full verification ✅ (completed: 2026-10-04 01:07)

**Deliverables**:
- ST-1 … ST-16 and ST-42 pass; `--custom` generates valid reviewer and executor agents
- Brief validation rejects every documented invalid input without writing files
- Catalog regeneration is byte-identical (ST-42)

**Verify**: `npm run verify`

---

## Phase 3: Check, removal, sync, and migration

> **Phase baseline tree**: 3014e72036693d1ccbf8dd880de5d2fe31b3430f
> **Expected modification set** (strict scope): `scripts/install_agents.spec.test.mjs`,
> `scripts/install_agents.impl.test.mjs`, `scripts/install_agents.py`,
> `scripts/specialists-migration.spec.test.mjs` (new), `scripts/specialists-lifecycle.spec.test.mjs`
> (new), `scripts/codeops-migrate.sh`, and this plan's progress marks.

### Step 3.1: Specification tests (lifecycle)

**Reference**: [03-02](03-02-installer-and-templates.md) §`--check` semantics, §Removal, §AGENTS.md managed block · AR #11, #13, #14, PF-003, PF-004, PF-005, PF-014, PF-021
**Objective**: Define check/removal/sync behavior, including the file-state edge cases, before implementing it.

- [x] 3.1.1 Write installer spec tests ST-17 … ST-29 and ST-36 … ST-41 (plus the ST-6 AGENTS.md symlink sub-case, placed here because it needs `--sync-agents-md`) — `scripts/install_agents.spec.test.mjs` ✅ (completed: 2026-10-04 01:24)
- [x] 3.1.2 Run the spec tests and verify they FAIL (red phase) ✅ (completed: 2026-10-04 01:24)

### Step 3.2: Implementation

**Reference**: [03-02](03-02-installer-and-templates.md) §`--check` semantics, §Removal, §AGENTS.md managed block · AR #11, #13, #14, PF-004, PF-005, PF-006, PF-007, PF-014, PF-021, PF-022
**Objective**: Implement lifecycle modes with guardrails.

- [x] 3.2.1 Implement `--check` states: invalid brief, missing, stale, orphan, hand-authored collision, and AGENTS.md file/block/stale tokens ✅ (completed: 2026-10-04 01:27)
- [x] 3.2.2 Implement `--remove-custom`: create-path validation plus `domain-specialist-*` template guard, missing-agent/brief rules, index-first ordering, `--yes`, and automatic index sync ✅ (completed: 2026-10-04 01:27)
- [x] 3.2.3 Implement `--sync-agents-md`: absent-file creation, empty/no-newline/CRLF normalization, append/replace/remove, fixed-point sanitization, duplicate/reversed-marker refusal, overflow pointer, idempotence ✅ (completed: 2026-10-04 01:27)
- [x] 3.2.4 Run the spec tests and verify they PASS (green phase) ✅ (completed: 2026-10-04 01:27)

### Step 3.3: Implementation tests, migration, and lifecycle

**Reference**: [03-02](03-02-installer-and-templates.md) §Testing requirements · AR #17, PF-013, PF-017, PF-023
**Objective**: Harden lifecycle internals, protect migration, and prove the end-to-end lifecycle.

- [x] 3.3.1 Extend implementation tests for check/removal/sync internals — `scripts/install_agents.impl.test.mjs` ✅ (completed: 2026-10-04 01:31)
- [x] 3.3.2 Write the migration spec test ST-33 (dry-run **and** apply-mode preservation fixture) — `scripts/specialists-migration.spec.test.mjs` ✅ (completed: 2026-10-04 01:33)
- [x] 3.3.3 Implement the approved guard in `scripts/codeops-migrate.sh`: preserve a valid existing `codeops/codeops.json` byte-for-byte with a preview warning, and refuse before any move when it is malformed; never overwrite (PF-013, user-approved scope expansion) ✅ (completed: 2026-10-04 01:33)
- [x] 3.3.4 Run the migration spec test and verify it PASSES (green phase) ✅ (completed: 2026-10-04 01:33)
- [x] 3.3.5 Write the end-to-end lifecycle integration test — `scripts/specialists-lifecycle.spec.test.mjs` ✅ (completed: 2026-10-04 01:34)
- [x] 3.3.6 Full verification ✅ (completed: 2026-10-04 01:34)

**Deliverables**:
- ST-17 … ST-41 and ST-33 pass
- AGENTS.md updates are idempotent and never corrupt surrounding content
- Migration preserves committed routing policy; the lifecycle test passes

**Verify**: `npm run verify`

---

## Phase 4: Skill wiring and execution routing

> **Phase baseline tree**: 2b92d44fe9ae695a96499a45a27e76545c338287
> **Expected modification set** (strict scope): `scripts/specialist-content.spec.test.mjs`,
> `skills/make-plan/SKILL.md`, `skills/make-plan/templates.md`, `skills/make-requirements/SKILL.md`,
> `skills/analyze-project/SKILL.md`, `skills/setup-routing/SKILL.md`, `skills/setup-routing/routing.md`,
> `_shared/quality-profile.md`, `skills/exec-plan/SKILL.md`,
> `skills/exec-plan/execution-protocol.md`, `plans/specialist-agents/07-testing-strategy.md`,
> `plans/specialist-agents/03-01-specialist-protocol.md`, and this plan's progress marks.

### Step 4.1: Specification test (content)

**Reference**: [03-03](03-03-execution-routing.md) · AR #16, PF-001
**Objective**: Pin the routing and dispatch documentation before editing the skills.

- [x] 4.1.1 Write content spec test ST-32 (links, template section, quality-profile rules, exec-plan pointer, schema enum) — extend `scripts/specialist-content.spec.test.mjs` ✅ (completed: 2026-10-04 01:49)
- [x] 4.1.2 Run the spec test and verify it FAILS (red phase) ✅ (completed: 2026-10-04 01:49)

### Step 4.2: Implementation

**Reference**: [03-01](03-01-specialist-protocol.md) §Detection integration · [03-03](03-03-execution-routing.md) · AR #6, #7, #8, #16, PF-016
**Objective**: Wire detection into three skills, create the setup-routing flow, and connect exec-plan dispatch.

- [x] 4.2.1 Add the detection step to `skills/make-plan/SKILL.md` and the `## Specialist Agents` section to `skills/make-plan/templates.md` ✅ (completed: 2026-10-04 01:51)
- [x] 4.2.2 Add the detection step (including the AR #24 budget and recorded outcome) and register recording to `skills/make-requirements/SKILL.md` ✅ (completed: 2026-10-04 01:51)
- [x] 4.2.3 Add specialization signals and managed-block preservation to `skills/analyze-project/SKILL.md` ✅ (completed: 2026-10-04 01:51)
- [x] 4.2.4 Add the creation/removal flow to `skills/setup-routing/SKILL.md` (including the routing-policy-first order and an explicit update of the "AGENTS.md receives only a concise instruction" stance at line 62) and document `reasoning` in `skills/setup-routing/routing.md` ✅ (completed: 2026-10-04 01:51)
- [x] 4.2.5 Add specialist resolution, the `SR` prefix, and fallback rules to `_shared/quality-profile.md` (including the stale line lists at `:15-16`, `:132`); add pointers in `skills/exec-plan/SKILL.md` and `skills/exec-plan/execution-protocol.md` (including `SR` at `:180`) ✅ (completed: 2026-10-04 01:51)
- [x] 4.2.6 Run the content spec test and verify it PASSES (green phase) ✅ (completed: 2026-10-04 01:51)

### Step 4.3: Manual scenarios (user-owned evidence)

**Reference**: [03-03](03-03-execution-routing.md) §Dispatch rules · AR #16, #19, #24, PF-018
**Objective**: Verify dispatch, fallback, and detection behavior that CI cannot execute. These
results are owned by the user and block Phase 5 completion until recorded.

- [x] 4.3.1 Execute manual scenario ST-34 (working-tree install in a scratch scope, restart, dispatch as an additional reviewer; record the active model's `reasoningEffort` result) and record the result in this plan ✅ (completed: 2026-10-04 02:20)

> **ST-34 evidence (user session `ses_efbbbfc2affeyu13QFl464wFf8`, fixture `/tmp/opencode/specialist-acceptance`):**
> Phase 1 executed and verified (both tasks `[x]`, `slugify.mjs` created). The post-phase step
> dispatched `correctness-reviewer` **and** `pg-migration-reviewer`
> (`[codeops-dispatch agent=pg-migration-reviewer feature=acceptance-check phase=1]`); the
> specialist completed read-only with "Findings: **no findings**" and an independent verify
> re-run, so no `SR-NNN` items were triggered. The generated agent carries
> `reasoningEffort: max` and the active model accepted it (no override recorded). Standard gate
> (correctness review + verify) ran unchanged.
- [ ] 4.3.2 Execute manual scenario ST-35 (session started before creation; confirm fallback and reporting) and record the result in this plan
- [ ] 4.3.3 Execute manual scenario ST-43 (negative detection outcome and the two-candidate cap) and record the result in this plan
- [ ] 4.3.4 Execute manual scenario ST-44 (gap-bearing project: CodeOps asks for approval through the gate, then `setup-routing` creates the specialist; nothing is created before approval) and record the result in this plan
- [ ] 4.3.5 Full verification

**Deliverables**:
- Participating skills link to `_shared/specialist-agents.md`; `make-plan` records a `Specialist Agents` outcome always
- ST-32 passes; ST-34, ST-35, ST-43, and ST-44 results recorded as user-owned acceptance evidence
- No gate, reviewer count, or catalog-agent behavior changes

**Verify**: `npm run verify`

---

## Phase 5: Documentation and final verification

> **Phase baseline tree**: 6fb678c3aa0a24ef4a23a527820c9b5c7e99eb5c
> **Expected modification set** (strict scope): `README.md` and this plan's progress marks.

### Step 5.1: Documentation

**Reference**: [Index](00-index.md) §Related Files · AR #10, PF-032
**Objective**: Document the specialist workflow and finalize verification.

- [x] 5.1.1 Update `README.md` (detection, creation, routing, fallback; agent-model notes; upgrade note that template changes make custom agents STALE until `--custom` re-runs) ✅ (completed: 2026-10-04 02:03)
- [x] 5.1.2 Run the Phase 3 quality checklist against this plan and full verification ✅ (completed: 2026-10-04 02:03)

**Phase 5 checklist result:** completeness, granularity, dependencies, testing,
specification-first ordering, no-dead-code, security-first, zero-ambiguity, execution-plan
completeness, reference-don't-restate, and format blocks all verified against the executed plan.
`npm run verify` passing (169 tests); plan parser `Executing, 40 tasks, no problems`; roadmap sync
check clean.

**Deliverables**:
- README describes detection, creation, routing, fallback, and the upgrade note
- Quality checklist complete; no dead code or unresolved findings
- Documentation updated (CHANGELOG and version are owned by the release tool)

**Verify**: `npm run verify`

---

## Phase Review Log

Review evidence lives here; severities follow the preflight scale.

| Phase | Reviewer(s) | Findings | Rulings | Evidence |
| ----- | ----------- | -------- | ------- | -------- |
| 1 | correctness-reviewer (strict defaults) | RV-1…RV-3 🟡 minor, RV-4…RV-5 🔵 observation | RV-1…RV-4 fixed as a follow-up commit; RV-5 is a forward reference landed by ST-32 in Phase 4 | phase diff vs `187e0be`; `npm run verify` 92 tests |
| 2 | correctness-reviewer + security-auditor (strict defaults; security selected) | SA-001…SA-002 🟠 major, SA-003…SA-007 🟡 minor, RV-1…RV-7 🟡/🔵 | User ruled 2026-10-04: SA-001 full containment fix, SA-002 validate+escape. Fixes applied for SA-001/002/004/005/006/007 and RV-2…RV-7; SA-003 declined (body markers are inert — confirmed by re-review; stripping would destroy legitimate Markdown HTML comments); RV-1 recorded as AR #26. One scoped re-review: all fixes verified, observation SA-R1-001 (sandbox enum test) added | phase diff vs `f44ee8f`; fix diff vs `8f5263e`; `npm run verify` 129 tests |
| 3 | correctness-reviewer + security-auditor (strict defaults; security selected) | SA-001/RV-001 🟠 major (convergent); SA-002…SA-005 🟡/🔵; RV-002…RV-009 🟡 | User ruled 2026-10-04: SA-001 full containment fix. Fixes applied: removal parent-directory containment, migration refusal for symlinked/non-regular write targets, decode-safe marker check, invalid-brief orphan suppression, symlinked-AGENTS.md `STALE` state, dominant-newline handling, single blank-line separator, malformed-line message redaction, and the missing test pins (ST-21, PF-022 abort, trailing blank line, mixed endings, migration symlink). SA-005 declined (per-brief caps and a bounded 15-entry block; inputs are project-owned files). One scoped re-review verified every fix and reported SA-R3-001 (same-class residual: symlinked `codeops` parent redirects the migration); user ruled to fold the guard + test now — re-review scope closed without a third pass | phase diff vs `3014e72`; fix diff vs `5497e6a`; `npm run verify` 163 tests |

## Dependencies

```
Phase 1 (protocol/layout)
    ↓
Phase 2 (generation core)
    ↓
Phase 3 (check/removal/sync/migration)
    ↓
Phase 4 (skill wiring/routing)
    ↓
Phase 5 (docs/final verify)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ `npm run verify` passing with no regressions
3. ✅ No warnings/errors; no dead code
4. ✅ Security hardened — validation, traversal/symlink prevention, fixed-point sanitization, escaped output, read-only reviewer clamp
5. ✅ Documentation updated in the owning files
6. ✅ ST-1 … ST-42 pass; ST-34, ST-35, ST-43, and ST-44 recorded as user-owned results
