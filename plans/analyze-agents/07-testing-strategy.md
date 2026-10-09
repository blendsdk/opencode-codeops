# Testing Strategy: analyze-agents (specialist discovery)

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Content contracts (skills, shared docs) | 100% of the ST cases below |
| Executable code | none added by this feature |

- Test names state behavior: `should [expected behavior] when [condition]`.
- This feature adds no executable code beyond tests, so the deterministic oracle is a **content
  spec suite** that pins the repository-visible contracts; the repository already uses this
  pattern (`scripts/reasoning-effort-content.spec.test.mjs`, `scripts/specialist-content.spec.test.mjs`).
- E2E: agent-driven behavior (proposal presentation, state write timing) is not automatable; it is
  covered by one documented live smoke (ST-11).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived from `01-requirements.md`, the `03-XX` specs, and the Ambiguity Register. Immutable
> oracle: a failing case means the content is wrong, never the case.

### Skill contract

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | ---------------- | -------------------------- | ------ |
| ST-1 | Inspect `skills/analyze-agents/SKILL.md` | File exists; frontmatter has `name: analyze-agents` and a description; body documents invocation, evidence reads, detection flow, output, state write, hand-off, and layout-awareness | R1, AR #1, AR #2 |
| ST-2 | Same file | States native reading as a required statement — the skill names its evidence sources and contains no script invocation; no network or dependency use | R2, AR #10 |
| ST-3 | Same file | Requires writing `codeops/specialist-check.json` on every run including `None`; shape `{ checkedAt, plans[] }`; layout-aware plan list | R4, AR #4, AR #9 |
| ST-4 | Same file | Requires at most two candidates in the T-07 lightweight proposal format, or `None` with evidence | R3, AR #2, AR #6 |
| ST-5 | Same file | Documents degradation: missing ledger → reduced-signal note; malformed rows skipped with a note; corrupt state → never checked | R2, AR #13 |
| ST-6 | Same file | Forbids creating/modifying agent files, briefs, routing policy, or AGENTS.md; hands off to `setup-routing` | R7, AR #15 |

### Protocols and wiring

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | ---------------- | -------------------------- | ------ |
| ST-7 | Inspect `_shared/specialist-agents.md` | Defines the ledger location/format/writer and the check-state consumption; names `analyze-agents` as the detection execution surface | R5, R8, AR #8, AR #12 |
| ST-8 | Inspect `skills/exec-plan/execution-protocol.md` | The ruling step writes `plans/<plan>/05-findings.md` rows in the compact format; no remaining undefined "finding artifact" reference | R5, AR #8 |
| ST-9 | Inspect `skills/make-plan/SKILL.md` and `skills/make-requirements/SKILL.md` | Detection steps delegate to the analyze-agents flow; the manual criteria fallback is retained | R6, AR #12 |

### Verification and smoke

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | ---------------- | -------------------------- | ------ |
| ST-10 | Run `npm run verify` | All content spec tests pass; zero regressions | AC #4 |
| ST-11 | Live smoke (manual): scratch repo with two plans whose `05-findings.md` ledgers share one area → run the skill; then an empty repo → run again | First run presents a recurrence-based candidate (or `None` when below threshold) and writes the state file; second run records `None` with evidence and writes state; the T-07 coverage line reads the state as up to date | R3, R4, R9, AR #9, AR #11 |

> **⚠️ AUTHORING RULE:** Expectations come from the specs above. ST-11 is a documented manual
> smoke; if it cannot be run, record that explicitly — never infer its result.

## Test Categories

### Specification Tests (from ST-cases above)

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `scripts/analyze-agents-content.spec.test.mjs` | ST-1 … ST-9 | Skill contract + protocols (assertions over repository content) |

Traceability comments inside the test file quote behavior in plain language (no `ST-`/`AR` ids or
`plans/` paths in code — per the standards' documentation rule).

### Implementation Tests

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| *(N/A)* | No executable code is added; the content spec suite is the deterministic oracle | — |

### Integration Tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| `npm run verify` | All suites | The new content tests run beside every existing suite |

### End-to-End Tests

| Scenario | Steps | Expected Result |
| -------- | ----- | --------------- |
| ST-11 recurrence and None paths | Create fixture plans/ledgers in a scratch repo; run the skill twice (populated, empty) | Candidate or `None` per thresholds; state file written both times |

## Test Data

### Fixtures Needed

- Scratch repositories under `$CODEOPS_TMPDIR` for ST-11 (ST-11 is not automated; fixtures are
  created ad hoc during the smoke).
- In-repo content assertions need no fixtures.

### Mock Requirements

None.

## Verification Checklist

- [ ] All specification test cases (ST-*) defined with concrete input/output pairs
- [ ] Every ST case traces to a requirement, spec doc, or AR entry
- [ ] Specification tests written BEFORE implementation
- [ ] Specification tests verified to FAIL before implementation (red phase)
- [ ] All specification tests pass after implementation (green phase)
- [ ] Implementation tests: N/A recorded with reason (no executable code)
- [ ] All suites pass via `npm run verify`
- [ ] No regressions in existing tests
- [ ] ST-11 live smoke performed and its result recorded
