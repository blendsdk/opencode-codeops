# live-task-sidebar Implementation Plan

> **Feature**: Live CodeOps task progress in the OpenCode v2 sidebar — foundation (slices 0–1: execution-task counting fix + packaged TUI spike)
> **Status**: Planning Complete
> **Created**: 2026-10-10
> **Implements**: REQ-LIVE-TASK-SIDEBAR
> **CodeOps Artifact Schema**: 1

## Overview

The end goal is a live CodeOps task-progress section in the OpenCode v2 terminal sidebar: while
`exec-plan` runs, the sidebar should answer which plan is running, which phase and task is active,
what the agent is doing (implementing, verifying, blocked, waiting), and how many tasks have
passed verification. The user approved a staged delivery (AR #1): this plan executes the two
foundation slices; the full live feature (slice 2) is decided later on this plan's evidence.

**Slice 0 — counting correctness (standalone value).** `scripts/codeops_plan.py` derives progress
from `99-execution-plan.md`, but its task regex matches *every* `- [ ]`/`- [x]` line in the
document. Deliverables checkboxes and quoted examples are therefore counted as tasks, inflating
totals and corrupting the resume candidate — a defect that already affects `exec-plan`,
`roadmap`, `upgrade-plan`, and `setup-codeops` output. Slice 0 narrows the counting rule to real
execution tasks while preserving every existing plan's totals and the JSON contract.

**Slice 1 — live spike (go/no-go gate).** Before committing to the full feature, prove on the
installed OpenCode v2 build that (a) a packaged `./tui` entry loads, (b) the `sidebar.content`
slot renders, (c) a custom server RPC round-trips into that slot, and (d) a missing new API
cannot break the always-on server plugin. The spike ships the smallest honest version of the
foundation: a guarded `codeops.status` RPC and a one-line sidebar strip that renders only when
the server responds. Slice 2 builds the real progress tool, state machine, delegation, and
presentation on top — or stops, if the spike says no.

## Minimum-Sufficient Baseline

**Original goal:** make exec-plan progress visible and trustworthy in the sidebar without
changing CodeOps' source-of-truth model — starting with a correctness fix and a live proof that
the mechanism works (AR #1).

**Smallest viable design:** reuse the existing parser's Markdown semantics for the counting rule;
reuse the platform's documented plugin surface for the spike (package `./tui` export,
`sidebar.content` slot, one registered RPC). One plain-JS helper module carries the RPC
definition and a never-throwing registration guard. No new artifact format, no state store, no
config surface, no release.

**Excluded machinery:** the full live feature — progress reporting tool, run/session state
machine, delegation display, honesty states, the real sidebar section (all slice 2, AR #18);
a separate TUI package (AR #6); a smoke harness committed to the repository (AR #14); README
feature docs and any release action (AR #15).

**Approved complexity:** None — the Complexity Escalation Gate was assessed for the new
dependencies and deemed not triggered (AR #11 note D); no larger machinery is added.

## Document Index

| #    | Document                                              | Description                                    |
| ---- | ----------------------------------------------------- | ---------------------------------------------- |
| AR   | [Ambiguity Register](00-ambiguity-register.md)        | Zero-Ambiguity Gate decisions (audit trail)    |
| 00   | [Index](00-index.md)                                  | This document — overview and navigation        |
| 01   | [Requirements](01-requirements.md)                    | Requirements, scope, and acceptance criteria   |
| 02   | [Current State](02-current-state.md)                  | Parser behavior, plugin surface, gaps          |
| 03-01 | [Parser Task Counting](03-01-parser-task-counting.md) | The counting rule and its compatibility contract |
| 03-02 | [TUI Foundation Spike](03-02-tui-foundation-spike.md) | RPC, guarded registration, TUI strip, packaging |
| 07   | [Testing Strategy](07-testing-strategy.md)            | Spec test cases and verification               |
| 99   | [Execution Plan](99-execution-plan.md)                | Phases and task checklist                      |

## Quick Reference

### Parsed task line (after slice 0)

```markdown
- [~] 1.1.1 Task description …        ← counted (N.N.N)
- [x] T-05.2 Task description …       ← counted (T-N.N)
- [ ] **T-02.1 — Task description.**  ← counted (bold form)
- [ ] Deliverable 1                   ← ignored (no task id)
- [ ] 1.1.1 … inside a code fence     ← ignored (example)
```

### Spike RPC

```ts
const status = await context.client.rpc(CodeOpsRpc).status({})
// → { pluginVersion: "2.1.1", openCodeVersion: "2.0.24", directory: "/abs/project" }
```

The sidebar renders `CodeOps v<pluginVersion>` only when this call succeeds (AR #13).

## Specialist Agents

**None** — the capability-gap check in `_shared/specialist-agents.md` ran against this
repository's evidence: slice 0 is a bounded parser fix covered by catalog review lenses; slice 1
is a spike whose unknowns the smoke test itself retires; there is no specialized framework
invariant, no recurring review hotspot, and no phase-spanning domain knowledge a standing
specialist would carry beyond a dynamic packet. The repo's existing `agent-pipeline-reviewer`
specialist is not triggered (no `agent-templates/`, `agents/`, installer, or AGENTS.md managed
block changes in this scope). Revisit at slice-2 planning if the full feature spans multiple
phases of TUI conventions.

_Detection evidence: `scripts/codeops_plan.py` (pure parser, existing test patterns); the spike
touches `plugin/*` and packaging only; `AGENTS.md` specialist trigger list names only
agent/generation/installer surfaces, none of which change here._

## Related Files

New: `scripts/codeops_plan.spec.test.mjs`, `scripts/codeops_plan.impl.test.mjs`,
`scripts/codeops_plan_migrate.spec.test.mjs`, `bin/lib/codeops-rpc.mjs`, `bin/lib/codeops-rpc.d.mts`,
`plugin/tui.tsx`, `plugin/tui-foundation.spec.test.mjs`, `plugin/tui-foundation.impl.test.mjs`.

Changed: `scripts/codeops_plan.py`, `scripts/codeops_plan_migrate.py`, `plugin/index.ts`, `package.json`,
`package-lock.json`, `tsconfig.json`, `CHANGELOG.md`.

Depends on: the installed OpenCode v2 plugin surface (`@opencode/plugin` 2.0.24: `./tui` entry
resolution, `sidebar.content` slot, `ctx.rpc.register`).
