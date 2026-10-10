# Testing Strategy: live-task-sidebar (slices 0–1)

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Core logic (`scripts/codeops_plan.py` counting) | 90% |
| Supporting module (`bin/lib/codeops-rpc.mjs`) | 80% |
| UI / glue (`plugin/tui.tsx`, packaging) | 60% — via spec/content tests plus the live smoke |

- Test names state behavior: `should [expected behavior] when [condition]`.
- E2E: the live smoke (ST-12) is the end-to-end proof; no new committed harness (AR #14).
- Language choice: parser tests spawn `python3` against temp fixture trees
  (`scripts/effort.spec.test.mjs` pattern); plugin tests run under `node --test`, importing
  `.mjs` helpers directly and `.ts` entries via Node's type stripping (test toolchain floor: Node
  ≥22.18; CI uses Node 24; the shipped package's `engines` stays `>=18`).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from 01-requirements.md, 03-01, 03-02, and the Ambiguity Register.
> **IMMUTABLE ORACLE RULE:** if the implementation does not match a spec test, the implementation
> is wrong — never adjust the expectation.

### Slice 0 — Parser Counting (`scripts/codeops_plan.py`)

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-1 | Execution doc with 2 real tasks (`- [ ] 1.1.1 A`, `- [x] 1.1.2 B`), a Deliverables checkbox block (`- [ ] Deliverable 1`), and a fenced example containing `- [ ] 1.1.9 quoted` | `--json`: total 2, verified 1, not_started 1, next_task `1.1.1 A`; the deliverable and the fenced example are not counted | FR-1, FR-2; 03-01 §Counting Rule |
| ST-2 | Same id `1.1.1` first as `- [ ] 1.1.1 First`, later as `- [x] 1.1.1 First again` | total 1; state comes from the first occurrence (not_started 1, verified 0) | FR-3 |
| ST-3 | Every `plans/*/99-execution-plan.md` in this repository | Parser total equals the test's independent count of distinct id-prefixed checkbox lines (fence-aware); every plan keeps its current total | FR-5 |
| ST-4 | Doc with one task per marker: `[ ]`, `[~]`, `[x]`, `[!] Blocked: reason`; plus one `[!]` without a reason | Counts 1/1/1/2 by state (not-started 1, verification-pending 1, verified 1, blocked 2); lifecycle `Blocked`; exactly one problem for the reason-less blocked task (the fixture is a complete plan directory, so no structural problems are reported) | FR-4 |
| ST-5 | Mini-plan shapes: `- [ ] T-05.1 …` and `- [x] **T-05.2 — …**` | total 2, verified 1; bold ids counted | FR-1; 03-01 §Counting Rule |
| ST-6 | Fixture with 1 verified of 3 tasks, `--progress-bar` | Output `Progress: [███░░░░░░░] 1/3 tasks (33%)` — format unchanged | FR-4 |
| ST-7 | Id-like non-tasks: `- [ ] 1.1.1.1 nested`, `- [ ] T-05.1x weird`, `- [ ] 1.1.1: colon` | None counted; `contains no execution tasks` problem reported | FR-1; 03-01 §Error Handling |
| ST-13 | Complete plan-dir fixture whose checklist lines are all id-less (`- [ ] Do the thing`) | `codeops_plan_migrate.py` preview exits 0 with no `contains no execution tasks` problem; `codeops_plan.py --json` reports total 0 plus its counting problem | FR-12; 03-01 §Integration Points |

### Slice 1 — TUI Foundation Spike

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-8 | `package.json` after the change | `exports["./tui"] === "./plugin/tui.tsx"`; the file exists; `files` includes `plugin/` and carries the `!plugin/*.test.mjs` / `!plugin/*.spec.test.mjs` negations; `npm pack --dry-run` excludes the plugin test files | FR-6 |
| ST-9 | Content inspection of `plugin/tui.tsx` and `plugin/index.ts` | TSX claims `append: "sidebar.content"`, imports the shared RPC helper, contains no `setInterval`/timer; the TSX routes the RPC payload through `isCodeOpsStatus` and the strip text appears only inside that guarded branch (no unconditional `CodeOps v` literal), so the failure branch renders nothing; `plugin/index.ts` calls `registerCodeOpsRpc` in a try/catch with a content-free warning and performs no unguarded `ctx.rpc.register` call | FR-7…FR-9 |
| ST-10 | Runtime: `registerCodeOpsRpc` with (a) fake ctx without `rpc`; (b) `rpc.register` that throws; (c) working `rpc.register` with captured definition/handlers; (d) fake ctx with `rpc: {}` or a non-function `register` | (a) `false`, no throw; (b) `false`, no throw; (c) `true`; captured definition id `codeops`; invoking the captured `status` handler returns exactly `{ pluginVersion, openCodeVersion, directory }` as strings with the fake ctx's values; (d) `false`, no throw | FR-7, FR-8; AR #16 |
| ST-11 | Runtime: import `plugin/index.ts`; `await setup(fakeCtx)` with TMPDIR/HOME fixtures — once without `rpc`, once with a capturing `rpc.register` | Resolves in both cases (no rejection); resolution yields a callable cleanup; in the capturing case the `codeops` definition is registered during setup and existing registrations (session/shell/tool hooks) still occur | FR-8 |
| ST-12 | Live smoke (E2E): bounded entry-load pre-probe, then packed tarball installed into a scratch project; `opencode <scratch> --standalone --session <id> --print-logs` launched in a large pty; output captured | Captured output contains `CodeOps v<package version>` in the session view; the exact OpenCode version and timestamp are recorded in the execution plan's ST-12 note; any missing strip is attributed to a layer (entry load / slot render / RPC round-trip) from the captured logs before it is recorded — an unattributed miss is not a valid result; if capture is inconclusive, the user-assisted fallback observation is recorded instead | FR-10; AR #14 |

## Test Categories

### Specification Tests (from ST-cases above)
> Written BEFORE implementation. Filed as `[feature].spec.test.[ext]`.

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `scripts/codeops_plan.spec.test.mjs` | ST-1…ST-7 | Parser counting |
| `scripts/codeops_plan_migrate.spec.test.mjs` | ST-13 | Migration admission (in-process parser consumer) |
| `plugin/tui-foundation.spec.test.mjs` | ST-8…ST-11 | Packaging, helper, setup containment |

ST-12 is executed during Phase 3 of the execution plan (evidence task), not as a committed test
file (no new harness; AR #14).

### Implementation Tests (edge cases, internals)
> Written AFTER implementation.

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `scripts/codeops_plan.impl.test.mjs` | Unclosed fence strips to EOF; `~~~` fences; fence with info string; indented fences (≤3 spaces); mixed fence characters (` ``` ` vs `~~~`); stray closing fence; CRLF documents; tabs after `-`; ids with multi-digit segments (`1.10.2`, `T-05.12`); duplicate ids separated by a fenced block; empty document | High |
| `plugin/tui-foundation.impl.test.mjs` | `isCodeOpsStatus` accepts the exact payload and rejects missing/extra/wrong-typed fields; the `codeops` definition keeps one method with an empty-object input and no events | High |

### Integration Tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| ST-11 (runtime setup) | `plugin/index.ts` + `bin/lib/codeops-rpc.mjs` | Setup completes with and without the RPC API; registration reaches the definition |
| ST-3 (parity) | parser + real plan artifacts | Counts match the independent oracle on all repository plans |
| ST-13 (migration admission) | migrator + parser | An id-less checklist fixture keeps the migration preview clean while the parser still reports the narrowed set |

### End-to-End Tests

| Scenario | Steps | Expected Result |
| -------- | ----- | --------------- |
| Live sidebar smoke (ST-12) | Pre-probe the package-TUI entry-load path, pack, install into scratch project, launch TUI in a pty, capture | Strip text present, or a layer-attributed miss; OpenCode version recorded |

## Test Data

### Fixtures Needed

- Temp-built complete plan directories (`99-execution-plan.md` plus a minimal valid `00-index.md`
  declaring **Implements**) per ST-1…ST-7 and ST-13 — problem assertions beyond counting rely on
  the full fixture (created under a temp root, never committed).
- Temp fake contexts per ST-10/ST-11 with `TMPDIR`/`HOME` pointed at fixtures (both env lookups
  honor per-call overrides in Node 22, verified).
- Scratch project for ST-12 under the temp root, containing `opencode.json`
  (`plugins: ["opencode-codeops"]`) and the packed tarball installed into `node_modules`.

### Mock Requirements

- The plugin server context is a hand-written fake object (hook stubs returning `dispose`,
  an empty async-generator `event.subscribe`, `location.directory`, `app.version`, optional
  `rpc`). No mocking framework is added — real objects are used everywhere else (AR #14).

## Verification Checklist

- [ ] All specification test cases (ST-*) defined with concrete input/output pairs
- [ ] Every ST case traces to a requirement, spec doc, or AR entry
- [ ] Specification tests written BEFORE implementation
- [ ] Specification tests verified to FAIL before implementation (red phase)
- [ ] All specification tests pass after implementation (green phase)
- [ ] Implementation tests written for edge cases and internals
- [ ] All unit / integration / E2E tests pass
- [ ] No regressions in existing tests
- [ ] Security assertions covered (ST-10: fixed output fields, no input surface)
