# Selector Core: Test Impact Selection

> **Document**: 03-03-selector-core.md
> **Parent**: [Index](00-index.md)

## Overview

The selector core answers one question: **given a change set, which test groups must run at this gate?** It is language-neutral. It uses the map's ownership globs, dependency edges, tiers, and policy, then returns a deterministic selection with reasons and argv-safe commands.

The core does not execute tests; the CLI and runner do ([03-04](03-04-cli-and-runner.md)). It does not know Git or a language beyond the change-set input and the map.

## Architecture

```text
baseline / branch ref
        │
        ▼
 change detection ──► normalize ──► ignore / full-on
        │                              │
        ▼                              ▼
 group ownership match          (full fallback)
        │
        ▼
 direct groups ──► reverse dependency closure ──► always-run ──► tier/gate filter
        │                                                           │
        ▼                                                           ▼
 selection result (groups, commands, deferred, reasons, budget)
```

### Module boundaries

| Module | Responsibility |
| --- | --- |
| `bin/lib/test-map.mjs` | Load and merge map/fragments ([03-02](03-02-test-map-model.md)) |
| `bin/lib/test-map-validate.mjs` | Validation, ownership/slice health, default severity, and exit-code classification (03-02) |
| `bin/lib/test-selection-glob.mjs` | Minimal glob-to-regex matcher and path normalization |
| `bin/lib/test-selection-changes.mjs` | Git change-set collection and branch-aware baseline resolution |
| `bin/lib/test-selection.mjs` | Selection algorithm, closure, gate policy, budget, result shape |
| `bin/lib/test-selection-explain.mjs` | Human-readable reasons and summaries |
| `bin/lib/test-runner.mjs` | Command execution ([03-04](03-04-cli-and-runner.md)) |

No module in this list contains a language branch (AR-3).

## Implementation Details

### Change detection

Inputs:

- explicit `--baseline <tree|ref>` (highest priority; exec-plan passes the phase baseline tree here);
- `CODEOPS_TEST_BASE` environment variable (agent/CI convenience);
- `--last-full-sha <sha>` or `CODEOPS_LAST_FULL_SHA` for the integration/nightly marker;
- a branch-aware base (see below);
- `HEAD` only for an explicit local `--baseline HEAD` / uncommitted-only selection;
- if none resolve, return `full` with `reason: "unresolved-base"`.

Branch-aware base (AR-19):

| Branch/ref | Base |
| --- | --- |
| `feature/**` | merge-base with `main`/`master` |
| PR to `main`/`master` | merge-base with the target branch |
| `release/**`, `hotfix/**` | previous release tag, else merge-base with `main`/`master` |
| `acceptance/**` | release branch/tag under acceptance, else merge-base with `main`/`master` |
| `v*` tag | previous release tag |
| `main`/`master` | previous successful full-run ref. If the marker is missing, unreadable, or not an ancestor of `HEAD`, return `full` (`reason: "unresolved-base"` or `marker-missing`). For a PR, use the merge-base with the target; never `HEAD` as a fallback. |

Change collection:

1. Use the phase baseline tree SHA when provided. The existing snapshot helper already includes committed, staged, unstaged, and untracked files in the tree; the selector diffs the tree to the current worktree.
2. Otherwise diff the resolved base to the worktree, including both sides of renames and deletions.
3. Add untracked, non-ignored files.
4. Normalize to POSIX separators; reject absolute paths, `..`, NUL, and paths outside the repo root.
5. Apply `fullOnPaths` first; any match returns `mode: "full"` with the matching paths. A path that is both full-on and ignored is still full (safety wins).
6. Apply `ignorePaths`; if all remaining changed paths are ignored, return `mode: "none"`.

The selector never scans the whole repository for normal selection; it processes only the change set. `check` may scan tracked files for classification (FR-19 performance).

### Glob matching

A small dependency-free matcher supports:

- `*` — any characters except `/`;
- `**` — any characters including `/`;
- `?` — one character except `/`;
- character classes `[abc]`, `[a-z]`, `[!abc]`;
- escaping with `\`.

Braces, extglobs, and negation groups are not supported; validation rejects them with a clear message. Globs are matched against normalized repo-relative paths. Matching is case-sensitive on every platform (Git path semantics); a policy `caseSensitive: false` may opt into case-insensitive matching with a warning, and the result records the effective mode. An empty match list is a validation error, not a silent skip.

### Selection

1. **No map** → `{ mode: "full", reason: "no-map" }` (AR-2).
2. **Explicit `--full` / `CODEOPS_FULL_TESTS=1`** → full, reason `forced`.
3. **Ignore/full-on** as above.
4. **Direct groups:** groups whose `sources` or `tests` match any changed path.
5. **Unknown path:** if a changed path matches no group, no `fullOnPaths`, and no `ignorePaths`, return full with `reason: "unknown-path"` (AR-20).
6. **Reverse closure:** add every group that transitively depends on a selected group (`dependsOn` edges). This is downstream-only; upstream providers are not added (AR-4).
7. **Always-run:** add `alwaysRun` groups eligible for the gate.
7b. **PR smoke:** at the `pr` gate, add `policy.prSmoke` groups (if not already selected) with reason `smoke`.
8. **Gate filter:** keep groups allowed by the gate (see below); record excluded groups as `deferred` with their tier.
9. **Threshold (partial gates only):** for `task`, `phase`, and `pr`, if selected groups / total groups ≥ `fullThreshold` (default 0.6), return full with `reason: "threshold"` (AR-20). `release` and `acceptance` always select all groups and skip this check.
10. **Budget:** estimate `sum(durationSec)` for selected task groups; report `within-target` (≤120), `acceptable` (121–180), `over-budget` (>180). Never drop a group (AR-7).
11. **Commands:** expand each group's `run.command`; replace `{tests}` with the group's **full resolved test set** — every test file matched by the group's `tests` globs, independent of the change set — as separate argv entries; keep other args verbatim. An empty resolved set is a `map.empty-group` error or a full fallback. For target-based runners, `{tests}` is absent and the command is used as-is.
12. **Result:** deterministic order by slice/id; include reasons, changed paths, deferred groups, warnings, and the map hash.

Included paths from `--include` are added to the change set before direct matching; an included path with no owning group returns `full` with `unknown-path`. Exec-plan passes the plan's declared spec file(s) here. The last-full marker is supplied by `--last-full-sha` / `CODEOPS_LAST_FULL_SHA`; CI passes the push event's `before` SHA when no marker is available. A marker that is not an ancestor of `HEAD` is treated as missing.

### Gate policy

| Gate | Groups | Typical trigger |
| --- | --- | --- |
| `task` | `tier: task` + always-run task | Agent per task |
| `phase` | `task` + `phase` | Plan phase exit |
| `pr` | `task` + `phase` + always-run + `policy.prSmoke` | Pull request |
| `release` | all tiers | Release/package branch, release tag |
| `acceptance` | all tiers + acceptance groups | Acceptance branch/environment |
| `nightly` | all tiers when changed | Scheduled change-triggered run |

`deferTo` is not a separate field; the tier is the policy. A group may be `tier: release` and still be selected at a task gate only if it is `alwaysRun` and task-tier — which validation forbids. Slow tests are moved to a higher tier, not hidden.

### Reasons and evidence

Every selected group carries one or more reasons:

- `direct-source` — a changed source matched `sources`;
- `direct-test` — a changed test matched `tests`;
- `dependent` — a selected group depends on it (reverse edge);
- `always-run` — configured;
- `smoke` — selected by `policy.prSmoke` at the PR gate.

Every deferred group carries `deferred-tier`. The result records the base ref/tree, changed path count, unknown paths, budget status, fallback reason, and map hash. This is the evidence the plan and reviewer record (AR-26).

### Result shape

```jsonc
{
  "schema": 1,
  "mode": "groups" | "full" | "none",
  "gate": "task",
  "base": { "kind": "tree", "value": "<sha>" },
  "mapHash": "<sha256>",
  "changed": ["web/billing/invoice-dialog/Dialog.tsx"],
  "selected": [
    { "id": "billing.invoice-dialog.unit", "slice": "billing.invoice-dialog", "reasons": ["direct-source"] }
  ],
  "deferred": [
    { "id": "billing.invoice-dialog.e2e", "reason": "deferred-tier" }
  ],
  "skipped": ["inventory.stock-dialog.unit"],
  "commands": [
    { "id": "billing.invoice-dialog.unit", "argv": ["npm", "run", "test", "--", "path"], "cwd": "." }
  ],
  "budget": { "estimatedSec": 60, "status": "within-target" },
  "warnings": [],
  "reason": null
}
```

For `mode: full`, `commands` contains the map's `full` argv when one is configured; with no map it is empty, `fullCommand` is `null`, and the caller uses `--full-command` or the project's existing full job. `reason` explains why. For `mode: none`, commands is empty and a docs-only explanation is present.

### Non-disruption

- No map: exact full behavior (AR-2).
- Any error in load/resolve/match/command construction: full with `reason`, never a partial selection (AR-20). `select` and `plan` return this full result with exit 0 for recoverable errors; exit 3/5 is reserved for `check` and `--no-fallback`.
- `--gate release`/`acceptance` always uses all groups; selection cannot narrow the release gate.
- The selector never edits the map or tests.
- `CODEOPS_FULL_TESTS=1` forces full at every gate.

## Code Examples

### Select for a dialog change

```text
$ codeops-test select --gate task --baseline <phase-tree>
mode: groups
gate: task
selected:
  billing.invoice-dialog.unit   direct-source
  shared.auth.contract          always-run
deferred:
  billing.invoice-dialog.e2e    deferred-tier
budget: 75s / 120s (within-target)
```

### Compiler codegen change

```text
$ codeops-test select --gate task --baseline <phase-tree>
selected:
  codegen.x86.unit              direct-source
  assembler.unit                dependent
  compiler.e2e                  dependent (deferred-tier)
skipped:
  lexer.unit, parser.unit, lsp.public-api
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| --- | --- | --- |
| No map | Full | AR-2 |
| Unresolved base | Full, `unresolved-base` | AR-19 |
| Unknown/unowned path | Full, `unknown-path` | AR-20 |
| Full-on path | Full, matching paths listed | AR-20 |
| Shared test support | Full or shared dependency group | AR-22 |
| Invalid glob | `check` error; selection full | AR-24 |
| Path escape | Validation error; never read | AR-24 |
| Dependency cycle | Validation error; selection full | AR-2, AR-20 |
| Selected fraction over threshold | Full, `threshold` | AR-20 |
| Over budget | Keep all groups; warning + breakdown | AR-7 |
| Docs-only | `none`; no test commands | AR-21 |
| Selector exception | Full with error reason | AR-20 |
| Invalid/stale map | Full with a visible reason; `check` reports the defect | AR-20 |
| Main marker missing or not an ancestor | Full, `marker-missing` / `unresolved-base` | AR-19 |
| Included path has no owning group | Full, `unknown-path` | AR-20 |

## Testing Requirements

- Spec tests for each fallback and each gate.
- Direct/dependent/always-run/deferred reason tests.
- Rename, delete, untracked, docs-only, shared-support, unknown-path tests.
- Glob tests: `*`, `**`, `?`, classes, escapes, Windows separators, case mode.
- Dependency direction tests (codegen does not select lexer/parser/LSP; parser selects downstream).
- Budget threshold tests (120/180/over) and no-drop assertion.
- Threshold/fallback tests.
- `--include` spec-file selection: owned path selects its group; unowned path returns full.
- Main-branch marker tests: missing, unreadable, non-ancestor, and present marker.
- Determinism: same change set + map → same JSON, with case-sensitive matching on every platform.
- Performance fixture: 1,000 changed paths, 100 groups, <2 s.
- Security: absolute/`..`/NUL/symlink escape rejected; no shell construction.
