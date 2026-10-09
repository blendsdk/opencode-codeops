# analyze-agents Skill: analyze-agents (specialist discovery)

> **Document**: 03-01-analyze-agents-skill.md
> **Parent**: [Index](00-index.md)

## Overview

`skills/analyze-agents/SKILL.md` is the manual execution surface for the detection criteria in
`_shared/specialist-agents.md` (AR #12). It reads the repository's own evidence, applies the
criteria natively — no script (AR #10) — presents candidates or a recorded `None`, and maintains
the check-state file consumed by the T-07 coverage line (AR #4).

## Skill Contract

### Invocation

- Frontmatter: `name: analyze-agents` plus a `description` stating when to use it (project-level
  specialist re-evaluation; manual, or recommended by `analyze-project`; AR #1, AR #2).
- Runs in the project root; all paths resolve via `_shared/layout-convention.md` (AR #13, R8).

### Reads (evidence sources)

| Source | Use | AR Ref |
| ------ | --- | ------ |
| `requirements/`, plan documents | domain/lens tags and scope history | AR #11 |
| Per-plan `05-findings.md` ledgers | finding-area recurrence | AR #11 |
| Manifests (`package.json`, `pyproject.toml`, `go.mod`, …) | specialized framework/DSL/codegen signals | AR #11 |
| `codeops/specialists/` and `codeops/codeops.json` | deduplicate against installed specialists | AR #6 |
| `codeops/specialist-check.json` | prior check state | AR #9 |

The skill reads files directly; it invokes no script and needs no dependency (AR #10). An absent
ledger reduces the signal set and the output says so; malformed rows are skipped with a note
(AR #13).

### Detection flow

1. Collect the evidence sources above for the current project (layout-aware).
2. Apply the detection criteria and disqualifiers from `_shared/specialist-agents.md`: a candidate
   needs evidenced strong signal(s) and no disqualifier.
3. Recurrence anchor (R9): one area appearing in ≥2 plans or ≥3 findings ranks as a strong signal;
   thresholds anchor judgment, not hard gates (AR #11).
4. Present at most two candidates in the T-07 lightweight proposal format — role slug, kind,
   one-line capability, evidence (`file:line`), smallest alternative and why it is insufficient —
   or record `None` with evidence (AR #2, AR #6; T-07 owns the format).
5. Write `codeops/specialist-check.json` (03-02 §Check state) on every run, including `None`.
6. On user interest, hand off to `setup-routing` for the reserved-authority creation flow; never
   create or modify agent files, briefs, routing policy, or AGENTS.md (R7).

### Output

- A human summary: `None` with evidence, or ≤2 candidates in the proposal format; plus the state
  write result.
- No JSON output mode (no script; AR #10). The state file is the machine-readable artifact.

## Integration Points

| Counterpart | Interaction | AR Ref |
| ----------- | ----------- | ------ |
| `make-plan`, `make-requirements` | Their detection steps delegate to this flow; the manual criteria remain the fallback when the skill is unavailable | AR #12 |
| `analyze-project` | Reads the state file for the coverage line; recommends running this skill when state is missing or stale (shipped by T-07) | AR #5 |
| `exec-plan` | Writes the findings ledger this skill reads (03-02) | AR #8 |
| `setup-routing` | Receives approved candidates for creation | AR #15 |

## Error Handling

| Error case | Handling strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Missing findings ledger | Reduced-signal note in the output; document/manifest signals only | AR #13 |
| Malformed ledger row | Skip the row with a note; never guess its fields | AR #13 |
| Empty repository (no plans/requirements) | Record `None` with evidence; still write the state file | AR #13 |
| Corrupt or unreadable check state | Treat as "never checked"; overwrite on this run | AR #9 |
| Ledger contains prose instead of rows | Skip with a note; recurrence does not count it | AR #8, AR #13 |

## Testing Requirements

- Content spec tests pin the required sections, the native-read rule (no script), the
  candidate/`None` outputs, the state-write instruction, the hand-off boundary, and
  layout-awareness (ST-1 … ST-6, ST-9).
- Live smoke verifies the state write and the proposal/`None` behavior end to end (ST-10, ST-11).
