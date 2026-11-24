# Testing Strategy: Right-Sized Verification (Wave 1)

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

Every ST-case below has exactly one test; no percentage targets (AR-12). Test files are limited to
the three named in AR-24 / AR-27.

### Conventions (PF-001, PF-022, PF-023)

- **Test names.** Every test is a flat `it("ST-<n> — <behavior>")` so a phase can run its own
  cases with `--test-name-pattern`.
- **Content assertions.** Content ST-cases assert the backticked tokens, headings, and numeric
  literals named in the cited 03 section, after collapsing whitespace, case-insensitively;
  surrounding prose is free.
- **Folding rule.** A `description:` value is either an inline plain value (taken as-is) or a `>-`
  block (its indented lines trimmed and joined with single spaces). Any other shape fails. An
  inline plain value must not contain `: ` or ` #`.

## Test Slices & Groups

| Slice | Tier | Test Files | Sources | Depends On | Gate |
| ----- | ---- | ---------- | ------- | ---------- | ---- |
| `content.guidance` (run list gains the new file, task 1.1.3) and `scripts.tooling` | task | `scripts/right-sized-verification-content.spec.test.mjs` | `_shared/**`, `skills/**`, `agent-templates/**`, `agents/**`, `scripts/**` | — | task |
| `plugin.runtime` (via `bin.runtime`) | task | `plugin/compaction-note.spec.test.mjs`, `plugin/compaction-note.impl.test.mjs` | `bin/lib/codeops-progress.mjs`, `plugin/index.ts` | `bin.runtime` | task |

**Phase green check**: `node --test --test-name-pattern "^ST-(<phase ST numbers>)\b" <spec file>`
**Verify (gate)**: `npm run verify` — fully green from Phase 6 on; Phases 1–5 declare their
expected-red ST set in 99 (the plugin spec counts as red at file level until Phase 5).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

### Verification tiers — `scripts/right-sized-verification-content.spec.test.mjs` (Phase 2)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-1 | `_shared/spec-first-ordering.md` | Has heading `## Verification tiers` naming `standard` and `critical`; a plan without a tier line is `critical` | R1, AR-11, AR-14 |
| ST-2 | Same file | At `standard` the red check is inside the spec-test task; implementation tests only for error paths and edge cases named in ST-cases or 03 docs; the REQUIRED list and the compressed form state the distinct red-phase task for `critical` | R2, AR-12, PF-002 |
| ST-3 | Same file | Spec tests come before implementation, and the order is stated as never negotiable | R2 (guards against removal; expected green today) |
| ST-4 | `skills/make-plan/templates.md` | 00-index template has `> **Verification tier**:`; 99 phase header has `> **Review**:`; the 07 template section has no percentage target row and states every ST-case/acceptance criterion has ≥1 test; the spec-first paragraph names `critical` for the distinct red-phase task | R2, R3, R4, AR-12, PF-002 |
| ST-5 | `skills/make-plan/SKILL.md` | Names `quality.verificationTier`; the critical signals financial, security, distributed and concurrent, and migration/backfill of persisted data; a provisional and a final tier | R3, AR-13, AR-29, PF-015 |
| ST-6 | Parse `schemas/codeops-config.schema.json` | `quality.properties.verificationTier.enum` equals `["derived","standard","critical"]` | R3, AR-14 |
| ST-7 | `_shared/quality-profile.md` | Standard trigger: risk-tagged or `150` changed product lines; `carried forward`; the completion review; the tier changes when a diff is reviewed, not whether | R4, AR-4, AR-15, PF-004 |
| ST-8 | `skills/exec-plan/execution-protocol.md` and `skills/exec-plan/SKILL.md` | Protocol: the `> **Review**:` line with `reviewed` / `carried forward`; the completion review before done, push, or release; a missing or unknown tier is `critical`. SKILL: the per-phase review sentence mentions the tier | R4, AR-14, AR-15, PF-003, PF-005 |
| ST-9 | `skills/upgrade-plan/upgrade-checklists.md` | Contains `critical — pre-tier plan` | R3, PF-031 |

### Review calibration and refuter — same file (Phase 3)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-10 | `_shared/quality-profile.md` | Heading `## Finding calibration` with: test gap `MINOR` unless an ST-case/acceptance criterion is untested (`MAJOR`); the five not-findings (outside the changed lines, linter, hypothetical, re-proves, style); quoted rule for `standards`; complexity escalation for machinery; the packet table references `Finding calibration` and has a `refute` row | R6, AR-18, PF-009, PF-010 |
| ST-11 | `agent-templates/phase-reviewer.md` | `Mode: refute` with `Confirmed`, `Downgraded`, `Refuted`; references `Finding calibration` | R7, AR-19, AR-20, PF-029 |
| ST-12 | `agents/correctness-reviewer.md` | Contains `Mode: refute` (packaged agent regenerated) | R7, PF-013 |
| ST-13 | `skills/exec-plan/execution-protocol.md` | Calibration applied at merge; one refute dispatch per phase for 🔴/🟠 of any prefix; only `Confirmed` 🔴/🟠 stop; a downgrade to 🟠 still stops; refuted findings listed, ledgered as `refuted`, and reinstatable; refute failure → `Confirmed`; "dismissed silently" wording replaces "dismissed automatically" | R6, R7, AR-20, AR-28, PF-008, PF-016 |
| ST-14 | `skills/exec-plan/SKILL.md` and `skills/exec-plan/commit-modes.md` | The finding gate and both commit-mode pause rules say `Confirmed` | R7, PF-003 |

### Verification balance — same file (Phase 4)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-15 | `skills/exec-plan/execution-protocol.md` | `Verification balance` from added lines; test patterns `*.test.*`, `*_test.*`, `test_*`, `fixtures/`; excluded `plans/`, `requirements/`, `codeops/`, lockfiles, `dist/`; Markdown counted as product; `⚠️ above 1.5:1`; never blocks; `unavailable` case | R5, AR-16, AR-17, AR-30 |
| ST-16 | `skills/make-plan/templates.md` | 99 phase header has `> **Verification balance**:` | R5, AR-17 |

### Compaction note — `plugin/compaction-note.spec.test.mjs` (Phase 5)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-17 | `buildCompactionNote(null, "s1")` | `null` | R9, AR-22 |
| ST-18 | Run owned by `s2`, called for `s1` | `null` | R9, AR-22 |
| ST-19 | Run owned by `s1` with `activity: "done"` | `null` | R9, PF-011 |
| ST-20 | Run owned by `s1`, plan `p`, phase `2`, task `2.1.3`, activity `implementing` | Contains `plan "p"`, `phase "2"`, `task "2.1.3"`, `99-execution-plan.md`, `05-findings.md`; length ≤ 400 | R9, AR-22, PF-020 |
| ST-21 | Run owned by `s1` with 1,000-char plan/phase/task values containing line breaks and `"` | Length ≤ 400; no line break in the note | R9, PF-019 |
| ST-22 | Run owned by `s1` with `phase: null`, `task: null` | Contains `phase "—"` and `task "—"` | R9, 03-05 |

### Skill descriptions — same content file (Phase 6)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-23 | Every `skills/*/SKILL.md` `description`, folded | Starts with `Use when`; shape is inline plain or `>-`; an inline value has no `: ` or ` #` | R8, AR-21, PF-022 |
| ST-24 | Same | Length ≤ 500 characters | R8, AR-21 |

## Test Categories

### Specification Tests

| Test File | ST Cases Covered | Component |
|---|---|---|
| `scripts/right-sized-verification-content.spec.test.mjs` | ST-1..ST-16, ST-23..ST-24 | 03-01..03-04 |
| `plugin/compaction-note.spec.test.mjs` | ST-17..ST-22 | 03-05 |

### Implementation Tests

| Test File | Description | Priority |
|---|---|---|
| `plugin/compaction-note.impl.test.mjs` | Through the fake plugin context with a `tool.transform` capture (`plugin/progress-server.impl.test.mjs:77-83`): create a run by calling the captured progress tool's `execute(…, { sessionID })` (pattern at `:204`), then invoke the captured `compaction` hook; it pushes the standards first and the note second for the owning session, and no note without a run. No injection seam (PF-021, PF-037). | High |

## Test Data

### Fixtures Needed
None — snapshots and runs are built inline.

## Verification Checklist
- [ ] ST-1..ST-24 defined with concrete expectations and sources
- [ ] Spec tests written before implementation; red check recorded
- [ ] Each phase's ST set green at that phase's green check
- [ ] Implementation test for the plugin hook ordering
- [ ] `npm run verify`, `node bin/codeops-test.mjs check --strict`, and `install_agents.py --check` pass at the end
