# Requirements: live-task-progress

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

The full live CodeOps task-progress feature (slice 2 of the staged feature; the foundation is
`plans/live-task-sidebar/`). While an `exec-plan` run is active in a project, the OpenCode v2
terminal sidebar shows which plan is running, which phase and task is active, what the agent is
doing, and how many tasks have passed verification. Progress reaches the sidebar as explicit
agent reports through a new tool, a per-location run state in the server plugin, and live RPC
events — the execution plan file stays the durable source of truth and the sidebar is a live
view (register rows 1–3, notes A–D).

## Functional Requirements

### Must Have

- [ ] **R1 — Progress tool.** A server-registered tool `codeops_progress` lets the agent report
      run/phase/task transitions with an activity and optional counts; inputs are schema-validated
      and normalized; a report never blocks or gates execution.
- [ ] **R2 — Server live state.** The plugin keeps an in-memory run state per project location
      (plan, phase, task, activity, detail, verified/total, timestamps, owning session); the
      execution plan file remains the durable progress source of truth (register note B).
- [ ] **R3 — Push updates.** Every accepted report updates the state and emits a `codeops` RPC
      event; clients subscribe live; a snapshot method serves the initial state. No polling,
      timers, watchers, or persistence (register notes A, C).
- [ ] **R4 — Sidebar view.** The TUI `sidebar.content` section renders the live run using the
      shared display lines and replaces the foundation's version strip; the call and the event
      subscription are scoped to the session's location; the section renders nothing when no run
      is known or the APIs are unavailable (register rows 2, notes C–D).
- [ ] **R5 — Honesty.** Only reported values are shown; the view always shows the last-update
      time; a staleness marker is shown whenever the view renders with a last update 10 minutes old
      or older (no timers — it refreshes on the next render); blocked and
      waiting are explicit; verified counts never include unverified tasks; nothing is claimed
      when nothing is known (register rows 2, note D).
- [ ] **R6 — Server-side data path.** The sidebar obtains all data from the server plugin via the
      RPC/event surface; no file is read in the TUI; the plan file remains the single progress
      source of truth.
- [ ] **R7 — Delegation visibility.** Delegating and reviewing activities are visible, with the
      delegated role shown from the report's detail (register rows 1, note H).
- [ ] **R8 — Exec-plan integration.** `skills/exec-plan` reports at the defined transition points
      and documents reporting as fail-soft; the Markdown execution plan remains the progress
      authority and the live view never gates execution (register note H).
- [ ] **R9 — Containment.** On host builds without the new APIs, the plugin, the skills, and the
      TUI behave exactly as today; nothing throws; the sidebar stays hidden (register note F).
- [ ] **R10 — Live verification.** Unit, content, and fake-context tests plus a pty live smoke
      (tool registration, event round-trip, agent-driven call, render path), a remote-client
      acceptance run, and a user-assisted sidebar check; `npm run verify` green throughout
      (register note E, rows 2 and 14).

### Won't Have (Out of Scope)

- Subagent-side progress reporting through agent templates — explicitly deferred (register row
  15: owner user; revisit when multi-agent runs need finer delegation detail or reviews show
  parent-only reporting is insufficient).
- Persisted run history or retention beyond the process lifetime (register note A).
- Multiple simultaneous runs displayed at once; per-session views (register note B).
- Progress reporting from flows other than `exec-plan` (make-plan, roadmap, setup skills).
- Plan-file watching, polling, or server-side plan parsing (register note A rejected options).
- New dependencies, a committed smoke harness, a configuration surface, release, or publish
  (release remains user-owned; foundation boundary).

## Technical Requirements

### Performance

- One tool call per transition point in the exec-plan protocol; no polling, timers, or watchers
  anywhere in the feature (R3, register note A).
- Event payloads carry the full snapshot for idempotent, reorder-safe merging (register note C).

### Compatibility

- OpenCode v2 only; the tested minimum build is recorded from the live smoke (foundation: v2.0.26).
- Every new host API is feature-detected and contained (R9); the existing `codeops.status` RPC
  and `requestStatus` keep working unchanged; the foundation suites keep passing, with the two
  recorded, user-approved assertion evolutions (the impl test's definition shape in Phase 1; the
  spec test's strip assertions in Phase 3).
- The package's exports, dependency declarations, and packaged `files` patterns do not change;
  the new helper files ship through the existing `bin/` inclusion, like `reasoning-effort.mjs`.

### Security

- Tool inputs are host-validated against the JSON Schema and additionally normalized
  (strings trimmed and truncated at 200 characters; counts clamped); the tool reads no files.
- Event payloads carry progress metadata only — plan folder name, phase/task labels, activity,
  detail, counts, timestamps — never file contents, prompts, or absolute paths beyond the plan
  folder name; events are location-tagged and filtered per location by the view (register
  note G).
- No database, HTML, shell, or filesystem surface exists in this feature: the plugin reads no
  file, runs no command, and the TUI renders plain text nodes only (register note G).

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| Pillar set | a–d + f / a–d only / all a–f | a–d + f | User decision — the delegation display and the remote acceptance run ship; agent-template self-reporting is deferred | Register row 1, row 15 |
| Presentation | three-line draft / single line / adjustment | three-line draft | User decision — compact, complete, honest | Register row 2 |
| README | short section / CHANGELOG only | short section | User decision — the feature completes the plugin's visible surface | Register row 3 |
| Update mechanism | tool + in-memory state + RPC events / file watch or poll / file signaling / persistence | tool + state + events | Delegated — documented APIs, no new machinery, live-proven round-trip | Register note A |
| State ownership | one run per location, last reporter owns / per-session map / persisted | one run per location | Delegated — matches the recorded single-run protocol; simplest truthful view | Register note B |
| Tool/RPC contracts | JSON Schema + shared helper module / Standard Schema / separate RPC id | JSON Schema + shared helper | Delegated — keeps the definition runtime-free and Node-testable (foundation pattern) | Register note C |

> **Traceability:** every scope decision references the Ambiguity Register entry that resolved
> it; all other design decisions carry AR back-references in the owning `03-XX` documents.

## Acceptance Criteria

1. [ ] Quick Reference example renders in the sidebar during a run: plan, phase, activity, task,
       counts, and as-of time (R4, R5; smoke ST-22).
2. [ ] All specification test cases ST-1…ST-21 pass; implementation tests pass; `npm run verify`
       passes (R10).
3. [ ] Live smoke ST-22 records: tool registration, event round-trip, the agent-driven
       `codeops_progress` call, the render path, and the tested OpenCode build; a missing
       sidebar paint is attributed by layer or handed to the user-assisted check (R10).
4. [ ] Remote-client acceptance ST-23 records the outcome of the `opencode serve` + `--server`
       run, or the named limitation with the probe-method boundary respected (R10, register
       note E).
5. [ ] Containment proven: setup completes and reports fail-soft without the new APIs (R9;
       ST-12…ST-15).
6. [ ] `CHANGELOG.md` carries the `## Unreleased` entry; the README section exists; no release
       was performed (R8; ST-21).
7. [ ] The deferred agent-template integration (row 15) appears in no executable artifact.
8. [ ] Code reviewed per the repository's quality flow; no dead code; documentation standards
       met.
