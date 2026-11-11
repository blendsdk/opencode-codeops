# Organize Tests Skill: Test Impact Selection

> **Document**: 03-06-organize-tests-skill.md
> **Parent**: [Index](00-index.md)

## Overview

`organize-tests` is the adoption skill for existing projects. It analyzes the repository's test suite and source structure, proposes feature-slice groups and language adapters, previews the map/AGENTS.md/CI changes, runs shadow mode, applies the map only after approval, and provides drift/health checks.

It is additive and non-destructive: it does not edit test files, delete tests, rewrite CI, or change the full gate. Adoption is opt-in; a project can stop at any preview and keep today's flow (AR-29, AR-36).

## Architecture

```text
inventory ─► slice proposal ─► dependency graph ─► runner commands
    │              │                    │                  │
    └──────────────┴────────► preview (map + AGENTS + CI) ─┤
                                                           ▼
                                              shadow mode (zero misses)
                                                           │
                                                           ▼
                                                   apply / refresh
                                                           │
                                                           ▼
                                                   check / audit
```

### Modes

| Mode | Behavior |
| --- | --- |
| default | Analyze, propose, show preview, ask, then apply |
| `--dry-run` | Analysis and proposal only |
| `--check` | Read-only validation/drift report |
| `--refresh` | Update globs/edges/timings, preserve manual group edits |
| `--shadow` | Run shadow comparison and write evidence; never enable automatically |
| `--audit` | Health/overlap/slow/never-selected report |
| `--no-ci` | Skip CI patch; map and AGENTS block only |
| `--custom` | Force the custom-command adapter for an unsupported language |

### Workspace hygiene

The skill follows `_shared/workspace-hygiene.md`: previews, staging files, and captured logs go under `$CODEOPS_TMPDIR`, never inside the project; delete them before reporting completion. Every CodeOps skill links this protocol, and the content tests enforce the link.

## Implementation Details

### Skill frontmatter

```yaml
---
name: organize-tests
description: Build or refresh a test-impact map for an existing project so local development runs only affected feature-slice test groups while CI keeps a full-suite release gate. Use for organize tests, group tests, test impact map, speed up tests, affected-only testing, test selection, or test-suite health. Detects runners and language adapters, inventories tests, proposes feature slices and tiered groups, runs shadow-mode adoption, updates AGENTS.md and CI additively, and audits drift. Never edits tests or weakens the full gate.
---
```

### Protocol

1. **Preflight** — resolve the Git root, layout, existing map, manifests, runner configs, CI files, and AGENTS.md managed blocks. Refuse unsafe writes (symlinked/non-regular map, malformed existing map, missing full command).
2. **Inventory tests** — enumerate test units using native discovery where available:
   - Node: `node --test`, Vitest/Jest config/globs;
   - Rust: `cargo metadata` targets (`lib`, bins, `tests/*.rs`, examples, benches);
   - Python: `pytest --collect-only`, `unittest` discovery;
   - Go: `go list ./...`;
   - JVM: Gradle/Maven test tasks;
   - .NET: `dotnet test --list-tests`;
   - C/C++: CTest `-N`, Bazel query;
   - custom: project-supplied command.
3. **Propose slices** — feature slices for business apps; pipeline stages for compilers; modules/packages for libraries; workspace packages for monorepos. One test unit owns exactly one group. Target 5–15 groups; split slow slices.
4. **Derive dependencies** — use the native graph (Cargo metadata, Go list, Bazel/Nx, Maven/Gradle modules) or production imports; never let shared test utilities pull unrelated groups. When uncertain, add an edge or mark `alwaysRun` (AR-3, AR-22).
5. **Assign tiers** — `task` (fast unit/component/contract), `phase` (API/DB/integration), `release` (E2E/acceptance). Every slice must have a task-tier group; every slice needs release/acceptance or a group carrying `acceptance: { mode: "manual" | "external" | "na", reason }` (AR-7).
6. **Synthesize commands** — build argv subgroup commands per adapter. Verify each command actually runs a subset and at least one test; record the observed count. A zero-test command is invalid (AR-35). Resolve `{tests}` to the group's full test set; for target-based commands with no `{tests}`, omit `tests` and verify the command's own discovery. Add `policy.prSmoke` groups for the PR gate and a `requirements` probe for every `requires` name.
7. **Preview** — show a summary table (slice, tier, tests, sources, dependsOn, duration, command), file coverage, map layout, AGENTS block diff, and CI diff. Ask before writing on non-integration branches.
8. **Shadow** — run selected and full; require zero missed failures. Report pass/fail/escaped. Do not enable automatically (AR-23).
9. **Apply with staging** — render the map/policy/fragments, the thin project wrapper (`scripts/codeops-test.mjs`) if the project wants npm scripts, the `CODEOPS-TESTING` block, the CI diff, and package scripts in a staging area under `$CODEOPS_TMPDIR`; validate the map and every diff; back up existing files; write in a fixed order; on any failure restore the prior files. Never leave a partial map or a half-updated block. Validate with `check --strict`.
10. **Verify** — run `check`, one real selection, the full suite once, and `npm pack`/build as applicable. Record evidence. When metrics are enabled, emit only content-free fields (gate, selected/total, budget status, fallback reason, map hash) through the existing outcome-review/metrics surface.
11. **Refresh/audit** — `--refresh` updates globs/edges/timings without discarding manual groups; `--check` reports drift; `--audit` reports orphans, slices without task-tier tests, never-selected groups, slow groups, overlaps, and flaky candidates.

### Language adapter recipes

| Ecosystem | Natural unit | Discovery | Subset command |
| --- | --- | --- | --- |
| Node `node --test` | test file | file globs | `node --test {tests}` |
| Vitest | test file | config/project | `npx vitest run {tests}` |
| Jest | test file | config | `npx jest --runTestsByPath {tests}` |
| Rust | crate/target | `cargo metadata` | `cargo test -p <crate> --lib --tests` |
| Python | file/nodeid | `pytest --collect-only` | `python3 -m pytest {tests}` |
| Go | package | `go list ./...` | `go test ./pkg/...` |
| JVM | class/package | Gradle/Maven tasks | `./gradlew test --tests ...` |
| .NET | project/class | `dotnet test --list-tests` | `dotnet test --filter ...` |
| C/C++ | binary/target | `ctest -N`, Bazel query | `ctest -R ...`, Bazel target |
| Ruby/PHP | file | runner config | `rspec {files}`, `phpunit {files}` |
| Custom | project unit | project command | project argv |

Rust unit tests are inline in source; the crate group uses `--lib`. Go groups are package-level. C/C++ groups are binary/target-level. The adapter chooses the coarsest reliable unit; it never invents per-method selection.

### Map layout decision

- Small project (≤ ~10 groups, one team): `codeops/test-map.json`.
- Multi-team/multi-worktree: `codeops/test-map/policy.json` + `shared.json` + one fragment per bounded context. Each fragment has `domain` and `owner`; CODEOWNERS maps it to the team.
- A feature slice lives in its owning domain fragment. Cross-cutting groups live in `shared.json`.
- The skill can start single-file and split later; it must preserve IDs and commands.

### AGENTS.md testing block

The block is nested inside the existing `CODEOPS-PROJECT` managed block and owned by `organize-tests`; `analyze-project` preserves it byte-for-byte (AR-29):

```markdown
<!-- CODEOPS-TESTING:START -->
- Test map: `codeops/test-map/` (8 groups, 3 slices)
- Task verify: `npm run verify:task` (affected task-tier groups + dependents)
- Phase verify: `npm run verify:phase` (task + phase tiers)
- Gate verify: `npm run verify` (full suite; release/acceptance/CI)
- Map check: `npm run test:map:check`
- Last map check: 2026-11-11 23:36
<!-- CODEOPS-TESTING:END -->
```

For a project that wants a map-less reference, the block may include a human-readable `Test slices` table (slice, tier, tests, sources, gate) after the commands. If no map, the block says `Testing: full suite only (no test map)` and the task/phase commands are omitted.

Only `organize-tests` writes this block. `analyze-project` detects it, preserves it byte-for-byte, and warns when it is missing or stale. The block is never written by two skills.

### CI patch rules

- Add a required full gate for release/acceptance/package branches.
- Add an optional affected PR job.
- Use a stable `verify` aggregator; never rely on dynamic matrix names as required checks.
- Add nightly only when the project wants it; use the change marker.
- Add provenance/artifact promotion only when the project builds a deployable artifact. Record the tested source commit and require a reproducible rebuild when the gate ran before the build.
- Suggest a `.github/CODEOWNERS` entry for `codeops/test-map/**`; on approval, add it without touching existing ownership rules.
- Preserve existing jobs, caching, toolchain setup, and branch filters; preview every diff.
- Never use `pull_request_target` with fork code or expose secrets to fork PRs (AR-36).

### Safety rules

- No test file edits, moves, deletions, or weakening.
- No CI job removal or full-gate weakening.
- No map write without preview and approval on non-integration branches.
- No adoption on shadow misses.
- Idempotent refresh; preserve manual group edits and owner fields.
- Refuse malformed/symlinked maps and paths outside the root.
- Stage and validate every write; restore prior files on failure. Never leave a partial map or block.

## Code Examples

### Proposal summary

```text
Slice                         Tier   Tests  Est.  Depends on
billing.invoice-dialog        task      12   45s   shared.auth
billing.invoice-dialog        release    4  180s   billing.invoice-dialog.task
inventory.stock-dialog        task       9   38s   shared.auth
compiler.codegen.x86          task      14   70s   —
compiler.e2e                  release    6  300s   compiler.codegen.x86
```

### Shadow report

```json
{
  "verdict": "zero-missed",
  "selected": ["billing.invoice-dialog.unit"],
  "selectedResult": "passed",
  "fullResult": "passed",
  "escaped": [],
  "enabled": false
}
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| --- | --- | --- |
| No detectable runner | Use `--custom`; ask for the full and subset commands | AR-3 |
| Zero-test scoped command | Reject; require a command that runs at least one test | AR-35 |
| Shadow missed failure | Refuse adoption; report the escaped group | AR-23 |
| Map conflict/malformed | Stop; show the path and manual fix; never overwrite | AR-24 |
| Slice without task-tier tests | Warning; adoption blocked in strict | AR-7 |
| Slow group | Recommend split or phase deferral | AR-7 |
| CI has no full gate | Add advisory template; do not remove existing jobs | AR-36 |
| Fork PR/secret risk | Use `pull_request`; never `pull_request_target` with fork code | AR-36 |
| Existing user edits | Preserve; only update owned blocks/fields | AR-29 |

## Testing Requirements

- Content tests for SKILL.md frontmatter, required sections, modes, safety rules, the `_shared/workspace-hygiene.md` link, and no `${PLUGIN_ROOT}`/`.codex/` leaks.
- Content tests for the `Test slices` table and metrics wording, the per-slice `acceptance` field, target-based `tests` handling, staging/rollback rules, and the CODEOWNERS patch guidance.
- Content tests for each reference file existing and being linked.
- Fixture tests: Node, Rust, custom adapter proposals produce valid maps and nonzero commands.
- Shadow report tests: zero-missed, escaped, selected-failure.
- Check/audit tests: orphan, overlap, empty group, slice-without-task-tier, slow group.
- AGENTS block preservation test with a pre-existing block and user text.
- CI patch preview test: additive only, no job removal.
