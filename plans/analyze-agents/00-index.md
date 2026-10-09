# analyze-agents Implementation Plan

> **Feature**: Active specialist discovery — a manual `analyze-agents` skill with durable evidence and check state
> **Status**: Planning Complete
> **Created**: 2026-10-09
> **Implements**: REQ-ANALYZE-AGENTS
> **CodeOps Artifact Schema**: 1

## Overview

The specialist system detects capability gaps inside `make-requirements`, `make-plan`, and
`analyze-project`, but its outcomes are silent, its strongest signal (recurring findings) has no
durable record, and existing projects are never re-evaluated. Task T-07
(`plans/specialist-awareness/`) fixes the visibility and gating side; this feature adds the
missing execution surface and evidence.

`analyze-agents` is a manual, project-level check: the skill reads the repository's own artifacts
(requirements and plans, the new per-plan findings ledger, manifests) and applies the detection
criteria in `_shared/specialist-agents.md` natively — no script (AR #10). It presents at most two
evidence-backed candidates in the lightweight proposal format defined by T-07, or records `None`
with evidence, and it writes the check-state file so `analyze-project` can show coverage on every
run (AR #4, AR #5). Findings recurrence becomes computable through a per-plan `05-findings.md`
ledger written by `exec-plan` (AR #3, AR #8).

The dependency chain is one-way: T-07 ships the proposal format, the state-file interface, and the
`analyze-project` coverage line; this feature ships the producer side (skill, ledger wiring) and
delegates the existing detection steps to it (AR #12).

## Minimum-Sufficient Baseline

**Original goal:** Make CodeOps actively detect and propose project-specific specialist subagents,
and re-evaluate existing projects, with durable evidence — so the capability is actually used.

**Smallest viable design:** one skill document (`skills/analyze-agents/SKILL.md`), one ledger
convention (`plans/<plan>/05-findings.md`, written by exec-plan's existing ruling step), one small
state file (`codeops/specialist-check.json`, written by the skill on every run), and wording edits
in `_shared/specialist-agents.md`, `exec-plan`, `make-plan`, and `make-requirements` so the same
detection runs everywhere. No executable, no dependency, no CLI.

**Excluded machinery (AR #10, AR #15):** the earlier Python signal-collection script (challenger
verdict `Simplify`; dropped — native reading avoids the Python 3.8 TOML floor and one maintenance
surface), a project-level findings index (AR #3 chose per-plan), routing/catalog coverage analysis
(stays in `setup-routing`, AR #6), and any write to the content-free metrics store (AR #14).

**Approved complexity (AR #15):** the `Technical (complexity escalation)` entry approved the
**simplified larger option** — skill + ledger + state file, no script.

## Document Index

| #     | Document                                                   | Description                                          |
| ----- | ---------------------------------------------------------- | ---------------------------------------------------- |
| AR    | [Ambiguity Register](00-ambiguity-register.md)             | Zero-Ambiguity Gate decisions (audit trail)          |
| 00    | [Index](00-index.md)                                       | This document — overview and navigation              |
| 01    | [Requirements](01-requirements.md)                         | Feature requirements, scope, and acceptance          |
| 02    | [Current State](02-current-state.md)                       | Existing specialist system and the gaps this closes  |
| 03-01 | [analyze-agents Skill](03-01-analyze-agents-skill.md)      | Skill contract: reads, flow, output, state write     |
| 03-02 | [Findings Ledger and Check State](03-02-findings-ledger-and-state.md) | Record formats and their writers          |
| 07    | [Testing Strategy](07-testing-strategy.md)                 | Spec test cases and verification                     |
| 99    | [Execution Plan](99-execution-plan.md)                     | Phases, sessions, and task checklist                 |

## Quick Reference

### Running the check

Ask the agent to run `analyze-agents` in the project root. The skill reads the repository's
requirements, plans, findings ledgers, and manifests; it reports at most two evidence-backed
specialist candidates (or `None` with evidence) and always writes the check-state file.

### Check-state file

```json
{
  "checkedAt": "2026-10-09T15:02:00Z",
  "plans": ["analyze-agents", "fix-agent-frontmatter"]
}
```

The interface is owned by T-07 (consumed by the `analyze-project` coverage line); this plan is its
producer (AR #4, AR #9). Plan list is layout-aware (AR #13).

### Findings ledger row

```markdown
| RV-001 | 2 | MAJOR | scripts/install_agents.py | fixed |
```

Format owned by 03-02 §Ledger (AR #8).

## Specialist Agents

**None** — the capability-gap check in `_shared/specialist-agents.md` ran against this repository's
evidence: changes are skill/document wording plus content tests; there is no specialized framework,
no phase-spanning domain invariant beyond the catalog roles, and no recurring review hotspot — the
one historical hotspot (agent-file layout) is resolved and regression-pinned in
`scripts/install_agents.spec.test.mjs`. AR #15 records the feature-level complexity decision.

## Related Files

New: `skills/analyze-agents/SKILL.md`, `scripts/analyze-agents-content.spec.test.mjs`.

Changed: `_shared/specialist-agents.md`, `skills/exec-plan/execution-protocol.md`,
`skills/make-plan/SKILL.md`, `skills/make-requirements/SKILL.md`, `CHANGELOG.md`,
`package.json` (release only).

Depends on: `plans/specialist-awareness/` (T-07) for the proposal format, the state interface, and
the `analyze-project` coverage line.
