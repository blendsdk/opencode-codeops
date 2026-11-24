# Compaction Note: Right-Sized Verification (Wave 1)

> **Document**: 03-05-compaction-note.md
> **Parent**: [Index](00-index.md)

## Overview

When a session that owns the active CodeOps run is compacted, the compaction request carries a
short note so the summary keeps the run's place and the agent re-reads the plan instead of trusting
memory (AR-22).

## New function — `bin/lib/codeops-progress.mjs` (+ declaration in `codeops-progress.d.mts`)

```ts
/**
 * Build the compaction note for a session, or null when it owns no unfinished run.
 * @param snapshot - The current run snapshot, or null.
 * @param sessionID - The session being compacted.
 * @returns The note text (≤400 characters) or null.
 */
export function buildCompactionNote(
  snapshot: CodeOpsRunState | null,
  sessionID: string,
): string | null
```

Returns `null` when `snapshot` is `null`, `snapshot.sessionID !== sessionID`, or
`snapshot.activity === "done"`. There is no staleness check: long verify or review steps report
no progress, and those are when compaction happens (PF-011). Otherwise returns exactly:

```text
CodeOps run in progress — plan "<plan>", phase "<phase>", task "<task>". After compaction, re-read the plan's 99-execution-plan.md and 05-findings.md (plans/ or codeops/features/*/plans/); trust them over memory.
```

(One line; 373 characters with three 60-character values.)

Each value is sanitized (PF-019): control characters and line breaks become single spaces, runs of
whitespace collapse to one space, `"` becomes `'`, and the result is truncated to 60 characters.
A null `phase` or `task` renders as `—`. The whole note never exceeds 400 characters.

## Plugin change — `plugin/index.ts`

In the existing `compaction` hook (`:308-310`), after pushing the standards, call
`buildCompactionNote(progress.snapshot(), event.sessionID)` inside `try/catch` and push the note
as one more system text part when it is non-null; on failure, warn content-free like the other
hooks.

## Skill change — `skills/exec-plan/SKILL.md`

Resume rules gain one sentence: after a context compaction, re-read `99-execution-plan.md` and
`05-findings.md` before the next action.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| No run / other session's run / finished run | No note | AR-22 |
| Helper throws | Standards already pushed; content-free warning | AR-22 |
