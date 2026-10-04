# Ambiguity Register: adaptive-reasoning-effort

> **Status**: ✅ GATE PASSED — 23 planned items resolved; 1 runtime item added during execution
> **Last Updated**: 2026-10-04 12:46

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope | How aggressive should the plugin be when no explicit effort is requested? | Marker-only / Marker + routing defaults / Full auto-classification | Marker + routing defaults | ✅ Resolved |
| 2 | Feature | At what granularity does make-plan suggest an effort? | Per phase / Per phase + per task / Plan-level only | Per phase (phases and mini-plans) | ✅ Resolved |
| 3 | Behavior | Should CodeOps change the user's own session effort, or only advise? | Advise-only / Auto-apply always / Opt-in per run | Opt-in `--auto-effort`; advise-only otherwise; announced, run-scoped, fail-open | ✅ Resolved |
| 4 | Technical | Which reasoning levels are offered? | deepseek flash built-ins / full OpenCode enum | `low` / `medium` / `high` / `max` | ✅ Resolved |
| 5 | Scope | Which skills accept `--auto-effort`? | Three named / Reasoning-heavy seven / All CodeOps skills | Reasoning-heavy seven | ✅ Resolved |
| 6 | Behavior | How does exec-plan treat phases it runs inline? | Marker for dispatches + flag for inline / Always apply per phase / Dispatches only | Marker for dispatches; suggestion printed inline; session effort only with `--auto-effort` | ✅ Resolved |
| 7 | UX | Does `--auto-effort` accept an explicit level? | Bare flag only / Bare flag + `--auto-effort=<level>` | Both forms supported | ✅ Resolved |
| 8 | Naming & terminology | Which recommended level per skill? | Accept table / Adjust rows | Accepted the table in 03-01 §Skill recommendation table | ✅ Resolved |
| 9 | Technical | Exact marker grammar and duplicate handling | Option A / Option B | `[codeops-effort: <level>]` on a standalone line; exact lowercase level; first valid marker wins; malformed or unknown markers ignored | ✅ Resolved |
| 10 | Technical | Where can an effort be enforced at runtime? | Task-tool parameter / plugin hooks / tiered agents | Plugin `chat.message` (capture) + `chat.params` (apply) | ✅ Resolved |
| 11 | Technical | How does a parent skill apply its own run-scoped effort? | Custom plugin tool / helper script + per-session state file / env var | `scripts/codeops_effort.py` writes `$CODEOPS_TMPDIR/reasoning-effort.json`; the plugin reads it per request | ✅ Resolved |
| 12 | Behavior | Override precedence when several sources exist | — | Dispatch marker > session auto-effort > routing role default > inherit parent variant | ✅ Resolved |
| 13 | Technical | Which routing entries may override effort? | Built-in catalog defaults / explicit routing entries only | Explicit `routing.roles[<agent>].reasoning` only; no built-in defaults; no installer default change | ✅ Resolved |
| 14 | Behavioral | How is a supported level applied to provider options? | Direct key rewrite / model-variant mapping | If the runtime model exposes `variants[level]`, merge those options; else set `reasoningEffort` when reasoning is supported; otherwise skip unchanged | ✅ Resolved |
| 15 | Edge cases | State-file races, parse errors, and lifecycle | — | Atomic temp-file + rename write; invalid JSON means no override; in-memory marker map keyed by message ID; state cleared on session deletion | ✅ Resolved |
| 16 | Security & compliance | Untrusted input reaching provider options | — | Level allowlist; marker read only from user-role text parts; state path must resolve under the CodeOps temp root; no prompt text or secrets logged | ✅ Resolved |
| 17 | Scope | Explicit exclusions | — | No `install_agents.py` default change; no model pins; no temperature/`effort` change; no OpenCode changes; no new dependency; no `inherit` marker; plans without a `Reasoning:` line keep inherited behavior | ✅ Resolved |
| 18 | Naming & terminology | Artifact and test names | — | `_shared/reasoning-effort.md`; `bin/lib/reasoning-effort.mjs` (+ `.d.mts`); `scripts/codeops_effort.py`; `reasoning-effort.json`; tests `bin/reasoning-effort.{spec,impl}.test.mjs`, `scripts/effort.spec.test.mjs`, `scripts/reasoning-effort-content.spec.test.mjs` | ✅ Resolved |
| 19 | Technical | Does this feature trigger the Complexity Escalation Gate? | Escalation / no escalation | No escalation — direct feature code, one pure helper, one CLI helper, and existing plugin/doc patterns; no new layer, dependency, or infrastructure | ✅ Resolved |
| 20 | Non-functional gaps | Which domain lenses apply? | — | Light distributed/concurrent (cross-process session state); compiler, financial, web, and migration lenses do not apply (evidence in 02-current-state) | ✅ Resolved |
| 21 | Feature | Specialist-agent gap check | Candidate / none | **None** — the catalog roles and dynamic packets already cover this plugin repository; no specialized framework or recurring hotspot | ✅ Resolved |
| 22 | Technical | Verification command for every task | — | `npm run verify` (type-check + `node --test` + version parity), per `AGENTS.md` | ✅ Resolved |
| 23 | Non-functional | Versioning and changelog ownership | — | MINOR release; `CHANGELOG.md` is written only by `scripts/release.mjs` during release, never by plan tasks | ✅ Resolved |
| 24 | Technical (runtime) | `--auto-commit` cadence while the spec-first red phase makes `npm run verify` fail | Per-task commits including red pushes / Green-only commits / Local commits with deferred push | Green-only commits — defer commits while verify is red; commit at the first green point (covering the spec and implementation tasks), then per verified task; pushes target `main`, so a red intermediate push is not acceptable | ✅ Resolved |

### Resolution Notes

**AR-1:** A marker-only design would leave every existing subagent inheriting the parent `max` variant until a plan carries markers. Routing defaults are project policy the user already configures, and the plugin applies them only when an explicit role entry exists (AR-13).

**AR-2:** Per-phase matches the exec-plan dispatch unit (a phase is normally dispatched whole; `execution-protocol.md` §Execution mode). Per-task suggestions were rejected as plan noise, and plan-level cannot express a trivial phase next to a critical one.

**AR-3:** `--auto-effort` is parsed exactly like `--auto-design` / `--explore-scope` (one exact standalone token before the first `--` sentinel). The flag never changes permissions or gates; it is announced and run-scoped, and it fails open when the helper or plugin support is unavailable.

**AR-4:** The runtime evidence is `provider/transform.ts`: the deepseek flash model (this session's model; its API id contains `deepseek-v4`) under `@ai-sdk/openai-compatible` exposes exactly `low`, `medium`, `high`, `max`, each mapped to `reasoningEffort`; without the `deepseek-v4` id only `low`/`medium`/`high` exist. No `none`/`xhigh` is offered so a suggestion can never name an unsupported value for the assumed default model.

**AR-5:** The seven are: make-requirements (including review_requirements and add_requirement), make-plan, preflight, grill-me, exec-plan, retro-requirements, upgrade-plan. Other skills remain advise-only; the shared table still documents their recommended levels.

**AR-6:** Dispatched executors, reviewers, spec authors, and scouts always receive the phase marker. Inline phases print `Suggested reasoning: <level> — <reason>`; only `--auto-effort` changes the session effort for inline work.

**AR-7:** `--auto-effort` uses the skill's recommended level; `--auto-effort=<level>` must name one of the four levels and is rejected otherwise (same standalone-token parsing rules).

**AR-8:** Table accepted as presented: make-requirements / make-plan / preflight / grill-me / retro-requirements / upgrade-plan = `high` (preflight `max` with `--thorough`); exec-plan = per phase; techdocs / analyze-project / clean-comments / outcome-review = `medium`; roadmap / git-commit / github-issues = `low`; setup-codeops / setup-routing = `high` (advise-only).

**AR-9:** The marker is deliberately distinct from the plan's human-readable `> **Reasoning**: <level>` line so a quoted phase line can never be mistaken for a machine directive. First valid marker in user-role text parts wins; extra markers are ignored.

**AR-10:** OpenCode's `task` tool has no model or effort parameter (`tool/task.ts` parameters are `description`, `prompt`, `subagent_type`, `task_id`, `command`, `background`). Variant options merge after agent options (`session/llm/request.ts`), so only the plugin's `chat.params` hook can reliably override an inherited parent variant.

**AR-11:** A custom tool was rejected because it would add a permanent tool to every session's context; the helper script matches the existing `codeops_*.py` + `$CODEOPS_TMPDIR` pattern. The skill already has `$CODEOPS_TMPDIR` exported by the plugin's `shell.env` hook, and the plugin computes the same path from the session ID, so no new environment variable is needed.

**AR-12:** The marker is the most specific per-dispatch intent; a session flag is the user's explicit opt-in for that run; a routing role entry is project policy; otherwise current inherit behavior is preserved.

**AR-13:** Routing lookup uses the dispatching agent's name (for example `executor`). Hand-authored agents with no routing entry keep their own configuration. Generated specialists keep their embedded `reasoningEffort` unless the project adds a routing entry for them.

**AR-14:** OpenCode's own variant mapping is the provider-aware source (for example `reasoningEffort` for OpenAI-compatible, `reasoning.effort` for OpenRouter). When `variants` is unavailable at runtime, `reasoningEffort` is the documented passthrough for the assumed deepseek default.

**AR-15:** The plugin process is single-threaded, so the in-memory marker map cannot race with itself; the file path is written by exactly one skill run per session. A missing, partial, or non-JSON state file is treated as "no session effort".

**AR-16:** A marker can at most change a reasoning level; it can never inject arbitrary provider options, permissions, or models. Unknown levels are dropped before any option write.

**AR-22:** The repository's `AGENTS.md` names `npm run verify` as the full verify command; no Verify line may invent a different command.

**AR-24 (runtime):** Auto-commit pushes to `origin/main`. Spec-first tasks write failing specification tests by design, so per-task commits would push a red commit and break continuous integration. The user chose green-only commits: marks still update after every task, but the git operation waits for the first verify-passing point and then resumes per verified task.

**AR-9–AR-23 (bulk acceptance):** On 2026-10-04 the user confirmed all fifteen recommendation rows in one explicit decision; each User Decision cell above spells out the accepted option verbatim.
