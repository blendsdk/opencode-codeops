# Effort Allocation Implementation Plan

> **Feature**: Five-level effort vocabulary, max guard, verified provider mapping, disclosure, and specialist default for RD-03
> **Status**: Planning Complete
> **Created**: 2026-11-24 00:32
> **Implements**: RD-03
> **CodeOps Artifact Schema**: 1

## Overview

Implement RD-03 as a focused extension of the existing reasoning-effort path. CodeOps gains
`xhigh` as a first-class suggestion, keeps `xhigh` as the default ceiling, guards canonical `max`,
normalizes a small verified set of provider/model variants, discloses the requested and applied
level on every effort-bearing surface, and changes the default for newly generated specialists to
`xhigh`.

The plan deliberately reuses `selectEffortVariant`, `applyEffort`, `normalizeModelVariants`, the
plugin’s effort hooks, and the installer’s generated-file model. It does not implement the
coverage-hunt protocol, the coverage auditor, or the workflow integrations; those remain RD-01,
RD-02, RD-04, and RD-05.

## Minimum-Sufficient Baseline

**Original goal:** Let CodeOps allocate minimum-sufficient effort on the current model, understand
the documented provider level names, avoid unintended `max`, and disclose what was actually applied.

**Smallest viable design:** Extend the existing resolver and helper with the five-level vocabulary,
a small verified provider table keyed by provider and model, a `max` guard, a fail-open no-variant
path, and a deduplicated capability line. Reuse the current plugin hooks and installer pattern.

**Excluded machinery:** a generic alias/settings/ordinal inference pipeline; required model
switching; a new config schema; a new UI; a coverage-hunt implementation; an orchestration runtime.

**Approved complexity:** None. AR-9 is a necessary test-map correction, not a support-layer
escalation.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (audit trail) |
| 00 | [Index](00-index.md) | Overview and navigation |
| 01 | [Requirements](01-requirements.md) | RD-03 delta and scope |
| 02 | [Current State](02-current-state.md) | Existing effort path and constraints |
| 03-01 | [Effort Vocabulary](03-01-effort-vocabulary.md) | Five levels, marker, helper, types |
| 03-02 | [Provider Resolution](03-02-provider-resolution.md) | Verified table, max guard, capability line |
| 03-03 | [Disclosure and Specialists](03-03-disclosure-and-specialists.md) | Header, reports, installer default |
| 07 | [Testing Strategy](07-testing-strategy.md) | ST cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, tasks, and progress |

## Quick Reference

### Canonical levels

`low`, `medium`, `high`, `xhigh`, `max`. `xhigh` is the default ceiling; canonical `max` is
explicit-only. `none` and `minimal` are routing-only. `default` is not a task level.

### Provider table

| Canonical | OpenAI | Anthropic | DeepSeek |
|-----------|--------|-----------|----------|
| `low` | `low` | `low` | `low` |
| `medium` | `medium` | `medium` | `high` |
| `high` | `high` | `high` | `high` |
| `xhigh` | `xhigh` | `xhigh` | `max` |
| `max` | explicit `max` | explicit `max` | `max` |

Runtime variants are authoritative. Unknown providers and gateways fail open.

### Key Decisions

| Decision | Outcome | AR Ref |
|----------|---------|--------|
| Provider keying | Exact `openai`/`anthropic`/`deepseek`; gateways fail open | AR-1 |
| Legacy specialist `max` | Generated-agent version marker; pre-marker `max` is legacy-valid | AR-2 |
| Capability-line dedupe | Per-session tuple; inject on change; clear on session deletion | AR-3 |
| Component docs | Three docs | AR-4 |
| Task verify | Test-map command after the AR-9 correction; interim scoped tests | AR-5, AR-9 |
| Scope | Strict RD-03 only | AR-6 |
| Phases | Four | AR-7 |
| Fixtures | User sets + repo sets + non-canonical fail-open | AR-8 |
| Test-map correction | Ignore `requirements/**` documentation | AR-9 |

## Specialist Agents

| Role | Kind | Use | AR Ref |
|------|------|-----|--------|
| `agent-pipeline-reviewer` | reviewer | Phase 3 — installer default, generated-agent marker, and agent-pipeline compatibility | Existing specialist; no new AR |

New specialist check: **None** — the effort work is a core CodeOps capability covered by the
existing catalog roles; no project-specific framework, invariant, or recurring finding area
justifies a new specialist.

_Detection evidence: the change reuses `bin/lib/reasoning-effort.mjs`, `plugin/index.ts`, and
`scripts/install_agents.py`; the existing `agent-pipeline-reviewer` already covers the
installer/generated-agent risk (AGENTS.md required-for rule)._

## Declared spec files

`bin/effort-vocabulary.spec.test.mjs`, `bin/effort-provider.spec.test.mjs`,
`bin/effort-provider.impl.test.mjs`, `plugin/effort-capability.spec.test.mjs`,
`plugin/effort-capability.impl.test.mjs`, `scripts/effort.spec.test.mjs`,
`scripts/reasoning-effort-content.spec.test.mjs`, `scripts/effort-disclosure-content.spec.test.mjs`,
`scripts/install_agents.spec.test.mjs`.

## Related Files

- `bin/lib/reasoning-effort.mjs`, `bin/lib/reasoning-effort.d.mts`
- `bin/reasoning-effort.spec.test.mjs`, `bin/reasoning-effort.impl.test.mjs`
- `scripts/codeops_effort.py`, `scripts/effort.spec.test.mjs`
- `scripts/reasoning-effort-content.spec.test.mjs`
- `plugin/index.ts`
- `_shared/reasoning-effort.md`, `_shared/quality-profile.md`
- `skills/preflight/SKILL.md`, `skills/preflight/report-format.md`
- `skills/exec-plan/execution-protocol.md`
- `skills/make-plan/templates.md`, `skills/make-plan/quality-checklist.md`
- `skills/setup-routing/SKILL.md`, `skills/setup-routing/routing.md`
- `scripts/install_agents.py`, `scripts/install_agents.spec.test.mjs`
- `README.md`, `CHANGELOG.md`
- `codeops/test-map/policy.json` (AR-9)

## Execution handoff

Run `exec-plan effort-allocation --auto-commit` when execution starts. The commit mode is owned by
`exec-plan`; `--auto-commit` does not grant planning authority.
