# Preflight Report: Independent Planning Coverage Requirements

> **Status**: ✅ PREFLIGHT PASSED WITH NOTES — all 46 findings resolved; 3 residual notes accepted
> **Iteration**: 2 (fix verification)
> **Artifact**: Requirements set at `requirements/` — README, 00-ambiguity-register, RD-01..RD-05
> **Iteration 1 hash**: `fa1eb2009bcbcb091bfd8bb546483c169dffadadc2d4d6d808c99ca832537925`
> **Iteration 2 hash**: `52520b37668a1044a2c790a1a065654e31fd5dd4828f1e5fa623d0c11cf7a789`
> **Codebase Grounded**: ~20 source/config documents examined; ~40 references mapped
> **Last Updated**: 2026-11-24 00:22

> ⚠️ **SAME-SESSION REVIEW** — this set was authored in the current session. The five auditors run in fresh contexts, but the model prior is shared. A separate session would give stronger independence.

### Codebase Context Summary

**Tech Stack:** TypeScript/Node 18+ OpenCode 2 plugin; Markdown skills; Python 3.8+ tooling; JSON Schema; React/Fluent UI Discovery (not touched).

**Architecture:** plugin entry `plugin/index.ts`; workflows in `skills/`; shared conventions in `_shared/`; agent templates in `agent-templates/` generated to `agents/`; installer `scripts/install_agents.py`; config schema `schemas/`; roadmap `plans/00-roadmap.md`.

**Key Files Examined:** `plugin/index.ts`, `bin/lib/reasoning-effort.mjs`, `_shared/reasoning-effort.md`, `_shared/quality-profile.md`, `_shared/zero-ambiguity-gate.md`, `_shared/discovery.md`, `skills/preflight/SKILL.md`, `skills/preflight/report-format.md`, `skills/make-plan/SKILL.md`, `skills/exec-plan/execution-protocol.md`, `skills/setup-routing/SKILL.md`, `skills/setup-routing/routing.md`, `agent-templates/preflight-auditor.md`, `agents/preflight-auditor.md`, `scripts/install_agents.py`, `schemas/codeops-config.schema.json`, `plans/00-roadmap.md`, `AGENTS.md`, `README.md`.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 5 | 🟡 MINOR |
| 2 | Implicit Assumptions | 2 | 🟠 MAJOR |
| 3 | Logical Contradictions | 2 | 🟡 MINOR |
| 4 | Completeness Gaps | 3 | 🟡 MINOR |
| 5 | Dependency Issues | 1 | 🟠 MAJOR |
| 6 | Feasibility Concerns | 1 | 🟡 MINOR |
| 7 | Testability | 1 | 🟡 MINOR |
| 8 | Security Blind Spots | 1 | 🟠 MAJOR |
| 9 | Edge Cases | 2 | 🟡 MINOR |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 2 | 🟠 MAJOR |
| 12 | Consistency | 2 | 🟡 MINOR |
| 13 | Codebase Alignment | 3 | 🟡 MINOR |

*All five auditor clusters are merged. Dimension counts are indicative; the severity totals and the individual findings below are authoritative.*

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 1 | resolved — verified |
| 🟠 MAJOR | 18 | resolved — verified |
| 🟡 MINOR | 25 | resolved — verified |
| 🔵 OBSERVATION | 2 | resolved — verified |

### Iteration 2 Verification

| Check | Result |
|-------|--------|
| Broken links in the requirement set | 0 |
| Register decisions | 26/26 resolved, 0 open |
| AR traceability | AR-1 through AR-26 all referenced |
| Stale contradictions | None found in the active RDs (historical AR-5 and preflight-report text excluded) |
| Dependency graph / roadmap | RD-03 → RD-01 → RD-02 → RD-04/05; roadmap rows aligned |
| New critical/major findings | None |

**Verification scope:** focused fix verification over the changed requirement sections. A full fresh
13-dimension re-scan was not re-fanned to five auditors; that remains available on request.

**Residual notes (accepted):**
- **PF-029:** RD-04/RD-05 retain stage-summary tables for readability. Both now state that RD-01/RD-03 are canonical and win on conflict.
- **PF-030:** Post-gate rounds, preflight completeness findings, and token cost are marked manual in the success-metrics table; the event-recorded metrics are the v1 set.
- **PF-015:** AR-5 remains a historical row; the AR-5–8 and AR-19 resolution notes state that model diversity is optional and effort is the baseline.

**Verdict:** ✅ **PASSED WITH NOTES** — all critical and major findings are resolved and verified; the residual notes are minor documentation choices. The requirement set is ready for planning.

---

## Consolidated Ruling

**Date:** 2026-11-24
**User decision:** Accept all recommendations. Explicit choices: **PF-017 A** (simplify the provider layer),
**PF-022 A** (diagnostic health check), **PF-019 A** (new specialist default `xhigh`; legacy exception),
**PF-031 A** (add Discovery and explore-scope support to `make-requirements`), and **PF-018 A**
(critical: plan map in the register pre-gate, copied to `00-index.md` after the gate).
**Action:** Apply fixes. All findings are resolved by their recommended option; individual
`User Decision` fields below are superseded by this consolidated record.
**Verification:** Iteration 2 pending.

---

## Findings

### PF-001: RD-01 and RD-03 form an implementation dependency cycle [🟠 MAJOR]

**Dimension:** 11 (Ordering & Sequencing), 5 (Dependency Issues)

**Location:** `requirements/README.md` dependency graph; `requirements/RD-01-coverage-hunt-protocol.md` FR-12; `requirements/RD-03-independence-and-effort.md` FR-13.

**Codebase Evidence:** `bin/lib/reasoning-effort.mjs:34` has four `EFFORT_LEVELS`; `:70` marker regex accepts four; `:312` `EFFORT_RANK` already includes `xhigh`. RD-01 requires C4 to run at `xhigh` and the coverage result to carry effort. RD-03 introduces the five-level vocabulary and the `xhigh` marker/flag. RD-03 is listed as depending on RD-01.

**The Problem:** RD-01 cannot implement or test its C4 `xhigh` dispatch, or its effort acceptance criteria, until RD-03 adds `xhigh` to the suggestion vocabulary and marker grammar. RD-03 is sequenced after RD-01. The dependency graph is therefore inconsistent with the acceptance criteria.

**Options:**
- A) Implement the vocabulary expansion (five levels, marker, `--auto-effort=xhigh`) as the first RD-03 task, and order RD-03 before RD-01.
- B) Move the vocabulary expansion into RD-01 as a prerequisite, leaving RD-03 for provider mapping and disclosure.
- C) Use `high` for C4 until RD-03 lands (violates the accepted policy).

**Recommendation:** Option A — make RD-03 the first implementation step, then RD-01. Update the README dependency graph and roadmap dependency cells to `RD-03 → RD-01`.

**User Decision:** ✅ Resolved — User accepted recommendation Option A: implement RD-03 first, then RD-01; update the dependency graph and roadmap.

---

### PF-002: RD-03 references a nonexistent exec-plan file [🟡 MINOR]

**Dimension:** 13 (Codebase Alignment)

**Location:** `requirements/RD-03-independence-and-effort.md`, “Changes to existing surfaces” row `skills/exec-plan/resolution-protocol.md`.

**Codebase Evidence:** `skills/exec-plan/` contains `SKILL.md`, `commit-modes.md`, and `execution-protocol.md`; there is no `resolution-protocol.md`.

**The Problem:** The change map points the implementer at a file that does not exist. The required exec summary update would be missed or misdirected.

**Options:**
- A) Correct the row to `skills/exec-plan/execution-protocol.md`.
- B) Create a new `resolution-protocol.md` (unnecessary; the existing file owns the summary).

**Recommendation:** Option A.

**User Decision:** ✅ Resolved — User accepted recommendation Option A: correct the path to `skills/exec-plan/execution-protocol.md`.

---

### PF-003: Plan suggestion derivation is attributed to the wrong file [🟡 MINOR]

**Dimension:** 13 (Codebase Alignment)

**Location:** `requirements/RD-03-independence-and-effort.md`, change row `skills/make-plan/SKILL.md`; `_shared/reasoning-effort.md:97-112`.

**Codebase Evidence:** `_shared/reasoning-effort.md` owns the “Plan suggestion derivation” table; `skills/make-plan/SKILL.md` only states the skill’s recommended level.

**The Problem:** The implementation would edit the wrong document for the `max → xhigh` plan-suggestion change.

**Options:**
- A) Change the row to `_shared/reasoning-effort.md` (and keep `make-plan` only for any flag wording).
- B) Duplicate the derivation table in `make-plan` (violates the “reference, don’t restate” rule).

**Recommendation:** Option A.

**User Decision:** ✅ Resolved — User accepted recommendation Option A: point the change at `_shared/reasoning-effort.md`; keep `make-plan` only for flag wording.

---

### PF-004: DeepSeek is treated as one provider-wide variant set [🟠 MAJOR]

**Dimension:** 2 (Implicit Assumptions), 13 (Codebase Alignment)

**Location:** `requirements/RD-03-independence-and-effort.md`, “Provider mapping” table and AC 7; `_shared/reasoning-effort.md:30`; `skills/setup-routing/routing.md:50-51`; `plans/adaptive-reasoning-effort/02-current-state.md:63`.

**Codebase Evidence:** The RD says DeepSeek exposes `default/none/low/high/max` and maps `medium→high`, `xhigh→max`. The repo’s own contract says the deepseek flash model exposes `low/high/max`, and its plan evidence says `low/medium/high/max` when the API id contains `deepseek-v4`. The provider-wide table can mis-map a model that actually exposes `medium`, and the acceptance test “medium→high” would fail if the runtime exact-matches `medium`.

**The Problem:** Provider naming is model-specific, not provider-specific. The table is presented as a provider-wide truth, but the repository already documents at least two DeepSeek variant sets. The runtime variant set must be authoritative; the table must be a fallback for models that lack the canonical level.

**Options:**
- A) Key the mapping by provider **and model family**; exact runtime variants always win; the table is a fallback. Add fixtures for the user’s DeepSeek model and the documented deepseek flash model.
- B) Keep the provider-wide table and rely on exact-match precedence.
- C) Remove the DeepSeek mapping and fail open for every DeepSeek model.

**Recommendation:** Option A.

**Merged duplicate:** PA-005 adds that three different DeepSeek sets are recorded (`low/high/max`, `low/medium/high/max`, and the new `default/none/low/high/max`), that the “verified” claim lacks a fixture, and that provider IDs alone do not cover gateways fronting multiple vendors. The provider+model keying and runtime-authoritative rule above is the resolution; the table cannot be called verified until a trace fixture exists.

**User Decision:** ✅ Resolved — User accepted recommendation Option A: key the mapping by provider and model family; runtime variants authoritative; table is a fallback; add fixtures for both DeepSeek sets.

---

### PF-005: The coverage auditor’s “read-only” boundary is not enforced with Bash allowed [🟠 MAJOR]

**Dimension:** 8 (Security Blind Spots)

**Location:** `requirements/RD-02-coverage-auditor-mode.md` FR-9/FR-10; `agent-templates/preflight-auditor.md` permissions (`edit: deny`, `bash: allow`); `requirements/RD-03-independence-and-effort.md` security section.

**Codebase Evidence:** The generated auditor has `edit: deny` but `bash: allow`. Bash can mutate files. The template says “Bash is for inspection only,” but nothing enforces it. Routing policy supports `sandbox: read-only`.

**The Problem:** The RD claims a read-only auditor, but the only enforced restriction is `edit: deny`. A prompt injection or a mistaken command can write through Bash. The new coverage mode reads more repository content than the preflight audit, increasing the exposure.

**Options:**
- A) Require `sandbox: read-only` in routing for `preflight-auditor` and document Bash as inspection-only.
- B) Deny Bash in coverage mode; use read/grep/glob only.
- C) Keep the current permissions and rely on the prompt-injection rule.

**Recommendation:** Option A; if the host cannot enforce the sandbox, use Option B. Do not claim read-only without an enforced boundary.

**Merged duplicate:** PA-006 adds that `bash: allow` can also write, use the network, or exfiltrate content, and that packet path validation lacks canonicalization/symlink confinement. The same resolution applies: enforce the boundary, add read-only/command policy and path confinement, and test write/network commands.

**User Decision:** ✅ Resolved — User accepted recommendation Option A: require `sandbox: read-only`; fall back to denying Bash if the host cannot enforce it.

---

### PF-006: Capability-line injection frequency is unspecified [🟡 MINOR]

**Dimension:** 1 (Ambiguities), 6 (Feasibility)

**Location:** `requirements/RD-03-independence-and-effort.md` FR-10 and “Capability line”.

**Codebase Evidence:** `plugin/index.ts:317-371` runs the effort resolution on every request; injecting a system line “when effort is active” could repeat on every turn.

**The Problem:** Repeating the line adds context cost and noise, especially in long sessions. The requirement does not say once per dispatch, once per session, or on every request.

**Options:**
- A) Inject once per session or dispatch when the resolved level or mapping changes; dedupe repeats.
- B) Inject on every request.
- C) Keep the line out of the system context and report only in artifacts.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved — User accepted recommendation Option A: inject once per dispatch/session when the resolved level or mapping changes; dedupe repeats.

---

### PF-007: The coverage map must record every cluster, but the table has no cluster column [🟡 MINOR]

**Dimension:** 1 (Ambiguities), 12 (Consistency)

**Location:** `requirements/RD-01-coverage-hunt-protocol.md`, Coverage map table and “must record every cluster” sentence.

**Codebase Evidence:** The table columns are `Area | Examined | Not examined / limit | Candidates | Confidence`; there is no cluster column.

**The Problem:** “Record every cluster” cannot be verified from the table shape. A cluster with no material gap has no obvious row.

**Options:**
- A) Add a `Cluster` column.
- B) Require one summary row per cluster.
- C) Drop the “every cluster” requirement.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-008: RD-03 omits the effort type declaration and existing tests from its change surface [🟡 MINOR]

**Dimension:** 4 (Completeness Gaps), 13 (Codebase Alignment)

**Location:** `requirements/RD-03-independence-and-effort.md`, “Changes to existing surfaces”; `bin/lib/reasoning-effort.d.mts`; `bin/reasoning-effort.spec.test.mjs`; `bin/reasoning-effort.impl.test.mjs`.

**Codebase Evidence:** `EFFORT_LEVELS` and `selectEffortVariant` are exported and typed in the `.d.mts`; the spec/impl tests assert the four-level vocabulary and marker behavior. `npm run verify` runs `tsc --noEmit` and `node --test`.

**The Problem:** The RD lists `bin/lib/reasoning-effort.mjs` but not its declaration or tests. The implementation would hit typecheck/test failures or miss required updates.

**Options:**
- A) Add the `.d.mts` and both test files to the change surface and acceptance criteria.
- B) Rely on the plan/implementation to discover them.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved — User accepted recommendation Option A: add the `.d.mts` and both effort test files to the change surface and acceptance criteria.

---

### PF-009: No CHANGELOG requirement [🟡 MINOR]

**Dimension:** 4 (Completeness Gaps), 13 (Codebase Alignment)

**Location:** `requirements/RD-03-independence-and-effort.md` / README; `AGENTS.md` versioning policy.

**Codebase Evidence:** `AGENTS.md` says all user-facing behavior changes go in `CHANGELOG.md`; the RDs do not mention it.

**The Problem:** A behavior-changing feature (five-level vocabulary, provider mapping, disclosure) would ship without the required changelog entry.

**Options:**
- A) Add a changelog acceptance criterion to RD-03.
- B) Defer to the release workflow.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved — User accepted recommendation Option A: add a changelog acceptance criterion to RD-03.

---

### PF-010: `--thorough` 12-cluster runs have no concurrency cap [🟡 MINOR]

**Dimension:** 9 (Edge Cases)

**Location:** `requirements/RD-01-coverage-hunt-protocol.md` Budget; RD-03/04/05 `--thorough`.

**Codebase Evidence:** `routing.maxConcurrentAgents` exists in `schemas/codeops-config.schema.json:33` and `skills/setup-routing/routing.md:16`, but no consumer enforces it.

**The Problem:** A 12-cluster run may dispatch 12 agents at once, exceeding host or provider limits. The existing preflight `--thorough` has the same latent issue, but the new feature makes it explicit.

**Options:**
- A) Cap concurrent dispatches at `maxConcurrentAgents` or a default (for example 5) and queue the rest.
- B) Dispatch all at once.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-011: “Ordinal fallback when the scale is clearly ordered” is undefined [🟡 MINOR]

**Dimension:** 1 (Ambiguities), 2 (Implicit Assumptions)

**Location:** `requirements/RD-03-independence-and-effort.md`, normalization algorithm.

**Codebase Evidence:** `bin/lib/reasoning-effort.mjs:427` normalizes the host `variants` array but does not document an ordering guarantee.

**The Problem:** “Clearly ordered” has no testable definition. If the host array order is not meaningful, ordinal mapping can silently choose the wrong level.

**Options:**
- A) Define it as a documented provider order or numeric/ordered IDs; otherwise fail open.
- B) Always use the array order.
- C) Never use ordinal fallback.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-012: Conflicting candidates across clusters have no merge rule [🟡 MINOR]

**Dimension:** 9 (Edge Cases)

**Location:** `requirements/RD-01-coverage-hunt-protocol.md`, “Materiality filter” and “Coverage map”.

**Codebase Evidence:** The protocol says dedupe by root cause and present one round; it does not define what to do when two clusters assert contradictory answers.

**The Problem:** The lead could silently pick one side, or present a confusing contradiction, without a recorded rule.

**Options:**
- A) Keep both, use the higher severity, and present the disagreement to the user when material.
- B) Let the lead pick silently.
- C) Drop both.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-013: `default` conflates provider default with parent inherit [🟡 MINOR]

**Dimension:** 1 (Ambiguities), 12 (Consistency)

**Location:** `requirements/RD-03-independence-and-effort.md` FR-2 and canonical scale table.

**Codebase Evidence:** The current “inherit” path keeps the parent session’s model variant; it does not reset to a provider `default` variant. The RD says “`default` means inherit/no override” but also that `default` is not a task level.

**The Problem:** “Provider default” and “inherit the parent variant” are different behaviors. A reader cannot tell which one “default” means.

**Options:**
- A) State explicitly: absence of a marker means inherit the parent variant; CodeOps never selects the provider’s `default` variant.
- B) Add `default` as a task level with provider-default semantics.
- C) Define default as inherit and never mention the provider variant.

**Recommendation:** Option A.

**Merged duplicate:** PA-012 adds that a captured marker persists for the whole session; after any marker, absence does not restore inherit, and `[codeops-effort: default]` is not recognized. The resolution must include an explicit reset path (`default` marker or `--auto-effort=default`) or qualify FR-2 to say inherit requires a fresh session.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-014: Effort disclosure is required but absent from the specified forms [🟠 MAJOR]

**Dimension:** 1 (Ambiguities), 7 (Testability)

**Location:** `requirements/RD-04-requirements-stage.md` coverage map example; `requirements/RD-05-plan-stage.md` coverage map example; both acceptance criteria.

**Codebase Evidence:** The examples show `Effort: C1–C3 high, C4 xhigh`, but the acceptance criteria require the `requested → applied` form.

**The Problem:** An implementer could satisfy the example without disclosing the applied provider variant, failing the intent of the disclosure.

**Options:**
- A) Add an applied example (for example, `C4 xhigh→max` on DeepSeek) and keep the summary compact.
- B) Keep requested-only in the summary and require the applied map in the result.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-015: AR-5 still reads as a requirement for model diversity [🔵 OBSERVATION]

**Dimension:** 3 (Logical Contradictions), 12 (Consistency)

**Location:** `requirements/00-ambiguity-register.md`, AR-5 row and resolution notes.

**Codebase Evidence:** AR-5 says “at least one judgment agent differs from the author’s model when available”; AR-19 makes model diversity optional. The AR-19–22 note explains the refinement, but the AR-5 row itself still reads as a requirement.

**The Problem:** A reader could treat AR-5 as an active requirement and reintroduce mandatory model switching.

**Options:**
- A) Add a “superseded by AR-19 for the mandatory part” note to AR-5.
- B) Leave the historical row unchanged.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-016: Setup-routing and README changes lack acceptance criteria [🟡 MINOR]

**Dimension:** 4 (Completeness Gaps), 7 (Testability)

**Location:** `requirements/RD-03-independence-and-effort.md`, “Changes to existing surfaces” rows for `skills/setup-routing/SKILL.md`/`routing.md` and `README.md`.

**Codebase Evidence:** The RD says setup-routing explains effort allocation and optional diversity, and README documents the five levels and provider mapping, but no acceptance criterion asserts either update.

**The Problem:** The change could be omitted without failing the RD’s own tests.

**Options:**
- A) Add one acceptance criterion for the setup-routing/routing wording and one for README.
- B) Rely on the plan/preflight to catch it.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved — User accepted recommendation Option A: add one acceptance criterion for the setup-routing/routing wording and one for README.

---

### PF-017: The provider-normalization pipeline is a material support surface without a Complexity Escalation Gate [🟠 MAJOR]

**Dimension:** 6 (Feasibility), 10 (Scope Creep)

**Location:** `requirements/README.md` “Approved complexity: None”; `requirements/RD-03-independence-and-effort.md` FR-7, normalization algorithm, capability line; `requirements/00-ambiguity-register.md` AR-23/AR-25; `_shared/zero-ambiguity-gate.md:39-48,57-80`.

**Codebase Evidence:** The current `selectEffortVariant` already selects the exact or nearest variant with a higher tie-break (`bin/lib/reasoning-effort.mjs:339-372`), and `EFFORT_RANK` already includes `xhigh` (`:312-320`). RD-03 adds a four-stage resolver (exact → alias → settings → ordinal → fail-open), alias fixtures, a distance guard, and a capability line. The register has no `Technical (complexity escalation)` row with a challenger verdict and visible stop packet.

**The Problem:** The README claims no complexity escalation was triggered, but the provider pipeline is a generalized support layer beyond the smallest design. The existing nearest-level logic already covers the documented provider sets; the alias/settings/ordinal stages have no verified v1 data. A register acceptance is not the gate’s independent verdict.

**Options:**
- A) Simplify to the smallest viable design: keep the existing nearest logic, add `xhigh` to the vocabulary/marker/helper/docs, add a `max` guard, and keep a minimal capability/result disclosure. Add provider aliases only for a demonstrated mismatch.
- B) Run the Complexity Escalation Gate now with a blind `design-challenger` and the complete visible stop packet; keep the pipeline only if approved.
- C) Keep the pipeline and record it as `Technical (complexity escalation)` without the challenger and visible packet (insufficient under the gate).

**Recommendation:** Option A for the smallest design. If you want the full pipeline, choose B before planning; it then needs the independent verdict and explicit approval.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-018: The plan-stage coverage map is written to a gate-blocked artifact before Phase 1C [🔴 CRITICAL]

**Dimension:** 6 (Feasibility), 11 (Ordering)

**Location:** `requirements/RD-05-plan-stage.md` FR-8, flow, coverage-map placement; `skills/make-plan/SKILL.md:155-156`; `_shared/zero-ambiguity-gate.md:11,176`; `requirements/RD-01-coverage-hunt-protocol.md:117`.

**Codebase Evidence:** Make-plan’s hard rule: “Zero-Ambiguity Gate (Phase 1C) must pass before any plan document except its incrementally persisted `00-ambiguity-register.md` is written. No other exceptions.” `00-index.md` is a Phase 2 document (`skills/make-plan/templates.md:41`). RD-01’s packet also sources the goal/baseline from `00-index.md`, which does not exist at the pre-gate hunt.

**The Problem:** The plan-stage flow cannot write the map to `00-index.md` before Phase 1C without violating the gate. The auditor’s baseline source is also missing at that point. An implementer must break the gate or silently change the requirement.

**Options:**
- A) Persist the map in the plan’s `00-ambiguity-register.md` before 1C (allowed), then copy it to `00-index.md` after the gate passes in Phase 2. Source the baseline from the register/session.
- B) Amend the gate to exempt a `## Planning Coverage` section in `00-index.md` (weakens the gate; not recommended).
- C) Keep the map session-only until Phase 2 (loses the pre-gate audit trail).

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-019: “max is explicit-only” is not enforceable and existing defaults still select max [🟠 MAJOR]

**Dimension:** 6 (Feasibility)

**Location:** `requirements/RD-03-independence-and-effort.md` FR-3/FR-6, algorithm, AC 8; `_shared/reasoning-effort.md:104`; `scripts/install_agents.py:592`; `skills/setup-routing/routing.md:30`; `bin/lib/reasoning-effort.mjs:339-371`.

**Codebase Evidence:** The resolver has no provider or “explicit” guard. A model exposing `{low, high, max}` maps `xhigh → max`. The plan derivation maps complexity-escalation phases to `max` (`_shared/reasoning-effort.md:104`), and generated specialists default to `reasoningEffort: max` (`install_agents.py:592`). AC 8 only tests a full-variant fixture.

**The Problem:** A test can pass while real runs select `max` without an explicit request. The “Default `max` on OpenAI/Anthropic = 0” metric will not hold on partial sets or on the two existing default paths.

**Options:**
- A) Add a `max` guard: allow `max` only when the requested level is `max`, or when a provider-specific `xhigh → max` allowance (DeepSeek) is active; fail open otherwise. Change plan and specialist defaults to `xhigh`; regenerate agents.
- B) Make the provider table authoritative; fail open when the requested level is absent; never ordinal into `max`.
- C) Weaken the rule to “max is never recommended” and document the fallback.

**Recommendation:** A + B; add partial-set and specialist-default tests.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-020: `--auto-effort=xhigh` is rejected by the Python session helper [🟠 MAJOR]

**Dimension:** 6 (Feasibility), 7 (Testability)

**Location:** `requirements/RD-03-independence-and-effort.md` change table/AC 4; `scripts/codeops_effort.py:23,203-205`; `bin/lib/reasoning-effort.d.mts:9`.

**Codebase Evidence:** The helper’s `EFFORT_LEVELS` is four and its `set` command exits 2 for anything else. The `.d.mts` `EffortLevel` is four. RD-03’s change table omits both the helper and the declaration.

**The Problem:** The skill’s argument parsing may accept `xhigh`, but the helper rejects it, so the session level is never written. A Markdown content test can pass while the runtime fails in use.

**Options:**
- A) Add the helper and `.d.mts` to the change surface; update both level lists; add a spec test that `codeops_effort.py set --reasoning xhigh` exits 0; add a cross-language parity test.
- B) Keep content tests and add one integration test for the helper.
- C) Move the level allowlist to one shared source.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-021: The canonical dispatch header is defined three different ways [🟠 MAJOR]

**Dimension:** 6 (Feasibility), 12 (Consistency)

**Location:** `_shared/quality-profile.md:90-94`; `requirements/RD-01-coverage-hunt-protocol.md:114`; `requirements/RD-03-independence-and-effort.md:127,236`; `requirements/RD-02-coverage-auditor-mode.md:38-40`.

**Codebase Evidence:** Quality-profile defines `[codeops-dispatch agent=<name> feature=<slug> phase=<id>]`. RD-01 adds `unit`, `model`, and `independence` but not `effort`; RD-03 adds `effort` and a different independence vocabulary; RD-01’s metrics use `mixed|same-model`. RD-03’s change table does not list quality-profile.

**The Problem:** Implementers and content tests have three header contracts. A dispatch can satisfy one and fail another; the audit trail and metric status values can disagree.

**Options:**
- A) Add `_shared/quality-profile.md` to RD-03’s change surface; define one header with `unit`, `model`, `effort`, and `independence`; add an AC for the single header string.
- B) Keep the extended header local to the coverage hunt and state the exception.
- C) Move the extra fields into the packet body.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-022: The health-check lifecycle both reopens and does not reopen the gate [🟠 MAJOR]

**Dimension:** 9 (Edge Cases), 12 (Consistency)

**Location:** `requirements/RD-04-requirements-stage.md` FR-10, flow, AC 10; `skills/make-requirements/review-and-add.md:35-39`.

**Codebase Evidence:** FR-10 says the health check does not add open register rows unless the user asks to act. The flow says the hunt “never runs after the register is declared passing,” then says if the gate is already open and the user asks for a health check, it reports new open items and reopens the gate.

**The Problem:** The primary health-check case (a passed set) is both forbidden and required. An implementer cannot tell whether the result is advisory or gate-reopening; a passed gate could coexist with unresolved material candidates.

**Options:**
- A) Define health check as advisory: report + map, no open rows, no gate change unless the user asks to act; label it “advisory.”
- B) Define it as gate-reopening: add open rows and block until resolved or explicitly deferred; update FR-10 and AC 10.
- C) Ask the user at the start which behavior they want.

**Recommendation:** Option B if the feature is to catch gaps before the gate; otherwise A with an explicit advisory label. The current text cannot be implemented as written.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-023: The fixed 4×3 cluster contract and 4/4 summary break `--thorough` and incomplete runs [🟠 MAJOR]

**Dimension:** 9 (Edge Cases)

**Location:** `requirements/RD-01-coverage-hunt-protocol.md` summary line; `requirements/RD-04-requirements-stage.md:97`; `requirements/RD-05-plan-stage.md:91`.

**Codebase Evidence:** The summary line is `4/4 clusters · 12/12 categories`; `--thorough` runs 12 clusters; incomplete clusters are recorded in the map but have no summary field.

**The Problem:** A thorough run or a run with a failed cluster can print a false `4/4`, overstating coverage. There is no defined thorough-mode summary.

**Options:**
- A) Parameterize `<completed>/<total> clusters`; keep `12/12 categories`; add a `Notes`/`Limits` column and an incomplete-cluster field.
- B) Use separate default and thorough templates.
- C) Report only category coverage and drop the cluster count.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-024: Oversized packets have two conflicting remedies: split vs blocker [🟡 MINOR]

**Dimension:** 9 (Edge Cases)

**Location:** `requirements/RD-01-coverage-hunt-protocol.md` fallback; `requirements/RD-02-coverage-auditor-mode.md` FR-11, NFR.

**Codebase Evidence:** RD-01 says an oversized artifact is split by component/section within the same cluster. RD-02 requires the auditor to block on an oversized packet and says an oversized packet produces a blocker.

**The Problem:** The lead is told to split; the auditor is told to block. A split packet that no longer carries all three categories may also violate the packet contract. The cluster can deadlock or retry the same oversized packet.

**Options:**
- A) Define precedence: the lead splits before dispatch; the auditor blocks only if the delivered packet is still oversized or missing a required field; cap splits per cluster; record the split count.
- B) Remove the auditor’s oversized-packet blocker; let the lead own sizing.
- C) Cap splits per cluster without changing the blocker.

**Recommendation:** Option A + C.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-025: The capability line and dispatch header embed unsanitized model/variant names [🟡 MINOR]

**Dimension:** 8 (Security Blind Spots)

**Location:** `requirements/RD-03-independence-and-effort.md` capability line; `requirements/RD-01-coverage-hunt-protocol.md` packet header; `schemas/codeops-config.schema.json:40`; `bin/lib/reasoning-effort.mjs:427-445`.

**Codebase Evidence:** The routing schema accepts any non-empty string for `model`; `normalizeModelVariants` accepts any non-empty variant ID. The capability line and header embed these values without escaping, length caps, or control-character stripping.

**The Problem:** A custom provider/model or routing pin can contain a newline, a closing bracket, or instruction-like text. It can break the one-line header/packet format or inject instructions into the auditor.

**Options:**
- A) Escape/JSON-quote values; strip CR/LF/control characters; cap length; allowlist `[A-Za-z0-9._:/-]` for IDs.
- B) Render only known-safe model registry fields and drop unknown provider strings.
- C) Add a hostile-name test and a parser that rejects malformed header lines.

**Recommendation:** Option A + C; use one helper for prompt-bound identifiers in both the header and the capability line.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-026: RD-03’s “existing four-level behavior unchanged” contradicts its no-distant-jump rule [🟠 MAJOR]

**Dimension:** 7 (Testability), 12 (Consistency)

**Location:** `requirements/RD-03-independence-and-effort.md` FR-8/AC 10 and FR-19/AC 21; `bin/lib/reasoning-effort.mjs:339-371`; `bin/reasoning-effort.spec.test.mjs:157-164`.

**Codebase Evidence:** The current resolver always returns the nearest candidate. A model exposing only `max` maps `low → max`. RD-03 AC 10 says that case must leave the request unchanged; AC 21 says existing four-level behavior is unchanged and a regression test asserts the existing selection.

**The Problem:** Both criteria use the same four-level vocabulary but require different outcomes for the same fixture. A spec test written from AC 21 must fail AC 10 or be silently narrowed.

**Options:**
- A) Scope AC 21 to models that expose the requested or an adjacent level; add a fixture matrix and a documented breaking-change note for distant-jump models.
- B) Drop the no-distant-jump guard and keep the existing nearest behavior.
- C) Keep the guard and mark the behavior change as breaking with a migration note.

**Recommendation:** Option A; keep the guard and make the regression claim precise.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-027: RD-05 says the preflight report is unchanged, but RD-03 changes it [🟠 MAJOR]

**Dimension:** 7 (Testability), 12 (Consistency)

**Location:** `requirements/RD-05-plan-stage.md` FR-17/AC 14; `requirements/RD-03-independence-and-effort.md` FR-11/AC 15/AC 18; `skills/preflight/report-format.md:67-88`.

**Codebase Evidence:** RD-05 says preflight “behavior, dimensions, and report are unchanged.” RD-03 changes `skills/preflight/SKILL.md` and `report-format.md` to show independence and an effort map, and changes `--thorough` from `max` to `xhigh`.

**The Problem:** The requirement is false, and the RD-05 phrase test can pass while the report changes. A plan implementing RD-03 then RD-05 cannot satisfy both texts.

**Options:**
- A) Narrow RD-05 FR-17/AC 14 to “dimensions, fan-out, and the replacement boundary are unchanged; the effort/independence disclosure is the only report change,” and add a separate AC for the disclosure.
- B) Revert RD-03’s preflight changes.
- C) Split the test into unchanged-audit behavior and new-disclosure assertions.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-028: The coverage metrics contract is inconsistent and unsupported by the existing helper [🟠 MAJOR]

**Dimension:** 7 (Testability), 12 (Consistency)

**Location:** `requirements/RD-01-coverage-hunt-protocol.md` events/AC 11; `requirements/RD-04-requirements-stage.md` metrics/AC 13; `requirements/RD-05-plan-stage.md` metrics/AC 12.

**Codebase Evidence:** RD-01’s event table has five events, but its AC 11 still says “four.” RD-04/05 ACs say “five RD-01 events,” while their local tables list four (no `coverage_hunt.effort`). The map’s `Candidates` column is `<count or CV IDs>`; the cap-overflow reason and incomplete-cluster status have no column.

**The Problem:** A literal spec test derived from the ACs will fail or be vacuous, and the central artifact can overstate coverage. The effort event is required by the stage integrations but not recorded in their tables.

**Options:**
- A) Single-source the event list (five) and summary grammar in RD-01; add `coverage_hunt.effort` to RD-04/05; add a `Notes`/`Limits` column for cap overflow and incomplete clusters.
- B) Keep per-stage subsets and add a consistency test.
- C) Drop the summary line and rely on the table.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-029: RD-04/05 restate RD-01’s shared rules and have already drifted [🟡 MINOR]

**Dimension:** 10 (Scope Creep), 12 (Consistency)

**Location:** `requirements/RD-01-coverage-hunt-protocol.md:19-20`; `requirements/RD-04-requirements-stage.md` fallback/metrics/Discovery tables; `requirements/RD-05-plan-stage.md` fallback/metrics/Discovery tables.

**Codebase Evidence:** RD-01 says the integrations must not restate it, but RD-04/05 repeat materiality, cap, fallback, Discovery, and metrics rules. The duplication has already produced the event-count and fallback-row drift in PF-028.

**The Problem:** Three sources of truth drift. The requirements set is larger than the smallest design and the local tables look exhaustive while omitting rows.

**Options:**
- A) Keep five docs, but move every shared rule to RD-01; leave stage flow, flags, map placement, and stage-specific ACs in RD-04/05.
- B) Merge RD-04 and RD-05 into one integration RD.
- C) Keep the duplication and add a consistency test.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-030: README success metrics are not measurable or mapped to events [🟡 MINOR]

**Dimension:** 7 (Testability)

**Location:** `requirements/README.md` Success Metrics; `requirements/RD-01-coverage-hunt-protocol.md` events.

**Codebase Evidence:** Targets such as “Same or fewer than today” have no baseline or measurement procedure. The events do not record post-gate ambiguity rounds, preflight completeness findings, token cost, or default-max selections.

**The Problem:** The feature’s success cannot be evaluated as stated. A reader may believe the metrics prove the feature works when they do not.

**Options:**
- A) Define a baseline and an event/field for each metric, or mark the unmeasured metrics as manual/out of scope.
- B) Reduce the table to the metrics the events actually record.
- C) Keep the table as aspirational and remove the “Target” column.

**Recommendation:** Option B for the smallest honest change; Option A if success metrics are acceptance criteria.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-031: RD-04 assumes make-requirements already parses `--no-discovery` and explore-scope; it does not [🟠 MAJOR]

**Dimension:** 7 (Testability), 13 (Codebase Alignment)

**Location:** `requirements/RD-04-requirements-stage.md` flags/AC 11; `skills/make-requirements/SKILL.md:21-38`.

**Codebase Evidence:** `skills/make-requirements/SKILL.md` has no `--no-discovery` section. `make-plan` and `preflight` do parse it.

**The Problem:** AC 11 cannot pass without an unlisted change to make-requirements. A user who asks for chat-only may still get a published Discovery page.

**Options:**
- A) Add a `--no-discovery` option section to make-requirements as part of RD-04 and an AC for it.
- B) Remove `--no-discovery` from RD-04 and rely on `discovery.enabled`/tools.
- C) Reference the shared conditions without claiming the flag.

**Recommendation:** Option A if the flag is wanted; otherwise B.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

## Document-Soundness Cluster Merge

The document-soundness auditor returned 17 `PA` findings. They map as follows:

| PA | Merge target | Effect |
|----|--------------|--------|
| PA-001 | PF-023 | Upgraded to MAJOR: the fixed 4×3 cluster contract conflicts with the 12-cluster `--thorough` mode and the 4/4 summary. |
| PA-002 | PF-021 | Upgraded to MAJOR: two independence vocabularies and a missing `effort=` state. |
| PA-003 | PF-027 | Adds AR-2 and README to the preflight-scope contradiction. |
| PA-004 | PF-028 | Upgraded to MAJOR: the outcomes helper rejects the new events and `stage=plan`. |
| PA-005 | PF-032 | New MINOR: the non-material filter says “all are true,” leaving cosmetic candidates unclassifiable. |
| PA-006 | PF-022 | Upgraded to MAJOR: the health-check flow both forbids and requires a post-pass run. |
| PA-007 | PF-019 | Adds the specialist-default `max` evidence. |
| PA-008 | PF-033 | New MINOR: RD-04 hardcodes the flat `requirements/` path. |
| PA-009 | PF-014 | Upgraded to MAJOR: the disclosure forms omit the requested→applied effort they require. |
| PA-010 | PF-034 | New MAJOR: AR traceability cites unrelated entries and the inline fallback has no AR. |
| PA-011 | PF-035 | New MINOR: plan-suggestion application scope conflicts with existing execution markers. |
| PA-012 | PF-036 | New MINOR: the 12-candidate cap has no gate disposition for overflow. |
| PA-013 | PF-002 | Duplicate of the already-resolved phantom file finding. |
| PA-014 | PF-017 | If the pipeline is kept, the normalization pseudo-code must be corrected; Option A removes it. |
| PA-015 | PF-021 | Adds the undefined “no effort” header/disclosure state. |
| PA-016 | PF-019 | Adds the canonical-`max` vs provider-`max` wording distinction. |
| PA-017 | PF-037 | New OBSERVATION: the dependency graph omits RD-02 edges to RD-04/05. |

---

### PF-032: The non-material filter says “all are true,” leaving cosmetic candidates unclassifiable [🟡 MINOR]

**Dimension:** 3 (Logical Contradictions)

**Location:** `requirements/RD-01-coverage-hunt-protocol.md`, Materiality filter.

**Codebase Evidence:** The material list says “at least one is true”; the non-material list says “all are true.” A candidate that is merely cosmetic but is not also a naming preference, an optional enhancement, and a restatement satisfies neither list.

**The Problem:** Cosmetic-only candidates fall through the filter, can consume the 12-candidate cap, or are handled inconsistently.

**Options:**
- A) Change the rule to “Non-material — any is true” and add “a candidate that meets none of the material conditions is non-material.”
- B) Keep “all” and add a fifth fallback condition for cosmetic-only candidates.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-033: RD-04 hardcodes the flat requirements path [🟡 MINOR]

**Dimension:** 12 (Consistency), 13 (Codebase Alignment)

**Location:** `requirements/RD-04-requirements-stage.md` FR-8 and AC 8; `_shared/layout-convention.md`.

**Codebase Evidence:** The layout convention maps a nested requirements dir to `codeops/features/<f>/requirements/`. RD-04 writes to `requirements/00-ambiguity-register.md`.

**The Problem:** In a nested-layout repo, the map is written outside the feature’s requirements directory or to a nonexistent path.

**Options:**
- A) Use `<requirements dir>/00-ambiguity-register.md` and link the layout convention.
- B) Declare the feature flat-layout-only.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-034: AR traceability cites unrelated entries and the inline fallback has no AR [🟠 MAJOR]

**Dimension:** 3 (Logical Contradictions), 12 (Consistency)

**Location:** `requirements/RD-01-coverage-hunt-protocol.md` fallback scope decision; `requirements/README.md` failure-behavior row; `requirements/RD-02-coverage-auditor-mode.md` scope decisions; `requirements/RD-03-independence-and-effort.md` model-diversity row; `requirements/00-ambiguity-register.md` AR-16.

**Codebase Evidence:** RD-01 and README cite AR-13 for fallback, but AR-13 is backward compatibility. RD-02 cites AR-11 (budget) for numbering scope and AR-13 for hand edits. RD-03 cites AR-19 and AR-21 for model diversity, but AR-21 is no-variant compensation. AR-16 still labels RD-03 “Model Diversity,” while the document is “Independence and Effort Allocation.” The inline fallback has no AR entry.

**The Problem:** The traceability claim is false, and a material reliability/independence decision (inline fallback) has no authority record. A reader cannot tell which decision authorized the behavior.

**Options:**
- A) Add an explicit AR entry for the inline fallback (or amend AR-13’s note), correct the unrelated references, and update AR-16’s label.
- B) Remove the AR references from rows with no resolving entry and mark them as design consequences.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-035: Plan-suggestion application scope conflicts with existing execution markers [🟡 MINOR]

**Dimension:** 1 (Ambiguities), 3 (Contradictions)

**Location:** `requirements/RD-03-independence-and-effort.md` FR-14; `requirements/00-ambiguity-register.md` AR-20; `_shared/reasoning-effort.md:59-63`; `skills/exec-plan/execution-protocol.md:329`.

**Codebase Evidence:** `exec-plan` composes a dispatch marker from the phase’s `Reasoning:` suggestion even without `--auto-effort`. FR-14 says plan suggestions are applied only when `--auto-effort` is requested, while AR-20 says execution stays phase-level.

**The Problem:** An implementer may remove the existing default marker behavior or leave it and fail a content test.

**Options:**
- A) Distinguish “plan authoring” (opt-in via `--auto-effort`) from “execution phase markers” (existing phase-level behavior); keep `exec-plan` applying the phase suggestion to dispatched units.
- B) Require `--auto-effort` for all plan-suggestion application and change `exec-plan`.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-036: The 12-candidate cap has no gate disposition for overflow [🟡 MINOR]

**Dimension:** 1 (Ambiguities), 3 (Contradictions)

**Location:** `requirements/RD-01-coverage-hunt-protocol.md` materiality cap; `requirements/RD-04-requirements-stage.md` register routing; `requirements/RD-05-plan-stage.md` register routing.

**Codebase Evidence:** RD-01 says “Present at most 12 material candidates in one consolidated round. Record the rest as counts in the coverage map.” The register routing says `ambiguity`/`assumption` candidates become register rows.

**The Problem:** It is unclear whether material candidates beyond the cap become register rows (unpresented open rows) or remain counts (known material gaps outside the gate). The one-round cap and the gate’s “every row resolved” rule cannot both hold without a disposition.

**Options:**
- A) All material candidates enter the register; the 12 cap is a per-batch presentation limit, and the same consolidated round continues until all are presented.
- B) Overflow material candidates become named `⏸ Deferred` rows with owner and revisit, explicitly confirmed by the user.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-037: The dependency graph omits RD-02 edges to RD-04/05 [🔵 OBSERVATION]

**Dimension:** 12 (Consistency)

**Location:** `requirements/README.md` dependency graph.

**Codebase Evidence:** The graph shows RD-04 and RD-05 branching from RD-03 only. The text and Document Index table say both RD-02 and RD-03 are required before RD-04/05.

**The Problem:** A reader using the graph can start RD-04/05 without RD-02.

**Options:**
- A) Add RD-02 → RD-04/RD-05 edges or a note that RD-02 is also required.
- B) Remove the graph and rely on the table.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

## Delivery Cluster Merge

The delivery auditor returned 20 `PA` findings. Mapping:

| PA | Merge target | Effect |
|----|--------------|--------|
| PA-001 | PF-018 | Confirms the CRITICAL gate conflict; fix is Option A. |
| PA-002 | PF-031 | Upgraded to MAJOR: `--no-discovery` **and** explore-scope are absent from make-requirements. |
| PA-003 | PF-028 | Adds the outcomes-helper allowlist/CLI limitation. |
| PA-004 | PF-020 | Adds the helper/spec/type surface. |
| PA-005 | PF-019 | Adds the generated-specialist default `max` conflict. |
| PA-006 | PF-022 | Adds the “no open rows but gate reopens” contradiction. |
| PA-007 | PF-023 | Adds the incomplete-cluster `4/4` falsehood. |
| PA-008 | PF-038 | New MAJOR: add/upgrade-plan leave stale coverage maps. |
| PA-009 | PF-039 | New MAJOR: RD-04 updates `SKILL.md` but not the operational reference files. |
| PA-010 | PF-026 | Adds the changed four-level behavior on distant-jump models. |
| PA-011 | PF-035 | Adds per-cluster effort precedence and the undefined preflight “risk clusters.” |
| PA-012 | PF-021 | Adds the quality-profile header/packet omission. |
| PA-013 | PF-021 / PF-014 | Adds the independence/effort format conflict. |
| PA-014 | PF-002 | Duplicate of the resolved phantom file finding. |
| PA-015 | PF-040 | New MINOR: `make-plan` templates and quality checklist are not updated. |
| PA-016 | PF-041 | New MINOR: `--no-coverage-hunt` + `--thorough` is undefined. |
| PA-017 | PF-027 | Confirms the preflight-report contradiction. |
| PA-018 | PF-042 | New MINOR: the packet baseline field names only `00-index.md`; RD-04 lacks the goal. |
| PA-019 | PF-043 | New MINOR: CV/DQ/AR cross-references are undefined. |
| PA-020 | PF-029 | Adds the RD-04/RD-05 restatement drift. |

## Grounding Cluster Merge

The grounding auditor returned 17 `PA` findings. Mapping:

| PA | Merge target | Effect |
|----|--------------|--------|
| PA-001 | PF-018 | Confirms the CRITICAL gate conflict. |
| PA-002 | PF-004 / PF-019 | Adds the `max` selection risk on partial sets. |
| PA-003 | PF-019 | Confirms the specialist default `max`. |
| PA-004 | PF-020 | Confirms the helper rejection. |
| PA-005 | PF-028 | Confirms the outcomes-helper mismatch. |
| PA-006 | PF-021 | Confirms the quality-profile omission. |
| PA-007 | PF-002 / PF-003 | Duplicate of the resolved phantom/wrong-owner findings. |
| PA-008 | PF-021 | Confirms the independence vocabulary conflict. |
| PA-009 | PF-027 | Confirms the preflight-report contradiction. |
| PA-010 | PF-022 | Confirms the health-check ambiguity. |
| PA-011 | PF-044 | New MAJOR: the no-variants passthrough is not fail-open. |
| PA-012 | PF-023 / PF-014 | Confirms the summary/disclosure falsehood. |
| PA-013 | PF-045 | New MINOR: the auditor template emits `SE-*` where the coverage contract requires `CV-*`. |
| PA-014 | PF-042 | Confirms the baseline source problem. |
| PA-015 | PF-046 | New MINOR: FR-4 requires “affected area” but the candidate contract omits it. |
| PA-016 | PF-026 / PF-008 | Adds the `xhigh` compatibility change and type/test surface. |
| PA-017 | PF-035 / PF-027 | Adds the preflight `--thorough` cluster conflation. |

---

### PF-038: Add/upgrade-plan leave persisted coverage maps stale [🟠 MAJOR]

**Dimension:** 4 (Completeness), 5 (Dependencies)

**Location:** `requirements/RD-04-requirements-stage.md` add-mode boundary; `requirements/RD-05-plan-stage.md` upgrade-plan boundary; `requirements/RD-01-coverage-hunt-protocol.md` compatibility.

**Codebase Evidence:** Both boundaries keep the old mode unchanged, so the existing `## Coverage Map` / `## Planning Coverage` section remains. The map has no run date or artifact revision.

**The Problem:** After a new RD or an upgraded plan, the map still claims coverage for an artifact it never examined. Readers and gates can treat that as false assurance.

**Options:**
- A) Add a freshness line (`Coverage as of <date>, artifacts <list>`) and require add/upgrade-plan to mark the map stale when they change the artifact.
- B) Remove the map on any change and regenerate it on the next full run.
- C) Run a scoped hunt in add/upgrade (rejected by AR-17/AR-18).

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-039: RD-04 updates `SKILL.md` but not the operational reference files [🟠 MAJOR]

**Dimension:** 4 (Completeness)

**Location:** `requirements/RD-04-requirements-stage.md` AC 1/AC 10; `skills/make-requirements/discovery-phases.md`; `skills/make-requirements/review-and-add.md`.

**Codebase Evidence:** `discovery-phases.md` ends with “After Phase 2 is complete, proceed to the Zero-Ambiguity Gate.” `review-and-add.md` defines the health check with no hunt. `SKILL.md` directs the agent to both files.

**The Problem:** An agent reading the operational references skips the hunt or follows the old order. The health-check behavior has no listed file owner.

**Options:**
- A) Update `discovery-phases.md` and `review-and-add.md`, with content tests for both; keep `SKILL.md` as the index.
- B) Move the protocols into `SKILL.md` (duplicates them).
- C) Leave the references and accept the conflict.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-040: `make-plan` templates and quality checklist are not updated [🟡 MINOR]

**Dimension:** 4 (Completeness)

**Location:** `skills/make-plan/templates.md`; `skills/make-plan/quality-checklist.md`; `requirements/RD-05-plan-stage.md`.

**Codebase Evidence:** The `00-index.md` template has no `## Planning Coverage` section; the `Reasoning` template lists `low/medium/high/max`; the Phase 3 checklist has no coverage-map item.

**The Problem:** Plan authoring follows the templates; the map may be omitted and the Reasoning line may still say `max`.

**Options:**
- A) Update the `00-index.md` template, the Reasoning line, and the checklist, with content tests.
- B) Update only `SKILL.md` and rely on the agent to invent the section.
- C) Move the map to an existing template section (changes AR-10).

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-041: `--no-coverage-hunt` plus `--thorough` is undefined [🟡 MINOR]

**Dimension:** 4 (Completeness)

**Location:** `requirements/RD-04-requirements-stage.md` flags; `requirements/RD-05-plan-stage.md` flags.

**Codebase Evidence:** Each flag is parsed independently; duplicate handling covers only repeats of the same flag. The two announcements conflict.

**The Problem:** The implementation must guess whether to disable, expand, or error.

**Options:**
- A) Treat the combination as an argument error with a specific message; add content tests in both skills.
- B) Let the opt-out win and suppress the thorough announcement.
- C) Let thorough win and ignore the opt-out.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-042: The packet baseline field names only `00-index.md`; RD-04 lacks the original goal [🟡 MINOR]

**Dimension:** 5 (Dependencies), 13 (Codebase Alignment)

**Location:** `requirements/RD-01-coverage-hunt-protocol.md` packet baseline; `requirements/RD-04-requirements-stage.md` FR-3; `skills/make-requirements/templates.md`.

**Codebase Evidence:** The requirements baseline lives in `requirements/README.md` under `## Minimum-Sufficient Baseline`; `00-index.md` is plan-only. RD-04 FR-3 does not include the original goal.

**The Problem:** The requirements hunt can lack the original goal and smallest design that the absence framing depends on.

**Options:**
- A) Name the requirements `README.md`, the plan `00-index.md`, or the session baseline; add the original goal/smallest design to RD-04 FR-3.
- B) Use only the confirmed scope baseline (weaker framing).
- C) Always derive the baseline from the session.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-043: CV, DQ, and AR identifiers have no defined cross-reference [🟡 MINOR]

**Dimension:** 5 (Dependencies)

**Location:** `requirements/RD-01-coverage-hunt-protocol.md` candidate/map sections; `requirements/RD-04-requirements-stage.md` register routing; `requirements/RD-05-plan-stage.md` map placement.

**Codebase Evidence:** `CV-NNN` is local per cluster and renumbered run-wide; the filter dedupes multiple candidates into one AR row; Discovery answers use `DQ-<n>`; the register has no CV or DQ field.

**The Problem:** A reader cannot trace a map candidate to the Discovery answer or the AR/SE decision; the acceptance-rate metric and audit trail are incomplete.

**Options:**
- A) Require the register row (or a Source note) to list the merged CV IDs and the DQ key when published; add an AC.
- B) Add a CV column to the register (changes the template).
- C) Leave the map’s CV IDs unlinked.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-044: The no-variants passthrough is not fail-open [🟠 MAJOR]

**Dimension:** 6 (Feasibility), 8 (Security)

**Location:** `bin/lib/reasoning-effort.mjs:395-406`; `_shared/reasoning-effort.md:19-25`; `requirements/RD-03-independence-and-effort.md` FR-9.

**Codebase Evidence:** `applyEffort` returns `{ ...options, reasoningEffort: level }` when there is no variants record but the model advertises reasoning. The shared contract says an unavailable variant leaves the request unchanged and never raises a provider error. RD-03 FR-9 says keep the request unchanged.

**The Problem:** `none`, `minimal`, or `xhigh` can be sent as raw `reasoningEffort` values to providers that do not accept them, violating the exact-match, fail-open, and no-provider-error rules.

**Options:**
- A) Remove the passthrough; return the original options and disclose; update the test.
- B) Keep the passthrough only for verified provider keys and never for `none`/`xhigh`.
- C) Make the passthrough an explicit opt-in.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-045: The auditor template’s scope rule emits `SE-*` where the coverage contract requires `CV-*` [🟡 MINOR]

**Dimension:** 13 (Codebase Alignment)

**Location:** `agent-templates/preflight-auditor.md` scope rule; `requirements/RD-02-coverage-auditor-mode.md`; `requirements/RD-01-coverage-hunt-protocol.md` result contract.

**Codebase Evidence:** The template says an optional addition in explore mode is returned “separately as an `SE-*` candidate rather than a `PA-*` finding.” RD-01/RD-02 require `CV-NNN` with `Classification: optional`.

**The Problem:** A coverage auditor following the shared rule emits `SE-*`, which the result contract does not accept; optional candidates may be omitted.

**Options:**
- A) Make the rule mode-aware: in coverage mode, optional stays `CV-NNN` with `Classification: optional`.
- B) Update the result contract to accept `SE-*`.
- C) Remove optional candidates from coverage mode.

**Recommendation:** Option A.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.

---

### PF-046: FR-4 requires an “affected area” candidate field that the result contract omits [🟡 MINOR]

**Dimension:** 2 (Implicit Assumptions), 7 (Testability)

**Location:** `requirements/RD-01-coverage-hunt-protocol.md` FR-4 vs candidate contract/AC 5; `requirements/RD-02-coverage-auditor-mode.md` FR-5.

**Codebase Evidence:** FR-4 lists “affected area” in the candidate fields; the candidate contract and acceptance criteria list seven fields without it.

**The Problem:** The required field is undefined and untested. The map’s `Area` column is not a candidate field.

**Options:**
- A) Remove “affected area” from FR-4 and rely on “Why material” plus the map’s `Area`.
- B) Add `Affected area` to the candidate contract and tests.
- C) Define it as the map’s `Area` and cross-reference.

**Recommendation:** Option A for the smallest design; B if per-candidate area attribution is required.

**User Decision:** ✅ Resolved by consolidated ruling — see “Consolidated Ruling”.
