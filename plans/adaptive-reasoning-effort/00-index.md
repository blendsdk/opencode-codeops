# Adaptive Reasoning Effort Implementation Plan

> **Feature**: Adaptive per-dispatch reasoning effort with advisory per-phase suggestions
> **Status**: Planning Complete
> **Created**: 2026-10-04
> **Implements**: REQ-ADAPTIVE-REASONING-EFFORT
> **CodeOps Artifact Schema**: 1

## Overview

Subagents in OpenCode inherit the parent session's model **and variant** when their agent file
pins no model. A parent running a reasoning model on its `max` variant therefore starts every
child at `max`, and provider options in the child's agent file cannot override it because the
variant merges last. CodeOps currently offers no per-dispatch control and no plan-level guidance.

This feature adds two things: (1) a runtime effort override the plugin applies on every LLM
request, sourced from a dispatch marker, an opt-in per-run session flag, or project routing
policy — in that precedence order; and (2) advisory reasoning suggestions per plan phase, derived
from existing risk signals, which `exec-plan` turns into dispatch markers. Suggestions are never
gates: they change cost and latency only, never permissions, verification, or review requirements.

The design deliberately uses the smallest viable machinery: one shared contract document, one pure
JavaScript helper module, one small Python CLI helper, and the plugin's existing hook pattern.
OpenCode's `task` tool has no model/effort parameter, so the plugin's `chat.params` hook is the
only reliable override point; the shared contract records the runtime evidence (AR #10).

## Minimum-Sufficient Baseline

**Original goal:** Stop every CodeOps subagent from inheriting the parent's `max` reasoning
variant, make effort follow the actual dispatch need, and let CodeOps suggest the right effort for
a plan or task before execution — as a suggestion, not a gate.

**Smallest viable design:** One runtime override in the existing plugin (`chat.message` captures a
dispatch marker, `chat.params` applies the resolved level), one pure helper module for
parsing/precedence/application, one small `codeops_*.py` helper that records an opt-in session
level under `$CODEOPS_TMPDIR`, and one advisory `> **Reasoning**:` line per phase in the existing
make-plan template. All levels are validated against the runtime model's own variants, so
unsupported values are skipped instead of sent to the provider.

**Excluded machinery (AR #17):** changes to `install_agents.py` defaults, model pins, temperature
changes, OpenCode changes, new dependencies, an `inherit` marker, outcome metrics, and retrofitting
existing plans that carry no `Reasoning:` line (they keep today's inherited behavior).

**Approved complexity:** **None** — the Complexity Escalation Gate was assessed and did not
trigger (AR #19): direct feature code plus two small helpers implemented through existing project
patterns, with no new architecture layer, dependency, harness, or infrastructure.

## Document Index

| #   | Document                                                     | Description                                        |
| --- | ------------------------------------------------------------ | -------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)               | Zero-Ambiguity Gate decisions (audit trail)        |
| 00  | [Index](00-index.md)                                         | This document — overview and navigation            |
| 01  | [Requirements](01-requirements.md)                           | Feature requirements, scope, and acceptance        |
| 02  | [Current State](02-current-state.md)                         | Runtime evidence and the files this feature changes |
| 03-01 | [Reasoning Effort Contract](03-01-reasoning-effort-contract.md) | Levels, marker grammar, precedence, skill table |
| 03-02 | [Plugin Runtime Override](03-02-plugin-runtime-override.md) | Helper module, plugin hooks, session state file    |
| 03-03 | [Plan and Skill Integration](03-03-plan-skill-integration.md) | make-plan, exec-plan, `--auto-effort`, docs      |
| 07  | [Testing Strategy](07-testing-strategy.md)                   | Spec test cases and verification                   |
| 99  | [Execution Plan](99-execution-plan.md)                       | Phases, sessions, and task checklist               |

## Quick Reference

### Dispatch marker

A dispatch packet carries one standalone line:

```text
[codeops-effort: medium]
```

The plugin captures it from the dispatch message and applies the level to every LLM request in
that child session, overriding the parent's inherited variant. Grammar and precedence: 03-01 §Marker grammar.

### Run-scoped session flag

A reasoning-heavy skill accepts `--auto-effort` (use its recommended level) or
`--auto-effort=high` (explicit level), announces it, records it through
`scripts/codeops_effort.py`, and clears it when the run completes. Without the flag the skill only
prints `Suggested reasoning: <level> — <reason>`.

### Precedence

```text
dispatch marker  >  session auto-effort  >  routing.roles[<agent>].reasoning  >  inherit
```

## Specialist Agents

**None** — the capability-gap check in `_shared/specialist-agents.md` ran against this repository's
evidence (a TypeScript/Python plugin with no specialized framework, no domain invariants beyond the
catalog roles, and no recurring review hotspot) and found no gap a standing specialist would
close (AR #21). The result is recorded here because a plan that runs the detection step records
its outcome even when the outcome is "none".

## Related Files

New: `_shared/reasoning-effort.md`, `bin/lib/reasoning-effort.mjs` (+ `.d.mts`),
`scripts/codeops_effort.py`, `bin/reasoning-effort.spec.test.mjs`,
`bin/reasoning-effort.impl.test.mjs`, `scripts/effort.spec.test.mjs`,
`scripts/reasoning-effort-content.spec.test.mjs`.

Changed: `plugin/index.ts`, `skills/make-plan/{SKILL.md,templates.md}`,
`skills/exec-plan/{SKILL.md,execution-protocol.md}`, the seven `--auto-effort` skills,
`skills/setup-routing/{SKILL.md,routing.md}`, `_shared/quality-profile.md`, `README.md`.
