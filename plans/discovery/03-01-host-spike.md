# Host Spike: discovery

> **Document**: 03-01-host-spike.md
> **Parent**: [Index](00-index.md)

## Overview

Six host behaviours the design relies on are not documented or not verified (02 §Host API
Evidence). Phase 1 proves them with a throwaway probe before any feature code exists. Nothing from
the spike is committed; the outcomes and the selected fallbacks are recorded as a note in the
execution plan's Phase 1 (AR-19).

## Assumptions

| ID | Assumption | Consumer | Fallback when it fails (AR-19) |
| --- | --- | --- | --- |
| A | `ctx.session.prompt({ sessionID, text, delivery: "queue" })` admitted to an **idle** session starts an agent turn; on a **busy** session it runs after the current turn | 03-05 §Waking and delivery | The answers tool waits until Submit (03-05 §Fallback A); no waker |
| B | Two plugin instances (two project directories) in one OpenCode process see the same `globalThis[Symbol.for("opencode-codeops.discovery")]` object | 03-04 §Runtime API | One listener per plugin instance on an OS-assigned port; the projects page lists only that project (03-04 §Fallback B) |
| C | A plugin tool's `execute` runs in the instance whose `ctx.location.directory` is the calling session's directory, and the tool list is per instance: a session in a non-opted-in project sees no `codeops_discovery_*` tool | 03-05 §Tools, §Opt-in check | Resolve the project from `ctx.session.get({sessionID}).location.directory` in every handler and record the opt-in visibility limitation; reopen AR-15 and AR-22 only if a session cannot be mapped to a directory |
| D | After the terminal UI exits, the background service keeps running and the listener keeps answering | README limitations | Documented only |
| E | `ctx.tool.reload()` called from the `context` session hook changes the tool list for the same or the next request | 03-05 §Opt-in check | Documented only; AR-45's "next request" holds in both cases |
| F | A second OpenCode process can resolve (`ctx.session.get`) and prompt (`ctx.session.prompt`) a session hosted by the first process | 03-05 §Waking and delivery, AR-46 | Treat `session.get` as an existence check only: the wake is recorded after the prompt resolves, failed prompts stay pending, and the README recommends one OpenCode process per project (AR-46) |

## Probe Method

The method reuses the live smoke technique of `plans/live-task-progress` (ST-22 note):

1. Create two scratch projects under `$CODEOPS_TMPDIR` (each `git init`) and an isolated
   `XDG_CONFIG_HOME` whose OpenCode config loads only the probe plugin. Isolation is required: a
   globally installed `opencode-codeops` auto-loads beside the probe and collides (ST-22
   environment attribution).
2. The temp-only probe plugin:
   - registers a tool `probe_where` that appends `{directory: ctx.location.directory, sessionID,
     tools: (await ctx.tool.list()).map((tool) => tool.name)}` to a ground-truth file (assumption C,
     including whether the tool list is per instance);
   - on setup, increments `globalThis[Symbol.for("opencode-codeops.discovery")].count` and records
     the value and the instance directory (assumption B);
   - starts a `node:http` listener on an OS-assigned port (written to the ground-truth file) whose
     `POST /wake?session=<id>` calls `ctx.session.prompt({ sessionID, text: "probe wake",
     delivery: "queue" })` (assumption A);
   - in its `context` hook, toggles a tool on a marker file's presence and calls
     `ctx.tool.reload()` (assumption E).
3. Drive sessions with the pty runner or `opencode run` against the isolated config: one session
   per scratch project; call `probe_where` in both (one project opted in, one not) and compare the
   recorded tool lists; leave one session idle, then `POST /wake`; repeat while
   the session is busy; check the session transcript with `opencode api` for a new assistant turn.
4. For D, exit the terminal UI, run `opencode service status`, and request the probe listener.
5. For F, start a second process with `opencode --standalone` against the same isolated config and,
   for the first process's idle scratch session, call `ctx.session.get` and `POST /wake`; record
   whether the lookup resolves and whether a new assistant turn appears in that session.
6. Stop every started process by exact PID and remove the scratch directories.

## Recording

Record in the Phase 1 note of `99-execution-plan.md`: the OpenCode build, each assumption's
outcome (A–F) with its ground-truth line, the fallback selected for each failed assumption, and the
spec-test variant set that follows from the fallbacks (07 §Specification Test Cases). When a
fallback applies, the executor follows the matching `§Fallback` section of the named 03 document;
those sections are part of this plan and need no re-planning. Assumption C failing stops execution
with the task marked `[!]`.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| --- | --- | --- |
| A probe step cannot run (host missing, model unavailable) | Record the step as inconclusive with the reason; treat as failed for fallback selection | AR #19 |
| Probe processes left running | Stop by exact PID; verify the port is closed | AR #19 |

## Testing Requirements

- No committed tests; the evidence is the recorded note. Later phases' spec tests encode the
  chosen path through the pre-authored variants in 07 (ST-27B/34B/37B for Fallback B;
  ST-44A/45A/62A for Fallback A), and task 1.1.4 records which set applies.
