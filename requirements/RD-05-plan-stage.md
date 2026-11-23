# RD-05: Plan-Stage Integration

> **Document**: RD-05-plan-stage.md
> **Status**: Review
> **Created**: 2026-11-23
> **Project**: opencode-codeops
> **Depends On**: RD-01, RD-02, RD-03
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

This document wires the Coverage Hunt into `make-plan`. After the current-state analysis and the
scope confirmation, and before the Phase 1C Zero-Ambiguity Gate, the lead runs the four coverage
clusters against the plan's context: the selected RD, the scope baseline, the current-state facts,
and the repository. The hunt asks what the plan does not yet account for — missing behavior,
unstated assumptions, integration and data gaps, and test-strategy gaps.

Material candidates feed the plan's `00-ambiguity-register.md`. The coverage map is persisted in
`00-index.md` under `## Planning Coverage`, so the user can see what was examined, what was not, and
where confidence is low before the gate opens.

The plan stage is the second safety net, not a duplicate of the requirements stage. The requirements
hunt asks what the product should do; the plan hunt asks whether this plan can deliver it against
the real code, with the real interfaces, data, and tests.

---

## Functional Requirements

### Must Have

- [ ] **FR-1 — Default activation.** Full feature plans run the coverage hunt by default.
      Mini-plans and trivial tasks do not; their existing lightweight path is unchanged.
- [ ] **FR-2 — Placement.** The hunt runs after Phase 1.2 current-state analysis and Phase 1.3
      scope confirmation, and before Phase 1C. The skill states this order.
- [ ] **FR-3 — Inputs.** The hunt receives the original goal, the smallest viable design, the
      confirmed scope baseline and mode, the selected RD and its excerpts, the current-state facts,
      the proposed phases/tasks, and the repository areas the plan touches. Missing scope or
      original-goal context fails closed to `strict` and blocks the hunt.
- [ ] **FR-4 — Recon.** Use Phase 1.2 facts first. Add up to three `explorer` scouts only for gaps
      that matter to the plan: affected components, existing patterns, data contracts, and test
      infrastructure. Recon returns facts with `file:line`; it does not propose gaps.
- [ ] **FR-5 — Clusters.** Dispatch the four default RD-01 clusters (or 12 thorough
      single-category clusters) in parallel when the host supports it, or sequentially with
      identical packets otherwise.
- [ ] **FR-6 — Merge and filter.** The lead merges, dedupes by root cause, resolves from evidence,
      applies the RD-01 materiality filter, presents at most 12 material candidates per batch, and
      continues until every material candidate is presented.
- [ ] **FR-7 — Register routing.** `ambiguity` and `assumption` candidates become new
      `00-ambiguity-register.md` rows. `optional` candidates go to the Scope Expansion Register in
      explore mode and are omitted in strict mode. `complexity` candidates go to the Complexity
      Escalation Gate and are never auto-approved.
- [ ] **FR-8 — Coverage map.** Persist the consolidated map in the plan’s
      `00-ambiguity-register.md` under `## Coverage Map` before Phase 1C, with the RD-01 columns,
      summary, freshness line, and source note. After Phase 1C passes, copy the section into
      `00-index.md` under `## Planning Coverage`.
- [ ] **FR-9 — Gate unchanged.** Phase 1C still requires every row resolved or explicitly deferred,
      user confirmation of the complete register, and no silent deferral. The hunt improves the
      input; it does not change the gate.
- [ ] **FR-10 — `--no-coverage-hunt`.** A single exact standalone token before the first `--`
      sentinel disables the hunt and announces `Coverage hunt disabled for this run`. Zero
      occurrences mean default behavior; more than one is an argument error.
- [ ] **FR-11 — `--thorough`.** A single exact standalone token before the first `--` sentinel
      expands to 12 clusters and announces `Coverage hunt thorough — 12 clusters`. More than one is
      an argument error.
- [ ] **FR-12 — Discovery integration.** When the consolidated round exceeds
      `chatMaxQuestions` and Discovery is enabled, publish it through the existing
      `_shared/discovery.md` surface with `kind=plan` and `artifact=<plan dir>`. Otherwise stay in
      chat. No new page, endpoint, or key scheme.
- [ ] **FR-13 — Fallback.** RD-01 fallback applies. Inline clusters are marked
      `inline fallback`; failed clusters are retried or run inline; no category is skipped.
- [ ] **FR-14 — Metrics.** The five RD-01 events are recorded with `stage=planning` when metrics
      are enabled: completed, accepted, fallback, independence, and effort. The outcomes helper is
      extended with the event names and content-free fields before use.
- [ ] **FR-15 — Compatibility.** Existing plans without a coverage map remain valid. The map is
      added on the next full-plan run. Every map carries a freshness line; `upgrade-plan` marks an
      existing map stale when it changes the plan. No schema stamp, migration, or new artifact.
- [ ] **FR-16 — Mini-plan boundary.** Mini-plans and trivial tasks skip the hunt. A complexity
      escalation still uses the existing gate and the full-plan path.
- [ ] **FR-17 — Preflight scope.** Preflight remains the independent post-authoring audit. The hunt
      does not replace it or change its dimensions or fan-out. RD-03’s effort/independence
      disclosure and `--thorough` recommendation are the only preflight changes.
- [ ] **FR-18 — Effort allocation.** The plan hunt applies the RD-03 task-class policy per cluster:
      recon `low`/`medium`, C1–C3 `high`, C4 `xhigh`, synthesis `high`; `--thorough` uses `xhigh`
      for the three risk categories and `high` for the rest. Canonical `max` is explicit-only. Plan
      `Reasoning:` suggestions use `xhigh` for adversarial/high-risk phases and never default to
      `max`; `exec-plan` continues to apply the phase suggestion to dispatched units. Announce the
      map and disclose `requested → applied` in the coverage map and final summary.

### Should Have

- [ ] **FR-19 — Announcement.** On a default run, announce
      `Coverage hunt active — 4 clusters, <N> agents` before dispatch. On an inline fallback,
      announce the fallback in the final summary.
- [ ] **FR-20 — Final summary.** The plan summary includes
      `Coverage: <completed>/<total> clusters · <examined>/12 categories · <N> candidates · <M> limits · Effort: <requested→applied> · Independence: <mixed-model|mixed-effort|uniform-effort>`.
- [ ] **FR-21 — Re-scan rule.** If the user's answers materially change the plan's scope or
      invalidate a cluster, re-run only the affected clusters; never a full second hunt.
- [ ] **FR-22 — Specialist check interaction.** The specialist-gap check still runs after lens
      selection and phase decomposition; the coverage hunt does not replace it.

### Won't Have (Out of Scope)

- Running the hunt for mini-plans, trivial tasks, or `upgrade-plan` in this version.
- A new coverage artifact or schema stamp.
- Automatic acceptance of a candidate or a complexity escalation.
- Replacing Phase 1C, the specialist check, or preflight.
- Parallel code writing, worktrees, or an orchestration runtime.
- A guarantee that the plan is complete.

---

## Technical Requirements

### Flow

```text
make-plan:
  Phase 1.1 questions
  → Phase 1.2 current-state analysis (facts)
  → Phase 1.3 scope confirmation (baseline)
  → Coverage Hunt (recon low/medium; C1–C3 high; C4 xhigh; synthesis high)
  → consolidate → one user round → write register + map in the plan register
  → Phase 1B re-evaluation
  → Phase 1C Zero-Ambiguity Gate
  → Phase 2 authoring: copy the map into 00-index.md
  → preflight (independent)
```

The hunt never runs before the scope baseline exists, and never after Phase 1C is declared passed.
`00-index.md` is written only after Phase 1C; the register is the only pre-gate artifact.

### Flags

| Flag | Position | Effect | Duplicate handling |
|------|----------|--------|--------------------|
| `--no-coverage-hunt` | Before the first `--` sentinel | Disable the hunt | More than one is an argument error |
| `--thorough` | Before the first `--` sentinel | 12 single-category clusters | More than one is an argument error |

`--no-coverage-hunt` with `--thorough` is an argument error. Both compose with `--auto-design`,
`--explore-scope`, `--auto-effort`, and `--no-discovery`. They never grant authority, expand scope,
or change a gate.

### Coverage map placement

```markdown
## Planning Coverage

> **Coverage**: <completed>/<total> clusters · <examined>/12 categories · <N> candidates · <M> residual limits · Effort: <requested→applied> · Independence: <mixed-model|mixed-effort|uniform-effort>
> **Freshness**: Coverage as of <date>; artifacts <list>

| Cluster | Area | Examined | Not examined / limit | Candidates | Notes / limit | Confidence |
|---------|------|----------|----------------------|------------|---------------|------------|
| ... | ... | ... | ... | ... | ... | ... |
```

Before Phase 1C, the section goes in the plan’s `00-ambiguity-register.md`. After the gate passes,
copy it into `00-index.md` after the overview and before the document index. The map contains no
prompts, decisions, secrets, or unrelated user content. `upgrade-plan` marks an existing map stale
when it changes the plan.

### Plan-specific coverage questions

The default clusters (or the twelve thorough clusters) use the RD-01 categories, but the plan packet
adds these framing questions:

| Cluster | Plan-specific framing |
|---------|-----------------------|
| Product and scope | Does the plan deliver the selected RD's confirmed scope, no more and no less? |
| Behavior and edges | What failure, retry, empty, concurrent, or partial states does the plan leave undefined? |
| Technical and data | What interface, schema, migration, naming, or environment assumption is unverified against the code? |
| Risk and stakeholders | What security, performance, compatibility, operational, or competing-need gap does the plan not address? |

These are prompts, not new categories. The exact partition and materiality rules remain RD-01's.

### Materiality and user round

- Maximum 12 material candidates per batch; every material candidate enters the register and the
  same consolidated round continues until all are presented.
- One consolidated round.
- Resolve from evidence first; only unresolved material items reach the user.
- Optional items follow `_shared/scope-expansion-control.md`.
- Complexity items follow `_shared/zero-ambiguity-gate.md` and require the independent challenger
  and the visible stop packet.
- Prior decisions are not reopened without new evidence.

### Discovery integration

Use `_shared/discovery.md` exactly:

- `discovery.enabled: true`, the three Discovery tools available, and no `--no-discovery`.
- A round at or below `chatMaxQuestions` stays in chat; a larger round is published.
- One plan per artifact: `kind=plan`, `artifact=<plan folder>`.
- Stable keys: `DQ-<n>`; `CV-NNN` remains the candidate identifier.
- Complexity escalations stay in chat.
- After publishing, send one chat line and end the turn; do not poll.

### Fallback

Canonical source: the RD-01 fallback table. The table below is a stage summary; on conflict, RD-01
wins.

| Condition | Behavior |
|-----------|----------|
| Subagents unavailable | Run clusters inline; mark `inline fallback` |
| Cluster failure | Retry once or inline; record incomplete if neither succeeds |
| Model unavailable | Inherit; record the model axis and the effort status |
| No usable effort variants/provider mapping | Keep the request unchanged; record `effort unavailable`; compensate structurally; never block |
| Missing scope or original-goal context | Fail closed to strict; block the hunt |
| Only one model/provider | Record the model axis and the effort status; continue |
| Discovery unavailable | Ask in chat; never mention a page the user cannot use |

### Metrics

Canonical source: the RD-01 event table and the RD-03 effort policy. The table below adds the
stage value and must not redefine the events.

| Event | Fields |
|-------|--------|
| `coverage_hunt.completed` | stage=`planning`, clusters, candidates, limits |
| `coverage_hunt.accepted` | stage=`planning`, material, accepted, optional, complexity |
| `coverage_hunt.fallback` | stage=`planning`, reason |
| `coverage_hunt.independence` | status (`mixed-model`, `mixed-effort`, `uniform-effort`), provider boundary |
| `coverage_hunt.effort` | requested level, applied variant, mapping source, fallback reason |

No content. The existing `scripts/codeops_outcomes.py` must be extended with these five event names
and a fixed content-free payload; use `stage=planning`. Metrics never change a gate result.

### Compatibility

- Existing plans remain valid without a coverage map.
- A legacy plan gets the map on the next full-plan run.
- Every map carries a freshness line; `upgrade-plan` marks an existing map stale when it changes
  the plan.
- Mini-plans and trivial tasks are unchanged.
- No new schema stamp or artifact.
- Inline fallback is the host-portability path.

---

## Integration Points

### With RD-01 (Coverage Hunt Protocol)

RD-05 consumes the cluster partition, packet, result contract, materiality filter, coverage map,
budget, and fallback. It does not restate them.

### With RD-02 (Coverage Auditor Mode)

RD-05 dispatches the `preflight-auditor` coverage mode through the RD-01 packet.

### With RD-03 (Independence and Effort Allocation)

RD-05 uses the RD-03 canonical levels, task-class policy, provider mapping, header, capability
line, and disclosure text in the coverage map and final summary.

### With the Zero-Ambiguity Gate

Candidates feed the plan register; Phase 1C still owns resolution and user confirmation.

### With Preflight

Preflight remains the post-authoring audit. The hunt is earlier and asks about absence; preflight
asks about defects in what was written. Both are required for a full feature.

### With the Specialist-Gap Check

The specialist-gap check still runs after lens selection and phase decomposition. The hunt may
surface a specialist candidate only through the normal specialist protocol; it does not create one.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|--------------------|--------|-----------|--------|
| Default state | On, opt-in, always on | On for full feature plans | Full plans justify the cost; mini-plans do not | AR-1 |
| Placement | Before 1C vs after documents | Before 1C | Absence is cheapest to fix before authoring | AR-2 |
| Map placement | Index vs register | `00-index.md` section | The index is the plan's navigation and coverage home; the register holds decisions | AR-10 |
| User rounds | Per cluster vs consolidated | One consolidated | Prevents questionnaire creep | AR-11 |
| Upgrade-plan | Include vs defer | Defer | Separate workflow; no evidence yet | AR-18 |
| Discovery | New page vs existing surface | Existing surface | No new UI or endpoint | AR-14 |
| Effort policy | Uniform high vs task-class allocation | Task-class allocation | Matches risk and controls cost | AR-19, AR-20, AR-24 |
| Provider mapping | Canonical only vs normalized | Normalized at the boundary | Keeps the public vocabulary stable | AR-23, AR-25 |

> **Traceability:** Every scope decision references the Ambiguity Register entry that resolved it.

**Additional traceability:** AR-8 (auto-design authority), AR-15 (content-free metrics), AR-18
(upgrade-plan scope boundary), AR-19 (independence), AR-20 (policy scope), AR-23 (provider
normalization), AR-24 (canonical scale), AR-25 (provider mapping).

---

## Security Considerations

- **Data sensitivity:** Plans, RDs, and code excerpts may be confidential. Packets carry only what
  the cluster needs; no secrets, credentials, or unrelated personal data.
- **Input validation:** Scope mode, cluster IDs, target paths, and artifact references are validated
  before dispatch. Paths are resolved by the lead, not supplied by an auditor.
- **Authentication & authorization:** N/A — no new endpoint. Discovery, when used, keeps its
  existing local-only binding.
- **Injection risks:** Repository content is data, never instructions (RD-02). Discovery answers are
  exact text, never executed.
- **Encryption needs:** N/A — no new storage or transport.
- **Rate limiting:** Dispatch budget and one-round cap.
- **Infrastructure:** N/A — no new service.
- **Security testing:** Content tests assert the flags, the one-round cap, strict-mode omission, the
  Discovery rules, the no-content metrics, and the inline fallback.

---

## Acceptance Criteria

1. [ ] `skills/make-plan/SKILL.md` states that the coverage hunt runs after Phase 1.2 and 1.3 and
   before Phase 1C; a content test asserts the order.
2. [ ] The skill states that full feature plans run the hunt by default, and mini-plans and trivial
   tasks do not.
3. [ ] `--no-coverage-hunt` is parsed before the first `--` sentinel; a duplicate is an argument
   error; the announcement is exactly `Coverage hunt disabled for this run`.
   `--no-coverage-hunt` with `--thorough` is an argument error.
4. [ ] `--thorough` is parsed before the first `--` sentinel; a duplicate is an argument error; it
   expands to 12 single-category clusters and announces `Coverage hunt thorough — 12 clusters`.
5. [ ] The skill dispatches the four default RD-01 clusters (or 12 thorough clusters) and states
   that the host may run them in parallel or sequentially with identical packets.
6. [ ] The lead merges, dedupes by root cause, resolves from evidence, applies the materiality
   filter, presents at most 12 material candidates per batch, and continues until all are presented.
   Every material candidate enters the register.
7. [ ] The plan register receives new `ambiguity` and `assumption` rows; optional items stay `CV-*`
   with `Classification: optional` and go to the Scope Expansion Register in explore mode or are
   omitted in strict mode; complexity items go to the Complexity Escalation Gate.
8. [ ] Before Phase 1C, the plan register receives a `## Coverage Map` section with the RD-01
   columns, `<completed>/<total>` summary, freshness line, and source note. After the gate, the
   section is copied into `00-index.md` under `## Planning Coverage`; a content test asserts both
   placements.
9. [ ] Phase 1C still requires every row resolved or explicitly deferred and user confirmation of
   the complete register; the hunt does not bypass it.
10. [ ] The Discovery integration uses `kind=plan`, the existing conditions, and the existing key
    scheme; no new page, endpoint, or key scheme is added.
11. [ ] Inline fallback is recorded; no cluster is skipped; a failed cluster is retried, run inline,
    or recorded as incomplete. No usable effort variant leaves the request unchanged and records
    `effort unavailable`.
12. [ ] Content-free metrics use the five RD-01 events with `stage=planning`; the outcomes helper is
    extended with the event names and fields; no prompt, decision, path, or artifact content is
    recorded.
13. [ ] Existing plans without a coverage map remain valid; every map carries a freshness line;
    `upgrade-plan` marks an existing map stale; mini-plans and trivial tasks are unchanged; no
    schema stamp or migration is introduced.
14. [ ] Preflight scope is narrowed: the hunt does not add dimensions or fan-out; RD-03’s
    effort/independence disclosure and `--thorough` recommendation are the only preflight changes;
    a content test asserts the boundary.
15. [ ] The specialist-gap check still runs after lens selection and phase decomposition; the hunt
    does not replace it.
16. [ ] The effort map is announced before dispatch and disclosed as `requested → applied`; plan
    `Reasoning:` suggestions use `xhigh` for adversarial/high-risk phases and never default to
    `max`; `exec-plan` continues to apply the phase suggestion to dispatched units; a content test
    asserts all three.
17. [ ] `skills/make-plan/templates.md` includes the `## Planning Coverage` section and the five
    effort levels in the Reasoning template; `quality-checklist.md` includes the coverage-map item.
18. [ ] RD-03's baseline source accepts the requirements `README.md`, the plan `00-index.md`, or the
    session baseline; the register/source note links merged `CV-*` IDs and `DQ-*` keys.
19. [ ] Security requirements verified: prompt-injection rule referenced, Discovery stays local, no
    secrets in packets, path canonicalization, no shell interpolation of user text.
20. [ ] All content tests run under the project's `npm run verify` and pass.

---

## Non-Functional Requirements

| Attribute | Requirement |
|-----------|-------------|
| **Latency** | Four clusters plus at most three scouts, parallel when supported; one user round. |
| **Reliability** | Inline fallback; no category skipped; incomplete clusters are recorded. |
| **Maintainability** | One protocol; the skill links to RD-01 and does not restate the cluster table. |
| **Portability** | Works without subagents or Discovery via inline and chat fallback. |
| **Observability** | Coverage map, final summary line, and content-free metrics. |
| **Compatibility** | Additive; existing plans remain valid; mini-plans unchanged. |

**Complexity estimate:** M
