# Requirements: Effort Allocation

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-03](../../requirements/RD-03-independence-and-effort.md) — the OWNING requirements document
> **Status**: Planning Complete
> **CodeOps Artifact Schema**: 1

## Scope

This plan implements **RD-03 only**: the five-level effort vocabulary, `xhigh` ceiling, canonical
`max` guard, small verified provider table, fail-open no-variant behavior, capability line,
dispatch/artifact disclosure, and the new-specialist default. It does not implement RD-01, RD-02,
RD-04, or RD-05.

The RD is the authority for behavior and acceptance. This document records only the plan delta,
the implementation scope, and the necessary correction.

## Delta from RD-03

| Item | Plan treatment | Reference |
|------|----------------|-----------|
| All RD-03 Must requirements and Should FR-19/FR-20 | Implemented | RD-03 §Functional Requirements |
| Project alias override (FR-21) | Deferred; not part of this plan | RD-03 FR-21 |
| Coverage-hunt protocol/auditor/workflows | Out of scope; RD-01/02/04/05 | AR-6 |
| Generic alias/settings/ordinal pipeline | Out of scope; small verified table only | RD-03 §Won't Have, AR-1 |
| Required model switching | Out of scope; optional diversity only | RD-03 FR-16 |
| Test-map ownership of `requirements/**` | Necessary correction in Phase 1 | AR-9 |

## Necessary correction (AR-9)

`requirements/**` is documentation but is not currently owned or ignored by the project test map.
`node bin/codeops-test.mjs run --gate task --baseline HEAD` and `check --strict` fail with
`map.unknown-source`. The plan adds `requirements/**` to
`codeops/test-map/policy.json` `ignorePaths` with reason “requirements documentation,” backed by
the auto-design provenance in AR-9. This is a test-infrastructure correction, not a product scope
expansion.

## Planned modification set

| File | Change | Owner spec |
|------|--------|------------|
| `bin/lib/reasoning-effort.mjs` | Five levels, marker, resolver, max guard, no-variant fail-open | 03-01, 03-02 |
| `bin/lib/reasoning-effort.d.mts` | Type declarations | 03-01, 03-02 |
| `bin/reasoning-effort.spec.test.mjs` / `.impl.test.mjs` | Extend specs and impl tests | 07 |
| `scripts/codeops_effort.py` | Accept `xhigh` | 03-01 |
| `scripts/effort.spec.test.mjs` | Helper and parity tests | 07 |
| `scripts/reasoning-effort-content.spec.test.mjs` | Shared-doc and skill content tests | 07 |
| `plugin/index.ts` | Provider/model wiring, capability line, dedupe | 03-02 |
| `_shared/reasoning-effort.md` | Five levels, skill table, plan derivation | 03-01/03-03 |
| `_shared/quality-profile.md` | Single dispatch header; mode-aware packet | 03-03 |
| `skills/preflight/SKILL.md` / `report-format.md` | `xhigh` thorough, disclosure header | 03-03 |
| `skills/exec-plan/execution-protocol.md` | Summary disclosure | 03-03 |
| `skills/make-plan/templates.md` / `quality-checklist.md` | Five-level Reasoning line, effort checklist | 03-03 |
| `skills/setup-routing/SKILL.md` / `routing.md` | Effort policy, optional diversity, specialist default | 03-03 |
| `scripts/install_agents.py` / `.spec.test.mjs` | `xhigh` default, version marker, legacy check | 03-03 |
| `README.md`, `CHANGELOG.md` | User-facing documentation | 03-03 |
| `codeops/test-map/policy.json` | AR-9 ignore entry | 03-01/07 |

## Acceptance

Acceptance is owned by RD-03 §Acceptance Criteria and the ST cases in
[07-testing-strategy.md](07-testing-strategy.md). The plan adds no product behavior beyond RD-03.

## Security

- No new network endpoint, credential, or secret.
- Provider/model identifiers are escaped and length-capped before entering prompt-bound lines.
- Cross-provider model diversity remains optional and requires explicit approval; the default uses
  the current model.
- The installer writes only generated files; hand-authored files remain untouched.

## Out of scope

- Coverage-hunt protocol, coverage auditor, requirements/plan integrations.
- Generic provider inference pipeline.
- New config schema fields, UI, or orchestration runtime.
- Model-switching requirement.
- Project-level alias override.
