# Analysis and Inventory Protocol

> **CodeOps Artifact Schema**: 1

This reference describes how `organize-tests` turns a repository into a proposed
test map. It is evidence-first: every group traces to a real source path, a real
test unit, and a command that was observed to run at least one test.

## 1. Project reconnaissance

Read, without writing:

- the Git root and current branch;
- `codeops/test-map.json` and `codeops/test-map/` when present;
- manifests and lockfiles (`package.json`, `Cargo.toml`, `go.mod`,
  `pyproject.toml`, `pom.xml`, `build.gradle`, `*.sln`, `CMakeLists.txt`);
- runner configuration (`vitest.config.*`, `jest.config.*`, `pytest.ini`,
  `nextest.toml`, CTest files);
- CI workflows, especially the full verify job;
- the `CODEOPS-PROJECT` and `CODEOPS-TESTING` blocks in `AGENTS.md`.

Record the project's full verify command and the exact file or script that
defines it. A missing full command stops adoption.

## 2. Test inventory

For each test unit, record:

| Field | Meaning |
| --- | --- |
| `test` | Repo-relative file path, target name, or test ID |
| `source` | The production path or target that owns it |
| `runner` | Detected adapter |
| `count` | Observed number of tests |
| `durationSec` | Observed or estimated duration |

Use native discovery where possible. Do not guess a test count; run the
candidate command and read the reported number.

## 3. Slice proposal

Group units by the feature or pipeline stage a developer changes, not by folder
alone:

- business app: dialog, invoice, inventory, auth;
- compiler: lexer, parser, codegen, assembler, linker, e2e;
- library: public API, adapters, compatibility;
- monorepo: workspace package boundaries.

One unit belongs to exactly one group. A slice carries one or more tiers of the
same feature. Split a slice when its task tier exceeds the budget or when its
tests cover unrelated behavior.

## 4. Dependency graph

Collect edges from the native graph first. Fall back to production imports, not
test imports. `dependsOn` lists upstream groups: a parser group is upstream of a
codegen group. Selection walks reverse edges, so changing the parser selects
codegen and its dependents, while changing codegen does not select the parser.

Shared test utilities are not a dependency shortcut. If a helper is used by
unrelated slices, keep it in a narrow shared group or mark the consumers
`alwaysRun`; never merge unrelated slices to satisfy the helper.

## 5. Command synthesis

Build an argv command per group. Verify it:

1. run it once on the current tree;
2. confirm it exits zero;
3. confirm the reported test count is greater than zero;
4. confirm it runs a subset, not the whole suite.

Record the count in the preview. A zero-test command is rejected. A command that
runs the whole suite defeats the purpose and is moved back to the full gate.

## 6. Preview contents

The preview must show:

- the chosen layout (single file or policy plus fragments);
- every slice, tier, source glob, test glob, dependency, and duration;
- the exact command per group and its observed count;
- files that will be created or changed;
- the AGENTS block diff and the CI diff;
- validation findings from the staged map.

Nothing is written before the preview is accepted.

## 7. Evidence to keep

Record the observed counts, the shadow verdict, the `check --strict` result, and
the date of the last map check. Evidence lives in the plan or the adoption
report, not in shipped source comments.
