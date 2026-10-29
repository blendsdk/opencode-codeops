# Execution Plan: discovery-ui-redesign

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-29 09:54
> **Progress**: 18/37 tasks (49%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement the approved workspace through the navigation/theme, editing lifecycle, and composition
specifications; prove it against live Discovery before completion. Scope and authority are in the
Ambiguity Register. The original Discovery plan is context, not this plan's progress source.
Preflight iteration 2 and its delegated decisions are recorded in `00-preflight-report.md`; the
task references below point at the amended specification sections.

## Implementation phases

| Phase | Title | Tasks |
| --- | --- | --- |
| 1 | Navigation and theme foundations | 8 |
| 2 | Reliable editing and navigation | 10 |
| 3 | Fluent UI workspace | 12 |
| 4 | Documentation and live acceptance | 7 |

**Total: 37 tasks across 4 phases.**

> **Execution rule:** these phase checkbox lists are the single task-progress authority. Every
> task appears once. On implementation, mark `[~]` with a real implemented timestamp; after its
> verification passes, mark `[x]` with a completion timestamp. `[!]` includes `Blocked: <reason>`.
> Update Progress and Last Updated immediately; only `[x]` counts. Resume `[~]` first, otherwise
> the first `[ ]`. Never advance siblings. Obtain timestamps with `date '+%Y-%m-%d %H:%M'`.

Every phase records a baseline tree and expected modification set before work. Follow `exec-plan`
for progress display, review, and commit mode; use the `git-commit` skill for authorized commits.
Retain the user's DeepSeek preference for dispatched agents, resolving the available model before
dispatch. Any missing role uses a complete generic packet without weakening review.

## Phase 1: Navigation and theme foundations

> **Phase baseline tree**: `8cb5a71c8d6eaad7d0b1cffbd6ea1f736813ffdc`
> **Reasoning**: high — route compatibility and preference failure states
> **Expected modification set**: `discovery-ui/src/{route,workspace-model,theme,hooks}.ts`, navigation/theme redesign test suites
> **Test split**: Phase 1 owns the pure halves of ST-1–ST-9; the control/reload/focus half of ST-9 runs in Phase 3
> **Scope mode**: strict

### Step 1.1: Specification tests

**Reference:** 03-01; 07 ST-1–ST-9; AR-4, AR-5, AR-8, AR-9.
**Objective:** establish the route, selection and theme oracle first.

- [x] 1.1.1 [spec-author] Write the pure halves of ST-1–ST-9 in `scripts/discovery-ui-redesign-{navigation,theme}.spec.test.mjs` (ST-1–ST-6 navigation, ST-7–ST-9 theme) ✅ (completed: 2026-10-29 09:13)
- [x] 1.1.2 Run those suites red; record failing cases, include empty-segment route cases, and justify any compatibility cases already green ✅ (completed: 2026-10-29 09:13)

### Step 1.2: Implementation

- [x] 1.2.1 Extend `discovery-ui/src/route.ts` parse/format contracts — 03-01 §Routes; ST-1–ST-3 ✅ (completed: 2026-10-29 09:15)
- [x] 1.2.2 Add `discovery-ui/src/workspace-model.ts` selection and Continue derivations; Continue excludes the current group and falls back to summary — 03-01 §Workspace selection; ST-4–ST-6 ✅ (completed: 2026-10-29 09:15)
- [x] 1.2.3 Add `discovery-ui/src/theme.ts` (including the pure storage seam) and theme effect integration in `hooks.ts` — 03-01 §Theme preference; ST-7–ST-9 ✅ (completed: 2026-10-29 09:15)
- [x] 1.2.4 Run navigation/theme spec suites green; retain the existing route suite unchanged ✅ (completed: 2026-10-29 09:15)

### Step 1.3: Implementation tests and verification

- [x] 1.3.1 Add `navigation.impl.test.mjs` and `theme.impl.test.mjs` cases for encoding boundaries, empty-segment normalization, duplicate selection reconciliation, invalid preference values and storage failures ✅ (completed: 2026-10-29 09:15)
- [x] 1.3.2 Full verify and independent phase review; resolve required findings ✅ (completed: 2026-10-29 09:18)

**Deliverables:** compatible routes, deterministic selection, safe preference logic, green tests.
**Verify:** `npm run verify`.

> **Phase 1 evidence**: Red run — the two new suites failed at import because `workspace-model.ts` and `theme.ts` did not exist. A probe against the pre-redesign parser kept the ST-1 legacy round trips green by design and failed both new destination parses. Green run — four redesign suites, 35 tests; full `npm run verify` 611 tests, 0 failures. Independent correctness review found one MAJOR (the locked-group filter was not guarded by a discriminating test) and five MINOR items; all were corrected before 1.3.2 closed.

## Phase 2: Reliable editing and navigation

> **Phase baseline tree**: `e32940e3092078b90f30f336e9c119b4b598c9a1`
> **Reasoning**: high — asynchronous writes, live events and navigation must not lose drafts
> **Expected modification set**: `discovery-ui/src/{plan-editor,navigation,app,hooks,api,view-models,workspace-model}.ts*`, `views/{QuestionCard,DeferFields,GroupSection,PlanPage,DiscoveryHeader,PlanNavigation,DecisionSummary}.tsx`, `views/workspace-styles.ts`, `main.tsx`, editing redesign test suites
> **Test split**: Phase 2 owns the pure halves of ST-10–ST-20; the disclosure/summary-link halves of ST-13/ST-20 run in Phase 3
> **Scope mode**: strict
>
> **Shell scaffolding note**: this phase creates the initial shared header, plan navigation, decision summary, workspace styles, and browser shell wiring because the editor must stay mounted and the SSR contract must keep working across group changes. Phase 3 still owns their completion and verification against ST-21–ST-27; the Phase 3 tasks remain authoritative for those components.

### Step 2.1: Specification tests

**Reference:** 03-02; 07 ST-10–ST-20; AR-3, AR-6, AR-9.
**Objective:** encode observable save/navigation interleavings before replacing the current handler.

- [x] 2.1.1 [spec-author] Write the pure halves of ST-10–ST-20 in `scripts/discovery-ui-redesign-editing.spec.test.mjs`, using controlled API promises, Node timers, and the pure navigation gate for ST-13/ST-14 ✅ (completed: 2026-10-29 09:54)
- [x] 2.1.2 Run the editing suite red and record the result ✅ (completed: 2026-10-29 09:54)

### Step 2.2: Implementation

- [x] 2.2.1 Add `discovery-ui/src/plan-editor.ts` pending field patches, debounce, serialized writes, acknowledgement tracking, and `discard`/`discardAll` — 03-02 §State and interface / §Editing and acknowledgement ✅ (completed: 2026-10-29 09:54)
- [x] 2.2.2 Implement `SubmitOutcome`, refresh/recheck/retry/submission state, `delivery`/`missing`/`lastError`, and the per-question `incomplete` map in `plan-editor.ts` — 03-02 §Live refresh and concurrency / §Errors and submission ✅ (completed: 2026-10-29 09:54)
- [x] 2.2.3 Wire `PlanRoute` in `app.tsx` to the plan-local editor, correct the save-response type in `api.ts`, and keep the initial-data render contract — 03-02 §State and interface ✅ (completed: 2026-10-29 09:54)
- [x] 2.2.4 Add `navigation.ts` (pure request/commit/cancel gate), the displayed/requested route boundary in `app.tsx`, and `useHashRoute` navigate/replace plus popstate/unload effects in `hooks.ts` — 03-02 §Navigation boundary ✅ (completed: 2026-10-29 09:54)
- [x] 2.2.5 Add `QuestionView.storedAnswer`/`overridesImplied`, the `applyDrafts` display overlay, and wire unfinished drafts/error disclosure through `QuestionCard.tsx`, `DeferFields.tsx`, `GroupSection.tsx`, and `PlanPage.tsx` — 03-02 §Editing and acknowledgement; 03-03 §Questions and details ✅ (completed: 2026-10-29 09:54)
- [x] 2.2.6 Run the pure halves of ST-10–ST-20 green; verify existing API/rules/SSR suites remain green ✅ (completed: 2026-10-29 09:54)

### Step 2.3: Implementation tests and verification

- [x] 2.3.1 Add `scripts/discovery-ui-redesign-editing.impl.test.mjs` for disposal, timer cleanup, operation ordering, coalesced refresh edges, discard/terminal states, and navigation-gate interleavings ✅ (completed: 2026-10-29 09:54)
- [x] 2.3.2 Full verify and independent correctness/concurrency review; resolve required findings ✅ (completed: 2026-10-29 09:54)

**Deliverables:** awaitable saves, honest status, explicit discard/terminal exits, observable submit
outcomes, guarded navigation and live refresh integration.
**Verify:** `npm run verify`.

> **Phase 2 evidence**: Red run — the editing suite failed at import because `plan-editor.ts` and `navigation.ts` did not exist. Green run — the editing spec/impl suites pass; the full `npm run verify` passes 651 tests. Independent correctness/concurrency review found four MAJOR defects (recheck could not clear after review; save revision was captured at drain time; the deleted state had no working exit; the unload guard was missing) plus ten MINOR items. All were fixed. The single re-review found two residual MAJOR issues (a save 404 was misread as a deleted plan; a hidden blocked draft had no discard path); both were fixed and covered by new cases before the phase closed. No further review pass was requested.

## Phase 3: Fluent UI workspace

> **Phase baseline tree**: _(record at execution start)_
> **Reasoning**: high — all existing question states must remain accessible in a new layout
> **Expected modification set**: `discovery-ui/src/{app,main,workspace-model}.ts*`, `views/{DiscoveryHeader,PlanNavigation,DecisionSummary,PlanPage,GroupSection,QuestionCard,DeferFields}.tsx`, `views/workspace-styles.ts`, workspace redesign test suites
> **Test split**: Phase 3 owns ST-21–ST-27 and the integration halves of ST-9, ST-13, and ST-20
> **Scope mode**: strict

Executors load `fluentui` and `fluentui-design` before view work. Packet context includes the
original Discovery UI findings (Phase 6/8) and the approved production contracts.

### Step 3.1: Specification tests

**Reference:** 03-03; 07 ST-21–ST-27; AR-1–AR-3, AR-7–AR-9.
**Objective:** render/model contracts for the new composition before changing views.

- [ ] 3.1.1 [spec-author] Write ST-21–ST-27 and the integration halves of ST-9/ST-13/ST-20 in `scripts/discovery-ui-redesign-workspace.spec.test.mjs`, reusing the existing temp esbuild/SSR pattern
- [ ] 3.1.2 Run the workspace suite red; record existing security/package checks that already pass

### Step 3.2: Implementation

- [ ] 3.2.1 Add `views/DiscoveryHeader.tsx` with breadcrumb, identity slot, theme control, nav trigger, and common tokens/layout in `views/workspace-styles.ts` — 03-03 §Layout and components / §Visual reference; 03-01 §Shell coordination
- [ ] 3.2.2 Add `views/PlanNavigation.tsx` and workspace progress derivations in `workspace-model.ts`; carry the project slug, distinguish Ready from Complete, and apply the `applyDrafts` overlay — 03-03 §Navigation and progress derivations
- [ ] 3.2.3 Restyle `views/QuestionCard.tsx` / `DeferFields.tsx` with supplementary disclosure that keeps children mounted and a dirty-deferral guard — 03-03 §Questions and details
- [ ] 3.2.4 Add `views/DecisionSummary.tsx` with answer/status/provenance, stored retired answers, **Unsent drafts**, and owning-group links — 03-03 §Summary and actions
- [ ] 3.2.5 Compose selected group/summary, header, navigation and rail in `views/PlanPage.tsx`; PlanPage renders the plan heading without a second breadcrumb — 03-03 §Layout and components
- [ ] 3.2.6 Integrate group/summary footer actions and existing dialogs in `PlanPage.tsx` / `GroupSection.tsx`; always render Submit group, recompute the dialog after flush, add the Delete discard warning, and build links from the project slug — 03-03 §Summary and actions
- [ ] 3.2.7 Wire the optional shell object/theme/real metadata/breadcrumb in `app.tsx` and `main.tsx`; retain listing functions — 03-03 §Accessibility and states; 03-01 §Shell coordination
- [ ] 3.2.8 Run ST-21–ST-27 and the integration halves of ST-9/ST-13/ST-20 green; existing UI specification suites unchanged

### Step 3.3: Implementation tests and verification

- [ ] 3.3.1 Add `scripts/discovery-ui-redesign-workspace.impl.test.mjs` for empty groups, follow-up completion changes, long labels, count edges, retired/removed-group answers, and breadcrumb identity
- [ ] 3.3.2 Full verify, build/package checks and independent phase review; resolve required findings

**Deliverables:** live-data Nav workspace, full question controls, summary with retained-draft and
retired-answer inspection, responsive styling, header identity and breadcrumb.
**Verify:** `npm run verify`; `npm run build:discovery`; `npm pack --dry-run`.

## Phase 4: Documentation and live acceptance

> **Phase baseline tree**: _(record at execution start)_
> **Reasoning**: medium — shipped documentation and real-browser acceptance evidence
> **Expected modification set**: `README.md`, `CHANGELOG.md`, `scripts/discovery-ui-redesign-content.spec.test.mjs`, this plan's evidence/findings, `plans/00-roadmap.md`; live fixtures remain in the temp root
> **Scope mode**: strict

### Step 4.1: Specification tests

**Reference:** 07 ST-28 and B1–B8; AR-9, AR-10.
**Objective:** document and demonstrate the implemented workflow using the packed application.

- [ ] 4.1.1 [spec-author] Write ST-28 in `scripts/discovery-ui-redesign-content.spec.test.mjs`
- [ ] 4.1.2 Run ST-28 red and record the missing-documentation failures

### Step 4.2: Implementation

- [ ] 4.2.1 Update the Discovery README section and Unreleased changelog for the redesign — R10; ST-28
- [ ] 4.2.2 Run ST-28 and the existing Discovery/progress content suites green

### Step 4.3: Live acceptance and hardening

- [ ] 4.3.1 Build a tarball and prepare isolated live fixtures covering B1–B8; record host/package identity and the checks to run
- [ ] 4.3.2 Run B1–B8 with the user and record each outcome; fix accepted findings and recheck affected items
- [ ] 4.3.3 Final full verify, build/pack check, independent phase review and success-criteria check; remove owned scratch and sync the roadmap

**Deliverables:** documentation and durable automated/live evidence.
**Verify:** `npm run verify`; `npm run build:discovery`; `npm pack --dry-run`.

## Dependencies

Phase 1 → Phase 2 → Phase 3 → Phase 4. Browser acceptance requires the user and a current browser.
Any MAJOR/CRITICAL finding pauses for the applicable ruling. Code fixes discovered in the final
phase expand its recorded expected modification set only after the required authorization.

## Success criteria

- All 37 tasks verified; all R1–R10 acceptance criteria met.
- Red/green evidence and implementation tests recorded; all existing tests remain passing.
- Every B1–B8 item confirmed; no unresolved blocking review finding.
- New UI reads existing data and links, preserves question semantics, and meets the package/CSP
  checks with the existing dependency surface.
- README/CHANGELOG, roadmap and findings state current; verification logs and live scratch cleaned.
