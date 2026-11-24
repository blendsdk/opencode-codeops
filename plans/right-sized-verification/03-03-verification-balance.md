# Verification Balance: Right-Sized Verification (Wave 1)

> **Document**: 03-03-verification-balance.md
> **Parent**: [Index](00-index.md)

## Overview

A report-only cumulative brake: after each phase, exec-plan states how many lines of verification
the phase added relative to product (AR-5). No new script (AR-7). The same file classification
feeds the standard-tier review trigger (03-01, AR-30).

## File classification (AR-16, AR-30, PF-014)

| Class | Paths |
|---|---|
| **Test** | `*.test.*`, `*.spec.*`, `*_test.*`, `test_*.*`, `*Test.*`, `*_spec.*`, any path with a `test/`, `tests/`, `__tests__/`, `spec/`, or `fixtures/` segment, plus files matched by a test map's test globs when one exists |
| **Excluded** | CodeOps artifacts (`plans/`, `requirements/`, `codeops/`), lockfiles (`*.lock`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`), generated directories (`dist/`, `build/`) |
| **Product** | Every other changed file, Markdown included |

## Counts

- **Balance:** added lines from the phase review diff (the existing
  `codeops_worktree_snapshot.py diff --baseline <phase-baseline-tree>` output). `R = test / product`,
  one decimal; product 0 → `R = n/a`.
- **Review trigger (03-01):** added + deleted product lines from the same diff.
- Compute both once in post-phase step 1 and reuse them.

## Output (AR-17)

- One line in the phase summary to the user and in the phase header of `99-execution-plan.md`:
  `> **Verification balance**: <T> test / <P> product lines (<R>:1)`.
- At `standard` tier with `R > 1.5`, append ` ⚠️ above 1.5:1`.
- Never blocks, never asks, never changes a gate result.

## Text changes

| File | Change |
|---|---|
| `skills/exec-plan/execution-protocol.md` | Post-phase step 1: classify, count, record the balance line; a documented one-line command over the snapshot diff is allowed (AR-7) |
| `skills/make-plan/templates.md` | 99 phase header template gains `> **Verification balance**:` (filled by exec-plan) |

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Diff unavailable | `Verification balance: unavailable — <reason>`; continue; the trigger treats the phase as reviewed-required | AR-5 |
| Product lines 0 | `R = n/a`; no warning | AR-17 |
