---
name: organize-tests
description: Build or refresh a test-impact map for an existing project so local development runs only affected feature-slice test groups while CI keeps a full-suite release gate. Use for organize tests, group tests, test impact map, speed up tests, affected-only testing, test selection, or test-suite health. Detects runners and language adapters, inventories tests, proposes feature slices and tiered groups, runs shadow-mode adoption, updates AGENTS.md and CI additively, and audits drift. Never edits tests or weakens the full gate.
---

# Organize Tests

`organize-tests` adopts opt-in test-impact selection in an existing project. It
reads the project, proposes feature-slice groups and language adapters, previews
every write, proves the selection in shadow mode, and only then applies the map.
The full suite remains the release, acceptance, and CI gate.

The skill is additive. It never edits, moves, deletes, or weakens a test. It
never removes a CI job or bypasses the full gate. A project can stop after any
preview and keep its current verification flow.

## Modes

| Mode | Behavior |
| --- | --- |
| default | Analyze, propose, preview, ask, then apply |
| `--dry-run` | Analysis and proposal only; write nothing |
| `--check` | Read-only validation and drift report |
| `--refresh` | Update globs, edges, and timings; preserve manual group edits |
| `--shadow` | Run the selected and full suites, write evidence, never enable automatically |
| `--audit` | Report orphans, overlaps, slow groups, never-selected groups, and flaky candidates |
| `--no-ci` | Skip the CI patch; map and AGENTS block only |
| `--custom` | Force the custom-command adapter for an unsupported language |

## Protocol

### 1. Preflight

Resolve the Git root, layout, existing map, manifests, runner configuration, CI
files, and `AGENTS.md` managed blocks. Refuse unsafe writes: a symlinked or
non-regular map, a malformed existing map, or a project with no full command.
Never overwrite a map the skill does not own.

### 2. Inventory tests

Enumerate test units with the project's native discovery. Record the owning
source path, the test path or target, and the observed test count. The recipes
are in [references/analysis-protocol.md](references/analysis-protocol.md) and
[references/language-adapters.md](references/language-adapters.md).

### 3. Propose slices

Use feature slices for business applications, pipeline stages for compilers,
packages for libraries, and workspace packages for monorepos. One test unit owns
exactly one group. Target 5–15 groups; split a slice that is slow or spans
unrelated behavior.

### 4. Derive dependencies

Use the native graph (Cargo metadata, Go list, Bazel/Nx, Maven/Gradle modules)
or production imports. `dependsOn` points upstream: a group lists what it needs.
A change selects its own group and downstream dependents, never upstream
providers. Never let shared test utilities pull unrelated groups together; when
uncertain, add an edge or make the group `alwaysRun`.

### 5. Assign tiers

`task` is the fast unit, component, or contract tier. `phase` covers API, DB,
and integration behavior. `release` covers end-to-end and acceptance behavior.
Every slice needs at least one task-tier group and either a release/acceptance
group or a per-slice acceptance record:

```json
{ "acceptance": { "mode": "manual", "reason": "approved by the owning team" } }
```

Valid modes are `manual`, `external`, and `na`. Every record needs a reason.

### 6. Synthesize commands

Build argv commands per adapter. Run each candidate once and record the observed
test count; a command that runs zero tests is invalid. Resolve `{tests}` to the
group's full test set. For target-based runners (Rust, Go, C/C++), omit `tests`
when the command performs its own discovery; ownership then comes from `sources`
plus the command smoke test. Add `policy.prSmoke` groups for the PR gate and a
`requirements` probe for every `requires` name.

### 7. Preview

Show a summary table (slice, tier, tests, sources, dependsOn, duration, command),
file coverage, the map layout, the AGENTS block diff, and the CI diff. On a
non-integration branch, ask before writing.

### 8. Shadow

Run the selected groups, then the full suite, regardless of the first result.
Adoption requires zero missed failures. An escaped failure refuses adoption and
is reported with the group and failure tail. Never enable the map from shadow
mode. See [references/shadow-mode.md](references/shadow-mode.md).

### 9. Apply with staging

Render the map, policy, fragments, optional wrapper, `CODEOPS-TESTING` block,
CI diff, and package scripts in a staging area under `$CODEOPS_TMPDIR`. Validate
the map and every diff. Back up existing files, write in a fixed order, and
restore every prior file on failure. Never leave a partial map or a half-updated
block. Validate the staged result with `check --strict`.

### 10. Verify

Run `check`, one real selection, the full suite once, and `npm pack` or the
project build as applicable. Record the evidence. When `--metrics` is enabled,
emit only content-free fields: gate, selected/total, budget status, fallback
reason, and map hash. Never include test names, paths, output, or user text.

### 11. Refresh/audit

`--refresh` updates globs, edges, and timings without discarding manual groups or
owner fields. `--check` reports drift. `--audit` reports orphans, overlaps,
slices without a task tier, slow groups, never-selected groups, and flaky
candidates. The health rules are in
[references/map-health.md](references/map-health.md).

## AGENTS.md testing block

Only `organize-tests` writes the `<!-- CODEOPS-TESTING:START -->` /
`<!-- CODEOPS-TESTING:END -->` block. `analyze-project` detects it, preserves it
byte-for-byte, and warns when it is missing or stale; it never renders the block.
The contract, the optional `Test slices` table (slice, tier, tests, sources,
gate), and the wrapper guidance are in
[references/agents-testing-block.md](references/agents-testing-block.md).

## CI patch rules

- Add a required full gate for release, acceptance, and package branches.
- Add an optional affected PR job behind a stable `verify` aggregator.
- Add nightly only when the project wants it; use the change marker.
- Add provenance only when the project builds a deployable artifact.
- Suggest a `.github/CODEOWNERS` entry for `codeops/test-map/**`; on approval,
  add it without touching existing ownership rules.
- Preserve existing jobs, caching, toolchain setup, and branch filters. Preview
  every diff and never remove a job.
- Never use `pull_request_target` with fork code or expose secrets to fork PRs.

The advisory templates are in
[references/ci-github-actions.md](references/ci-github-actions.md) and
[references/project-wrapper.md](references/project-wrapper.md). They are
previewed like every other change and are never applied automatically.

## Safety rules

- Never edit, move, delete, or weaken a test.
- Never remove a CI job or weaken the full gate.
- No adoption on shadow misses.
- Refuse malformed or symlinked maps and paths outside the root.
- Stage and validate every write; restore prior files on failure.
- Idempotent refresh; preserve manual group edits and owner fields.
- No map write without preview and approval on non-integration branches.

## Output contract

The preview names the map layout, each slice and tier, the command per group, the
file coverage, and every file that will change. The shadow report records the
verdict, selected groups, selected result, full result, escaped groups, and
`enabled: false`. The apply report lists the written files and the validation
result. The audit report names every finding with a path or group ID.

---

> **Workspace hygiene (non-negotiable):** put every temporary artifact this run creates in
> `$CODEOPS_TMPDIR` (fallback: the OS temp directory), never in the repository, and delete them
> all before reporting completion. Never delete user files, versioned artifacts, worktrees, or
> another session's temporary files. Full rules:
> [_shared/workspace-hygiene.md](../../_shared/workspace-hygiene.md).
