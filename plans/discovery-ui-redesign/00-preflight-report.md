# Preflight Report: discovery-ui-redesign

> **Status**: ✅ PASSED — all 18 findings resolved (iteration 2)
> **Iteration**: 2 (re-scan after fixes)
> **Previous Iteration**: 18 findings (1 critical, 8 major, 8 minor, 1 observation) — all resolved
> **This Iteration**: 0 new findings
> **Carried Forward**: none
> **Artifact**: Implementation plan at `plans/discovery-ui-redesign/` (9 documents)
> **Artifact revision**: iteration 1 combined SHA-256 `953491158ce056344c219a29516e3241349588fa5a5d3297b7e4019111552a58`; iteration 2 revision recorded in §Iteration 2 verification; baseline HEAD `9d8e95793ba153c2f66f8b960464a9490b25d2ee`
> **Audit target**: the nine plan documents listed below. Context documents are named separately and are not modified or advanced by this report.
> **Scope mode**: strict — no scope expansion proposals were collected or graded.
> **Authority**: `--auto-design` active (root invocation `pf-discovery-ui-redesign-20261029-1`, policy version 1); eligible technical resolutions are delegated and recorded in §Delegated decision provenance.
> **Codebase Grounded**: 28 source, test, and configuration files examined; all material document references verified against code; 6 references unverifiable (listed at the end).
> **Last Updated**: 2026-10-29

## Scope contract

| Term | Value |
| --- | --- |
| Audit target | `00-index.md`, `00-ambiguity-register.md`, `01-requirements.md`, `02-current-state.md`, `03-01-navigation-and-theme.md`, `03-02-editing-and-live-state.md`, `03-03-workspace.md`, `07-testing-strategy.md`, `99-execution-plan.md` |
| Context documents | `plans/discovery/` (especially `03-06-web-ui.md`, `05-findings.md`, `00-index.md`), `discovery-ui/src/**`, `discovery-ui/tsconfig.json`, `scripts/discovery-ui.spec.test.mjs`, `scripts/discovery-ui.impl.test.mjs`, `scripts/build-discovery-ui.mjs`, `package.json`, `bin/lib/discovery-rules.mjs`, `bin/lib/discovery-store.mjs`, `bin/lib/discovery-server.mjs`, `README.md`, `CHANGELOG.md`, `_shared/discovery.md`, `AGENTS.md` |
| Modification set | The nine target documents. `plans/00-roadmap.md` is updated only after a pass, per the roadmap rule. No source code is changed by this report. |
| Product baseline | Plan workspace plus shared header; project/plan listings keep their current functions; existing Discovery behaviour, API, stored data, published links, and security boundaries are preserved. No listing redesign, server/agent protocol change, browser-only answer persistence, new dependency, browser-test framework, specialist creation, or package release. |

## Codebase Context Summary

**Tech stack.** React 19.3.1 + Fluent UI 9.74.11 (`@fluentui/react-components`, with `Nav`, `NavItem`, `NavDrawer`, `NavDrawerBody`, `NavCategory`, `NavCategoryItem`, `NavSubItem`, `NavSectionHeader`, `Accordion` exported by the installed umbrella package), esbuild 0.28.2, TypeScript 5 with `erasableSyntaxOnly`, Node 24 in CI. The UI is a hash-routed SPA under `discovery-ui/src/`, built by `scripts/build-discovery-ui.mjs` into `discovery-ui/dist/assets/app.js` (current 578,137 bytes; 1,048,576-byte test budget).

**Architecture.** `App({route, api, initial})` is the public shell and is rendered directly by the SSR test. `PlanRoute` owns the loaded plan/project and the single pending patch. `planView` derives all labels, counts, locks, and readiness from the stored record and shared rules (`bin/lib/discovery-rules.mjs`). `useHashRoute` only reads `hashchange`; `useSystemTheme` only reads `matchMedia`. `main.tsx` owns `FluentProvider`. The server is the persistence authority; `saveAnswer` rejects non-open, locked, and stale questions (`bin/lib/discovery-store.mjs:737-746`), and plan `revision` advances on publish, not on answer saves.

**Key observations.**

- The legacy route parser filters empty segments and caps the route at three segments (`route.ts:39-48`); new suffixes must preserve the exact legacy results.
- The SSR fixture's first actionable group is `Scope`; it contains `Refund policy`, `Recommended`, and the current `Submit group` label. The existing test asserts those strings (`scripts/discovery-ui.spec.test.mjs:473-478`).
- The current view model exposes only server state: `QuestionView` has no draft or stored-answer field (`view-models.ts:79-99`), and `planView` never visits questions whose group is no longer in the plan (`view-models.ts:318-332`).
- `DeferFields` keeps partial values locally and adopts an external `defer` when unfocused (`DeferFields.tsx:38-51`); `DraftText` has a local dirty/focus guard (`QuestionCard.tsx:77-144`).
- `App` currently renders the only global breadcrumb, including the `Projects` link (`app.tsx:308-314`); `ProjectPage` has no other path back to `#/`.
- Baseline verification: `npm run verify` passed with 577 tests, 0 failures, and version 2.2.1.

**Reference verification.** Every material file, line, signature, export, data-shape, test, and build/config reference was checked against the code. The six unverifiable references are the approved preview, the recorded user decisions, the pre-change working-tree state, the claim that `discovery-ui-reviewer` was previously proposed, live browser behaviour, and the final post-change bundle size.

## Summary by dimension

| # | Dimension | Findings | Highest severity |
| --- | --- | --- | --- |
| 1 | Ambiguities | 3 (PF-010, PF-015, PF-016) | 🟡 MINOR |
| 2 | Implicit Assumptions | 2 (PF-002, PF-005) | 🟠 MAJOR |
| 3 | Logical Contradictions | 4 (PF-001, PF-007, PF-011, PF-012) | 🔴 CRITICAL |
| 4 | Completeness Gaps | 4 (PF-001–PF-004) | 🔴 CRITICAL |
| 5 | Dependency Issues | 5 (PF-004–PF-006, PF-008, PF-016) | 🟠 MAJOR |
| 6 | Feasibility Concerns | 3 (PF-004–PF-006) | 🟠 MAJOR |
| 7 | Testability | 5 (PF-006, PF-009, PF-013, PF-014, PF-018) | 🟠 MAJOR |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 6 (PF-001, PF-003, PF-011, PF-012, PF-015, PF-017) | 🔴 CRITICAL |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 2 (PF-008, PF-009) | 🟠 MAJOR |
| 12 | Consistency | 4 (PF-007, PF-008, PF-010, PF-013) | 🟠 MAJOR |
| 13 | Codebase Alignment | 5 (PF-002, PF-005, PF-007, PF-008, PF-016) | 🟠 MAJOR |

## Summary by severity

| Severity | Count | Status |
| --- | --- | --- |
| 🔴 CRITICAL | 1 | 1 resolved |
| 🟠 MAJOR | 8 | 8 resolved |
| 🟡 MINOR | 8 | 8 resolved |
| 🔵 OBSERVATION | 1 | 1 resolved |

All 18 findings were resolved in iteration 2; the counts above are the iteration 1 baseline.

## Iteration 2 resolution log

| PF | Resolution | Evidence in the amended plan |
| --- | --- | --- |
| PF-001 | Added `discard`/`discardAll`, **Discard unsaved change**, **Leave without saving**, terminal plan-deleted state, and Delete discard warning. | `03-02` §State and interface, §Navigation boundary, §Errors and submission; `03-03` §Summary and actions; `07` ST-17, ST-20, B5 |
| PF-002 | Added the pure `applyDrafts` overlay, `QuestionView.storedAnswer`/`overridesImplied`, hidden-question metadata, and **Unsent drafts**. | `03-03` §Navigation and progress derivations, §Questions and details, §Summary and actions; `99` 2.2.5, 3.2.2–3.2.4; `07` ST-17, ST-24, ST-25 |
| PF-003 | Added the per-question `incomplete` map, dirty-deferral guard, field reveal, and mounted disclosure. | `03-02` §State and interface, §Editing and acknowledgement; `03-03` §Questions and details; `07` ST-20 |
| PF-004 | Added `SubmitOutcome`, snapshot `delivery`/`lastError`/`missing`/`recheckRequired`, status labels, and post-flush dialog recompute. | `03-02` §State and interface, §Errors and submission; `03-03` §Summary and actions; `07` ST-18, ST-19 |
| PF-005 | Added one optional shell object (theme/setter, nav open state, identity slot), ProjectRoute/PlanRoute identity callbacks, and SSR defaults. | `03-01` §Shell coordination; `03-03` §Layout and components; `99` 3.2.7 |
| PF-006 | Added `navigation.ts` request/commit/cancel gate, `useHashRoute` navigate/replace and `popstate`, and pure interleaving tests. | `03-02` §Navigation boundary, §Verification; `03-01` §Verification; `07` ST-13, ST-14, B1, B3; `99` 2.2.4 |
| PF-007 | Kept the breadcrumb in the shared header for all routes; `PlanPage` renders the heading only; listings keep the Projects link. | `03-03` §Layout and components, §Visual reference; `07` ST-21, B1 |
| PF-008 | Reconciled module ownership: `view-models.ts` in Phase 2; `PlanPage`, `GroupSection`, `api.ts`, `workspace-model.ts` and `navigation.ts` added to the phase sets and tasks. | `02-current-state` table; `00-index` Related files; `99` Phase 2/3 sets and tasks 2.2.3, 2.2.5 |
| PF-009 | Split ST-9, ST-13, and ST-20 into pure and integration halves and assigned the integration halves to Phase 3. | `03-01` §Verification; `03-02` §Verification; `03-03` §Verification; `07` Files and test boundaries; `99` phase test-split lines |
| PF-010 | Kept readiness row counts; added a separate lifecycle **Complete** measure; one `answeredQuestions` derivation; preserved `GroupView.summary`. | `03-03` §Navigation and progress derivations; `07` ST-24 |
| PF-011 | Continue excludes the current group and falls back to summary; added the discussion-only case to ST-6. | `03-01` §Workspace selection; `07` ST-6; `99` 1.2.2 |
| PF-012 | Delete is destructive: discard warning, dispose and navigate outside the boundary; 404 refresh is terminal. | `03-02` §Navigation boundary, §Errors and submission; `03-03` §Summary and actions; `07` ST-17, B8 |
| PF-013 | Reworded B1; added dirty reload/close, same-destination retry, collapse retention, and no-persistence evidence. | `07` B1–B3 |
| PF-014 | Added exact breadcrumb, accessible-name, count-matrix, open/submitted, empty-group, Submit group, and Recommended assertions. | `07` ST-21–ST-26, Files and test boundaries; `03-03` §Navigation and progress derivations, §Summary and actions |
| PF-015 | Preserved empty-segment normalization and added route cases. | `03-01` §Routes; `07` ST-3; `99` 1.1.2, 1.3.1 |
| PF-016 | `PlanPage` receives `projectSlug` and builds links with `formatRoute`; `api.ts` declares `SavePlanResponse`; Phase 2 owns the type change. | `03-03` §Layout and components; `03-02` §State and interface; `99` 2.2.3 |
| PF-017 | Added modal `NavDrawer` Escape/backdrop close and focus return to the toggle. | `03-03` §Accessibility and states; `07` B6 |
| PF-018 | ST-27 now reuses the existing build/package assertions and adds a package-diff or devDependency check. | `07` ST-27 |

---

## Findings

### PF-001: Terminal or stale drafts have no discard path; navigation can deadlock 🔴 CRITICAL

**Dimension:** Completeness Gaps, Logical Contradictions, Edge Cases
**Location:** `03-02-editing-and-live-state.md` §State and interface (lines 28-32, 55-64), §Navigation boundary (113-122), §Errors and submission (145-147); `03-03-workspace.md` §Questions and details (88-90); `07-testing-strategy.md` ST-17, ST-20.
**Codebase Evidence:** `bin/lib/discovery-store.mjs:737-746` permanently refuses saves when the question is not open, the group is locked, or the revision is stale. `03-02:55-64` exposes only `edit`, `setIncomplete`, `flush`, `refresh`, `retry`, `submit`, and `dispose`; there is no discard. `03-02:114-116` commits navigation only after `flush()` succeeds. `discovery-ui/src/views/QuestionCard.tsx:153,287-291` disables read-only cards; `views/DeferFields.tsx:67-72` is the only existing cancel affordance.

**The Problem:** A live refresh can make a drafted question read-only (another client submitted it), locked (a prerequisite disappeared), retired (omitted from a republish), hidden (a `showIf` change), or part of a removed group. The plan correctly says to retain the attempted value and never send it through a read-only state. But there is no operation to abandon that value. `retry()` cannot succeed, `flush()` stays false, and navigation/submit stay blocked forever. The user's only escape is a page reload, which loses the draft; cross-tab deletion has the same terminal shape because a 404 refresh is told to keep the page and drafts. This is a functional dead end in the exact scenario B5 and ST-17 require.

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Add `discard(key)` / `discardAll()` to `PlanEditor`, a visible **Discard unsaved change** action, and a **Leave without saving** confirmation at the blocked-navigation notice; on a 404 refresh show a terminal **Plan deleted** state with **Back to plans** and **Discard draft**. | **Recommended** — keeps the save guard intact, gives the user the only safe escape, and stays Node-testable. |
| B | Stop blocking navigation for terminal refusals and move the draft to a plan-level **Unsent drafts** review area with Retry/Discard. | Viable, but weakens the literal guard and creates a second surface with unclear lifetime. |
| C | Auto-drop the draft after an explicit warning. | Dropped — loses work after a warning; the plan's acceptance criterion says drafts are not silently dropped. |

**Recommendation:** Option A, combined with the plan-level review surface in PF-002 for drafts that are retained as context.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-001).

---

### PF-002: The display model cannot show drafts, retained values, or retired answers 🟠 MAJOR

**Dimension:** Completeness Gaps, Implicit Assumptions, Codebase Alignment (data shapes)
**Location:** `03-02-editing-and-live-state.md` §State and interface (30-31), §Editing and acknowledgement (86), §Live refresh (127-139); `03-03-workspace.md` §Questions and details (76-79, 88-90), §Summary (92-98); `07-testing-strategy.md` ST-10, ST-11, ST-17, ST-22, ST-25.
**Codebase Evidence:** `discovery-ui/src/view-models.ts:79-99` defines `QuestionView` with no draft, unsaved, or stored-answer field. `:219-282` builds it only from `entry.effective`; `:266-267` takes `text`/`other` from the effective server answer. `:318-332` visits only current groups; `bin/lib/discovery-rules.mjs:1065-1077` sets `effective = null` when a question is invisible, so a retired question loses its stored answer. `views/QuestionCard.tsx:222-237` rebuilds a multiple-choice set from `option.selected`, and `:92-100` adopts the external value when unfocused. `PlanPage.tsx:104-112` passes `planView` to `GroupSection`.

**The Problem:** The plan promises that an edit updates the displayed draft immediately, that overlays survive group switches and live refreshes, and that attempted values stay visible for review. No data path delivers those values into the rendered controls. Choice and multiple-choice edits do not display until the save echo, so two rapid multiple-choice clicks can drop the first selection because the second click recomputes from the stale saved set. After a group switch the card remounts and shows the server value. Hidden and removed questions have no surface at all; retired questions are rendered from a null effective answer, so their stored answer is invisible. `overridesImplied` (available in `rules:1072`) is not exposed, so an explicit override loses its implication provenance.

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Add a pure `applyDrafts(planView, drafts, errors)` display derivation in `workspace-model.ts`; add `storedAnswer`, `overridesImplied`, and hidden-question metadata to `QuestionView`; pass the merged view to the cards; add an **Unsent drafts** summary section for questions that are not currently editable. Keep rule evaluation on the accepted server snapshot. | **Recommended** — one display authority, Node-testable, covers group switch, refresh, hidden/retired/removed questions, and the summary. |
| B | Pass `draft`/`error` props into each `QuestionCard` and derive display there. | Viable, but duplicates merge logic in every control and cannot feed the summary. |
| C | Keep server-only views and rely on save echoes. | Dropped — fails immediate display, rapid multi-select, and retained-context requirements. |

**Recommendation:** Option A. The overlay must change display fields only, never visibility, readiness, or counts. Hidden questions need a metadata path (a catalog or an explicit hidden-question entry) or their retained drafts still have nowhere to render.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-002).

---

### PF-003: Partial deferrals are not per-question snapshot state and can be overwritten by refresh 🟠 MAJOR

**Dimension:** Completeness Gaps, Edge Cases, Consistency
**Location:** `03-02-editing-and-live-state.md` §State and interface (28, 58), §Editing and acknowledgement (98-104), §Navigation boundary (120); `03-03-workspace.md` §Questions and details (81-86); `07-testing-strategy.md` ST-20.
**Codebase Evidence:** `03-02:28` declares `setIncomplete(key, value: boolean)`, but `EditorSnapshot` exposes only a global `unsaved: boolean` (`03-02:47-54`) and `SaveStatus` has no incomplete value (`:37`). `views/DeferFields.tsx:38-51` keeps partial values locally and calls `onChange` only when all three fields are complete. `:42-45` adopts the external `defer` whenever the field is not focused; a live refresh after blur resets a partial edit of a saved deferral. `03-02:15-16` says "React state and subscriptions stay in `app.tsx`", while `03-03:78` says to preserve local text/Other/notes drafts.

**The Problem:** The guard has no way to identify which question is incomplete or to reveal its fields. A refresh can silently overwrite a partial deferral that the plan promised to keep. A literal reading of the state-ownership sentence invites moving dialog, disclosure, and draft state out of the presentational components, which would break the existing local-draft behaviour.

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Add `incomplete: Record<string, { reason: string }>` to `EditorSnapshot`; include it in `unsaved`, the navigation guard, and `beforeunload`; add a dirty guard in `DeferFields`; reveal the fields on a blocked attempt; reword 03-02:15-16 to "plan lifecycle state and subscriptions stay in `app.tsx`; presentational components keep local drafts and disclosure state". | **Recommended** — smallest change, keeps the approved "remain local" design, and makes ST-20 observable. |
| B | Move partial deferral values into `PlanEditor` as a typed draft. | Viable and cleaner for testability, but a larger public contract. |
| C | Keep local state and prevent remount by keying the component. | Dropped — does not fix the refresh effect. |

**Recommendation:** Option A. Keep Option B as the reopen choice if a missed dirty guard or remount still loses text during implementation.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-003).

---

### PF-004: The editor contract cannot carry submit/refresh outcomes or recheck state 🟠 MAJOR

**Dimension:** Completeness Gaps, Dependency Issues, Feasibility Concerns
**Location:** `03-02-editing-and-live-state.md` §State and interface (29-32, 47-64), §Errors and submission (143-156); `03-03-workspace.md` §Summary and actions (100-104); `07-testing-strategy.md` ST-18, ST-19, ST-26.
**Codebase Evidence:** `discovery-ui/src/api.ts:71-75` already types `SubmitResponse` with `delivery`, `submission`, and `skipped`; `bin/lib/discovery-server.mjs:480-502` returns them. `03-02:62` declares `submit(group): Promise<boolean>` and `:60` declares `refresh(): Promise<void>`. `EditorSnapshot` has no `delivery`, plan-level error, or `missing` field (`03-02:47-54`). `SubmitDialog` receives static `ready`/`skipped` arrays when it opens (`PlanPage.tsx:123-137`). `api.ts:134-145` drops the server's `missing` array on an error.

**The Problem:** The plan requires feedback that distinguishes `delivery: woken` from `pending` and shows current missing reasons after a readiness recheck. The published editor contract cannot express either value. ST-19 and the "recheck readiness after saving" rule cannot be written against the interface, and a failed submit's `ApiErrorKind` is lost, so the error table cannot choose the right recovery path. `recheck` and "blocked" are used as states but are not defined in the label rules (`03-02:98-99,120,145`).

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Add a typed `SubmitOutcome` and snapshot fields `delivery`, `lastError`, `missing`, and `recheckRequired`; recompute the dialog's ready/skipped lists from the accepted snapshot after `flush`; define a label for every `SaveStatus` and include incomplete/blocked in the guards; add `SubmitDialog` to the phase set. | **Recommended** — one source of truth and directly testable. |
| B | Add an `onOutcome` callback to `createPlanEditor`. | Viable, but a parallel channel that is easier to miss. |
| C | Move submit/refresh into the React layer. | Dropped — bypasses the editor's flush, recheck, ordering, and `submitting` logic. |

**Recommendation:** Option A. Recompute missing reasons from the accepted snapshot rather than adding a server field. Also correct `03-03:104`, which says the post-submit flow is owned by 03-01; the all-ready rule is in 03-02.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-004).

---

### PF-005: The shared header has no coordination channel for theme, the nav drawer, or loaded identity 🟠 MAJOR

**Dimension:** Implicit Assumptions, Feasibility Concerns, Dependency Issues
**Location:** `03-03-workspace.md` §Layout and components (16-18, 24-26); `03-01-navigation-and-theme.md` §Theme preference (62-77); `03-02-editing-and-live-state.md` §Navigation boundary (108-111); `99-execution-plan.md` tasks 3.2.1 and 3.2.7 (119, 125).
**Codebase Evidence:** `discovery-ui/src/main.tsx:23-31` owns `useSystemTheme` and `FluentProvider`. `AppProps` is only `{ route, api, initial }` (`app.tsx:44-49`) and the SSR test constructs `App` directly (`scripts/discovery-ui.spec.test.mjs:447`). `PlanRoute` owns the loaded plan/project (`app.tsx:137-141`); `App` derives names only from `initial` (`app.tsx:300-304`), so a browser load shows slugs. The header is mounted by `App`; the theme control is in the header; the nav trigger is in the header while the drawer would live in `PlanPage`/`PlanNavigation`.

**The Problem:** The theme control cannot change the `FluentProvider` theme owned by `Root`, the header cannot open a drawer owned by `PlanPage`, and loaded titles cannot reach the header, without an unplanned prop, callback, or context channel. Adding required props to `App` would break the stated public render contract; duplicating theme state would produce a control that changes nothing or a provider/control mismatch. The identity requirement is also internally inconsistent: `03-03:24` says the shell shows titles loaded by `PlanRoute`, while `03-03:16` lists only Discovery identity, theme, and the nav trigger in the header and `03-03:18` assigns the breadcrumb to `PlanPage`.

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Add a small typed shell context (`themePreference`/setter, nav open/setOpen, loaded identity, navigation request) provided by `Root`, consumed by `App`/header/`PlanPage`, with SSR defaults. | Viable; cleaner if the shell surface grows. |
| B | Add optional coordination props to `App` (one optional `shell` object: theme, setter, nav state, identity, navigate request). Existing `{route, api, initial}` calls keep working; `PlanRoute` publishes identity through an optional callback. | **Recommended after challenge** — smallest change, explicit, consistent with the codebase's prop-driven style and the plan's save-boundary registration. |
| C | Mount the header inside each route component. | Dropped — duplicates the shared header and violates "one common header". |

**Recommendation:** Option B. The plan must amend "keeps its public `{route, api, initial}` contract" to "existing calls keep working; optional coordination props are added" and name the props. If the shell later needs more than theme/nav/identity, Option A becomes the better structure.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-005).

---

### PF-006: Guarded hash navigation has no implementation or test seam and can desync history 🟠 MAJOR

**Dimension:** Feasibility Concerns, Testability, Dependency Issues
**Location:** `03-01-navigation-and-theme.md` §Workspace selection (52-53); `03-02-editing-and-live-state.md` §Navigation boundary (106-122); `07-testing-strategy.md` ST-13, ST-14; `99-execution-plan.md` task 2.2.4 (87).
**Codebase Evidence:** `discovery-ui/src/hooks.ts:14-24` reads `window.location.hash` and subscribes only to `hashchange`. `history.replaceState` and `history.pushState` do not fire `hashchange`; Back/Forward after `pushState` fires `popstate`, which the hook does not observe. `app.tsx:285` writes `window.location.hash` directly for the delete path. The plan assigns ST-13/ST-14 to the Phase 2 Node editing suite (`99:79-80`), but the repository has no DOM or browser harness (`package.json`), and SSR does not run effects.

**The Problem:** The plan requires replace-vs-add semantics, hash restoration after a failed save, back/forward restoration, and "only the latest request commits". The one-way hook cannot perform any of them; a `replaceState` restore leaves the hook's route prop stale, and a `pushState` back/forward sequence is invisible to it. The asserted React/history behaviour cannot be observed by the pure Node suite, so the spec author must weaken the oracle or leave the phase red.

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Add a pure navigation-intent module (request / commit / reject with an injected history writer) plus `useHashRoute` `navigate(hash, { replace })` and `popstate`, with `hashchange`/`popstate` dedupe; test pure interleavings in Node; name the pure theme-storage seam too. | **Recommended** — gives ST-13/ST-14 an observable owner and keeps the browser hook thin. |
| B | Keep `useHashRoute` read-only and put requested/displayed route plus all history writes in `App`; test only in the browser. | Viable, but leaves the core guard uncovered by automated tests. |
| C | Keep the plan and rely on B1 for history evidence. | Dropped — no automated evidence for a safety-critical boundary. |

**Recommendation:** Option A. Add `navigation.ts` (or an equivalent named module) to the Phase 2 expected modification set and to ST-13/ST-14.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-006).

---

### PF-007: Moving the breadcrumb to `PlanPage` removes the only Projects link from listing screens 🟠 MAJOR

**Dimension:** Logical Contradictions, Codebase Alignment (compatibility), Consistency
**Location:** `03-03-workspace.md` §Layout and components (16-18, 24-26); `01-requirements.md` R1 (17); `00-ambiguity-register.md` AR-2 (22).
**Codebase Evidence:** `discovery-ui/src/app.tsx:308-314` renders the only global breadcrumb, including the `Projects` link at line 309. `views/ProjectPage.tsx:19-60` has no other link back to `#/`. `03-03:18` assigns the "Real breadcrumb" to `PlanPage`, while `03-03:16` lists only Discovery identity, theme, and nav trigger in the shared header.

**The Problem:** R1 requires a shared product header with project/plan identity and a real breadcrumb; AR-2 says project and plan listings retain their current functions. If the breadcrumb moves into `PlanPage` and the header does not keep it, the project listing loses its only in-app path back to the projects list. The plan does not say whether the listing breadcrumb is preserved, so an executor can implement either a regression or an unplanned listing change.

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Keep the breadcrumb in the shared header for all routes; `PlanPage` renders the plan heading and does not duplicate the breadcrumb. | **Recommended** — preserves current navigation, satisfies R1/AR-2, and keeps one identity surface. |
| B | Keep the `PlanPage` breadcrumb and add a **Back to projects** link to `ProjectPage`, recording the listing change. | Viable, but changes a listing screen and needs explicit scope authority. |
| C | Accept the loss and rely on browser Back. | Dropped — violates AR-2. |

**Recommendation:** Option A. The header breadcrumb can use the identity channel from PF-005.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-007).

---

### PF-008: Module ownership and expected modification sets are inconsistent and incomplete 🟠 MAJOR

**Dimension:** Consistency, Dependency Issues, Ordering & Sequencing, Codebase Alignment
**Location:** `00-index.md` line 81; `02-current-state.md` line 24; `03-01-navigation-and-theme.md` line 37; `03-03-workspace.md` line 46; `99-execution-plan.md` lines 41, 71, 103, tasks 2.2.3 and 2.2.5.
**Codebase Evidence:** `00-index:81` lists `discovery-ui/src/{route,hooks,app,main,view-models}.ts*` as primary changes. `02:24` says `view-models.ts:310-384` needs workspace selection and display derivations. `03-01:37` says the new derivations live in `workspace-model.ts`, and `03-03:46` says "Extend `workspace-model.ts`". No phase set includes `view-models.ts` (`99:41,71,103,140`). Phase 2 threads editor props through `PlanPage.tsx` and `GroupSection.tsx`, but its expected set omits both (`99:71`). `api.ts` is unowned if the save-response type is corrected (`api.ts:66-69,82-88`).

**The Problem:** Under strict scope, the executor either edits files outside the declared set or drops behaviour the plan requires. The plan's own needs make `view-models.ts` changes unavoidable: `QuestionView` needs `storedAnswer` and `overridesImplied`, and `GroupView`/`workspaceView` needs count fields. Duplicating those derivations in `workspace-model.ts` creates a second source of truth; editing `view-models.ts` without a task violates the phase set. The same applies to the prop chain for `setIncomplete`/status and to the API response type.

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Keep `view-models.ts` as the shared server model; add explicit fields (`storedAnswer`, `overridesImplied`, hidden-question metadata, count inputs) and add it to Phase 2/3; `workspace-model.ts` owns selection, progress, and the draft overlay; add `PlanPage`/`GroupSection` to Phase 2; add `api.ts` for the outcome/save-response types; reconcile `02` and `00-index` to name both modules. | **Recommended** — one source of truth and accurate strict-scope sets. |
| B | Put every new derivation in `workspace-model.ts`; accept that retired/override data is dropped or duplicated. | Dropped — fails PF-002 and duplicates readiness logic. |
| C | Keep the sets and seek authorization mid-phase. | Dropped — violates strict scope and the phase-gate rule. |

**Recommendation:** Option A. Add an explicit task for the `view-models.ts` fields and name the new `navigation.ts` module from PF-006.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-008).

---

### PF-009: Phase exit criteria depend on UI delivered in later phases 🟠 MAJOR

**Dimension:** Ordering & Sequencing, Testability
**Location:** `99-execution-plan.md` lines 49, 57, 79, 89, 119-125; `07-testing-strategy.md` ST-9, ST-13, ST-20.
**Codebase Evidence:** Phase 1 runs ST-1–ST-9 green (`99:49,57`); ST-9 is a user journey that changes the theme, reloads, and returns to System (`07:35`), but the three-choice control is added by `DiscoveryHeader` in Phase 3 (`03-01:75-77`; `99:119`). Phase 2 runs ST-10–ST-20 green (`99:79,89`); ST-20 includes "closing disclosure" (added in task 3.2.3, `99:121`) and ST-13 uses a summary link (added in 3.2.4, `99:122`). The plan calls the ST table an immutable oracle and forbids weakening it (`07:20-21,77-79`).

**The Problem:** The phase exit criteria include integration behaviour that does not exist yet. The test author must either weaken the immutable STs or leave the phase red, which violates the specification-first rule and gives false green evidence for the riskiest integration (theme and disclosure).

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Split each affected ST into a pure case owned by Phase 1/2 (parser, resolver, preference persistence, partial deferral, history rejection) and an integration case owned by Phase 3 (control, disclosure, summary link), keeping every assertion exactly once. | **Recommended** — preserves the oracle and matches the phase's actual code. |
| B | Move the header/theme control and Additional-details foundation into Phase 1/early Phase 2. | Viable, but pulls Phase 3 UI into strict earlier sets and enlarges those phases. |
| C | Relax phase exits to "the subset implemented in this phase". | Dropped — weakens traceability and invites silent drops. |

**Recommendation:** Option A. Name the split in `07` and in the task references so the red/green evidence is unambiguous. Also map ST-1–ST-9 to the two Phase 1 suite files (routes/selection in navigation, theme in theme) and name both `*.impl.test.mjs` files.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-009).

---

### PF-010: Group progress and count semantics conflict 🟡 MINOR

**Dimension:** Consistency, Ambiguities
**Location:** `00-ambiguity-register.md` AR-7 (27); `03-03-workspace.md` §Navigation and progress derivations (49-68); `01-requirements.md` R6 (22); `07-testing-strategy.md` ST-24; `discovery-ui/src/views/PlanPage.tsx:66-69`.
**Codebase Evidence:** `bin/lib/discovery-rules.mjs:1181-1213` counts an open question as answered whenever `entry.effective !== null`, even when `changed` or `conflict` is set. `03-03:64-66` defines a different `answeredQuestions` that excludes unresolved change/conflict/proposal and includes submitted/recorded answers. `PlanPage.tsx:66-69` displays `plan.counts.answered`. AR-7 says group counts derive from existing readiness; `03-03:59-62` defines `complete` from lifecycle status.

**The Problem:** The same page can show two different "Answered" numbers, and a group can be `ready` but not `complete` or `complete` but not `ready` without distinct labels. The plan does not say which numbers appear in the header, rail, or summary. The `complete` measure is a progress measure, not the readiness count AR-7 describes, so the inconsistency is resolvable but not stated.

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Keep `ready`/`pendingCount`/`readyCount` as the AR-7 row counts; define `complete` as a separate lifecycle progress measure (R6); use one `answeredQuestions` derivation in the header, rail, and summary and keep `planCounts` for list pages; label **Ready** vs **Complete** explicitly. | **Recommended** — preserves AR-7's approved meaning and removes the double count. |
| B | Use `planCounts.answered` everywhere and drop the new exclusion wording. | Viable, but loses the intended "no unresolved change/conflict" display. |
| C | Show both counts with distinct labels. | Dropped — confusing, no user value. |

**Recommendation:** Option A. This does not change AR-7; it clarifies that the new `complete` progress measure is not a readiness count.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-010).

---

### PF-011: Continue can return to the current group and become a no-op 🟡 MINOR

**Dimension:** Logical Contradictions, Edge Cases
**Location:** `03-01-navigation-and-theme.md` §Workspace selection (44-45, 55-57); `07-testing-strategy.md` ST-6.
**Codebase Evidence:** `bin/lib/discovery-store.mjs:850-882` marks only questions with an effective answer or valid deferral as submitted; a `needsDiscussion` question stays `open` and readiness treats it as non-missing (`bin/lib/discovery-rules.mjs:1149,1162`). `QuestionView.statusKey` is `"discussion"` (`view-models.ts:206`). `nextWorkspace` wraps to the first eligible group.

**The Problem:** If the just-submitted group is the only group with pending visible questions (for example, it retains a needs-discussion question), Continue can return the current group. The "next group" label points at the group the user is already on, and the action does nothing.

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Exclude `currentKey` from `nextWorkspace`; if no other eligible group exists, return summary; add an ST case for a submitted group that retains a needs-discussion question. | **Recommended** — "Continue" always moves forward. |
| B | Keep the self-return and label the action **Stay** when it equals the current group. | Viable, but conflicts with the word "Continue". |
| C | Treat needs-discussion as terminal for Continue. | Dropped — changes existing semantics without authority. |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-011).

---

### PF-012: Delete-while-dirty is contradictory and bypasses the navigation boundary 🟡 MINOR

**Dimension:** Logical Contradictions, Edge Cases
**Location:** `03-02-editing-and-live-state.md` §Navigation boundary (118-119), §Errors and submission (156); `discovery-ui/src/app.tsx:281-290`; `views/PlanPage.tsx:138-150`.
**Codebase Evidence:** The delete handler deletes the plan and then writes `window.location.hash = "#/p/<project>"` directly (`app.tsx:281-290`). `03-02:156` says "Archive/Delete navigation also respects pending edits", while `03-02:118-119` says "Clear pending navigation if the current plan is deleted". No task or test defines the order.

**The Problem:** It is unclear whether Delete should flush first, block on a failed save, or discard the draft. Flushing immediately before destroying the plan is a wasted write that can trap the user; the direct hash write bypasses the new requested/displayed route boundary, so a pending navigation can try to restore a deleted plan. The same terminal shape appears when another tab deletes the plan and a refresh returns 404.

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Treat Delete as destructive: if dirty, the Delete confirmation includes an explicit **Discard unsaved changes** warning; on success dispose the editor and navigate outside the save boundary; a 404 refresh shows a terminal **Plan deleted** state with **Back to plans** and **Discard draft** (PF-001). | **Recommended** — safe, explicit, and avoids writing into a deleted plan. |
| B | Flush before Delete and abort on failure. | Viable, but pointless before destruction and can trap the user. |
| C | Bypass the boundary after confirmation without a discard warning. | Dropped — silent draft loss. |

**Recommendation:** Option A. Route the post-delete hash write through the navigation API from PF-006.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-012).

---

### PF-013: Draft-safety browser evidence is contradictory and incomplete 🟡 MINOR

**Dimension:** Testability, Consistency
**Location:** `07-testing-strategy.md` B1 (92), ST-20 (51); `03-02-editing-and-live-state.md` §Navigation boundary (120-122); `01-requirements.md` §Technical requirements (48).
**Codebase Evidence:** B1 says "reload a group and summary link" and expects "drafts preserved". `03-02:121-122` says browser reload cannot be awaited reliably, must not claim the write completed, and must not persist answers in localStorage. ST-20 says "close/reload with dirty/clean state ... no browser answer persistence". B3 covers navigation/submit/offline but not a dirty close/reload or collapse-after-typing.

**The Problem:** A page reload cannot preserve drafts by design, so B1 will produce a false failure or push an implementer toward forbidden localStorage persistence. The core R4 behaviours (dirty close/reload warning, collapse retention, no answer persistence) have no browser step; ST-20's unload portion cannot run in the Node suite.

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Reword B1 to "open a group link and a summary link"; add a separate dirty reload/close step that verifies the native warning and accepts draft loss; add a collapse-after-typing step; add a Node fake-storage test proving `edit()`/`flush()` never write answer data and that `unsaved` is correct. | **Recommended** — honest evidence and a testable safety boundary. |
| B | Keep B1 but expect draft loss. | Weaker, but acceptable if the wording is fixed. |
| C | Persist answers in localStorage. | Dropped — explicitly forbidden. |

**Recommendation:** Option A. Also add an archive/delete confirm-and-cancel step on an isolated scratch plan and assert the orphan/unarchive banners, since the new footer changes where those actions live.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-013).

---

### PF-014: Several specification rows are not precise oracles 🟡 MINOR

**Dimension:** Testability
**Location:** `07-testing-strategy.md` ST-21, ST-22, ST-23, ST-24, ST-25; `03-03-workspace.md` §Navigation and progress derivations (59-66); `scripts/discovery-ui.impl.test.mjs:99`; `scripts/discovery-ui.spec.test.mjs:473-478`.
**Codebase Evidence:** ST-21 says "Real metadata" but never asserts the breadcrumb text or links. ST-22 says "All controls/status/actions rendered with names" but names no accessible names or roles. ST-23 says "opened as specified", with the rules only in prose. ST-24 does not assert `answeredQuestions`. ST-25 omits an open question and a submitted question, although AC3 requires both. `scripts/discovery-ui.impl.test.mjs:99` pins `"0 of 0 ready"` for an empty group, while `03-03:61` says "Empty groups show No visible questions". The existing SSR test pins the literal `Submit group` and `Recommended` strings (`scripts/discovery-ui.spec.test.mjs:478`).

**The Problem:** R1's breadcrumb, R6's progress/count labels, and AC3's complete status matrix can regress while the oracle passes. The empty-group label can either break the existing implementation test or contradict the new rule, depending on where it is implemented. The always-rendered `Submit group` action and `Recommended` badge are required by the existing test but not stated in the new contract.

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Add exact assertions: breadcrumb links/text; accessible names and roles for each question type; a count matrix covering open, answered, deferred, discussion, submitted, recorded, and retired; an open and a submitted summary row; keep `GroupView.summary` unchanged (`"0 of 0 ready"`) and put "No visible questions" only in `workspaceView`/Nav; state that `Submit group` is always rendered for the selected group, disabled with visible reasons when not ready, and that the `Recommended` badge is retained. | **Recommended** — pins R1/R6/AC3 and preserves existing tests. |
| B | Rely on B2/B5/B6 for the vague parts. | Weaker — manual evidence is not a substitute for the status matrix. |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-014).

---

### PF-015: Empty-segment route policy is undefined 🟡 MINOR

**Dimension:** Ambiguities, Edge Cases, Compatibility
**Location:** `03-01-navigation-and-theme.md` §Routes (15, 25-28); `07-testing-strategy.md` ST-3.
**Codebase Evidence:** `discovery-ui/src/route.ts:39` filters empty segments before validation, so `#/p//my-repo/plan` and `#/p/my-repo/plan//summary` are normalized. Existing route tests cover malformed slugs and a non-empty extra segment, not empty segments (`scripts/discovery-ui.spec.test.mjs:229-231`). `03-01:15` says to use the existing parse/format convention; `:27` says to reject "unexpected suffixes, and extra segments".

**The Problem:** A new parser can pass ST-3 while changing the accepted/rejected result for trailing slashes, double slashes, or an empty group key. That is either a silent route-normalization change or an unintended acceptance of a malformed route. R9 says existing links keep working.

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Preserve the existing empty-segment normalization for legacy routes and state it explicitly; add ST cases for trailing slash, double slash, and an empty group key. | **Recommended** — keeps current accepted URL shapes. |
| B | Reject empty segments strictly and document the compatibility break for legacy links with trailing slashes. | Viable only with an explicit compatibility decision. |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-015).

---

### PF-016: Project slug and save-response type gaps in the plan's interfaces 🟡 MINOR

**Dimension:** Dependency Issues, Ambiguities, Codebase Alignment
**Location:** `03-01-navigation-and-theme.md` §Routes (22-23, 30-33); `03-03-workspace.md` §Layout and components (17-18, 22), §Summary (98); `03-02-editing-and-live-state.md` §State and interface (47, 75); `99-execution-plan.md` tasks 3.2.2-3.2.5.
**Codebase Evidence:** `PlanPage` receives `projectName` and `branch` but no `projectSlug` (`app.tsx:261-267`); `PlanView` has only the plan slug (`view-models.ts:116-132`). Group/summary links require `#/p/<project>/<plan>/...`. `api.ts:66-69,82-88` types `saveAnswer` as returning `PlanResponse = { project, plan }`, but the server's save route returns `{ plan: summarize(result.plan) }` (`bin/lib/discovery-server.mjs:441`) with no `project`.

**The Problem:** R2's stable group and summary links cannot be built without the project slug; an implementer may use the display name, which is not a slug. A save response may be read as containing `project` and yield `undefined`, or require an unsafe cast that violates the coding standards. The plan says "retain known project metadata" but does not name the type correction or the merge test.

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Pass `projectSlug` (or an `hrefFor(target)` helper) from `App` to `PlanPage`/`PlanNavigation`/`DecisionSummary`; add `SavePlanResponse = { plan: PlanRecordLike }` (or document the merge) and include `api.ts` in Phase 2; add exact href assertions in ST-2/ST-21. | **Recommended** — smallest change and no unsafe cast. |
| B | Add `project` to `PlanView`. | Viable, but wider than needed. |
| C | Build hrefs in `App` and pass them down. | Viable; more props but no view-model change. |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-016).

---

### PF-017: Narrow-screen nav drawer focus return and Escape contract is missing 🟡 MINOR

**Dimension:** Edge Cases, Accessibility (R8)
**Location:** `01-requirements.md` R8 (24); `03-03-workspace.md` §Visual reference (35-36), §Accessibility and states (114); `07-testing-strategy.md` B6 (97).
**Codebase Evidence:** `03-03:35-36` says selecting a destination closes the nav and moves focus to the new heading. `03-03:114` says dialogs restore focus to their trigger. There is no rule for closing the drawer with Escape or the backdrop, or for focus return when the drawer is dismissed without a destination. `@fluentui/react-components` exports `NavDrawer` and `NavDrawerBody`.

**The Problem:** A keyboard user who opens the drawer and cancels may lose focus or land on an arbitrary element. B6 expects "focus return", but the plan does not pin the overlay type or the cancel behaviour.

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | Specify a modal `NavDrawer` (overlay) with Escape/backdrop close and focus return to the labelled toggle; add it to B6. | **Recommended** — matches the approved collapsible-navigation direction and gives a testable contract. |
| B | Specify an inline collapsible nav with no focus trap; focus stays on the toggle. | Viable, but different responsive behaviour. |
| C | Rely on Fluent defaults without documenting. | Dropped — not testable. |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-017).

---

### PF-018: ST-27 duplicates existing build/package coverage and does not guard devDependencies 🔵 OBSERVATION

**Dimension:** Testability, Scope Creep
**Location:** `07-testing-strategy.md` ST-27 (63); `scripts/discovery-ui.spec.test.mjs:400-428,482-527`.
**Codebase Evidence:** The existing suite already checks the nonce template, no remote assets, the 1,048,576-byte bundle limit, exactly one `@griffel/core` copy, and the packed file list. `scripts/discovery-ui.spec.test.mjs:490` pins only runtime `dependencies`; `:491-500` only asserts that expected `devDependencies` exist, so a new devDependency (for example, a forbidden browser harness) would not fail.

**The Problem:** ST-27 creates a second owner for the same invariants, so a change must update two suites. Its "no new dependencies" claim is not measured for `devDependencies`.

**Options:**

| Option | Description | Verdict |
| --- | --- | --- |
| A | State that ST-27 reuses the existing build/package suite; add a package-diff or exact devDependency allowlist if the no-new-dependency constraint must be enforced. | **Recommended** — avoids duplication and closes the guard gap. |
| B | Drop ST-27 and rely on the existing suite. | Viable. |

**Recommendation:** Option A. This is an observation; it does not block the pass.

**User Decision:** AI — delegated by `--auto-design` (provenance PF-018).

---

## Delegated decision provenance

`--auto-design` was active for this run. Root invocation ID `pf-discovery-ui-redesign-20261029-1`; policy version 1. Every decision below stays inside the confirmed product baseline, contradicts no user decision, and creates no reserved-authority consequence (no scope, acceptance-criteria, security-policy, or product-behavior change). The `--auto-commit` token was treated separately as action permission and is not authority for these decisions.

### PF-001

```text
Authority: AI — delegated by --auto-design
Eligibility: failure and recovery design; the existing R4/AC2 draft-safety requirement is infeasible without an explicit exit from a terminal draft.
Objective: Never lose a draft silently and never trap the user on a group that cannot be saved.
Decision: Add discard(key)/discardAll(), a visible Discard unsaved change action, a Leave without saving confirmation at the blocked-navigation notice, and a terminal plan-deleted state.
Evidence: bin/lib/discovery-store.mjs:737-746; 03-02:55-64,114-116,145-147; QuestionCard.tsx:153,287-291.
Rejected alternatives: B (stop blocking and move drafts to a plan-level review area) weakens the literal guard; C (auto-drop after warning) loses work.
Strongest counterargument: A still blocks until the user finds Discard, and two destructive paths (per-draft discard and leave-confirmation) increase UI surface.
Confidence: High — a store change that makes read-only saves possible would change this.
Hardening: One independent challenger; converged on A.
Policy version: 1
Root invocation ID: pf-discovery-ui-redesign-20261029-1
Reopen triggers: A new terminal question state; a server/API change that accepts saves to read-only questions; user rejection of a visible discard action.
```

### PF-002

```text
Authority: AI — delegated by --auto-design
Eligibility: interface and data-flow design inside the approved R4 behavior.
Objective: Display drafts immediately, keep overlays across view changes/refreshes, and retain reviewable context for hidden/retired/removed questions.
Decision: Add a pure applyDrafts(planView, drafts, errors) display derivation, storedAnswer/overridesImplied/hidden-question metadata, and an Unsent drafts summary section; keep rule evaluation on the accepted snapshot.
Evidence: discovery-ui/src/view-models.ts:79-99,219-282,318-332; bin/lib/discovery-rules.mjs:1065-1077; QuestionCard.tsx:222-237; 03-02:86,127-139.
Rejected alternatives: B (draft props in each card) duplicates merge logic and cannot feed the summary; C (server-only echo) fails immediate display and rapid multi-select.
Strongest counterargument: The overlay becomes a second model that can drift from groupReadiness; attempted values on read-only cards must be labelled clearly.
Confidence: High — a view-model redesign that already exposes drafts would change this.
Hardening: One independent challenger; converged on A and added the hidden-question metadata requirement.
Policy version: 1
Root invocation ID: pf-discovery-ui-redesign-20261029-1
Reopen triggers: A different display architecture; a rule change that makes draft values part of readiness; inability to expose hidden-question metadata without a server change.
```

### PF-003

```text
Authority: AI — delegated by --auto-design
Eligibility: concurrency/state consistency and failure recovery inside the approved editor lifecycle.
Objective: Make partial deferral work visible to the guard and immune to refresh overwrite.
Decision: Add incomplete: Record<string, {reason}> to EditorSnapshot, include it in unsaved/guards, add a dirty guard in DeferFields, and reword the state-ownership sentence.
Evidence: 03-02:28,47-54,120; DeferFields.tsx:38-51; 03-03:78.
Rejected alternatives: B (move partial values into PlanEditor) is cleaner for testability but a larger contract; C (prevent remount) does not fix the refresh effect.
Strongest counterargument: Local values plus a reason remain split-brain; a missed guard or remount still loses text.
Confidence: Med — a refresh sequence that bypasses the dirty guard would reopen this.
Hardening: One independent challenger; converged on A, with B retained as the reopen choice.
Policy version: 1
Root invocation ID: pf-discovery-ui-redesign-20261029-1
Reopen triggers: A partial deferral is lost in implementation; a new local-draft control is added; the guard needs values rather than a reason.
```

### PF-004

```text
Authority: AI — delegated by --auto-design
Eligibility: internal interface and failure/recovery design; no server or product change.
Objective: Make every required submit, refresh, and recheck outcome observable and testable.
Decision: Add a typed SubmitOutcome and snapshot fields delivery, lastError, missing, and recheckRequired; recompute dialog data from the accepted snapshot; define labels for all SaveStatus values.
Evidence: api.ts:71-75; discovery-server.mjs:480-502; 03-02:47-64,143-156; PlanPage.tsx:123-137.
Rejected alternatives: B (onOutcome callback) is a parallel channel; C (submit in React) bypasses the editor's ordering and guards.
Strongest counterargument: The snapshot accumulates transient event data and can go stale; a separate typed outcome event may be cleaner.
Confidence: High — a server response change that omits delivery/missing would change this.
Hardening: One independent challenger; converged on A.
Policy version: 1
Root invocation ID: pf-discovery-ui-redesign-20261029-1
Reopen triggers: The dialog must remain open across recheck; the server stops returning delivery/skipped; a new submission outcome is added.
```

### PF-005

```text
Authority: AI — delegated by --auto-design
Eligibility: internal architecture and interface selection inside the confirmed shared-header requirement; no product change.
Objective: Let the header change the theme, open the nav drawer, and show loaded identity without breaking the App render contract.
Decision: Add one optional shell coordination object to App (theme preference/setter, nav open/setOpen, loaded identity, navigation request); PlanRoute publishes identity through an optional callback. Record that existing {route, api, initial} calls remain supported.
Evidence: main.tsx:23-31; app.tsx:44-49,137-141,300-304; spec.test.mjs:447; 03-02:111.
Rejected alternatives: A (shell context) is cleaner if the surface grows; C (header in each route) duplicates the header.
Strongest counterargument: The optional prop surface grows as the shell gains controls; a context avoids repeated threading.
Confidence: Med — a fourth shell concern or a deeper component tree would make the context the better choice.
Hardening: One independent challenger; diverged from the lead's initial context preference and recommended optional props; the lead reconciled to optional props for smallest change and codebase consistency.
Policy version: 1
Root invocation ID: pf-discovery-ui-redesign-20261029-1
Reopen triggers: More than three shell concerns; header used outside App; SSR contract change.
```

### PF-006

```text
Authority: AI — delegated by --auto-design
Eligibility: concurrency/ordering and testing-strategy design inside the approved navigation guard.
Objective: Make replace/push/back/forward/restore behavior observable and correct.
Decision: Add a pure navigation-intent module and useHashRoute navigate/replace plus popstate, with pure interleaving tests; name the theme storage seam.
Evidence: hooks.ts:14-24; app.tsx:285; 03-01:52-53; 03-02:108-122; 07 ST-13/ST-14.
Rejected alternatives: B (App-owned, browser-only) leaves the guard untested; C (B1 only) has no automated evidence.
Strongest counterargument: Browser history ordering is subtle; the pure machine may not match real popstate/hashchange timing, so B1 remains required.
Confidence: High — a decision to adopt a router dependency would change this.
Hardening: One independent challenger; converged on A.
Policy version: 1
Root invocation ID: pf-discovery-ui-redesign-20261029-1
Reopen triggers: A router is approved; the browser exposes a different history event order; ST-13/ST-14 cannot be expressed as pure interleavings.
```

### PF-007

```text
Authority: AI — delegated by --auto-design
Eligibility: compatibility and presentation placement inside R1/AR-2; preserving an existing function is not scope expansion.
Objective: Keep a working path from a project listing back to Projects while satisfying R1.
Decision: Keep the breadcrumb in the shared header for all routes; PlanPage renders the plan heading only.
Evidence: app.tsx:308-314; ProjectPage.tsx:19-60; 03-03:16-18; AR-2.
Rejected alternatives: B (add a Back to projects link to ProjectPage) changes a listing screen and needs explicit authority; C (accept loss) violates AR-2.
Strongest counterargument: The approved visual reference places the breadcrumb at the start of page content, so a header breadcrumb may crowd controls or duplicate the plan heading.
Confidence: High — a user decision to move the breadcrumb into the page would change this.
Hardening: One independent challenger; converged on A.
Policy version: 1
Root invocation ID: pf-discovery-ui-redesign-20261029-1
Reopen triggers: The user approves a listing-screen change; the visual reference requires a page-level breadcrumb.
```

### PF-008

```text
Authority: AI — delegated by --auto-design
Eligibility: implementation organization and sequencing inside the confirmed modification set.
Objective: Give every required change an owning phase and one source of truth.
Decision: Keep view-models.ts as the shared server model; add the required fields and phase ownership; workspace-model.ts owns selection/progress/overlay; add PlanPage/GroupSection to Phase 2 and api.ts for the outcome/save types; reconcile 02/index.
Evidence: 00-index:81; 02:24; 03-01:37; 03-03:46; 99:41,71,103; view-models.ts:79-99,116-132.
Rejected alternatives: B (all in workspace-model) loses retired/override data; C (expand mid-execution) violates strict scope.
Strongest counterargument: Expanding Phase 2 to include views blurs the editing phase and increases review size; a pure Phase 2 would postpone ST-10–ST-20's green exit.
Confidence: High — a decision to keep Phase 2 pure would change the split.
Hardening: One independent challenger; converged on A.
Policy version: 1
Root invocation ID: pf-discovery-ui-redesign-20261029-1
Reopen triggers: view-models.ts cannot expose the needed data without changing rule semantics; Phase 2 is deliberately narrowed to the editor.
```

### PF-009

```text
Authority: AI — delegated by --auto-design
Eligibility: testing strategy and implementation sequencing; no behavior change.
Objective: Keep every assertion immutable and assign it to the phase that can actually run it.
Decision: Split ST-9, ST-13, and ST-20 into pure and integration cases owned by Phase 1/2 and Phase 3 respectively; keep each assertion exactly once.
Evidence: 99:49,57,79,89,119-125; 07 ST-9/13/20; 03-01:75-77.
Rejected alternatives: B (move UI earlier) enlarges strict phases; C (relax exits) weakens the oracle.
Strongest counterargument: Split cases are less end-to-end, and a phase can pass without the user-visible half.
Confidence: High — a decision to move the header into Phase 1 would change this.
Hardening: One independent challenger; converged on A.
Policy version: 1
Root invocation ID: pf-discovery-ui-redesign-20261029-1
Reopen triggers: Phase 3 is reordered; an ST cannot be split without losing its meaning.
```

### PF-010–PF-018

| PF | Eligibility | Decision | Rejected alternatives | Counterargument | Confidence | Reopen trigger |
| --- | --- | --- | --- | --- | --- | --- |
| PF-010 | Display consistency inside R6; AR-7 row counts unchanged | Keep readiness row counts; add a separate lifecycle `complete` progress measure; one `answeredQuestions` derivation; label Ready vs Complete | Plan counts everywhere; show both | Two progress notions still need clear labels | Med | A user asks for readiness-based progress; the header must show `planCounts.answered` |
| PF-011 | Algorithmic selection | Exclude `currentKey`; fall back to summary; add an ST | Label "Stay"; treat discussion as terminal | A discussion-only group may deserve a revisit | High | The workflow needs to return to a discussion-only group |
| PF-012 | Destructive-action failure design | Dirty Delete uses an explicit discard warning; success disposes and navigates outside the boundary; 404 is terminal | Flush then delete; bypass without warning | Users may expect a final save before delete | High | The user asks Delete to preserve drafts |
| PF-013 | Testing strategy | Reword B1; add dirty reload/close and collapse-retention steps; fake-storage test | Keep B1 with draft loss; persist answers | Native unload warnings are browser-controlled | High | The browser cannot show the warning in the test environment |
| PF-014 | Test oracle precision | Add exact breadcrumb/name/count/status assertions; keep `"0 of 0 ready"` in `GroupView.summary`; state Submit group always rendered and Recommended retained | Rely on B2/B5/B6 | More assertions increase fixture size | High | The existing implementation test changes |
| PF-015 | Route compatibility | Preserve empty-segment normalization; add route cases | Reject empty segments and declare a break | Strictness may be preferable | High | The user prefers strict rejection |
| PF-016 | Interface data flow | Pass `projectSlug`/`hrefFor`; add `SavePlanResponse`; test hrefs and the merge | Add `project` to `PlanView`; build hrefs in App | More props or a wider view model | High | The API starts returning `project` with saves |
| PF-017 | Accessibility within R8 | Modal `NavDrawer`, Escape/backdrop close, focus return to toggle; add to B6 | Inline nav; rely on Fluent defaults | A modal drawer may be heavier than needed | Med | The approved visual direction requires inline nav |
| PF-018 | Test strategy observation | Reuse the existing build/package suite; add a package-diff or devDependency allowlist | Drop ST-27 (viable) | A package diff can be noisy | High | A new build invariant needs its own assertion |

---

## Same-agent bias and unverified references

This plan was created in an earlier session, not this one, but by the same model family. `--auto-design` resolves eligible technical choices; it does not remove the need for an independent expert review of the finalized plan. The scan used five independent dimension-cluster auditors and one blind design challenger. The challenger diverged on PF-005 (it preferred optional props over a shell context); the reconciliation is recorded in the provenance table.

The following references could not be verified against the repository and are not treated as evidence for or against a finding:

| Reference | Why it could not be verified |
| --- | --- |
| Approved preview at `http://127.0.0.1:4758/#scope` | Temporary authoring reference; no source or running server in the repository. |
| AR-1–AR-10 user decisions | Recorded decisions; no transcript or independent artifact. |
| "The working tree was clean before this plan's register was added" | Historical state; the current tree has the new plan directory and a modified roadmap row. |
| "The user previously retained `discovery-ui-reviewer` as a proposal only" | No repository artifact found. |
| Live browser behaviour (focus, CSP console, 390px/200% zoom, native unload warning) | Not run; the report's browser claims are static or plan-level. |
| Final post-redesign bundle size and Fluent Nav runtime DOM | Not built; current bundle is 578,137 bytes against a 1,048,576-byte budget. |

**Baseline verified:** `npm run verify` passed on 2026-10-29 (577 tests, 0 failures, version 2.2.1). `npm run build:discovery` and `npm pack --dry-run` were not run in this audit; the existing build/pack tests are part of `npm run verify`.

## Security and scope notes

- **Security:** no findings. The redesign adds no server route, auth path, endpoint, or remote asset. Hash values remain allowlisted and decoded once; group keys use `KEY_PATTERN` (`bin/lib/discovery-rules.mjs:34`), which excludes separators. Question text remains React-escaped; no `dangerouslySetInnerHTML` or `innerHTML` exists in `discovery-ui/src`. Only the allowlisted theme preference is stored. CSP nonce handling is unchanged.
- **Scope:** no scope-creep findings. The new `plan-editor.ts`, `workspace-model.ts`, `theme.ts`, and `navigation.ts` modules are bounded to the approved editing, selection, theme, and navigation work. No new dependency, browser harness, service, server protocol, specialist, or release is proposed. The skip link is a normal implementation of R8 keyboard operation; it is not treated as an optional addition.

## Iteration 2 verification

**Artifact revision:** combined SHA-256 `9637d80c7778f5bd1c039f8206b67ba1aebb3a3ec8cd4dc8881d6f8b45dfca9e` (the nine target documents).

**Fix verification:** every PF-001–PF-018 resolution in the log above was re-read against the amended documents; no prior finding was reopened.

**Direct-consequence checks:**

- `discard` advances the local operation sequence so an in-flight acknowledgement cannot reapply the discarded value.
- `ProjectRoute` and `PlanRoute` both publish identity; the header keeps the breadcrumb on listing screens.
- When the shell object is absent (SSR/render tests), the header shows the System preference with a no-op setter and reads no browser global.
- `GroupView.summary` stays `0 of 0 ready`; the empty label lives in `workspaceView`.
- `Submit group` is always rendered for the selected group; the `Recommended` badge is retained.
- ST-9, ST-13, and ST-20 each have one pure half and one Phase 3 integration half.
- `view-models.ts`, `api.ts`, `workspace-model.ts`, `navigation.ts`, `PlanPage.tsx`, and `GroupSection.tsx` have owning phase sets and tasks.

**Bounded fresh scan:** all 13 dimensions were re-read within the unchanged audit target. Zero new findings. Security and scope remain clean. The baseline `npm run verify` passes again after the edits (577 tests, 0 failures, version 2.2.1).

**Residual notes (not findings):**

- The approved preview is still unavailable for visual comparison; browser acceptance B1–B8 remains the evidence path.
- `npm run build:discovery` and `npm pack --dry-run` were not run after these documentation-only edits; the plan requires them during execution.
- The iteration 1 evidence and decisions are preserved above; the resolution log is the iteration 2 authority.

## Verdict

✅ **PREFLIGHT PASSED — all 18 findings resolved.** The plan is grounded in the existing Discovery architecture, its route/data/test compatibility claims are accurate, and the amended set now has an explicit draft-recovery path, a testable navigation gate, a header coordination contract, and phase-accurate ownership. Proceed to `exec-plan`.

## Next steps

| Step | Owner |
| --- | --- |
| Advance the `REQ-DISCOVERY-UI-REDESIGN` roadmap row to **Plan Preflighted 🔬**. | Preflight owner |
| Execute the plan with `exec-plan`; keep B1–B8 as the user's browser evidence. | Implementer / user |
