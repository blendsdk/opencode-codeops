# Execution Routing: Specialist Agents

> **Document**: 03-03-execution-routing.md
> **Parent**: [Index](00-index.md)

## Overview

This component wires approved specialists into CodeOps execution without weakening any existing
gate. The authoritative rules live in `_shared/quality-profile.md`; the `exec-plan` skill points to
them and adds no private copy. Selection is explicit: a role is dispatched only when the plan's
`00-index.md` "Specialist Agents" table assigns it to a phase.

## Resolution order

Specialists use the existing resolution order (`_shared/quality-profile.md:121-134`), extended
with specialist policy:

1. an explicit model/effort requested for the current dispatch;
2. a generated or hand-authored project agent at `.opencode/agents/<role>.md`;
3. project defaults in `opencode.json`;
4. the parent session's model and effort.

`codeops/codeops.json` `routing.roles.<role>` supplies `model`, `effort`, `sandbox`, and
`reasoning` (AR #7, #10, #19); a missing pin never blocks the workflow. The generated
`reasoningEffort: max` default is embedded in the agent file; an override in routing policy takes
precedence.

## Plan selection table

`make-plan` writes the table; `exec-plan` reads it. A plan with no specialist records `None` and
dispatches none (AR #6, #16).

```markdown
## Specialist Agents

| Role | Kind | Use | AR Ref |
| ---- | ---- | --- | ------ |
| pg-migration-reviewer | reviewer | Phase 2 (backfill), Phase 3 (cutover) | AR #7 |
```

## Dispatch rules

### Reviewer specialists

- Dispatched in the post-phase quality step **in addition to** the correctness reviewer and any
  risk-selected auditors. A specialist never replaces a required reviewer or gate (AR #16).
- An independent specialist may count toward `quality.minimumReviewers` only when the minimum is
  met counting it, and never waives the correctness review.
- Findings use the **`SR-NNN`** prefix and the preflight severity scale; files/lines and concrete
  remedies are mandatory; "no findings" is reported explicitly.
- Findings merge into the same severity-grouped batches and follow the existing ruling rules
  (CRITICAL/MAJOR pause; `--auto-design` cannot waive).
- Scope mode (`strict`/`explore`) and the confirmed scope baseline are included; strict-mode
  behavior matches the phase reviewer's.
- Specialists are read-only; they never edit, fix, or commit.
- A specialist reviewer may not review a phase it executed (independence), and may not be the only
  reviewer for a critical/major-risk phase.

### Executor specialists

- A phase may dispatch a specialist executor instead of the generic executor when the plan assigns
  it and a fresh context with domain knowledge materially helps (AR #16).
- The executor contract is identical to `plan-task-executor`: implement task-by-task, never update
  plan marks (the parent owns `99-execution-plan.md`), run verify per the capture rule, stop and
  return a blocker report on any ambiguity, never edit spec tests or widen scope.
- Parent promotion rules (`[~]` then `[x]`), commit modes, and review requirements are unchanged.

### Availability and fallback

- OpenCode discovers agents at startup; an agent created after the session began is not in the
  session's agent list. Planning-time creation makes specialists available to the execution
  session (AR #19).
- When a listed specialist is unavailable, dispatch a generic subagent with the complete packet —
  including the relevant brief excerpt — or run inline, and report the fallback. The phase is
  never marked complete unreviewed because a specialist was missing.
- `--check` remains the source of truth for whether the generated agent exists and matches its
  brief.

### Dispatch packets

| Agent | Packet contents |
| ----- | --------------- |
| `domain-specialist-reviewer` | Line-1 dispatch header; phase diff; original goal + smallest viable design; phase task + Deliverable lines; active lenses plus the brief's domain checklist; scope mode + confirmed baseline; verify command + last result; the specialist brief excerpt |
| `domain-specialist-executor` | Phase task + Deliverable + Verify lines; governing spec/ST/AR excerpts; original goal + smallest viable design; target paths; scope mode + confirmed baseline; verify command; the specialist brief excerpt |

Both packets follow `_shared/quality-profile.md`; the brief excerpt is packeting, not restatement.

## Quality-profile changes

| Section | Change |
| ------- | ------ |
| Finding prefixes (`:68`) | Add `SR` (domain-specialist-reviewer), numbered `SR-NNN`; update the prefix list everywhere it is repeated |
| Resolution (`:121-134`) | Note that project specialists resolve like any project agent, with specialist defaults; mention `reasoning` in the routing-policy description at `:15-16` and the installer modes (`--custom`, `--sync-agents-md`) at `:132` |
| Dispatch packets | Add the two specialist rows above |
| Budget caps (`:108`) | Specialist dispatches are limited to the roles listed in the plan table; no new fan-out |
| Fallback (`:134`) | Already covers missing agents; add that a missing or invalid-brief specialist is reported and never blocks a gate |
| Exec-plan pointer | `skills/exec-plan/execution-protocol.md:180` lists `RV/SA/PE`; add `SR` there and point at this section |

`skills/exec-plan/SKILL.md` and `execution-protocol.md` gain a short pointer: "Specialists listed
in the plan's Specialist Agents table dispatch per `_shared/quality-profile.md`; unavailable
specialists fall back to a generic packet and the fallback is reported."

## setup-routing creation and removal

Creation (after the user approves a candidate, AR #4, #21):

1. Draft the brief from the candidate packet (`codeops/specialists/<role>.md`) and present it for
   a final review; the brief is the actual prompt, so it gets its own confirmation.
2. Write `routing.roles.<role>` policy first when a model/effort/sandbox/reasoning override is
   needed, because routing overrides win over the brief and a policy written after generation
   makes the agent immediately stale (PF-019).
3. Run `python3 "${CODEOPS_PLUGIN_ROOT}/scripts/install_agents.py" --project . --custom <role>`.
4. Run `--sync-agents-md` to update the managed block.
5. Run `--check` last and report states; tell the user the agent is available from the next
   OpenCode session.

Removal: confirm, run `--remove-custom <role> --yes` (which deletes agent + brief and triggers the
AGENTS.md sync), remove the routing entry, warn when an active plan references the role, and report
the updated index (PF-015).

## Routing layers recap

| Layer | Consumer |
| ----- | -------- |
| Agent `description` (model-visible task list) | any coding agent, opportunistically |
| `codeops/codeops.json` policy | installer + CodeOps skills |
| `codeops/specialists/` brief | installer + dispatchers |
| Plan Specialist Agents table | `exec-plan` |
| AGENTS.md managed block | every project agent, every session |

## Testing requirements

- Content spec tests assert `_shared/quality-profile.md` documents the `SR` prefix, resolution,
  and fallback, and that `exec-plan` links to it (ST-32).
- Manual scenarios ST-34 (dispatch with the agent present) and ST-35 (fallback with the agent
  absent) are recorded in `99-execution-plan.md`; there is no executable skill harness in CI.
