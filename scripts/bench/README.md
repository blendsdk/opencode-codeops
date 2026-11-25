# bench — CodeOps measurement kit (dev-only)

Measures what CodeOps workflows cost, from OpenCode's local database, so every change to the
skills can be compared before and after with numbers. This folder is excluded from the npm package.

The kit is **read-only** and **content-free**: it opens the database with `mode=ro`, reads tool
inputs (paths, commands, agent names) only in memory to classify calls, and prints counts and
classes — never message, prompt, command, or file text.

## Commands

```bash
# One session and every subagent session under it
python3 scripts/bench/bench.py sessions --root <session-id> [--json]

# Several session trees, one row each
python3 scripts/bench/bench.py sessions --ids <id,id,...> [--json]

# Plan folders: documents, KB, tasks, verification tasks, spec cases/ACs, decisions
python3 scripts/bench/bench.py plans plans/<a> plans/<b> [--json]

# Static instruction footprint of every skill at a CodeOps checkout
python3 scripts/bench/bench.py instructions --ref <checkout> [--json]
```

`--db` (or `OPENCODE_DB`) overrides the default `~/.local/share/opencode/opencode.db`.

## Metric definitions

| Metric | Definition |
|---|---|
| fresh | input + output + reasoning + cache.write, summed over assistant **and compaction** messages of the tree |
| cached | cache.read over the same messages |
| messages | assistant messages in the tree (compactions are counted separately) |
| steps | assistant messages of the named (primary) session only |
| ctx per step | input + cache.read + cache.write of one primary assistant message; median and p90 (nearest rank) |
| edits | primary `edit`/`write`/`patch` targets, classed as `artifacts` (`plans/`, `requirements/`, `codeops/`), `tests` (test naming or test folders), or `product` |
| bookkeeping calls | primary edits that touch an artifact, plus shell calls that run `date` or `codeops_plan.py` with `--progress-bar` or `mark` |
| review rounds / dispatches | primary steps that dispatch at least one subagent whose agent or description names review, audit, or refute / the number of such dispatches |
| verification tasks | numbered plan tasks whose leading phrase runs or checks (run, verify, review, audit, red, green, gate, confirm, check, smoke, full verification) or authors tests (write/add/author/extend whose object near the start is tests, a test file, or fixtures) |
| instruction tokens | characters / 4 of SKILL.md plus linked Markdown, two levels deep; a link is conditional when its line names a flag, tier, or condition |

OpenCode stores a message's tool calls either in the message's `content` list or in
`session_part` rows; the kit reads both.

## Arm protocol (A/B runs)

An *arm* is one workflow run (make-plan, preflight, or exec-plan) on a fixed subject, following the
CodeOps skill text at a fixed ref. Subagent sessions cannot dispatch subagents, so every arm is a
**headless root session**.

1. **Ref checkout.** `git worktree add --detach $CODEOPS_TMPDIR/ref-<sha> <sha>` for the CodeOps
   ref under test. The arm reads `skills/<name>/SKILL.md` and `_shared/` **by path** from there
   (never through the skill tool) and substitutes `${CODEOPS_PLUGIN_ROOT}` with that path.
   Reviewer and executor roles run as generic subagents whose packet carries the ref's
   `agent-templates/` text. Plugin hooks stay at the installed version for every arm.
2. **Subject worktree.** `git worktree add --detach $CODEOPS_TMPDIR/subj-<arm> <base>`; run the
   install step (`npm ci`) before the arm starts — it is not measured. Post-Wave-1 arms pin
   `quality.verificationTier: standard` in the worktree's `codeops/codeops.json`.
3. **Run.** From the subject worktree:
   `opencode run -m <model> --title bench-<subject>-<workflow>-<ref>-<n> --archived --auto "<prompt>"`
   with `-m <provider/model#variant>` pinned to the user's working model (the headless default
   differs; record it). The arm prompt names the ref path, the workflow, the input packet,
   `--no-commit`, forbids pushing, and forbids the `question` tool: a headless run cannot answer
   it, so the arm answers from the input packet or takes the recommended option. Each workflow is its own sibling session on the
   same worktree.
4. **Inputs.** Identical across arms (see the plan's §Measurement method). Questions the inputs do
   not answer: take the skill's recommended option and log it as an assumption.
5. **Measure.** Find the session ID by title, then `bench.py sessions --root <id> --json`. Check
   the subject's acceptance tests in the worktree, and that the main checkout's `git status` is
   unchanged.
6. **Repeat.** Baselines run more than once; the decision band is max(10%, observed spread); a pass
   inside the band gets one confirming re-run; report medians.
7. **Clean up.** `git worktree remove` both worktrees.
