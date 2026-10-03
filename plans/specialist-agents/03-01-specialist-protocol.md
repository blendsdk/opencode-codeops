# Specialist Protocol: Specialist Agents

> **Document**: 03-01-specialist-protocol.md
> **Parent**: [Index](00-index.md)

## Overview

This component owns the canonical detection, proposal, and lifecycle protocol that the skills
link to. It is delivered as `_shared/specialist-agents.md` at the plugin root, following the
`quality-profile.md` / `zero-ambiguity-gate.md` pattern: one owning document, skills link to it,
no copies.

Routing is an optimization and a context mechanism, never a correctness source. Dynamic packets
remain the dispatch baseline; a missing or unavailable specialist falls back without weakening any
gate, reviewer count, or verification step.

## Detection criteria

A specialist is warranted only with repository evidence and no disqualifier. The check runs after
domain-lens selection, when the work's domain and risk profile are known.

| Strong signal (at least one, evidenced) | Disqualifier (any one blocks) |
| --------------------------------------- | ----------------------------- |
| A specialized framework, DSL, codegen, or protocol with non-obvious conventions a generic executor repeatedly rediscovers | A catalog role plus a dynamic packet already covers the need |
| An active domain lens plus project-specific invariants (regulatory, numerical, protocol, compatibility) checked every phase | One-off use with no recurring value |
| Repeated review findings or rework in the same area (from existing review evidence) | The specialist would only restate `AGENTS.md`, a lens, or base review lenses |
| An isolated, large-context capability (migration, compatibility audit) a packet cannot carry well | No unique evidence source, checklist, or capability beyond the base lenses |
| A project convention that must be enforced across phases and would otherwise be re-examined each time | An executor specialist with no demonstrated write-access need (prefer reviewer) |

Every candidate must name the smallest alternative (usually "keep sending the context in each
packet") and why it is insufficient. Sophistication, future flexibility, and effort already spent
are not evidence.

## Candidate packet

Presented to the user and persisted in the Ambiguity Register as a
`Technical (complexity escalation)` entry. Fields:

| Field | Content |
| ----- | ------- |
| Role | Proposed slug (validated per AR #15) |
| Kind | `reviewer` or `executor` |
| Capability | One line: what it knows or does that no catalog role does |
| Evidence | Repository facts with `file:line` |
| Why existing options fail | Catalog-role analysis + why a dynamic packet is insufficient |
| Smallest alternative | The direct alternative and why it is not enough |
| Use map | Intended features/phases/tags |
| Permissions | Read-only (reviewer) or the explicit write need (executor) |
| Effort / reasoning | Optional overrides; default effort `high`, reasoning `max` |
| Maintenance cost | Files, upkeep, and review attention |
| Independent verdict | `Unnecessary` / `Simplify` / `Justified` from a blind `design-challenger` |
| Direct user decision | `approved` / `rejected` / `deferred` — explicit, never silence |

## Authority and budget

- Creation is reserved authority. `--auto-design` may never approve it; only the user's direct
  choice on the visible Complexity Escalation Gate packet authorizes it
  (`_shared/zero-ambiguity-gate.md`).
- The gate's complete approval evidence (original goal, machinery, evidence, smallest solution,
  cost, verdict, decision) is persisted in the owning register entry.
- At most **two** candidates per requirements set or plan (AR #24), proposed in one batch;
  candidates are deduplicated against installed project agents and `codeops.json` routing roles.
- Rejection and deferral are valid outcomes. A rejected candidate may not reappear in the same
  scope without new evidence.

## Routing layers

| Layer | Owner | Content | Consumer |
| ----- | ----- | ------- | -------- |
| `.opencode/agents/<role>.md` description | installer, from the brief | Mandatory when-to-use text | OpenCode model (task list) |
| `codeops/codeops.json` → `routing.roles.<role>` | `setup-routing` | model / effort / sandbox / reasoning policy | installer + CodeOps skills |
| `codeops/specialists/<role>.md` | `setup-routing`, user-approved | Capability, scope, evidence, checklist, description | installer + skills |
| Plan `00-index.md` "Specialist Agents" | `make-plan` | phase → role selection map | `exec-plan` |
| `AGENTS.md` managed block | `setup-routing` (rendered by `--sync-agents-md`) | Compact index with when-to-use / required-for rules | every project agent |

## Detection integration

### make-requirements

1. After domain-lens selection and scope confirmation, run the detection criteria.
2. For each candidate, open an Ambiguity Register entry (`Technical (complexity escalation)`) with
   the candidate packet, run the challenger, and obtain the user's decision.
3. Approved candidates are created through `setup-routing` (below) or noted for creation before
   the first implementing plan; rejected candidates are recorded and dropped.
4. Record the check in the final summary. No new requirements-template section is created; the
   brief and register are the durable records.

### make-plan

1. After re-running lens selection and decomposing phases (Phase 1.2/1B), run the detection
   criteria against the phase plan.
2. Record the outcome in `00-index.md` under `## Specialist Agents`, always — including the
   negative outcome:

   ```markdown
   ## Specialist Agents

   | Role | Kind | Use | AR Ref |
   | ---- | ---- | --- | ------ |
   | pg-migration-reviewer | reviewer | Phase 2 (backfill), Phase 3 (cutover) | AR #7 |

   _Detection evidence: db/migrations/0042_backfill.sql requires mixed-version compatibility; no
   catalog role carries the project's migration ordering rule._
   ```

   ```markdown
   ## Specialist Agents

   **None** — the capability-gap check ran against this repository's evidence and found no gap a
   standing specialist would close.
   ```

3. Candidate approval, challenger, and persistence follow the shared gate exactly (AR #21).
   Approved roles are created through `setup-routing` before execution begins; the plan remains
   valid without them via dynamic-packet fallback.

### analyze-project

1. While inspecting manifests and conventions (step 2 of the skill), note specialization signals
   (specialized framework/DSL, domain invariants, conventions a generic agent would miss).
2. When a signal is strong and no specialist exists, report the candidate with evidence and
   recommend running `setup-routing`; never write agent files or candidate artifacts, and keep
   `AGENTS.md` compact.
3. Preserve the `<!-- CODEOPS-SPECIALISTS:START -->` / `<!-- CODEOPS-SPECIALISTS:END -->` block
   byte-for-byte when refreshing managed guidance.

## Lifecycle

| Stage | Action |
| ----- | ------ |
| Detect | Skills run the gap check and record outcomes (AR #6) |
| Propose | Candidate packet + independent verdict + user decision |
| Create | `setup-routing` drafts the brief, the user reviews it, routing policy is written first, the installer generates the agent, `--sync-agents-md` updates AGENTS.md, and `--check` verifies last |
| Use | `exec-plan` selects per the plan table; reviewers are additional and independent; fallback on unavailability |
| Review (optional guidance) | After first use, the user may evaluate benefit against its evidence; keep, revise the brief, or remove. This is not a gate and has no scheduled owner |
| Retire | `--remove-custom` (after confirmation) removes agent + brief; `setup-routing` drops routing and the AGENTS.md entry |

## Testing requirements

- Content spec tests assert this document exists with its schema stamp and required sections
  (ST-30), the cross-skill links after Phase 4 plus the updated setup-routing stance (ST-32), that
  no edited skill leaks `${PLUGIN_ROOT}` (ST-31), and that the authority, budget,
  outcome-recording, and `--auto-design` ban clauses are present (ST-30).
- Detection behavior is validated by the content assertions plus manual scenarios ST-34/ST-35 and
  the negative-detection scenario ST-43; it is not executable in CI.
