# Requirements: Right-Sized Verification (Wave 1)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Make the amount of verification CodeOps plans and executes proportional to the size and stakes of
the work, cut review noise, keep skill selection reliable, and keep an executing run's place across
context compaction. Today's test ceremony and review frequency remain as the `critical` tier, the
tier of every existing plan.

## Functional Requirements

### Must Have

- [ ] **R1 Verification tiers.** Full plans carry a `standard` or `critical` tier; mini-plans stay
  the light path (AR-11). 03-01.
- [ ] **R2 Standard-tier content.** Spec tests stay first with the red check folded into the
  spec-test task; implementation tests only for error paths and edge cases named in ST-cases or 03
  docs; no percentage coverage targets — every ST-case/acceptance criterion has ≥1 test; the shared
  rules that require a distinct red-phase task apply to `critical` (AR-12). 03-01.
- [ ] **R3 Tier derivation and override.** make-plan derives the tier from real-risk signals
  (AR-13, AR-29), states it provisionally and finally, records it in 00-index, and honors
  `quality.verificationTier` with disclosure (AR-14). No line ⇒ `critical`; upgrade-plan never
  derives a tier. 03-01.
- [ ] **R4 Review timing.** At `standard` a phase is reviewed when risk-tagged or ≥150 changed
  product lines; otherwise it is marked `carried forward`; every carried-forward phase is reviewed
  at plan completion — before the plan is reported done, finally pushed, or released. Each phase header records its review
  status. `critical` reviews every phase (AR-4, AR-15). 03-01.
- [ ] **R5 Verification balance.** After each phase exec-plan reports and records
  `Verification balance: T test / P product lines (R:1)`, warns above 1.5 at standard, never stops
  (AR-5, AR-16, AR-17, AR-30). 03-03.
- [ ] **R6 Review calibration.** The severity rule, the not-findings list, the quoted-rule
  requirement, and machinery routing apply to every reviewer at every tier, through the packet and
  at merge (AR-18). 03-02.
- [ ] **R7 Refuter.** exec-plan sends each phase's 🔴/🟠 findings, any prefix and any tier, to one
  refute dispatch; `Confirmed` and downgrades to 🟠 stop for a ruling; refuted findings are listed,
  ledgered, and reinstatable (AR-6, AR-19, AR-20, AR-28). 03-02.
- [ ] **R8 Skill descriptions.** Every `skills/*/SKILL.md` description starts "Use when", names
  sibling alternatives where confusion is likely, is ≤500 characters, and loses no workflow fact
  that the body does not already hold (AR-21). 03-04.
- [ ] **R9 Compaction note.** When the compacting session owns an unfinished progress run, the
  compaction request carries a ≤400-character note with plan, phase, task, and the re-read
  instruction; otherwise nothing is added (AR-22). 03-05.
- [ ] **R10 Tracking.** Roadmap rows for this plan and for Wave 2 (⬜ Backlog); a Wave 2 GitHub
  issue drafted and posted only after the user approves the text (AR-8, AR-26).

### Won't Have (Out of Scope)

- Router, status CLI, lightweight change path, bug flow, converge pass, manual-only skills,
  slash commands, blocking guards, learnings loop, auto-continuation (Wave 2 or deferred).
- Any change to preflight's review behavior (AR-19).
- A measurement script, a new agent, a new ledger file, a test injection seam (AR-6, AR-7, AR-22).
- A hand-written CHANGELOG entry — the release tool writes it from `feat` commits (02).

## Technical Requirements

### Compatibility

- Plans without a tier line keep today's test ceremony and review frequency (AR-14). Review
  calibration and the refuter change review behavior for all plans (AR-18, AR-28).
- The schema change is additive; older installations reject `quality.verificationTier`, and the
  commit says so.
- Release is MINOR (`feat` commits); the release itself is a separate user action (AR-25).

### Security

- The compaction note carries the plan, phase, and task values reported to the progress tool,
  sanitized (no line breaks or control characters, quotes neutralized, 60 characters each) inside
  fixed text (03-05).

## Scope Decisions

All scope decisions are recorded in [00-ambiguity-register.md](00-ambiguity-register.md),
AR-1 through AR-30.

## Acceptance Criteria

1. [ ] All ST-cases in 07 pass.
2. [ ] `npm run verify`, `node bin/codeops-test.mjs check --strict`, and
   `python3 scripts/install_agents.py --project . --check` pass (Phase 7 gate).
3. [ ] The Phase 7 `standard` replay meets the verification-share target and the `critical` replay
   keeps today's ordering; the other 00-index targets are recorded on the next real feature and do
   not gate this plan.
4. [ ] Roadmap rows exist; the Wave 2 issue is posted or explicitly withheld by the user.
