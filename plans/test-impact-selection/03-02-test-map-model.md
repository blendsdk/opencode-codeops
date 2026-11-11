# Test Map Model: Test Impact Selection

> **Document**: 03-02-test-map-model.md
> **Parent**: [Index](00-index.md)

## Overview

The test map is the committed contract between project structure and test selection. It lists feature slices, tiered test groups, source/test ownership, dependency edges, runner commands, budgets, branch policy, and acceptance mode. It is data: the selector never parses a language; the group's `run` command is the language adapter.

The map is opt-in. No map means today's full verify (AR-2). The map has its own `schema: 1`; `codeops/codeops.json` and the CodeOps artifact schema are unchanged (AR-15, AR-16).

## Architecture

### File layouts

Two supported shapes:

```text
# Small projects
codeops/test-map.json

# Multi-team / multi-worktree projects
codeops/test-map/
  policy.json
  shared.json
  billing.json
  inventory.json
  crm.json
```

- The single file contains policy + groups.
- The directory contains `policy.json` (branch policy, budgets, full commands, ignore/full-on paths) plus one or more group fragments. `shared.json` holds cross-cutting groups.
- `policy.json` is required in the directory layout because the full command must come from the project, not be invented. Defaults may fill optional policy fields (budgets, branches), not `full`.
- A project may not mix `codeops/test-map.json` and `codeops/test-map/`; the single file wins with a warning, or validation fails in `--strict`.

### Group model

```jsonc
{
  "id": "billing.invoice-dialog.unit",
  "slice": "billing.invoice-dialog",
  "tier": "task",
  "description": "Invoice dialog component and API handler",
  "owner": "team-billing",
  "sources": ["web/billing/invoice-dialog/**", "api/billing/invoice/**"],
  "tests": ["web/billing/invoice-dialog/**/*.test.tsx", "api/billing/invoice/**/*.test.ts"],
  "dependsOn": [],
  "alwaysRun": false,
  "durationSec": 45,
  "parallelSafe": true,
  "requires": ["db"],
  "run": {
    "command": ["npm", "run", "test", "--", "{tests}"],
    "cwd": "."
  }
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Globally unique, dotted, stable. Never reused for a different slice. |
| `slice` | yes | Feature-slice identifier shared by the slice's tiers. |
| `tier` | yes | `task`, `phase`, `release`, or `acceptance`. |
| `sources` | yes | Source/contract globs that select this group. May be `[]` only for an `alwaysRun` or `shared.*` group. |
| `tests` | conditional | Test-unit globs owned by this group. Required for file-based groups; optional when `run.command` contains no `{tests}` (target-based runners such as Rust, Go, and C/C++). For target-based groups these are ownership metadata only. |
| `run` | yes | Argv command; `{tests}` expands to the group's full resolved test file set as separate argv entries. `cwd` must remain inside the repo. |
| `dependsOn` | no | Upstream group IDs; selection walks reverse edges. |
| `alwaysRun` | no | Include in every task/phase slice; must be `tier: task` and fast. Default `false`. |
| `durationSec` | no | Estimated wall-clock seconds; used for the soft budget. |
| `parallelSafe` | no | May run concurrently with other groups. Default `false` (sequential). |
| `requires` | no | Services/resources (`db`, `browser`, `docker`, `device`). Every name must have a matching `policy.requirements` check; a non-zero check fails the group, never skips it. |
| `owner` | no | Team/agent ownership used by CODEOWNERS and reports. |
| `description` | no | Human-readable purpose. |
| `acceptance` | no | Per-slice exception record: `{ mode: "manual"\|"external"\|"na", reason }`. One group in the slice may carry it; it satisfies the slice-release rule. |

### Policy fields

```jsonc
{
  "schema": 1,
  "full": ["npm", "run", "verify"],
  "budgets": { "taskTargetSeconds": 120, "taskAcceptableSeconds": 180 },
  "branches": {
    "integration": ["main", "master"],
    "release": ["release/**", "release*", "hotfix/**", "hotfix*"],
    "acceptance": ["acceptance/**", "acceptance*"],
    "releaseTags": ["v*"],
    "unknown": "integration"
  },
  "ignorePaths": [
    { "glob": "docs/**", "reason": "documentation" },
    { "glob": "**/*.md", "reason": "documentation" },
    { "glob": "LICENSE", "reason": "legal text" },
    { "glob": ".gitignore", "reason": "repository metadata" }
  ],
  "fullOnPaths": [
    "package.json", "package-lock.json", "tsconfig*.json",
    "codeops/test-map.json", "codeops/test-map/**",
    "scripts/codeops-test.mjs", ".github/workflows/**",
    "test/setup/**", "Cargo.toml", "Cargo.lock", "rust-toolchain.toml"
  ],
  "acceptance": {
    "mode": "automated",
    "groups": ["billing.invoice-dialog.e2e"],
    "checklist": null
  },
  "prSmoke": ["shared.auth.contract"],
  "requirements": {
    "db": { "check": ["pg_isready"] },
    "browser": { "check": ["npx", "playwright", "--version"] }
  },
  "caseSensitive": true
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `schema` | yes | `1`. |
| `full` | yes | Argv tokens for the full verify command: a flat argv array for one command, or an array of argv arrays for several. Strings are rejected; `{tests}` is not allowed. Polyglot projects use an umbrella script or multiple argv arrays. |
| `budgets` | no | Soft task budget; defaults 120/180. |
| `branches` | no | Branch/tag classification; defaults from AR-11. |
| `ignorePaths` | no | Array of `{ glob, reason }` entries for docs/assets; the reason is required. |
| `fullOnPaths` | no | Shared/config/toolchain paths that force full. |
| `acceptance` | no | `mode: automated\|manual\|external`, optional `groups`, optional `checklist` path. |
| `testRoots` | no | Optional override for the conventional test-root prefixes used by `check`; defaults to the `tests` glob prefixes plus `test/`, `tests/`, `spec/`, `__tests__/`. |
| `fullThreshold` | no | For partial gates, if selected groups exceed this fraction of all groups (default 0.6), use full. |
| `prSmoke` | no | Group IDs that run at the `pr` gate in addition to task/phase/always-run groups. |
| `requirements` | no | Map of service name to `{ check: [argv...] }`; used by `requires`. |
| `caseSensitive` | no | Default `true`. When `false`, path matching is case-insensitive and the selector reports the override. |

### Language-neutral runner contract

The core does not know a language. It knows:

1. `sources` and `tests` globs for ownership/change matching.
2. `run.command` argv for the group subset.
3. `dependsOn` edges.
4. `tier`/gate policy.

Examples:

| Ecosystem | Group command |
| --- | --- |
| Node `node --test` | `["node", "--test", "{tests}"]` |
| Vitest | `["npx", "vitest", "run", "{tests}"]` |
| Jest | `["npx", "jest", "--runTestsByPath", "{tests}"]` |
| Rust | `["cargo", "test", "-p", "codegen-x86", "--lib", "--tests"]` |
| Python | `["python3", "-m", "pytest", "-q", "{tests}"]` |
| Go | `["go", "test", "./pkg/..."]` |
| JVM | `["./gradlew", "test", "--tests", "com.example.core.*"]` |
| .NET | `["dotnet", "test", "--filter", "FullyQualifiedName~Core"]` |
| C/C++ | `["ctest", "--test-dir", "build", "-R", "^core_"]` |
| Custom | Project-supplied argv |

Rust unit tests are inline in source; a crate group uses `--lib --tests`, not `{tests}`. Go groups are package-level. C/C++ groups are binary/target-level. A target-based group may omit `tests`; the command performs discovery and `sources` carries ownership. The adapter chooses the coarsest reliable unit; never finer than the runner can reliably identify (AR-3).

## Implementation Details

### Load and merge

1. Resolve the repo root and layout marker.
2. If no map path exists, return `{ mode: "no-map" }`.
3. If `codeops/test-map.json` exists, load it.
4. Else load `codeops/test-map/policy.json` (required) and every `*.json` fragment in sorted order. `shared.json` loads first; domain fragments load next.
5. Merge policy: later fragments may not override `full`, `budgets`, `branches`, or `acceptance`; only policy owns those. A duplicate key is an error.
6. Merge groups by `id`; duplicate IDs are an error.
7. Normalize globs to POSIX separators; reject absolute paths, `..`, NUL, empty globs, and paths outside the root.
8. Validate dependency references, cycles, and cross-fragment edges.
9. Compute the map hash from the canonical sorted JSON of policy + groups (see [03-05](03-05-branch-policy-and-provenance.md)).

### Validation rules

| Rule | Error code |
| --- | --- |
| Unsupported `schema` | `map.schema` |
| Missing `policy.json` in a map directory | `map.policy` |
| Missing `full` | `map.full` |
| Duplicate group ID | `map.duplicate-id` |
| Invalid/empty `id`, `slice`, `tier` | `map.group` |
| Missing `sources`; missing `tests` on a file-based group; empty `sources` on a non-always-run/non-shared group | `map.group` |
| Absolute/`..`/NUL/outside-root path | `map.path` |
| `ignorePaths` entry without a reason | `map.ignore-reason` |
| `ignorePaths` overlaps a group `sources`/`tests` or a `fullOnPaths` entry | `map.ignore-overlap` |
| Unknown `dependsOn` reference | `map.dependency` |
| Dependency cycle | `map.cycle` |
| Empty group (no test match) for a file-based group; target-based groups with no `{tests}` are exempt | `map.empty-group` |
| Test file owned by more than one group | `map.overlap` |
| Test file owned by no group (under tracked test roots) | `map.orphan-test` |
| Slice has no `task` tier | `map.slice-no-task` |
| Slice has no `release`/`acceptance` tier and no group carries a per-slice `acceptance` record | `map.slice-no-release` |
| `alwaysRun` group is not `task` tier | `map.always-run-tier` |
| Invalid branch pattern / unknown gate | `map.branch` |
| `run.command` empty/non-string argv | `map.command` |
| `cwd` outside root | `map.cwd` |
| `fullThreshold` outside 0–1 | `map.threshold` |
| Invalid `full` shape (string or single argv element with whitespace/shell metacharacters) | `map.full` |
| `requires` name without a matching `policy.requirements` check | `map.requires` |
| Invalid per-slice `acceptance` record | `map.acceptance` |

`check` returns a structured report. **Default severity and exit code:** malformed-map rules (`map.schema` through `map.threshold`, including `map.full`, `map.requires`, `map.cycle`, and `map.empty-group`) are errors (exit 3). The drift/health rules `map.overlap`, `map.orphan-test`, `map.unknown-source`, `map.slice-no-task`, and `map.slice-no-release` are warnings in normal mode (exit 0) and errors with `--strict` (exit 4). CI uses `--strict` on release/acceptance; local `check` may be advisory. Test roots are the directory prefixes of every `tests` glob plus the project's conventional roots (`test/`, `tests/`, `spec/`, `__tests__/`); the project may override the conventional list in policy.

### Slice contract

Every feature slice must have:

- at least one `tier: task` group (fast unit/component/contract tests);
- a `tier: phase` group if it has API/DB/integration behavior;
- a `tier: release` or `tier: acceptance` group, or a group in the slice carrying `acceptance: { mode: "manual" | "external" | "na", reason }`.

A slice with only slow E2E tests is flagged; the fix is to add fast task-tier tests or split the slice (AR-6, AR-7).

A target-based group whose `run.command` contains no `{tests}` may omit `tests`; its ownership is validated through `sources` and the command's own discovery, not through file globs.

### Full-on and ignore classification

Every tracked source path is eventually classified as:

1. owned by a group's `sources` or `tests`;
2. matched by `fullOnPaths`;
3. matched by `ignorePaths` (docs/assets only, with a reason in strict mode).

An unclassified path is a `map.unknown-source` warning in normal mode and an error in `--strict`. At selection time, an unknown changed path always falls back to full (AR-20).

## Code Examples

### ERP fragment

```jsonc
{
  "schema": 1,
  "domain": "billing",
  "owner": "team-billing",
  "groups": [
    {
      "id": "billing.invoice-dialog.unit",
      "slice": "billing.invoice-dialog",
      "tier": "task",
      "sources": ["web/billing/invoice-dialog/**", "api/billing/invoice/**"],
      "tests": ["web/billing/invoice-dialog/**/*.test.tsx", "api/billing/invoice/**/*.test.ts"],
      "dependsOn": [],
      "durationSec": 60,
      "parallelSafe": true,
      "run": { "command": ["npm", "run", "test", "--", "{tests}"] }
    },
    {
      "id": "billing.invoice-dialog.e2e",
      "slice": "billing.invoice-dialog",
      "tier": "release",
      "sources": ["web/billing/invoice-dialog/**", "api/billing/invoice/**"],
      "tests": ["tests/e2e/billing/invoice-dialog/**/*.spec.ts"],
      "dependsOn": ["billing.invoice-dialog.unit"],
      "durationSec": 240,
      "run": { "command": ["npx", "playwright", "test", "{tests}"] }
    }
  ]
}
```

### Compiler fragment

```jsonc
{
  "schema": 1,
  "domain": "compiler",
  "groups": [
    {
      "id": "codegen.x86.unit",
      "slice": "codegen.x86",
      "tier": "task",
      "sources": ["crates/codegen-x86/src/**"],
      "tests": ["crates/codegen-x86/tests/**/*.rs"],
      "dependsOn": [],
      "run": { "command": ["cargo", "test", "-p", "codegen-x86", "--lib", "--tests"] }
    },
    {
      "id": "assembler.unit",
      "slice": "assembler",
      "tier": "task",
      "sources": ["crates/assembler/src/**"],
      "tests": ["crates/assembler/tests/**/*.rs"],
      "dependsOn": ["codegen.x86.unit"],
      "run": { "command": ["cargo", "test", "-p", "assembler", "--lib", "--tests"] }
    },
    {
      "id": "compiler.e2e",
      "slice": "compiler.e2e",
      "tier": "release",
      "sources": ["crates/**", "tests/corpus/**"],
      "tests": ["tests/e2e/**/*.rs"],
      "dependsOn": ["assembler.unit"],
      "run": { "command": ["cargo", "test", "-p", "compiler-e2e", "--test", "corpus"] }
    }
  ]
}
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| --- | --- | --- |
| No map | Return `no-map`; run full | AR-2 |
| Invalid JSON | `map.parse`; `check` exits 3; `run` falls back full | AR-20 |
| Duplicate ID/cycle | Validation error; no partial selection | AR-2, AR-20 |
| Path outside root | Validation error; never read/execute it | AR-24 |
| Empty/overlapping groups | `check` reports the defect; selection falls back full if it encounters the issue | AR-20 |
| Unknown source | `check` warning (error in strict); selection full | AR-20 |
| Slice missing task tier | `check` warning/error; adoption blocked in strict | AR-7 |
| Missing runner command | Validation error; no selection | AR-18 |

## Testing Requirements

- Loader tests for single-file, directory, policy + fragments, shared + domain, duplicate policy keys.
- Validation tests for duplicate IDs, cycles, path traversal, absolute paths, NUL, empty groups, overlaps, orphans, slice contract.
- Fixtures for Node (file-based), Rust (target-based, including a crate with only inline unit tests), and a custom command runner.
- Map hash determinism tests (same content, different order → same hash).
- Strict vs non-strict classification tests, including the default severity and exit-code table.
- `full` argv validation (string, one-element-with-spaces, nested multi-command), `prSmoke`, `requirements`, per-slice `acceptance`, and `caseSensitive` tests.
- Do not test language parsing in the core; only group commands and ownership globs.
