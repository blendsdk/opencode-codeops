# Execution Plan: Adaptive Reasoning Effort

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-04 13:08
> **Progress**: 18/24 tasks (75%)
> **CodeOps Artifact Schema**: 1

## Overview

Deliver adaptive reasoning effort across four phases: the shared contract and pure helper module,
the session state helper and plugin runtime override, plan integration, then the remaining skill
flags and documentation, ending with full verification. The repository has no quality profile, so
`[spec-author]` markers are inert and the executing session writes the specification tests itself;
specification-first ordering still applies. Manual scenarios MS-1…MS-4 in `07-testing-strategy.md`
are user-owned acceptance evidence and are never self-certified by the executor (AR #14).

**Commit mode:** the execution-time flag is supplied when `exec-plan` is invoked; `make-plan`
writes no commits.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Contract and pure logic | 7 |
| 2 | Session helper and plugin runtime | 6 |
| 3 | Plan integration | 5 |
| 4 | Skill flags and documentation | 6 |

**Total: 24 tasks across 4 phases** (no fabricated hour estimates — scope is bounded by the
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

## Phase 1: Contract and pure logic

> **Phase baseline tree**: `9dfe6375b6d7ffac04a19b9b3b762698dcaea751` (strict scope)
> **Expected modification set** (strict scope): `bin/reasoning-effort.spec.test.mjs`,
> `scripts/reasoning-effort-content.spec.test.mjs`, `_shared/reasoning-effort.md`,
> `bin/lib/reasoning-effort.mjs`, `bin/lib/reasoning-effort.d.mts`,
> `bin/reasoning-effort.impl.test.mjs`, and this plan's progress marks.

### Step 1.1: Specification tests (module and contract)

**Reference**: [03-01](03-01-reasoning-effort-contract.md) · [03-02](03-02-plugin-runtime-override.md) §Helper module · AR #4, #9, #12, #13, #14, #15, #16
**Objective**: Pin the observable parsing, precedence, routing, application, and state-read behavior, plus the contract document's required clauses, before writing either.

- [x] 1.1.1 Write lib specification tests ST-1 … ST-19 — `bin/reasoning-effort.spec.test.mjs` ✅ (completed: 2026-10-04 12:44)
- [x] 1.1.2 Write the contract content test ST-24 — `scripts/reasoning-effort-content.spec.test.mjs` ✅ (completed: 2026-10-04 12:45)
- [x] 1.1.3 Run the spec tests and verify they FAIL (red phase) ✅ (completed: 2026-10-04 12:45)

### Step 1.2: Implementation

**Reference**: [03-01](03-01-reasoning-effort-contract.md) §Levels–§Suggestion-only · [03-02](03-02-plugin-runtime-override.md) §Helper module · AR #1, #4, #8, #9, #12, #13, #14, #16
**Objective**: Author the shipped contract and the pure helper module that the plugin consumes.

- [x] 1.2.1 Write `_shared/reasoning-effort.md` (levels, marker grammar, precedence, skill table, derivation rules, auto-effort semantics, suggestion-only guarantee) ✅ (completed: 2026-10-04 12:46)
- [x] 1.2.2 Write `bin/lib/reasoning-effort.mjs` and `bin/lib/reasoning-effort.d.mts` (exports per 03-02 §Helper module; imports `sessionTmpDir` from `tmp-hygiene.mjs`; no casts; JSDoc) ✅ (completed: 2026-10-04 12:47)
- [x] 1.2.3 Run the spec tests and verify they PASS (green phase) ✅ (completed: 2026-10-04 12:49)

### Step 1.3: Implementation tests and hardening

**Reference**: [03-02](03-02-plugin-runtime-override.md) §Helper module, §Edge Cases · AR #15, #16
**Objective**: Harden the helper against malformed and hostile inputs before the plugin depends on it.

- [x] 1.3.1 Write implementation tests for the internal edges listed in [07](07-testing-strategy.md) §Implementation Tests — `bin/reasoning-effort.impl.test.mjs` ✅ (completed: 2026-10-04 12:48)

**Deliverables**:
- `_shared/reasoning-effort.md` exists with the schema stamp and all contract sections
- `bin/lib/reasoning-effort.mjs` exports the documented API with no thrown errors on bad input
- ST-1 … ST-19 and ST-24 pass; implementation-test edges pass

**Verify**: `npm run verify`

---

## Phase 2: Session helper and plugin runtime

> **Phase baseline tree**: `bebf78cbb7383a1cd3dbe8c99595800971c94763` (strict scope)
> **Expected modification set** (strict scope): `scripts/effort.spec.test.mjs`,
> `scripts/reasoning-effort-content.spec.test.mjs`, `scripts/codeops_effort.py`, `plugin/index.ts`,
> and this plan's progress marks.

### Step 2.1: Specification tests (CLI and plugin wiring)

**Reference**: [03-02](03-02-plugin-runtime-override.md) §CLI helper, §Plugin wiring · AR #5, #11, #15, #16
**Objective**: Pin the CLI commands, validation exits, path safety, and plugin hook presence before implementing them.

- [x] 2.1.1 Write CLI specification tests ST-20 … ST-23 — `scripts/effort.spec.test.mjs` (spawn `python3` with an overridden `TMPDIR`) ✅ (completed: 2026-10-04 12:53)
- [x] 2.1.2 Append the plugin wiring content guard ST-25 to `scripts/reasoning-effort-content.spec.test.mjs` ✅ (completed: 2026-10-04 12:54)
- [x] 2.1.3 Run the tests and verify they FAIL (red phase) ✅ (completed: 2026-10-04 12:55)

### Step 2.2: Implementation

**Reference**: [03-02](03-02-plugin-runtime-override.md) §Plugin wiring, §Session state file, §Failure handling · AR #3, #10, #11, #15, #16
**Objective**: Implement the atomic session-state CLI and wire the two plugin hooks with fail-open behavior.

- [x] 2.2.1 Implement `scripts/codeops_effort.py` (set/clear/status, level allowlist, temp-root path guard, atomic temp-file + `os.replace`) ✅ (completed: 2026-10-04 12:56)
- [x] 2.2.2 Wire `plugin/index.ts`: `chat.message` captures the marker into a session-keyed map; `chat.params` resolves marker → session file → routing config and applies via `applyEffort`; `session.deleted` clears marker entries; every hook body catches and logs a content-free warning ✅ (completed: 2026-10-04 12:58)
- [x] 2.2.3 Run the tests and verify they PASS (green phase), including `npx tsc --noEmit` ✅ (completed: 2026-10-04 13:00)

**Deliverables**:
- `scripts/codeops_effort.py` performs set/clear/status with the documented exits and no writes outside the CodeOps temp root
- `plugin/index.ts` registers `chat.message` and `chat.params`, never throws, and logs no prompt content
- ST-20 … ST-23 and ST-25 pass; type-check clean

**Verify**: `npm run verify`

---

## Phase 3: Plan integration

> **Phase baseline tree**: `cfeb8d4f39d50aabca6dad08f698df8910029264` (strict scope)
> **Expected modification set** (strict scope): `scripts/reasoning-effort-content.spec.test.mjs`,
> `skills/make-plan/templates.md`, `skills/make-plan/SKILL.md`,
> `skills/exec-plan/execution-protocol.md`, `skills/exec-plan/SKILL.md`, and this plan's progress
> marks.

### Step 3.1: Specification tests (plan documents)

**Reference**: [03-03](03-03-plan-skill-integration.md) §make-plan, §exec-plan · AR #2, #3, #6, #12
**Objective**: Pin the phase suggestion line, the dispatch marker rule, the inline suggestion, and the flag section before editing the skills.

- [x] 3.1.1 Append content tests ST-26 and ST-27 to `scripts/reasoning-effort-content.spec.test.mjs` ✅ (completed: 2026-10-04 13:03)
- [x] 3.1.2 Run the tests and verify they FAIL (red phase) ✅ (completed: 2026-10-04 13:03)

### Step 3.2: Implementation

**Reference**: [03-03](03-03-plan-skill-integration.md) §make-plan, §exec-plan · [03-01](03-01-reasoning-effort-contract.md) §Plan suggestion derivation, §Auto-effort option
**Objective**: Make plans carry advisory effort, and make exec-plan resolve and report it.

- [x] 3.2.1 Update `skills/make-plan/templates.md` (phase header `> **Reasoning**:` line) and `skills/make-plan/SKILL.md` (mini-plan shape, derivation reference, `--auto-effort` section) ✅ (completed: 2026-10-04 13:04)
- [x] 3.2.2 Update `skills/exec-plan/execution-protocol.md` (marker in every packet, applied-level reporting, inline suggestion and session behavior) and `skills/exec-plan/SKILL.md` (`--auto-effort` option section) ✅ (completed: 2026-10-04 13:04)
- [x] 3.2.3 Run the tests and verify they PASS (green phase) ✅ (completed: 2026-10-04 13:04)

**Deliverables**:
- Phase template and mini-plan shape carry the `> **Reasoning**:` line
- exec-plan packets carry `[codeops-effort: <level>]` when a phase suggestion exists and report the applied level; inline phases print the suggestion
- ST-26 and ST-27 pass

**Verify**: `npm run verify`

---

## Phase 4: Skill flags and documentation

> **Phase baseline tree**: _(recorded by the exec-plan skill)_
> **Expected modification set** (strict scope):
> `scripts/reasoning-effort-content.spec.test.mjs`, `skills/make-requirements/SKILL.md`,
> `skills/preflight/SKILL.md`, `skills/grill-me/SKILL.md`,
> `skills/retro-requirements/SKILL.md`, `skills/upgrade-plan/SKILL.md`,
> `skills/setup-routing/SKILL.md`, `skills/setup-routing/routing.md`,
> `_shared/quality-profile.md`, `README.md`, and this plan's progress marks.

### Step 4.1: Specification tests (skills and docs)

**Reference**: [03-01](03-01-reasoning-effort-contract.md) §Skill recommendation table · [03-03](03-03-plan-skill-integration.md) §Documentation · AR #5, #7, #8, #23
**Objective**: Pin the required flag sections and documentation clauses before editing them.

- [ ] 4.1.1 Append content tests ST-28 and ST-29 to `scripts/reasoning-effort-content.spec.test.mjs`
- [ ] 4.1.2 Run the tests and verify they FAIL (red phase)

### Step 4.2: Implementation

**Reference**: [03-03](03-03-plan-skill-integration.md) §Skills that accept `--auto-effort`, §Documentation · AR #3, #5, #7, #8, #23
**Objective**: Add the flag to the five remaining skills and publish the user-facing documentation.

- [ ] 4.2.1 Add the `--auto-effort` option section (per 03-01 table) to `skills/make-requirements/SKILL.md`, `skills/preflight/SKILL.md`, `skills/grill-me/SKILL.md`, `skills/retro-requirements/SKILL.md`, and `skills/upgrade-plan/SKILL.md`
- [ ] 4.2.2 Update `skills/setup-routing/routing.md` (Reasoning effort policy), `skills/setup-routing/SKILL.md`, `_shared/quality-profile.md` (link to the shared contract), and `README.md` (Adaptive reasoning effort subsection)
- [ ] 4.2.3 Run the tests and verify they PASS (green phase)

**Deliverables**:
- All seven skills parse `--auto-effort[=<level>]` per the shared contract
- README, routing guidance, and the quality profile document the feature with no restated precedence
- ST-28 and ST-29 pass

**Verify**: `npm run verify`

### Step 4.3: Final verification

**Reference**: [07](07-testing-strategy.md) §Verify Command · AR #22
**Objective**: Confirm the complete feature on the final worktree.

- [ ] 4.3.1 Run the full verify command and confirm every suite and the version parity check pass

**Deliverables**:
- `npm run verify` exits 0 with all suites passing
- Manual scenarios MS-1 … MS-4 are handed to the user as acceptance evidence (never self-certified)
- No code comment or doc comment cites this plan, `codeops/`, or any RD/AR/ST identifier

**Verify**: `npm run verify`

---

## Dependencies

```
Phase 1 (contract + helper)
    ↓
Phase 2 (CLI + plugin wiring)
    ↓
Phase 3 (plan integration)
    ↓
Phase 4 (skill flags + documentation + final verification)
```

Phase 3 and Phase 4 touch disjoint files but both depend on Phase 2's verified runtime; they run
sequentially for simple progress tracking.

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed and all 24 tasks `[x]`
2. ✅ `npm run verify` passes (type-check, tests, version parity)
3. ✅ A dispatch marker overrides an inherited parent `max` variant at runtime (manual MS-1)
4. ✅ `--auto-effort` applies and clears a run-scoped session level (manual MS-2)
5. ✅ Routing role defaults apply only when explicitly configured (manual MS-3)
6. ✅ Unsupported levels and malformed inputs fail open without provider errors (ST-14, manual MS-4)
7. ✅ No gate, permission, reviewer count, or verification step depends on effort
8. ✅ Documentation updated (`README.md`, `_shared/reasoning-effort.md`,
   `skills/setup-routing/routing.md`, `_shared/quality-profile.md`)
9. ✅ No dead code; no code comment or doc comment references planning artifacts

---

## Phase Quality Reviews

### Phase 1 — Contract and pure logic (2026-10-04)

| Item | Result |
| ---- | ------ |
| Dispatch | Fallback generic packets run in parallel: phase reviewer + security auditor (the catalog reviewer agents are manual-invocation-only in this session); fallback reported |
| Diff basis | Phase baseline tree `9dfe6375…` → HEAD; product files verified against the tree blobs |
| Findings | RV-001 (MINOR) `resolveEffort(null)` threw; RV-002 (MINOR) contract doc omitted the no-variants passthrough; RV-003 (MINOR) constructor-key test gap; SA-001 (MINOR) same totality issue as RV-001 |
| Disposition | All fixed as necessary corrections: input guard in the helper, one contract sentence, two new tests; `npm run verify` 242/242 green; no re-review required (no critical/major findings) |

### Phase 2 — Session helper and plugin runtime (2026-10-04)

| Item | Result |
| ---- | ------ |
| Dispatch | Fallback generic packets run in parallel: phase reviewer + security auditor (catalog reviewer agents manual-invocation-only); fallback reported |
| Diff basis | Phase baseline tree `bebf78cb…` → HEAD; hook signatures re-checked against the installed plugin types |
| Findings | RV-001 (MINOR) `session.deleted` cleanup catch did not log; RV-002 (MINOR) Progress header was stale; RV-003 (MINOR) phase-2 test names missed the should-when convention; RV-004 (MINOR) `clear`/`set` traced back on a directory at the state path; SA-001 (MINOR) a symlink loop escaped the path guard |
| Disposition | All fixed as necessary corrections: warning added, Progress header corrected, tests renamed, controlled exit 2 plus widened exception handling; `npm run verify` 247/247 green; no re-review required (no critical/major findings) |

### Phase 3 — Plan integration (2026-10-04)

| Item | Result |
| ---- | ------ |
| Dispatch | Fallback generic phase reviewer only; the diff is documentation-only, so the security and performance auditor skips are logged |
| Diff basis | Phase baseline tree `cfeb8d4f…` → HEAD |
| Findings | RV-001 (MINOR) the shared contract's absent-flag row did not name the exec-plan per-phase print; RV-002 (MINOR) inline step 3 did not state that a phase without a reasoning line leaves the session level unchanged |
| Disposition | Both fixed as necessary corrections (one contract row, one protocol sentence); `npm run verify` 249/249 green; no re-review required (no critical/major findings) |
