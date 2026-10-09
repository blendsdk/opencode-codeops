# Current State: analyze-agents (specialist discovery)

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

- Detection criteria live in `_shared/specialist-agents.md` (strong signals and disqualifiers; ≤2
  candidates per scope; reserved-authority creation).
- The check runs inside three skills: `make-requirements` (after lens selection and scope
  confirmation), `make-plan` (after phase decomposition, recorded in `00-index.md`), and
  `analyze-project` (conditional step 10).
- `setup-routing` owns creation and removal; `install_agents.py
  --custom/--check/--sync-agents-md` owns generation.
- `_shared/quality-profile.md` owns dispatch, specialist resolution, and fallback;
  `exec-plan` consumes the plan's `## Specialist Agents` table.
- Skills ship by directory discovery (`bin/install-skills.mjs` copies `skills/*/`), so a new skill
  needs no installer change.

### Relevant Files

Line numbers are as of plan authoring; T-07's edits shift some of them.

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `_shared/specialist-agents.md` | Criteria owner, lifecycle | Add the ledger convention, the check-state consumption note, and `analyze-agents` as the execution surface (AR #8, #9, #12) |
| `skills/analyze-agents/SKILL.md` | — | New: the manual check skill (03-01) |
| `skills/exec-plan/execution-protocol.md` | Phase execution rules | Concretize "the durable finding artifact" to `plans/<plan>/05-findings.md` with the row format (AR #8) |
| `skills/make-plan/SKILL.md` | Plan creation | Delegate the detection step to the analyze-agents flow; keep the manual fallback (AR #12) |
| `skills/make-requirements/SKILL.md` | Requirements creation | Same delegation (AR #12) |
| `scripts/analyze-agents-content.spec.test.mjs` | — | New: content spec tests (07) |
| `plans/specialist-awareness/99-execution-plan.md` | T-07 (prerequisite) | Ships the proposal format, state interface, analyze-project coverage line |

### Code Analysis

- `skills/exec-plan/execution-protocol.md` instructs the session to "record decisions durably in
  the finding artifact" and later "in the plan or its review report" — no file convention exists
  anywhere in the repository (a repository-wide search finds no ledger path). Runtime review
  findings are therefore lost once the session ends, and the strongest detection signal
  ("repeated review findings or rework in the same area") can never be evidenced.
- Nothing writes a check-state record; T-07 introduces `codeops/specialist-check.json` as an
  interface for the `analyze-project` coverage line, but the producer does not exist yet.
- The failure mode has one recorded instance: `plans/adaptive-reasoning-effort/00-index.md:88-94`
  — the only check outcome recorded since the specialist feature shipped, a silent `None`.

## Gaps Identified

### Gap 1: No execution surface

**Current Behavior:** Detection guidance is embedded in three long skill documents; nothing a user
can invoke on demand or a new project can be re-evaluated with.
**Required Behavior:** One manual skill executes the same criteria natively over the repository.
**Fix Required:** `skills/analyze-agents/SKILL.md` (03-01) + delegation wording (AR #2, AR #12).

### Gap 2: Undefined durable finding artifact

**Current Behavior:** `exec-plan` references an undefined "finding artifact"; findings evaporate.
**Required Behavior:** A per-plan `05-findings.md` ledger in a compact row format, written by the
existing ruling step.
**Fix Required:** 03-02 §Ledger; execution-protocol edit (AR #3, AR #8).

### Gap 3: No check state

**Current Behavior:** Nothing records when a project was last analyzed; projects are never
re-evaluated.
**Required Behavior:** `codeops/specialist-check.json` written on every run (including `None`);
consumed by T-07's coverage line.
**Fix Required:** 03-02 §Check state (AR #4, AR #9).

### Gap 4: No signal-to-state loop

**Current Behavior:** Recurrence cannot be evidenced, so the data-driven trigger never fires.
**Required Behavior:** The ledger feeds recurrence counting in the analyze-agents flow (≥2 plans or
≥3 findings in one area).
**Fix Required:** 03-01 §Detection flow (AR #11).

## Dependencies

### Internal Dependencies

- **T-07 must ship first** (`plans/specialist-awareness/`): proposal format, state-file interface,
  `analyze-project` coverage line and recommendation.
- `_shared/specialist-agents.md` stays the criteria owner; this feature adds the execution surface
  and record conventions on top.

### External Dependencies

None. No new packages, no network access, no OpenCode changes.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Ledger rows not written during execution | Med | Med | Bound to exec-plan's existing mandatory ruling step; a missing ledger degrades loudly, never silently (AR #13) |
| Format drift between writer and reader | Low | Med | One owning doc (03-02; `_shared` for the state interface) + content tests pin both sides (ST-7, ST-8) |
| Over-triggering proposals | Low | Med | ≤2 candidates, evidence + smallest-alternative required, user decides; criteria unchanged (AR #11) |
| State written but never read (consumer drift) | Low | Low | T-07 ships the consumer; ST-7 cross-checks the interface |
