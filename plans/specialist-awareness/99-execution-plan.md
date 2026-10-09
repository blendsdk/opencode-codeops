# Task T-07: Specialist awareness — visible checks, proposal split, analyze-project coverage

> **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Progress**: 0/4 tasks (0%)
> **Reasoning**: medium — policy and wording changes across shared docs and skills, with content assertions as the verification surface
> **Last Updated**: 2026-10-09 14:27

## Objective

Close the awareness gap that keeps specialist proposals from ever surfacing. The specialist-gap
check runs only inside `make-requirements`, `make-plan`, and `analyze-project`; its outcome is
recorded silently; the proposal path is bundled with the full Complexity Escalation Gate machinery,
which biases the check toward silence; and the task lane skips the check entirely. Result: users
never see a suggestion, even when one is warranted.

After this task: every check outcome is visible in the owning summary; candidates surface as a
lightweight, evidence-backed proposal and the gate runs only when the user chooses to proceed to
creation; `analyze-project` shows the specialist-coverage status on every run and recommends the
`analyze-agents` check when the state file is missing or the plan set changed since the last one;
the plan quality checklist enforces the `## Specialist Agents` section.

**Smallest viable design:** wording and policy edits only, no code. One owning document
(`_shared/specialist-agents.md`) defines the lightweight proposal format, the gate split, and the
check-state interface (`codeops/specialist-check.json`: `{ checkedAt, plans[] }`, layout-aware plan
set); the participating skills reference it instead of restating it. Release: bundled with the
`analyze-agents` feature release unless a standalone release is requested. No new dependency, no new
script, no new CLI surface.

## Tasks

- [ ] T-07.1 Extend the content specification tests (red), following the `scripts/specialist-content.spec.test.mjs` conventions: lightweight-proposal format and gate split present in `_shared/specialist-agents.md`; fixed "Specialist check" summary-line requirement in `skills/make-plan/SKILL.md` and `skills/make-requirements/SKILL.md`; the specialist item in `skills/make-plan/quality-checklist.md`; coverage-line and recommendation instructions plus the check-state interface in `skills/analyze-project/SKILL.md`
- [ ] T-07.2 Apply the policy and wording edits: `_shared/specialist-agents.md` (new proposal and check-state sections; detection-integration updates); `skills/make-requirements/SKILL.md` (proposal split; summary line); `skills/make-plan/SKILL.md` (Phase 4 summary line); `skills/make-plan/quality-checklist.md` (enforcement item); `skills/analyze-project/SKILL.md` (coverage line + recommendation logic, layout-aware) — T-07.1 tests green
- [ ] T-07.3 Full verification: `npm run verify`
- [ ] T-07.4 Live smoke in a scratch repository: `analyze-project` with no state file shows "never checked — run `analyze-agents`"; with an up-to-date fixture state it shows "up to date"; with a stale fixture state it shows the recommendation

**Verify**: `npm run verify`
