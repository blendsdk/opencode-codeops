# Parser Task Counting: live-task-sidebar (slice 0)

> **Document**: 03-01-parser-task-counting.md
> **Parent**: [Index](00-index.md)
> **File**: `scripts/codeops_plan.py`

## Overview

The parser must count real execution tasks only. This document owns the counting rule; the
execution plan's tasks implement it. Everything else about `scripts/codeops_plan.py` — discovery,
JSON shape, progress bar, lifecycle, `next_task`, problems — is deliberately unchanged (AR #3,
#4).

## Architecture

### Current Architecture

`parse_tasks` matches `^-\s*\[([ xX~!])\]\s+(.+?)\s*$` on the whole document
(`scripts/codeops_plan.py:24,70-72`). Consequences verified by probe:

- `**Deliverables**` checklist entries (`- [ ] Deliverable 1`) count as tasks;
- quoted example lines inside fenced blocks count as tasks;
- `next_task` can return an unchecked deliverable as the resume candidate;
- totals, lifecycle, and downstream roadmap/upgrade judgments inherit the inflation.

### Proposed Changes

`parse_tasks` (same name, same return type `tuple[Task, ...]`) applies three filters in order:

1. **Fence stripping** — exclude every line inside fenced code blocks. A fence opens with ``` or
   ~~~ (up to 3 leading spaces, optional info string) and closes only with the same character at
   length ≥ the opening and nothing else on the line; the other fence character does not close
   it. An unclosed fence strips to end-of-document (safe direction: examples are never counted).
2. **Task-id gate** — a checkbox line is a task only when its content begins with a task id
   after an optional `**` opener. The id is `[0-9]+\.[0-9]+\.[0-9]+` (`N.N.N`) or
   `T-[0-9]+\.[0-9]+` (`T-N.N`), and the next character must be whitespace, `*`, `—`, `–`, `-`,
   or end-of-line. This matches every documented template and every plan in this repository
   (73 `N.N.N` lines, 31 `T-N.N` lines, zero non-id checkbox lines).
3. **First-occurrence dedupe** — when the same id appears again (legacy duplicate presentation),
   only the first occurrence in document order is counted.

The marker vocabulary, `Task(marker, text)` shape, and all downstream logic stay as they are.

### New Types/Interfaces

No new public types. One internal helper is allowed (for example `_task_id(text)` returning the
extracted id or `None`); it is private, documented, and covered by the impl tests.

## Implementation Details

### Counting Rule (normative)

```text
document text
  → strip fenced blocks                 (``` or ~~~, unclosed = to EOF)
  → per line: ^-\s*\[([ xX~!])\]\s+(.+)$
  → content must match ^\s*(?:\*\*)?(N.N.N|T-N.N)(?=[\s*—–-]|$)
  → keep first occurrence per id
  → Task(marker.lower(), text.strip())
```

### Integration Points

- `inspect_plan` and `main` consume `parse_tasks` unchanged; no signature change.
- The skills consume `--json` / `--progress-bar` output unchanged. `codeops_plan_migrate.py`
  imports `parse_tasks` in-process, so its task-presence admission is kept stable separately: the
  "contains no execution tasks" problem is driven by checkbox-line presence (a bare checkbox check,
  shared or mirrored with the parser), not the id-gated task set — an id-less legacy checklist
  therefore does not newly block migration (FR-12; regression test ST-13).
- No change to `discover_plans`, `rd_delivery`, `parse_implements`, or `render_progress`.

## Code Examples

Before → after on the documented template shape:

```markdown
- [ ] 1.1.1 Write specification tests …        → counted
- [ ] 1.1.2 Implement …                        → counted
**Deliverables**:
- [ ] Deliverable 1                            → ignored (no id)
- [ ] All verification passing                 → ignored (no id)
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Unclosed code fence | Strip to end of document; examples are never counted | AR #3 |
| Indented fence (up to 3 leading spaces) | Recognized as a fence; indented checkbox examples are never counted | AR #3 |
| Mismatched or mixed fence characters | Only the same character at length ≥ the opening closes a fence; the other character stays inside | AR #3 |
| Stray closing fence with no opener | Opens a fence (safe direction); the remainder of the document is not counted as tasks | AR #3 |
| Duplicate task id | First occurrence wins; later occurrences ignored | AR #3 |
| Id-like text not followed by a delimiter (`1.1.1.1`) | Not a task; line ignored | AR #3 |
| Plan whose every checkbox line is filtered out | Existing "contains no execution tasks" problem is reported | AR #4 |
| Unreadable plan file | Unchanged from current behavior (outside this slice) | — |

> **Traceability:** the counting rule and its edge behavior reference AR #3; the compatibility
> contract references AR #4.

## Compatibility Contract

- JSON keys and types: unchanged.
- `--progress-bar` string format: unchanged.
- Repository plans: all nine plans keep their exact totals (verified at planning time; pinned by
  a parity test, ST-3).
- Migration admission: unchanged (FR-12) — the migrator's task-presence check stays checkbox-line
  based, so id-less legacy checklists still migrate; pinned by ST-13.
- Third-party plans that used checkbox deliverables gain *correct* (lower) totals — the intended
  fix; recorded in the CHANGELOG (AR #4).

## Testing Requirements

- Unit/spec tests for the counting rule, fence stripping, dedupe, and every marker (ST-1…ST-7).
- A parity test over `plans/*/99-execution-plan.md` comparing parser totals with an independent
  distinct-id count (ST-3).
- A migrator regression test (ST-13): an id-less checklist fixture keeps the migration preview
  clean while the parser reports the corrected (narrowed) set.
- Impl tests for pathological inputs (unclosed fence, CRLF, bold ids, id-like non-delimiters,
  indented and mixed fences) (07-testing-strategy.md §Implementation Tests).
