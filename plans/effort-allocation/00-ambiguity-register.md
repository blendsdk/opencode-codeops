# Ambiguity Register: Effort Allocation (RD-03)

> **Status**: ✅ GATE PASSED — all 9 items resolved
> **Last Updated**: 2026-11-24 00:32
> **CodeOps Artifact Schema**: 1

## Planning scope contract

| Boundary | Content |
|---|---|
| **Planning target** | `requirements/RD-03-independence-and-effort.md` |
| **Context artifacts** | RD-01, RD-02, RD-04, RD-05; `requirements/README.md`; `requirements/00-preflight-report.md`; `AGENTS.md`; `_shared/reasoning-effort.md`; `_shared/quality-profile.md`; the code files named in RD-03 |
| **Modification set (planning)** | `plans/effort-allocation/` documents only; implementation files are listed in the plan, not modified during planning |
| **Scope mode** | Strict — no optional additions |

## Auto-design invocation

```text
mode: auto-design
root invocation ID: ad-2026-11-24-effort-plan-01
parent workflow: make-plan
policy version: 1
delegated categories: algorithms, data structures, internal architecture and interfaces,
  failure and recovery design, testing strategy, implementation sequencing
reserved categories: product behavior or scope, priorities and acceptance criteria, access and
  security policy, data ownership or retention, legal/ethical/compliance, financial exposure,
  budget/deadline, paid vendors, public compatibility breaks, destructive migration, credentials,
  spending, deployment/publication, destructive actions, external communication, complexity
  escalation
permission state: unchanged action and commit permissions; no implementation or commit authority
```

`--auto-commit` is an exec-plan option, not a make-plan option. It is recorded as the execution
handoff preference only; it grants no authority during planning.

## Domain lenses

| Lens | Evidence |
|------|----------|
| Data and migration | Generated agent compatibility (`scripts/install_agents.py`), config enum compatibility, existing plan/marker compatibility |
| Distributed and concurrent | Not selected — the feature changes local variant selection, not concurrent state |

## Register

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Technical | How the verified provider table identifies OpenAI, Anthropic, and DeepSeek | A) Exact `providerID` match (`openai`, `anthropic`, `deepseek`); gateways and unknown providers fail open · B) Model-ID prefix matching regardless of provider · C) No provider table | ✅ User accepted recommendation A: exact provider IDs; gateways/unknown providers fail open | ✅ Resolved |
| 2 | Behavioral | How existing generated specialists keep `reasoningEffort: max` valid after the new default becomes `xhigh` | A) Generated-agent version marker; `--check` accepts a pre-marker `max` as legacy-valid; new files use `xhigh` · B) Accept either `xhigh` or `max` for every generated agent · C) Regenerate all agents to `xhigh` | ✅ User accepted recommendation A: version marker; pre-marker `max` is legacy-valid; new files use `xhigh` | ✅ Resolved |
| 3 | Technical | Where the capability-line dedupe state lives and when the line is injected | A) Per-session tuple (session + requested + applied + mapping); inject on change; clear on session deletion · B) Once per session · C) Every request | ✅ User accepted recommendation A: per-session tuple; inject on change; clear on session deletion | ✅ Resolved |
| 4 | Document organization | Component-document decomposition | A) Three docs: vocabulary/flags; provider resolution/capability line; disclosure/specialist default · B) Two docs · C) Four docs | ✅ User accepted recommendation A: three component docs | ✅ Resolved |
| 5 | Technical | Task-level verify command | A) Scoped `node --test` on affected spec files · B) Test-map `node bin/codeops-test.mjs run --gate task --baseline HEAD --include <spec files>` · C) Full `npm run verify` per task | ✅ User accepted recommendation B: test-map command with `--include`, after the AR-9 test-map correction. Interim evidence: scoped `node --test` run observed 127 passing tests on 2026-11-24 | ✅ Resolved |
| 6 | Scope | Whether this plan includes RD-01/02/04/05 coverage-hunt implementation | A) Strict RD-03 only · B) Also coverage-hunt protocol/integrations · C) Whole requirements set | ✅ User accepted recommendation A: strict RD-03 only | ✅ Resolved |
| 7 | Document organization | Phase structure | A) Four phases: vocabulary/flags; provider resolution; disclosure; specialist/docs/full verification · B) Three phases · C) Two phases | ✅ User accepted recommendation A: four phases | ✅ Resolved |
| 8 | Technical | Provider mapping test fixtures | A) User sets + repo-documented sets + non-canonical fail-open fixture · B) User sets only · C) Repo sets only | ✅ User accepted recommendation A: both DeepSeek sets, OpenAI/Anthropic sets, and a non-canonical fail-open fixture | ✅ Resolved |
| 9 | Technical | Necessary correction: `requirements/**` is unowned by the test map, so `check --strict` and the task selector fail with `map.unknown-source` | A) Add `requirements/**` to `codeops/test-map/policy.json` `ignorePaths` with reason “requirements documentation” · B) Add a requirements content group · C) Leave the full fallback | ✅ Authority: AI — delegated by `--auto-design` (see Resolution Notes) | ✅ Resolved |

## Resolution Notes

**AR-1:** Exact provider IDs keep the table narrow. Gateways that front multiple vendors do not
match and fail open rather than risk a wrong mapping.

**AR-2:** A generated-agent format marker (`# CodeOps-Agent-Version: 2`) distinguishes new files
from pre-change files. `--check` treats a pre-marker file with `reasoningEffort: max` as
legacy-valid; new files default to `xhigh`. This preserves existing generated agents, including the
project’s `agent-pipeline-reviewer`, without weakening new-file drift detection.

**AR-3:** The plugin owns a per-session map keyed by session, requested level, applied variant, and
mapping. It injects the capability line only when the tuple changes and clears the entry on
`session.deleted`. No line is injected when no level is active.

**AR-4:** Three component docs keep each contract reviewable: vocabulary/flags; provider resolution
and capability line; disclosure and specialist default.

**AR-5:** The project test map is the task gate. The requirements docs are documentation, so AR-9
adds them to `ignorePaths`; the task command then selects the affected code groups and the plan’s
declared spec files via `--include`. The scoped `node --test` run observed 127 passing tests as
interim evidence before the map correction lands.

**AR-6:** Strict RD-03 scope. The coverage-hunt protocol, auditor mode, and workflow integrations
remain RD-01/02/04/05 work.

**AR-7:** Four phases: vocabulary/flags; provider resolution; disclosure; specialist/docs/full
verification. This keeps specification-first ordering per behavior phase.

**AR-8:** Fixtures cover OpenAI/Anthropic canonical sets, DeepSeek `low/high/max` and
`low/medium/high/max`, `none`, `default`, malformed variants, and a non-canonical provider set that
must fail open.

**AR-9 — Authority: AI — delegated by `--auto-design`**

```text
Authority: AI — delegated by --auto-design
Eligibility: Testing strategy / necessary correction. It stays within the confirmed goal, changes
  no product behavior, scope, or acceptance criteria, and is reversible.
Objective: Make the project test gate usable without treating requirements documentation as
  unowned sources.
Decision: Add `requirements/**` to `codeops/test-map/policy.json` `ignorePaths` with reason
  “requirements documentation”.
Evidence: `node bin/codeops-test.mjs run --gate task --baseline HEAD` fails with
  `map.unknown-source` for requirements/*; `scripts/test-selection-docs.spec.test.mjs` asserts
  `check --strict` passes; the current map ignores plans/**, docs/**, README, CHANGELOG.
Rejected alternatives: a new requirements content group (larger map surface with no test command
  needed); leaving the full fallback (fails strict and hides selection); marking requirements as
  fullOn (causes unnecessary full runs for documentation).
Strongest counterargument: Ignoring requirements docs means changes there do not trigger content
  tests; however requirements are documentation, the content group already covers skills/shared,
  and this plan’s code is covered by its own spec files.
Confidence: High — the failure is deterministic and the ignore is the smallest reversible fix.
Hardening: Not required (one config entry, reversible, no complex/sensitive/high-impact choice).
Policy version: 1
Root invocation ID: ad-2026-11-24-effort-plan-01
Reopen triggers: Requirements docs become tested content, or a requirements-specific test slice is
  introduced.
```

## Gate checklist

- [x] Every row `✅ Resolved` with an explicit user decision or complete auto-design provenance
- [x] User confirmed the planning scope and modification set
- [x] No plan document except this register exists until the gate passes
- [x] No material support surface enters the plan without the Complexity Escalation Gate
- [x] The AR-9 correction is a necessary test-infrastructure fix, not a complexity escalation
