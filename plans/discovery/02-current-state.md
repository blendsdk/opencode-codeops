# Current State: discovery

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

- **Plugin entry** `plugin/index.ts` (449 lines): one `Plugin.define` whose `setup(ctx)` reads
  `ctx.location.directory` (`:222`), subscribes to host events and handles `session.deleted`
  (`:251-263`), injects standards, applies reasoning effort, exports `CODEOPS_PLUGIN_ROOT` /
  `CODEOPS_TMPDIR` to shells, and registers the `codeops` RPC and the `codeops_progress` tool
  behind feature detection with content-free warnings (`:399-438`). Cleanup aborts the event
  subscription (`:445-447`).
- **Per-request config read**: `readRoutingConfig(directory)` re-reads `codeops/codeops.json` on
  every request and returns `{}` on any failure (`plugin/index.ts:161-167`). Discovery's opt-in
  check follows the same pattern (AR-45).
- **Tool registration pattern**: `registerCodeOpsProgressTool` (`bin/lib/codeops-progress.mjs:537-564`)
  feature-detects `ctx.tool.transform`, adds one tool with JSON-Schema `input`/`output`, uses an
  `async execute` (the host rejects a synchronous return), returns `{ output: … }`, and never
  throws.
- **Helper module convention**: framework-free `bin/lib/*.mjs` with `.d.mts` declarations imported
  by `plugin/index.ts`; host-free so `node --test` exercises them directly.
- **Fake-context plugin tests**: `plugin/progress-server.spec.test.mjs` imports `plugin/index.ts`
  through Node type stripping and drives `setup` with a fake context.
- **User data precedent**: `scripts/codeops_outcomes.py:41-50` stores data under
  `$CODEOPS_DATA_DIR` or `~/.local/share/opencode/codeops/`. Discovery uses the same base (AR-34).
- **Build precedent**: `scripts/build-tui.mjs` compiles `plugin/tui.tsx` into the committed
  `plugin/tui.js`; `scripts/tui-entry-build.spec.test.mjs` fails when it is stale. That suite also
  runs `npm pack --dry-run --json` (`plugin/tui-foundation.spec.test.mjs:117`), so any new
  `prepack` adds a build to that path. Discovery builds at publish instead (AR-37).
- **Config schema**: `schemas/codeops-config.schema.json` has `additionalProperties: false` at the
  top level and `metrics.enabled` as the precedent for a capability switch (`:49-55`). Missing
  quality configuration selects strict defaults (`_shared/quality-profile.md` §Parsing, absence,
  and ownership).
- **Shared docs install**: `bin/install-skills.mjs:59` installs `_shared/` and `references/` beside
  the skills, so a new `_shared/discovery.md` resolves from `../../_shared/discovery.md`.
- **Question flows today**: `make-plan` Phase 1.1 interview and Phase 1C register review
  (`skills/make-plan/SKILL.md:160-220`); `preflight` Step 5 presents findings by severity with
  batch pacing (`skills/preflight/report-format.md:109-155`); all in chat.
- **Packaging and CI**: `package.json` `files` whitelist (`:27-48`); scripts `verify`,
  `prepublishOnly`; CI runs `npm ci --ignore-scripts`, `npm run verify`, `npm pack --dry-run`
  (`.github/workflows/ci.yml`); the release refuses a dirty tree (`scripts/release.mjs:260`).

### Host API Evidence (OpenCode v2, `@opencode/plugin` 2.0.26)

| Capability | Evidence | Status |
| --- | --- | --- |
| Tool context carries `sessionID` and `signal` | `@opencode/schema/dist/tool.d.ts:10-11`; `signal` added by `@opencode/plugin/dist/promise/tool.d.ts:11-14` | Verified (types) |
| Register / reload tools | `ctx.tool.transform`, `ctx.tool.reload` (V2 plugin docs §Tools) | Verified (docs) |
| Post a prompt into a session | `ctx.session.prompt(SessionPromptInput)`; input has `text`, `delivery?: "steer" \| "queue"`, `resume?` (`@opencode/client/dist/promise/generated/types.d.ts:5527-5600`) | Types verified; behaviour unverified → spike A |
| Plugin instance per location | `ctx.location` = `{directory, workspaceID?, project: {id, directory, canonical}}`; "not the location of every session it can access" (V2 plugin docs §Context) | Verified (docs); tool routing unverified → spike C |
| Shared process state across instances | Not documented | Unverified → spike B |
| Service outlives the terminal UI | Not documented (`opencode service status/restart` exist) | Unverified → spike D |
| Plugin HTTP routes on OpenCode's server | Not offered by the plugin API | Confirmed absent → own listener |

### Relevant Files

| File | Purpose | Changes Needed |
| --- | --- | --- |
| `plugin/index.ts` | Plugin setup | Discovery wiring: opt-in check, listener start, tools, waker, `session.deleted` (03-05) |
| `schemas/codeops-config.schema.json` | Project config schema | `discovery` object (03-05) |
| `package.json`, `package-lock.json` | Scripts, files, devDependencies | `build:discovery`, `prepack`, typecheck of the UI, UI devDependencies, `files` (03-06) |
| `.gitignore` | Ignore list | `discovery-ui/dist/` (03-06) |
| `_shared/zero-ambiguity-gate.md` | Gate protocol | Discovery transcription rules (03-07) |
| `skills/make-plan/SKILL.md` | Planning skill | Phase 1.1/1C adoption, `--no-discovery` (03-07) |
| `skills/preflight/SKILL.md`, `report-format.md` | Audit skill | Step 5 adoption, `--no-discovery` (03-07) |
| `skills/analyze-project/SKILL.md` | AGENTS.md guidance | `--with-discovery` / `--without-discovery`, managed line (03-07) |
| `README.md`, `CHANGELOG.md` | Docs | Discovery section and entry (03-07) |

## Gaps Identified

### Gap 1: Questions live only in chat
**Current behaviour:** questions, explanations, and answers scroll away in the terminal.
**Required behaviour:** published questions persist per project and plan and are answered in the
browser (R3–R7).
**Fix required:** rules, store, server, UI (03-02…03-06).

### Gap 2: No way for the agent to continue without a typed prompt
**Current behaviour:** the user types the answers or "continue".
**Required behaviour:** Submit wakes the owning session exactly once (R8).
**Fix required:** waker in the plugin (03-05), proven by spike A (03-01).

### Gap 3: No opt-in switch
**Current behaviour:** the schema rejects unknown top-level keys.
**Required behaviour:** `discovery.enabled` / `discovery.chatMaxQuestions` validate and switch the
capability immediately (R1).
**Fix required:** schema, plugin opt-in check, `analyze-project` flags (03-05, 03-07).

## Dependencies

### Internal Dependencies
- `codeops_progress` registration pattern and fake-context test style.
- `readRoutingConfig`-style per-request config read.
- `_shared/` installation by `bin/install-skills.mjs`.

### External Dependencies
- Runtime: none new (the UI is bundled; plugin modules use Node built-ins).
- Development only: `react`, `react-dom` (19), `@fluentui/react-components` (v9),
  `@fluentui/react-icons`, `esbuild`, plus the type-only `@types/react` and `@types/react-dom`
  (AR-36).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| `ctx.session.prompt` does not start a turn on an idle session | Med | High | Spike A first; fallback: the answers tool waits for Submit (AR-19) |
| Plugin instances do not share module/global state | Med | Med | Spike B; fallback: one listener per project on an OS-assigned port (AR-19) |
| Fluent's runtime styles blocked by CSP | Med | Med | Per-request nonce through Griffel's renderer (03-06 §CSP); render smoke test |
| Duplicate `@griffel/*` copies drop the nonce | Low | Med | Build test asserts a single Griffel copy (07 ST-50) |
| `npm ci --ignore-scripts` and esbuild's platform binary | Low | Med | esbuild ships platform binaries as optional dependencies; CI runs the build test |
| Agent ignores Discovery and asks in chat | Med | Low | Content tests pin the skill instructions (07 ST-56…ST-61); chat remains a valid fallback |
| Two OpenCode processes edit the same plan | Low | Low | Re-read before atomic write (AR-46) |
| Plan data contains code evidence | Med | Low | Local only, 0700/0600 permissions (AR-29) |
