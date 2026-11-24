# Right-Sized Verification (Wave 1) Implementation Plan

> **Feature**: Make CodeOps verification proportional to the work, sharpen review, and keep execution state across compaction
> **Status**: Planning Complete
> **Created**: 2026-11-24 23:41
> **Implements**: REQ-RIGHT-SIZED-VERIFICATION (standalone — no RD, per AR-1)
> **Verification tier**: critical — every phase reviewed under today's review rules; test shape per AR-24
> **CodeOps Artifact Schema**: 1

## Overview

CodeOps builds more verification than the work needs. In this repository test code outweighs
non-test code about 1.6:1, and verification tasks make up 50–97% of each execution plan. The
causes are a fixed per-phase test ceremony, a complexity brake that judges single items but never
the running total, reviewers that turn every test gap into a fix task, and default coverage
targets.

This plan adds two verification tiers (`standard`, `critical`) that size the test ceremony and
review timing, a report-only verification balance per phase, calibrated review with a refuter
for critical/major findings, shorter skill descriptions, and a compaction note that keeps an
active run's place. `critical` keeps today's test ceremony and review frequency and is the tier of
every existing plan; review calibration and the refuter apply at every tier (AR-14, AR-28).

**Coverage:** disabled — --no-coverage-hunt (AR-2)

## Minimum-Sufficient Baseline

**Original goal:** Deliver faster with fewer tokens by sizing verification to the work, without
losing rigor where stakes are high.
**Smallest viable design:** Edit the existing shared protocols, skill text, reviewer template, and
plan templates; add one optional config property; add one small pure helper plus one hook call in
the plugin. No new agent, script, file format, or tool (AR-6, AR-7, AR-22).
**Excluded machinery:** a measurement script (AR-7); a dedicated refuter agent (AR-6); a new
ledger file (AR-22); a blocking brake (AR-5); a test injection seam (PF-021).
**Approved complexity:** None

## Assessment

Baseline, measured 2026-11-24 in this repository (AR-23):

| Measure | Baseline | Target | How measured |
|---|---|---|---|
| Verification share of plan tasks | 50–97% per plan (`live-task-sidebar` 11/14, `test-impact-selection` 83/86) | ≤ 40% for a standard-tier plan | Checkbox task lines in `99-execution-plan.md` matching `test\|verify\|verification\|red phase\|green phase\|review\|audit\|gate\|fixture\|guard` (case-insensitive) ÷ all checkbox task lines |
| Test vs non-test code | 23,517 test / 15,113 non-test lines (≈ 1.6:1); 0.85:1 when shipped Markdown counts as product | ≤ 1.5:1 per standard-tier phase | Test: `git ls-files 'bin/*.test.mjs' 'plugin/*.test.mjs' 'scripts/*.test.mjs'`; non-test: `.mjs/.ts/.tsx/.py` under `bin/ plugin/ scripts/` without tests and `.d.mts`; per phase: the `Verification balance` line (03-03) |
| Review fix commits | 8 "review findings" commits vs 54 `feat(` commits | −40% per feature | `git log --oneline \| grep -ci "review findings"` |
| Tokens / wall time | not recorded | −20% tokens, −25% time on standard work | `metrics.enabled` + outcome-review on the next real feature |
| Critical tier | today's ordering | unchanged | Phase 7 critical replay keeps the distinct red-phase task and per-phase review |

**What closes this plan (AC-3):** the Phase 7 replay of `live-task-sidebar` as `standard` meets the
verification-share target, and its `critical` replay keeps today's ordering. The balance,
fix-commit, token, and time targets are measured on the next real feature and do not gate this
plan.

## Document Index

| #   | Document | Description |
| --- | -------- | ----------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (30) |
| PF  | [Preflight Report](00-preflight-report.md) | Post-authoring audit |
| 00  | [Index](00-index.md) | This document |
| 01  | [Requirements](01-requirements.md) | Scope and acceptance criteria |
| 02  | [Current State](02-current-state.md) | Facts about the code this plan changes |
| 03-01 | [Verification Tiers](03-01-verification-tiers.md) | Tier set, derivation, review timing, config |
| 03-02 | [Review Calibration & Refuter](03-02-review-calibration.md) | Severity rule, exclusions, quoted rules, refute mode |
| 03-03 | [Verification Balance](03-03-verification-balance.md) | File classification and the report-only balance |
| 03-04 | [Skill Descriptions](03-04-skill-descriptions.md) | Description rules and rewrite |
| 03-05 | [Compaction Note](03-05-compaction-note.md) | Active-run note on compaction |
| 07  | [Testing Strategy](07-testing-strategy.md) | ST-cases and conventions |
| 99  | [Execution Plan](99-execution-plan.md) | Phases and tasks |

## Key Decisions

| Decision | Outcome |
| -------- | ------- |
| Tiers | `standard` and `critical` for full plans; mini-plans stay the light path (AR-11) |
| Tier source | Real-risk signals only, recorded in 00-index, overridable (AR-3, AR-13, AR-29) |
| Old plans | No tier line ⇒ `critical` (AR-14); upgrade-plan never derives a tier |
| Review timing | Standard reviews risky or large phases; the rest is reviewed before the plan is done (AR-15, PF-005) |
| Product lines | Markdown counts; artifacts, lockfiles, generated dirs excluded (AR-30) |
| Brake | Report-only `Verification balance` line per phase (AR-5) |
| Refuter | All 🔴/🟠 findings, all tiers; refuted findings stay visible and reinstatable (AR-19, AR-20, AR-28) |
| Measurement | No new tooling (AR-7, AR-23) |

## Specialist Agents

| Role | Kind | Use | AR Ref |
| ---- | ---- | --- | ------ |
| agent-pipeline-reviewer | reviewer | Phase 3 (changes `agent-templates/phase-reviewer.md` and the packaged `agents/correctness-reviewer.md`) | Project routing (AGENTS.md "Required for") |

_Detection evidence: AGENTS.md lists `agent-pipeline-reviewer` as required for any phase changing
`agent-templates/**` or `agents/*.md`; `.opencode/agents/agent-pipeline-reviewer.md` exists._

## Related Files

`_shared/spec-first-ordering.md`, `_shared/quality-profile.md`, `skills/make-plan/SKILL.md`,
`skills/make-plan/templates.md`, `skills/make-plan/quality-checklist.md`,
`skills/exec-plan/execution-protocol.md`, `skills/exec-plan/SKILL.md`,
`skills/exec-plan/commit-modes.md`, `skills/upgrade-plan/upgrade-checklists.md`,
`agent-templates/phase-reviewer.md`, `agents/correctness-reviewer.md`,
`schemas/codeops-config.schema.json`, `skills/*/SKILL.md` (descriptions),
`bin/lib/codeops-progress.mjs` (+ `.d.mts`), `plugin/index.ts`, `codeops/test-map/content.json`,
`plans/00-roadmap.md`, new `scripts/right-sized-verification-content.spec.test.mjs`,
new `plugin/compaction-note.spec.test.mjs`, new `plugin/compaction-note.impl.test.mjs`.
