# live-task-progress Implementation Plan

> **Feature**: Live CodeOps task progress in the OpenCode v2 sidebar — the full feature (slice 2: progress tool, live run state, sidebar view, exec-plan reporting)
> **Status**: Planning Complete
> **Created**: 2026-10-10
> **Implements**: REQ-LIVE-TASK-PROGRESS
> **CodeOps Artifact Schema**: 1

## Overview

This plan builds the full feature the foundation staged: while `exec-plan` runs, the sidebar
answers which plan is running, which phase and task is active, what the agent is doing
(implementing, verifying, delegating, blocked, waiting), and how many tasks have passed
verification. The foundation (`plans/live-task-sidebar/`, slices 0–1) proved the load-bearing
mechanism live: the packaged `./tui` entry loads, the server registers custom RPCs, and the
round-trip returns real data once the call is scoped to the session's location.

On that foundation this plan adds the agent-callable `codeops_progress` tool, an in-memory run
state in the server plugin, RPC event push, the sidebar's live view, and the exec-plan reporting
protocol. The execution plan file remains the durable source of truth; the sidebar is a live view
fed by explicit reports.

The design decisions and their evidence live in the [Ambiguity Register](00-ambiguity-register.md)
(auto-design root `AD-LTP-20261010-1`); requirements are owned by
[01-requirements.md](01-requirements.md).

## Minimum-Sufficient Baseline

**Original goal:** live, trustworthy task progress in the terminal sidebar while an exec-plan run
is active, without changing CodeOps' source-of-truth model (recorded slice-2 intent; requirements
re-derived in 01, scope confirmed in register rows 1–3).
**Smallest viable design:** built entirely on the host's documented plugin surface and the
foundation's patterns — one shared plain-JS module carries the tool definition, run state, and
contracts; the existing server plugin registers them behind feature-detection; the existing TUI
entry subscribes to the definition's events and renders the shared display lines. No watchers,
timers, polling, persistence, new dependencies, or fixtures beyond the established temp-root
probe method.
**Excluded machinery:** plan-file watchers or polling with parser duplication (register note A);
persisted run history; a committed smoke harness (foundation boundary); agent-template changes
(register row 15 deferral); configuration surface (none needed).
**Approved complexity:** None — the Complexity Escalation Gate was assessed as not triggered
(register note A).

## Document Index

| #     | Document                                       | Description                                          |
| ----- | ---------------------------------------------- | ---------------------------------------------------- |
| AR    | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (audit trail)          |
| 00    | [Index](00-index.md)                           | This document — overview and navigation              |
| 01    | [Requirements](01-requirements.md)             | Requirements, scope, and acceptance criteria         |
| 02    | [Current State](02-current-state.md)           | Current implementation analysis and risks            |
| 03-01 | [Progress Core](03-01-progress-core.md)        | Tool/RPC/event contracts, run state, honesty display |
| 03-02 | [Server Wiring](03-02-server-wiring.md)        | Guarded registration and plugin wiring               |
| 03-03 | [Sidebar View](03-03-sidebar-view.md)          | Live rendering, subscriptions, lifecycle             |
| 03-04 | [Protocol and Docs](03-04-protocol-and-docs.md) | exec-plan reporting points, README, CHANGELOG        |
| 07    | [Testing Strategy](07-testing-strategy.md)     | Spec test cases and verification                     |
| 99    | [Execution Plan](99-execution-plan.md)         | Phases and task checklist                            |

## Quick Reference

### Reporting (agent side — fail-soft)

```ts
codeops_progress({ plan: "live-task-progress", phase: "Phase 2: Server wiring",
                   task: "2.1.3 Wire plugin/index.ts", activity: "implementing" })
```

### Sidebar view (while a run is active)

```
CodeOps · live-task-progress
Phase 2 · implementing
2.1.3 Wire plugin/index.ts · 6/21 · as of 18:37
```

## Specialist Agents

**None** — the capability-gap check ran against this repository's evidence and found no gap a
standing specialist would close. The phase plan needs host plugin/TUI API knowledge that the
03 documents pin with `file:line` evidence, that dispatch packets carry, and that the proven
probe method exercises; the foundation's two related findings (RV-001, SA-004) were one batch
with one fixed root cause.

_Detection evidence: `plans/live-task-sidebar/05-findings.md` (single failure-path batch, fixed;
no further findings); the pinned host-API research in `03-01-progress-core.md`; the AGENTS.md
specialist triggers cover agent-generation surfaces only, untouched by this plan (register note J)._

## Related Files

New: `bin/lib/codeops-progress.mjs`, `bin/lib/codeops-progress.d.mts`,
`plugin/progress-core.spec.test.mjs`, `plugin/progress-core.impl.test.mjs`,
`plugin/progress-server.spec.test.mjs`, `plugin/progress-server.impl.test.mjs`,
`plugin/tui-progress.spec.test.mjs`, `plugin/tui-progress.impl.test.mjs`,
`scripts/exec-plan-progress.spec.test.mjs`.

Changed: `bin/lib/codeops-rpc.mjs`, `bin/lib/codeops-rpc.d.mts`, `plugin/index.ts`,
`plugin/tui.tsx`, `skills/exec-plan/SKILL.md`, `skills/exec-plan/execution-protocol.md`,
`README.md`, `CHANGELOG.md`.

Depends on: the installed OpenCode v2 plugin surface (`@opencode/plugin` 2.0.26:
`ctx.tool.transform`, RPC events, `sidebar.content`) and the foundation's proven mechanisms
(`plans/live-task-sidebar/`, register note A evidence).
