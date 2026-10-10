# Execution Plan: live-task-sidebar (slices 0–1)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-10 12:43
> **Progress**: 8/14 tasks (57%)
> **CodeOps Artifact Schema**: 1

## Overview

Deliver the two foundation slices of the live-task-sidebar feature: the execution-task counting
fix in `scripts/codeops_plan.py` (slice 0) and the live TUI/status-RPC spike (slice 1), per 03-01
and 03-02. Slice 2 (the full live progress feature) is explicitly out of scope and is decided on
this plan's smoke evidence (AR #1, #18). No release is performed (AR #15).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Parser counting correctness (slice 0) | 5 |
| 2 | TUI entry and guarded status RPC (slice 1 core) | 6 |
| 3 | Live smoke and documentation (slice 1 evidence) | 3 |

**Total: 14 tasks across 3 phases** (no fabricated hour estimates — scope is bounded by the
task-size criteria in the make-plan quality checklist)

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for progress.
> Every task line appears exactly once in this document. The executing agent MUST:
>
> 1. **On implementation:** mark the task `[~]` with a timestamp.
> 2. **On verify pass:** promote it to `[x]`.
> 3. **Update the Progress header and Last Updated after EVERY task** — never batch updates.
> 4. **Resume** top-to-bottom: the first `[~]` task is resumed first, else the first `[ ]` task.
> 5. **On blocker:** mark `[!]` with `Blocked: <short reason>`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

---

## Phase 1: Parser counting correctness (slice 0)

> **Phase baseline tree**: `5326bcd7d6f66bff17f356c3a0dc11499d5e8dec`
> **Expected modification set**: `scripts/codeops_plan.py`, `scripts/codeops_plan_migrate.py`, `scripts/codeops_plan.spec.test.mjs` (new), `scripts/codeops_plan.impl.test.mjs` (new), `scripts/codeops_plan_migrate.spec.test.mjs` (new) · **Scope mode**: strict
> **Reasoning**: medium — a small parser change whose wrong edge cut misreports progress in four skills; regression-pinned against every repository plan

### Step 1.1: Specification-first counting fix

**Reference**: 03-01 §Counting Rule, §Error Handling, §Compatibility Contract · AR #3, #4, #5 · FR-12
**Objective**: Count only real execution tasks while preserving every existing total and the JSON contract.

- [x] 1.1.1 [spec-author] Write the parser spec tests for ST-1 … ST-7 and ST-13 — `scripts/codeops_plan.spec.test.mjs` and `scripts/codeops_plan_migrate.spec.test.mjs` — and verify the red phase ✅ (completed: 2026-10-10 12:35)
- [x] 1.1.2 Implement the counting rule in `scripts/codeops_plan.py` (fence stripping, task-id gate, first-occurrence dedupe per 03-01 §Counting Rule) — green on ST-1 … ST-7 ✅ (completed: 2026-10-10 12:37)
- [x] 1.1.3 Write the parser impl tests — `scripts/codeops_plan.impl.test.mjs` (unclosed fence, `~~~` fences, info strings, CRLF, indented and mixed fences, multi-digit ids, duplicates across fences, empty document) — green ✅ (completed: 2026-10-10 12:38)
- [x] 1.1.4 Keep `scripts/codeops_plan_migrate.py` admission-stable: its "contains no execution tasks" check stays checkbox-line based (shared or mirrored with the parser's checkbox detection) so id-less checklists do not newly block migration — ST-13 green ✅ (completed: 2026-10-10 12:39)
- [x] 1.1.5 Full verification: `npm run verify` ✅ (completed: 2026-10-10 12:38)

**Deliverables**:
- `scripts/codeops_plan.spec.test.mjs` covers ST-1…ST-7 and `scripts/codeops_plan_migrate.spec.test.mjs` covers ST-13, both with a recorded red phase
- The counting rule is implemented; ST-3 parity confirms all repository plans keep their totals
- Migration admission preserved (FR-12): id-less checklists still migrate; ST-13 covers it
- All verification passing

**Verify**: `npm run verify`

---

## Phase 2: TUI entry and guarded status RPC (slice 1 core)

> **Phase baseline tree**: `f0e1a179a2fd597b931bb2e5b1154049cb40f879`
> **Expected modification set**: `bin/lib/codeops-rpc.mjs` (new), `bin/lib/codeops-rpc.d.mts` (new), `plugin/index.ts`, `plugin/tui.tsx` (new), `plugin/tui-foundation.spec.test.mjs` (new), `plugin/tui-foundation.impl.test.mjs` (new), `package.json`, `package-lock.json`, `tsconfig.json` · **Scope mode**: strict
> **Reasoning**: high — new packaging and JSX surface under a containment constraint on the always-on server plugin

### Step 2.1: Foundation components

**Reference**: 03-02 §Component A–D, §Error Handling · AR #6 … #13, #16
**Objective**: Add the packaged TUI entry, the shared RPC helper, and the never-throwing registration.

- [x] 2.1.1 [spec-author] Write the foundation spec tests for ST-8 … ST-11 — `plugin/tui-foundation.spec.test.mjs` — and verify the red phase ✅ (completed: 2026-10-10 12:43)
- [x] 2.1.2 Create `bin/lib/codeops-rpc.mjs` and `bin/lib/codeops-rpc.d.mts` per 03-02 §Component A — ST-10 green ✅ (completed: 2026-10-10 12:44)
- [x] 2.1.3 Wire the guarded registration into `plugin/index.ts` per 03-02 §Component B — ST-11 green ✅ (completed: 2026-10-10 12:44)
- [ ] 2.1.4 Create `plugin/tui.tsx` per 03-02 §Component C and apply the packaging changes per 03-02 §Component D (`./tui` export, devDependencies with `solid-js@1.9.12`, optional peerDependencies, test-file `files` negations, tsconfig JSX settings with `plugin/**/*.tsx` added to the existing include, then `npm install` to update `package-lock.json`) — ST-8, ST-9 green and `npx tsc --noEmit` clean
- [ ] 2.1.5 Write the foundation impl tests — `plugin/tui-foundation.impl.test.mjs` (payload guard accept/reject cases, definition schema invariants) — green
- [ ] 2.1.6 Full verification: `npm run verify`

**Deliverables**:
- `bin/lib/codeops-rpc.mjs` + `.d.mts` with the pinned register contract
- `plugin/index.ts` registers `codeops.status` via the guard; existing behavior untouched
- `plugin/tui.tsx` claims `sidebar.content`; package exports, JSX configuration, and the test-file tarball exclusions are in place
- All verification passing

**Verify**: `npm run verify`

---

## Phase 3: Live smoke and documentation (slice 1 evidence)

> **Phase baseline tree**: _(recorded by the exec-plan skill from a temporary-index snapshot of committed, staged, unstaged, and untracked phase-start state)_
> **Reasoning**: medium — a live environment check with a fallback path plus release-note wording

### Step 3.1: Evidence and notes

**Reference**: 03-02 §Component D + §Testing Requirements · 07-testing-strategy.md ST-12 · AR #14 (Note F) · AR #13, #15
**Objective**: Prove the mechanism on the installed OpenCode build and record the outcome.

- [ ] 3.1.1 Run the bounded entry-load pre-probe, then execute the live smoke per ST-12 (`npm pack` into a temp destination; scratch project under the temp root; pty launch with `--standalone --session --print-logs`; assert the strip text; attribute any missing strip to entry-load / slot / RPC from the captured logs; user-assisted fallback) and record the tested OpenCode version, timestamp, attribution, and any observed limitation in this task's completion note
- [ ] 3.1.2 Add the `CHANGELOG.md` `## Unreleased` entry (Fixes: execution-task counting; Notes: packaged TUI foundation), per AR #15
- [ ] 3.1.3 Final full verification: `npm run verify`, then report the slice-2 go/no-go inputs (what was proven, what was not, the recorded build) to the user

**Deliverables**:
- ST-12 evidence recorded with the tested OpenCode build
- `CHANGELOG.md` carries the `## Unreleased` entry
- All verification passing; go/no-go inputs reported

**Verify**: `npm run verify`

---

## Dependencies

```
Phase 1 (slice 0) ──────────────┐
                                 ▼
Phase 2 (slice 1 core) ──────► Phase 3 (smoke + docs)
                                 ▲
        (Phase 3 depends on Phase 2; Phase 1 and Phase 2 are independent)
```

---

## Success Criteria

**This plan is complete when:**

1. ✅ Slice 0: ST-1…ST-7, ST-13, and the impl tests pass; every repository plan keeps its total (ST-3)
2. ✅ Slice 1: ST-8…ST-11 pass; `npm run verify` passes with the TSX entry type-checked
3. ✅ ST-12 smoke evidence recorded with the tested OpenCode build (with layer attribution when the strip is absent, or the fallback observation)
4. ✅ Containment proven: `setup` completes without `rpc.register` and registers when present
5. ✅ `CHANGELOG.md` `## Unreleased` entry present; no release performed
6. ✅ Slice-2 go/no-go inputs reported to the user
7. ✅ Code reviewed per the repository's quality flow; no dead code; documentation standards met
8. ✅ Post-completion project re-analysis (handled by the exec-plan skill)
