# RD-03: Independence and Effort Allocation

> **Document**: RD-03-independence-and-effort.md
> **Status**: Review
> **Created**: 2026-11-23
> **Updated**: 2026-11-24
> **Project**: opencode-codeops
> **Depends On**: —
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

CodeOps subagents normally inherit the parent session’s model. Model switching is a deployment
constraint, so it cannot be the baseline for independent judgment. The portable lever is **effort
on the current model**.

This document defines a canonical five-level effort vocabulary, a minimum-sufficient allocation
policy, a small verified provider mapping, a `max` guard, and the disclosure that makes the applied
level auditable. Independence rests on three axes: fresh context, a distinct lens, and different
effort. A different model is an optional fourth axis when one is genuinely available.

The provider layer is deliberately small. The existing resolver already selects the exact or
nearest exposed variant. This RD adds `xhigh`, prevents unintended `max` selection, keys the
verified mapping by provider **and model**, and leaves unknown providers fail-open. It does not add
a generic alias/settings/ordinal inference pipeline; that larger surface is deferred until a real
mismatch is demonstrated.

---

## Functional Requirements

### Must Have

- [ ] **FR-1 — Three-axis independence.** Define independence as context, lens, and effort. Model
      diversity is optional. `same-model, mixed-effort` is a valid status.
- [ ] **FR-2 — Canonical five-level scale.** Define `low`, `medium`, `high`, `xhigh`, and `max` as
      the task-effort vocabulary. Keep `none` and `minimal` routing-only. Do not add `default` as a
      task level; absence of a marker means inherit.
- [ ] **FR-3 — Default ceiling.** `xhigh` is the default ceiling for adversarial and high-risk
      work. Canonical `max` is explicit-only. A provider mapping may resolve canonical `xhigh` to
      the provider’s `max` (DeepSeek); state that exception explicitly wherever “`max` is
      explicit-only” appears.
- [ ] **FR-4 — Task-class allocation.** Define mechanical `low`, bounded `medium`, judgment `high`,
      adversarial `xhigh`, and explicit-critical `max`.
- [ ] **FR-5 — Verified provider table.** Define a small table keyed by provider **and model
      family**: OpenAI/Anthropic identity; DeepSeek `medium→high`, `xhigh→max`, `none→none`.
      Runtime variants are authoritative; exact match wins. Unknown providers fail open.
- [ ] **FR-6 — No default `max` on OpenAI/Anthropic.** Add a `max` guard: canonical `max` is
      selected only when the requested level is `max`, or when the verified DeepSeek
      `xhigh→max` alias applies. A generic nearest match must never produce `max` for a lower
      request.
- [ ] **FR-7 — No distant jumps.** If the nearest verified mapping is more than one canonical
      step from the request, fail open rather than over-powering the task. A provider exposing only
      `max` must not turn a `low` request into `max`.
- [ ] **FR-8 — No-variant behavior.** When the model exposes no usable reasoning variants or no
      verified mapping exists, leave the request unchanged, record `effort unavailable`, and
      compensate with smaller packets, decomposition, and additional review lenses. Remove the
      raw `reasoningEffort` passthrough when no variants record exists.
- [ ] **FR-9 — Capability disclosure.** Inject one content-free capability line when the resolved
      level or mapping changes, not on every request:
      `CodeOps effort: model=<provider>/<id>; variants=<a,b,c>; context=<limit>; requested=<level>; applied=<variant|unavailable>; mapping=<exact|alias|nearest|fail-open>`.
      Escape and length-cap model/variant identifiers; strip control characters.
- [ ] **FR-10 — Artifact disclosure.** The coverage map, preflight report, and exec-plan summary
      state `requested → applied` effort and the independence status. When no level is active,
      omit the effort field rather than inventing `default`.
- [ ] **FR-11 — Dispatch header.** Define one header in `_shared/quality-profile.md`:
      `[codeops-dispatch agent=<name> feature=<slug> phase=<id> unit=<id> model=<pin|inherited> effort=<requested> independence=<mixed-model|mixed-effort|uniform-effort>]`.
      Omit `effort=` when inherit. RD-01 and RD-02 link to this contract; they do not define a
      second header.
- [ ] **FR-12 — Suggestion vocabulary and flags.** Add `xhigh` to `EFFORT_LEVELS`, the
      `[codeops-effort: <level>]` marker, `--auto-effort=<level>`, the Python session helper, and
      the TypeScript declaration. Existing `low/medium/high/max` values remain valid.
- [ ] **FR-13 — Preflight and plan policy.** Preflight `--thorough` recommends a uniform `xhigh`
      for the scan, not `max`; preflight’s dimensions and fan-out are unchanged. Plan suggestions
      use `xhigh` for adversarial/high-risk phases and `max` only by explicit user choice; these
      are applied through the existing execution phase-marker path, while plan authoring applies
      them only with `--auto-effort`. On DeepSeek, `xhigh` resolves to `max`.
- [ ] **FR-14 — Specialist default.** New generated specialists default to `xhigh`, not `max`.
      Existing generated agents with `reasoningEffort: max` remain valid as a documented legacy
      exception; the default-max metric is scoped to new effort selections.
- [ ] **FR-15 — No new schema field.** Reuse `routing.roles.<role>.reasoning`, which already
      accepts `xhigh`. No `default` or provider-native enum value is added to the public config.
- [ ] **FR-16 — No model-switching requirement.** `setup-routing` may offer optional model pins,
      but every workflow works on the inherited current model with effort allocation alone.
- [ ] **FR-17 — Compatibility.** Existing plans, markers, routing entries, and generated agents
      remain valid. The intended behavior changes are: `xhigh` is accepted, a distant jump fails
      open instead of selecting a far variant, and `max` is guarded. Document these in the
      changelog and the shared effort contract.
- [ ] **FR-18 — Change surface.** Update every owning file, including
      `_shared/reasoning-effort.md`, `_shared/quality-profile.md`,
      `bin/lib/reasoning-effort.mjs`, `bin/lib/reasoning-effort.d.mts`,
      `bin/reasoning-effort.spec.test.mjs`, `bin/reasoning-effort.impl.test.mjs`,
      `scripts/codeops_effort.py`, `scripts/effort.spec.test.mjs`,
      `scripts/install_agents.py`, `scripts/install_agents.spec.test.mjs`,
      `plugin/index.ts`, `skills/preflight/SKILL.md`, `skills/preflight/report-format.md`,
      `skills/exec-plan/execution-protocol.md`, `skills/make-plan/templates.md`,
      `skills/make-plan/quality-checklist.md`, `skills/setup-routing/SKILL.md`,
      `skills/setup-routing/routing.md`, `README.md`, and `CHANGELOG.md`.

### Should Have

- [ ] **FR-19 — Mapping trace.** Extend the optional effort trace with the mapping source
      (`exact`, `alias`, `nearest`, `fail-open`) and the applied variant. Content-free, off by
      default.
- [ ] **FR-20 — Optional model diversity.** `setup-routing` may pin a judgment role to a different
      model when the project has one and approves the provider boundary.
- [ ] **FR-21 — Project alias override (deferred).** A project-level alias map is a future escape
      hatch for providers the verified table cannot map. Not part of v1.

### Won't Have (Out of Scope)

- A generic alias/settings/ordinal inference pipeline. Add aliases only for a demonstrated
  provider/model mismatch.
- Requiring a model switch for independent judgment.
- Provider-native names in skills, plans, markers, or the public config vocabulary.
- Selecting canonical `max` on OpenAI/Anthropic by default.
- Forcing a variant when the model exposes none, or blocking on effort.
- A new model registry, provider SDK, or runtime model-selection service.
- A guarantee that effort changes improve quality.

---

## Technical Requirements

### Independence model

| Axis | What it changes | How it is achieved |
|------|-----------------|--------------------|
| Context | Removes the author’s conversation history | Fresh subagent context |
| Lens | Forces a different review perspective | Assigned cluster or role |
| Effort | Changes reasoning depth on the current model | Canonical level → verified provider variant |
| Model | Optional different training prior | Routing pin, only when available and approved |

**Status vocabulary:** `mixed-model`, `mixed-effort`, `uniform-effort`. Report the strongest axis
actually achieved. `same-model` is not an independence status; it is a model-axis fact.

### Canonical scale

| Level | Meaning | Default use |
|-------|---------|-------------|
| `low` | Mechanical, deterministic verification | Yes |
| `medium` | Bounded work with known patterns | Yes |
| `high` | Judgment, correctness, security, planning, review | Yes |
| `xhigh` | Adversarial or high-risk analysis | **Yes — default ceiling** |
| `max` | Explicit critical only | No |

`none` and `minimal` are routing-only. `default` is not a task level; absence of a marker means
inherit the parent variant. CodeOps never selects the provider’s `default` variant.

### Task-class allocation

| Class | Examples | Canonical | OpenAI / Anthropic | DeepSeek |
|-------|----------|-----------|--------------------|----------|
| Mechanical | Renames, formatting, config, bookkeeping | `low` | `low` | `low` |
| Bounded | Standard implementation, recon, single-file review, docs | `medium` | `medium` | `high` |
| Judgment | Requirements, planning, coverage C1–C3, correctness review | `high` | `high` | `high` |
| Adversarial | Security/financial/concurrency risk, challenger, `--thorough` | `xhigh` | `xhigh` | `max` |
| Explicit critical | User explicitly requests the absolute top | `max` | `max` | `max` |

Coverage-hunt defaults:

| Work | Canonical |
|------|-----------|
| Recon scouts | `low`; `medium` if broad |
| C1 Product and scope | `high` |
| C2 Behavior and edges | `high` |
| C3 Technical and data | `high` |
| C4 Risk and stakeholders | `xhigh` |
| Synthesis and materiality filter | `high` |
| Health check | `high` |
| `--thorough` | `xhigh` for the three risk categories; `high` for the rest |

Preflight `--thorough` is **uniform `xhigh`**; its dimensions and fan-out are unchanged.

### Verified provider table

| Canonical request | OpenAI | Anthropic | DeepSeek |
|-------------------|--------|-----------|----------|
| `low` | `low` | `low` | `low` |
| `medium` | `medium` | `medium` | `high` |
| `high` | `high` | `high` | `high` |
| `xhigh` | `xhigh` | `xhigh` | `max` |
| `max` (explicit) | `max` | `max` | `max` |
| `none` (routing only) | unavailable → fail open | unavailable → fail open | `none` |
| `default` (not a task level) | not selected | not selected | not selected |

The table is keyed by provider **and model family**. Runtime `variants` are authoritative: if the
model exposes the canonical level exactly, use it even when the table says otherwise. The table is
a fallback for models that lack the level. Record the observed variant set in a fixture before
calling a mapping “verified.”

### Resolution algorithm

```text
resolveVariant(requested, model):
  if requested == none:
    return exact "none" or fail-open
  variants = runtime variant set
  if variants has requested: return requested          # exact wins
  mapped = verifiedProviderAlias(provider, modelFamily, requested)
  if mapped and variants has mapped: return mapped
  nearest = nearest exposed canonical variant
  if nearest == max and requested != max:
    return fail-open                                    # max guard
  if |nearest - requested| > 1:
    return fail-open                                    # no distant jumps
  return nearest

apply:
  if resolveVariant returns a variant: merge its settings
  else: leave options unchanged; disclose fail-open
```

**Invariants:** exact wins; `max` is guarded; no distant jumps; `none` exact-match only; no raw
`reasoningEffort` passthrough when no variants record exists; unknown or malformed variants never
produce a provider error.

### Capability line

When the resolved level or mapping changes, inject one content-free system line:

```text
CodeOps effort: model=<provider>/<id>; variants=<a,b,c>; context=<limit>; requested=<level>; applied=<variant|unavailable>; mapping=<exact|alias|nearest|fail-open>
```

Escape and length-cap identifiers; strip CR/LF and control characters. No prompt, source, path, or
secret content. No line when no level is active. Deduplicate unchanged repeats.

### Dispatch header

```text
[codeops-dispatch agent=<name> feature=<slug> phase=<id> unit=<id> model=<pin|inherited> effort=<requested> independence=<mixed-model|mixed-effort|uniform-effort>]
```

`_shared/quality-profile.md` is the single owner. RD-01 and RD-02 reference it; they do not define
a second header. Omit `effort=` when inherit.

### Disclosure text

| Surface | Mixed-model | Mixed-effort | Uniform |
|---------|-------------|--------------|---------|
| Coverage map | `Independence: mixed-model` | `Independence: mixed-effort` | `Independence: uniform-effort` |
| Preflight report | `Independence: mixed-model` | `Independence: mixed-effort` | `Independence: uniform-effort` |
| Exec-plan summary | `Review independence: mixed-model` | `Review independence: mixed-effort` | `Review independence: uniform-effort` |
| Health check | same three forms | same three forms | same three forms |

Every effort-bearing surface adds `Effort: <requested>→<applied> (<mapping>)`; when no level is
active, omit the effort field.

### Specialist default

`scripts/install_agents.py` defaults new specialists to `xhigh`. Existing generated agents with
`reasoningEffort: max` remain valid as a legacy exception. Update the installer spec test, the
quality-profile note, `skills/setup-routing/routing.md`, and README. The feature’s change surface
includes the installer; the plan must route that phase to `agent-pipeline-reviewer` per AGENTS.md.

### Compatibility

- Existing `low/medium/high/max` markers, routing entries, and plans remain valid.
- `xhigh` is additive; the helper, marker, and flag accept it.
- Distant-jump models now fail open instead of selecting a far variant; document this as an
  intended behavior change.
- Existing generated specialists keep their embedded `max`; the policy applies to new selections.
- No new schema field, artifact, or migration.

---

## Integration Points

### With RD-01 (Coverage Hunt Protocol)

RD-01 consumes the canonical levels, the per-cluster map, and the `max` guard. The header and
disclosure contract is owned here and referenced there.

### With RD-02 (Coverage Auditor Mode)

RD-02 reports the requested/applied effort; the lead selects it. The auditor’s read-only boundary is
enforced through routing sandbox and permissions.

### With RD-04 and RD-05 (Workflow Integration)

Both workflows announce the effort map and disclose `requested → applied`. They do not restate the
provider table or the canonical scale.

### With `_shared/quality-profile.md`

The shared profile owns the one dispatch header and the mode-aware preflight-auditor packet. This RD
adds the header fields and the coverage-mode packet description.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|--------------------|--------|-----------|--------|
| Provider layer | Full pipeline, small verified table, canonical only | Small verified table | Existing nearest logic covers the documented sets; pipeline deferred | AR-23, AR-25 |
| Independence baseline | Model-required, effort-required, context+lens | Context + lens + effort; model optional | Model switching is a deployment constraint | AR-19 |
| Default ceiling | `max`, `xhigh`, provider-specific | `xhigh`; canonical `max` explicit-only | Matches actual usage and controls cost | AR-24 |
| DeepSeek mapping | medium→high, medium→low, xhigh→high | medium→high, xhigh→max | Nearest higher; max is the provider top | AR-25 |
| Max guard | None, canonical-only, provider-specific | Canonical max guarded; DeepSeek xhigh→max allowed | Prevents partial sets from selecting max | AR-24, AR-25 |
| No-variant behavior | Raw passthrough, fail-open, block | Fail open + structure | Effort is advisory; blocking is wrong | AR-21 |
| Preflight `--thorough` | Uniform xhigh, per-cluster mix | Uniform xhigh | Smallest change; no new per-dispatch mechanism | AR-20, AR-24 |
| Specialist default | max, xhigh, inherit | xhigh; legacy max exception | Makes the policy true for new work | AR-24 |

> **Traceability:** Every scope decision references the Ambiguity Register entry that resolved it.

**Additional traceability:** AR-1, AR-5, AR-6, AR-13, AR-15, AR-20, AR-22.

---

## Security Considerations

- **Data sensitivity:** Using the current model avoids cross-provider exposure by default. A
  cross-provider pin requires explicit project approval. No secrets appear in the capability line,
  header, trace, or report.
- **Input validation:** Model and provider identifiers come from the runtime registry or explicit
  user input; the workflow never invents them. Identifiers are escaped, length-capped, and stripped
  of control characters before entering a prompt-bound line.
- **Authentication & authorization:** N/A — no new endpoint. Provider credentials stay with
  OpenCode.
- **Injection risks:** N/A for effort mapping; the coverage auditor’s prompt-injection rule is in
  RD-02.
- **Encryption needs:** N/A — no new storage or transport.
- **Rate limiting:** N/A — no new network endpoint; dispatch budgets are in RD-01.
- **Infrastructure:** N/A — no new service.
- **Security testing:** Content and fixture tests assert the max guard, the verified mapping, the
  fail-open behavior, the no-raw-passthrough rule, identifier escaping, and the absence of secrets
  in disclosure text.

---

## Acceptance Criteria

1. [ ] `_shared/reasoning-effort.md` defines five canonical levels, `xhigh` as the default ceiling,
   canonical `max` as explicit-only, and the DeepSeek `xhigh→max` exception.
2. [ ] `EFFORT_LEVELS` contains the five levels; the marker grammar and `--auto-effort` accept
   `xhigh`; a spec test asserts the marker and flag.
3. [ ] `scripts/codeops_effort.py` accepts `xhigh`; `scripts/effort.spec.test.mjs` and
   `bin/lib/reasoning-effort.d.mts` are updated; a cross-language parity test fails if the lists
   drift.
4. [ ] The task-class table defines mechanical `low`, bounded `medium`, judgment `high`, adversarial
   `xhigh`, and explicit-critical `max`.
5. [ ] The verified provider table is keyed by provider and model family; OpenAI/Anthropic identity
   and DeepSeek `low→low`, `medium→high`, `high→high`, `xhigh→max`, `max→max`, `none→none` are
   asserted by fixtures.
6. [ ] A fixture with `{low, high, max}` maps `xhigh→max`; a fixture with `{low, high}` and a
   non-max request never selects `max`; a provider exposing only `max` fails open for `low`.
7. [ ] A partial OpenAI/Anthropic set that exposes `max` but not `xhigh` never selects `max` for a
   non-`max` request.
8. [ ] Unknown or malformed variants fail open with no provider error; the no-variants path returns
   the original options and discloses instead of sending a raw `reasoningEffort`.
9. [ ] `scripts/install_agents.py` defaults new specialists to `xhigh`; its spec test asserts it;
   existing generated agents with `max` remain valid and the metric is scoped.
10. [ ] The capability line is injected once per resolved change, not every request; it contains
    model, variants, context, requested, applied, and mapping, and no prompt/path/secret content.
11. [ ] `_shared/quality-profile.md` owns the single dispatch header with `unit`, `model`, `effort`,
    and `independence`; RD-01/RD-02 reference it; a content test asserts one contract.
12. [ ] The independence status uses only `mixed-model`, `mixed-effort`, or `uniform-effort`; a
    content test asserts the three forms and rejects `same-model`/`mixed`.
13. [ ] The coverage map, preflight report, and exec-plan summary include
    `Effort: <requested>→<applied> (<mapping>)`; when no level is active, the effort field is
    omitted.
14. [ ] Preflight `--thorough` recommends uniform `xhigh`; plan suggestions use `xhigh` for
    adversarial phases and `max` only by explicit request; execution phase markers unchanged.
15. [ ] `skills/make-plan/templates.md` and `quality-checklist.md` are updated for the five levels,
    the coverage section, and the effort line.
16. [ ] `scripts/install_agents.py`, `_shared/quality-profile.md`, and the specialist docs are in
    the change surface; `agent-pipeline-reviewer` is required for that phase.
17. [ ] Existing `low/medium/high/max` behavior remains accepted; the distant-jump fail-open and
    `max` guard are documented as intended behavior changes in `CHANGELOG.md`.
18. [ ] No new config schema field is added; `routing.roles.<role>.reasoning` already accepts
    `xhigh`.
19. [ ] No model-switching requirement is introduced; `setup-routing` presents optional diversity.
20. [ ] Security requirements verified: identifiers escaped, max guard, no raw passthrough, no
    secrets in disclosure, cross-provider approval.
21. [ ] All content, spec, and fixture tests run under the project’s `npm run verify` and pass.

---

## Non-Functional Requirements

| Attribute | Requirement |
|-----------|-------------|
| **Latency** | Mapping is local; no extra model call. |
| **Reliability** | Fail open on unknown variants; never a provider error. |
| **Maintainability** | One canonical table, one verified provider table, one resolver. |
| **Portability** | Canonical vocabulary works on any host; provider adapters are data. |
| **Observability** | Capability line, dispatch header, artifact disclosure, optional trace. |
| **Compatibility** | Additive `xhigh`; documented max guard and distant-jump changes. |

**Complexity estimate:** M
