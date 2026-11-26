# Plan Document Templates

Read this when writing the Phase 2 documents. Create files in `plans/<feature-name>/`. Stamp `00-index.md` and `99-execution-plan.md` with `> **CodeOps Artifact Schema**: 1`. Every `[Date]` / `[YYYY-MM-DD HH:MM]` placeholder is filled from `date '+%Y-%m-%d %H:%M'` — never an invented timestamp.

Folder layout:

```
plans/<feature-name>/
├── 00-ambiguity-register.md   # see zero-ambiguity-gate.md for this file's template
├── 00-index.md
├── 01-requirements.md
├── 02-current-state.md
├── 03-XX-<component>.md        # one or more, per component
├── 07-testing-strategy.md
└── 99-execution-plan.md
```

A `standard`-tier plan is one document instead — see the next section.

---

## Standard single-document plan

At the `standard` tier make-plan writes only `plans/<feature-name>/99-execution-plan.md` (nested:
`codeops/features/<f>/plans/<plan>/99-execution-plan.md`). It owns everything the 00–07 set would:
the goal, the decisions, the acceptance criteria (which are the spec cases), and the tasks. Cite
`D-n` and `AC-n` instead of `AR-n` and `ST-n`; restate nothing.

```markdown
# Plan: [Feature Name]

> **CodeOps Artifact Schema**: 1
> **Implements**: [RD-NN | <feature>/RD-NN | REQ-…]
> **Verification tier**: standard — [one-line reason]
> **Progress**: 0/[N] tasks (0%)
> **Last Updated**: [YYYY-MM-DD HH:MM]
> **Specialist check**: [None — evidence | candidate names]

## Goal

[The requested outcome in two or three sentences.]

**Smallest viable design:** [the direct solution, reusing named existing patterns]

**Out of scope:** [what this plan deliberately leaves out]

## Decisions

| # | Decision | Answer | Source |
|---|---|---|---|
| D-1 | [the question] | [the answer] | User, [date] \| recommended, accepted [date] |

Runtime ambiguities are added as `(runtime)` rows; a complexity approval carries the full approval
evidence from the shared gate. A deferral names what is deferred and who approved it.

## Acceptance criteria

| # | Given / when | Then | Phase |
|---|---|---|---|
| AC-1 | [input or situation] | [observable result] | 1 |

Each AC is a specification test case (3–8 per phase). Error paths and edge cases appear here only
when the user or the requirement names them.

## Tasks

### Phase 1 — [Name]

> **Verify (gate)**: `[project verify command]`

- [ ] 1.1.1 Write the spec tests for AC-1..AC-3 in `[feature].spec.test.[ext]` and confirm they fail
- [ ] 1.1.2 Implement [component] — [file(s)]; D-2
- [ ] 1.1.3 Implement [component] — [file(s)]; run the phase's spec tests and confirm they pass
```

The execution-rules block, the Review and Verification balance phase-header lines, and the
task-size rules are the same as in the `99-execution-plan.md` template below.

---

## Reference, don't restate (NON-NEGOTIABLE)

Every behavioral fact, decision, or specification lives in exactly ONE owning document:

| Fact type | Owning doc |
|-----------|-----------|
| Requirement / scope decision | the RD (when the plan implements one), else `01-requirements.md` |
| Original goal and smallest viable design | `00-index.md` |
| Design / architecture / signatures / error handling | the governing `03-XX` doc |
| Expected test behavior (input→output) | `07-testing-strategy.md` (ST-cases) |
| Resolved ambiguity | `00-ambiguity-register.md` (AR entries) |

Every other document CITES the owner — `ST-4..ST-7`, `03-01 §Parsing`, `AR-12` — with at most a
**one-line gloss** for readability. Prohibited: copying acceptance detail into execution tasks,
re-deriving an RD inside plan documents, and **audit/traceability tables that restate AR or ST
content** (cite the numbers; the register/strategy doc IS the table). Execution-plan task lines
name the action + target file + citations; the executor reads the owning doc (or is handed the
excerpt at dispatch time — excerpting for a handoff packet is not restatement).

---

## 00-index.md — Index and Overview

```markdown
# [Feature Name] Implementation Plan

> **Feature**: [Brief description]
> **Status**: Planning Complete
> **Created**: [Date]
> **Implements**: RD-NN, RD-NN   (one or more RD identifiers; feature-qualify in nested layout)
> **Verification tier**: [standard|critical] — [one-line reason; see `../../_shared/spec-first-ordering.md` §Verification tiers]
> **CodeOps Artifact Schema**: 1

## Overview

[2-3 paragraph description of what this feature does and why it's needed]

## Minimum-Sufficient Baseline

**Original goal:** [The requested outcome in one or two sentences]
**Smallest viable design:** [The direct solution and existing patterns it reuses]
**Excluded machinery:** [Only larger support surfaces actually considered, or `None`]
**Approved complexity:** [AR references, or `None`]

## Planning Coverage

> Copied from the plan register after Phase 1C. Omit this section when the run used
> `--no-coverage-hunt`; record `**Coverage:** disabled — --no-coverage-hunt` in the overview
> instead.

> **Coverage**: <completed>/<total> clusters · <examined>/12 categories · <N> candidates · <M> residual limits · Effort: <requested→applied> · Independence: <mixed-model|mixed-effort|uniform-effort>
> **Freshness**: Coverage as of <date>; artifacts <list>

| Cluster | Area | Examined | Not examined / limit | Candidates | Notes / limit | Confidence |
|---------|------|----------|----------------------|------------|---------------|------------|
| ... | ... | ... | ... | ... | ... | ... |

**Source note:** merged `CV-*` IDs and `DQ-*` keys per register row, or “none.”

## Document Index

| #   | Document                                       | Description                                 |
| --- | ---------------------------------------------- | ------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (audit trail) |
| 00  | [Index](00-index.md)                           | This document — overview and navigation     |
| 01  | [Requirements](01-requirements.md)             | Feature requirements and scope              |
| 02  | [Current State](02-current-state.md)           | Analysis of current implementation          |
| 03  | [Component Name](03-component.md)              | Technical specification                     |
| ... | ...                                            | ...                                         |
| 07  | [Testing Strategy](07-testing-strategy.md)     | Test cases and verification                 |
| 99  | [Execution Plan](99-execution-plan.md)         | Phases, sessions, and task checklist        |

## Quick Reference

### Usage Examples

[Code examples showing the feature in use]

### Key Decisions

| Decision     | Outcome   |
| ------------ | --------- |
| [Decision 1] | [Outcome] |

## Specialist Agents

| Role | Kind | Use | AR Ref |
| ---- | ---- | --- | ------ |
| [role] | [reviewer/executor] | [phase or use] | [AR ref] |

[Or: `**None**` — the capability-gap check found no gap a standing specialist would close.]

_Detection evidence: [repository facts with `file:line`, or the negative-check evidence]_

## Related Files

[List of key files that will be created or modified]
```

---

## 01-requirements.md — Requirements and Scope

Two variants — pick by whether the plan implements an RD (per "Reference, don't restate").

### RD-based plans — thin delta form

When the plan implements an RD, the RD is the OWNING requirements doc and `01-requirements.md`
is a delta view only — never a restatement:

```markdown
# Requirements: [Feature Name]

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-XX](../../requirements/RD-XX-feature-name.md) — the OWNING requirements doc

## Scope of this plan (delta view)

### In this plan
- RD-XX R1, R3–R5 [one-line gloss each]

### Deferred / out of this plan
- RD-XX R2 [why]

## Plan-local decisions

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| [Only decisions NOT already in the RD] | [Outcome] | AR #X |

## Acceptance Criteria

[Only plan-local criteria; the RD owns its own acceptance criteria]
```

### Standalone plans — full form

With no RD upstream, `01-requirements.md` IS the owning requirements doc:

```markdown
# Requirements: [Feature Name]

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

[Detailed description of the feature]

## Functional Requirements

### Must Have
- [ ] Requirement 1

### Should Have
- [ ] Requirement 1

### Won't Have (Out of Scope)
- Exclusion 1

## Technical Requirements

### Performance
- [Performance requirements]

### Compatibility
- [Compatibility requirements]

### Security
- [Security requirements]

## Scope Decisions

| Decision   | Options Considered | Chosen | Rationale | AR Ref |
| ---------- | ------------------ | ------ | --------- | ------ |
| [Decision] | A, B, C            | B      | [Why]     | AR #X  |

> **Traceability:** Every scope decision must reference the Ambiguity Register entry (AR #) that resolved it. See `00-ambiguity-register.md`.

## Acceptance Criteria

1. [ ] Criterion 1
2. [ ] All tests pass
3. [ ] Documentation updated
```

---

## 02-current-state.md — Current State Analysis

```markdown
# Current State: [Feature Name]

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists
[Description of current relevant code]

### Relevant Files

| File           | Purpose   | Changes Needed |
| -------------- | --------- | -------------- |
| `path/to/file` | [Purpose] | [Changes]      |

### Code Analysis
[Key code snippets and analysis]

## Gaps Identified

### Gap 1: [Name]
**Current Behavior:** [What happens now]
**Required Behavior:** [What should happen]
**Fix Required:** [What needs to change]

## Dependencies

### Internal Dependencies
- [List internal dependencies]

### External Dependencies
- [List external dependencies]

## Risks and Concerns

| Risk   | Likelihood   | Impact       | Mitigation |
| ------ | ------------ | ------------ | ---------- |
| [Risk] | High/Med/Low | High/Med/Low | [Strategy] |
```

---

## 03-XX-[component].md — Component Technical Specification

```markdown
# [Component Name]: [Feature Name]

> **Document**: 03-[component].md
> **Parent**: [Index](00-index.md)

## Overview
[What this component does and why]

## Architecture

### Current Architecture
[Describe current state]

### Proposed Changes
[Describe what changes]

## Implementation Details

### New Types/Interfaces
[Type definitions — use the project's language]

### New Functions/Methods
[Function signatures with documentation]

### Integration Points
[How this connects to other components]

## Code Examples

### Example 1: [Name]
[Code example]

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| [Error]    | [Strategy]        | AR #X  |

> **Traceability:** Every error-handling strategy and design choice must reference the Ambiguity Register entry (AR #) that resolved it. See `00-ambiguity-register.md`. Only exceptions: universally obvious facts and zero-semantic-impact formatting.

## Testing Requirements
- Unit tests for [specific functionality]
- Integration tests for [interactions]
```

**Component document sizing:** one `03-XX-[component].md` per major component, or split into `03-XX-[component]-[sub].md` per sub-component. Keep each document manageable to author (aim well under ~30K tokens to write).

---

## 07-testing-strategy.md — Testing Strategy

```markdown
# Testing Strategy: [Feature Name]

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Every ST-case and acceptance criterion has at least one test. Do not set percentage coverage
  targets by default; at the `critical` tier a plan may record percentage targets as an AR
  decision.
- Test names state behavior: `should [expected behavior] when [condition]`.
- Integration tests cover key workflows when applicable. E2E tests cover complete feature behavior
  when feasible; otherwise record `N/A` and the concrete reason instead of building a new harness.

## Test Slices & Groups (optional)

> Fill this table when the project has a test map (`codeops/test-map.json` or
> `codeops/test-map/`) or when the plan records a validated `**Task verify**` scoped command.
> For a map-less project with no scoped command, write `N/A — full verify only` and keep the
> existing plan shape.

| Slice | Tier | Test Files | Sources | Depends On | Gate |
| ----- | ---- | ---------- | ------- | ---------- | ---- |
| [slice] | task | [paths] | [paths] | [slice/group] | task |
| [slice] | release | [paths] | [paths] | [task group] | release |

Every slice needs a task-tier test. Every slice needs a release or acceptance group, or a
recorded manual/external/N/A acceptance reason.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> These test cases are derived EXCLUSIVELY from requirements (`01-requirements.md`),
> component specs (`03-XX-*.md`), API contracts, RFCs, and the Ambiguity Register
> (`00-ambiguity-register.md`). They define expected behavior BEFORE any implementation exists.
>
> **IMMUTABLE ORACLE RULE:** Do NOT modify these expectations to match the implementation.
> If the implementation does not match a spec test case, the implementation is wrong — not the test.
>
> **Every spec test case MUST include a source reference** tracing it to the requirement,
> spec document, or AR entry that defines the expected behavior.
>
> The `Source` column lives **in this plan document** — it is not a code comment. When the
> executor turns an ST-case into a `.spec.test` file, the test's in-code traceability comment
> quotes the behavior in **plain language** (e.g. `// password must be at least 8 characters`),
> **never** the `Source` cell's `ST-`/`Req`/`AR #` id or a `requirements/` path — per the
> standards' Documentation ban (the planning folder is ephemeral; the test must stand alone).

### [Component/Feature 1]

| #    | Input / Scenario           | Expected Output / Behavior             | Source            |
|------|----------------------------|----------------------------------------|-------------------|
| ST-1 | [Concrete input or action] | [Concrete expected output or behavior] | [Req X.X / AR #X] |
| ST-2 | [Concrete input or action] | [Concrete expected output or behavior] | [Req X.X / AR #X] |
| ST-3 | [Error/edge scenario]      | [Expected error type and message]      | [Req X.X / AR #X] |

> **⚠️ AUTHORING RULE:** Derive expectations from the specification documents above. Do NOT
> imagine or infer what the implementation will produce. If the expected output cannot be
> determined from the spec, that is an ambiguity — add it to the Ambiguity Register and
> resolve it with the user before defining the test case.
>
> In a repo with an active quality profile these ST-case rows are excerpted **verbatim** into
> the spec-test-author agent's packet — excerpting is packeting, not restatement, so keep each
> row self-contained.

## Test Categories

### Specification Tests (from ST-cases above)
> Written BEFORE implementation. Filed as `[feature].spec.test.[ext]`.

| Test File                   | ST Cases Covered | Component     |
| --------------------------- | ---------------- | ------------- |
| `[feature].spec.test.[ext]` | ST-1, ST-2, ST-3 | [Component 1] |

### Implementation Tests (edge cases, internals)
> Written AFTER implementation. Filed as `[feature].impl.test.[ext]`.

| Test File                   | Description                                       | Priority     |
| --------------------------- | ------------------------------------------------- | ------------ |
| `[feature].impl.test.[ext]` | [Edge cases, boundary conditions, internal logic] | High/Med/Low |

### Integration Tests

| Test        | Components   | Description   |
| ----------- | ------------ | ------------- |
| [Test name] | [Components] | [Description] |

### End-to-End Tests

| Scenario   | Steps   | Expected Result |
| ---------- | ------- | --------------- |
| [Scenario] | [Steps] | [Result]        |

## Test Data

### Fixtures Needed
[List test fixtures]

### Mock Requirements
[List any mocks needed — prefer real objects when possible]

## Verification Checklist
- [ ] All specification test cases (ST-*) defined with concrete input/output pairs
- [ ] Every ST case traces to a requirement, spec doc, or AR entry
- [ ] Specification tests written BEFORE implementation
- [ ] Specification tests verified to FAIL before implementation (red phase)
- [ ] All specification tests pass after implementation (green phase)
- [ ] Implementation tests written (at the `standard` tier: only the error paths and edge cases the specification names)
- [ ] All unit / integration / E2E tests pass
- [ ] No regressions in existing tests
- [ ] Test coverage meets goals
```

---

## 99-execution-plan.md — Execution Plan

Every execution plan MUST follow this template, MUST carry each phase's tasks as a single
checkbox list (the plan's **single source of truth** for progress — a task line appears exactly
once in the document), and MUST structure feature phases with the specification-first ordering
(see the next section).

````markdown
# Execution Plan: [Feature Name]

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: [YYYY-MM-DD HH:MM]
> **Progress**: 0/X tasks (0%)
> **CodeOps Artifact Schema**: 1

## Overview

[Brief description of the feature implementation]

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title          | Tasks |
| ----- | -------------- | ----- |
| 1     | [Phase 1 Name] | X     |
| 2     | [Phase 2 Name] | X     |

**Total: X tasks across Y phases** (no fabricated hour estimates — scope is bounded by the
task-size criteria in [quality-checklist.md](quality-checklist.md))

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for
> progress. Every task line appears exactly once in this document. The executing agent MUST:
>
> 1. **Record every transition with one call** — `codeops_plan.py mark --plan <this plan's
>    folder> --task <id> --state implemented` on implementation (`[~]`), `--state done` on verify
>    pass (`[x]`), `--state blocked --note "<short reason>"` on a blocker (`[!]`). `mark` writes
>    the timestamped status suffix, refreshes the Progress header and Last Updated stamp (only
>    `[x]` counts as complete), and prints the progress bar — never batch or hand-edit updates.
> 2. **Resume** by scanning the phase sections top-to-bottom: the first `[~]` task is resumed
>    first, else the first `[ ]` task. The plan lifecycle is `Ready`, `Executing`, `Done`, or
>    `Blocked`, derived from these markers.
>
> Failure to keep the marks current means progress is invisible after crashes, context resets, or
> session handoffs.

---

## Phase 1: [Phase Name]

> **Phase baseline tree**: _(recorded by the exec-plan skill from a temporary-index snapshot of
> committed, staged, unstaged, and untracked phase-start state)_
> **Review**: _(recorded by the exec-plan skill: `reviewed <YYYY-MM-DD HH:MM>` or `carried forward`)_
> **Verification balance**: _(recorded by the exec-plan skill: `<T> test / <P> product lines (<R>:1)`)_
> **Lenses**: [add-on lenses — include this line only when the target repo carries a quality
> profile; informational: activation stays profile-driven]
> **Reasoning**: [advisory level — `low`, `medium`, `high`, `xhigh`, or `max`, with a one-line
> reason; adversarial or high-risk phases suggest `xhigh`, and `max` is explicit-only (the
> verified DeepSeek `xhigh→max` mapping is the one exception); derivation
> in `../../_shared/reasoning-effort.md` §Plan suggestion derivation]

### Step 1.1: [Step Objective]

**Reference**: [Governing 03-doc §section] · [AR #s]
**Objective**: [What this step achieves]

- [ ] 1.1.1 [spec-author] Write specification tests from the 07 ST-cases — `[feature].spec.test.[ext]`
- [ ] 1.1.2 [Task description] — `path/to/file`

> Mark spec-test tasks with `[spec-author]`: in a repo with an active quality profile, the
> exec-plan skill dispatches the spec-test-author agent for them (packet per
> `_shared/quality-profile.md`); without a profile the marker is inert and the session writes
> the tests itself.

**Deliverables**:
- [ ] Deliverable 1
- [ ] All verification passing

**Test slices**: [optional — slice/tier summary, or `N/A — full verify only`]
**Task verify**: [optional validated scoped command and observed test count, or omit]
**Verify (gate)**: [full project verify command from AGENTS.md / detected conventions]
**Verify**: [legacy alias — same as the gate command when only one line is used]

---

## Dependencies

```
Phase 1
    ↓
Phase 2
    ↓
...
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ All verification passing (project's verify command)
3. ✅ No warnings/errors
4. ✅ No dead code — no unused parameters, functions, classes, or modules
5. ✅ Security hardened — input validation, injection prevention, auth, rate limiting, data protection
6. ✅ Documentation updated
7. ✅ Code reviewed (if applicable)
8. ✅ Post-completion project re-analysis (handled by the exec-plan skill)
````

> Detailed session-by-session execution mechanics (commit modes, real-time progress updates, post-completion re-analysis) belong to the **exec-plan skill**, not here.

---

## Specification-First Task Ordering (NON-NEGOTIABLE)

Every feature implementation phase in `99-execution-plan.md` MUST follow the specification-first
ordering — `spec tests → red phase → implement → green phase → impl tests → verify` — defined ONCE
in **[../../_shared/spec-first-ordering.md](../../_shared/spec-first-ordering.md)**. Read it before
authoring the execution plan; it carries the step structure, the verification tiers, the
compressed small-feature form, the prohibited/required lists, and the immutable-oracle rule.
Generated plans must reference `07-testing-strategy.md` ST-cases in spec-test tasks. The red phase
is a distinct verification task at the `critical` tier; at the `standard` tier it runs inside the
spec-test task, the green check runs inside the phase's last implementation task, and the phase's
`**Verify (gate)**` line (or its single `**Verify**` line) is the gate — no separate green-phase or
gate-verification task.

---

## Adapting to Project Type

Adapt the component documents to the project type:

| Project Type       | Typical Components                             |
| ------------------ | ---------------------------------------------- |
| **Web App**        | Frontend, Backend, API, Database, Auth         |
| **API / Backend**  | Endpoints, Services, Data Models, Validation   |
| **Library / SDK**  | Core, Utils, Types, Public API                 |
| **CLI Tool**       | Commands, Arguments, Output, Config            |
| **UI Components**  | Component, Styles, Hooks, Stories, Tests       |
| **Mobile App**     | UI, State, Services, Navigation                |
| **Compiler**       | Lexer, Parser, Analyzer, Generator             |
| **Microservices**  | Services, Events, Data, Integration            |
| **Infrastructure** | Docker, Nginx, CI/CD, Deployment Scripts       |
| **Database**       | Schema/Migration, Repository, Service, Tests   |
| **Bug Fix**        | Root cause analysis, Fix, Regression test      |
| **Refactoring**    | Current state, New structure, Migration, Tests |

These are analysis lenses, not a required document count. Combine concerns when one clear,
reviewable component specification can own them.
