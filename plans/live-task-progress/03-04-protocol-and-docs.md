# Protocol and Docs: live-task-progress

> **Document**: 03-04-protocol-and-docs.md
> **Parent**: [Index](00-index.md)
> **Files**: `skills/exec-plan/SKILL.md`, `skills/exec-plan/execution-protocol.md`, `README.md`, `CHANGELOG.md`

## Overview

The reporting protocol the agent follows (R8) and the user-facing documentation the feature
ships with (register rows 2, 3; note H). Both edits are text-only and carry the same authority
statement: the Markdown execution plan remains the single progress source of truth and the live
view never gates execution.

## Protocol (R8 — register note H)

### `skills/exec-plan/execution-protocol.md`

Add one section, **Progress Reporting (fail-soft)**, next to the Real-Time Execution Plan Update
Mandate. Content contract:

- The authority statement: reporting is an observability aid; the Markdown marks remain the
  single progress source of truth; a missing tool or a failed call never blocks, delays, or
  changes any verify, commit, or plan update — when the tool is unavailable, execution proceeds
  silently.
- One table of the ten call points:

| Moment | Report payload (`plan` and `activity` are always present; absent optional fields are carried by the state) |
| ------ | -------------------------------------------------------- |
| Run start (start point determined) | `{ plan, phase, task, activity: "implementing" }` |
| Phase start (subsequent phases) | `{ plan, phase, activity: "starting" }` |
| Task implemented (after the `[~]` mark) | `{ plan, task, activity: "implementing" }` |
| Verification (before running verify) | `{ plan, activity: "verifying" }` |
| Task verified (after `[x]` + the progress-bar display) | `{ plan, verified, total, activity: "implementing" }` — counts from that display |
| Blocker (after the `[!]` mark) | `{ plan, activity: "blocked", detail: "<short reason>" }` |
| Delegation (around an executor/reviewer dispatch) | `{ plan, activity: "delegating", detail: "<role>" }` |
| Review step (post-phase quality loop) | `{ plan, activity: "reviewing" }` |
| Waiting (before pausing for an explicit user decision) | `{ plan, activity: "waiting" }` |
| Run done (all tasks complete) | `{ plan, activity: "done" }` |

- The tool name is `codeops_progress`; `plan` is the plan folder name; every call carries
  `plan` and `activity`; one call per listed moment, no other calls (noise control).

### `skills/exec-plan/SKILL.md`

Add one short bullet in the per-task loop (Step 2): report progress — when the
`codeops_progress` tool is available — at the transition points in execution-protocol.md
§Progress Reporting; a failed or missing report never blocks any step.

## Docs (register rows 2, 3)

### `README.md`

Add a short section, **Live task progress in the sidebar**, under the plugin-behavior area:
what the sidebar shows while an exec-plan run is active (plan, phase, task, activity, verified
counts), the honesty rules (always-visible as-of time, stale marker at 10 minutes without an
update, nothing rendered when no run is active or the host lacks the plugin APIs), and the
source-of-truth statement. Target length: ~10 lines.

### `CHANGELOG.md`

- Add an `### Added` subsection under `## Unreleased`: one bullet describing the live sidebar
  feature — the `codeops_progress` tool, the live run state with RPC event push, and the
  sidebar view with honest as-of staleness.
- Revise the existing `### Notes` foundation entry so it no longer describes the replaced
  version strip; keep the verified-on-v2.0.26 `./tui` entry facts (register row 2; 03-03
  §Superseding).
- No release, tag, or version change (user-owned; 01 §Won't Have).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| The agent skips a call or the tool is missing | Fail-soft wording in both files; the view shows as-of staleness | Register notes D, H |
| Protocol edits drift from execution-protocol.md's structure | ST-19/ST-20 assert the section and wording; the wording cites the section by name | Register note H |

> **Traceability:** protocol points, docs scope, and fail-soft wording reference the register
> entries above.

## Testing Requirements

- Spec tests ST-19…ST-21 in `scripts/exec-plan-progress-content.spec.test.mjs` (07): the ten reporting
  points and the tool name; the fail-soft and authority wording; the README/CHANGELOG content.
- No implementation test file: the change is text; the spec suite is the complete oracle.
