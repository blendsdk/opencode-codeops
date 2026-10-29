# Current state: discovery-ui-redesign

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **CodeOps Artifact Schema**: 1

## Observed baseline

Discovery is implemented and its original plan is complete. The latest relevant committed change
is `9d8e957`, the fallback-port test isolation fix. The working tree was clean before this plan's
register was added. The UI uses React 19.3.1 and Fluent UI 9.74.11; the installed umbrella package
exports Nav, NavItem, NavDrawer, and their companion components.

The visual preview is a separate sample-data application. Its layout is approved; its fixed groups,
seeded answers, fabricated branch name, and localStorage answer model are not part of production.

## Relevant implementation

| File / evidence | Current role | Required change |
| --- | --- | --- |
| `discovery-ui/src/app.tsx:297-341` | Centred 1100px shell and hand-rendered breadcrumb | Shared header and workspace composition |
| `discovery-ui/src/views/PlanPage.tsx:104-112` | Renders every group consecutively | Render the selected group or decision summary |
| `discovery-ui/src/route.ts:36-66` | Three hash routes and strict unknown-route rejection | Add explicit group/summary suffixes while preserving old route shapes |
| `discovery-ui/src/view-models.ts:310-386` | Shared-rule-backed visibility, locks, counts, readiness, retired items | Add the display fields the workspace needs (`storedAnswer`, `overridesImplied`, count inputs) without changing rule semantics; selection/progress live in `workspace-model.ts` |
| `discovery-ui/src/app.tsx:142-228` | One pending text patch, one debounce timer, fire-and-forget flush | Plan-local pending edits, an awaitable save boundary, and an explicit discard path for unsaveable drafts |
| `discovery-ui/src/app.tsx:230-250` | Live refresh replaces plan; Submit operates independently | Coordinate save acknowledgements, refreshes, and submission |
| `discovery-ui/src/views/QuestionCard.tsx` | Four types, all state warnings, local text drafts | Token-based cards, additional-details disclosure, and the draft overlay |
| `discovery-ui/src/views/DeferFields.tsx` | Partial local deferral draft; emits only complete values | Preserve edits when disclosure or navigation changes and report incomplete work |
| `discovery-ui/src/views/SubmitDialog.tsx` | Shared confirmation surface | Preserve both group and all-ready confirmation content and focus; recompute after flush |
| `discovery-ui/src/hooks.ts:27-38` | OS-only theme | System/Light/Dark preference with browser integration inside effects |
| `discovery-ui/src/main.tsx:22-42` | FluentProvider inside nonce-aware RendererProvider | Supply resolved theme while keeping the nonce contract |
| `discovery-ui/src/views/{ProjectsPage,ProjectPage}.tsx` | Existing listing functions | Keep working within common header; no listing redesign |
| `scripts/discovery-ui.spec.test.mjs:220-239,429-479` | Existing routes and initial-data SSR | Preserve these assertions; add destination-specific cases separately |

## Required corrections within the navigation boundary

The current non-awaited `flush()` can finish after a navigation or submit request. Only one pending
patch is retained, so treating the preview's browser-local persistence as a drop-in replacement
would hide rather than solve the problem. AR-6 authorizes the direct plan-local edit coordination
needed for a navigable workspace. It does not authorize a server revision redesign or an offline
synchronization service.

The stored `revision` advances on publish, not on every answer save (`bin/lib/discovery-store.mjs`
publish/save paths). Consequently the UI must order its own write acknowledgements; it cannot use
revision alone to identify the newest answer response. Existing cross-client write semantics remain
unchanged. See 03-02 for the bounded client policy.

A draft can also become permanently unsaveable: another client submits or records the question, a
prerequisite disappears, or a republish retires, hides, or removes it. The save boundary must keep
that draft visible for review and provide an explicit discard/terminal exit; otherwise the
navigation guard traps the user. This is part of the same plan-local correction, not a new
persistence service or server behavior.

## Dependencies and constraints

- Build, package files, CSP template, server API and shared rule modules already exist.
- No root browser-test framework is installed. Existing tests use Node, pure TypeScript modules,
  esbuild-built render smoke fixtures, and real HTTP listeners for server integration.
- `App({ route, api, initial })` supports synchronous SSR with initial data; preserve it.
- The existing render test expects the legacy plan URL to show Scope, Refund policy, Recommended,
  and Submit group. The first-actionable-group policy can satisfy that test unchanged.
- Browser history, local storage, matchMedia, and live event subscriptions belong in browser hooks
  or effects; pure render/model functions remain safe without `window`.

## Risks

| Risk | Impact | Mitigation owner |
| --- | --- | --- |
| Dropped text during group change | User loses a decision | 03-02 save and navigation boundary |
| Late response overwrites newer local text | Misleading answer state | 03-02 pending overlay / response ordering |
| Hidden supplementary controls hide unresolved work | User cannot complete a group | 03-03 disclosure policy |
| Republish invalidates a selected group | Broken navigation | 03-01 selection reconciliation |
| Unsaved draft becomes unsaveable | User cannot leave the group or submit | 03-02 discard, retained-context, and terminal states |
| Recommendation becomes a default answer | A choice is incorrectly attributed to the user | Existing rule tests plus 07 workspace coverage |
| Theme styling breaks CSP or contrast | Unusable page | Existing nonce/build tests and browser acceptance |
