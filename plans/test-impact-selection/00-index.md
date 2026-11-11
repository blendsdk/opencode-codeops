# Test Impact Selection Implementation Plan

> **Feature**: Opt-in, language-neutral test-impact selection for CodeOps — run affected feature-slice groups during task/phase/PR work, keep the full suite as the release/acceptance/package gate.
> **Status**: Plan Preflighted
> **Created**: 2026-11-11 23:36
> **Implements**: REQ-TEST-IMPACT-SELECTION
> **CodeOps Artifact Schema**: 1

## Overview

CodeOps currently has one verification concept, used at every altitude: the project's full verify command runs before each task, each commit, each session wrap-up, and in CI. That is correct for a small suite and increasingly wasteful as the suite grows. In a large ERP, a dialog tweak pays for unrelated modules; in a compiler, a codegen fix pays for lexer, parser, and LSP tests.

This plan splits verification into explicit gates: **task**, **phase**, **PR/integration**, **release/package**, **acceptance**, and **production promotion**. The inner gates use an opt-in test-impact map of feature slices and tiers. The release/package gate always runs the full suite. A project with no map keeps today's behavior exactly; any selector error, unknown path, shared change, or stale map falls back to the full suite.

The plan is phased so it does not disrupt the existing flow. Phase 1 adds a plan-scoped `**Task verify**` command and the conditional standards wording — no new runtime tooling. Phases 2–5 add the map, selector, CLI, branch policy, and provenance. Phase 6 adds the `organize-tests` adoption skill and shadow mode. Phase 7 adds advisory GitHub CI templates and a reusable full-gate workflow for this repository. Phase 8 documents, pilots, verifies, and prepares the release.

## Minimum-Sufficient Baseline

**Original goal:** Stop running thousands of unrelated tests on every task/commit while keeping the full suite as the release, acceptance, and deployment gate.

**Smallest viable design:** Phase 1's plan-scoped task verify — a plan records a targeted command, make-plan runs it once and records the observed test count, exec-plan uses it per task/commit, and the full verify stays at phase/plan/CI/release. This is the independent challenger's `Simplify` recommendation and remains a supported fallback (AR-1, AR-35).

**Excluded machinery:** No service, daemon, database, external test-impact service, new dependency, or automatic test-file rewrite. No change to the CodeOps artifact/config schema (AR-16). No per-method dynamic coverage graph.

**Approved complexity:** AR-1 records the larger opt-in map/selector/skill/CI design, the independent `Simplify` verdict, the adopted mitigations, and the user's direct approval. AR-37 authorizes the plan-local targeted verification with a full `npm run verify` at every phase end.

## Document Index

| # | Document | Description |
| --- | --- | --- |
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions and complexity approval evidence |
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Functional, technical, security, and compatibility requirements |
| 02 | [Current State](02-current-state.md) | How verification works today and the gaps |
| 03-01 | [Lightweight Scoped Verification](03-01-lightweight-scoped-verification.md) | Standards, shared protocol, plan-scoped task verify, workflow integration |
| 03-02 | [Test Map Model](03-02-test-map-model.md) | Map schema, fragments, groups, tiers, branch policy, validation |
| 03-03 | [Selector Core](03-03-selector-core.md) | Change detection, glob matching, dependency closure, gate policy, fallback |
| 03-04 | [CLI and Runner](03-04-cli-and-runner.md) | Commands, output, exit codes, command execution, shadow mode |
| 03-05 | [Branch Policy and Provenance](03-05-branch-policy-and-provenance.md) | Branch classification, CI plan, nightly, map hash, artifact promotion |
| 03-06 | [Organize Tests Skill](03-06-organize-tests-skill.md) | Analysis, proposal, shadow adoption, check, refresh, audit, AGENTS block |
| 03-07 | [CI and Release Integration](03-07-ci-release-integration.md) | Dynamic shards, stable aggregator, release provenance, nightly, templates |
| 07 | [Testing Strategy](07-testing-strategy.md) | Specification test cases, impl tests, security tests, verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, tasks, verification |

## Quick Reference

### User-facing commands

```text
node "${CODEOPS_PLUGIN_ROOT}/bin/codeops-test.mjs" select --gate task --baseline <tree> [--json]
node "${CODEOPS_PLUGIN_ROOT}/bin/codeops-test.mjs" run    --gate task --baseline <tree>
node "${CODEOPS_PLUGIN_ROOT}/bin/codeops-test.mjs" check  [--strict] [--json]
node "${CODEOPS_PLUGIN_ROOT}/bin/codeops-test.mjs" plan   --gate pr|release|acceptance|nightly [--json]
node "${CODEOPS_PLUGIN_ROOT}/bin/codeops-test.mjs" shadow --baseline <ref>
node "${CODEOPS_PLUGIN_ROOT}/bin/codeops-test.mjs" provenance write|verify --record <file> ...
```

The exact contract is owned by [03-04](03-04-cli-and-runner.md) and [03-05](03-05-branch-policy-and-provenance.md).

### Key decisions

| Decision | Outcome | AR |
| --- | --- | --- |
| No map | Today's full verify, unchanged | AR-2 |
| Full gate | Release/package branch, acceptance, production promotion | AR-4, AR-11 |
| Nightly | Only when source/test/config changed since last successful full | AR-5 |
| Grouping | Feature slice primary; tiered `task`/`phase`/`release`/`acceptance` groups | AR-6 |
| Task budget | 120 s target, 180 s acceptable, soft warning | AR-7 |
| Map layout | Domain fragments under `codeops/test-map/`, single file for small projects | AR-8 |
| Always-run | Per-project, default none, must be fast | AR-9 |
| Acceptance | Per-project automated/manual/external | AR-10 |
| Artifact promotion | Same digest reuses full evidence; rebuild re-runs full | AR-14 |
| Map governance | CODEOWNERS, strict check, reasons for ignores | AR-24 |
| Adoption safety | Shadow mode with zero missed failures before enable | AR-23 |
| Dynamic CI | Stable `verify` aggregator required; affected shards vary | AR-30 |
| Old plans | No migration; one `**Verify**` line is the gate command | AR-27 |
| Release | Additive minor version via `scripts/release.mjs` | AR-34 |
| Last-full marker | `CODEOPS_LAST_FULL_SHA` / `--last-full-sha`; main missing/non-ancestor → full; nightly updates only on success | AR-5, AR-19 |
| No-map command | `fullCommand: null`; `run` needs `--full-command`; CI uses the existing full job | AR-2 |
| PR smoke | `policy.prSmoke` group list selected at the PR gate | AR-4, AR-6 |

## Specialist Agents

| Role | Kind | Use | AR Ref |
| --- | --- | --- | --- |
| `agent-pipeline-reviewer` | reviewer | Review Phase 1 and Phase 6 skill/AGENTS.md changes; review the Phase 7 CI-template and install-surface changes | AR-1, AR-29 |

_Detection evidence: `AGENTS.md` (repo) records the standing specialist requirement for any phase changing skills, agent templates, installer pathways, or the AGENTS.md managed blocks. This plan changes `skills/**`, `standards/**`, `_shared/**`, and the managed testing block; the existing `agent-pipeline-reviewer` is the matching standing role. No new specialist is proposed._

## Related Files

Files created or materially changed (details per component doc):

- `standards/coding-standards.md`, `standards/coding-standards-full.md`
- `_shared/test-selection.md`
- `skills/make-plan/{SKILL.md,templates.md,quality-checklist.md}`
- `skills/exec-plan/{SKILL.md,execution-protocol.md,commit-modes.md}`
- `skills/git-commit/SKILL.md`
- `skills/analyze-project/SKILL.md`
- `skills/organize-tests/**` (new)
- `schemas/test-map.schema.json` (new)
- `bin/lib/{test-map,test-map-validate,test-selection-glob,test-selection-changes,test-selection,test-selection-explain,test-runner,test-branch-policy,test-provenance}.mjs` (new)
- `bin/codeops-test.mjs` (new CLI)
- `bin/*.test.mjs` and `scripts/*content*.test.mjs` (new tests)
- `.github/workflows/{ci.yml,release.yml,verify-full.yml}` (additive/reusable)
- `.github/CODEOWNERS` (new; protects `codeops/test-map/**`)
- `_shared/spec-first-ordering.md` (conditional gate wording)
- `codeops/test-map/**` (new pilot policy, shared groups, and domain fragments)
- `AGENTS.md` managed testing block (via `analyze-project` / `organize-tests`)
- `README.md`, `CHANGELOG.md`, `package.json` (bin/files/version via release script)
