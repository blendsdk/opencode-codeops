# Requirements: live-task-sidebar (slices 0–1)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Two foundation slices of the live-task-sidebar feature, staged by the user (AR #1).

**Slice 0** makes execution-task counting correct. `scripts/codeops_plan.py` is the shared
progress oracle for `exec-plan`, `roadmap`, `upgrade-plan`, and `setup-codeops`; today it counts
any checkbox line in `99-execution-plan.md`, so deliverables checkboxes and quoted examples
inflate totals and can be returned as the resume candidate. The fix narrows counting to real
execution tasks without changing the JSON contract or any existing plan's totals.

**Slice 1** is a live spike that retires the feature's root unknowns on the installed OpenCode
v2 build. It adds the packaged `./tui` entry point, a guarded `codeops.status` RPC on the server
plugin, and a minimal `sidebar.content` status line that renders only when the RPC succeeds.
The spike's evidence decides whether slice 2 (the full live task-progress feature) proceeds.

## Functional Requirements

### Must Have — slice 0

- [ ] FR-1: The parser counts only real execution tasks: checkbox lines whose content begins with
      a task id (`N.N.N` or `T-N.N`, optional surrounding `**`), matching the task formats used by
      the documented plan templates and all existing plans (03-01 §Counting Rule, AR #3).
- [ ] FR-2: Lines inside fenced code blocks and checkbox lines without a task id (deliverables,
      acceptance lists, quoted examples) are not counted (AR #3).
- [ ] FR-3: A task id presented twice in one document is counted once, first occurrence in
      document order (AR #3).
- [ ] FR-4: The JSON output shape, the `--progress-bar` format, the marker vocabulary
      (`[ ] [~] [x] [!]`), lifecycle derivation, problem detection, and `next_task` semantics are
      unchanged; only the counted task set is corrected (AR #4).
- [ ] FR-5: Every plan in this repository keeps its exact pre-fix totals (AR #3 evidence).
- [ ] FR-12: Migration admission is preserved: `codeops_plan_migrate.py` keeps treating any
      checklist line as task-presence, so a plan with id-less checklists does not newly block
      `setup-codeops --apply` (AR #4).

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
- [ ] FR-10: A live smoke on the installed OpenCode v2 build demonstrates: the TUI entry loads
      from the packaged tarball, the sidebar strip renders in a real session view, and the RPC
      round-trips; the tested minimum build is recorded (AR #14).
- [ ] FR-11: `CHANGELOG.md` carries an `## Unreleased` entry covering both slices; no README
      feature documentation and no release/publish in this scope (AR #15).

### Won't Have (Out of Scope)

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
- The counting fix stays O(document); no new parsing passes over plan files at plan-discovery time.

### Compatibility

- OpenCode v2 only; the tested minimum build is recorded from the smoke (expected v2.0.24, the
  installed build). Node engine stays `>=18`; the test toolchain requires Node ≥22.18 (the
  containment tests import `plugin/index.ts` via Node type stripping) and CI runs Node 24.
- The parser JSON contract is backward compatible; consumers need no change (AR #4) — migration
  admission in particular is preserved (FR-12).
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
| Delivery staging | all slices / slices 0+1 now / slice 0 only | slices 0+1 now | User decision — correctness fix ships value immediately; the spike gates the feature decision with live evidence | AR #1 |
| Counting rule | id-prefixed + fence-stripped + deduped / current behavior / section heuristics | id-prefixed rule | Derived from all nine repo plans and the templates; preserves every existing total | AR #3 |
| Spike architecture | server RPC + slot strip / TUI-only / separate package | server RPC + slot strip | Only option that proves the RPC round-trip, the brief's required server-side data path (R6) | AR #6 |
| Dependencies | devDeps + optional peers / none possible | devDeps + optional peers | The host's JSX runtime requires them; official publisher pattern | AR #11 |
| Smoke method | pty capture + fallback / committed harness / tmux | pty capture + fallback | No new harness; tmux unavailable; `script` and Python pty available | AR #14 |

> **Traceability:** every scope decision references its register entry above; all other design
> decisions carry `AR #` back-references in the owning `03-XX` documents.

## Acceptance Criteria

1. [ ] Slice 0: ST-1…ST-7 and ST-13 pass; the repo-plan parity check reports unchanged totals for
       all nine plans; `npm run verify` passes.
2. [ ] Slice 1: ST-8…ST-12 pass; `npm run verify` passes with the new TSX entry type-checked.
3. [ ] Live smoke recorded: packed tarball loads the TUI entry, the strip renders in a real
       sidebar, the RPC round-trips, and the tested OpenCode build is written into the execution
       plan's completion note.
4. [ ] Containment proven: the fake-context test shows `setup` completes without `rpc.register`
       and registers when it exists.
5. [ ] `CHANGELOG.md` carries the `## Unreleased` entry; no release was performed.
6. [ ] The go/no-go evidence for slice 2 is reported to the user (what was proven, what was not,
       and the recorded build).
