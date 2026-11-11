# Test Selection and the Verification Gate Ladder

> **CodeOps Artifact Schema**: 1

This is the canonical verification protocol. The standards carry the six prime directives; every
skill links here instead of restating the rules. The selector is opt-in: a project with no
`codeops/test-map.json` and no `codeops/test-map/` behaves exactly as before.

## Gate ladder

| Gate | What runs | When |
| --- | --- | --- |
| `task` | The map's selected `task`-tier groups plus always-run groups, or the plan's validated `**Task verify**` command | After each implemented task |
| `phase` | `task` + `phase` groups, or the plan's task command plus the changed phase surface | Plan phase exit |
| `pr` | `task` + `phase` groups, always-run groups, and `policy.prSmoke` groups | Pull request / merge queue |
| `release` | Every group, plus the full verify command | Release branch, hotfix, release tag, package |
| `acceptance` | Every group, plus acceptance groups and acceptance evidence | Acceptance branch or environment |
| `nightly` | Every group, but only when a relevant path changed since the last successful full run | Scheduled |
| `full` | The full verify command; no partial selection | CI fallback, explicit force, release gate |

The full gate is always authoritative. A green task or PR slice is never a release signal.

## No-map contract

With no map:

- selection returns `mode: "full"`, `fullCommand: null`, and a visible `no-map` reason;
- `run` requires an explicit `--full-command` and refuses to invent one;
- CI uses the project's existing full job.

Deleting the map, or setting `CODEOPS_FULL_TESTS=1`, restores full behavior at every gate.

## Map overview

A map is either one file, `codeops/test-map.json`, or a directory containing `policy.json`,
`shared.json`, and domain fragments. A group declares:

- `id`, `slice`, `tier` (`task`, `phase`, `release`, `acceptance`);
- `sources` and optional `tests` globs (target-based runners may omit `tests`);
- `run.command` as an argv array; `{tests}` expands to the group's full resolved test set;
- `dependsOn`, `alwaysRun`, `durationSec`, `parallelSafe`, `requires`;
- an optional per-slice `acceptance` record.

`policy.json` owns `full` (argv), budgets, branches, ignore/full-on paths, acceptance mode,
`prSmoke`, `requirements` probes, `caseSensitive`, and `fullThreshold`. The JSON Schema is
`schemas/test-map.schema.json`.

## Baseline and change detection

Selection accepts, in priority order:

1. `--baseline <tree|ref>` — exec-plan passes the phase baseline tree here;
2. `CODEOPS_TEST_BASE`;
3. `--last-full-sha <sha>` or `CODEOPS_LAST_FULL_SHA` — the last successful full-run marker;
4. a branch-aware base;
5. `HEAD` only for an explicit local uncommitted-only selection.

On an integration branch, a missing, unreadable, or non-ancestor last-full marker selects full.
The selector never guesses a base.

## Selection rules

1. Collect committed, staged, unstaged, and untracked changes; normalize paths; include both
   sides of renames and deletions.
2. Apply `fullOnPaths` first; an ignored path that is also full-on still selects full.
3. Apply `ignorePaths`; if every changed path is ignored, return `mode: "none"`.
4. Select groups whose `sources` or `tests` match a changed path.
5. Add downstream dependents through `dependsOn`; never add upstream providers.
6. Add `alwaysRun` groups and, at the `pr` gate, `policy.prSmoke` groups.
7. Filter by gate tier and record deferred groups.
8. At partial gates, an over-threshold selection falls back to full.
9. Estimate the task budget (120 s target, 180 s acceptable); never drop a group.
10. Any unknown path, invalid map, unresolved base, or selector error selects full with a visible
    reason. `select` and `plan` return that result with exit 0; `check` reports the map defect.

Globs are case-sensitive on every platform unless policy explicitly opts out. Test paths are
expanded from the group's full test set, independent of the change set, so a source-only change
still runs the whole group.

## Spec tests and `--include`

A feature's specification test file always runs. Exec-plan passes the plan's declared spec
file(s) with `--include`; the selector adds the owning group, and an unowned spec file selects
full with `unknown-path`. A failing spec test means the implementation is wrong, never the test.

## Evidence

Every verification records:

- the gate and baseline (tree/ref);
- selected groups and their reasons (`direct-source`, `direct-test`, `dependent`, `always-run`,
  `smoke`);
- deferred groups;
- the budget status;
- any fallback reason and the map hash.

CI evidence is authoritative. The content-free metrics surface, when enabled, emits only gate,
selected/total, budget status, fallback reason, and map hash.

## Lightweight fallback: `**Task verify**`

A plan may record two commands:

```markdown
**Task verify**: `npm run test -- --run web/billing/invoice-dialog`
**Verify (gate)**: `npm run verify`
```

`make-plan` runs the task command once and records the observed test count. A command that runs
zero tests is invalid. `exec-plan` uses the task command per task and the gate command at phase
exit, plan completion, before push, and in CI. A plan with only one `**Verify**` line uses that
line as the gate command; a map may derive the task command, otherwise the gate command serves
both. This is the supported path for projects that never adopt a map.

A changed path outside the phase's expected modification set, or a shared/config/test-infrastructure
change, forces the full gate and a scope note.

## AGENTS.md testing block

`organize-tests` is the sole writer of the `CODEOPS-TESTING` block inside the
`CODEOPS-PROJECT` managed block. `analyze-project` preserves that block byte-for-byte and warns
when it is missing or stale; it never renders it. With no map, the block reads
`Testing: full suite only (no test map)`.

## References

- Selector CLI: `bin/codeops-test.mjs`
- Map schema: `schemas/test-map.schema.json`
- Adoption skill: `skills/organize-tests/SKILL.md`
- Specification-first ordering: `_shared/spec-first-ordering.md`
