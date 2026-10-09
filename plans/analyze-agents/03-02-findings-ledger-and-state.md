# Findings Ledger and Check State: analyze-agents (specialist discovery)

> **Document**: 03-02-findings-ledger-and-state.md
> **Parent**: [Index](00-index.md)

## Overview

Two durable records make recurrence evidence and project-level re-evaluation possible: the per-plan
findings ledger, written by `exec-plan`, and the check-state file, written by `analyze-agents`. The
state interface is owned by T-07; this document owns the ledger format and both writers (AR #3,
AR #4, AR #8, AR #9).

## Ledger

### Location

`plans/<plan>/05-findings.md` (flat) or `codeops/features/<f>/plans/<plan>/05-findings.md`
(nested), resolved via `_shared/layout-convention.md` (AR #3, R8).

### Format

A one-line title plus one Markdown table; one row per ruling batch, appended after the batch's
rulings are collected. No prose, no packet text, identifiers and area tokens only:

```markdown
# Findings: <plan name>

| Finding | Phase | Severity | Area | Ruling |
| ------- | ----- | -------- | ---- | ------ |
| RV-001 | 2 | MAJOR | scripts/install_agents.py | fixed |
| SA-002 | 2 | MINOR | scripts/install_agents.py | accepted |
```

- `Finding`: the review finding id (`RV-`/`SA-`/`PE-`/`SR-`).
- `Phase`: the executing phase number.
- `Severity`: `CRITICAL`/`MAJOR`/`MINOR`.
- `Area`: the dominant path or domain token (content-light; AR #14).
- `Ruling`: the outcome (`fixed`, `accepted`, `deferred`, `dismissed`).

### Writer

`exec-plan`'s ruling step (`skills/exec-plan/execution-protocol.md` §Merge findings) appends the
batch's rows after each ruling batch and creates the file lazily on first use. This concretizes
the previously undefined "durable finding artifact" (AR #8). Task mini-plans use the same file in
their own folder; runtime complexity rulings continue to live in the ambiguity register
(unchanged).

## Check State

### Interface (owned by T-07)

```json
{
  "checkedAt": "<ISO-8601 timestamp>",
  "plans": ["<plan folder>", "<plan folder>"]
}
```

- `plans` lists the plan folders present at check time (layout-aware); the T-07 coverage line uses
  it to decide whether a recommendation is due.
- Written by `analyze-agents` at the end of every run — including `None` outcomes (AR #9).
- Absent, unreadable, or malformed state is treated as "never checked" by consumers; the coverage
  line then recommends a run. Fail loud, never silent (AR #9, AR #13).
- The skill writes only this file; it never touches agent files (R7).

## Compatibility

Records are plain text and JSON; no versioning machinery is introduced. Projects without ledgers
produce reduced-signal checks; state records missing expected fields are treated as corrupt, hence
never-checked (AR #13). No other CodeOps flow requires these records to exist; their absence
degrades exactly as described above.

## Testing Requirements

- ST-7 pins the ledger and state conventions in `_shared/specialist-agents.md`.
- ST-8 pins the exec-plan writer instruction and the row format.
- ST-3 and ST-5 pin the state write and the degradation behavior in the skill.
