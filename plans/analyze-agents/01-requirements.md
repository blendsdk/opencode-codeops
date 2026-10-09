# Requirements: analyze-agents (specialist discovery)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

CodeOps can detect when a project would benefit from a project-specific specialist subagent, but
the detection has no execution surface, no durable evidence, and no project-level memory. This
feature adds a manual `analyze-agents` skill that runs the existing detection criteria natively
over a repository's artifacts, records a per-plan findings ledger so recurrence becomes
computable, and maintains a small check-state file consumed by the `analyze-project` coverage line
(owned by T-07).

Scope boundaries are fixed by the Ambiguity Register (AR #1–AR #15). This document is the owning
requirements doc; every decision cites its register entry.

**Applicable lens:** data & migration — the feature introduces durable project records (a findings
ledger and a check-state file) whose formats, writers, and mixed-version behavior are part of the
contract (`references/domains/selection.md`). No web, financial, distributed, or compiler lens
applies.

## Functional Requirements

### Must Have

- R1 — A manually invocable `analyze-agents` skill ships as `skills/analyze-agents/SKILL.md` and is
  installed through the existing skill-directory discovery (AR #1, AR #2).
- R2 — The skill reads repository artifacts natively — requirements/plans, per-plan findings
  ledgers, manifests — and applies the detection criteria in `_shared/specialist-agents.md`; no
  script, no new dependency (AR #6, AR #10, AR #11).
- R3 — Output is at most two evidence-backed candidates in the lightweight proposal format defined
  by T-07, or an explicit `None` with evidence (AR #2, AR #6).
- R4 — The skill writes `codeops/specialist-check.json` (`{ checkedAt, plans[] }`) on every run,
  including `None` outcomes; absent or corrupt state means "never checked" for consumers
  (AR #4, AR #9).
- R5 — `exec-plan` records each ruling batch in the per-plan findings ledger
  `plans/<plan>/05-findings.md` using the compact row format (id, phase, severity, area, ruling)
  (AR #3, AR #8).
- R6 — The detection steps in `make-plan` and `make-requirements` delegate to the same detection
  flow while keeping the manual criteria fallback (AR #12); `analyze-project` delegates by
  recommending the skill from its T-07 coverage line rather than re-running detection.
- R7 — The skill never creates or modifies agent files, briefs, routing policy, or AGENTS.md; on
  user interest it hands off to `setup-routing` (AR #15 scope).
- R8 — All paths are layout-aware: flat (`plans/`) and nested
  (`codeops/features/<f>/plans/`) per `_shared/layout-convention.md` (AR #13).

### Should Have

- R9 — Recurrence thresholds anchor judgment: one area appearing in ≥2 plans or ≥3 findings is
  surfaced as a strong signal (AR #11).

### Won't Have (Out of Scope)

- A Python/companion signal-collection script (AR #10)
- Routing or catalog-coverage analysis — stays in `setup-routing` (AR #6)
- Automatic creation of specialists (AR #15 approval scope)
- Free-text vocabulary mining across document bodies in v1 (AR #11)
- Any write to the content-free outcome metrics store (AR #14)

## Technical Requirements

### Compatibility

- Records are plain Markdown/JSON readable without tooling. Consumers (the T-07 coverage line,
  `exec-plan`) treat absent or malformed records as "never checked" / reduced-signal states and say
  so — never silently (AR #9, AR #13).

### Security & Privacy

- Local reads only; no network; no new dependencies. Ledger and state carry identifiers, areas, and
  rulings — never prompt or review prose; nothing enters `codeops_outcomes.py` (AR #14).

### Performance

- Trivial by construction: bounded reads over a repository's own Markdown/JSON files (AR #13).

## Scope Decisions

Options and rationale live in the register; this table records the binding choices only.

| Decision              | Chosen                                  | AR Ref |
| --------------------- | --------------------------------------- | ------ |
| Command name          | `analyze-agents`                        | AR #1  |
| Signal collection     | Native reading (no script)              | AR #10 |
| Ledger location       | Per-plan `05-findings.md`               | AR #3  |
| Check state           | `codeops/specialist-check.json`         | AR #4  |
| Trigger policy        | Surfaced on every `analyze-project` run | AR #5  |
| Detector scope        | Repo signals + ledger recurrence        | AR #6  |
| Ledger row format     | Compact single row per ruling batch     | AR #8  |
| Record degradation    | Fail loud (never-checked / reduced)     | AR #13 |

## Acceptance Criteria

1. [ ] The `analyze-agents` skill exists with the contract pinned by ST-1 … ST-6
2. [ ] Ledger and state conventions are documented and wired (ST-3, ST-7, ST-8)
3. [ ] The existing detection steps delegate (ST-9)
4. [ ] Full verify passes; the live smoke confirms state write and proposal/`None` behavior (ST-10, ST-11)
5. [ ] Released as a minor version with CHANGELOG notes covering the new skill and records
