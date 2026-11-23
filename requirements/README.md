# opencode-codeops — Independent Planning Coverage Requirements

> **Project**: opencode-codeops — CodeOps plugin for OpenCode
> **Status**: Review
> **Gate**: ✅ Passed — all 26 ambiguity-register items resolved
> **Created**: 2026-11-23
> **Architecture**: OpenCode 2 TypeScript plugin; Markdown skills and shared conventions; Python and Node tooling; `codeops/codeops.json` routing policy
> **CodeOps Artifact Schema**: 1

---

## Overview

CodeOps can pass its Zero-Ambiguity Gate and preflight yet still miss requirements that nobody
imagined. Preflight audits what an artifact says; it cannot reliably find what the artifact never
says. The Independent Planning Coverage feature adds an independent **coverage hunt** before the
requirements and plan gates. Read-only agents inspect separate clusters of the twelve CodeOps
ambiguity categories, return evidence-backed candidates and a coverage map, and the lead
consolidates the material candidates into one user round.

**Effort allocation** is the portable lever. All CodeOps subagents normally inherit the parent
model, and switching models is a deployment constraint. The feature makes independence explicit
across three axes — fresh context, a distinct lens, and a minimum-sufficient effort level — and adds
a fourth optional axis, a different model prior, only when one is genuinely available. CodeOps keeps
a canonical five-level vocabulary and normalizes OpenAI, Anthropic, and DeepSeek naming at the
runtime boundary.

The capability is deliberately read-only and additive. It does not add parallel code writing,
worktrees, a merge queue, an orchestration runtime, a new catalog role, a new artifact, or a new
schema stamp. Existing plans, requirements sets, and configuration remain valid.

## Minimum-Sufficient Baseline

**Original goal:** Catch missing requirements and ambiguities before the Zero-Ambiguity Gate and
the plan gate, using independent judgment so coverage does not depend on the author's blind spots.

**Smallest viable design:** Four read-only auditors, each covering three of the twelve ambiguity
categories, return evidence-backed candidates and a coverage map. The lead filters, asks one
consolidated round, and persists the map in the existing gate artifact. Effort is allocated per
cluster on the current model; a different model is used only when one is available and approved.

**Excluded support machinery:** parallel code writing, git worktrees, a merge queue, an
orchestration runtime, a new `coverage-auditor` catalog role, a new UI, a new artifact file, and a
new artifact-schema version.

**Approved complexity:** None. Every accepted option chose the smallest viable mechanism; no
Complexity Escalation Gate was triggered.

## Domain Glossary

| Term | Definition |
|------|-----------|
| **Coverage Hunt** | A pre-gate, read-only review that asks what the requirements or plan does **not** say, using independent agents and an explicit coverage map. |
| **Coverage Map** | A persisted table of clusters, areas examined, areas not examined, candidate counts, notes, and confidence, with a freshness line and a CV/DQ source note. It makes residual risk visible at the gate. |
| **Verified Provider Table** | A small, evidence-backed mapping keyed by provider and model family; runtime variants always take precedence. |
| **Max Guard** | A resolver rule that prevents a non-`max` request from selecting the provider’s `max` variant, except a verified DeepSeek `xhigh→max` alias. |
| **Freshness Line** | The map line that records the coverage date and the artifacts examined; add/upgrade-plan mark an existing map stale when the artifact changes. |
| **Coverage Cluster** | A default group of three CodeOps ambiguity categories, or a single category in thorough mode; a cluster receives one to three assigned categories. |
| **Coverage Candidate** | A reported gap, ambiguity, or unverified assumption, numbered `CV-NNN` locally. Only material candidates reach the user. |
| **Materiality Filter** | The lead's rule for deciding whether a candidate changes behavior, scope, data, security, architecture, acceptance, or an integration. Non-material candidates do not reach the user. |
| **Coverage Auditor** | A `preflight-auditor` subagent running in coverage-hunt mode. Read-only, evidence-bound, and forbidden to contact the user or decide. |
| **Consolidated Round** | The single user interaction that presents all material candidates after deduplication and filtering. |
| **Judgment Agent** | An agent that decides what counts as a gap or a finding, as opposed to a recon agent that only returns facts. |
| **Author Model** | The model of the parent session that authored the requirements or plan. |
| **Effort Allocation** | Choosing the minimum-sufficient reasoning level for a task on the current model. |
| **Canonical Effort Level** | One of `low`, `medium`, `high`, `xhigh`, `max`; the stable CodeOps vocabulary. |
| **Provider Mapping** | Translating a canonical level to a provider’s actual variant name; for example, DeepSeek `xhigh → max`. |
| **Capability Line** | The content-free system line that reports the model, variants, context limit, requested level, applied variant, and mapping source. |
| **No-variant Compensation** | Keeping the request unchanged when no effort variant applies, then using smaller packets, decomposition, and extra review. |
| **Model Diversity** | An optional fourth independence axis: using a different model for a judgment agent when one is available and approved. |
| **Independence Status** | `mixed-model`, `mixed-effort`, or `uniform-effort`; the strongest axis the run actually achieved. |
| **Residual Limit** | An area the hunt could not examine, or examined only partially. It is recorded in the coverage map, never hidden. |
| **Inline Fallback** | Running a coverage cluster in the lead session when a subagent is unavailable. The fallback is recorded, and no category is skipped. |
| **Provider Policy** | The project's rule for which model providers may receive repository content. Using the current model is the default; a same-provider different-model review is optional; cross-provider review requires explicit approval. |

## Document Index

| # | Document | Description | Depends On |
|---|----------|-------------|------------|
| **AR** | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (audit trail) | — |
| **RD-01** | [Coverage Hunt Protocol](RD-01-coverage-hunt-protocol.md) | Canonical cluster partition (default 4×3, thorough 12×1), dispatch packet, result contract, materiality filter, coverage map, budgets, fallback | RD-03 |
| **RD-02** | [Coverage Auditor Mode](RD-02-coverage-auditor-mode.md) | `preflight-auditor` coverage mode, `CV-NNN` output, evidence and refutation rules, enforced read-only boundary, prompt-injection and path constraints | RD-01 |
| **RD-03** | [Independence and Effort Allocation](RD-03-independence-and-effort.md) | Five-level effort scale, `xhigh` ceiling, max guard, small verified provider table, disclosure, optional model diversity | — |
| **RD-04** | [Requirements-Stage Integration](RD-04-requirements-stage.md) | `make-requirements` pre-gate run, diagnostic health check, coverage map in the register, Discovery/explore flags, freshness, compatibility | RD-01, RD-02, RD-03 |
| **RD-05** | [Plan-Stage Integration](RD-05-plan-stage.md) | `make-plan` recon plus pre-gate run, pre-gate map in the register, post-gate copy to `00-index.md`, flags, freshness, compatibility | RD-01, RD-02, RD-03 |

## Dependency Graph

```
RD-03 (Independence and Effort Allocation)
  ├── RD-01 (Coverage Hunt Protocol)
  │     └── RD-02 (Coverage Auditor Mode)
  │           ├── RD-04 (Requirements-Stage Integration)
  │           └── RD-05 (Plan-Stage Integration)
```

RD-03 supplies the five-level vocabulary and `max` guard that RD-01’s C4 dispatch requires, so it
comes first. RD-01 supplies the protocol and packet contract that RD-02 needs. RD-04 and RD-05
require all three.

## Suggested Implementation Order

| Phase | Documents | Description |
|-------|-----------|-------------|
| **A: MVP** | RD-03 → RD-01 → RD-02 → RD-04 | Effort vocabulary, protocol, auditor mode, and the requirements-stage hunt. This delivers the highest-value path: requirements are where missing behavior is cheapest to catch. |
| **B: Complete** | RD-05 | Plan-stage hunt against the RD and the real code, with the pre-gate map in the register and the post-gate copy in `00-index.md`. |

## Key Architecture Decisions

| Decision | Choice | Rationale | AR Ref |
|----------|--------|-----------|--------|
| Where the hunt runs | Requirements and plan pre-gates | Both artifacts authorize downstream work; absence is cheapest to catch before either crystallizes | AR-2 |
| Auditor reuse | Existing `preflight-auditor` with a coverage mode | It is already read-only, evidence-bound, cluster-scoped, and forbidden to contact the user; a new catalog role adds cost without a new capability | AR-9 |
| Artifact placement | Requirements map in the register; plan map in the register pre-gate, copied to `00-index.md` after Phase 1C | Keeps the single-authority model and respects the gate’s blocked-artifact rule | AR-10, AR-26 |
| Independence | Context + lens + effort; model optional | Effort is portable on the current model; model switching is a deployment constraint | AR-19 |
| Effort ceiling | `xhigh` by default; `max` explicit-only | Matches actual usage and controls token cost | AR-24 |
| Provider mapping | Canonical vocabulary; normalize at the boundary | OpenAI/Anthropic use canonical names; DeepSeek needs `medium→high`, `xhigh→max` | AR-23, AR-25 |
| Model diversity | Optional, preferred when available | No model switch requirement; effort is the baseline | AR-19, AR-5 |
| Provider boundary | Same provider by default; cross-provider only with explicit approval | Using the current model avoids cross-provider exposure | AR-6 |
| State ownership | Lead only | Parallel agents must not race on the plan, register, roadmap, or commits | AR-4, AR-8 |
| Failure behavior | Inline fallback, never skip a category | Coverage must remain complete enough to report limits, even when subagents are unavailable | AR-26 |
| Activation | On for full requirements sets and feature plans; off for mini-plans and trivial tasks | Full features justify the token cost; small work does not | AR-1 |
| Requirement decomposition | Five RDs | Keeps the protocol, auditor contract, independence policy, and each workflow integration separately reviewable | AR-16 |
| Canonical scale | Five levels, `xhigh` ceiling | Keeps the public vocabulary stable while matching real provider usage | AR-24 |
| Provider normalization | Small verified table keyed by provider and model; runtime variants win | Handles OpenAI/Anthropic/DeepSeek without an unapproved inference pipeline | AR-23, AR-25 |
| Max guard | Canonical `max` only on an explicit `max` request, except the verified DeepSeek `xhigh→max` alias | Prevents partial sets from over-powering ordinary work | AR-24, AR-25 |
| Specialist default | New generated agents use `xhigh`; existing `max` files are a legacy exception | Makes the no-default-`max` claim true for new work | AR-24 |
| Health check | Diagnostic; reopens the gate only when the user asks to act | Avoids silently changing a passed register | AR-3 |
| Freshness | Every map has a date/artifacts line; add/upgrade-plan mark it stale | Prevents an old map from claiming coverage it never had | AR-13 |
| Add mode and upgrade-plan | Unchanged in v1 | Both are scoped changes to existing artifacts, not full creation runs; their existing gates still apply | AR-17, AR-18 |

## Success Metrics

Recorded only when `metrics.enabled` is `true`, and always content-free.

| Metric | Source | Target |
|--------|--------|--------|
| Candidate acceptance rate | `coverage_hunt.accepted` | Tracked, not forced |
| Coverage limits | `coverage_hunt.completed` | Decreasing over time |
| Default `max` on OpenAI/Anthropic | `coverage_hunt.effort` (explicit flag) | 0 |
| Effort mapping fallbacks | `coverage_hunt.effort` | Decreasing over time |
| Post-gate ambiguity rounds | Manual baseline; not event-recorded in v1 | Same or fewer than today |
| Preflight completeness findings | Manual baseline; not event-recorded in v1 | Fewer than today |
| Token cost per feature | Manual/provider report; not event-recorded in v1 | Tracked; opt-out available |

No prompts, user decisions, file paths, or artifact content enter the metrics store.

## Non-Goals

- Parallel code writing, worktrees, a merge queue, or an orchestration runtime.
- A new `coverage-auditor` catalog role.
- A new coverage-specific UI or Discovery page.
- A new coverage artifact file or artifact-schema version.
- Automatic approval of findings, complexity escalations, or gate decisions.
- Replacing preflight or the Zero-Ambiguity Gate.
- A guarantee that the requirements are complete.
- Requiring a model switch for independent judgment.
- Putting provider-native effort names into the public CodeOps vocabulary.
- A generic alias/settings/ordinal inference pipeline; it is deferred until a real provider/model
  mismatch is demonstrated.

## Specialist Check

**None** — the capability is generic across CodeOps projects. `preflight-auditor` already provides
read-only, evidence-bound, cluster-scoped judgment, and effort allocation plus optional model
diversity are policy rather than standing domain knowledge. No project-specific framework,
invariant, or recurring finding area justifies a new specialist.

The existing `agent-pipeline-reviewer` specialist is required for the phases that change
`agent-templates/preflight-auditor.md` and the generated `agents/preflight-auditor.md`; that is a
review routing requirement, not a new specialist.

## Commonly Forgotten Requirements — Final Check

| # | Concern | Addressed? | Where / reason |
|---|---------|------------|----------------|
| 1 | Audit logging / activity trail | Yes | Dispatch headers, coverage map, and the register are the audit trail |
| 2 | Data export | N/A | No user-facing data store |
| 3 | API versioning | N/A | No public API; package semver covers skill contracts |
| 4 | Rate limiting | N/A | No network endpoint; dispatch budgets are the analogous control |
| 5 | Error messages / UX | Yes | RD-01 fallback messages and RD-04/RD-05 announcements |
| 6 | Empty states | Yes | RD-01 explicit “no material gaps” result |
| 7 | Loading states | N/A | CLI/agent workflow, no UI |
| 8 | Accessibility | N/A | No new UI |
| 9 | Mobile responsiveness | N/A | No new UI |
| 10 | Backup & disaster recovery | N/A | Artifacts are git-versioned |
| 11 | Monitoring & alerting | Partial | Opt-in content-free metrics; no alerting |
| 12 | Email notifications | N/A | No email surface |
| 13 | Search | N/A | No search surface |
| 14 | Pagination | N/A | No list UI |
| 15 | File upload | N/A | No upload surface |
| 16 | Soft vs hard delete | N/A | No user data records |
| 17 | Timezone handling | N/A | Existing timestamp format only |
| 18 | Localization | N/A | English-only developer tooling |
| 19 | Terms of service / privacy | N/A | No consumer service |
| 20 | GDPR / retention | N/A | No PII; metrics are content-free |
| 21 | Session management | N/A | Reuses OpenCode sessions |
| 22 | Graceful degradation | Yes | RD-01 inline fallback and residual limits |
| 23 | Admin capabilities | N/A | No admin surface |
| 24 | Onboarding | Yes | README and skills documentation |
| 25 | Configuration management | Yes | Skill flags and existing routing pins |
| 26 | Input validation & sanitization | Yes | RD-01 validates packets and paths; no new external input |
| 27 | Injection prevention | Yes | RD-02 prompt-injection rule; no SQL or shell interpolation from user input |
| 28 | Authentication & authorization | N/A | No new endpoint; OpenCode permissions apply |
| 29 | Rate limiting on auth/public APIs | N/A | No auth or public API surface |
| 30 | Secrets management | Yes | No secrets in packets or metrics; provider policy in RD-03 |
| 31 | Data encryption | N/A | Transport and storage belong to the host/provider |
| 32 | Infrastructure hardening | N/A | No new service or container |
| 33 | Security testing | Yes | RD-02 and RD-03 acceptance criteria cover injection, read-only permissions, and disclosure |

## How to Use These Documents

1. Pick a requirements document, starting with RD-03.
2. Run the `make-plan` skill on that RD.
3. Run `preflight` on the resulting plan.
4. Execute with `exec-plan`.

The `## Specialist Agents` table in each plan must list `agent-pipeline-reviewer` for phases that
change agent templates or generated agent files.
