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
CodeOps skill text at a fixed ref. The subjects are past features of this repository, and agents
asked to rebuild existing code go looking for it — in other checkouts, git history, installed
packages, the npm registry, GitHub, and web search. Prompt rules do not reach the subagents an arm
dispatches, so isolation is enforced by the OS, not by instructions.

```bash
python3 scripts/bench/harness/run_arm.py <M|S> <n> <ref-sha> [--pin-tier] [--workflows a,b]
```

Outputs (results, logs, diffs, acceptance specs, per-arm session databases) go to
`~/.local/state/codeops-bench/`; inputs live in `$TMPDIR/bench-lean/`.

1. **Process-only ref** (`harness/build_ref.py`). A copy of `skills/`, `_shared/`,
   `agent-templates/`, `standards/`, `references/`, `schemas/`, and the process scripts — never
   product code. Python tools become stubs that run compiled bytecode, text that documents a
   subject's deliverable is removed, and the build fails if a subject answer remains. Arms read
   skills **by path** (never through the skill tool) and substitute `${CODEOPS_PLUGIN_ROOT}` with
   the ref path; reviewer and executor roles are generic subagents carrying the ref's template text.
2. **Standalone subject.** `git init` plus a shallow fetch (`--depth 30`) of the subject's base
   commit, `FETCH_HEAD` deleted: no later commit or object is reachable. `npm ci` runs before the
   arm and is not measured. M arms pin `quality.verificationTier: standard`.
3. **Sandbox** (`harness/sandbox.py`, bubblewrap). Root filesystem read-only; `/home`, `/tmp`,
   `/var/tmp`, and `/run/user` are empty tmpfs mounts with only the ref, its tools, the arm's
   packet and workspace, node, and the opencode binary mounted back; globally installed CodeOps
   packages are hidden. OpenCode runs as a private standalone server on a seeded data directory
   (schema, migrations, credentials, model catalog — no sessions) and a config with no plugins and
   no global skills; the ref's standards load through `instructions`. The CodeOps plugin is off for
   every arm (its package contains subject answers).
4. **Network** (`harness/netproxy.py`). The sandbox has its own network namespace with loopback
   only. HTTPS goes through an allow-listed CONNECT proxy (model API host only); npm goes through a
   filtering registry mirror that refuses `opencode-codeops`. Every attempt is logged; denials are
   recorded per arm.
5. **Run.** `opencode run --standalone -m <model> --title bench-<subject>-<workflow>-<ref>-<n>
   --auto "<prompt>"`, one sibling session per workflow on the same subject, pinned to the user's
   working model. The prompt forbids the `question` tool (a headless run cannot answer it): the arm
   answers from its packet or takes the recommended option and logs an assumption.
6. **Measure and check.** `bench.py sessions --db <arm db>`; the subject's original spec files
   copied over the arm's own plus the subject's `npm run verify`; an automatic audit of every
   tool input for paths outside the arm's roots; the main checkout's `git status` unchanged.
7. **Repeat.** Baselines run more than once; the decision band is max(10%, observed spread); a pass
   inside the band gets one confirming re-run; report medians.
