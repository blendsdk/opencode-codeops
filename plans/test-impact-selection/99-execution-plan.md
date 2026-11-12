# Execution Plan: Test Impact Selection

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-11-12 01:58
> **Progress**: 51/86 tasks (59%)
> **CodeOps Artifact Schema**: 1

## Overview

Deliver the opt-in test-impact layer in eight phases. Phase 1 is the lightweight plan-scoped task command and the conditional standards wording — it changes no runtime behavior for map-less projects. Phases 2–5 add the map, selector, CLI, branch policy, and provenance. Phase 6 adds the `organize-tests` adoption skill and shadow mode. Phase 7 adds advisory CI templates and the reusable full gate. Phase 8 documents, pilots in shadow mode, verifies, and prepares the release.

**Plan-local verification policy (AR-37):** each phase uses a targeted `**Verify**` command during implementation; a dedicated final task in each phase runs the full `npm run verify`. This keeps the feature's own development from paying the full suite per task while the feature does not yet exist. Spec tests are written first and must fail red.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| --- | --- | --- |
| 1 | Lightweight Scoped Verification | 12 |
| 2 | Test Map Model and Validation | 10 |
| 3 | Selector Core | 10 |
| 4 | CLI and Runner | 10 |
| 5 | Branch Policy, Plan, and Provenance | 9 |
| 6 | Organize Tests Skill and Adoption | 13 |
| 7 | CI and Release Integration | 10 |
| 8 | Documentation, Pilot, and Final Verification | 12 |

**Total: 86 tasks across 8 phases** (no fabricated hour estimates — scope is bounded by the task-size criteria in [quality-checklist.md](../../skills/make-plan/quality-checklist.md)).

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for progress. Every task line appears exactly once in this document. The executing agent MUST:
>
> 1. **On implementation:** mark the task `[~]` with a timestamp —
>    `- [~] 1.1.1 Task description ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote it to `[x]` —
>    `- [x] 1.1.1 Task description ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** (`> **Progress**: X/Y tasks (Z%)`) and the Last Updated stamp after EVERY task — never batch updates. Only `[x]` counts as complete.
> 4. **Resume** by scanning the phase sections top-to-bottom: the first `[~]` task is resumed first, else the first `[ ]` task.
> 5. **On blocker:** mark the task `[!]` and append `Blocked: <short reason>` on the same line. The plan lifecycle is `Ready`, `Executing`, `Done`, or `Blocked`, derived from these markers.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented. Failure to keep the marks current means progress is invisible after crashes, context resets, or session handoffs.

---

## Phase 1: Lightweight Scoped Verification

> **Phase baseline tree**: 34a0927cc1f7e9d7865d5c9adb1912c6685cb9bf
> **Reasoning**: high — changes the always-injected standards and four workflow skills; non-disruption is load-bearing.

### Step 1.1: Specification Tests

- [x] 1.1.1 Write content spec tests for the six prime directives, conditional standards wording, `_shared/test-selection.md`, spec-first phase-gate wording, conditional skill paths, and the expected-modification-set fallback — `scripts/test-selection-content.spec.test.mjs` (ST-49, ST-50, ST-51, ST-52) ✅ (completed: 2026-11-12 00:48)
- [x] 1.1.2 Run the new spec tests and confirm they fail red; record the failure tail — `node --test scripts/test-selection-content.spec.test.mjs` ✅ (completed: 2026-11-12 00:48)

### Step 1.2: Implementation

- [x] 1.2.1 Add the prime directives and conditional map/scoped-command wording to both standards files — `standards/coding-standards.md`, `standards/coding-standards-full.md` ✅ (completed: 2026-11-12 00:55)
- [x] 1.2.2 Write the canonical protocol with gate ladder, no-map contract, last-full marker, spec-test `--include`, explicit baseline, map overview, selection rules, evidence, and lightweight fallback; link the phase-gate wording from spec-first ordering — `_shared/test-selection.md`, `_shared/spec-first-ordering.md` ✅ (completed: 2026-11-12 00:55)
- [x] 1.2.3 Update plan authoring: optional test-slice table, `**Task verify**`, `**Verify (gate)**`, declared spec files for `--include`, authoring-time command proof/test count — `skills/make-plan/templates.md`, `skills/make-plan/SKILL.md`, `skills/make-plan/quality-checklist.md` ✅ (completed: 2026-11-12 00:55)
- [x] 1.2.4 Update execution: task/phase/release gates, red-phase command, explicit phase baseline, spec `--include`, expected-modification-set fallback, evidence, packets, old-plan behavior — `skills/exec-plan/SKILL.md`, `skills/exec-plan/execution-protocol.md`, `skills/exec-plan/commit-modes.md` ✅ (completed: 2026-11-12 00:55)
- [x] 1.2.5 Update the commit gate: scoped task command for normal commits, full for release/merge/push, no-map fallback — `skills/git-commit/SKILL.md` ✅ (completed: 2026-11-12 00:55)
- [x] 1.2.6 Update project analysis: detect map/scoped commands, preserve the `CODEOPS-TESTING` block byte-for-byte, warn on missing/stale block and missing full gate; never render it — `skills/analyze-project/SKILL.md` ✅ (completed: 2026-11-12 00:55)
- [x] 1.2.7 Add the `CODEOPS-TESTING` block contract (placement, `organize-tests` sole ownership, analyze-project preservation, no-map text) to the shared protocol or analyze-project reference — `_shared/test-selection.md`, `skills/analyze-project/SKILL.md` ✅ (completed: 2026-11-12 00:55)

### Step 1.3: Implementation Tests and Hardening

- [x] 1.3.1 Write content impl tests for old-plan fallback, absence of unconditional full-per-task wording, block preservation/ownership wording, the hygiene link, and no `${PLUGIN_ROOT}`/`.codex/` leaks — `scripts/test-selection-content.impl.test.mjs` ✅ (completed: 2026-11-12 00:55)
- [x] 1.3.2 Run targeted content tests and fix failures — `node --test scripts/test-selection-content.spec.test.mjs scripts/test-selection-content.impl.test.mjs` ✅ (completed: 2026-11-12 00:55)
- [x] 1.3.3 Full verification: `npm run verify`; record PASS and test count in the phase evidence — `npm run verify` ✅ (completed: 2026-11-12 00:55)

**Verify**: `node --test scripts/test-selection-content.spec.test.mjs scripts/test-selection-content.impl.test.mjs`

---

## Phase 2: Test Map Model and Validation

> **Phase baseline tree**: e682787b2eee093fae8ccb8d524cbc07eb51068e
> **Reasoning**: high — schema, merge, ownership, and validation define the safety boundary.

### Step 2.1: Specification Tests

- [x] 2.1.1 Write spec tests for map loading, single-file/directory/fragment merge, validation error codes, and canonical hash — `bin/test-map.spec.test.mjs` (ST-1..ST-10, ST-57, ST-63, ST-64, ST-65) ✅ (completed: 2026-11-12 01:05)
- [x] 2.1.2 Run the new spec tests and confirm red; record the failure — `node --test bin/test-map.spec.test.mjs` ✅ (completed: 2026-11-12 01:05)

### Step 2.2: Implementation

- [x] 2.2.1 Add the JSON Schema contract for policy, fragments, groups, branches, budgets, acceptance, `full` argv, `prSmoke`, `requirements`, per-slice `acceptance`, and `caseSensitive` — `schemas/test-map.schema.json` ✅ (completed: 2026-11-12 01:05)
- [x] 2.2.2 Implement map path resolution, policy loading, fragment merge, and canonicalization — `bin/lib/test-map.mjs` ✅ (completed: 2026-11-12 01:05)
- [x] 2.2.3 Implement validation, ownership/slice health checks, default severity/exit codes, target-based exemptions, `requirements` probes, and strict mode — `bin/lib/test-map-validate.mjs` ✅ (completed: 2026-11-12 01:05)
- [x] 2.2.4 Add Node, Rust (including an inline-only crate), custom, polyglot, and invalid fixtures — `bin/fixtures/test-selection/**` ✅ (completed: 2026-11-12 01:05)
- [x] 2.2.5 Add public type declarations for the model API — `bin/lib/test-map.d.mts`, `bin/lib/test-map-validate.d.mts` ✅ (completed: 2026-11-12 01:05)

### Step 2.3: Implementation Tests and Hardening

- [x] 2.3.1 Write impl tests for duplicate IDs, cycles, path traversal, empty groups, target-based exemptions, overlap, orphan tests, slice contract, `full` argv, `prSmoke`, `requirements`, per-slice acceptance, severity/exit codes, and hash determinism — `bin/test-map.impl.test.mjs` ✅ (completed: 2026-11-12 01:05)
- [x] 2.3.2 Run targeted map tests and strict validation fixtures; fix failures — `node --test bin/test-map.spec.test.mjs bin/test-map.impl.test.mjs` ✅ (completed: 2026-11-12 01:05)
- [x] 2.3.3 Full verification: `npm run verify`; record PASS and test count — `npm run verify` ✅ (completed: 2026-11-12 01:05)

**Verify**: `node --test bin/test-map.spec.test.mjs bin/test-map.impl.test.mjs`

---

## Phase 3: Selector Core

> **Phase baseline tree**: 35e5726b440da1a12f1eccef56425ccf8ae2553a
> **Reasoning**: high — the selection algorithm is the correctness core; a miss can hide tests.

### Step 3.1: Specification Tests

- [x] 3.1.1 Write spec tests for change detection, glob matching, direct/dependent/always-run selection, gate tiers, budget, threshold, and fallbacks — `bin/test-selection.spec.test.mjs` (ST-11..ST-25, ST-55, ST-56, ST-59, ST-60, ST-61) ✅ (completed: 2026-11-12 01:20)
- [x] 3.1.2 Run the new spec tests and confirm red; record the failure — `node --test bin/test-selection.spec.test.mjs` ✅ (completed: 2026-11-12 01:20)

### Step 3.2: Implementation

- [x] 3.2.1 Implement the minimal glob-to-regex matcher, path normalization, and Windows separator handling — `bin/lib/test-selection-glob.mjs` ✅ (completed: 2026-11-12 01:20)
- [x] 3.2.2 Implement change collection, explicit baseline resolution, last-full marker/ancestry, rename/delete/untracked handling, and repo containment — `bin/lib/test-selection-changes.mjs` ✅ (completed: 2026-11-12 01:20)
- [x] 3.2.3 Implement direct matching, `--include` spec paths, reverse closure, always-run, PR smoke, gate filter, budget, threshold, full-set `{tests}` expansion, fallback reasons, and result shape — `bin/lib/test-selection.mjs` ✅ (completed: 2026-11-12 01:20)
- [x] 3.2.4 Implement human/JSON explanation formatting — `bin/lib/test-selection-explain.mjs` ✅ (completed: 2026-11-12 01:20)
- [x] 3.2.5 Add public type declarations for glob, changes, and selection APIs — `bin/lib/test-selection-glob.d.mts`, `bin/lib/test-selection-changes.d.mts`, `bin/lib/test-selection.d.mts` ✅ (completed: 2026-11-12 01:20)

### Step 3.3: Implementation Tests and Hardening

- [x] 3.3.1 Write impl tests for rename/delete/untracked, docs-only, shared support, unknown path, path escape, dependency direction, budget/no-drop, determinism, and a 1,000-path performance fixture — `bin/test-selection.impl.test.mjs` ✅ (completed: 2026-11-12 01:20)
- [x] 3.3.2 Run targeted selector tests and fix failures — `node --test bin/test-selection.spec.test.mjs bin/test-selection.impl.test.mjs` ✅ (completed: 2026-11-12 01:20)
- [x] 3.3.3 Full verification: `npm run verify`; record PASS and test count — `npm run verify` ✅ (completed: 2026-11-12 01:20)

**Verify**: `node --test bin/test-selection.spec.test.mjs bin/test-selection.impl.test.mjs`

---

## Phase 4: CLI and Runner

> **Phase baseline tree**: d6d3e069869b3740dd0fb7c232c7feea75f044a2
> **Reasoning**: high — executes project commands; argv/path safety is non-negotiable.

### Step 4.1: Specification Tests

- [x] 4.1.1 Write CLI spec tests for `select`, `run`, `check`, `shadow`, options, JSON output, and exit codes — `bin/codeops-test.spec.test.mjs` (ST-26..ST-35, ST-56, ST-58) ✅ (completed: 2026-11-12 01:38)
- [x] 4.1.2 Run the new spec tests and confirm red; record the failure — `node --test bin/codeops-test.spec.test.mjs` ✅ (completed: 2026-11-12 01:38)

### Step 4.2: Implementation

- [x] 4.2.1 Implement argv-safe command execution with cwd containment, `--full-command`, `requirements` probes, timeout, concurrency, failure-log retention, and temp hygiene — `bin/lib/test-runner.mjs` ✅ (completed: 2026-11-12 01:38)
- [x] 4.2.2 Implement the CLI entry point and `select`/`run`/`check` commands, including `--last-full-sha`, `--full-command`, `--no-fallback`, `--keep-logs`, `--metrics`, and the full `provenance` input flags — `bin/codeops-test.mjs` ✅ (completed: 2026-11-12 01:38)
- [x] 4.2.3 Implement `shadow` (selected + full comparison, escaped-failure report) — `bin/codeops-test.mjs`, `bin/lib/test-runner.mjs` ✅ (completed: 2026-11-12 01:38)
- [x] 4.2.4 Register the `codeops-test` binary, include it in the package payload, and exclude `bin/fixtures/` — `package.json` ✅ (completed: 2026-11-12 01:38)
- [x] 4.2.5 Add the public runner declaration — `bin/lib/test-runner.d.mts` ✅ (completed: 2026-11-12 01:38)

### Step 4.3: Implementation Tests and Hardening

- [x] 4.3.1 Write impl tests for spaces/metacharacters in paths, cwd/symlink escape, fail-fast/no-fail-fast, timeout, parallelSafe gating, log location/cleanup, and shadow outcomes — `bin/codeops-test.impl.test.mjs` ✅ (completed: 2026-11-12 01:38)
- [x] 4.3.2 Run targeted CLI tests and fix failures — `node --test bin/codeops-test.spec.test.mjs bin/codeops-test.impl.test.mjs` ✅ (completed: 2026-11-12 01:38)
- [x] 4.3.3 Full verification: `npm run verify`; record PASS and test count — `npm run verify` ✅ (completed: 2026-11-12 01:38)

**Verify**: `node --test bin/codeops-test.spec.test.mjs bin/codeops-test.impl.test.mjs`

---

## Phase 5: Branch Policy, Plan, and Provenance

> **Phase baseline tree**: ba4635af50d8224472636765026a57a3045889a2
> **Reasoning**: high — branch classification and provenance decide when the full gate runs.

### Step 5.1: Specification Tests

- [x] 5.1.1 Write spec tests for branch patterns/precedence, gate mapping, plan matrix, nightly skip, map hash, provenance, and artifact promotion — `bin/test-branch-policy.spec.test.mjs`, `bin/test-provenance.spec.test.mjs` (ST-36..ST-42, ST-62, ST-67, ST-69) ✅ (completed: 2026-11-12 01:58)
- [x] 5.1.2 Run the new spec tests and confirm red; record the failure — `node --test bin/test-branch-policy.spec.test.mjs bin/test-provenance.spec.test.mjs` ✅ (completed: 2026-11-12 01:58)

### Step 5.2: Implementation

- [x] 5.2.1 Implement branch/tag classification (including `feature`), precedence, unknown-branch warning, and gate mapping — `bin/lib/test-branch-policy.mjs` ✅ (completed: 2026-11-12 01:58)
- [x] 5.2.2 Implement canonical map hashing, provenance write/verify, tested source commit, artifact digest, and reproducible-rebuild checks — `bin/lib/test-provenance.mjs` ✅ (completed: 2026-11-12 01:58)
- [x] 5.2.3 Integrate `plan` (all four modes, always-present matrix) and `provenance` commands into the CLI — `bin/codeops-test.mjs` ✅ (completed: 2026-11-12 01:58)
- [x] 5.2.4 Add public declarations for branch policy and provenance — `bin/lib/test-branch-policy.d.mts`, `bin/lib/test-provenance.d.mts` ✅ (completed: 2026-11-12 01:58)

### Step 5.3: Implementation Tests and Hardening

- [x] 5.3.1 Write impl tests for tags, precedence, missing marker, docs-only nightly skip, matrix shape, commit/digest/hash mismatch, and same-vs-rebuilt artifact promotion — `bin/test-branch-policy.impl.test.mjs`, `bin/test-provenance.impl.test.mjs` ✅ (completed: 2026-11-12 01:58)
- [x] 5.3.2 Run targeted branch/provenance tests and fix failures — `node --test bin/test-branch-policy.spec.test.mjs bin/test-branch-policy.impl.test.mjs bin/test-provenance.spec.test.mjs bin/test-provenance.impl.test.mjs` ✅ (completed: 2026-11-12 01:58)
- [x] 5.3.3 Full verification: `npm run verify`; record PASS and test count — `npm run verify` ✅ (completed: 2026-11-12 01:58)

**Verify**: `node --test bin/test-branch-policy.spec.test.mjs bin/test-branch-policy.impl.test.mjs bin/test-provenance.spec.test.mjs bin/test-provenance.impl.test.mjs`

---

## Phase 6: Organize Tests Skill and Adoption

> **Phase baseline tree**: _(recorded by the exec-plan skill at phase start)_
> **Reasoning**: high — the skill edits agent behavior and managed AGENTS.md content; containment and non-destruction matter.

### Step 6.1: Specification Tests

- [ ] 6.1.1 Write content spec tests for skill frontmatter, modes, protocol steps, language adapters, shadow refusal, safety rules, hygiene link, per-slice acceptance, staging/rollback, metrics/table, and reference links — `scripts/organize-tests-content.spec.test.mjs` (ST-43..ST-50, ST-66, ST-68)
- [ ] 6.1.2 Run the new content tests and confirm red; record the failure — `node --test scripts/organize-tests-content.spec.test.mjs`

### Step 6.2: Implementation

- [ ] 6.2.1 Write the skill entry point with modes, protocol, safety, `_shared/workspace-hygiene.md` link, staging/rollback, and output contract — `skills/organize-tests/SKILL.md`
- [ ] 6.2.2 Write the analysis/inventory protocol and slice proposal guidance — `skills/organize-tests/references/analysis-protocol.md`
- [ ] 6.2.3 Write the language adapter recipes (Node, Rust, Python, Go, JVM, .NET, C/C++, custom) — `skills/organize-tests/references/language-adapters.md`
- [ ] 6.2.4 Write the shadow adoption protocol and evidence shape — `skills/organize-tests/references/shadow-mode.md`
- [ ] 6.2.5 Write the map health/audit guidance (orphans, overlaps, slow groups, never-selected, flaky) — `skills/organize-tests/references/map-health.md`
- [ ] 6.2.6 Write the AGENTS testing-block (including the optional `Test slices` table), ownership, and wrapper guidance — `skills/organize-tests/references/agents-testing-block.md`
- [ ] 6.2.7 Update analyze-project to detect/preserve the `CODEOPS-TESTING` block and warn on drift; never render it — `skills/analyze-project/SKILL.md`
- [ ] 6.2.8 Add the skill's package/discovery checks (frontmatter, no leaks) to content tests — `scripts/organize-tests-content.spec.test.mjs`

### Step 6.3: Implementation Tests and Hardening

- [ ] 6.3.1 Write impl/content tests for reference existence, no `${PLUGIN_ROOT}`/`.codex/`, block preservation/ownership, hygiene link, staging/rollback, metrics/table, CI patch additivity, CODEOWNERS guidance, and no test-edit wording — `scripts/organize-tests-content.impl.test.mjs`
- [ ] 6.3.2 Run targeted skill/content tests and fix failures — `node --test scripts/organize-tests-content.spec.test.mjs scripts/organize-tests-content.impl.test.mjs`
- [ ] 6.3.3 Full verification: `npm run verify`; record PASS and test count — `npm run verify`

**Verify**: `node --test scripts/organize-tests-content.spec.test.mjs scripts/organize-tests-content.impl.test.mjs`

---

## Phase 7: CI and Release Integration

> **Phase baseline tree**: _(recorded by the exec-plan skill at phase start)_
> **Reasoning**: high — CI gate changes can silently weaken the release gate; preview and content tests are mandatory.

### Step 7.1: Specification Tests

- [ ] 7.1.1 Write content spec tests for the reusable full gate, affected plan modes/matrix, stable aggregator, `check --strict` job, nightly marker input/update, source-commit provenance, CODEOWNERS, and fork-PR safety — `scripts/ci-workflows-content.spec.test.mjs` (ST-53..ST-54, ST-58, ST-67, ST-68)
- [ ] 7.1.2 Run the new content tests and confirm red; record the failure — `node --test scripts/ci-workflows-content.spec.test.mjs`

### Step 7.2: Implementation

- [ ] 7.2.1 Add the reusable full-gate workflow with full verify and pack check — `.github/workflows/verify-full.yml`
- [ ] 7.2.2 Refactor CI to call the reusable full gate without changing behavior — `.github/workflows/ci.yml`
- [ ] 7.2.3 Refactor release to call the reusable full gate before publish — `.github/workflows/release.yml`
- [ ] 7.2.4 Write the advisory GitHub Actions template reference (affected shards, full path, aggregator, `check --strict`, nightly marker, provenance, acceptance, promotion, CODEOWNERS) — `skills/organize-tests/references/ci-github-actions.md`
- [ ] 7.2.5 Add the project wrapper/npm-script guidance for the selector — `skills/organize-tests/references/project-wrapper.md`

### Step 7.3: Implementation Tests and Hardening

- [ ] 7.3.1 Write impl/structure tests for workflow triggers, full-gate presence, all four plan modes, additive jobs, no `pull_request_target`, marker input/update, and template links — `scripts/ci-workflows-content.impl.test.mjs`
- [ ] 7.3.2 Run targeted workflow/content tests; run `actionlint` when available; fix failures — `node --test scripts/ci-workflows-content.spec.test.mjs scripts/ci-workflows-content.impl.test.mjs`
- [ ] 7.3.3 Full verification plus package payload: `npm run verify` and `npm pack --dry-run`; record results — `npm run verify`, `npm pack --dry-run`

**Verify**: `node --test scripts/ci-workflows-content.spec.test.mjs scripts/ci-workflows-content.impl.test.mjs`

---

## Phase 8: Documentation, Pilot, and Final Verification

> **Phase baseline tree**: _(recorded by the exec-plan skill at phase start)_
> **Reasoning**: high — the pilot proves shadow safety and the final gate proves no regression.

### Step 8.1: Specification Tests

- [ ] 8.1.1 Write content checks for README opt-in usage, CHANGELOG entry, AGENTS testing block, and pilot map validity — `scripts/test-selection-docs.spec.test.mjs` (ST-52, ST-54, ST-67)
- [ ] 8.1.2 Run the new content checks and confirm red; record the failure — `node --test scripts/test-selection-docs.spec.test.mjs`

### Step 8.2: Implementation

- [ ] 8.2.1 Document installation, opt-in adoption, commands, branch policy, and non-disruption/rollback — `README.md`
- [ ] 8.2.2 Add the feature changelog entry without hand-editing the version — `CHANGELOG.md`
- [ ] 8.2.3 Create the pilot policy, shared groups, and `.github/CODEOWNERS` entry for this repository in shadow mode — `codeops/test-map/policy.json`, `codeops/test-map/shared.json`, `.github/CODEOWNERS`
- [ ] 8.2.4 Create the pilot `bin` and `plugin` feature-slice groups — `codeops/test-map/bin.json`, `codeops/test-map/plugin.json`
- [ ] 8.2.5 Create the pilot `scripts`, `discovery-ui`, and content groups — `codeops/test-map/scripts.json`, `codeops/test-map/discovery-ui.json`, `codeops/test-map/content.json`
- [ ] 8.2.6 Run `check --strict` and `shadow --baseline <phase-tree>` on the pilot map; record zero-missed/escaped evidence in the phase evidence — `node bin/codeops-test.mjs check --strict`, `node bin/codeops-test.mjs shadow --baseline <phase-tree>`
- [ ] 8.2.7 Refresh `AGENTS.md` through the update path so the `CODEOPS-TESTING` block reflects the pilot map — `AGENTS.md`
- [ ] 8.2.8 Add the final docs/pilot content impl tests (including CODEOWNERS, marker, no-map command, and fixture-exclusion) and fix failures — `scripts/test-selection-docs.impl.test.mjs`
- [ ] 8.2.9 Run the full final verification suite: `npm run verify`, `npm pack --dry-run` (fixtures excluded), frontmatter check, and the no-leak checks; record exact results — `npm run verify`, `npm pack --dry-run`
- [ ] 8.2.10 Dispatch `agent-pipeline-reviewer` on the skill/AGENTS/CI diff; record the verdict and fix required findings — review packet

**Verify**: `node --test scripts/test-selection-docs.spec.test.mjs scripts/test-selection-docs.impl.test.mjs`

---

## Dependencies

```text
Phase 1 (lightweight path)
    ↓
Phase 2 (map model)
    ↓
Phase 3 (selector core)
    ↓
Phase 4 (CLI/runner)
    ↓
Phase 5 (branch/provenance)
    ↓
Phase 6 (skill/adoption)
    ↓
Phase 7 (CI/release)
    ↓
Phase 8 (docs/pilot/final)
```

Phase 1 is independent of the map and can be released alone. Phase 6 depends on Phases 2–5 for `check`/`shadow`; Phase 7 depends on Phase 5 for `plan`/provenance. Phase 8 depends on all.

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ A no-map project behaves exactly as today; deleting the map or setting `CODEOPS_FULL_TESTS=1` restores full behavior
3. ✅ A feature-slice change selects its task-tier group plus downstream dependents; unrelated slices do not run
4. ✅ Codegen changes do not select lexer/parser/LSP; shared contracts widen or fall back to full
5. ✅ Release/acceptance/package branches run the full suite; PR uses affected shards behind a stable aggregator
6. ✅ Nightly skips when nothing relevant changed; docs-only changes skip
7. ✅ The task gate reports 120/180 s budget status without dropping tests
8. ✅ `organize-tests` adopts in shadow mode with zero missed failures and never edits tests
9. ✅ Provenance records commit, artifact digest, map hash, and full-run ID; promotion reuses only the same digest
10. ✅ Old plans and AGENTS.md files require no migration
11. ✅ Node, Rust, custom, and polyglot fixtures pass; the selector core has no language branch
12. ✅ Full `npm run verify`, `npm pack --dry-run`, frontmatter/no-leak checks, and `agent-pipeline-reviewer` pass
13. ✅ The pilot map is valid, `check --strict` passes, and shadow mode reports zero missed failures before any enablement
