# RD-04: Requirements-Stage Integration

> **Document**: RD-04-requirements-stage.md
> **Status**: Review
> **Created**: 2026-11-23
> **Project**: opencode-codeops
> **Depends On**: RD-01, RD-02, RD-03
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

This document wires the Coverage Hunt into `make-requirements`. The hunt runs after discovery and
structuring, and before the Phase 2B Zero-Ambiguity Gate. Its material candidates feed the
Ambiguity Register, and its coverage map is persisted in that register so the user can see what was
examined, what was not, and where confidence is low.

The same capability runs in `review_requirements` health-check mode, which is the natural
“what is missing?” request. It produces a diagnostic report with candidates and a coverage map; it
does not modify RDs unless the user then asks to act on a finding.

`add_requirement` stays unchanged in this version. Adding one RD is a scoped change to an existing
set; the full four-cluster hunt is disproportionate, and the existing Zero-Ambiguity Gate still
applies. This boundary is deliberate and can be revisited when evidence shows a recurring gap in
add mode.

---

## Functional Requirements

### Must Have

- [ ] **FR-1 — Default activation.** Full Discovery runs the coverage hunt by default. Health-check
      mode runs it by default. Mini-plans and trivial tasks are not requirements work and are
      unaffected.
- [ ] **FR-2 — Placement.** In Full Discovery, the hunt runs after Phase 2 structuring (glossary,
      decomposition, dependency graph, phasing, integration map) and before Phase 2B. The skill
      states this order.
- [ ] **FR-3 — Inputs.** The hunt receives the original goal and smallest viable design from the
      requirements `README.md` `## Minimum-Sufficient Baseline` or the session baseline, the
      confirmed scope baseline, the selected domain lenses, the discovery notes, the proposed RD
      structure, relevant repository facts, and the scope mode (`strict` or `explore`). Missing
      scope or original-goal context fails closed to `strict`.
- [ ] **FR-4 — Recon allowance.** Up to three `explorer` scouts gather current-system facts with
      `file:line` evidence when repository constraints matter. Recon is factual only; it does not
      propose gaps.
- [ ] **FR-5 — Clusters.** The lead dispatches the four default RD-01 clusters (or 12 thorough
      single-category clusters) in parallel when the host supports it, or sequentially with
      identical packets otherwise.
- [ ] **FR-6 — Merge and filter.** The lead merges the cluster results, dedupes by root cause,
      resolves what evidence already answers, applies the RD-01 materiality filter, presents at
      most 12 material candidates per batch, and continues until every material candidate is
      presented.
- [ ] **FR-7 — Register routing.** `ambiguity` and `assumption` candidates become new Ambiguity
      Register rows. `optional` candidates go to the Scope Expansion Register in explore mode and
      are omitted in strict mode. `complexity` candidates go to the Complexity Escalation Gate and
      are never auto-approved.
- [ ] **FR-8 — Coverage map.** The consolidated map is persisted in
      `<requirements dir>/00-ambiguity-register.md` under `## Coverage Map`, with the RD-01 columns,
      summary line, freshness line, and source note.
- [ ] **FR-9 — Gate unchanged.** The Phase 2B Zero-Ambiguity Gate still requires every row resolved
      or explicitly deferred, user confirmation of the complete register, and no silent deferral.
      The hunt improves the input; it does not change the gate's authority.
- [ ] **FR-10 — Health-check mode.** `review_requirements` runs the hunt as part of the diagnostic
      report, presents candidates and the coverage map, and writes the consolidated `## Coverage
      Map` section to the register. It is diagnostic: it does not add open register rows or reopen
      the gate unless the user explicitly asks to act on a finding. When the user asks to act, the
      material candidates become open rows and the gate reopens until resolved or explicitly
      deferred.
- [ ] **FR-11 — `--no-coverage-hunt`.** A single exact standalone token before the first `--`
      sentinel disables the hunt for the run and announces
      `Coverage hunt disabled for this run`. Zero occurrences mean default behavior; more than one
      is an argument error; tokens after the sentinel are target content.
- [ ] **FR-12 — `--thorough`.** A single exact standalone token before the first `--` sentinel
      expands the run to one cluster per category (12 clusters) and announces
      `Coverage hunt thorough — 12 clusters`. Zero occurrences mean four clusters; more than one is
      an argument error.
- [ ] **FR-13 — Discovery and scope integration.** The consolidated round uses the existing
      Discovery surface when `_shared/discovery.md` conditions hold; otherwise it stays in chat.
      `make-requirements` parses `--no-discovery` and `--explore-scope`, and
      `_shared/scope-expansion-control.md` lists it as a supported workflow. It creates no new page,
      endpoint, or question key scheme.
- [ ] **FR-14 — Fallback.** The RD-01 fallback rules apply. Inline clusters are marked
      `inline fallback`; a failed cluster is retried or run inline; no category is skipped. No
      usable effort variant leaves the request unchanged and records `effort unavailable`.
- [ ] **FR-15 — Metrics.** The five RD-01 events are recorded with `stage=requirements` when
      metrics are enabled: completed, accepted, fallback, independence, and effort. The outcomes
      helper is extended with the event names and content-free fields before use.
- [ ] **FR-16 — Compatibility.** Existing requirements sets and registers without a coverage map
      remain valid. The map is added on the next full-discovery or health-check run. Every map
      carries a freshness line; `add_requirement` marks an existing map stale when it changes the
      set. No schema stamp, migration, or new artifact is introduced.
- [ ] **FR-17 — Add mode unchanged.** `add_requirement` does not run the hunt in this version; it
      keeps its existing condensed discovery and gate.
- [ ] **FR-18 — Effort allocation.** The requirements hunt applies the RD-03 task-class policy per
      cluster: recon `low`/`medium`, C1–C3 `high`, C4 `xhigh`, synthesis `high`; `--thorough` uses
      `xhigh` for risk clusters. `max` is explicit-only. Announce the map before dispatch and
      disclose the applied mapping in the coverage map and final summary.

### Should Have

- [ ] **FR-19 — Announcement.** On a default run, announce
      `Coverage hunt active — 4 clusters, <N> agents` before dispatch (or `12 clusters` in thorough
      mode). On an inline fallback, announce the fallback in the final summary.
- [ ] **FR-20 — Coverage summary in the final output.** The final requirements summary includes one
      line: `Coverage: <completed>/<total> clusters · <examined>/12 categories · <N> candidates · <M> limits · Effort: <requested→applied> · Independence: <mixed-model|mixed-effort|uniform-effort>`.
- [ ] **FR-21 — Re-scan rule.** If the user's answers materially change the scope or invalidate a
      cluster's coverage, re-run only the affected clusters; never a full second hunt.

### Won't Have (Out of Scope)

- Running the hunt in `add_requirement` mode.
- A new Discovery page, endpoint, or question-key scheme.
- A new coverage artifact or schema stamp.
- Automatic acceptance of a candidate or a complexity escalation.
- Replacing the Zero-Ambiguity Gate, the specialist check, or preflight.
- Parallel code writing or orchestration runtime.
- A guarantee of requirements completeness.

---

## Technical Requirements

### Flow

```text
Full Discovery:
  Phase 1 discovery → Phase 2 structuring → Coverage Hunt
  (recon low/medium; C1–C3 high; C4 xhigh; synthesis high)
  → consolidate candidates → one user round → write register + coverage map
  → Phase 2B Zero-Ambiguity Gate → author RDs

Health Check (diagnostic):
  read requirements → Coverage Hunt → merge candidates
  → diagnostic report + coverage map
  → if the user asks to act: add open rows, reopen the gate, offer fixes
```

The hunt never runs before the scope baseline exists, and never in the same creation run after
Phase 2B passes. A health check on an already-passed set is diagnostic: it writes the map but does
not add open rows or reopen the gate unless the user asks to act on a finding. When the user asks to
act, the material candidates become open register rows and the gate reopens until they are resolved
or explicitly deferred.

### Flags

| Flag | Position | Effect | Duplicate handling |
|------|----------|--------|--------------------|
| `--no-coverage-hunt` | Before the first `--` sentinel | Disable the hunt for the run | More than one is an argument error |
| `--thorough` | Before the first `--` sentinel | 12 single-category clusters | More than one is an argument error |
| `--no-discovery` | Before the first `--` sentinel | Keep every question in chat | More than one is an argument error |
| `--explore-scope` | Before the first `--` sentinel | Enable the Scope Expansion Register | More than one is an argument error |

`--no-coverage-hunt` with `--thorough` is an argument error. All four flags compose with the
existing `--auto-design` and `--auto-effort` parsing rules. `make-requirements` must parse
`--no-discovery` and `--explore-scope` itself, and `_shared/scope-expansion-control.md` must list
`make-requirements` as a supported workflow. They never grant authority, expand scope, or change
the gate.

### Coverage map placement

```markdown
## Coverage Map

> **Coverage**: <completed>/<total> clusters · <examined>/12 categories · <N> candidates · <M> residual limits · Effort: <requested→applied> · Independence: <mixed-model|mixed-effort|uniform-effort>
> **Freshness**: Coverage as of <date>; artifacts <list>

| Cluster | Area | Examined | Not examined / limit | Candidates | Notes / limit | Confidence |
|---------|------|----------|----------------------|------------|---------------|------------|
| ... | ... | ... | ... | ... | ... | ... |

**Source note:** merged `CV-*` IDs and `DQ-*` keys per register row, or “none.”
```

The section goes in `<requirements dir>/00-ambiguity-register.md` after the register table and
before the resolution notes. The map is persisted even when a cluster finds no material gap. It
contains no prompts, decisions, secrets, or unrelated user content. `add_requirement` marks an
existing map stale when it changes the set.

### Health-check report

The diagnostic report adds a `### Coverage` section:

```markdown
### Coverage

> **Coverage**: <completed>/<total> clusters · <examined>/12 categories · <N> candidates · <M> limits · Effort: <requested→applied> · Independence: <mixed-model|mixed-effort|uniform-effort>
> **Freshness**: Coverage as of <date>; artifacts <list>

| Cluster | Area | Examined | Not examined / limit | Candidates | Notes / limit | Confidence |
|---------|------|----------|----------------------|------------|---------------|------------|
| ... | ... | ... | ... | ... | ... | ... |

**Material candidates:** CV-001 … CV-00N (short titles)
**Source note:** merged `CV-*` IDs and `DQ-*` keys
**Optional candidates:** `CV-*` with `Classification: optional`; routed to the Scope Expansion Register in explore mode and omitted in strict mode
**Complexity candidates:** routed to the Complexity Escalation Gate
```

After presenting the report, write the consolidated map to the register's `## Coverage Map`
section. The health check is diagnostic: it does not add open register rows or reopen the gate
unless the user asks to act on a finding. When the user asks to act, add the material candidates as
open rows and reopen the gate; the normal gate and authoring rules then apply. The health check
never rewrites RDs without a fix instruction.

### Materiality and user round

- Maximum 12 material candidates per run.
- One consolidated round; no per-cluster user interaction.
- Resolve from evidence first; only unresolved material items reach the user.
- Optional items follow `_shared/scope-expansion-control.md`.
- Complexity items follow `_shared/zero-ambiguity-gate.md` and require the independent challenger
  and the visible stop packet.
- Prior decisions are not reopened without new evidence; cite the AR.

### Discovery integration

Use the existing `_shared/discovery.md` rules exactly:

- `discovery.enabled: true`, the three Discovery tools available, and no `--no-discovery`.
- A round at or below `chatMaxQuestions` stays in chat; a larger round is published.
- One plan per artifact: `kind=requirements`, `artifact=<requirements dir>`.
- Every question carries `why`, `evidence`, options with trade-offs, and a recommendation.
- Stable keys: `DQ-<n>` for discovery questions; `CV-NNN` remains the candidate identifier.
- Complexity escalations stay in chat; never publish the STOP packet.
- After publishing, send one chat line and end the turn; do not poll.

### Fallback

Canonical source: the RD-01 fallback table. The table below is a stage summary; on conflict, RD-01
wins.

| Condition | Behavior |
|-----------|----------|
| Subagents unavailable | Run clusters inline; mark `inline fallback` in the map |
| Cluster failure | Retry once or inline; record the cluster as incomplete if neither succeeds |
| Model unavailable | Inherit; record the model axis and the effort status |
| No usable effort variants/provider mapping | Keep the request unchanged; record `effort unavailable`; compensate structurally; never block |
| Missing scope context | Fail closed to strict; block the hunt until the baseline exists |
| Only one model/provider | Record the model axis and the effort status; continue |
| Discovery unavailable | Ask in chat; never mention a page the user cannot use |

### Metrics

Canonical source: the RD-01 event table and the RD-03 effort policy. The table below adds the
stage value and must not redefine the events.

| Event | Fields |
|-------|--------|
| `coverage_hunt.completed` | stage=`requirements`, clusters, candidates, limits |
| `coverage_hunt.accepted` | stage=`requirements`, material, accepted, optional, complexity |
| `coverage_hunt.fallback` | stage=`requirements`, reason |
| `coverage_hunt.independence` | status (`mixed-model`, `mixed-effort`, `uniform-effort`), provider boundary |
| `coverage_hunt.effort` | requested level, applied variant, mapping source, fallback reason |

No content. The existing `scripts/codeops_outcomes.py` must be extended with these five event names
and a fixed content-free payload before the events can be emitted. Metrics never change a gate
result.

### Compatibility

- Existing `requirements/` sets and registers remain valid.
- A legacy register without `## Coverage Map` gets one on the next full-discovery or health-check
  run.
- Every map carries a freshness line. `add_requirement` marks an existing map stale when it
  changes the set.
- `add_requirement` behavior is unchanged.
- No new schema stamp or artifact.
- The skill remains host-agnostic; inline fallback is the portability path.

---

## Integration Points

### With RD-01 (Coverage Hunt Protocol)

RD-04 consumes the cluster partition, packet, result contract, materiality filter, coverage map,
budget, and fallback. It does not restate them.

### With RD-02 (Coverage Auditor Mode)

RD-04 dispatches the `preflight-auditor` coverage mode through the RD-01 packet.

### With RD-03 (Independence and Effort Allocation)

RD-04 uses the RD-03 canonical levels, task-class policy, provider mapping, header, capability
line, and disclosure text in the coverage map and final summary.

### With the Zero-Ambiguity Gate

Candidates feed the register; the gate still owns resolution and user confirmation. The hunt does
not open the gate and cannot close it.

### With Preflight

Preflight remains the independent post-authoring audit. The hunt is not a replacement and does not
change preflight's dimensions or fan-out.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|--------------------|--------|-----------|--------|
| Default state | On, opt-in, always on | On for full discovery and health check | Full requirements justify the cost; mini-plans do not | AR-1 |
| Placement | Before gate vs after RDs | Before gate | Absence is cheapest to fix before RDs crystallize | AR-2 |
| Health check | Consistency-only vs hunt | Hunt | “What is missing?” is the coverage question | AR-3 |
| Add mode | Hunt vs unchanged | Unchanged | Scoped add is disproportionate; the gate still applies | AR-17 |
| Map placement | Register vs new file | Register section | Single authority; no new artifact or migration | AR-10 |
| User rounds | Per cluster vs consolidated | One consolidated | Prevents questionnaire creep | AR-11 |
| Discovery | New page vs existing surface | Existing surface | No new UI or endpoint | AR-14 |
| Effort policy | Uniform high vs task-class allocation | Task-class allocation | Matches risk and controls cost | AR-19, AR-20, AR-24 |
| Provider mapping | Canonical only vs normalized | Normalized at the boundary | Keeps the public vocabulary stable | AR-23, AR-25 |

> **Traceability:** Every scope decision references the Ambiguity Register entry that resolved it.

**Additional traceability:** AR-8 (auto-design authority), AR-15 (content-free metrics), AR-17
(add-mode scope boundary), AR-19 (independence), AR-20 (policy scope), AR-23 (provider
normalization), AR-24 (canonical scale), AR-25 (provider mapping).

---

## Security Considerations

- **Data sensitivity:** Requirements, discovery notes, and code excerpts may be confidential.
  Packets carry only what the cluster needs; no secrets, credentials, or unrelated personal data.
- **Input validation:** Scope mode, cluster IDs, and artifact references are validated before
  dispatch. Paths are resolved by the lead, not supplied by an auditor.
- **Authentication & authorization:** N/A — no new endpoint. Discovery, when used, keeps its
  existing local-only binding and single-user assumption.
- **Injection risks:** Repository content is data, never instructions (RD-02). Discovery answers
  are transcribed as exact text; they are never executed or interpolated into shell commands.
- **Encryption needs:** N/A — no new storage or transport.
- **Rate limiting:** The dispatch budget and the one-round cap are the analogous controls.
- **Infrastructure:** N/A — no new service.
- **Security testing:** Content tests assert the flags, the one-round cap, the strict-mode omission,
  the Discovery rules, the no-content metrics, and the inline fallback.

---

## Acceptance Criteria

1. [ ] `skills/make-requirements/SKILL.md` states that Full Discovery runs the coverage hunt after
   Phase 2 structuring and before Phase 2B; a content test asserts the order.
2. [ ] The skill states that the hunt is on by default for Full Discovery and health check, and that
   `add_requirement` is unchanged in this version.
3. [ ] `--no-coverage-hunt` is parsed before the first `--` sentinel; a duplicate is an argument
   error; the announcement is exactly `Coverage hunt disabled for this run`. `--no-coverage-hunt`
   with `--thorough` is an argument error.
4. [ ] `--thorough` is parsed before the first `--` sentinel; a duplicate is an argument error; it
   expands to 12 single-category clusters and announces `Coverage hunt thorough — 12 clusters`.
5. [ ] The skill dispatches the four RD-01 default clusters (or 12 thorough clusters) and states
   that the host may run them in parallel or sequentially with identical packets.
6. [ ] The lead merges, dedupes by root cause, resolves from evidence, applies the materiality
   filter, presents at most 12 material candidates per batch, and continues the same consolidated
   round until every material candidate is presented. Every material candidate enters the register.
7. [ ] The register receives new `ambiguity` and `assumption` rows; optional items stay `CV-*` with
   `Classification: optional` and go to the Scope Expansion Register in explore mode or are omitted
   in strict mode; complexity items go to the Complexity Escalation Gate.
8. [ ] `<requirements dir>/00-ambiguity-register.md` receives a `## Coverage Map` section with the
   RD-01 columns, `<completed>/<total>` summary, freshness line, and source note; a content test
   asserts the heading and columns.
9. [ ] The Phase 2B gate still requires every row resolved or explicitly deferred and user
   confirmation of the complete register; the hunt does not bypass it.
10. [ ] `review_requirements` is diagnostic: it runs the hunt, includes a `### Coverage` section in
    the report, writes the map to the register, and does not add open rows or reopen the gate unless
    the user asks to act. When the user asks to act, open rows are added and the gate reopens.
11. [ ] `make-requirements` parses `--no-discovery` and `--explore-scope` before the first `--`
    sentinel; `_shared/scope-expansion-control.md` lists it as a supported workflow; Discovery uses
    `discovery.enabled`, the three Discovery tools, and no new page/endpoint/key scheme.
12. [ ] Inline fallback is recorded in the map; no cluster is skipped; a failed cluster is retried,
    run inline, or recorded as incomplete. No usable effort variant leaves the request unchanged
    and records `effort unavailable`.
13. [ ] Content-free metrics use the five RD-01 events with `stage=requirements`; the outcomes
    helper is extended with the event names and fields; no prompt, decision, path, or artifact
    content is recorded.
14. [ ] Existing requirements sets and registers without a coverage map remain valid; every map
    carries a freshness line; `add_requirement` marks an existing map stale; no schema stamp or
    migration is introduced.
15. [ ] The effort map is announced before dispatch and disclosed in the coverage map and final
    summary; a content test asserts the per-cluster levels and the `requested → applied` form.
16. [ ] `discovery-phases.md` and `review-and-add.md` are updated with the hunt placement and the
    health-check behavior; a content test asserts both reference files.
17. [ ] RD-04 FR-3 names the requirements `README.md` baseline and the original goal, and the
    register/source note links merged `CV-*` IDs and `DQ-*` keys.
18. [ ] Security requirements verified: prompt-injection rule referenced, Discovery stays local,
    no secrets in packets, path canonicalization, no shell interpolation of user text.
19. [ ] All content tests run under the project's `npm run verify` and pass.

---

## Non-Functional Requirements

| Attribute | Requirement |
|-----------|-------------|
| **Latency** | Four default or 12 thorough clusters, plus at most three scouts; one consolidated round. |
| **Reliability** | Inline fallback; no category skipped; incomplete clusters are recorded. |
| **Maintainability** | One protocol; the skill links to RD-01 and does not restate the cluster table. |
| **Portability** | Works without subagents or Discovery via inline and chat fallback. |
| **Observability** | Coverage map, final summary line, and content-free metrics. |
| **Compatibility** | Additive; existing sets remain valid; add mode unchanged. |

**Complexity estimate:** L
