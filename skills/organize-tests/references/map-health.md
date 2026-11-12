# Map Health and Audit

> **CodeOps Artifact Schema**: 1

A map can be valid JSON and still be unhealthy. The audit looks for drift and
ownership defects that make selection quietly less useful.

## Checks

| Finding | Meaning | Action |
| --- | --- | --- |
| `map.orphan-test` | A test under a test root belongs to no group | Add it to an owning group, or record an explicit ignore/acceptance decision; the skill never deletes a test |
| `map.overlap` | A test belongs to more than one group | Give it exactly one owner |
| `map.unknown-source` | A source path is owned, full-on, or ignored by nothing | Add ownership, a full-on rule, or a documented ignore |
| `map.slice-no-task` | A slice has no fast task tier | Add a task group or split the slice |
| `map.slice-no-release` | A slice has no release/acceptance path | Add a release group or a per-slice acceptance record |
| `map.group.slow` | A task group estimates above 180 s | Split it or move slow tests to a higher tier |
| `map.empty-group` | A file-based group matches no tracked test | Fix the glob or remove the group |
| never selected | A group has never run in recorded evidence | Check its sources and dependency edges |
| flaky candidate | A group fails intermittently | Stabilize the test; do not hide it in a higher tier |

A file is a test candidate when a group's `tests` glob claims it or its name follows a
test convention (`.test.`, `.spec.`, `_test.`, `test_*`, `*Test`, or a `.rs` file under a
test root). Fixtures and helpers under a test root are not orphan tests.

## Strict mode

`check --strict` promotes drift warnings to errors and exits 4. Malformed map
rules still exit 3. Release and acceptance CI runs strict mode so a stale map
cannot silently widen selection.

## Refresh

`--refresh` may update globs, dependency edges, and timings. It preserves manual
group edits, owner fields, and acceptance records. It never renames an ID; a
renamed group is a new group with a new owner decision.

## Slow groups

A slow task tier is a design smell, not a selector failure. Split the slice or
move the slow test to `phase` or `release`. Never drop the test from the map to
make the budget green.

## Reporting

Every audit finding names the path or group ID and the rule code. The report is
read-only; the user decides whether to refresh, split, or accept the finding.
