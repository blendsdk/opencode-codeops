---
name: exec-plan
description: >-
  Use when the user wants to execute, run, continue, or resume an implementation plan created by
  make-plan — "exec-plan", "run the plan", "execute the plan", "implement the named feature plan",
  "continue the plan for a feature". Takes a feature name and an optional --ask-commit (default),
  --no-commit, or --auto-commit. Not for creating a plan (use make-plan) or auditing one (use
  preflight).
---

# exec-plan — Execute an Implementation Plan

> **CodeOps Artifact Schema**: 1

## Auto-design option

If `$ARGUMENTS` contains exactly one exact standalone `--auto-design` token before the first `--` sentinel, remove it before resolving targets, paths, or modes; zero occurrences means normal mode, more than one is invalid, and tokens at or after the sentinel are target content; announce `Auto-design active — eligible technical decisions are
delegated and recorded`; then read and apply
[../../_shared/auto-design.md](../../_shared/auto-design.md). Resolve eligible runtime technical
ambiguities under that policy, update owning artifacts and stale downstream state, and re-run
gates before resuming. Propagate only to explicitly invoked supported children; an unsupported child fails closed. This mode does not grant action permission, commit permission, or scope
expansion and does not imply `--auto-commit`. **Normal mode:** without the exact token, every
material runtime choice still requires an explicit user decision; historical delegated records
must not infer delegated authority.

## Scope exploration option

If `$ARGUMENTS` contains exactly one exact standalone `--explore-scope` token before the first `--` sentinel, remove it before resolving targets, paths, or modes; zero occurrences means strict scope, more than one is invalid, and tokens at or after the sentinel are target content; announce `Scope exploration active — optional additions will be proposed for your decision`; then read and apply
[../../_shared/scope-expansion-control.md](../../_shared/scope-expansion-control.md). Strict scope is the default:
do not report or implement optional additions raised during execution or review.
Exploration may create `SE-*` proposals, but only the user may choose `Keep` and authorize a plan
update.

## Auto-effort option

If `$ARGUMENTS` contains exactly one exact standalone `--auto-effort` or `--auto-effort=<level>`
token before the first `--` sentinel, remove it before resolving targets, paths, or modes; zero
occurrences means each phase's `Reasoning:` level is printed as a suggestion only, more than one
or an invalid level is an argument error. The accepted levels are `low`, `medium`, `high`,
`xhigh`, and `max`. Announce `Auto-effort active — reasoning <level> applied for this run`; then read and apply
[../../_shared/reasoning-effort.md](../../_shared/reasoning-effort.md) §Auto-effort option. A bare
flag follows each phase's suggestion; `--auto-effort=<level>` forces that level for the whole run,
including every dispatch marker composed during it. The run clears the level before its final
summary.

Execute the implementation plan at `plans/$ARGUMENTS/99-execution-plan.md`. The first
argument is the feature name; an optional flag selects the commit mode.

## Execution-entry gate

Before modifying implementation files, directly confirm the plan has its required documents (a
`standard` single-document plan: `99-execution-plan.md` alone), its decision owner — the ambiguity
register, or the single document's `## Decisions` table — has no open material item,
specification tests precede implementation, and no critical/major preflight finding remains
unresolved (a `standard` plan has no preflight). Also confirm every material support surface
has specific complexity approval in an applicable AR/PF/RV decision.
`99-execution-plan.md` is the only mutable task-progress authority:

For a plan created before `00-index.md` gained its Minimum-Sufficient Baseline, derive the original
goal and smallest viable design from its existing requirements, specifications, repository
patterns, and approved decisions. Keep that session baseline in every dispatch packet. If it is not
clear, use the runtime ambiguity gate; do not force a document migration or guess.

- `[ ]` is not started;
- `[~]` is implemented with verification pending;
- `[x]` is verified; and
- `[!]` is blocked and includes `Blocked: <short reason>` on the task line.

Never advance sibling tasks. Implement, immediately mark `[~]`, verify, then mark `[x]` only on
success. The primary agent updates the checklist after every delegated result.

A runtime ambiguity blocks affected plan tasks: record it in the ambiguity register (in a
`standard` single-document plan, a `(runtime)` row in its `## Decisions` table) and mark each
affected task `[!]` with a short visible reason. In normal mode, present options and obtain the user's explicit decision. With active
auto-design, resolve and record an eligible technical ambiguity under the shared policy; reserved
authority still pauses for the user. If resolution requires changing an upstream artifact outside
the selected plan's documents, present the exact expanded modification set and obtain the user's
approval before editing because auto-design does not expand scope. Resolve the ambiguity, update
the affected plan artifacts, and only then resume.

Before treating a runtime discovery or reviewer remediation as executable, classify it under the
shared scope-expansion protocol. A necessary correction retains the ordinary ambiguity/finding
gate. An optional change is silent in strict scope or a non-executable `SE-*` proposal in
exploration mode; accepting the related finding is not scope authorization.

This skill covers **execution only**. To create a plan, use the make-plan skill.

## Resolve the plan path first (layout-aware)

Determine the layout via **[../../_shared/layout-convention.md](../../_shared/layout-convention.md)**:

- **Flat layout** (no marker): the plan is at `plans/$ARGUMENTS/99-execution-plan.md` — as flat layout always has.
- **Nested layout** (marker present): the plan is under a feature —
  `codeops/features/<f>/plans/<plan>/99-execution-plan.md`. If the target feature/plan is ambiguous,
  **ask the user** (never guess). A non-trivial **task** mini-plan lives at the same nested path and
  executes identically (see "Lightweight tasks" above). Everywhere below that says
  `plans/$ARGUMENTS/` means this resolved plan path.

## Commit modes

| Flag | Behavior |
|------|----------|
| *(none)* / `--ask-commit` | **Default.** After each verified task, ask the user whether to commit. |
| `--no-commit` | Never commit, never ask. Pure implementation. |
| `--auto-commit` | Automatically commit + push (via the `git-commit` skill in push mode) after each verified task. |

Full prompt wording, end-of-plan reminders, and commit-message format live in
[commit-modes.md](commit-modes.md) — read it before the first commit decision.

## Lightweight tasks (both layouts)

A **non-trivial task** has a single mini-plan at the resolved task path (flat:
`plans/<task-slug>/99-execution-plan.md`; nested:
`codeops/features/<f>/plans/<task-slug>/99-execution-plan.md`). Execute it **exactly like a feature
plan** — same per-task loop, same real-time update mandate, same commit modes — it is just a
smaller `99-execution-plan.md` (objective + checklist + verify, no `00–07` set). Specification-first
ordering still applies *when the task warrants tests* (e.g. a bugfix's regression test). A single
`99-execution-plan.md` whose header declares `> **Implements**:` and `> **Verification tier**:
standard` is not a mini-plan but a `standard` feature plan (see
[../../_shared/layout-convention.md](../../_shared/layout-convention.md)): it keeps its own
`## Decisions` table, and a complexity escalation is recorded there instead of switching paths.

A complexity escalation ends the mini-plan path before any approval can become executable. Mark
the affected task `[!]`, preserve any implementation diff without marking it verified, and switch
to make-plan's full standalone-plan path. Its `00-ambiguity-register.md` owns the complete stop
packet and direct user decision. Do not accept or store a complexity approval only in the
mini-plan; resume execution only from the resulting full plan after its gates pass. This also
applies when the escalation is first found by the post-task review. A `standard` single-document
plan does not switch paths: it records the escalation in its `## Decisions` table with the full
approval evidence from the shared gate.

A **trivial task** has **no plan document** to run: do the work directly, then record it as a
`T-NN` roadmap row + the commit (no execution-plan loop). The task model and routing rule live in
**[../../_shared/layout-convention.md](../../_shared/layout-convention.md)** — the lane exists in both
layouts (flat gained it in 3.2.0).

## Execution mode — phase-scoped dispatch

Every phase of three or more tasks runs in a fresh executor (`standard`: the `executor` role;
`critical`: the session model), which returns one structured phase report; the primary session
keeps the plan, the decisions, and a short summary per phase, records every `mark`, runs the phase
gate, and computes the verification balance. Smaller phases run inline. Per-task dispatch happens
only on the user's explicit request. Full rules in [execution-protocol.md](execution-protocol.md).

## Execution protocol (summary)

Read [execution-protocol.md](execution-protocol.md) for the full step-by-step protocol,
the specification-first ordering rules, the real-time update mandate, and the session
summary template. The essentials:

### Step 1 — Load the plan

1. Read `plans/$ARGUMENTS/99-execution-plan.md`. An old plan with a single `**Verify**` line
   uses that line as the gate command; with a map, derive the task command, otherwise it serves
   both.
2. Find incomplete tasks — both `[ ]` and implemented-but-unverified `[~]`; read supporting specs
   in `plans/$ARGUMENTS/`.
3. Determine the starting point: a `[~]` task is resumed first (re-verify, then promote or keep
   fixing); otherwise the first `[ ]` task.
   After a context compaction, re-read `99-execution-plan.md` and `05-findings.md` before the
   next action; trust their marks and rulings over the summary.
4. If the plan is missing/empty/already complete, **STOP** — see the load table in
   [execution-protocol.md](execution-protocol.md). Generally suggest the make-plan skill.

**Schema check:** a legacy `CodeOps Skills Version` stamp or missing schema triggers a read-only
upgrade assessment; ask before migration or execution with recorded compatibility risk. Never
silently upgrade.

### Step 2 — Execute tasks (per-task loop)

For each task, in order:

1. **Run the minimum-sufficient checkpoint, then implement.** Compare the intended work with the
   original goal and smallest viable solution. If it triggers the shared Complexity Escalation
   Gate in `../../_shared/zero-ambiguity-gate.md`, mark the task `[!]`, run the independent
   challenge, show the full visible stop packet, and wait for explicit user approval before adding
   the larger machinery. Auto-design cannot approve it. Otherwise implement the task following the
   technical specs in `plans/$ARGUMENTS/`.
2. **🚨 Immediately update `99-execution-plan.md`** — completion marks are **two-stage**: as soon
   as implementation finishes (crash-safe), run
   `python3 "${CODEOPS_PLUGIN_ROOT}/scripts/codeops_plan.py" mark --plan <plan-dir> --task <id> --state implemented`;
   promote with `--state done` only after its verification passes. One `mark` call sets the
   checkbox and timestamped status suffix, refreshes the Progress header and Last Updated stamp,
   and prints the progress bar — no separate `date`, hand edit, or progress-bar step. A task never
   shows `[x]` with a failing verify. The same call serves a pre-3.3.0 plan, whose Master
   Progress Checklist lines are its counted task lines.

   - **Report progress** — when the `codeops_progress` tool is available — at the transition
     points in [execution-protocol.md](execution-protocol.md) §Progress Reporting, issued in the
     same step as the `mark` call (parallel tool calls); a failed or missing report never blocks
     any step.

3. **Verify** — run the task command: the plan's `**Task verify**` line, or the map's `task`
   gate with `--baseline <phase-tree>` and `--include <spec-file>` for the plan's declared spec
   file(s). With neither, run the plan's `**Verify (gate)**` command, or the project's full verify
   (from AGENTS.md or detected conventions), output captured per the protocol's
   **Verify-output capture rule** (PASS one-liner; on failure
   the last 50 log lines + log path). A changed path outside the phase's expected modification
   set, or a shared/config/test-infrastructure change, forces the full gate. Pass → `mark
   --state done` (it prints the progress bar; show that exact line in the next commentary update);
   fail → fix and re-verify (the task stays `[~]`). Only `[x]` contributes to the displayed
   completion count.
4. **Commit** per the active commit mode (see [commit-modes.md](commit-modes.md)) — the commit
   gate keys off `[x]`.
5. **Techdocs check (after each phase):** if the phase introduced architectural changes and
   techdocs exist, do an incremental update via the techdocs skill.
6. Continue until all tasks are complete. (OpenCode auto-compacts context — no manual
   threshold handling is needed.)

> **🚨 Specification-first task ordering — non-negotiable.** Within each feature:
> `spec tests → verify red → implement → verify green → impl tests → full verify`.
> Never write implementation code before its spec tests exist, and never edit a spec test to
> match the implementation (the implementation is wrong, not the test). Details and the
> compressed single-session form are in [execution-protocol.md](execution-protocol.md).

> **🚨 Zero-ambiguity during execution.** If you hit any detail not covered by the plan docs or
> the plan's decision owner (`00-ambiguity-register.md`, or a `standard` plan's `## Decisions`
> table), STOP and record it. In normal mode, present options and wait for an
> explicit user decision. With active auto-design, resolve an eligible technical choice under the
> shared policy or escalate a reserved choice. Record the authorized resolution in
> `00-ambiguity-register.md` (tag `(runtime)`) — in a `standard` plan, as a `(runtime)` `D-n` row
> in its `## Decisions` table — update affected plan documents, then resume.
> Never guess.

> **🚨 Complexity escalation during execution.** A material new layer, dependency, harness,
> framework, infrastructure surface, cross-cutting refactor, or future-proofing is a reserved stop
> even when the plan leaves implementation freedom. Apply the shared gate's prominent packet and
> challenger requirement. Record an approved runtime escalation in the Ambiguity Register as
> `Technical (complexity escalation)` — in a `standard` single-document plan, as a row in its
> `## Decisions` table.

> **Grounded Options & Recommendations (coding standards → Working style) apply here.** Before presenting options/findings/recommendations: filter out non-viable ones (no strawmen; ≥2 only when ≥2 are genuinely viable, else present the single viable path and name what was rejected), second-guess each, verify any code-modifying option against the actual current code (cite `file:line`), and lead with a recommendation backed by grounded reasoning. Match ceremony to stakes. In normal mode, the user decides; active auto-design resolves eligible technical decisions and escalates reserved ones. Apply the recommendation-hardening protocol (`_shared/recommendation-hardening.md`) to consequential recommendations; escalate to an independent challenger only when the decision is genuinely high-stakes.

### Step 3 — Session wrap-up

1. Finish the current task before stopping.
2. **🚨 First, update `99-execution-plan.md`** with all completed tasks (before anything else).
3. Run the task command when the plan is not complete and the session stops inside a phase;
   run the full gate at plan completion or a phase boundary.
4. Handle the commit per the active commit mode.
5. Report a session summary (must state `Execution Plan Updated: ✅`). Template in
   [execution-protocol.md](execution-protocol.md).

To resume in a later session, just run `/exec-plan $ARGUMENTS` again — the execution plan is the
source of truth and tells the skill where to pick up.

## Quality loop (profile-gated)

Every non-trivial executed phase (and task mini-plan) gets a post-phase quality review under
strict defaults unless an allowed adaptive-mode policy explicitly disables it. The plan's
verification tier sets when: at `critical` (and for plans without a tier line) every phase is
reviewed as it ends; at `standard` there is one review round per plan — the completion review
that runs before the plan is reported done — and only a risk-tagged phase is reviewed as it ends. Activation rules,
lenses, supersession, dispatch packets, and budget caps are defined
once in **[../../_shared/quality-profile.md](../../_shared/quality-profile.md)** — this skill
links to them, never restates them.

The flow: the protocol records a phase-start ref when the phase begins; after the phase's last
task verifies, the correctness reviewer and any active auditors are dispatched **in parallel** on
the phase diff, their findings are merged and presented in severity-grouped batches, and each
ruling is recorded in the plan's findings ledger (`05-findings.md`). Specialist roles listed in
the plan's `## Specialist Agents` table (`00-index.md`, or a `standard` plan's single document)
dispatch per `_shared/quality-profile.md`; an unavailable
specialist falls back to a generic packet and the fallback is reported.

> **🚨 Finding gate (load-bearing).** Findings are calibrated and every 🔴/🟠 finding gets one
> refute pass first (see [execution-protocol.md](execution-protocol.md)). In normal mode,
> `Confirmed` 🔴 CRITICAL and 🟠 MAJOR findings, and findings downgraded to 🟠, PAUSE execution for
> the user's ruling in ALL commit modes; refuted findings are listed and can be reinstated. With active auto-design, select and record
> an eligible technical fix, but never waive or dismiss a finding; reserved decisions still pause
> for the user. Auto-commit never bypasses the applicable authority gate. 🟡 MINOR findings are
> report-only. Accepted fixes are implemented, verified, follow-up-committed per the commit mode,
> and (after 🔴/🟠 fixes) re-reviewed ONCE on the fix diff — never a third time.
> Reviewers receive the active scope mode. Optional remediations are omitted in strict scope and
> become separate `SE-*` proposals during exploration; they are never accepted merely by a finding
> ruling or auto-design resolution.
> Escaped, unapproved complexity is at least a 🟠 MAJOR finding. It uses the shared Complexity
> Escalation Gate and cannot be waived by `quality.independentReview: false` once detected.

Step-by-step mechanics — the phase-start ref, spec-author dispatch, the post-phase quality step,
and emission points — live in [execution-protocol.md](execution-protocol.md).

## Roadmap sync

If a roadmap exists (`plans/00-roadmap.md` flat, or the feature's
`codeops/features/<f>/00-roadmap.md` nested), keep it in sync via the roadmap skill (update-first,
before verify/commit/next): set the RD/task row to `Executing` (🔄) on start, `Done` (✅) on
completion, and `Blocked` (⛔) with a nested `↳ DEF-n` sub-row when a blocking dependency is
discovered. **Nested layout:** after each per-feature transition, **cascade** to the portfolio
`codeops/00-roadmap.md` (re-roll that feature's row) before proceeding — per the roadmap skill's
cascade mandate. Roadmap rows change only at these plan-level transitions and at phase
boundaries — never per task (`mark` keeps the plan's own counters current). If no roadmap exists,
these hooks are inert.

## Error handling

Brief rules for verification failure, plan deviation, and mid-task interruption are in
[execution-protocol.md](execution-protocol.md) — consult it when something goes wrong.

## Post-completion hooks (all tasks done)

1. **Completion review:** run [execution-protocol.md](execution-protocol.md) §Completion review for
   every phase still marked `carried forward` — before the end-of-plan commit or push, the roadmap
   `Done`, or a release hand-off.
2. Handle the end-of-plan commit per the active commit mode (see [commit-modes.md](commit-modes.md)).
3. **Techdocs:** if techdocs exist, do a comprehensive update via the techdocs skill; otherwise
   ask whether to create them.
4. **Re-analyze:** ask whether to re-analyze the project and update the project's AGENTS.md via
   the `analyze-project` skill.
5. **Roadmap:** set the RD row to `Done` via the roadmap skill if a roadmap exists.

## Conventions

- Follow your project's coding and testing standards (the project's AGENTS.md, or detected
  project conventions). If no AGENTS.md exists, detect build/test/verify commands from manifest
  files and use only facts you can read — do not invent settings.
- Commit using the `git-commit` skill (commit only) or the `git-commit` skill in push mode (commit + push), or a normal git commit.
- Related skills: make-plan (creation), upgrade-plan (outdated plans), preflight, roadmap, techdocs.
- Cleanup is part of session wrap-up: delete the run's verify logs and scratch per
  [../../_shared/workspace-hygiene.md](../../_shared/workspace-hygiene.md) and report
  `Cleanup: done` in the session summary.

> **Workspace hygiene (non-negotiable):** put every temporary artifact this run creates in
> `$CODEOPS_TMPDIR` (fallback: the OS temp directory), never in the repository, and delete them
> all before reporting completion. Never delete user files, versioned artifacts, worktrees, or
> another session's temporary files. Full rules:
> [_shared/workspace-hygiene.md](../../_shared/workspace-hygiene.md).
