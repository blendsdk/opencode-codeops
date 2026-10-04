# Current State: Adaptive Reasoning Effort

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## What Exists

### The plugin runtime (`plugin/index.ts`)

The plugin registers four hooks today:

| Hook | Purpose | Location |
| ---- | ------- | -------- |
| `event` | Inject standards on session create/compact; temp-dir lifecycle on create/delete | `plugin/index.ts:154` |
| `experimental.session.compacting` | Keep standards through compaction | `plugin/index.ts:173` |
| `shell.env` | Export `CODEOPS_PLUGIN_ROOT` and `CODEOPS_TMPDIR` into every shell | `plugin/index.ts:188` |
| `tool.execute.before` | Advisory guard for `codeops/.codeops.yml` edits | `plugin/index.ts:203` |

There is no `chat.message` or `chat.params` hook, so CodeOps cannot currently observe or change
anything about an LLM request. The plugin already owns a per-session temp directory through
`bin/lib/tmp-hygiene.mjs`: `sessionTmpDir(sessionID)` (`:75`) derives
`<os-temp>/opencode/codeops/<sanitized-session-id>`, `ensureSessionTmpDir` (`:90`) creates it, and
`removeSessionTmpDir` (`:162`) deletes it when the session is deleted.

### Agent files and routing policy

The twelve catalog agents in `agents/*.md` set `temperature` and permissions only — no `model` and
no reasoning option (for example `agents/executor.md:4-15`). Generated project specialists embed
`reasoningEffort` defaulting to `max` (`scripts/install_agents.py:555-563`), and routing policy may
override it through `routing.roles.<role>.reasoning` — the enum is already declared in
`schemas/codeops-config.schema.json:43`. `_shared/quality-profile.md:139-152` documents the static
resolution order (explicit request, project agent, project defaults, parent session), and the
`setup-routing` skill documents the role policy (`skills/setup-routing/routing.md`).

### Skill option parsing

Reasoning-heavy skills parse standalone flags before the first `--` sentinel with a fixed pattern:
exactly one occurrence, remove before resolving targets, announce the mode, then follow a shared
document (`skills/preflight/SKILL.md:18-34`). There is no effort flag today.

### Helper scripts and tests

`scripts/codeops_outcomes.py` establishes the Python CLI pattern: `argparse`, `from __future__
import annotations`, strict enum validation, and exit code 2 on invalid values. JavaScript
specification tests spawn real Python executables against temporary fixtures
(`scripts/install_agents.spec.test.mjs:1-90`), and pure helper modules are tested directly with
`node:test` (`bin/tmp-hygiene.impl.test.mjs`). Content guards assert required clauses in shipped
documents (`scripts/specialist-content.spec.test.mjs`). `_shared/` and `references/` are installed
beside the skills by `bin/install-skills.mjs:59`.

## OpenCode Runtime Evidence

These facts were verified against the OpenCode source for the running release (1.18.34); they are
the reason the runtime override must live in the plugin hook, not in agent files.

| Fact | Evidence |
| ---- | -------- |
| The `task` tool accepts only `description`, `prompt`, `subagent_type`, `task_id`, `command`, `background` — no model or reasoning parameter. | `packages/opencode/src/tool/task.ts`, `BaseParameterFields` |
| A subagent with no model pin inherits the parent's model **and variant**: `variant: next.model ? undefined : variant`. | `packages/opencode/src/tool/task.ts:181-209` |
| Provider options merge `base → model.options → agent.options → variant`, so the inherited variant overrides an agent's `reasoningEffort`. | `packages/opencode/src/session/llm/request.ts:91`, `const options = mergeOptions(...)` |
| The plugin `chat.params` hook can mutate the final `options` record per request and therefore has the last word. | `packages/opencode/src/session/llm/request.ts:114-130` (the hook receives the post-merge `options`) |
| `chat.message` runs when the user message is resolved, before the LLM request, and `chat.params` later receives that same user message (`message: input.user`). | `packages/opencode/src/session/prompt.ts:999-1009`; `request.ts:114-121` |
| The deepseek flash model (this session's model) exposes the `low`/`medium`/`high`/`max` variants on the OpenAI-compatible transport, each mapping to `reasoningEffort`, because its API id contains `deepseek-v4`; without that id only `low`/`medium`/`high` exist. | `packages/opencode/src/provider/transform.ts` `@ai-sdk/openai-compatible` case (`WIDELY_SUPPORTED_EFFORTS`; the `deepseek-v4` check adds `max`) |
| An agent config may declare `variant` and `options`, but the parent's explicit variant wins when the task tool passes it down. | `packages/opencode/src/agent/agent.ts` (`Info`), `session/prompt.ts` variant resolution |

## Gaps

| # | Gap | Consequence | Owner |
| - | --- | ----------- | ----- |
| 1 | No runtime hook observes or overrides effort | A parent on `max` starts every subagent at `max` | 03-02 |
| 2 | Agent-file options lose to the inherited variant | Writing `reasoningEffort` in catalog agents would not fix it | 03-02 |
| 3 | No plan-level effort guidance | Users cannot see or steer per-phase cost before a dispatch | 03-03 |
| 4 | No opt-in session control | A skill cannot lower or raise the session's own effort for one run | 03-02, 03-03 |
| 5 | `routing.roles.*.reasoning` exists but is never applied at runtime for catalog agents | Policy is recorded but inert for dispatches | 03-02 |

## Domain-Lens Assessment (AR #20)

| Lens | Applies? | Evidence |
| ---- | -------- | -------- |
| Compiler and language | No | No grammar, IR, protocol codec, or type checker is touched. |
| Financial system | No | No money, balances, pricing, or ledger behavior. |
| Web application | No | No browser UI, HTTP API, sessions, or tenant resources. |
| Data and migration | No | The session state file is ephemeral scratch deleted with the session; no durable schema or format evolution. |
| Distributed and concurrent (light) | Yes | The plugin process and a skill's shell process exchange state through one per-session file; the design must handle partial writes and concurrent sessions (03-02 §Session state file). |

## Files This Feature Changes

New: `_shared/reasoning-effort.md`, `bin/lib/reasoning-effort.mjs` (+ `.d.mts`),
`scripts/codeops_effort.py`, `bin/reasoning-effort.spec.test.mjs`,
`bin/reasoning-effort.impl.test.mjs`, `scripts/effort.spec.test.mjs`,
`scripts/reasoning-effort-content.spec.test.mjs`.

Changed: `plugin/index.ts`, `skills/make-plan/{SKILL.md,templates.md}`,
`skills/exec-plan/{SKILL.md,execution-protocol.md}`, `skills/make-requirements/SKILL.md`,
`skills/preflight/SKILL.md`, `skills/grill-me/SKILL.md`, `skills/retro-requirements/SKILL.md`,
`skills/upgrade-plan/SKILL.md`, `skills/setup-routing/{SKILL.md,routing.md}`,
`_shared/quality-profile.md`, `README.md`.

Unchanged by design (AR #17): `scripts/install_agents.py`, `agents/*.md`, `agent-templates/*`,
`schemas/codeops-config.schema.json`, `package.json`, `CHANGELOG.md` (release-script owned).
