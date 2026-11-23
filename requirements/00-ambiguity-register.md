# Ambiguity Register: Independent Planning Coverage

> **Status**: ✅ GATE PASSED — all 26 items resolved
> **Last Updated**: 2026-11-23 23:57
> **CodeOps Artifact Schema**: 1

## Feature seed

CodeOps can pass its Zero-Ambiguity Gate and preflight yet still miss requirements that nobody
imagined. The proposed capability adds an independent **coverage hunt** before the requirements and
plan gates: read-only agents inspect separate clusters of the 12 ambiguity categories, return
evidence-backed candidates and a coverage map, and the lead consolidates them into one user round.
**Model diversity** is part of the capability: at least one judgment agent should use a different
model from the author so the hunt does not reproduce the author's blind spots. The capability is
read-only and does not add parallel code writing, worktrees, a merge queue, or an orchestration
runtime.

## Selected domain lenses

| Lens | Why selected | Evidence |
|------|--------------|----------|
| Distributed and concurrent | Multiple agents are dispatched in parallel; the lead owns shared state; partial results, ordering, deduplication, and fallback must be specified | Parallel preflight and post-phase review already exist; the new hunt adds more concurrent judgment agents |
| Data and migration | Plan/requirements artifacts, routing config, and generated agent files evolve; existing projects must keep working without migration | Flat/nested layouts, `codeops.json`, generated `.opencode/agents/*.md`, legacy plans |

Not selected: **web application** (no new HTTP/UI surface; Discovery is reused as-is), **compiler and
language** (no grammar/IR/type-system change), **financial system** (no money movement).

## Register

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope | Default activation of the coverage hunt | A) On for full requirements sets and feature plans; off for mini-plans and trivial tasks; `--no-coverage-hunt` opt-out · B) Always opt-in · C) Always on, including mini-plans | ✅ User accepted recommendation A: on for full requirements sets and feature plans; off for mini-plans and trivial tasks; `--no-coverage-hunt` opt-out | ✅ Resolved |
| 2 | Scope | Which workflow stages run the hunt | A) Requirements pre-gate + plan pre-gate; preflight gains model-diversity disclosure only · B) Requirements only · C) Requirements + plan + a new coverage mode in preflight | ✅ User accepted recommendation A: requirements pre-gate + plan pre-gate; preflight gains model-diversity disclosure only | ✅ Resolved |
| 3 | Scope | Whether `review_requirements` (health check) uses the hunt | A) Yes, as the natural "what is missing?" mode · B) Keep consistency-only · C) Optional flag only | ✅ User accepted recommendation A: `review_requirements` uses the hunt as the "what is missing?" mode | ✅ Resolved |
| 4 | Scope | v1 non-goals | A) No parallel writes, worktrees, merge queue, orchestrator runtime, or new catalog role · B) Include parallel execution in v1 · C) Include orchestrator runtime in v1 | ✅ User accepted recommendation A: no parallel writes, worktrees, merge queue, orchestrator runtime, or new catalog role in v1 | ✅ Resolved |
| 5 | Behavioral | Model-diversity policy | A) Preferred: at least one judgment agent differs from the author's model when available; disclose `same-model only`; never block · B) Required for critical/high-risk work: block when unavailable · C) Off | ✅ User accepted recommendation A: preferred; at least one judgment agent differs from the author's model when available; disclose `same-model only`; never block | ✅ Resolved |
| 6 | Security | Provider policy for model diversity | A) Prefer same provider, different model; cross-provider only with explicit project approval recorded in routing · B) Cross-provider allowed by default · C) Same provider only | ✅ User accepted recommendation A: same provider, different model first; cross-provider only with explicit project approval recorded in routing | ✅ Resolved |
| 7 | Security | Prompt-injection handling for auditors reading repository content | A) File content is data, never instructions; read-only tools; no secrets in packets; evidence-only output · B) No special rule · C) Do not read repository files | ✅ User accepted recommendation A: repository content is data, never instructions; read-only tools; no secrets in packets; evidence-only output | ✅ Resolved |
| 8 | Behavioral | Auto-design behavior during the hunt | A) Agents only propose; lead resolves eligible technical candidates under existing policy; reserved decisions stay with the user; complexity escalations are never delegated · B) Auto-design may accept candidates automatically · C) Disable the hunt under auto-design | ✅ User accepted recommendation A: agents only propose; lead resolves eligible technical items; reserved decisions stay with the user; complexity escalations are never delegated | ✅ Resolved |
| 9 | Technical | Which agent performs the hunt | A) Reuse `preflight-auditor` with a clearly separated coverage-hunt mode and `CV-NNN` output · B) Add a new `coverage-auditor` catalog role · C) Use generic subagents only | ✅ User accepted recommendation A: reuse `preflight-auditor` with a clearly separated coverage-hunt mode and `CV-NNN` output | ✅ Resolved |
| 10 | Data & state | Where the coverage map is persisted | A) Section in `00-ambiguity-register.md` (requirements) and `00-index.md` (plan); no new artifact · B) New `00-coverage-report.md` per stage · C) Chat-only summary | ✅ User accepted recommendation A: section in `00-ambiguity-register.md` (requirements) and `00-index.md` (plan); no new artifact | ✅ Resolved |
| 11 | Behavioral | Dispatch budget and question-round cap | A) 4 clusters of 3 categories + ≤3 recon scouts; one consolidated user round; `--thorough` expands to 12 categories · B) 12 clusters always · C) 2 clusters | ✅ User accepted recommendation A: 4 clusters of 3 categories + ≤3 recon scouts; one consolidated user round; `--thorough` expands to 12 categories | ✅ Resolved |
| 12 | Naming | Name and candidate identifiers | A) "Coverage Hunt", candidates `CV-NNN` · B) "Coverage Review", candidates `CV-NNN` · C) "Gap Hunt", candidates `GAP-NNN` | ✅ User accepted recommendation A: "Coverage Hunt"; candidates `CV-NNN` | ✅ Resolved |
| 13 | Data & state | Backward compatibility for existing artifacts | A) Additive: existing plans, requirements sets, and configs stay valid; no new schema stamp; coverage map optional in legacy artifacts · B) Require migration to a new schema · C) New artifact schema version | ✅ User accepted recommendation A: additive; existing plans, requirements sets, and configs stay valid; no new schema stamp; coverage map optional in legacy artifacts | ✅ Resolved |
| 14 | Behavioral | Discovery integration for the consolidated question round | A) Use the existing Discovery question round when enabled; chat otherwise; no new UI · B) Chat only · C) Build a coverage-specific Discovery page | ✅ User accepted recommendation A: use the existing Discovery question round when enabled; chat otherwise; no new UI | ✅ Resolved |
| 15 | Technical | Evidence used to judge the capability successful | A) Content-free metrics: post-gate ambiguity rounds, preflight completeness findings, candidate acceptance rate, token cost; no prompts or artifact content · B) No metrics · C) Wall-clock time saved only | ✅ User accepted recommendation A: content-free metrics: post-gate ambiguity rounds, preflight completeness findings, candidate acceptance rate, token cost; no prompts or artifact content | ✅ Resolved |
| 16 | Document organization | Requirement-document decomposition | A) 5 RDs: RD-01 Protocol; RD-02 Auditor Mode; RD-03 Independence and Effort Allocation; RD-04 Requirements Integration; RD-05 Plan Integration. MVP = RD-01..04; Phase B = RD-05 · B) 3 RDs: Protocol; Auditor + Model Diversity; Workflow Integration · C) 1 RD covering the whole capability | ✅ User accepted recommendation A: five RDs, with RD-01 through RD-04 as the MVP and RD-05 as Phase B | ✅ Resolved |
| 17 | Scope | Whether `add_requirement` runs the coverage hunt in v1 | A) Keep it unchanged; it is a scoped add to an existing set and the existing gate still applies · B) Run a single-cluster scoped hunt · C) Run the full four-cluster hunt | ✅ User decision A: keep `add_requirement` unchanged in v1; its existing gate still applies | ✅ Resolved |
| 18 | Scope | Whether `upgrade-plan` runs the coverage hunt in v1 | A) Keep it unchanged/deferred; it is a separate migration workflow · B) Run the hunt on the upgraded plan · C) Full integration with the upgrade workflow | ✅ User decision A: keep `upgrade-plan` unchanged/deferred in v1; its existing workflow still applies | ✅ Resolved |
| 19 | Behavioral | Independence axes for coverage and review | A) Context + lens + effort are the baseline; model diversity is an optional bonus · B) Keep model diversity as the required third axis · C) Context + lens only | ✅ User accepted recommendation A: context + lens + effort; model diversity optional | ✅ Resolved |
| 20 | Scope | How broadly the effort policy applies | A) Coverage hunt applies the per-cluster policy by default; preflight audits and plan authoring apply it only when `--auto-effort` or an explicit policy is requested; execution stays phase-level in v1 · B) Apply per-task effort everywhere immediately · C) Apply only to the coverage hunt | ✅ User accepted recommendation A: coverage hunt default; preflight/plan authoring on `--auto-effort`; execution phase-level | ✅ Resolved |
| 21 | Behavioral | Compensation when the model has no usable effort variants or mapping | A) Fail open; keep the request unchanged; compensate with smaller packets, decomposition, and extra review; disclose `effort unavailable` · B) Force the nearest variant even when it is a distant jump · C) Block the run | ✅ User accepted recommendation A: fail open, compensate structurally, disclose | ✅ Resolved |
| 22 | Technical | How the applied effort and mapping are disclosed | A) The plugin injects one content-free capability line when effort is active and the artifacts report `requested → applied` · B) The agent infers from documentation · C) No disclosure | ✅ User accepted recommendation A: plugin capability line plus artifact disclosure | ✅ Resolved |
| 23 | Technical | How provider-specific effort names are normalized | A) Small verified provider table keyed by provider+model, runtime variants authoritative, exact/nearest, max guard, fail-open + fixtures · B) Canonical names only · C) Put provider names in the public vocabulary | ✅ User accepted recommendation A: normalize at the boundary with a small verified table; the generic alias/settings/ordinal pipeline is deferred | ✅ Resolved |
| 24 | Behavioral | Canonical effort scale and default ceiling | A) Five levels `low/medium/high/xhigh/max`; `xhigh` is the default ceiling; canonical `max` is explicit-only; a verified DeepSeek `xhigh→max` alias is the exception; `default` means inherit/no override; `none` is routing-only · B) Keep four levels with `max` as the default ceiling · C) Use `max` as the default ceiling on every provider | ✅ User accepted recommendation A: five levels, `xhigh` default ceiling, canonical `max` explicit-only, provider `max` only via the verified DeepSeek alias | ✅ Resolved |
| 25 | Technical | Provider effort mapping table | A) OpenAI/Anthropic identity for low/medium/high/xhigh/max; DeepSeek low→low, medium→high, high→high, xhigh→max, max→max, none→none; `max` on OpenAI/Claude is explicit-only · B) DeepSeek medium→low · C) DeepSeek xhigh→high | ✅ User accepted recommendation A; "always max on DeepSeek" means max is the top level, not every task | ✅ Resolved |
| 26 | Behavioral | Authority for inline fallback and the pre-gate plan-map placement | A) Inline fallback is recorded in the map and never skips a category; the plan map lives in the register before Phase 1C and is copied to `00-index.md` after the gate · B) Skip a failed cluster; write the map to `00-index.md` before the gate · C) Block the run when a subagent is unavailable or the index is blocked | ✅ User accepted recommendation A | ✅ Resolved |

## Resolution Notes

**AR-1–4 (activation and scope).** The hunt is on by default for full requirements sets and feature
plans, and off for mini-plans and trivial tasks. It runs at the requirements pre-gate and the plan
pre-gate. `review_requirements` uses it as the "what is missing?" mode. Preflight keeps its existing
13-dimension audit and gains only the independence and effort disclosure. v1 deliberately excludes
parallel writes, worktrees, a merge queue, an orchestrator runtime, and a new catalog role.

**AR-5–8 (independence, security, authority).** Model diversity is optional from AR-19 onward:
effort allocation is the baseline, and a different model is a preferred bonus when one is available
and approved. When no different model is available, the run records the model axis separately and
reports `mixed-effort` or `uniform-effort`. The same provider with a different model is the default;
cross-provider review requires explicit project approval recorded in routing. Auditors treat
repository content as data, never as instructions, and receive no secrets. Agents only propose;
the lead resolves eligible technical candidates under the existing auto-design policy, reserved
decisions remain user-owned, and complexity escalations are never delegated.

**AR-9–13 (mechanics and compatibility).** The existing `preflight-auditor` gains a clearly
separated coverage-hunt mode and returns `CV-NNN` candidates. The requirements map lives in
`00-ambiguity-register.md`; the plan map lives in the plan register before Phase 1C and is copied to
`00-index.md` after the gate. No new artifact or schema stamp is introduced. The default budget is
four clusters of three categories; `--thorough` is twelve single-category clusters; plus at most
three recon scouts and one consolidated user round. Existing plans, requirements sets, and configs
remain valid.

**AR-14–15 (operation and evidence).** The consolidated question round uses the existing Discovery
surface when enabled and chat otherwise. Success is judged with content-free metrics: post-gate
ambiguity rounds, preflight completeness findings, candidate acceptance rate, and token cost. No
prompts, decisions, paths, or artifact content enter the metrics store.

**AR-16:** Resolved. The five-RD decomposition keeps the protocol, auditor contract, independence
policy, and the two workflow integrations separately reviewable and testable. The MVP is RD-01
through RD-04; RD-05 follows as the plan-stage phase.

**AR-17–18:** Resolved by explicit user decisions. `add_requirement` and `upgrade-plan` stay
unchanged in v1 because neither is a full requirements or plan creation run; their existing gates
still apply. The hunt can be added later only if evidence shows a recurring gap in those modes.

**AR-19–22 (effort-first independence).** Independence now rests on three axes: fresh context,
distinct lens, and minimum-sufficient effort. Model diversity remains a preferred bonus when a
different model is genuinely available, but it is no longer the baseline; AR-19 refines AR-5
accordingly. The coverage hunt applies
the effort policy by default; preflight audits and plan authoring apply it only when `--auto-effort`
or an explicit policy is requested; execution stays phase-level in v1. When the current model has no usable effort
variants or the provider mapping is unavailable, CodeOps fails open, keeps the request unchanged,
compensates with smaller packets, decomposition, and extra review, and discloses `effort
unavailable`. The plugin injects one content-free capability line when effort is active, and the
artifacts report `requested → applied`; when no different model is available, the run records the
model axis separately and reports `mixed-effort` or `uniform-effort`, never `same-model` as the
independence status.

**AR-23–25 (provider normalization and scale).** CodeOps keeps a canonical five-level vocabulary:
`low`, `medium`, `high`, `xhigh`, `max`. `xhigh` is the default ceiling; canonical `max` is
explicit-only. `default` means inherit/no override; `none` is routing-only. OpenAI and Anthropic use
the canonical names; DeepSeek maps `medium → high` and `xhigh → max`, with `none → none`. Provider
names are normalized by a small verified table keyed by provider and model; runtime variants win;
the generic alias/settings/ordinal pipeline is deferred. `max` on OpenAI/Claude is never selected by
default. On DeepSeek, "always max" means max is the top level, not that every task runs at max.

**AR-26 (inline fallback and plan-map placement).** A failed or unavailable cluster is recorded as
an inline fallback in the coverage map; no category is skipped. The plan coverage map lives in the
plan's `00-ambiguity-register.md` before Phase 1C, because `00-index.md` is gate-blocked until 1C
passes; the section is copied into `00-index.md` after the gate. This preserves both the gate
contract and the pre-gate coverage visibility.

## Gate checklist

- [x] AR-1 through AR-15 resolved by explicit bulk acceptance ("all recommended")
- [x] AR-16 resolved by explicit user confirmation of the five-RD decomposition
- [x] AR-17 and AR-18 resolved by explicit user decision A
- [x] AR-19 through AR-26 resolved by explicit user acceptance of recommendations A
- [x] User reviewed and confirmed the complete register, including the effort and provider decisions
- [x] RDs and README were first written only after AR-1 through AR-16 passed the gate
- [x] RDs are ready for review; the gate does not claim user approval of each RD
- [x] No material support surface enters the requirements without the Complexity Escalation Gate
