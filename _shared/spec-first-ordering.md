# Specification-First Task Ordering (shared protocol)

> **CodeOps Artifact Schema**: 1

The **single canonical definition** of CodeOps' specification-first ordering. `make-plan` applies
it when generating `99-execution-plan.md`; `exec-plan` enforces it while executing one. Both link
here; neither carries its own copy.

Every feature implementation phase keeps the same order — specification tests first, then the
implementation, then implementation tests. The order prevents tautological testing — tests that
mirror the implementation instead of independently verifying it against the specification. The
plan's verification tier (below) decides how many of these steps are separate tasks. At the
`critical` tier every feature phase uses this three-step structure:

```
Phase N: [Feature Name]

  Step N.1: Specification Tests (BEFORE implementation)
    N.1.1  Write specification tests from 07-testing-strategy.md ST-cases
           → File: [feature].spec.test.[ext]
           → Source: 07-testing-strategy.md ST-1 through ST-X
           → MUST NOT read implementation logic when writing these tests
    N.1.2  Run spec tests — verify they FAIL (red phase)
           → Document any that pass pre-implementation with justification

  Step N.2: Implementation
    N.2.1  Implement [feature/component] per technical specification
           → Reference: 03-XX-[component].md
    N.2.2  Run spec tests — verify they PASS (green phase)
           → If any spec test fails: STOP, fix the implementation (NOT the test)

  Step N.3: Implementation Tests & Hardening
    N.3.1  Write implementation tests (edge cases, internals, error paths)
           → File: [feature].impl.test.[ext]
    N.3.2  Full verification (the project's verify command)
```

## Verification tiers

A full plan records its tier as `> **Verification tier**: <tier> — <reason>` — in `00-index.md` for
a `critical` plan, in the header of the single document for a `standard` plan. The tier sizes the
ceremony and the review timing to the work; it never changes the order.

| Aspect | `standard` | `critical` |
|---|---|---|
| Spec tests first | Yes — from the acceptance criteria (`AC-n`), before implementation | Yes — from the ST-cases |
| Red check | Inside the spec-test task: run the declared spec file and confirm it fails; no separate task | A distinct red-phase task |
| Green check | Inside the phase's last implementation task: run every declared spec file of the phase and confirm they pass; no separate task | A distinct green-phase task |
| Phase gate | The phase's `**Verify (gate)**` line (or its single `**Verify**` line); no separate gate task | A distinct gate-verification task |
| Implementation tests | Only where an acceptance criterion names an error path or edge case | Edge cases, internals, and error paths |
| Coverage goal | Every acceptance criterion has at least one test; no percentage targets | Every ST-case and acceptance criterion has at least one test; percentage targets only when the plan records them as a decision |
| Independent review | A phase is reviewed when it is risk-tagged or changes 150 or more product lines; otherwise its review is carried forward to the completion review | Every non-trivial phase |

- At `standard` the specification cases are the acceptance criteria: the plan's
  `## Acceptance criteria` rows, guided at 3–8 per phase. Implementation tests only where an
  acceptance criterion names an error path or edge case — never added for coverage.
- A plan without a tier line is `critical`, and so is a plan whose tier line has an unknown value.
- The tier changes **when** a diff is reviewed, never **whether** it is reviewed. The review rules
  live in [quality-profile.md](quality-profile.md).
- Mini-plans keep their own lightweight path; tiers apply to full plans only.
- The immutable-oracle rule below applies at both tiers.

## Why this ordering

| Step | What it prevents |
|------|-----------------|
| Spec tests BEFORE implementation | Deriving test expectations from the code you just wrote |
| Red-phase verification | Meaningless spec tests (they must test something that doesn't exist yet) |
| Spec tests PASS after implementation | An implementation that doesn't satisfy the specification |
| Impl tests AFTER implementation | Nothing — impl tests MAY be derived from the code (edge cases, internals); spec tests may not |

## Enforcement

**🚫 PROHIBITED:**

- ❌ Writing implementation code before specification tests exist for that feature
- ❌ Skipping the spec-test step ("we'll write tests after")
- ❌ Combining spec tests and implementation in one task, or writing them simultaneously
- ❌ Generating a plan where implementation tasks precede spec-test tasks for the same feature

**✅ REQUIRED in every generated `99-execution-plan.md`:** the specification-first order per
feature phase; explicit `[feature].spec.test.[ext]` file references, plus
`[feature].impl.test.[ext]` references wherever implementation tests are planned; references to
the ST-cases from `07-testing-strategy.md` (at `standard`: the plan's `AC-n` rows) in spec-test tasks; and a red check before
implementation — a distinct red-phase verification task at the `critical` tier, inside the
spec-test task at the `standard` tier.

**Immutable-oracle rule:** if the implementation does not match a spec test, the implementation
is wrong — not the test. Never modify a spec test's expectations to match code. (This rule binds
subagent executors too — a delegated task that hits a failing spec test reports a blocker; it
never edits the test.)

## Small features (compressed form)

You MAY compress into a single step, but the ordering is still mandatory. The red phase stays its
own task (N.1.2) at the `critical` tier, and so do the green phase (N.1.4) and the gate
verification (N.1.6). At the `standard` tier the tier adds no separate verification tasks: N.1.1
and N.1.2 are one task (write the specification tests, run the declared spec file, confirm it
fails); the green check (N.1.4) runs inside the phase's last implementation task, which runs every
declared spec file of the phase (implementation itself keeps the plan's normal task sizing and may
span several tasks); N.1.5 is
a task only when the specification names error paths or edge cases to test; and the gate is the
phase's `**Verify (gate)**` line (or its single `**Verify**` line), not a task — also for phases
without specification tests:

```
Step N.1: [Feature Name]
  N.1.1  Write specification tests (from ST-cases)
  N.1.2  Verify spec tests fail (red phase)
  N.1.3  Implement feature
  N.1.4  Verify spec tests pass (green phase)
  N.1.5  Write implementation tests
  N.1.6  Phase/plan gate verification
```

The order `spec tests → red phase → implement → green phase → impl tests → verify` is never
negotiable, whatever the tier or feature size; the tier decides only which steps are separate
tasks. The red phase runs only the declared spec file(s). The
final verification is the phase/plan gate: the full project verify, or the map's release gate.
Per-task verification may use the selected task groups or a validated `**Task verify**` command;
the gate rules, fallback behavior, and evidence contract live in
[test-selection.md](test-selection.md).
