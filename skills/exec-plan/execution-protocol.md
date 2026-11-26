# Execution Protocol (Reference)

Detailed execution protocol for the exec-plan skill. SKILL.md links here. Read this for the
load-the-plan edge cases, specification-first ordering, the real-time update mandate, the
session summary template, and error handling.

---

## Step 1: Load the Plan

1. Read `plans/[feature-name]/99-execution-plan.md`.
2. Find incomplete tasks: **both** unchecked `[ ]` items **and** implemented-but-unverified `[~]`
   items (see the two-stage marks below).
3. Read supporting technical specs in `plans/[feature-name]/`.
4. Determine the starting point: a `[~]` task is resumed FIRST — re-read its partial-completion
   note, re-run verification, then promote it to `[x]` or continue fixing. Otherwise start at the
   first `[ ]` task.
5. **Dispatched-phase resume:** a dispatched phase records no marks until its report returns, so a
   phase whose `Phase baseline tree` is recorded, whose tasks show no marks, and whose snapshot
   diff against that tree is not empty was interrupted mid-run. Reconcile before re-dispatching:
   show the user the changed files and ask whether to keep the partial diff (pass it to the new
   executor as the starting state) or discard it.
6. **Resume spot-check:** before building on prior work, confirm the most recent `[x]` task's
   named files actually exist (branch switches and reverts happen). If they don't, flag the drift
   to the user before continuing.

If the execution plan can't be loaded cleanly, **STOP** and handle as follows:

| Condition | Action |
|-----------|--------|
| `plans/` directory doesn't exist | STOP — suggest using the make-plan skill first |
| `plans/[feature-name]/` doesn't exist | STOP — suggest the make-plan skill, or check for typos in the feature name |
| `plans/[feature-name]/` exists but `99-execution-plan.md` is missing | STOP — plan is incomplete; suggest recreating it with the make-plan skill |
| `99-execution-plan.md` exists but has no tasks | STOP — plan is empty; suggest recreating it with the make-plan skill |
| All tasks already marked `[x]` | Report "All tasks are already complete." Suggest re-analyzing the project via the `analyze-project` skill |
| No verify command resolvable — the plan's Verify lines are empty/generic AND neither the project's AGENTS.md nor its manifests name one | STOP — ask the user to name the verify command, write it into the plan's Verify lines, then proceed. **Never invent a command** (a plausible-looking `npm test` that was never configured verifies nothing) |

### Artifact schema check

Read `00-index.md` (when the plan has one) and `99-execution-plan.md`. A current plan declares one
or more RDs on its `> **Implements**:` line — in `00-index.md`, or in the header of a `standard`
single-document plan — and uses `[ ]`, `[~]`, `[x]`, and `[!]` as its complete task-state
vocabulary. A legacy `CodeOps Skills Version` stamp or no schema stamp triggers a read-only
upgrade assessment. Do not execute a legacy plan merely because its task checkbox shape can be
parsed; the user must approve migration or explicitly accept the recorded compatibility risk.

Before implementation, directly check required documents, closed material ambiguities,
specification-first ordering, and unresolved critical/major findings. Before promoting a task to
`[x]`, run its verification. A task update never advances siblings.

Suggestion only — the user may proceed without upgrading.

---

## Step 2: Execute Tasks

### Phase start

Record the phase's expected modification set from its task target paths and deliverables. The set
drives the fallback rule: a task-time change outside it, or a shared/configuration/test-infrastructure
change, runs the full gate. For an old plan, the rule is unchanged: a single `**Verify**` line is the gate
command; with a map, derive the task command, otherwise use the same line for tasks.

Before a phase's first task (and before a T-NN mini-plan's first task), snapshot the complete
non-ignored worktree—including staged, unstaged, and untracked files—into a temporary Git tree,
without changing the real index:

```bash
python3 "${CODEOPS_PLUGIN_ROOT}/scripts/codeops_worktree_snapshot.py" snapshot --root .
```

Write the returned SHA as `> **Phase baseline tree**: <sha>` in the phase header (for a mini-plan,
its single header). This snapshot works in every commit mode and prevents pre-phase dirty work from
entering the review. Also record the phase's expected modification set from its task target paths
and deliverables. A changed path outside that set is scope drift: attribute it to the phase and
expand the recorded set, or identify it as unrelated work and exclude it from the review packet.
Never silently review or commit unrelated user changes as phase work.
Record the invocation's scope mode (`strict` by default or `explore`) beside the expected
modification set. Every executor and reviewer packet receives that mode plus the confirmed product
scope baseline; missing mode context fails closed to strict scope.
When opt-in outcome metrics are enabled, record only a content-free execution-stage event through
`codeops_outcomes.py`; metrics never gate execution.

When the phase header carries `> **Reasoning**: <level> — <reason>`, record it as the phase's
advisory level for dispatch markers, inline reporting, and applied-level reporting. It is a
suggestion: no gate reads it, and its absence means "inherit".

**Spec-author dispatch (profile-gated).** Tasks marked `[spec-author]` dispatch the
spec-test-author agent — packet per `_shared/quality-profile.md` — BEFORE any implementation
task of that phase, and the red phase is confirmed from its report. A spec test that cannot be
written from the packet is a blocker for the user, never guessed around. Without an active
profile the session writes the spec tests itself; specification-first ordering is identical
either way.

Task completion is **two-stage**: `[~]` = implemented (crash-safe progress mark), `[x]` = verified
complete. The per-task loop below is how an **inline** phase runs. A **dispatched** phase (§Execution
mode) runs it inside the executor; the parent records every mark from the phase report and resumes
an interrupted phase by the dispatched-phase rule in Step 1. For each task, in order:

1. Run the **minimum-sufficient checkpoint** before editing. Compare the intended work with the
   original goal, established project patterns, relevant approved complexity AR/PF/RV decisions (a
   `standard` plan: the approved `D-n` rows),
   and the smallest viable implementation. If it triggers the Complexity Escalation Gate in
   `_shared/zero-ambiguity-gate.md`, mark the task `[!]`. For a T-NN mini-plan, preserve the current
   diff without marking it verified and switch to the full standalone-plan path before dispatching
   the challenger, presenting the packet, or accepting a decision; its
   `00-ambiguity-register.md` owns the decision. A `standard` single-document plan does not switch:
   it runs the challenger and packet in place and records the decision in its `## Decisions` table.
   For a full plan, dispatch the required blind
   challenger, present the complete visible stop packet, and wait for explicit user approval.
   Auto-design, auto-commit, or a generic finding ruling cannot approve the larger option.
2. Implement the task following the technical specifications. **The code and doc comments you
   write must never reference the plan, requirements, `codeops/`, or any RD/AR/task ID** — those
   files are ephemeral; the shipped code must stand on its own (per the standards' Documentation
   ban). Restate any rationale you drew from the plan in plain language instead.
3. **🚨 Immediately update `99-execution-plan.md`** — `mark --state implemented` (§Update
   procedure; the progress report for this moment goes in the same step). Do this before running
   verification or anything else — if the session crashes now, the implementation progress is
   preserved and the resume session knows the task still needs verification.
4. Run verification, with output captured per the **Verify-output capture rule** below. Use the
   task command for a normal task: the plan's validated `**Task verify**` line, or the map's
   `task` gate with `--baseline <phase-baseline-tree>` and `--include <declared-spec-file>` for
   every plan-declared specification test file. If neither exists, use the plan's
   `**Verify (gate)**` command, or the project's full verify command (from AGENTS.md or detected
   conventions). Run the full gate at phase exit, plan
   completion, before push/release, and whenever a changed path falls outside the phase's
   expected modification set or touches shared/configuration/test infrastructure. A single
   `**Verify**` line is the gate command; a map may derive the task command from it, otherwise
   that line serves both.
   - **PASS** → before promoting, run the **documentation-standard self-check** below on the files
     this task changed. Missing documentation and leaked plan references are invisible to
     build+test, so a green verify is NOT sufficient — the self-check is a hard part of the
     done-criterion. Only when it is clean, promote with `mark --state done` (optionally
     `--note "<short evidence>"`). Its output is the single `Progress: […] X/Y tasks (Z%)` line:
     present it in the next commentary update. This display is required after every `[x]`
     promotion; never estimate it or count `[~]` as complete.
   - **FAIL** → the mark STAYS `[~]`. Fix the implementation and re-verify; promote only on pass.
     A task is never `[x]` with a failing verify.

   **Documentation-standard self-check (NON-NEGOTIABLE, before every `[x]`).** In a dispatched
   phase, the executor's documentation gate plus the parent's spot-check of the reported changed
   files (the plan-reference grep below) satisfies this check. Read the changed
   code as a junior developer and confirm:

   - every public, exported, or external-facing class, interface, method, function, property, type,
     and constant has a language-appropriate doc comment;
   - every non-trivial internal entity is documented;
   - applicable purpose, parameters, return value, thrown errors, side effects, and important
     invariants are explained;
   - complex logic, invariants, edge cases, and non-obvious decisions have calm comments that
     explain why without narrating obvious syntax;
   - public API has `@example` or the language equivalent wherever practical; and
   - genuinely trivial private code is not padded with comments that only restate its name or type.

   Use the project's documentation linter when one is configured. Lint cannot replace the semantic
   read. Missing required documentation blocks `[x]`.

   Then confirm the code and comments reference no ephemeral CodeOps artifact. Grep the files this
   task changed:

   ```bash
   git diff --name-only | xargs grep -nEI \
     -e '\b(RD|AR|PA|PF|HR|GATE|AC|ST|ADR|DEF|D)-[0-9]+' \
     -e '\b(codeops|plans|requirements)/[[:alnum:]._/-]*' 2>/dev/null
   ```

   Any hit inside a comment or doc comment is a leak — rewrite it per the standard (keep the
   behavior it annotated, drop the citation; restate any plan rationale in plain language) before
   marking the task `[x]`. Hits inside real code strings/paths the program actually uses are fine.
5. Commit per the active commit mode (see [commit-modes.md](commit-modes.md)) — the commit gate
   keys off `[x]`, never `[~]`.
6. **Post-phase quality step (after each phase, profile-gated):** when the phase's last task has
   verified, run the quality step below before anything else starts.
7. **Techdocs check (after each phase):** if techdocs exist and the just-completed phase
   introduced architectural changes (new components, data entities, API endpoints, integrations,
   or infrastructure), perform an incremental techdocs update via the techdocs skill.
8. Continue until all tasks are complete. OpenCode auto-compacts context, so there is no
   manual context-threshold handling — just keep going. Before reporting the plan done, making the
   final push, or handing off for release, run the **completion review** (below) for every phase
   still marked `carried forward`.

### Post-phase quality step (profile-gated)

Runs after a phase's last task verifies — and after a T-NN mini-plan's work verifies, on the
whole-task diff. Activation rules, packets, supersession, and caps are defined in
`_shared/quality-profile.md`; this section owns the order of operations:

1. **Determine activation and timing.** Strict defaults review every non-trivial phase's diff, at
   the time the plan's verification tier sets. Adaptive mode may explicitly disable independent
   review; announce that choice. Trivial tasks are never reviewed. A docs-only diff →
   phase-reviewer only, and the auditor skip is logged — never silent.
   - **Verification balance (report-only).** Classify every file in the phase's review diff (the
     snapshot diff in step 2) and count its lines:

     | Class | Paths |
     |---|---|
     | Test | `*.test.*`, `*.spec.*`, `*_test.*`, `test_*.*`, `*Test.*`, `*_spec.*`; any path with a `test/`, `tests/`, `__tests__/`, `spec/`, or `fixtures/` segment; files matched by a test map's test globs |
     | Excluded | CodeOps artifacts under `plans/`, `requirements/`, and `codeops/`; lockfiles (`*.lock`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`); generated `dist/` and `build/` directories |
     | Product | Every other changed file — Markdown counts as product |

     Record `> **Verification balance**: <T> test / <P> product lines (<R>:1)` in the phase header
     and in the phase summary, where T and P are added lines and R = T / P with one decimal (`n/a`
     when P is 0). At `critical` the balance is report-only: it never blocks, never asks, and never
     changes a gate result. At `standard`, a phase above 1:1 (R above 1.0) stops before the phase
     closes: present the STOP packet — the test and product line counts, the largest test
     additions, and the smallest change that brings the phase back to 1:1 — and wait for the user's
     decision to keep the tests (with a recorded reason) or trim them; record it as a row in the
     plan's decision owner. When the diff is unavailable, record
     `> **Verification balance**: unavailable — <reason>` and review the phase now. This command counts the file conventions above (add a test map's globs by judgment):

     ```bash
     python3 "${CODEOPS_PLUGIN_ROOT}/scripts/codeops_worktree_snapshot.py" diff --root . \
       --baseline <phase-baseline-tree> | awk '/^diff --git /{f=$0; sub(/^diff --git "?a\/.* "?b\//,"",f); sub(/"$/,"",f); h=1; c=(f~/^(plans|requirements|codeops)\//||f~/(^|\/)(dist|build)\//||f~/(\.lock|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/)?"x":((f~/(^|\/)(test|tests|__tests__|spec|fixtures)\//||f~/(\.test\.|\.spec\.|_test\.|_spec\.|Test\.)/||f~/(^|\/)test_/)?"t":"p"); next} h&&/^(\+\+\+|---) /{next} /^@@/{h=0} /^\+/{a[c]++} /^-/{d[c]++} END{printf "test=%d product=%d changed=%d\n", a["t"], a["p"], a["p"]+d["p"]}'
     ```
   - Read the tier from the `> **Verification tier**:` line in `00-index.md`, or in the plan's own
     header for a single-document plan. A plan with no tier line, or with an unknown value, is
     `critical`; say so once in the run summary.
   - `critical`: review the phase now.
   - `standard`: one review round per plan — the completion review below, with its refute pass.
     Review a phase now only when it is risk-tagged; otherwise write
     `> **Review**: carried forward` in its phase header and skip steps 2–6 for this phase.
2. **Dispatch in parallel:** the correctness reviewer, every risk-selected auditor (security,
   financial integrity, concurrency, performance, semantics, or migration), and any specialist
   reviewer listed in the plan's `## Specialist Agents` table (`00-index.md`, or a `standard`
   plan's single document), each with the dispatch header on
   line 1 of its prompt and its packet (`_shared/quality-profile.md`)
   Create the review diff with:

   ```bash
   python3 "${CODEOPS_PLUGIN_ROOT}/scripts/codeops_worktree_snapshot.py" diff \
     --root . --baseline <phase-baseline-tree>
   ```

   This includes committed, staged, unstaged, and newly created files while excluding changes that
   existed at phase start.
3. **Merge, calibrate, and refute findings** (RV/SA/PE/SR).
   - **Scope.** Before merging, apply `_shared/scope-expansion-control.md`: a necessary correction
     or blocking uncertainty remains a finding, while an optional remediation is omitted in strict
     scope or moved to a separate `SE-*` proposal in exploration mode. A finding ruling never
     chooses `Keep`.
   - **Calibrate.** Apply the `Finding calibration` section of `_shared/quality-profile.md`: drop
     every finding it lists as not a finding, with a one-line note each, and adjust test-gap
     severities.
   - **Refute.** If any 🔴 CRITICAL / 🟠 MAJOR finding remains — of any prefix, at every tier —
     dispatch one refute pass per review round, so at most one per phase — the completion review
     sends a single pass for its cumulative diff: a fresh correctness reviewer in `Mode: refute` with the
     packet from `_shared/quality-profile.md`, on a different model than the finding reviewers when
     routing offers one. Each finding comes back `Confirmed`, `Downgraded → <severity>`, or
     `Refuted`. If the refute dispatch fails, or a finding gets no row, that finding counts as
     `Confirmed`; a reply with no rows at all is reported as "refuter out of date or failed". The
     refuter raises no new findings, and a refutation is never itself refuted.
   - **Present** the findings in severity-grouped batches (reuse the preflight skill's batch
     pacing). In normal mode, `Confirmed` 🔴 CRITICAL / 🟠 MAJOR findings — and findings
     downgraded to 🟠 — PAUSE execution for the user's ruling in ALL commit modes; a finding
     downgraded to 🟡 is report-only. `Refuted` findings do not pause: list them under "Refuted"
     with the refuter's evidence. The user may reinstate any refuted finding at any time; a
     reinstated finding is handled as `Confirmed`. With active auto-design, an eligible technical
     fix may be selected and recorded, but risk may never be waived and a critical/major finding is
     never dismissed silently; reserved decisions pause for the user. 🟡 MINOR findings are
     report-only.
   - **Escaped complexity.** First dispatch the blind design challenger and then use the complete
     visible packet from `_shared/zero-ambiguity-gate.md`. Explicit approval of the named larger
     machinery resolves the finding without a code change. Choosing the smaller design, revision,
     or deferral stays blocked until the code changes and passes re-review. For a T-NN mini-plan,
     stop before presenting or accepting a complexity decision: mark the task `[!]`, preserve the
     diff without marking it verified, and switch to the full standalone-plan path. The new
     `00-ambiguity-register.md` owns the packet and decision. Resume only after that plan's gates
     pass. A `standard` single-document plan records the decision in its `## Decisions` table.
4. **Record decisions durably** in the plan's findings ledger after each ruling batch. The ledger
   is `plans/<plan>/05-findings.md` (flat) or
   `codeops/features/<f>/plans/<plan>/05-findings.md` (nested), created lazily on first use, with a
   one-line title and one compact row per batch:
   `| Finding | Phase | Severity | Area | Ruling |` — finding ids use the review prefixes
   `RV-`/`SA-`/`PE-`/`SR-` (for example `RV-001`), followed by the phase number,
   `CRITICAL`/`MAJOR`/`MINOR`, a path or domain token, and
   `fixed`/`accepted`/`deferred`/`dismissed`/`refuted`/`downgraded` — `downgraded` only for a
   finding the refute pass downgraded to 🟡; a finding downgraded to 🟠 is recorded at its new
   severity with the user's ruling; identifiers and area tokens only, never prose. Task
   mini-plans keep their ledger in their own plan folder. When the user approves larger machinery,
   also append a `Technical (complexity escalation)` runtime AR with every approval-evidence field
   required by the shared gate; the RV finding references that AR.
5. **Accepted fixes:** implement → verify → follow-up commit per the commit mode. If any 🔴/🟠
   fix was applied, dispatch ONE re-review scoped to the fix diff — never a third pass. A fix
   the re-review still rejects is reported. Normal mode returns the ruling to the user; active
   auto-design may select one eligible technical correction, but cannot waive the finding.
6. **Record review evidence** in the plan or its review report, and write
   `> **Review**: reviewed <YYYY-MM-DD HH:MM>` in the header of every phase this review covered
   (after the rulings and any re-review). Optionally record a content-free review outcome, then
   proceed to the next phase.

A dispatch that fails or dies mid-loop is reported — the phase completes UNreviewed only on the
user's explicit say-so.

**Completion review.** At plan completion — before reporting the plan done, making the final push,
or handing off for release — run steps 2–6 once on a cumulative diff that covers every phase still
marked `carried forward`, starting from the earliest such phase's baseline tree, then mark each
covered phase `reviewed`. This applies whatever the size or triviality of the last phase. Per-task
pushes (`--auto-commit`, or ask-commit "commit and push") do not trigger it. If the earliest
baseline object no longer exists, start from the earliest carried-forward baseline that still
exists and report the gap. A run that stops early names every phase still `carried forward` in its
session summary.

### Outcome evidence (opt-in)

When `codeops/codeops.json` sets `metrics.enabled` to `true`, record only enumerated, content-free
outcomes through `"${CODEOPS_PLUGIN_ROOT}/scripts/codeops_outcomes.py" emit`. Useful events include
verification results, rework cycles, scope drift, invalidated assumptions, runtime ambiguities,
review completion, escaped findings, and recovery accuracy. Event recording always exits without
changing gate results. Never include prompts, paths, source content, finding prose, or user text.

### Verify-output capture (NON-NEGOTIABLE)

Never let a full verify run's output into the conversation. Every verification run — per-task,
red-phase, green-phase, session wrap-up — executes with output captured to a temp log:

```bash
<verify command> > "$VERIFY_LOG" 2>&1
```

(`$VERIFY_LOG` = a file under `$CODEOPS_TMPDIR` — or the OS temp directory when it is unset —
e.g. `verify-<task-id>.log`.)

- **PASS** → surface ONE line: `VERIFY PASS (task N.N.N)`, plus the test count if it is
  extractable from the log tail at no extra cost.
- **FAIL** → surface the **last 50 lines** of the log + the log path, nothing more. Read further
  slices of the log file on demand while fixing — do not re-run verify just to "see the output".
- **Red-phase runs** (spec tests expected to fail) → surface only the failing spec-test
  names/count confirming the red state — never the full dump.

The full log remains on disk until the session wrap-up cleanup deletes it (see
`_shared/workspace-hygiene.md`); nothing in the transcript depends on it afterward. If the log
location is unwritable, fall back to running verify plainly ONCE and note the fallback in the
session summary. This rule is about CONTEXT, not rigor: the verify command itself, its scope, and
pass/fail gating are unchanged — and the temp log is read-only evidence, never executed.

### Zero-Ambiguity During Execution

If you encounter any implementation detail, behavioral question, edge case, or design choice not
covered by the plan documents or the plan's decision owner (`00-ambiguity-register.md`, or a
`standard` plan's `## Decisions` table), first record it and mark affected
tasks `[!]` with `Blocked: <short reason>` until the owning artifact is resolved.

First determine whether the discovery is an ambiguity inside authorized scope, a necessary
correction, or an optional expansion. Optional expansions do not enter the ambiguity register:
they are silent in strict scope or use the Scope Expansion Register during exploration.

1. **STOP** — do not guess, infer, or apply "reasonable defaults".
2. **Classify authority.** With active auto-design, apply the shared auto-design policy: resolve
   and record an eligible technical decision; present a reserved decision to the user. In normal
   mode, present every material ambiguity to the user with options and trade-offs.
3. **Obtain authority.** Wait for the user's explicit decision when normal mode or reserved
   authority applies. An auto-design resolution must include the policy's complete provenance.
4. **Record** it in `00-ambiguity-register.md` with the next sequential AR number, tagged
   `(runtime)` in the Category column, and update the register header to note items added during
   execution — in a `standard` single-document plan, as the next `D-n` row tagged `(runtime)` in its
   `## Decisions` table (never create a register file for it).
5. **Only then** update affected plan artifacts, confirm direct entry checks still pass, and
   resume implementation using the authorized decision.

This applies to ALL ambiguities — architectural, behavioral, naming, formatting, UX, error
handling. Never fill gaps by guessing.

A runtime complexity escalation always uses reserved authority. Its required challenger and
visible stop packet come from `_shared/zero-ambiguity-gate.md`. Record an approved larger option as
`Technical (complexity escalation)`. If the user defers it, keep it out of executable work.

---

## Execution mode — phase-scoped dispatch

Route by PHASE, not by task. The primary session keeps the plan, the decisions, and one short
summary per phase; the edits and tool output of a phase live in a fresh context that ends with it.

1. **Dispatch every phase of three or more tasks** to a fresh executor with the phase packet below
   — at both tiers. A `standard` phase runs on the `executor` role; a `critical` phase runs on the
   session model, unless routing explicitly pins the `demanding-executor` role, whose pin then
   wins. Routing picks a role's model and reasoning level; it never keeps a phase of three or more
   tasks inline. When the phase has `[spec-author]` tasks, the parent dispatches the spec-test
   author first and confirms the red state from its report, then dispatches the rest of the
   phase.
2. **Run a phase of fewer than three tasks inline** (§Inline phases).
3. **Parallelize only independent work.** Read-heavy reconnaissance and independent reviews are
   preferred candidates. Parallel writes require disjoint ownership and an explicit merge plan.
4. **Select reviewers by risk.** Every non-trivial phase's diff gets correctness review, at the
   time the plan's verification tier sets; add security,
   financial-integrity, concurrency, performance, semantics, or migration reviewers from tags.

**The phase report.** The executor returns one structured report and nothing else: for each task,
its id, the files changed, the verify command it ran with its one-line result (`PASS` with the
test count, or `FAIL` with the log path), and any blockers; then deviations from the packet and
open questions. The parent keeps a summary of at most ten lines per phase — never the transcript.

**The phase packet.** When a phase IS dispatched, the parent composes the packet; the executor
receives nothing else and must not need anything else:

- the phase's task lines, Deliverables, and Verify lines verbatim from `99-execution-plan.md`;
- the relevant excerpts of the governing `03-XX` spec documents (the excerpts, not filenames; a
  `standard` plan has none);
- the applicable ST-cases from `07-testing-strategy.md`, or the phase's `AC-n` rows from a
  `standard` plan's `## Acceptance criteria`;
- the AR decisions — or a `standard` plan's relevant `D-n` rows — that bear on the phase and any
  relevant approved complexity PF/RV decisions (quoted entries, not whole reports);
- the original goal and smallest viable design from `00-index.md` or the single document's
  `## Goal`, or the session-derived legacy
  baseline when the plan predates that section;
- the scope mode (`strict` or `explore`) and confirmed product scope baseline; missing or invalid
  scope context fails closed to strict mode. Missing or invalid original-goal or smallest-design
  context blocks dispatch;
- the target file paths, the phase baseline tree, and the task and gate verify commands;
- the phase's reasoning marker line (`[codeops-effort: <level>]`), resolved from the run's forced
  `--auto-effort=<level>` level, else the phase's `Reasoning:` suggestion; omitted when neither
  exists.

Excerpting owned content into a packet is the intended retrieval mechanism, not restatement. The
quoted AR/ST/spec content is context for the executor's *understanding* — it must not surface as a
citation in shipped code (the executor carries the same doc-standard ban and self-check).

**Reasoning marker.** Every dispatched unit — executor, reviewer, auditor, spec-test author,
specialist, or scout — receives one standalone marker line in its packet:

```text
[codeops-effort: medium]
```

Place it immediately after the `[codeops-dispatch …]` header for quality agents, or as the first
line for packets without a header. When neither the forced run level nor the phase suggestion
exists, add no marker: routing policy still applies, otherwise the child inherits the parent
variant. The marker is packet context; it never appears in shipped code comments. The
complexity-gate design challenger is excluded because its independence contract forbids extra
packet shaping.

**Applied-level reporting.** For every dispatch, report the level and its source in the dispatch
commentary, for example `Dispatch: executor — reasoning: medium (phase suggestion)`,
`— reasoning: high (routing default)`, or `— inherited`. Reporting is observational; it never
gates a dispatch.

**Inline phases.** When a phase runs inline (fewer than three tasks, or the host-without-subagents
fallback):

1. Print `Suggested reasoning: <level> — <reason>` before the phase's first task when the phase
   header carries the line.
2. Without `--auto-effort`, change nothing else — the session keeps its own variant.
3. With `--auto-effort`, set the session level for the phase through
   `python3 "${CODEOPS_PLUGIN_ROOT}/scripts/codeops_effort.py" set --dir "$CODEOPS_TMPDIR" --reasoning <level>`
   and update it when the next phase's suggestion differs; with `--auto-effort=<level>`, set that
   level once and keep it for the whole run. A phase without a `Reasoning:` line leaves the
   session level unchanged.
4. When `$CODEOPS_TMPDIR` is empty or the helper fails, print an advise-only note and continue.

**Division of labor.** The PARENT — never the executor — records progress: the executor never edits
`99-execution-plan.md`, the roadmap, or the findings ledger. The executor implements task-by-task,
runs verify per the Verify-output capture rule, and returns the phase report. From the report the
parent calls `mark --state implemented` and, for each task whose verify passed (trust the reported
result and spot-check it), `mark --state done`; it then runs the phase gate itself, computes the
verification balance from the phase's snapshot diff, and runs the post-phase step.

**Blocker path.** On ambiguity, missing packet context, or a failing SPEC test, the executor
stops and returns a blocker report. The parent then runs the zero-ambiguity loop above with the
applicable authority: normal mode or a reserved decision uses STOP → options → user decision →
AR `(runtime)` entry; active auto-design resolves and records an eligible technical decision under
the shared policy. The parent re-dispatches with the enriched packet. An executor never asks the
user directly, widens delegated authority, or guesses.

**Missing-executor guard.** If a named role is unavailable, spawn a generic subagent with the
complete packet and report it. Run a phase of three or more tasks inline only when the host offers
no subagents at all, and report that too. The protocol's guarantees hold either way.

---

## Specification-First Task Ordering (NON-NEGOTIABLE)

The ordering `spec tests → red phase → implement → green phase → impl tests → verify` is defined
ONCE in **[../../_shared/spec-first-ordering.md](../../_shared/spec-first-ordering.md)** — read it
before executing the first implementation task. Enforce it exactly as written there: never start
implementation before that feature's spec tests exist and have a recorded red phase, and apply the
immutable-oracle rule — a failing spec test means the implementation is wrong, never the test.

---

## Real-Time Execution Plan Update Mandate (ULTRA-CRITICAL)

`99-execution-plan.md` is the SINGLE SOURCE OF TRUTH for progress and the user's lifeline if a
session ends unexpectedly. Update it after completing EACH task. No exceptions.

### Update-first order (two-stage)

```
Implement task → 🚨 MARK [~] IN THE PLAN → verify → PASS: promote to [x] / FAIL: fix, stays [~] → commit → next task
```

NOT: batch-updating later, updating only at the end, or "maybe update and maybe forget". If the
agent crashes during verify or commit, the plan already reflects exactly how far the work got —
`[~]` says "implemented, verification not yet passed"; `[x]` says "verified complete".

### Update procedure

Record every transition with one call — the `codeops_progress` report for that moment (§Progress
Reporting) goes in the same step, as a parallel tool call:

```bash
python3 "${CODEOPS_PLUGIN_ROOT}/scripts/codeops_plan.py" mark --plan <plan-dir> --task <id> \
  --state implemented|done|blocked [--note "<short evidence or reason>"]
```

1. On implementation: `--state implemented` (`[ ]` → `[~]`); on verify pass: `--state done`
   (`[~]` → `[x]`); on a blocker: `--state blocked --note "<reason>"` (`[!]`, the visible reason
   the parser requires).
2. `mark` takes the timestamp from the system clock, replaces the task's status suffix, refreshes
   the header Progress counter (only `[x]` counts) and the Last Updated stamp, and prints the
   progress bar. It touches only the counted task line — never fenced or quoted examples — and
   repeating a transition changes nothing. No separate `date`, hand edit, or progress-bar step.
3. The same call serves a legacy (≤3.2.0) plan: its **Master Progress Checklist** lines are the
   plan's counted task lines (its phase sections carry task tables), so `mark` edits exactly them.

Task mark formats (what `mark` writes):

```markdown
- [~] 1.1.1 Task description ⏳ (implemented: YYYY-MM-DD HH:MM)
- [x] 1.1.1 Task description ✅ (completed: YYYY-MM-DD HH:MM)
- [!] 1.1.1 Task description 🚫 (Blocked: <reason>; YYYY-MM-DD HH:MM)
```

### Native progress mirror (visibility aid)

After every `[x]` promotion, show the deterministic progress line required by the per-task loop.
Where the session also provides a plan or goal UI, mirror the current phase's tasks and update their
statuses alongside the Markdown marks. Both displays are convenience layers only —
**`99-execution-plan.md` remains the durable source of truth**. Skip silently when unavailable.

### Task-list format detection (dual-format)

After loading the plan, detect its task-list format — both formats execute identically otherwise:

- A `## 🚨 Master Progress Checklist` section present → **legacy format (≤3.2.0)**: the checklist
  remains the single source of truth. Maintain it exactly as before — if it is missing task
  entries, or the section is absent while phase sections carry task TABLES, reconstruct it from
  the phase/session/task details (`- [ ] X.X.X [desc]`, grouped by phase) before any task
  execution begins.
- No such section AND the phase sections carry task checkboxes → **3.3.0 format**: the phase
  checkbox lists are the single source of truth. Do NOT create a Master Progress Checklist.
- Neither found → STOP (empty plan — see the load table).

Never suggest an upgrade on format grounds (AR-5, plans/plan-token-efficiency).

### Hard gate

Before running verification you MUST have already marked the task `[~]` (via `mark`). Before
committing, proceeding to the next task, ending a session, or presenting a session summary, the
task's final state MUST be recorded truthfully — `[x]` (with timestamp) only if its verify passed,
otherwise still `[~]` — with the progress counter and Last Updated stamp current.

---

## Progress Reporting (fail-soft)

While a plan executes, the agent may report live progress through the `codeops_progress` tool so
the sidebar shows the current run. Reporting is an observability aid only: the Markdown execution
plan remains the single progress source of truth, and a missing tool or a failed call never
blocks, delays, or changes any verify, commit, or plan update — when the tool is unavailable,
execution proceeds silently.

Report at these moments; `plan` is the plan folder name, and every call carries `plan` and
`activity` (absent optional fields are carried by the run state):

| Moment | Report payload |
| ------ | -------------- |
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

One call per listed moment, no other calls (noise control); a moment that coincides with a `mark`
transition is reported in the same step as that call. A reporting failure or a host without
the tool never blocks, delays, or changes any step.

---

## Step 3: Session Wrap-Up

1. Complete the current task before stopping.
2. **🚨 First: update `99-execution-plan.md`** with ALL completed tasks (before anything else).
3. Run the verify command (output captured per the Verify-output capture rule).
4. Handle the commit per the active commit mode (see [commit-modes.md](commit-modes.md)).
5. If this run set a session level through `--auto-effort`, clear it before the summary:
   `python3 "${CODEOPS_PLUGIN_ROOT}/scripts/codeops_effort.py" clear --dir "$CODEOPS_TMPDIR"`.
6. Report the session summary (must include `Execution Plan Updated: ✅`).
7. **Cleanup:** delete every temporary artifact this session created — verify logs under
   `$CODEOPS_TMPDIR`, scratch directories, temporary diffs — per
   `_shared/workspace-hygiene.md`, and report `Cleanup: done` or name what was kept and why.

### Session Summary Template

```markdown
## Session Complete

**Feature:** [feature-name]
**Execution Plan:** `plans/[feature-name]/99-execution-plan.md`
**Review Independence:** mixed-model | mixed-effort | uniform-effort
**Effort:** <requested>→<applied> (<mapping>)

**Completed This Session:**
- [x] Phase X, Task X.X.X: [description]
- [x] Phase X, Task X.X.X: [description]

**Remaining Work:**
- [ ] Phase X, Task X.X.X: [description]
- [ ] Phase Y: [phase description]

**Carried forward:** [phases still awaiting the completion review | none]
**Execution Plan Updated:** ✅ `99-execution-plan.md` reflects all completed work
**Verification:** [Status — e.g., "All tests passing", "Build successful"]
**Commit Mode:** [ask-commit | no-commit | auto-commit]
**Commit:** [hash] / "Committed successfully" / "Uncommitted — user deferred" / "No-commit mode"

**To Continue:**
Run `/exec-plan [feature-name]` again in a new session.
```

Omit the `Effort:` line when no level is active; never write `default`. Both lines are disclosure,
never a gate.

---

## Error Handling During Execution

### If verification fails

1. The task's mark stays `[~]` (it was set at implementation time — never promote on a failing
   verify).
2. Fix the failing tests/build (for a failing SPEC test, fix the implementation — never the test).
3. Re-run verification until all checks pass.
4. Only then promote the mark to `[x]`.

**Convergence guard:** after three consecutive failures with the same failure signature (the same
failing tests, compiler errors, or command failure), stop retrying. Classify the blocker as one of:
implementation defect, stale/impossible plan, pre-existing repository failure, or environment/tool
failure. Present evidence and the viable next action to the user. A materially different failure
signature resets the counter; expected red-phase failures do not count.

### If implementation deviates from the plan

A deviation is by definition territory the plan doesn't cover — route it by materiality:

- **Material deviation** (different approach, different files, different behavior than the plan
  specifies): run the Zero-Ambiguity loop above — STOP, present the deviation with options in
  normal mode, or apply active auto-design to an eligible technical choice and escalate a reserved
  choice. Record the authorized resolution in `00-ambiguity-register.md` tagged `(runtime)` (a
  `standard` plan: a `(runtime)` `D-n` row in its `## Decisions` table) and update the task
  description. If it changes artifacts outside the selected plan, obtain approval
  for the exact expanded modification set before editing, then continue.
- **Mechanical correction** (typo'd path, renamed symbol, an import the plan forgot): note it in
  the execution plan and continue — no user round-trip needed.

When unsure which it is, treat it as material.

### If a session is interrupted mid-task

1. Save progress so far.
2. Ensure the task is marked `[~]` with a clear partial-completion note (what is done, what
   remains, what to verify).
3. Do NOT commit the half-done task (the commit gate keys off `[x]`).
4. Resume later by running `/exec-plan [feature-name]` again — Step 1 finds the `[~]` task,
   resumes it first, and re-verifies before promoting.
