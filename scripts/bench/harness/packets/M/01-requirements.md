# Requirements: live-task-sidebar (slice 1)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

The first foundation slice of the live-task-sidebar feature, staged by the user (AR #1).

**Slice 1** is a live spike that retires the feature's root unknowns on the installed OpenCode
v2 build. It adds the packaged `./tui` entry point, a guarded `codeops.status` RPC on the server
plugin, and a minimal `sidebar.content` status line that renders only when the RPC succeeds.
The spike's evidence decides whether slice 2 (the full live task-progress feature) proceeds.

## Functional Requirements

### Must Have — slice 1

- [ ] FR-6: The published package exposes a `./tui` entry point (`plugin/tui.tsx`) alongside the
      existing server entry; `npm run verify` (typecheck included) passes with the new TSX file
      (AR #6, #7, #12).
- [ ] FR-7: The server plugin registers the `codeops` RPC with the `status` method returning
      `{ pluginVersion, openCodeVersion, directory }`; the method has no inputs and reads nothing
      from disk (AR #8, #16).
- [ ] FR-8: Registration is feature-detected and never throws: on a build without
      `ctx.rpc.register` the server plugin's `setup` still completes and all existing behavior is
      preserved (AR #9, #10).
- [ ] FR-9: The TUI plugin claims `sidebar.content` and renders the one-line status
      `CodeOps v<pluginVersion>` only when the `status` call succeeds; on failure it renders
      nothing (AR #13).
- [ ] FR-11: `CHANGELOG.md` carries an `## Unreleased` entry covering slice 1; no README
      feature documentation and no release/publish in this scope (AR #15).

### Won't Have (Out of Scope)

- Execution-task counting in `scripts/codeops_plan.py` and `codeops_plan_migrate.py` (slice 0):
  planned separately; do not change either script.
- The live smoke on an installed OpenCode build: the spike's acceptance here is the automated
  specification tests only.
- The full live task-progress feature (slice 2): agent-callable `codeops_progress` tool, run/session
  state machine, delegated-execution display, honesty/lifecycle states, full sidebar presentation,
  protocol and agent-template integration. Planned separately after the spike (AR #1, #18).
- Release, publish, and version bump — release tooling and timing remain user-owned (AR #15).
- Remote-server smoke verification (the design is server-side by construction; slice 2 carries the
  remote acceptance tests).
- README changes (feature incomplete).
- `make-plan` deliverables-template changes (AR #5 — the corrected parser makes them harmless).

## Technical Requirements

### Performance

- No polling, timers, or watchers in the spike; a single `status` call per component mount (AR #13).

### Compatibility

- OpenCode v2 only. Node engine stays `>=18`; the test toolchain requires Node ≥22.18 (the
  containment tests import `plugin/index.ts` via Node type stripping) and CI runs Node 24.
- Existing plugin behavior (standards injection, reasoning effort, shell environment, advisory
  guards, scratch-directory policy) is untouched and covered by existing tests.

### Security

- The `status` RPC accepts no input and returns only version strings and the plugin instance's
  project directory; it performs no file access, so there is no path-traversal or file-reading
  surface (AR #16).
- The registration guard swallows its own failures; any diagnostic is content-free (AR #9).

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| Delivery staging | all slices / slice 1 now | slice 1 now | User decision — the spike gates the feature decision | AR #1 |
| Spike architecture | server RPC + slot strip / TUI-only / separate package | server RPC + slot strip | Only option that proves the RPC round-trip, the brief's required server-side data path (R6) | AR #6 |
| Dependencies | devDeps + optional peers / none possible | devDeps + optional peers | The host's JSX runtime requires them; official publisher pattern | AR #11 |

> **Traceability:** every scope decision references its register entry above; all other design
> decisions carry `AR #` back-references in the owning `03-XX` documents.

## Acceptance Criteria

1. [ ] Slice 1: ST-8…ST-11 pass; `npm run verify` passes with the new TSX entry type-checked.
2. [ ] Containment proven: the fake-context test shows `setup` completes without `rpc.register`
       and registers when it exists.
3. [ ] `CHANGELOG.md` carries the `## Unreleased` entry; no release was performed.
