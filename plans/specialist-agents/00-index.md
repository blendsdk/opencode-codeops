# Specialist Agents Implementation Plan

> **Feature**: Detect, recommend, create, and route project-specific specialist subagents from CodeOps planning
> **Status**: Planning Complete
> **Created**: 2026-10-04
> **Implements**: REQ-SPECIALIST-AGENTS
> **CodeOps Artifact Schema**: 1

## Overview

CodeOps ships twelve generic process roles (explorer, executor, reviewers, auditors). When a
project has a specialized framework, domain, or set of invariants, no standing agent carries that
knowledge; every dispatch packet must re-supply it, and generic roles miss domain-specific
problems. This feature adds a detection step to requirements gathering, plan creation, and project
analysis: when repository evidence shows a specialist subagent would materially improve quality,
DX, or UX, CodeOps recommends one through the existing Complexity Escalation Gate. After the user
approves, `setup-routing` creates a project brief and generates a visible, marker-owned specialist
agent from one of two generic templates. Plans record which specialist serves which phase, and
`exec-plan` dispatches it as an additional reviewer or executor, always with a dynamic-packet
fallback.

Routing is an optimization, never a gate. No CodeOps gate, reviewer count, or verification step
depends on a specialist existing. Model policy stays in `codeops/codeops.json`; the generated
agent's model-visible `description` and the generated AGENTS.md index make specialists
discoverable to every coding agent.

## Minimum-Sufficient Baseline

**Original goal:** During requirements and planning, detect when a project-specific specialist
sub-agent would help, recommend it with evidence, and — after explicit approval — create and route
it so execution and reviews can use it.

**Smallest viable design:** Reuse the existing domain-lens selection
(`references/domains/selection.md`), the Complexity Escalation Gate
(`_shared/zero-ambiguity-gate.md`), and `setup-routing`'s installer path
(`scripts/install_agents.py`). Add one canonical protocol document, one project brief per
specialist, two generic prompt templates, three deterministic installer modes, one managed
AGENTS.md block, and explicit `exec-plan` selection wiring.

**Excluded machinery:** Outcome-metric events for specialists, tag-based automatic role
selection, runtime creation during execution, any creation without explicit user approval, and
changes to the twelve catalog roles' reasoning defaults. See AR #3.

**Approved complexity:** AR #21 — the novel-specialist subsystem was approved by the user after
the visible stop packet and an independent `design-challenger` verdict of `Simplify`, with two
trims: spec tests run under `node --test` and spawn `python3` (CI-enforceable), and explicit
`exec-plan` selection wiring is in scope. All other approved decisions are enumerated in the
Ambiguity Register.

## Specialist Agents

**None** — applying the detection criteria in [03-01](03-01-specialist-protocol.md) to this
repository (a TypeScript/Python plugin with no specialized framework or domain invariants beyond
the catalog roles, and no recurring review hotspot) found no gap that a standing specialist would
materially close. The check is recorded here because a plan that runs the detection step must
record its outcome even when the outcome is "none".

## Document Index

| #   | Document                                                       | Description                                       |
| --- | -------------------------------------------------------------- | ------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)                 | Zero-Ambiguity Gate decisions (audit trail)       |
| 00  | [Index](00-index.md)                                           | This document — overview and navigation           |
| 01  | [Requirements](01-requirements.md)                             | Feature requirements and scope                    |
| 02  | [Current State](02-current-state.md)                           | Analysis of the current plugin behavior           |
| 03-01 | [Specialist Protocol](03-01-specialist-protocol.md)          | Detection, proposal, authority, lifecycle         |
| 03-02 | [Installer and Templates](03-02-installer-and-templates.md)  | Brief schema, generation, check, removal, sync    |
| 03-03 | [Execution Routing](03-03-execution-routing.md)              | Routing policy, plan table, exec-plan dispatch    |
| 07  | [Testing Strategy](07-testing-strategy.md)                     | Spec test cases and verification                  |
| 99  | [Execution Plan](99-execution-plan.md)                         | Phases, sessions, and task checklist              |

## Quick Reference

### Usage Examples

A user plan that needs a database-migration specialist:

```markdown
## Specialist Agents

| Role                   | Kind      | Use                                      | AR Ref |
| ---------------------- | --------- | ---------------------------------------- | ------ |
| pg-migration-reviewer  | reviewer  | phase 2 (schema backfill), phase 3 (cutover) | AR #7 |
```

Detection proposal (visible to the user before anything is written):

```text
Specialist candidate: pg-migration-reviewer (reviewer)
Evidence: db/migrations/0042_backfill.sql:1-80 requires mixed-version compatibility;
          AGENTS.md documents a custom migration ordering rule no catalog role carries.
Why existing options fail: correctness-reviewer has no schema-evolution lens; a dynamic packet
          would repeat the same 200-line context every phase.
Smallest alternative: keep re-sending the migration context in each phase packet.
Cost: one brief file, one generated agent, brief maintenance.
Verdict (design-challenger): Justified.
```

### Key Decisions

| Decision | Outcome | AR Ref |
| -------- | ------- | ------ |
| Authority | Recommend + explicit user approval; `--auto-design` cannot approve | AR #4 |
| Specialist kind | Novel domain specialists from a brief + generic templates | AR #5 |
| Detection points | `make-requirements`, `make-plan`, `analyze-project` | AR #6 |
| Discoverability | Model-visible description + AGENTS.md index + plan table; visible by default | AR #7 |
| Reasoning default | Specialists `reasoningEffort: max`; catalog roles unchanged | AR #10 |
| Removal | Generated agent + brief removed after confirmation | AR #11 |
| Complexity | Approved larger design with two trims | AR #21 |

## Related Files

New files:

| File | Purpose |
| ---- | ------- |
| `_shared/specialist-agents.md` | Canonical detection/proposal/routing/lifecycle protocol |
| `agent-templates/domain-specialist-reviewer.md` | Read-only specialist reviewer contract |
| `agent-templates/domain-specialist-executor.md` | Specialist executor contract |
| `scripts/install_agents.spec.test.mjs` | Behavioral spec tests for generation, check, removal, and sync |
| `scripts/install_agents.impl.test.mjs` | Edge-case and internal tests |
| `scripts/specialist-content.spec.test.mjs` | Protocol/skill content assertions |
| `scripts/specialists-migration.spec.test.mjs` | Flat-layout migration regression, including codeops.json preservation |
| `scripts/specialists-lifecycle.spec.test.mjs` | End-to-end brief → create → sync → check → remove lifecycle |

Changed files:

| File | Change |
| ---- | ------ |
| `scripts/install_agents.py` | `--custom`, `--remove-custom`, `--sync-agents-md`, brief validation, reasoning default |
| `schemas/codeops-config.schema.json` | Optional `reasoning` enum under `routing.roles.<role>` |
| `scripts/codeops-migrate.sh` | Preserve/refuse an existing `codeops/codeops.json` before migration (PF-013) |
| `_shared/layout-convention.md` | `codeops/specialists/` project-level path |
| `_shared/quality-profile.md` | Specialist resolution, `SR-NNN` prefix, dispatch/fallback rules |
| `skills/make-plan/SKILL.md`, `skills/make-plan/templates.md` | Detection step + `00-index.md` Specialist Agents section |
| `skills/make-requirements/SKILL.md` | Detection step + register recording |
| `skills/analyze-project/SKILL.md` | Specialization signals + setup-routing recommendation |
| `skills/setup-routing/SKILL.md`, `skills/setup-routing/routing.md` | Creation/removal flow + `reasoning` policy |
| `skills/exec-plan/SKILL.md`, `skills/exec-plan/execution-protocol.md` | Selection wiring + fallback pointer |
| `README.md` | Specialist workflow and agent-model documentation |
