## Ambiguity Register: live-task-progress (full live feature, slice 2)

> **Status**: ✅ GATE PASSED — all 15 items resolved (14 resolved · 1 explicitly deferred)
> **Last Updated**: 2026-10-10 18:41
> **Scope**: feature plan for the full live CodeOps task-progress feature — the in-memory run
> state in the server plugin, the agent-callable `codeops_progress` tool, RPC event push, the
> sidebar's live view, and the exec-plan reporting protocol. Slice 2 of the staged
> live-task-sidebar feature (foundation: `plans/live-task-sidebar/`). Systematically reviewed
> across all 12 categories against the recorded intent (foundation index §Overview, foundation
> AR #1, #5, #18, notes E and G) and the installed OpenCode v2.0.26 plugin surface.
> **Auto-design**: active — eligible technical decisions are delegated under `_shared/auto-design.md`
> policy version 1. Root invocation ID: `AD-LTP-20261010-1`. Reserved decisions remain
> user-owned.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope | Re-derived slice-2 scope baseline (requirements R1–R10; pillar set: tool + state + events, sidebar view, protocol integration, delegation display, agent-template integration, remote acceptance) | a–d + f (core + delegation display + remote acceptance; agent-template integration deferred) / a–d only (remote deferred too) / all a–f | User (this conversation): a–d + f — core pillars + delegation display + remote acceptance run; agent-template integration deferred (row 15) | ✅ Resolved |
| 2 | UX & presentation | Sidebar content and state behavior (running / stale / blocked / waiting / done / idle) | two-line compact view with an always-visible as-of time and state markers (recommended) / single-line view / user adjustment | User (this conversation): accepted the presentation draft as specified — `CodeOps · <plan>` / `Phase <n> · <activity>` / `<task> · N/M · as of HH:MM`; stale >10 min; done persists; idle renders nothing | ✅ Resolved |
| 3 | Scope | README coverage for the completed feature | short section (recommended) / CHANGELOG only | User (this conversation): add the short README section | ✅ Resolved |
| 4 | Technical unknowns | Live update mechanism | agent tool → server in-memory state → RPC events → sidebar subscription; no poll/watch/timer; snapshot method + event push (AI) | AI — delegated by --auto-design (note A) | ✅ Resolved |
| 5 | Data & state | Run-state model and ownership | one active run per location; last reporter owns; cleared on session delete / restart; the plan file stays the durable source of truth (AI) | AI — delegated by --auto-design (note B) | ✅ Resolved |
| 6 | Integration points | Tool / RPC contracts | `codeops_progress` tool (JSON Schema in/out); new `progress` method + `updated`/`cleared` events on the existing `codeops` RPC; shared helper module with guards (AI) | AI — delegated by --auto-design (note C) | ✅ Resolved |
| 7 | Behavioral | Honesty mechanics behind the presentation | reported values only; server-side `updatedAt`; always-visible as-of time; staleness computed at render without client timers; done persists until the next run / restart; nothing rendered when nothing is known (AI) | AI — delegated by --auto-design (note D) | ✅ Resolved |
| 8 | Non-functional | Testing strategy | content + unit + fake-context runtime tests; pty live smoke (tool registration, event round-trip, agent-driven call, render path); remote-client run; user-assisted sidebar check; no committed harness (AI) | AI — delegated by --auto-design (note E) | ✅ Resolved |
| 9 | Edge cases | Containment and failure design | every new capability feature-detected; registration and handlers never throw; protocol reporting fail-soft; TUI renders nothing when unavailable (AI) | AI — delegated by --auto-design (note F) | ✅ Resolved |
| 10 | Security & compliance | Data surface of the tool and events | host-validated, length-capped inputs; events carry progress metadata only, location-tagged; no file access; host-standard subscriber model recorded (AI) | AI — delegated by --auto-design (note G) | ✅ Resolved |
| 11 | Integration points | exec-plan reporting points | run start, phase start, task implemented, verifying, verified (+counts), blocked, delegating, reviewing, waiting, done; fail-soft wording (AI) | AI — delegated by --auto-design (note H) | ✅ Resolved |
| 12 | Naming & terminology | Plan identity and symbols | folder `plans/live-task-progress/`, roadmap row `REQ-LIVE-TASK-PROGRESS`, tool `codeops_progress`, helper `bin/lib/codeops-progress.mjs`, method `progress`, event `updated` (AI) | AI — delegated by --auto-design (note I) | ✅ Resolved |
| 13 | Feature gaps | Specialist-gap check outcome | None — the phase plan needs host plugin/TUI API knowledge the 03 documents pin and packets carry; the foundation's two related findings were a single fixed batch (AI) | AI — delegated by --auto-design (note J) | ✅ Resolved |
| 14 | Non-functional | Verify command | `npm run verify` — repository fact, not a decision | — `AGENTS.md` §Verification commands | ✅ Resolved |
| 15 | Scope | Subagent-side progress reporting through agent-template changes (pillar e) | build now (required specialist review) / defer | ⏸ Deferred — Subagent-side progress reporting via agent templates · owner: user · revisit: when multi-agent runs need finer delegation detail, or reviews show parent-only reporting is insufficient | ⏸ Deferred |

### Resolution Notes

**Rows 1–3 (user decisions, this conversation).** The re-derived requirements set (R1–R10),
the pillar options, the presentation draft, and the README option were presented; the user
chose: (row 1) the recommended baseline — core pillars, delegation display, and the remote-client
acceptance run — with agent-template integration deferred as named row 15; (row 2) the
presentation draft as specified; (row 3) the short README section. The plan documents implement
these choices without restatement.

**Note A — row 4 (live update mechanism).**
```text
Authority: AI — delegated by --auto-design
Eligibility: internal architecture and interfaces within the recorded slice-2 intent
  (agent-callable progress tool, server-side data path, live sidebar); implementation mechanism;
  no reserved consequence; complexity assessed below.
Objective: live, trustworthy progress in the sidebar without changing the source-of-truth model.
Decision: the agent reports transitions through a new `codeops_progress` tool; the server plugin
  keeps an in-memory live run state per location; every accepted update emits a `codeops` RPC
  event (`updated`); the sidebar obtains an initial snapshot via a new `progress` method and then
  follows events. No polling, timers, watchers, file signaling, or persistence.
Evidence: v2.0.26 API — ctx.tool.transform + ToolContext carries sessionID/agent
  (@opencode/plugin/dist/promise/tool.d.ts:16-45; @opencode/schema/dist/tool.d.ts:10-16);
  RpcRegistration.events.emit (@opencode/plugin/dist/promise/rpc.d.ts:10-22); client
  events.subscribe/on (@opencode/client/dist/promise/rpc.d.ts:11-28); events are ephemeral with
  no replay (client docs); the live-proven 2.0.26 round-trip including location scoping
  (foundation AR #22).
Rejected alternatives: server file-watch/poll of the plan file (new watcher/timer machinery plus
  parser duplication or subprocess use — complexity escalation); file-based signaling (rejected by
  the recorded server-side data-path constraint); TUI-side parsing (violates the server-side data
  path); durable persistence of run state (not required for a live view; adds retention questions).
Strongest counterargument: agent-reported state can drift from the plan file when a report is
  skipped; mitigated — the plan file remains the durable source of truth, the view shows an
  as-of time (note D), and the exec-plan protocol requires reporting (note H).
Complexity assessment: not triggered — feature code using documented APIs; no new dependency,
  harness, framework, infrastructure surface, or generalized abstraction.
Confidence: High (every API verified in the installed SDK; the RPC round-trip is live-proven).
Reopen triggers: the host gains a native progress surface making the tool redundant; event
  delivery proves unreliable in the live smoke.
Policy version: 1
Root invocation ID: AD-LTP-20261010-1
```

**Note B — row 5 (run-state model and ownership).**
```text
Authority: AI — delegated by --auto-design
Eligibility: data structures and state ownership inside the recorded feature; the state is
  ephemeral (no retention beyond the process lifetime; no migration surface).
Objective: one unambiguous live view of the active run for the sidebar.
Decision: one active run per project location. Fields: plan {name, directory}, phase, task
  {id, title}, activity (enum), detail, verified, total, updatedAt, sessionID (last reporter),
  startedAt. Reports are partial updates — fields present replace, counts carry forward. The
  state clears when the reporting session is deleted and on server restart. A second run's first
  report replaces the first (last reporter owns).
Evidence: ToolContext carries sessionID/agent (@opencode/schema/dist/tool.d.ts:10-16);
  the plugin already subscribes to session.deleted (plugin/index.ts:241-252); the sidebar slot
  input carries { sessionID } (@opencode/plugin/dist/tui/context.d.ts:161-178).
Rejected alternatives: a per-session state map with per-session views (no recorded need for
  concurrent runs; adds display and ownership complexity); persistence (note A).
Strongest counterargument: two concurrent runs in one project would collide; rare by protocol
  (one exec-plan at a time per project), and last-report-wins keeps the view truthful.
Confidence: Med-High — the collision case is unobserved rather than impossible.
Reopen triggers: concurrent-run usage becomes real; multi-run display is requested.
Policy version: 1
Root invocation ID: AD-LTP-20261010-1
```

**Note C — row 6 (tool / RPC contracts).**
```text
Authority: AI — delegated by --auto-design
Eligibility: internal interfaces and schemas within the approved feature.
Objective: validated, testable contracts on both sides, exercisable in plain Node.
Decision: `codeops_progress` tool input (JSON Schema): plan (string, required), activity (enum,
  required: starting/implementing/verifying/reviewing/delegating/waiting/blocked/done), phase,
  task, detail (strings), verified, total (non-negative integers) — everything except plan and
  activity optional; output { ok: boolean }. The existing `codeops` RPC definition gains method
  `progress` (empty input; output = run snapshot or null) and events `updated` (schema = run
  snapshot; the full snapshot per emission) and `cleared` (schema = {plan, sessionID}; the
  cleared run's identity, so a newer run is never wiped). The sidebar subscribes to `updated`
  first and then merges an initial `progress` snapshot; snapshots are merged monotonically by
  updatedAt, so late or duplicate delivery cannot regress the view. Schemas, the state
  transitions, and the guards (`isCodeOpsProgressReport`, `isCodeOpsRunState`) live in
  `bin/lib/codeops-progress.mjs` (+ `.d.mts`), following the foundation helper pattern
  (foundation AR #9, #20).
Evidence: JSON Schema is accepted for tool input/output and RPC event schemas
  (@opencode/schema/dist/tool.d.ts:32-45, rpc.d.ts:36-49); the shared-helper pattern is
  established and unit-testable under node --test.
Rejected alternatives: Standard Schema builders (plain objects keep `Rpc.define` runtime-free
  and testable — foundation note B); a separate RPC id (splits one definition's methods from its
  events without an isolation need).
Strongest counterargument: literal schemas can drift from the state module; mitigated by keeping
  schemas and transitions in one module with consistency tests.
Confidence: High.
Reopen triggers: the host changes accepted schema forms; the smoke shows payload mismatches.
Policy version: 1
Root invocation ID: AD-LTP-20261010-1
```

**Note D — row 7 (honesty mechanics).**
```text
Authority: AI — delegated by --auto-design
Eligibility: failure/consistency design inside the recorded honesty rule ("favor no claim over a
  false claim"); the visible presentation is user-confirmed in row 2.
Objective: the view never presents stale or unverified data as live truth.
Decision: only reported values are shown; every snapshot carries the server-side updatedAt; the
  view always shows the last-update time; a staleness label is computed at render from
  updatedAt vs now (no client timers); verified counts come from reports only (never counting
  [~]); done persists until the next run or restart; blocked shows the reported reason; when
  nothing is known the sidebar renders nothing.
Evidence: the brief's honesty rule is recorded in foundation note E; the exec-plan protocol
  forbids promoting [x] before verify (execution-protocol.md); the server clock is the single
  time reference.
Rejected alternatives: client-side ticking timers (new timer machinery; the visible timestamp
  already carries the truth); showing expected/approximate values (violates the honesty rule).
Strongest counterargument: with no further events the staleness recomputes only on a render
  trigger; mitigated — the visible as-of time is itself the truthful signal, and any event or
  re-render refreshes the label.
Confidence: High.
Reopen triggers: the user asks for auto-ticking staleness (a timer decision reopens this).
Policy version: 1
Root invocation ID: AD-LTP-20261010-1
```

**Note E — row 8 (testing strategy).**
```text
Authority: AI — delegated by --auto-design
Eligibility: testing strategy within approved scope; no committed harness (foundation boundary).
Objective: each contract is proven at the cheapest sufficient layer, with a live end-to-end
  proof on the installed build.
Decision: (a) content/spec tests (Node) for schemas, guards, protocol wording, and TUI content
  rules; (b) unit tests for the state module (merge, monotonicity, transitions, staleness
  computation, clearing); (c) fake-context runtime tests for the server wiring (tool transform
  captured and invoked, RPC params captured and invoked, event emission captured, containment
  without the new APIs); (d) pty live smoke on the packed tarball: tool-registration ground
  truth, event round-trip via a control emit plus a client subscription (footer probe), an
  agent-driven `codeops_progress` call, and the render path; the sidebar pane stays
  user-assisted (it has not rendered in captures — foundation ST-12 note); (e) remote-client
  acceptance run: `opencode serve` (isolated) plus `opencode <project> --server <url>` in the
  pty, asserting the same signals; if the connect path demands machinery beyond the established
  probe method, stop at the complexity gate instead of building it.
Evidence: `--server string` and `opencode serve` exist (opencode --help); the established pty
  runner and fixture live under the execution temp root (foundation AR #14, note F/J).
Rejected alternatives: a committed harness (recorded boundary); driving a full exec-plan run in
  the smoke (non-deterministic and expensive; a scripted agent call proves the same path).
Confidence: High for (a)–(d); Med for (e) connectivity specifics.
Reopen triggers: the smoke exposes a connect/auth obstacle that is not probe-method-shaped.
Policy version: 1
Root invocation ID: AD-LTP-20261010-1
```

**Note F — row 9 (containment and failure design).**
```text
Authority: AI — delegated by --auto-design
Eligibility: failure/recovery design; containment is a recorded project invariant
  (foundation AR #9).
Objective: a host build or a failure can never break the agent loop, the plugin, or the sidebar.
Decision: server side — feature-detect `ctx.tool.transform` and `ctx.rpc.register`; one
  content-free warning when absent; registration wrapped; the tool handler validates defensively
  and returns a structured result instead of throwing; event emission failures are swallowed.
  TUI side — subscription APIs guarded; any failure renders nothing; no retry loops or timers.
Evidence: the host validates tool input against the schema before execute, so the handler guard
  is defense in depth; the foundation's guard contract and ST-10/ST-11 are the established
  pattern.
Rejected alternatives: hard failures with retries (violates containment and the no-timer rule).
Confidence: High.
Reopen triggers: an API-shape change on a newer build.
Policy version: 1
Root invocation ID: AD-LTP-20261010-1
```

**Note G — row 10 (data surface).**
```text
Authority: AI — delegated by --auto-design
Eligibility: security mechanisms within an approved policy; no new authentication surface.
Objective: the new data paths expose nothing beyond progress metadata already visible to the user.
Decision: tool input validated by schema plus length caps (strings ≤ 200 characters; counts
  bounded); the event payload carries plan/phase/task/activity/counts/timestamps only — no file
  contents, no prompts, no absolute paths beyond the plan folder name; the tool performs no file
  access; the run state is keyed to the server's location; RPC events are visible to connected
  clients of that server (the host's standard subscriber model — the same trust context as the
  foundation's status data, foundation AR #16); the TUI renders values as text only.
Evidence: tool/event schemas (note C); foundation AR #16; JSON-Schema host validation.
Rejected alternatives: a plugin-owned encrypted event channel (the host owns transport; out of
  scope).
Confidence: High.
Reopen triggers: a remote multi-user server model becomes supported usage.
Policy version: 1
Root invocation ID: AD-LTP-20261010-1
```

**Note H — row 11 (exec-plan reporting points).**
```text
Authority: AI — delegated by --auto-design
Eligibility: implementation sequencing and interfaces within the recorded protocol-integration
  pillar; the Markdown progress authority is untouched.
Objective: the state machine receives the transitions the sidebar needs at zero execution cost.
Decision: the exec-plan documents instruct one call at each of — run start (plan + phase + first
  task, activity starting→implementing); phase start; task implemented ([~]); verifying (before
  the verify run); task verified ([x]) with verified/total from the progress step; blocked ([!])
  with the reason; delegating around dispatches with the role as detail; reviewing during the
  quality step; waiting when pausing for user input; done when all tasks complete. Every
  instruction is fail-soft: when the tool is unavailable, execution proceeds unchanged. The
  Markdown execution plan stays the single progress source of truth; the live view never gates
  execution.
Evidence: execution-protocol.md transition points (two-stage marks at :100-123, progress step
  :113-121, quality step :163-218, blocker path); the tool call is cheap and carries no inputs
  the agent does not already hold.
Rejected alternatives: automatic inference from hooks (no hook knows phase/activity); reporting
  every micro-action (noise and token cost).
Confidence: High.
Reopen triggers: an exec-plan protocol change makes a point obsolete; the live smoke shows a
  missing state.
Policy version: 1
Root invocation ID: AD-LTP-20261010-1
```

**Note I — row 12 (naming and identity).**
```text
Authority: AI — delegated by --auto-design
Eligibility: naming/terminology; zero reserved consequence.
Objective: consistent, discoverable identity across the plan, code, and roadmap.
Decision: plan folder `plans/live-task-progress/`; roadmap row `REQ-LIVE-TASK-PROGRESS`; tool
  `codeops_progress`; helper `bin/lib/codeops-progress.mjs` (+ `.d.mts`); RPC method `progress`
  and events `updated`/`cleared` on the existing `codeops` definition; guards `isCodeOpsProgressReport` /
  `isCodeOpsRunState` and the event acceptors `acceptRunUpdate` / `acceptRunCleared`; the TUI view stays in `plugin/tui.tsx` unless it outgrows a reviewable
  size.
Evidence: the foundation names (`codeops` RPC, `isCodeOpsStatus`); the tool name is fixed by the
  recorded slice-2 list; the folder/RD follow the repo's feature-folder convention and the
  roadmap's separate-row precedent (REQ-ANALYZE-AGENTS following T-07).
Rejected alternatives: extending the foundation folder (one execution plan per folder; separate
  planning effort); reusing `REQ-LIVE-TASK-SIDEBAR` (its Done row would regress under the
  roadmap's never-regress rule).
Confidence: High.
Reopen triggers: the user prefers a different identity.
Policy version: 1
Root invocation ID: AD-LTP-20261010-1
```

**Note J — row 13 (specialist-gap check outcome).**
```text
Authority: AI — delegated by --auto-design
Eligibility: the detection outcome is analysis within the approved scope; creation is reserved
  and not requested.
Objective: run the make-plan specialist-gap check and record the outcome.
Decision: None — no standing specialist closes a recurring gap. The phase plan needs host
  plugin/TUI API knowledge that the 03 documents pin with file:line evidence, that dynamic
  packets carry, and that the proven probe method exercises. The foundation's two related review
  findings (RV-001, SA-004) were one batch with one fixed root cause and do not evidence a
  recurring cross-phase gap. No candidate is proposed (sophistication and future flexibility are
  not evidence; a candidate may re-surface with newer review evidence).
Evidence: foundation 05-findings (RV-001/SA-004 fixed; no further findings); the pinned host-API
  research for this plan; AGENTS.md specialist triggers (agent-generation surfaces only,
  untouched by this plan).
Rejected alternatives: proposing a standing plugin-surface reviewer now (single-incident
  evidence; base lenses plus packets suffice).
Confidence: Med-High.
Reopen triggers: slice-2 reviews show repeated host-API findings across phases; the plan starts
  changing agent-generation surfaces (which would trigger the existing agent-pipeline-reviewer).
Policy version: 1
Root invocation ID: AD-LTP-20261010-1
```
