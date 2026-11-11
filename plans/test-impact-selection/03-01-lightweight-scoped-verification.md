# Lightweight Scoped Verification: Test Impact Selection

> **Document**: 03-01-lightweight-scoped-verification.md
> **Parent**: [Index](00-index.md)

## Overview

This component delivers the smallest useful change first: a plan can record a targeted `**Task verify**` command, the executor runs it per task/commit, and the full verify remains the phase/plan/CI/release gate. It adds no runtime selector, map, or CLI. It is the independent challenger's `Simplify` recommendation (AR-1) and the supported fallback for projects that never adopt a map (AR-35).

The component also inserts the prime directives and the conditional map path into the standards and shared protocol, so later phases have one canonical definition to link to.

## Architecture

### Current Architecture

One verify command is recorded once by `make-plan` (`skills/make-plan/SKILL.md:236-238`) and copied into every phase Verify line (`skills/make-plan/templates.md:481`). `exec-plan` runs that line per task and at session wrap-up (`skills/exec-plan/SKILL.md:180-185`, `:218`). `git-commit` runs the same command before every commit (`skills/git-commit/SKILL.md:17`). The standards require the full command before declaring any task done (`standards/coding-standards.md:33-34`, `standards/coding-standards-full.md:74-75`).

### Proposed Changes

Add two commands to the plan vocabulary:

- `**Verify (gate)**` — the full project verify command. Runs at phase exit, plan completion, session wrap-up when the plan is complete or stopped at a phase boundary, before push/release, and in CI.
- `**Task verify**` — an optional targeted command for task/commit verification. When absent, the gate command is used, preserving today's behavior (AR-2, AR-27).

`make-plan` must run the task command once during authoring and record the observed test count (AR-35). A task command that runs zero tests is invalid. The executor falls back to the full gate when any changed path is outside the phase's recorded expected modification set or touches shared/config/test infrastructure (AR-20, AR-22).

## Implementation Details

### Prime directives (insert into both standards files)

1. **Test-first is unchanged.** Specification tests are written before implementation and run red, then green. Selection never changes this.
2. **The inner loop runs the smallest safe verification slice.** With a valid map, a task runs the selected feature-slice `task` groups plus fast static checks. Without a map, a plan's `**Task verify**` command may provide the same scoped behavior; otherwise the full verify runs as today.
3. **The outer gate is always full.** The full verify runs at phase/plan completion, before push/release, at acceptance, and in CI. A green slice is not a release signal.
4. **Selection fails closed.** Unknown paths, shared infrastructure, manifests/lockfiles, test-runner/config changes, CI changes, stale/invalid maps, and selector errors select the full suite. No silent skips.
5. **Spec tests are never skipped.** The feature's spec test file always runs, even if the map would not select its group. Exec-plan passes the plan's declared spec file(s) with `--include`; the selector adds the owning group, or returns full if the spec file is unowned.
6. **Evidence is explicit.** Verification names the groups or scoped command used, what was deferred, and the baseline. CI remains authoritative.

### Conditional standards wording

Keep the current mandate as the default and add the exception:

> **Default (unchanged):** Run the project's full verify command before completing any task or committing, unless the project has a valid `codeops/test-map.json` or `codeops/test-map/` directory, or the plan records a validated `**Task verify**` scoped command.
>
> **Opt-in exception:** With a valid map, a task-level verify may run the selected test groups plus the project's fast static checks. With a plan-scoped command, the task-level verify runs that command. The full verify still runs at phase/plan completion, before push/merge, at acceptance, and in CI. Any selection error, unknown path, shared change, or stale map falls back to the full verify.

### `_shared/test-selection.md` structure

Update `_shared/spec-first-ordering.md` so its final “full verification” step names the phase/plan gate and links here; per-task verification may be scoped. The standards carry the compact six directives; the new shared protocol owns the detail:

- the six prime directives in full and the gate ladder;
- the last-full marker, no-map `fullCommand: null` behavior, and the spec-test `--include` rule;
- the map/fragment overview and the no-map compatibility contract;
- the selection rules (direct, downstream closure, always-run, tiers, fallback);
- the task/phase/PR/release/acceptance/nightly gate definitions;
- the branch policy patterns and precedence;
- the evidence contract (groups run, deferred groups, baseline, budget, fallback reason);
- the lightweight `**Task verify**` fallback;
- links to the selector CLI, map schema, and `organize-tests` skill.

Skills link here; they do not restate the rules.

### make-plan changes

- `templates.md` `07-testing-strategy.md`: add an optional `## Test Slices & Groups` table with slice, tier, test files, sources, dependencies, and gate. For a map-less project, the table may be `N/A` and the plan uses the scoped command.
- `templates.md` `99-execution-plan.md`: add optional `**Test slices**`, `**Task verify**`, and `**Verify (gate)**` lines; keep the existing `**Verify**` line for compatibility.
- `SKILL.md` step 4b: confirm both commands; run the task command once; record `**Task verify evidence**: <N> tests observed, <date>` beside it; record the plan's declared spec file(s) for `--include`; never invent a command.
- `quality-checklist.md`: require every ST case to map to a slice or scoped command; require every slice to have a task-tier test; require the full gate command.
- If no map and no scoped command is provided, generate exactly today's plan.

### exec-plan changes

- **Red phase:** run only the declared spec file(s) and expect failure; do not run the full gate.
- **Task:** run the task command from the plan or the selector's `task` gate; pass `--baseline <phase-tree>` and `--include <spec-file>` for the plan's declared spec file(s); capture output per the verify-output rule.
- **Phase exit:** run the `**Verify (gate)**` full command; include deferred groups in the evidence.
- **Session wrap-up:** run the task command unless the plan is complete or the user stops at a phase boundary; then run the full gate.
- **Expected modification set:** reuse the phase baseline and expected modification set (`execution-protocol.md:51-66`, `:63-65`). A changed path outside the set, or a shared/config/test-infra path, forces the full gate and a scope note.
- **Packets:** include the task command, gate command, baseline, spec file(s), expected slices/groups, and the fallback rule (AR-26).
- **Old plans:** a single `**Verify**` line is the gate command; if a map exists, derive the task command from it; if not, use the gate command (AR-27).

### git-commit changes

- No map and no scoped command: run today's full verify.
- Scoped command present: run it for normal commits; run the full gate for release/merge/push commits and when the staged diff touches shared/config/test infrastructure.
- Record the command and groups/scope in the commit verification note; never bypass hooks (AR-20, AR-27).

### analyze-project changes

- Detect `codeops/test-map.json` / `codeops/test-map/` and the `full` command.
- Preserve the `CODEOPS-TESTING` block byte-for-byte; `organize-tests` is the sole writer. Warn when the block is missing or stale; never render or overwrite it (AR-29).
- If no map and no block, report that no map is present; do not create a testing block. If the block exists with the no-map text, preserve it.
- Warn when CI has no full gate on a release/acceptance branch (advisory, never auto-edit).

### Non-code artifacts

Test selection does not replace the standards' validation table (`coding-standards-full.md:107-121`). A Docker/Terraform/shell/SQL change runs its matching validation command even when no test group is selected (AR-21).

## Code Examples

### Plan with a scoped task command and a full gate

```markdown
**Test slices**: `billing.invoice-dialog` (task: unit/component; release: e2e)
**Task verify**: `npm run test -- --run web/billing/invoice-dialog api/billing/invoice`
**Verify (gate)**: `npm run verify`
```

### Plan with no map or scoped command (today's behavior)

```markdown
**Verify**: `npm run verify`
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| --- | --- | --- |
| Task command runs zero tests | make-plan rejects it; run the gate command instead | AR-35 |
| Changed path outside expected modification set | Run the full gate; record a scope note | AR-20 |
| Shared/config/test-infra path changed | Run the full gate | AR-22 |
| Plan has only one `**Verify**` line | Treat it as the gate; derive task selection only when a map exists, else use it for tasks | AR-27 |
| No map and no scoped command | Use today's full verify | AR-2 |
| Map exists but selector fails | Run the full gate; report the failure reason | AR-20 |
| Non-code artifact changed | Run the standards' validation command; tests are not required unless affected | AR-21 |

## Testing Requirements

- Content tests assert both standards files contain the six directives and the conditional wording.
- Content tests assert `_shared/test-selection.md` exists with the required sections and links.
- Content tests assert make-plan/exec-plan/git-commit/analyze-project contain the conditional path, the `--include` spec-file rule, the explicit `--baseline` rule, and no unconditional "run full verify per task" text.
- Content tests assert the old-plan fallback wording is present and that only `organize-tests` writes `CODEOPS-TESTING`.
- Content tests assert `CODEOPS-TESTING` block names are consistent.
- Manual scenario: a map-less plan runs exactly today's commands; a scoped plan records a nonzero test count.
