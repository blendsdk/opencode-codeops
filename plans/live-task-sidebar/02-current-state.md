# Current State: live-task-sidebar (slices 0–1)

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

**Plan parser (slice 0 target).** `scripts/codeops_plan.py` (239 lines) is the read-only progress
oracle: it discovers flat and nested plans, parses the execution checklist, derives lifecycle,
counts, resume candidate, and problems, and renders JSON or a ten-cell progress bar. Its task
regex is the defect:

```python
TASK_RE = re.compile(r"^-\s*\[([ xX~!])\]\s+(.+?)\s*$", re.MULTILINE)   # scripts/codeops_plan.py:24
```

`parse_tasks` (lines 70–72) returns every match; `inspect_plan` (lines 130–169) counts them and
picks `next_task` (lines 75–79) from them. A probe against the make-plan template showed
deliverables checkboxes and quoted example lines are counted as tasks.

**Consumers of the parser** (JSON and progress-bar output must stay compatible):

| Consumer | Usage |
| -------- | ----- |
| `skills/exec-plan/execution-protocol.md:113-121` | `--progress-bar` line after every `[x]` promotion |
| `skills/roadmap/SKILL.md:27` | `--json` for stage/lifecycle inference |
| `skills/upgrade-plan/SKILL.md:76`, `skills/setup-codeops/SKILL.md:76`, `skills/setup-codeops/migration.md:24` | `--json` for status and verification |
| `scripts/codeops_plan_migrate.py:20-22,233-235` | imports `parse_tasks` in-process for its preview problems; its task-presence admission stays checkbox-line based (FR-12) |

**Server plugin.** `plugin/index.ts` (396 lines) is the always-on plugin: standards injection
(`:258-264`), reasoning-effort capture/apply (`:271-346`), shell environment export (`:354-361`),
advisory `codeops/.codeops.yml` guard (`:368-385`), event subscription with cleanup (`:240-251`,
`:392-394`). There is no RPC registration and no tool registration today.

**Packaging.** `package.json` exports only `.` and `./server` (both `plugin/index.ts`, lines
11–14). `files` already includes `plugin/` (line 26), so a new `plugin/tui.tsx` ships
automatically. `tsconfig.json` includes `plugin/**/*.ts` only; no JSX settings.

**OpenCode v2 surface (installed, verified).** The repository's `node_modules` carries
`@opencode/plugin` 2.0.24 — the same version as the installed `opencode` binary (2.0.24):

| Capability | Evidence |
| ---------- | -------- |
| TUI entry resolution from a package (`./tui`) | `node_modules/@opencode/plugin/dist/host.js` (`entry(["server",""])`, `entry(["tui"])`) |
| `sidebar.content` slot with `{ sessionID }` input | `dist/tui/context.d.ts:161-178` |
| Slot claiming API (`append`/`prepend`/…) | `dist/tui/context.d.ts:476-477` |
| TUI plugin definition (`Plugin.define`) | `dist/tui/plugin.d.ts:4-8` |
| Custom RPC registration | `dist/promise/rpc.d.ts:21`; `@opencode/client` `promise/rpc.d.ts` (`client.rpc(def)`) |
| RPC definition is runtime-identity + reserved-name validation | `@opencode/schema/dist/rpc.js` (`define`) |

**Documented publisher pattern** (`opencode.ai/v2/docs/build/plugins/cli/`): expose `./tui`
beside the main plugin; add OpenTUI peers when rendering JSX; the CLI loads TUI components of
configured packages, including against a remote server.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `scripts/codeops_plan.py` | Progress oracle | Narrow the counting rule (03-01) |
| `scripts/codeops_plan_migrate.py` | Migration preview (in-process consumer) | Keep the task-presence admission checkbox-line based; regression test (ST-13) |
| `plugin/index.ts` | Server plugin | Add guarded `codeops` RPC registration |
| `bin/lib/codeops-rpc.mjs` (new) | RPC definition + guard | Create (03-02) |
| `plugin/tui.tsx` (new) | TUI entry, sidebar strip | Create (03-02) |
| `package.json` | Exports, deps, files | `./tui` export; devDeps (`solid-js@1.9.12`); optional peers; test-file `files` negations |
| `package-lock.json` | Lockfile | Updated by the devDependency install |
| `tsconfig.json` | Typecheck | JSX settings; `plugin/**/*.tsx` added to the include list |
| `CHANGELOG.md` | Release notes | `## Unreleased` entry |
| Test files (new) | Spec/impl coverage | `scripts/codeops_plan.spec.test.mjs`, `scripts/codeops_plan.impl.test.mjs`, `scripts/codeops_plan_migrate.spec.test.mjs`, `plugin/tui-foundation.spec.test.mjs`, `plugin/tui-foundation.impl.test.mjs` |

### Code Analysis

Node 22.23 executes `.ts` directly (verified: `import('./plugin/index.ts')` resolves the default
export `{ id: "opencode-codeops" }`), and `os.tmpdir()`/`os.homedir()` honor per-call environment
overrides — both properties enable the runtime fake-context tests without new tooling
(`bin/lib/reasoning-effort.mjs` + `.d.mts` is the established plain-JS-helper pattern the RPC
helper follows). Tests spawn Python via `spawnSync("python3", …)` with temp fixture trees
(`scripts/effort.spec.test.mjs:70`, `scripts/install_agents.spec.test.mjs:92`).

## Gaps Identified

### Gap 1: Deliverable and example checkboxes count as tasks

**Current Behavior:** Every `- [ ]`/`- [x]` line in `99-execution-plan.md` is counted — including
the `**Deliverables**` checklist in the plan template and any quoted example — inflating `total`,
`verified`, and lifecycle, and allowing a deliverable to be returned as `next_task`.
**Required Behavior:** Only real execution-task lines (task-id-prefixed) are counted; existing
plans keep their totals (FR-1…FR-5).
**Fix Required:** Narrow `parse_tasks` with fence stripping and id detection (03-01).

### Gap 2: No TUI entry point or sidebar presence

**Current Behavior:** The package has no `./tui` export; nothing renders in the sidebar.
**Required Behavior:** A packaged `plugin/tui.tsx` claims `sidebar.content` and renders the spike
status line (FR-6, FR-9).
**Fix Required:** Create the entry, export it, add JSX toolchain config (03-02).

### Gap 3: No server RPC surface

**Current Behavior:** No custom RPC is registered; a TUI component has no server data path.
**Required Behavior:** A guarded `codeops.status` RPC the TUI can call (FR-7, FR-8).
**Fix Required:** Create `bin/lib/codeops-rpc.mjs` and wire it into `plugin/index.ts` (03-02).

## Dependencies

### Internal Dependencies

- `scripts/codeops_plan.py` consumers (listed above) — compatibility constraint.
- `bin/lib/` helper pattern (`.mjs` + `.d.mts`) — reused for the RPC helper.
- Existing test conventions (`node --test`, `spawnSync("python3", …)`, content spec tests).

### External Dependencies

- OpenCode v2 (tested against the installed 2.0.24) — slot, RPC, and entry resolution.
- `@opencode/plugin` 2.0.24 (already a dependency).
- New dev-only: `@opentui/core` 0.5.17, `@opentui/solid` 0.5.17, `solid-js` 1.9.12 (AR #11).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Packaged TUI entries load through a host path with a known failure class (silent no-paint; upstream issue #33884) | Med | Med (spike outcome) | Bounded temp-only entry-load pre-probe before the full smoke; ST-12 attributes any failure to a load layer via `--print-logs`; the documented workaround pattern is the slice-2 contingency |
| Counting change alters a third-party plan's totals | Low | Med | Rule derived from all repo plans + templates; regression tests; CHANGELOG note |
| A release before slice 2 exposes only the version strip | Low | Low | Strip is honest and documented as the foundation (AR #13, #17) |
| pty capture misses the rendered strip | Med | Low | Generous capture window; user-assisted fallback (AR #14) |
| TS/JSX config drifts from the runtime's expectations | Low | Med | Smoke exercises the real loader; reopen trigger recorded (AR #12) |
