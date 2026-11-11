# Branch Policy and Provenance: Test Impact Selection

> **Document**: 03-05-branch-policy-and-provenance.md
> **Parent**: [Index](00-index.md)

## Overview

This component turns the map into an auditable release flow. It classifies the current ref into a gate, emits the CI plan/matrix, handles the change-triggered nightly run, and records the evidence that lets production promote the same artifact without repeating the full suite.

It is also the anti-bypass layer: release/acceptance plans always include all groups, the stable aggregator is the required check, and provenance verification fails when the artifact digest, commit, map hash, or full-run evidence does not match.

## Architecture

```text
ref ──► branch policy ──► gate ──► plan
                                   ├── task/phase/pr: affected groups
                                   ├── release/acceptance: all groups
                                   └── nightly: all groups iff relevant change
                                            │
                                            ▼
                                   provenance record
                                   (commit, artifact digest, map hash,
                                    full-run ID, coverage, acceptance)
                                            │
                                            ▼
                                   production verify/reuse or rebuild+full
```

## Implementation Details

### Branch policy

Default policy (AR-11, AR-12):

```jsonc
{
  "integration": ["main", "master"],
  "feature": ["feature/**"],
  "release": ["release/**", "release*", "hotfix/**", "hotfix*"],
  "acceptance": ["acceptance/**", "acceptance*"],
  "releaseTags": ["v*"],
  "unknown": "integration"
}
```

Classification:

1. If the ref is a tag matching `releaseTags` → `release`.
2. If it matches `acceptance` → `acceptance`.
3. If it matches `release` → `release` (including `hotfix`).
4. If it matches `integration` → `integration`.
5. If it matches `feature` → `feature`; use the `task` gate locally and `pr` in CI.
6. Otherwise → `unknown`; use `unknown` gate (`integration`) and emit `branch.unknown` warning.

Precedence is **acceptance > release/hotfix > integration > feature**. A branch matching both `release/**` and `acceptance/**` is acceptance. A feature branch is its own class: it uses `task` locally and `pr` in CI, never the release gate. An unmatched branch remains `unknown` → integration with a warning.

Patterns support the same minimal glob syntax as selection (`*`, `**`, `?`, classes, escapes). Validate patterns at map load.

### Gate mapping

| Class | Default gate | Full? | Notes |
| --- | --- | --- | --- |
| Integration (`main`, `master`) | `pr` | No | Merge queue/PR uses affected + smoke; nightly full covers drift |
| Feature (`feature/**`, other local) | `task` locally; `pr` in CI | No | Local agent uses `task`; CI PR uses `pr` |
| Release (`release/**`, `release*`) | `release` | **Yes** | All groups; package job depends on the aggregator |
| Hotfix (`hotfix/**`, `hotfix*`) | `release` | **Yes** | Full, sharded; acceptance may be expedited manual with approval (AR-13) |
| Acceptance (`acceptance/**`, `acceptance*`) | `acceptance` | **Yes** | All groups + acceptance config |
| Release tag (`v*`) | `release` | **Yes** | Full + package |
| Unknown | `integration` | No | Warning; `check` flags release-like unknown branches |

### CI plan contract

`codeops-test plan --gate <gate> --json` returns:

```jsonc
{
  "schema": 1,
  "gate": "pr",
  "mode": "groups",
  "full": false,
  "selected": 3,
  "total": 8,
  "mapHash": "<sha256>",
  "matrix": {
    "include": [
      { "group": "billing.invoice-dialog.unit", "command": ["npm", "run", "test", "--", "..."], "cwd": "." },
      { "group": "shared.auth.contract", "command": ["npm", "run", "test:auth"], "cwd": "." }
    ]
  },
  "fullCommand": null,
  "reason": null
}
```

- `release`/`acceptance` return every group, `full: true`, and `fullCommand`; the matrix includes all groups. A provider that uses the single reusable full gate may ignore the matrix; the plan result is still complete.
- No map returns `mode: full`, `full: true`, `fullCommand: null`, and `matrix: { "include": [] }`; `run` requires `--full-command`, and CI uses the project's existing full job.
- `nightly` returns `mode: skip` with `matrix: { "include": [] }` when no relevant change since the marker; otherwise all groups.
- `mode: none` (docs-only) also returns `matrix: { "include": [] }`; it never omits the matrix.
- `mode: full` includes `fullCommand` and never encodes full as a fake group ID. `run --group` keeps rejecting unknown/unselected IDs.
- The stable aggregator consumes this JSON. It fails if the plan failed, any matrix shard failed, or the expected group count is zero for a code change. A separate required `check --strict` job makes a malformed map visible even when selection falls back to full.

### Nightly change detection

A dedicated marker records the last successful full-run SHA. The marker is supplied to the CLI as `--last-full-sha <sha>` or `CODEOPS_LAST_FULL_SHA` (in that order). A workflow may also read the dedicated ref `refs/codeops/full-verified` and pass its SHA. The marker is updated **only after a successful full gate**, with a concurrency group and the tested commit SHA, never `HEAD` of a different run. The shared main-branch base and nightly plan both use this marker.

The nightly plan compares the marker SHA to `HEAD` over the union of group `sources`/`tests`, `fullOnPaths`, and toolchain/config paths, excluding paths matched only by `ignorePaths`; a path that is both full-on and ignored counts as relevant. If no relevant path changed → `skip`. If the marker is missing/unreadable, or is not an ancestor of `HEAD`, run full and report `nightly.no-marker` / `marker-missing`. Docs-only changes skip (AR-5).

### Provenance record

```jsonc
{
  "schema": 1,
  "commit": "<40/64-char sha>",
  "ref": "refs/heads/release/2026.11",
  "gate": "release",
  "mapHash": "<sha256>",
  "full": true,
  "groups": ["billing.invoice-dialog.unit", "..."],
  "fullRunId": "<ci-run-id>",
  "artifact": { "path": "dist/app.tar.gz", "digest": "sha256:<hex>", "sourceCommit": "<tested sha>", "reproducible": true },
  "coverage": { "lines": 87.2, "branches": 80.1 },
  "acceptance": { "mode": "manual", "result": "approved", "by": "team-billing" },
  "startedAt": "2026-11-11T20:00:00Z",
  "finishedAt": "2026-11-11T20:27:00Z",
  "result": "passed"
}
```

Rules:

- `commit` must match the tested commit.
- `mapHash` must match the map used; the hash is canonical over sorted policy + groups. It is `null` only when the project has no map, in which case the record also carries `selection: "no-map"`.
- `full` must be `true` for release/acceptance records.
- `artifact.digest` is required for promotion.
- `artifact.sourceCommit` must be the commit the full gate tested. If the gate ran on source and the artifact was built later, `artifact.reproducible` must be `true` and a rebuild check must confirm the same digest; otherwise a new full gate is required on the rebuilt artifact.
- `result` must be `passed`.
- The record contains no secrets, environment values, or test output.
- `provenance write` accepts optional `--coverage <json>` and `--acceptance <json>` inputs; when absent, those fields are `null` and the record states `not-provided`. `--full-run-id` defaults to the CI run identifier when available. `--source-commit` defaults to the commit the full gate tested; it must equal `commit` for release/acceptance records.

`provenance verify` checks commit, `artifact.sourceCommit`, digest, map hash, `full: true`, `artifact.reproducible` (when the gate ran on source), and `result: passed`. On mismatch, exit 1 with the specific field.

### Artifact promotion

1. Run the full gate at release/acceptance on the tested source commit, or on the artifact when the project's tests can consume it.
2. Build the artifact once from that tested commit. When the gate ran on source, record `artifact.sourceCommit` and verify the rebuild digest is reproducible before promotion.
3. Write the provenance record with the artifact digest and the tested source commit.
4. Promote the **same digest** to acceptance/production; `provenance verify` must pass.
5. Production runs post-deploy smoke/canary; it does not re-run the full suite for the same digest.
6. If any environment rebuilds the artifact, the digest changes → a new full gate is required (AR-14).

This is the only approved reuse. It never allows a different artifact, commit, or map hash to reuse evidence.

### Stable aggregator

The CI workflow must expose one stable required check named `verify` (or equivalent). It:

- depends on the plan, every test shard, the full-gate job, and the `check --strict` job;
- fails if the plan failed, any shard failed, or the selected set is empty for a code change;
- reports `selected/total`, `gate`, `full`, `mapHash`, and the selection reason;
- is the branch-protection required check for integration, release, and acceptance branches;
- runs beside a required `check --strict` job so a malformed map is visible even when selection falls back to full.

Dynamic matrices are allowed because the aggregator is static.

## Code Examples

### Release plan (all groups)

```jsonc
{
  "gate": "release",
  "mode": "groups",
  "full": true,
  "selected": 8,
  "total": 8,
  "fullCommand": ["npm", "run", "verify"],
  "matrix": { "include": [/* all groups */] }
}
```

### Nightly skip

```jsonc
{
  "gate": "nightly",
  "mode": "skip",
  "reason": "no-relevant-change",
  "marker": "<sha>"
}
```

### Provenance mismatch

```text
$ codeops-test provenance verify --record release.json --artifact dist/app.tar.gz
provenance.artifact-mismatch: expected sha256:abc..., got sha256:def...
exit 1
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| --- | --- | --- |
| Unknown branch | Integration gate + warning; check flags release-like | AR-12 |
| Branch matches multiple patterns | Strictest gate (acceptance > release > integration) | AR-12 |
| Hotfix | Full required; expedited acceptance needs explicit approval | AR-13 |
| Missing nightly marker | Run full; report `nightly.no-marker` | AR-5 |
| No relevant nightly change | Skip, no test job | AR-5 |
| Map hash mismatch | Provenance verify fails | AR-14 |
| Artifact digest mismatch | Provenance verify fails | AR-14 |
| Rebuild after release | New full gate required | AR-14 |
| Empty selected set for code change | Aggregator fails | AR-30 |
| Plan failure | Aggregator fails | AR-30 |

## Testing Requirements

- Branch pattern tests: `main`, `master`, `feature/x`, `release/1.2`, `release-2026`, `hotfix/x`, `acceptance/rc`, `v1.2.3`, unknown.
- Marker input tests: `--last-full-sha`, env fallback, missing, unreadable, non-ancestor, and success-only update.
- Precedence tests (acceptance + release match → acceptance).
- Tag classification tests.
- Nightly marker tests: unchanged, docs-only, source change, missing marker.
- Plan JSON tests: task/phase/pr/release/acceptance/nightly/no-map.
- Matrix shape and stable aggregator semantics tests.
- Provenance tests: canonical map hash, commit mismatch, digest mismatch, missing full flag, result not passed.
- Artifact promotion tests: same digest reuse passes; rebuilt digest fails.
- Security: provenance contains no secrets; branch patterns reject invalid input.
