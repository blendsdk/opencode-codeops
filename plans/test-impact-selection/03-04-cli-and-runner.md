# CLI and Runner: Test Impact Selection

> **Document**: 03-04-cli-and-runner.md
> **Parent**: [Index](00-index.md)

## Overview

The CLI exposes the selector to coding agents, developers, and CI. The runner executes selected group commands with argv safety, timeouts, concurrency, and captured output. Neither component knows a language; they execute the map's commands.

The CLI is a new binary, `codeops-test`, shipped in `bin/`. Skills invoke it as `node "${CODEOPS_PLUGIN_ROOT}/bin/codeops-test.mjs"`; the package also registers a `codeops-test` bin for global installs, and a project wrapper (`scripts/codeops-test.mjs`) is optional. It does not change the installer CLI (`bin/index.mjs`) or its scope detection (AR-17, AR-18).

## Architecture

```text
bin/codeops-test.mjs
  ├── select   (03-03)
  ├── run      (03-03 + run group commands)
  ├── check    (03-02 validation + health)
  ├── plan     (03-05 matrix output)
  ├── shadow   (run selected + full, compare)
  └── provenance (03-05 record/verify)
```

### Command contract

| Command | Purpose | Deterministic output |
| --- | --- | --- |
| `select` | Compute selection; do not execute | Human summary or `--json` |
| `run` | Compute and execute selected commands | Captured logs + final summary |
| `check` | Validate map, ownership, cycles, slice health | Report; exit 3/4 on invalid/drift |
| `plan` | Emit CI matrix for a gate | JSON matrix + selection summary |
| `shadow` | Run selected then full; report misses | JSON/human evidence |
| `provenance` | Write/verify release evidence | JSON file + exit status |

### Options

| Option | Applies to | Meaning |
| --- | --- | --- |
| `--gate task\|phase\|pr\|release\|acceptance\|nightly` | select/run/plan | Gate policy; default from branch |
| `--baseline <tree\|ref>` | select/run/plan/shadow | Explicit base; overrides branch resolution |
| `--since <ref>` | select/run/plan/shadow | Alias for a ref base (CI convenience) |
| `--root <path>` | all | Repo root; defaults to the resolved Git root |
| `--json` | select/check/plan/shadow/provenance | Machine output |
| `--explain` | select/run | Add reasons per group |
| `--full` | select/run | Force full suite |
| `--include <path>` | select/run | Add a declared test file/path (spec/impl task) |
| `--group <id>` | run | Run only the named selected group (repeatable; CI shard entry point) |
| `--selection <file>` | run | Consume a precomputed `select`/`plan` JSON; verify the map hash and selected group |
| `--full-command <argv>` | run | Full command for a no-map or full selection, as argv tokens; repeat for multiple commands. Required when `mode: full` has no map command. |
| `--last-full-sha <sha>` | select/run/plan/shadow | Last successful full-run SHA for the integration/nightly marker; defaults to `CODEOPS_LAST_FULL_SHA`. |
| `--no-fallback` | run/plan | Fail with exit 5 instead of expanding a recoverable selection error to full. |
| `--keep-logs` | run | Keep captured logs after the run; failure logs are retained by default. |
| `--metrics` | run/check | Emit optional content-free metrics through the existing outcome-review/metrics surface. |
| `--coverage <json>` | provenance write | Coverage evidence. |
| `--acceptance <json>` | provenance write | Acceptance evidence. |
| `--full-run-id <id>` | provenance write | Full-run identifier; defaults to the CI run ID. |
| `--source-commit <sha>` | provenance write | Commit the full gate tested; defaults to the checkout commit and must match `commit` for release/acceptance records. |
| `--commit <sha>` | provenance verify | Expected tested commit; defaults to the record value and is checked against it. |
| `--strict` | check | Promote warnings to errors |
| `--fail-fast` / `--no-fail-fast` | run | Stop at first failure (default) or run all |
| `--concurrency <n>` | run | Max parallel groups; default 1 |
| `--timeout <sec>` | run | Per-group timeout override |
| `--record <file>` | run/provenance write/verify | Write or read the selection/provenance record. |
| `--artifact <path>` | provenance write/verify | Artifact digest input |
| `--map <path>` | all | Alternate map path for tests/pilots |
| `--quiet` | run/check | Compact output |

### Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success / selection computed / all selected tests pass |
| 1 | A selected test command failed |
| 2 | Usage error |
| 3 | Invalid map/schema/command |
| 4 | Drift or strict check failure |
| 5 | Selection error with `--no-fallback`; otherwise `select`/`run`/`plan` return `mode: full` with a reason and exit 0 |
| 6 | Reserved; budget overrun is a warning, never this code |

`select` never executes tests, so exit 1 does not apply. `shadow` returns 1 if selected or full failed in a way that needs attention; the report distinguishes selected failure, full failure, and escaped failure.

## Implementation Details

### `select`

1. Load the map ([03-02](03-02-test-map-model.md)) or return no-map full.
2. Resolve the gate from `--gate`, else branch policy ([03-05](03-05-branch-policy-and-provenance.md)).
3. Resolve the base from `--baseline`/`--since`, then `CODEOPS_TEST_BASE`, then `--last-full-sha`/`CODEOPS_LAST_FULL_SHA`, then branch policy.
4. Compute the selection ([03-03](03-03-selector-core.md)).
5. Print a compact human summary or JSON.
6. Exit 0 for a computed selection, including a `mode: full` fallback. Exit 3/5 only with `--no-fallback`; `check` owns the malformed-map exit.

### `run`

1. Call `select`, or load `--selection <file>` and verify its `mapHash` and group IDs against the current map.
2. If `mode: full`, run the policy's `full` argv when a map provides one; otherwise require `--full-command` (argv tokens) or fail with exit 5 and guidance. Never invent a command. No partial run.
3. If `mode: none`, report “no tests required” and exit 0.
4. If `mode: groups`, build argv commands and execute. With `--group <id>` (repeatable), execute only those selected groups; an unknown/unselected group is a usage error (exit 2), never a silent skip.
5. Default sequential; `parallelSafe` groups may run concurrently up to `--concurrency`, but only if every group in the concurrent set is `parallelSafe`.
6. Capture stdout/stderr to a log under `$CODEOPS_TMPDIR`; print a one-line PASS or the failure tail (last 50 lines + log path).
7. On command failure, exit 1. Do not continue after a failed group unless `--no-fail-fast`.
8. For every `requires` name, run the matching `policy.requirements[<name>].check` argv before the group. A non-zero check fails the group with `requires.missing`; it is never a skip. Cache probe results for the run.
9. A timeout is a failure.
10. Write the evidence record when `--record` is set.

### `check`

1. Load and validate the map.
2. Enumerate tracked test files under the project's test roots and match `tests` globs: exactly one owner, no orphans, no overlaps. Target-based groups with no `{tests}` are exempt from the file-ownership check and are validated through `sources` plus a command smoke test.
3. Enumerate tracked source paths and classify as owned/full-on/ignored; report unknown sources.
4. Validate the slice contract: every slice has a task-tier group; every slice has release/acceptance or a group carrying `acceptance: { mode: "manual" | "external" | "na", reason }`.
5. Validate IDs, cycles, paths, commands, branch patterns, budgets, the full command, `prSmoke` IDs, `requirements` probes, and per-slice acceptance records.
6. Report slow groups (`durationSec` > 180) and `alwaysRun` non-task-tier groups.
7. `--strict` promotes warnings to errors. Release/acceptance CI uses strict. The default severity and exit-code table in [03-02](03-02-test-map-model.md) is authoritative: malformed-map errors exit 3; drift/health warnings exit 0 normally and exit 4 under `--strict`.
8. Exit 0 clean, 3 invalid map, 4 drift/strict failure. A recoverable map error in `select`/`plan` is reported as `mode: full` with exit 0 unless `--no-fallback` is set.

### `shadow`

1. Compute the selected set for the current diff, using the same explicit `--baseline`/`CODEOPS_TEST_BASE` rule as `select`; there is no automatic phase-baseline discovery.
2. Run selected groups with `--no-fail-fast`; capture results.
3. Run the full command regardless of the selected result; capture results.
4. Compare:
   - selected fails, full fails → report both; no adoption signal.
   - selected passes, full fails → **escaped failure**; adoption refused.
   - selected fails, full passes → report a selection or flake problem; adoption refused.
   - both pass → `zero-missed` candidate; the skill still reviews the evidence.
5. Write a JSON report with the diff, selected groups, full result, and verdict.
6. Do not automatically enable the map; adoption is a user/skill decision (AR-23).

The comparison is exit-code/result based, not a per-test method graph. The agent reviews the full failure tail and records the evidence. This is intentionally not a dynamic TIA service (AR-1).

### `test plan`

Delegates to [03-05](03-05-branch-policy-and-provenance.md):

- `pr`/`task`/`phase`: selected groups as matrix entries;
- `release`/`acceptance`: all groups, `full: true`;
- `nightly`: skip when no relevant change since the marker, else all groups;
- no map: `mode: full`, `full: true`, `fullCommand: null`, and `matrix: { include: [] }`; `run` requires `--full-command`, and CI uses the existing full job.

### Runner safety

- `spawn` with argv arrays and `shell: false`; `{tests}` expands to the group's full resolved test set as separate args, independent of the change set. `--full-command` and map commands are argv tokens; never parse a shell string.
- `cwd` must resolve inside the repo root; reject symlink escapes.
- Environment: inherit the parent, plus `CODEOPS_TEST_GROUP` and `CODEOPS_TEST_GATE` for diagnostics.
- Per-group timeout default 600 s; full command timeout default 1800 s; configurable.
- Output capture: logs under `$CODEOPS_TMPDIR` when set, else OS temp. Delete logs after a successful run; retain failure logs and report their path. `--keep-logs` retains success logs too.
- No secrets in logs; the selector does not print environment variables.
- `--record` evidence contains no secret values. `--metrics` output is content-free: gate, selected/total, budget status, fallback reason, and map hash only.

## Code Examples

### Task run

```text
$ codeops-test run --gate task --baseline 4f2a1c9
Selected: billing.invoice-dialog.unit, shared.auth.contract (2/8 groups)
billing.invoice-dialog.unit  PASS  42s
shared.auth.contract         PASS   8s
Budget: 50s / 120s (within-target)
PASS
```

### Full fallback

```text
$ codeops-test select --gate task --baseline 4f2a1c9
mode: full
reason: unknown-path (src/unmapped/new-module.ts)
command: npm run verify
```

### Check failure

```text
$ codeops-test check --strict
map.orphan-test: tests/billing/legacy-dialog.test.ts (no owning group)
map.slice-no-task: billing.invoice-dialog (only release-tier tests)
exit 4
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| --- | --- | --- |
| Invalid map | `select`/`plan` return `mode: full` with a reason and exit 0; `check` exits 3; `--no-fallback` exits 3/5 | AR-20 |
| Usage error | Exit 2 with help | AR-18 |
| Selection error | `select`/`plan`/`run` fall back to full with a reason; exit 5 only with `--no-fallback` | AR-20 |
| Test failure | Exit 1; failure tail + log path | AR-20 |
| Timeout | Treated as failure; no retry that masks | AR-20 |
| Missing service requirement | Run the configured probe; non-zero fails the group; never skip | AR-9 |
| Missing `{tests}` matches | `check` error for file-based groups; target-based groups are exempt; selection full if it encounters one | AR-22 |
| Budget overrun | Warning + breakdown; exit unchanged | AR-7 |
| Shadow escape | Report escaped failure; adoption refused | AR-23 |
| Log unwritable | Run once plainly; note fallback; failure logs are retained when writable | AR-20 |

## Testing Requirements

- CLI spec tests for each command, option, JSON shape, and exit code.
- Runner impl tests: argv with spaces/metacharacters, cwd escape, symlink escape, timeout, fail-fast/no-fail-fast, concurrency only for `parallelSafe`.
- Fallback tests: invalid map, selector error, unknown path, explicit `--full`, `CODEOPS_FULL_TESTS=1`.
- Shadow tests: both pass, selected fail, full fail, escaped failure.
- Output tests: human summary, `--json`, `--explain`, `--quiet`.
- Temp log hygiene tests (created under temp, deleted on completion unless kept).
- Security tests: no shell, no path escape, no secret logging.
