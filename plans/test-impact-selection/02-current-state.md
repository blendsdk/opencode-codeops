# Current State: Test Impact Selection

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

CodeOps has one verification concept. The standards require the project's verify command before completing any task or committing, and the skills use that same command at every altitude:

- the injected standards (`standards/coding-standards.md:33-34`, `standards/coding-standards-full.md:74-75`);
- per-task execution and session wrap-up (`skills/exec-plan/SKILL.md:180-185`, `skills/exec-plan/execution-protocol.md:105-123`);
- every phase's Verify line in generated plans (`skills/make-plan/templates.md:481`);
- the commit gate (`skills/git-commit/SKILL.md:17`);
- project analysis, which records one authoritative verify command (`skills/analyze-project/SKILL.md:22`);
- CI and release (`/.github/workflows/ci.yml:24-25`, `/.github/workflows/release.yml:69-70`).

The execution protocol already produces a reliable phase baseline tree and diffs it for review (`skills/exec-plan/execution-protocol.md:51-66`, `:170-185`). That mechanism is reusable for change detection; no second baseline is needed.

### Relevant Files

| File | Purpose | Changes Needed |
| --- | --- | --- |
| `standards/coding-standards.md:32-42` | Injected per-request testing rules | Add prime directives and the conditional map path |
| `standards/coding-standards-full.md:72-85` | Full testing standards | Add gate ladder, fallback, evidence, and non-code validation boundary |
| `_shared/test-selection.md` (new) | Canonical protocol | Gate ladder, map overview, selection rules, fallback, evidence |
| `skills/make-plan/templates.md:291-396,481,515-523` | 07/99 templates | Optional test-slice table, `**Task verify**`, expected footprint |
| `skills/make-plan/SKILL.md:236-238` | Verify-command confirmation | Confirm task and gate commands; run task command once and record count |
| `skills/make-plan/quality-checklist.md:32-46` | Plan quality gate | Require ST-to-slice mapping and slice health |
| `skills/exec-plan/SKILL.md:180-198,214-222` | Task/wrap-up verification | Task gate, phase/release gates, evidence, old-plan fallback |
| `skills/exec-plan/execution-protocol.md:51-66,105-123,300-318` | Baseline, verification, packets | Reuse baseline; task/gate commands; selection evidence in packets |
| `skills/exec-plan/commit-modes.md` | Commit behavior | Commit uses task slice; full before push/release |
| `skills/git-commit/SKILL.md:17` | Commit verification | Task slice; full for release/merge/push |
| `skills/analyze-project/SKILL.md:13-27` | Project facts | Detect map; render/preserve testing block; warn on missing full gate |
| `schemas/codeops-config.schema.json` | Config contract | **No change**; the map is separate |
| `schemas/test-map.schema.json` (new) | Map contract | Groups, fragments, policy, budgets, branches |
| `bin/index.mjs:32-60` | Current CLI | Installer only; add a separate test CLI or subcommand |
| `bin/lib/*.mjs` | Framework-free helpers | Add map/selection/runner/branch/provenance modules |
| `.github/workflows/ci.yml`, `release.yml` | CI/release | Add reusable full gate; keep behavior |
| `.github/workflows/verify-full.yml` (new) | Reusable full gate | `workflow_call`; full verify + pack check |
| `skills/organize-tests/**` (new) | Adoption skill | Analysis, shadow, apply, check, refresh, audit |
| `AGENTS.md` managed block | Project commands | Add `CODEOPS-TESTING` block when a map is adopted; `organize-tests` owns it, analyze-project preserves it |
| `.github/CODEOWNERS` (new) | Map governance | Protect `codeops/test-map/**`; the pilot adds the entry |

### Code Analysis

The current full-suite cost is concrete: the latest plan evidence records **675 tests** for this repository (`plans/discovery-ui-redesign/99-execution-plan.md:199`). Every task and commit in a CodeOps plan is expected to pay that cost because the phase Verify line is the full command. In a large ERP or compiler, the same pattern scales to thousands of unrelated tests per small change.

The existing review protocol already knows how to isolate a phase's changes: `codeops_worktree_snapshot.py` records committed, staged, unstaged, and untracked files into a tree, and the review diff uses that tree (`execution-protocol.md:51-66`, `:170-185`). Selection can reuse the same baseline, which keeps test evidence and review evidence aligned.

## Gaps Identified

### Gap 1: One verify concept for three altitudes

**Current Behavior:** The same full command is used for task feedback, phase/PR integration, and release gating.

**Required Behavior:** Task/phase/PR gates use affected groups; release/acceptance/package gates run the full suite.

**Fix Required:** Add the gate ladder and the conditional map path to standards and skills.

### Gap 2: No test grouping or impact map

**Current Behavior:** Test files are listed in `07-testing-strategy.md`, but there is no ownership map, dependency graph, or slice/tier model.

**Required Behavior:** A committed, versioned map describes feature slices, tiers, sources, tests, commands, and dependencies.

**Fix Required:** Add the map model, schema, fragments, and validation.

### Gap 3: No deterministic change-to-test selection

**Current Behavior:** A human or agent guesses which tests to run; the safe default is full.

**Required Behavior:** A selector computes changed files, maps them to owning groups, adds downstream dependents, and emits argv-safe commands.

**Fix Required:** Add selector core, CLI, branch-aware baselines, and fail-closed fallback.

### Gap 4: No adoption path for existing projects

**Current Behavior:** There is no skill that inventories an existing suite, proposes groups, or proves selection safety.

**Required Behavior:** `organize-tests` analyzes any supported language, proposes feature slices/adapters, runs shadow mode, applies the map, and audits drift.

**Fix Required:** Add the skill and references.

### Gap 5: CI has only a static full job

**Current Behavior:** CI runs the full suite on PR/main; release runs it before publish. There is no affected-shard plan, stable aggregator, branch policy, nightly change detection, or provenance.

**Required Behavior:** Affected dynamic shards on PR; stable required aggregator; full on release/acceptance; conditional nightly; artifact promotion evidence.

**Fix Required:** Add the CI plan/provenance modules and advisory workflow templates.

### Gap 6: No non-disruption contract

**Current Behavior:** A new selector could accidentally change or weaken the existing flow.

**Required Behavior:** No map = today's behavior; any error = full; old plans/AGENTS.md valid; rollback by deleting the map or setting `CODEOPS_FULL_TESTS=1`.

**Fix Required:** Conditional wording, explicit fallback tests, shadow adoption, and additive CI changes.

### Gap 7: No test-suite health feedback

**Current Behavior:** Unrelated and redundant tests are not visible; there is no measure of selection efficiency.

**Required Behavior:** `check` reports orphan tests, unclassified sources, slices without fast tests, slow groups, and overlaps; metrics are content-free.

**Fix Required:** Add health checks and optional metrics.

## Dependencies

### Internal Dependencies

- The phase baseline tree and snapshot helper (`scripts/codeops_worktree_snapshot.py`) for change detection.
- The plan parser (`scripts/codeops_plan.py`) for progress and plan-readiness checks.
- The skill installer (`bin/install-skills.mjs`) auto-discovers new skill directories.
- The plugin standards loading and injection (`plugin/index.ts:64-76, 284-288`) for the prime directives.
- `analyze-project` and `AGENTS.md` managed-block rules for the testing block.

### External Dependencies

- No new runtime dependency (AR-17).
- GitHub Actions for the advisory CI templates; other CI providers use the same `test plan` contract.
- Project test runners (`node --test`, Vitest, Jest, Cargo, pytest, Go, Gradle/Maven, .NET, CTest, custom) via argv commands.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Silent under-selection | Medium | High | Shadow mode, fail-closed fallback, downstream closure, `check --strict`, escaped-failure reporting |
| Map drift | Medium | Medium | Glob ownership, `check`, `organize-tests --refresh`, analyze-project status |
| Multi-agent map conflicts | Medium | Medium | Domain fragments + `shared.json`; CODEOWNERS; stable IDs |
| 2–3 minute budget impossible for some slices | Medium | Medium | Slice contract (task-tier tests required), split slow groups, soft warning, never skip |
| CI dynamic matrices break required checks | Medium | High | Stable `verify` aggregator (AR-30) |
| Full-only-at-release hides regressions | Medium | High | Conditional nightly full, release-candidate full, escaped-failure feedback |
| Old plans/AGENTS.md break | Low | High | No migration; one `**Verify**` line is the gate; map-less path unchanged |
| Command injection/path escape | Low | High | Argv execution, path normalization, repo-root containment, security tests |
| Map edit weakens selection | Low | High | CODEOWNERS, strict check, reasons for ignores, review |
| Test order dependence | Medium | High | Shadow mode proves zero misses; full gate shards/randomizes; isolation standard |
| Spec tests are skipped | Low | High | Exec-plan passes `--include` for the plan's spec file(s); unowned spec file → full; immutable oracle unchanged; reviewer evidence |
| Coverage erodes | Medium | Medium | Full release/acceptance gate runs coverage where the project measures it |
