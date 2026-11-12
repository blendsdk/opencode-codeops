# GitHub Actions Test-Selection Templates

> **CodeOps Artifact Schema**: 1

These templates are advisory. `organize-tests` previews every diff and never
removes an existing job. A project can keep its current full gate and adopt only
the map, or adopt the affected PR job later.

## Shape

```text
PR:
  plan(affected) -> test shards -> verify aggregator (required)

release/** / hotfix/** / v* tag:
  full gate -> build artifact -> package -> provenance -> deploy

acceptance/**:
  full gate + acceptance groups -> provenance
```

## Affected plan and shards

```yaml
jobs:
  plan:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.plan.outputs.matrix }}
      mode: ${{ steps.plan.outputs.mode }}
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - run: npm ci --ignore-scripts
      - id: plan
        run: node bin/codeops-test.mjs plan --gate pr --since "origin/${{ github.base_ref }}" --json > plan.json
      - run: echo "matrix=$(jq -c .matrix plan.json)" >> "$GITHUB_OUTPUT"
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
```

The plan has four modes: `groups`, `full`, `none`, and `skip`. Every mode
returns a matrix object. `none` and `skip` use an empty matrix. A full run is a
separate job, never a fake group entry, so `run --group full` remains a usage
error.

```yaml
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

The stable `verify` job is the required branch-protection check. Dynamic matrix
names are never required checks. `check --strict` runs beside it so a malformed
map stays visible even when selection falls back to full.

## Release and acceptance

Release and acceptance always run the full gate. Build the artifact only after
the gate, or build first and let the gate consume the artifact.

```yaml
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

`--source-commit` records the commit the full gate tested. When the gate ran on
source, the artifact must be reproducible; `provenance verify` fails on a
different digest or source commit. Acceptance uses `--gate acceptance` and
records the manual or external result.

## Nightly

```yaml
name: Nightly Full
on:
  schedule: [{ cron: "0 3 * * *" }]
  workflow_dispatch:
concurrency:
  group: nightly-full
  cancel-in-progress: false
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

The marker updates only after a successful full run. Never update it from a
failed or skipped job.

## Governance

- Protect `codeops/test-map/**` with a `CODEOWNERS` entry; map changes are
  reviewed like CI changes.
- Use `pull_request`, never `pull_request_target` with fork code. The map
  contains commands and must be treated as code.
- Preserve existing caching, toolchain setup, permissions, and branch filters.
- Do not add a path filter that lets release or acceptance skip the full gate.
