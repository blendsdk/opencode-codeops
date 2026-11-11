# Requirements: Test Impact Selection

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Add an opt-in, language-neutral test-impact layer to CodeOps. It groups tests into feature slices and tiers, selects the groups affected by a change, and runs only those groups during task/phase/PR work. The full project verify command remains the release, acceptance, and deployment gate. Projects without a map keep today's full-verify behavior. Any selector failure, unknown path, shared change, or stale map falls back to the full suite.

The feature is delivered in phases: a lightweight plan-scoped task command first, then the map/selector, then the adoption skill and CI templates. The map is data; language knowledge lives in adapter recipes and project-supplied commands, so the core works for file-based runners (Node, Python), target-based runners (Rust, Go), and custom CLIs.

## Functional Requirements

### Must Have

- [ ] **FR-1 — Opt-in map.** A project with no `codeops/test-map.json` or `codeops/test-map/` runs exactly the commands and gates it runs today. Presence of a valid map enables selection (AR-2, AR-15).
- [ ] **FR-2 — Map model.** The map supports a single file or domain fragments plus `shared.json`, with policy, groups, slices, tiers, source/test globs, dependency edges, runner argv, budgets, branch policy, always-run flags, PR smoke groups, requirement probes, per-slice acceptance records, case-sensitivity policy, and `full` argv command(s). It validates IDs, cycles, paths, commands, `full` argv shape, requirement references, acceptance records, and ownership (AR-8, AR-16).
- [ ] **FR-3 — Feature-slice groups.** The primary unit is a feature slice; each slice may have `task`, `phase`, `release`, and `acceptance` tier groups. A change runs the slice's relevant tier group plus downstream dependents (AR-6).
- [ ] **FR-4 — Dependency direction.** Selection includes changed groups and groups that depend on them (downstream), never upstream providers. Shared contracts widen the closure (AR-6, AR-20).
- [ ] **FR-5 — Change detection.** Selection accepts an explicit phase baseline tree from exec-plan (`--baseline`), otherwise a branch-aware base. The integration/nightly base uses the last successful full-run marker (`--last-full-sha` / `CODEOPS_LAST_FULL_SHA`); a missing, unreadable, or non-ancestor marker selects full. It includes committed, staged, unstaged, and untracked files; handles renames and deletions; ignores docs/assets; and normalizes paths (AR-19).
- [ ] **FR-6 — Fail-closed fallback.** Unknown/unowned paths, `fullOnPaths`, shared test infrastructure, invalid/stale map, unresolved base, selector error, and over-threshold diffs select the full suite with a visible reason. `select`/`plan` return this full result with exit 0 for recoverable errors; `check` reports the defect and `--no-fallback` keeps the error exit (AR-20, AR-22).
- [ ] **FR-7 — Gate policy.** Supported gates are `task`, `phase`, `pr`, `release`, `acceptance`, and `nightly`. Task runs task-tier groups; phase runs task+phase; release/acceptance run all groups; PR runs task+phase plus `policy.prSmoke` groups. Feature branches default to `task` locally and `pr` in CI (AR-4, AR-6).
- [ ] **FR-8 — Branch policy.** `main`/`master` are integration; `feature/**` is a local class with `task` locally and `pr` in CI; `release/**`, `release*`, `hotfix/**`, `hotfix*` are release; `acceptance/**`, `acceptance*` are acceptance; `v*` tags are release; unknown branches use integration with a warning. Precedence is acceptance > release > integration > feature (AR-11, AR-12).
- [ ] **FR-9 — Soft budget.** The task gate targets 120 s and accepts up to 180 s. Over 180 s warns with a group breakdown; tests are never dropped to meet the budget (AR-7).
- [ ] **FR-10 — CLI.** `select`, `run`, `check`, `plan`, `shadow`, and `provenance` commands, with human and `--json` output and deterministic exit codes (AR-18).
- [ ] **FR-11 — Shadow adoption.** A project can compare selected and full results; adoption is refused at any missed failure. The agent records the evidence (AR-23).
- [ ] **FR-12 — Adoption skill.** `organize-tests` analyzes a project, proposes feature-slice groups and language adapters, previews/applies the map, updates the AGENTS.md testing block, patches CI additively, checks drift, refreshes, and audits health. It never edits tests or removes CI jobs (AR-28, AR-29, AR-36).
- [ ] **FR-13 — Workflow integration.** With a map, make-plan records expected test slices and spec files; exec-plan uses task/phase/release gates, passes the phase baseline and spec `--include`, and records selection evidence; git-commit uses the task slice; `organize-tests` writes the testing block and analyze-project preserves it byte-for-byte and warns on drift. Without a map, all four keep today's behavior (AR-26, AR-27, AR-31).
- [ ] **FR-14 — CI plan.** `test plan` emits a stable JSON matrix for affected groups; release/acceptance emit all groups; no map emits `mode: full`, `fullCommand: null`, and an empty matrix; `none`/`skip` also emit an empty matrix. The CI workflow uses a stable `verify` aggregator as the required check (AR-30).
- [ ] **FR-15 — Nightly.** A scheduled full run executes only when relevant source/test/config paths changed since the last successful full-run SHA; docs-only changes skip (AR-5).
- [ ] **FR-16 — Provenance and promotion.** Release/acceptance records the tested source commit, artifact digest, `artifact.sourceCommit`, reproducibility flag, map hash, full-run ID, coverage, and acceptance result. The same artifact digest may reuse evidence in production; a rebuild that changes the digest requires a new full gate (AR-14).
- [ ] **FR-17 — Language neutrality.** The core knows only groups, paths, dependency edges, argv, and gates. Adapters/recipes cover Node, Rust, Python, Go, JVM, .NET, C/C++, custom commands, and polyglot repositories (AR-3).
- [ ] **FR-18 — Lightweight fallback.** A plan may record a scoped `**Task verify**` command; make-plan runs it once and records the observed test count; exec-plan uses it per task/commit and falls back to full outside the expected modification set (AR-35).
- [ ] **FR-19 — Audit and metrics.** `check` reports orphan tests, unclassified sources, empty groups, cycles, slices without task-tier tests, slow groups, and overlaps, with explicit default severity and exit codes. When enabled, `--metrics` emits only content-free fields (gate, selected/total, budget status, fallback reason, map hash) through the existing outcome-review/metrics surface (AR-24, AR-32).
- [ ] **FR-20 — Non-disruption.** Deleting/renaming the map, setting `CODEOPS_FULL_TESTS=1`, or any selector failure restores the previous full-verify behavior (AR-2, AR-20).

### Should Have

- [ ] **FR-21 — Explanation.** `select --explain`/`--json` names why each group was selected (direct, dependent, always-run, fallback) and which groups were deferred by tier.
- [ ] **FR-22 — Health suggestions.** `check` recommends splitting slow slices and adding task-tier tests for slices that lack them.
- [ ] **FR-23 — Human fallback table.** The `organize-tests` output can render a human-readable `Test slices` table (slice, tier, tests, sources, gate) into the AGENTS.md testing block for projects that want a map-less reference.

### Won't Have (Out of Scope)

- A runtime service, daemon, database, queue, or external test-impact service.
- Per-method dynamic coverage analysis or mutation testing.
- Automatic test-file rewriting, moving, deletion, or test weakening.
- A new runtime dependency for glob matching, JSON schema validation, or command execution.
- Changes to `codeops/codeops.json`, the CodeOps artifact schema, or the layout marker.
- Enforcing a particular CI provider; GitHub Actions templates are advisory and additive.
- Making the full suite optional at release/acceptance/production for the same artifact.

## Technical Requirements

### Performance

- The selector processes only changed paths; `select` on 1,000 changed paths must complete in under 2 seconds on a normal developer machine, excluding test execution.
- The task gate targets 120 s and accepts up to 180 s wall-clock, including fast static checks. It never silently drops a group to meet the budget.
- Group commands run with a configurable per-group timeout; a timeout is a failure, not a skip.

### Compatibility

- Node.js ≥ 18, ESM `.mjs`, `node:test`, no new runtime dependency (AR-17).
- Works on Linux, macOS, and Windows path conventions; map globs use POSIX separators and are normalized.
- Existing plans, AGENTS.md files, configs, and CI remain valid; no migration (AR-27).
- The plugin package must include the new skill, schema, CLI, and shared protocol; `npm pack --dry-run` must pass.

### Security

- Reject absolute paths, `..`, NUL, and symlink escapes outside the repository root (AR-24).
- Expand `{tests}` to the group's full resolved test set as separate argv entries; never interpolate test paths into a shell string (coding standards: injection prevention).
- Treat map commands as trusted project configuration, like `package.json` scripts; protect the map with review/CODEOWNERS.
- Do not run the map on `pull_request_target` with fork code or expose secrets to fork PRs (AR-36).
- Do not log secrets; keep selector output compact and content-free.

### Maintainability

- New modules stay under ~700 lines and split by responsibility; public functions/types carry doc comments.
- The map schema is versioned `schema: 1`; future changes are additive or versioned.
- No code or doc comment may reference `plans/`, `codeops/`, an RD/AR/task ID, or an execution plan.
- The selector core contains no language-specific parsing; adapters are data/recipes (AR-3).

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| --- | --- | --- | --- | --- |
| Overall approach | Lightweight only / full opt-in layer | Full opt-in layer, phased after lightweight fallback | User requires deterministic grouping, an adoption skill, multi-team/worktree safety, and CI/CD changes. | AR-1 |
| No-map behavior | Infer / full verify | Full verify | Non-disruption is the primary constraint; worst case is today's behavior. | AR-2 |
| Grouping unit | Directories / feature slices | Feature slices | Matches ERP dialog and compiler pipeline examples. | AR-6 |
| Full gate | Every task/PR / release+acceptance | Release/package, acceptance, production promotion | User explicitly wants full only when creating release packages/acceptance. | AR-4 |
| Map ownership | Single file / fragments | Domain fragments + `shared.json` | Multiple agents work in separate worktrees; conflicts stay local. | AR-8 |
| Task budget | Hard / soft | Soft 120/180 s | User wants 2–3 minutes as a suggestion, not a hard failure. | AR-7 |
| Always-run | Global / per-project | Per-project, default none | Projects differ; fast task-tier only. | AR-9 |
| Acceptance | Global / per-project | Per-project automated/manual/external | Projects differ. | AR-10 |
| CI | Static full / dynamic shards | Dynamic affected shards + stable aggregator | Avoids CI bottlenecks while keeping a required full gate at release. | AR-30 |
| Promotion | Re-run everywhere / verify once | Verify once, promote same digest | Removes redundant full runs across acceptance/production. | AR-14 |

## Acceptance Criteria

1. [ ] A project with no map runs the same task/commit/phase/CI commands as before; the selector reports `full` with `fullCommand: null`, and `run` uses `--full-command` or the existing project job.
2. [ ] A feature-slice change runs its task-tier tests plus downstream dependents and always-run groups, and does not run unrelated slices.
3. [ ] A codegen-only change does not select lexer/parser/LSP tests; a shared IR/contract change widens to affected consumers or full.
4. [ ] Docs-only changes select no tests; Docker/Terraform/shell/SQL changes still run the standards' validation commands.
5. [ ] Unknown paths, shared test infrastructure, invalid maps, and selector errors fall back to full with a visible reason from `select`/`plan`; `check --strict` still reports the map defect.
6. [ ] Release/acceptance branches run the full suite; `main`/`master` run affected/PR gates; nightly skips when nothing relevant changed.
7. [ ] The task gate reports 120/180 s budget status without dropping tests; a slice without task-tier tests is flagged.
8. [ ] `organize-tests` adopts an existing project in shadow mode with zero missed failures before enabling, and never edits tests.
9. [ ] CI uses a stable `verify` aggregator; release/acceptance run all shards; provenance records commit, artifact digest, map hash, and full-run ID.
10. [ ] A plan with one `**Verify**` line and no map behaves as today; with a map, task verification is derived, the phase baseline and spec `--include` are passed, and evidence is recorded.
11. [ ] Node, Rust (including a crate with only inline unit tests), and custom-command fixtures pass the same selector acceptance tests; target-based groups may omit `tests`; no selector-core language branch exists.
12. [ ] Full repository verify, content/frontmatter checks, `npm pack --dry-run`, and the `agent-pipeline-reviewer` review pass.
