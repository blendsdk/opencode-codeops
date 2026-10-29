# Ambiguity Register: discovery-ui-redesign

> **Status**: ✅ GATE PASSED — all 10 items resolved
> **Last Updated**: 2026-10-29 00:12
> **CodeOps Artifact Schema**: 1
> **Scope mode**: strict
> **Authority**: normal mode; no delegated design authority

## Planning boundaries

| Boundary | Target |
| --- | --- |
| Planning target | Standalone Discovery plan-workspace redesign based on the user-approved interactive Fluent UI Nav preview |
| Context artifacts | Existing `plans/discovery/` contracts and findings; `discovery-ui/src/`; related tests, package/build configuration, and the approved temporary preview |
| Planning modification set | This new `plans/discovery-ui-redesign/` document set and its `REQ-DISCOVERY-UI-REDESIGN` roadmap row, confirmed in AR-10 |

## Decisions

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | UX & presentation | Visual direction and question density | Interactive preview: Fluent UI Nav sidebar, one group at a time, answer-choice cards, expandable context, progress rail, sticky submit footer, decision summary, responsive navigation | User: **LGTM** after viewing the interactive preview at `http://127.0.0.1:4758/#scope`. Approves the visual direction; sample data and demo persistence are not production contracts. | ✅ Resolved |
| 2 | Scope | Coverage of the redesign | Plan workspace and shared header first / all Discovery screens | User: **Plan workspace first (Recommended)** — group navigation, question layout, summary, progress, and shared header; project and plan listings retain their current functions. | ✅ Resolved |
| 3 | Behavioral / integration / data | Live behaviour versus demo behaviour | Preserve existing Discovery behaviour | User: **Preserve behaviour (Recommended)** — live API-backed answers; all question types, notes, deferrals, discussion flags, implications, proposals, group/all-ready submission, confirmations, and agent waking. Existing read-only, retirement, archive/delete, live-update, and security contracts remain applicable. | ✅ Resolved |
| 4 | UX / data | Theme selection and persistence | System/light/dark with browser preference / follow system only | User: **System, light, dark (Recommended)** — default to OS theme; explicit overrides are remembered in the browser. | ✅ Resolved |
| 5 | Navigation / compatibility / edge cases | Deep links, initial selection, and selection after republish | Preserve existing plan URLs; add group and summary hash destinations; initially select the first unlocked group with pending visible questions, otherwise the summary. Keep a selected group across updates; if it disappears, show the summary with a notice / always start on the summary | User accepted the recommended first-actionable-group policy: **Approve rules 5–10 (Recommended)**. | ✅ Resolved |
| 6 | Data / concurrency / errors | Pending edits when switching views, submitting, or receiving live updates | Save pending edits before navigation or submission; show Saved only after server acknowledgement; on failure retain the draft, show Retry, and stay on the current view. Keep local edits through live refreshes; stale/read-only/locked responses require rechecking current server state before retry. Warn before closing/reloading with unsaved work. | User accepted this policy: **Approve rules 5–10 (Recommended)**. | ✅ Resolved |
| 7 | Behaviour / presentation | Production group flow, summary, and count meanings | Stay on the submitted group with a Continue action; summary lists current visible answers with their actual statuses and links to groups, with retired questions separately collapsed. Submit all ready groups is available from the summary. Group counts derive from existing readiness; no recommendations preselected. Locked groups remain inspectable, read-only, and explain prerequisites. | User accepted this policy: **Approve rules 5–10 (Recommended)**. | ✅ Resolved |
| 8 | Presentation / accessibility | Placement of supplementary controls and responsive navigation | Notes/deferrals/discussion under an expandable Additional details section; automatically reveal active deferrals/discussion and validation issues. Keep question rationale, proposal/conflict/changed warnings, and implied-answer provenance visible. On narrow screens use collapsible group navigation; preserve keyboard operation, focus return, and screen-reader announcements. Theme choice uses System/Light/Dark; blocked storage falls back to an in-memory preference. | User accepted this policy: **Approve rules 5–10 (Recommended)**. | ✅ Resolved |
| 9 | Technical / non-functional / verification | Integration and acceptance boundaries | Reuse React 19, installed Fluent UI v9 Nav, Griffel tokens/CSP nonce, existing hash router, API, rules, and esbuild; no new dependency or browser-test framework. Specification-first Node tests plus render/build/pack checks; full `npm run verify`, `npm run build:discovery`, and `npm pack --dry-run`; user browser acceptance covering Firefox/Chrome, narrow widths, keyboard, all question states, and save/submit failures. | User confirmed this stack and verification: **Approve rules 5–10 (Recommended)**. | ✅ Resolved |
| 10 | Naming / scope / workflow | Plan identity, modification boundaries, and roadmap linkage | `plans/discovery-ui-redesign/`, standalone `REQ-DISCOVERY-UI-REDESIGN` row in `plans/00-roadmap.md`. Planning writes this new document set and that row. Later implementation covers the browser UI, relevant tests, README, and CHANGELOG; historical Discovery plan and server/store/tool contracts remain context. Preserve existing test expectations except explicitly superseded presentation assertions, identified before replacement tests are written. | User authorized this boundary and roadmap linkage: **Approve rules 5–10 (Recommended)**. | ✅ Resolved |

## Decision grounding

- **AR-5:** `discovery-ui/src/route.ts:36-48` currently accepts three page shapes; `app.tsx:323-328` keys the plan component by project/plan. Group selection must become an explicit destination without losing compatibility with published plan links.
- **AR-6:** `discovery-ui/src/app.tsx:142-143,197-227` has one debounced pending patch and a non-awaited flush; `:238-249` submits independently; `:230-236` refreshes on live events. Navigation needs an explicit save boundary so a hidden/unmounted editor cannot lose its last edit or display stale saved state.
- **AR-7:** `discovery-ui/src/view-models.ts:310-384` derives visibility, locks, readiness, and retired questions from the shared rules; `views/PlanPage.tsx:88-150` owns group/all-ready confirmations and archive/delete actions.
- **AR-8:** `views/QuestionCard.tsx` and `views/DeferFields.tsx` contain the full current controls and local text drafts; `hooks.ts:27-37` follows the OS theme. The approved preview has optional context, a narrow-screen navigation toggle, and theme controls.
- **AR-9:** `package.json` owns the existing dependencies and verification scripts; `scripts/discovery-ui.spec.test.mjs` covers routes, view models, render/build/pack, API, and nonce wiring. The Discovery findings ledger records why real-browser typing, focus, and both submission paths need acceptance checks.
- **AR-10:** `plans/discovery/00-index.md:6` demonstrates the existing standalone `REQ-*` convention. No upstream requirements directory is present.

## Lens and minimum-sufficient checks

- **Web application:** group navigation, form states, focus, responsive layout, escaped question text, and existing CSP/loopback protections.
- **Distributed/concurrent:** debounced edits, in-flight saves, live events, republish, and group navigation share one plan state. The existing server remains the persistence authority.
- **Data/migration:** retain existing stored data and published plan links; only a browser-local theme preference is new. No data migration is proposed.
- **Smallest viable design:** compose the existing plan view with Nav, group selection, and a summary; keep the existing route/API/rule boundary and small view components. Add only directly required state handling for safe navigation.
- **Complexity gate:** no new support framework, service, dependency, browser harness, or specialist creation is proposed.
- **Stakeholders:** the existing local developer user; no new roles or sharing model.
- **Specialist context:** the user previously kept `discovery-ui-reviewer` as a proposal only. This plan does not authorize its creation.

## Gate confirmation

The user confirmed AR-1 through the preview, AR-2–AR-4 individually, and AR-5–AR-10 with
**Approve rules 5–10 (Recommended)**. All 12 universal categories were checked through the rows
and lens notes above. No material item is open or deferred. Phase 2 document authoring may proceed.
