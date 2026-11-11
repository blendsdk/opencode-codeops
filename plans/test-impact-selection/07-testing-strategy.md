# Testing Strategy: Test Impact Selection

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --- | --- |
| Selection core / map validation | 95% |
| CLI / runner / branch / provenance | 90% |
| Skill content and workflow templates | 85% |
| Documentation / config | 70% |

- Test names state behavior: `should [expected behavior] when [condition]`.
- The selector is tested against fixture repositories: Node (file-based), Rust (target-based), and a custom command runner. No live external service is required.
- Security cases are mandatory for path traversal, command injection, symlink escape, and secret-free output.
- E2E browser tests are `N/A`: this feature is a CLI/CI layer; integration tests exercise the CLI against fixture repos and simulated workflows.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> These cases are derived exclusively from [01-requirements](01-requirements.md), the component specs, and the Ambiguity Register. They define expected behavior before implementation. The immutable-oracle rule applies: a failing spec test means the implementation is wrong, not the test. In-code traceability comments quote the behavior in plain language, never a plan/AR/ST id.

### Map Model and Validation

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-1 | No `codeops/test-map.json` and no `codeops/test-map/` | Map load returns `no-map`; selection returns `mode: full`, reason `no-map`, `fullCommand: null`; `run` requires `--full-command` and refuses without it; the CI no-map path uses the project's existing full job | FR-1, AR-2 |
| ST-2 | Single map with one `billing.invoice-dialog.unit` group and a changed dialog source | Group loads; `sources` matches; group is valid | FR-2, AR-8 |
| ST-3 | Directory with `policy.json`, `shared.json`, `billing.json`, `inventory.json` | Loader merges policy once and groups from all fragments; IDs are unique; cross-fragment `dependsOn` resolves | FR-2, AR-8 |
| ST-4 | Duplicate group ID across two fragments | Validation fails with `map.duplicate-id`; no partial selection | FR-2, AR-2, AR-20 |
| ST-5 | `dependsOn` cycle A→B→A | Validation fails with `map.cycle` | FR-2, AR-2, AR-20 |
| ST-6 | Source glob `../outside/**`, absolute path, or NUL | Validation fails with `map.path`; selector never reads outside the repo | FR-19, AR-24 |
| ST-7 | File-based group with an empty `tests` match; target-based group with no `tests`; test file owned by two groups; `ignorePaths` entry without a reason; ignore glob overlapping a source | File-based empty group → `map.empty-group` (exit 3); target-based group is exempt; `map.overlap` warns normally and fails under `--strict`; `map.ignore-reason`/`map.ignore-overlap` are errors | FR-19, AR-22, AR-24 |
| ST-8 | Slice with only a `release` tier; slice with no release/acceptance record; slice with a manual/na `acceptance` record | `map.slice-no-task` is a warning (strict error); `map.slice-no-release` is a warning (strict error); a valid per-slice `acceptance` record satisfies the release rule; an invalid record is `map.acceptance` | FR-3, FR-19, AR-7 |
| ST-9 | `alwaysRun: true` on a `phase`/`release` group | Validation fails with `map.always-run-tier` | FR-7, AR-9 |
| ST-10 | Same map content in different fragment order | Canonical map hash is identical | FR-16, AR-14 |

### Selection and Gates

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-11 | Changed `web/billing/invoice-dialog/Dialog.tsx` | Selects `billing.invoice-dialog.unit` as `direct-source`; does not select `inventory.*` | FR-3, AR-6 |
| ST-12 | Changed test file `api/billing/invoice/dialog.test.ts` | Selects its owning group as `direct-test` | FR-3, AR-6 |
| ST-13 | Changed `crates/codegen-x86/src/instruction.rs` | Selects `codegen.x86.unit` and downstream `assembler.unit`/`compiler.e2e`; not `lexer`, `parser`, or `lsp` | FR-4, AR-6 |
| ST-14 | Changed `crates/parser/src/lib.rs` | Selects parser and downstream codegen/assembler/e2e; not unrelated UI/inventory slices | FR-4, AR-6 |
| ST-15 | Changed `package-lock.json`, `Cargo.lock`, CI workflow, or `codeops/test-map/**` | Returns `mode: full` with `full-on-path` reason and the matching paths | FR-6, AR-20 |
| ST-16 | Changed `README.md` only | Returns `mode: none`; no test commands; docs validation may still run | FR-6, AR-21 |
| ST-17 | Changed `src/unmapped/new-module.ts` | Returns `mode: full` with `unknown-path` and the path | FR-6, AR-20 |
| ST-18 | Changed shared test setup `test/setup/db.ts` | Returns full or the configured shared-test dependency groups; never silently skips | FR-6, AR-22 |
| ST-19 | Rename `src/a.ts` → `src/b.ts`; delete a test file | Both old/new paths considered; owning group selected; `check` reports the empty/stale test glob | FR-5, AR-19 |
| ST-20 | `--gate task`, `--gate phase`, `--gate release` on a slice with task/phase/release tiers | Task selects task only; phase selects task+phase; release selects all; deferred groups carry `deferred-tier` | FR-7, AR-6 |
| ST-21 | Selected groups are 60% of all groups (default `fullThreshold`) | Returns full with `threshold` reason; no partial run | FR-6, AR-20 |
| ST-22 | Task groups sum to 150 s; then 200 s | 150 s → `acceptable`; 200 s → `over-budget` warning with breakdown; all groups remain selected | FR-9, AR-7 |
| ST-23 | `CODEOPS_FULL_TESTS=1` or `--full` | Returns full at any gate | FR-20, AR-2 |
| ST-24 | Invalid map JSON / selector exception | `select`/`plan` return `mode: full` with a visible reason and exit 0; `check` exits 3; `--no-fallback` exits 3/5; CI still runs the full gate | FR-6, AR-20 |
| ST-25 | Changed path matches no group and no full-on/ignore rule | Full fallback; never a silent skip | FR-6, AR-20 |

### CLI and Runner

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-26 | `select --json` on a valid PR diff; then `run --selection plan.json --group <id>` | JSON includes mode, gate, base, mapHash, changed, selected, deferred, commands, budget, reasons; the shard runs only that group and rejects a map-hash mismatch | FR-10, AR-18 |
| ST-27 | `select --explain` | Each selected group names direct/dependent/always-run; each deferred group names its tier | FR-21, AR-18 |
| ST-28 | Test path containing spaces, `;`, `$()`, or quotes | Path is passed as one argv entry; no shell execution; command runs or fails without injection | FR-19, AR-33 |
| ST-29 | Group `cwd` outside repo, or a symlink escape | Validation/runner rejects; exit 3/5; no execution outside root | FR-19, AR-24 |
| ST-30 | Group command exits nonzero; timeout expires | `run` exits 1; failure tail + log path; timeout is a failure, not a skip | FR-10, AR-33 |
| ST-31 | `run` with two independent `parallelSafe` groups and `--concurrency 2` | Runs concurrently; a non-parallel-safe group forces sequential | FR-10, AR-18 |
| ST-32 | `check --strict` with an orphan test and an unclassified source | Exit 4; report names both; no writes | FR-19, AR-24 |
| ST-33 | `shadow`: selected passes, full passes | Verdict `zero-missed`; evidence written; map not auto-enabled | FR-11, AR-23 |
| ST-34 | `shadow`: selected passes, full fails | Verdict `escaped`; adoption refused; failure tail reported | FR-11, AR-23 |
| ST-35 | Logs when `$CODEOPS_TMPDIR` is set/unset; a failing group | Logs go under the temp root/OS temp, not the repo; success logs are deleted unless kept; failure logs are retained and their path is reported | FR-19, AR-20 |

### Branch Policy, Nightly, Provenance

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-36 | Ref `main`, `master`, `feature/x`, `release/1.2`, `release-2026`, `hotfix/x`, `acceptance/rc`, `v1.2.3`, unknown | Gates: integration/pr, integration/pr, task locally / pr in CI, release, release, release, acceptance, release, integration+warn | FR-8, AR-11 |
| ST-37 | Branch matches both `release/**` and `acceptance/**` | Acceptance gate wins | FR-8, AR-12 |
| ST-38 | Nightly marker equals HEAD; docs-only diff; source diff; missing marker; non-ancestor marker | Skip; skip; full; full with `nightly.no-marker`; full with `marker-missing`; the marker is updated only after success | FR-15, AR-5 |
| ST-39 | `plan --gate pr` / `release` / no map / `none` / `skip` | PR returns affected matrix; release returns all groups + `full: true`; no map returns `mode: full`, `fullCommand: null`, `matrix: {include: []}`; `none`/`skip` always include an empty matrix; full is never a fake group | FR-14, AR-30 |
| ST-40 | Any shard fails; plan fails; selected set empty for code change | Stable `verify` aggregator fails in every case | FR-14, AR-30 |
| ST-41 | Provenance record for commit/digest/map hash; then verify same vs different digest | Same passes; different digest/commit/hash fails with a named field | FR-16, AR-14 |
| ST-42 | Production deploy with same artifact digest vs rebuilt artifact | Same reuses evidence + smoke; rebuild requires a new full gate | FR-16, AR-14 |

### Adoption Skill and Workflow Integration

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-43 | `organize-tests` on a Node fixture | Proposes feature slices with task/phase/release tiers; commands run a nonzero subset; previews map/AGENTS/CI | FR-12, AR-28 |
| ST-44 | `organize-tests` on a Rust fixture, including a crate with only inline unit tests | Crate groups use `cargo test -p <crate> --lib --tests`; target-based groups may omit `tests`; ownership is validated through `sources` plus the command smoke test | FR-17, AR-3 |
| ST-45 | `organize-tests` with a custom command fixture | Custom adapter accepted; no language-specific core change | FR-17, AR-3 |
| ST-46 | `organize-tests` shadow miss | Adoption refused; report names the escaped group | FR-11, AR-23 |
| ST-47 | `check`/`audit` on orphan, overlap, slice-without-task-tier, slow group | Reports each with a path/ID; strict fails | FR-19, AR-24 |
| ST-48 | `analyze-project` refresh with an existing `CODEOPS-TESTING` block | Block preserved byte-for-byte; other content preserved; only `organize-tests` writes it; a missing/stale block produces a warning; no map does not create a block | FR-13, AR-29 |
| ST-49 | Old plan with one `**Verify**` line and no map; with a map | No map: behaves as today. Map: task command derived; full gate retained | FR-13, FR-20, AR-27 |
| ST-50 | Plan-scoped `**Task verify**` with zero tests | make-plan rejects; falls back to full gate | FR-18, AR-35 |
| ST-51 | Changed path outside the phase's expected modification set | Exec-plan runs the full gate and records a scope note | FR-13, AR-20 |
| ST-52 | Standards/skills content | Both standards contain six directives and conditional wording; no skill says “run full verify every task” without the map/scoped exception; `_shared/test-selection.md` exists | FR-13, AR-1 |
| ST-53 | CI templates | Release/acceptance full gate; stable aggregator; nightly marker; provenance; no `pull_request_target`; existing jobs preserved | FR-14, AR-36 |
| ST-54 | `npm pack --dry-run` | Includes new skill, schema, CLI, shared protocol, and templates; excludes tests and `bin/fixtures/` | FR-20, AR-34 |

### Remediation Acceptance Cases

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-55 | `main` with a missing, unreadable, or non-ancestor last-full marker | `mode: full` with `marker-missing`/`unresolved-base`; never an empty diff against `HEAD` | FR-5, AR-19 |
| ST-56 | No-map `select`/`plan`; `run` without and with `--full-command` | `fullCommand: null`; `run` refuses without the flag; with a valid argv it executes the full command | FR-1, AR-2 |
| ST-57 | `full` as a string, a one-element argv with spaces, and a nested multi-command argv | String and one-element-with-spaces → `map.full`; nested argv accepted | FR-2, AR-2, AR-16 |
| ST-58 | CI plan with `mode: groups`, `full`, `none`, and `skip` | Every result has a matrix object; `full` uses the separate full job; `none`/`skip` use an empty matrix; `run --group full` is a usage error | FR-14, AR-30 |
| ST-59 | `--include` for a declared spec file owned by a group, and for an unowned file | Owned → its group is selected with `included`; unowned → `mode: full` with `unknown-path` | FR-13, AR-20 |
| ST-60 | Source-only change selects a file-based group | `{tests}` expands to the group's full resolved test set, not an empty list | FR-3, AR-6 |
| ST-61 | PR gate with a configured `policy.prSmoke` group | The smoke group runs at `pr` with reason `smoke`; it is not selected at `task` and is deferred at `release` unless normally selected | FR-7, AR-4 |
| ST-62 | `check` with a duplicate ID, an orphan test, and an overlap | Duplicate ID exits 3; orphan and overlap are warnings (exit 0) and exit 4 under `--strict` | FR-19, AR-24 |
| ST-63 | Slice with `acceptance: {mode: "manual", reason: "..."}`; invalid mode | The slice-release rule passes; an invalid mode is `map.acceptance` | FR-3, AR-7 |
| ST-64 | `requires: ["db"]` with a configured probe exiting 0 and 1; a missing probe | 0 runs the group; 1 fails with `requires.missing`; missing policy entry is `map.requires` | FR-2, AR-9 |
| ST-65 | Case-differing path on Linux/macOS/Windows; `caseSensitive: false` | Default matching is case-sensitive everywhere; the override warns and records the effective mode | FR-5, AR-19 |
| ST-66 | `--metrics` on a run; AGENTS block with the `Test slices` table | Metrics contain only gate/selected/total/budget/reason/mapHash; the table has slice/tier/tests/sources/gate | FR-19, FR-23 |
| ST-67 | Full gate on source, artifact built later with matching and differing source/digest | Matching `sourceCommit` + reproducible digest passes; mismatch or non-reproducible rebuild fails `provenance verify` | FR-16, AR-14 |
| ST-68 | Content check of `.github/CODEOWNERS` and the new skill | `codeops/test-map/**` is owned; the skill links `_shared/workspace-hygiene.md` | FR-12, AR-24 |
| ST-69 | Branch `feature/x` locally and in CI; phase baseline passed explicitly | Local gate `task`, CI gate `pr`; selector uses the explicit `--baseline` and never discovers a plan header | FR-8, AR-19 |

## Test Categories

### Specification Tests

- Map/validation: `bin/test-map.spec.test.mjs`
- Selector: `bin/test-selection.spec.test.mjs`
- CLI/runner: `bin/codeops-test.spec.test.mjs`
- Branch/provenance: `bin/test-branch-policy.spec.test.mjs`, `bin/test-provenance.spec.test.mjs`
- Content: `scripts/test-selection-content.spec.test.mjs`, `scripts/organize-tests-content.spec.test.mjs`, `scripts/ci-workflows-content.spec.test.mjs`

### Implementation Tests

- Glob matcher, path normalization, change parsing, closure, budget, command construction.
- Runner argv/timeout/concurrency/cwd containment.
- Map hash canonicalization, fragment merging, validation edge cases.
- Skill content structure and reference links.

### Integration Tests

- Fixture repo: Node file-based slices.
- Fixture repo: Rust target-based slices.
- Fixture repo: custom command runner.
- Polyglot fixture (Node + Rust + custom) in one map.
- CLI `select`/`run`/`check`/`plan`/`shadow` against fixtures.
- Simulated CI plan → matrix → aggregator result.

### Security Tests

- `../`, absolute, NUL, symlink escape.
- Shell metacharacters in paths.
- `cwd` outside root.
- Map command validation/no shell interpolation.
- Fork-PR template safety and secret-free provenance.
- No secrets in logs/evidence.

## Test Data

### Fixtures Needed

- `bin/fixtures/test-selection/node/` — feature slices, task/phase/release groups.
- `bin/fixtures/test-selection/rust/` — crate groups with `cargo test` commands (commands can be stubbed in tests).
- `bin/fixtures/test-selection/custom/` — a tiny CLI that prints the args it receives.
- `bin/fixtures/test-selection/polyglot/` — Node + Rust + custom groups.
- `bin/fixtures/test-selection/invalid/` — duplicate IDs, cycle, traversal, orphan, empty group.

### Mock Requirements

- Prefer real temp directories and fixture files.
- Stub the actual test runner with a small executable that records argv and exits with a configured status. This proves command construction without running a full language toolchain.
- No network, database, or browser dependency for the selector tests.

## Verification Checklist

- [ ] All specification test cases (ST-*) are defined with concrete input/output pairs
- [ ] Every ST case traces to a requirement, spec doc, or AR entry
- [ ] Specification tests are written before implementation
- [ ] Specification tests fail before implementation (red phase)
- [ ] All specification tests pass after implementation (green phase)
- [ ] Implementation tests cover edge cases and internals
- [ ] All unit/integration/security tests pass
- [ ] No regressions in the existing full suite
- [ ] Node, Rust, custom, and polyglot fixtures pass
- [ ] Shadow mode reports zero missed failures before any adoption
- [ ] The stable CI aggregator behavior is tested
- [ ] Coverage meets the goals above (where measured)
- [ ] `npm run verify`, `npm pack --dry-run`, frontmatter checks, and specialist review pass
