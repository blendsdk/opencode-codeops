# CI and Release Integration: Test Impact Selection

> **Document**: 03-07-ci-release-integration.md
> **Parent**: [Index](00-index.md)

## Overview

This component makes the gate ladder real in GitHub Actions while keeping the existing full gate intact. It adds a reusable full-gate workflow, an affected-plan job, a stable `verify` aggregator, a change-triggered nightly workflow, and release provenance/artifact promotion templates. The templates are advisory for user projects; this repository adopts the reusable full gate as a reference.

The design is additive. No existing job is removed, no path filter is allowed to skip the full gate on release/acceptance, and no project is forced to adopt dynamic shards (AR-36).

## Architecture

```text
PR / feature branch:
  plan(affected) ─► test shards (matrix) ─► verify aggregator (required)

main / master:
  PR gate + merge queue; nightly full when changed

release/** / hotfix/** / v* tag:
  full gate (tested source; or artifact when practical) ─► build artifact (reproducible) ─► package ─► provenance ─► deploy

acceptance/**:
  full gate + acceptance groups (tested source; or artifact when practical) ─► build artifact (reproducible) ─► provenance

production:
  provenance verify (same artifact digest) ─► deploy ─► post-deploy smoke/canary
```

## Implementation Details

### Reusable full gate (`verify-full.yml`)

```yaml
name: Verify Full
on:
  workflow_call:
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: "24"
      - run: npm ci --ignore-scripts
      - run: npm run verify
      - run: npm pack --dry-run
```

The reusable workflow is the full gate. It is called by `ci.yml` on PR/main, by `release.yml` before packaging, and by `acceptance.yml` if the project has one. It is the only place that runs the full suite in CI.

### Affected plan and shards

```yaml
jobs:
  plan:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.plan.outputs.matrix }}
      full: ${{ steps.plan.outputs.full }}
      mode: ${{ steps.plan.outputs.mode }}
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - run: npm ci --ignore-scripts
      - id: plan
        run: node bin/codeops-test.mjs plan --gate pr --since "origin/${{ github.base_ref }}" --json > plan.json
      - run: echo "matrix=$(jq -c .matrix plan.json)" >> "$GITHUB_OUTPUT"
      - run: echo "full=$(jq -r .full plan.json)" >> "$GITHUB_OUTPUT"
      - run: echo "mode=$(jq -r .mode plan.json)" >> "$GITHUB_OUTPUT"
      - uses: actions/upload-artifact@v4
        with:
          name: test-plan
          path: plan.json
  test:
    needs: plan
    if: needs.plan.outputs.mode == 'groups' && needs.plan.outputs.matrix != '{"include":[]}'
    strategy:
      fail-fast: false
      matrix: ${{ fromJSON(needs.plan.outputs.matrix) }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: npm ci --ignore-scripts
      - uses: actions/download-artifact@v4
        with:
          name: test-plan
      - run: node bin/codeops-test.mjs run --selection plan.json --group "${{ matrix.group }}"
  full:
    needs: plan
    if: needs.plan.outputs.mode == 'full'
    uses: ./.github/workflows/verify-full.yml
  check:
    needs: plan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: npm ci --ignore-scripts
      - run: node bin/codeops-test.mjs check --strict
  verify:
    needs: [plan, test, full, check]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - run: |
          test "${{ needs.plan.result }}" = "success"
          test "${{ needs.check.result }}" = "success"
          if [ "${{ needs.plan.outputs.mode }}" = "groups" ]; then
            test "${{ needs.test.result }}" = "success"
          fi
          if [ "${{ needs.plan.outputs.mode }}" = "full" ]; then
            test "${{ needs.full.result }}" = "success"
          fi
```

The `verify` job is the stable required check. It fails on a plan failure, any shard failure, a full-gate failure, a `check --strict` failure, or an empty selection for a code change. A plan with `mode: none` (docs-only) or `mode: skip` (nightly) is a success with no test shards. The plan always emits `matrix: {include: []}` for those modes; the matrix is never absent. Full is a separate job, never a fake group ID. Dynamic matrices never become branch-protection checks.

### Release and package gate

```yaml
jobs:
  verify:
    uses: ./.github/workflows/verify-full.yml
  package:
    needs: verify
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: npm ci --ignore-scripts
      - run: npm run build
      - run: node bin/codeops-test.mjs provenance write --gate release --artifact dist/app.tar.gz --source-commit "$GITHUB_SHA" --record release.json
      - uses: actions/upload-artifact@v4
        with:
          name: release-evidence
          path: release.json
```

The package job depends on the full gate. Because this gate runs on source, `provenance write` records the tested source commit (`--source-commit`) and the artifact digest; `provenance verify` fails if `artifact.sourceCommit` differs from the tested commit or if a reproducible rebuild produces a different digest. If a project can run its tests against the built artifact, build before the gate and let the gate consume that artifact instead. `release.yml` in this repository already runs `npm run verify` before publish (`release.yml:69-70`); the plan refactors it to call the reusable full gate so the behavior is unchanged but reusable.

### Acceptance

The acceptance workflow runs `plan --gate acceptance`, all groups plus acceptance groups, and writes provenance with `acceptance.mode` from the map. Manual acceptance records the approver and checklist result; external acceptance records the environment and result. If the same artifact digest is promoted to production, `provenance verify` is sufficient; otherwise a new full gate runs (AR-14).

### Nightly

```yaml
name: Nightly Full
on:
  schedule: [{ cron: "0 3 * * *" }]
  workflow_dispatch:
jobs:
  plan:
    runs-on: ubuntu-latest
    outputs:
      run_full: ${{ steps.plan.outputs.run_full }}
    steps:
      - uses: actions/checkout@v7
        with: { fetch-depth: 0 }
      - run: npm ci --ignore-scripts
      - id: plan
        env:
          CODEOPS_LAST_FULL_SHA: ${{ vars.CODEOPS_LAST_FULL_SHA }}
        run: node bin/codeops-test.mjs plan --gate nightly --last-full-sha "$CODEOPS_LAST_FULL_SHA" --json > plan.json
      - run: echo "run_full=$(jq -r '.mode != "skip"' plan.json)" >> "$GITHUB_OUTPUT"
  full:
    needs: plan
    if: needs.plan.outputs.run_full == 'true'
    uses: ./.github/workflows/verify-full.yml
  update-marker:
    needs: full
    if: needs.full.result == 'success'
    runs-on: ubuntu-latest
    permissions:
      actions: write
    steps:
      - run: gh variable set CODEOPS_LAST_FULL_SHA --body "$GITHUB_SHA"
        env:
          GH_TOKEN: ${{ github.token }}
```

The marker is passed as `--last-full-sha`/`CODEOPS_LAST_FULL_SHA` and updated only after a successful full run, with a concurrency group around the nightly job. A missing, unreadable, or non-ancestor marker → full (safe). Docs-only change → skip (AR-5).

### Branch protection and merge queue

- Require the stable `verify` check on `main`/`master`, `release/**`, `hotfix/**`, and `acceptance/**`.
- Use a merge queue on `main`/`master`; the plan runs on the merge result.
- Do not use path filters that bypass `verify` on release/acceptance.
- Do not use `pull_request_target` with fork code; the map contains commands and must be treated as code.
- Protect `codeops/test-map/**` with CODEOWNERS; map changes are reviewed like CI changes (AR-24, AR-36). The pilot task creates `.github/CODEOWNERS` for this repository.

### This repository's changes

- Add `.github/workflows/verify-full.yml` with `workflow_call`.
- Add `.github/CODEOWNERS` covering `codeops/test-map/**`; the map is reviewed like CI code.
- Refactor `.github/workflows/ci.yml` to call it (behavior unchanged: full verify + pack check).
- Refactor `.github/workflows/release.yml` to call it before publish (behavior unchanged).
- Do not add an affected PR job or nightly workflow until the pilot map is validated in shadow mode. The templates remain in the skill references.
- Keep the existing Node 24 setup and `npm ci --ignore-scripts`.

## Code Examples

### Plan output for a PR

```json
{
  "gate": "pr",
  "mode": "groups",
  "full": false,
  "selected": 3,
  "total": 8,
  "matrix": {
    "include": [
      { "group": "billing.invoice-dialog.unit", "command": ["npm", "run", "test", "--", "path"] }
    ]
  }
}
```

### Nightly skip

```json
{ "gate": "nightly", "mode": "skip", "reason": "no-relevant-change", "matrix": { "include": [] } }
```

### Provenance promotion

```text
$ codeops-test provenance verify --record release.json --artifact dist/app.tar.gz --commit "$GITHUB_SHA"
PASS  artifact sha256:abc...  map <hash>  full-run 12345
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| --- | --- | --- |
| Plan job fails | Aggregator fails | AR-30 |
| A shard fails | Aggregator fails | AR-30 |
| Empty selection for code change | Aggregator fails | AR-30 |
| Release/acceptance has no full gate | CI configuration error; skill warns, never silently accepts | AR-4 |
| Nightly marker missing | Run full; report | AR-5 |
| Provenance mismatch | Fail promotion; rebuild or re-verify | AR-14 |
| Different artifact digest | New full gate | AR-14 |
| Fork PR / secrets | Use `pull_request`; no secrets; CODEOWNERS | AR-36 |
| Existing CI job conflict | Preview additive diff; do not remove jobs | AR-36 |
| Unknown branch | Integration gate + warning | AR-12 |

## Testing Requirements

- Content tests for `verify-full.yml`: `workflow_call`, full verify step, pack check.
- Content tests for `ci.yml`/`release.yml`: they call the reusable workflow and retain the full gate.
- Content tests for the CI template reference: release/acceptance full gate, stable aggregator, the four plan modes and always-present matrix, the separate full path, the required `check --strict` job, nightly marker input and success-only update, build/source-commit provenance, CODEOWNERS, and no `pull_request_target`.
- Workflow lint (`actionlint`) where available; otherwise a structural YAML/text test.
- Fixture test: `plan --gate release` returns all groups; `plan --gate pr` returns affected; no-map returns `mode: full`, `fullCommand: null`, and an empty matrix; `none`/`skip` include an empty matrix.
- `npm pack --dry-run` includes the new skill, schema, CLI, and templates.
