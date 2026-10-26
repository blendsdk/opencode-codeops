# Web UI: discovery

> **Document**: 03-06-web-ui.md
> **Parent**: [Index](00-index.md)

## Overview

The Discovery page is a React 19 + Fluent UI v9 app bundled with esbuild and served by the
listener (03-04). It has three views — projects, a project's plans, a plan's question groups —
reached by hash routes (AR-3, AR-36). All derivations live in pure modules; the React views stay
thin (AD-58). Executors load the `fluentui` skill (exact props and imports, Fluent v9.74.7
baseline) and the `fluentui-design` skill (patterns PAT-001 application shell, PAT-002 list page,
PAT-004 form page) before writing view code.

## Architecture

### Current Architecture
No web UI exists. `tsconfig.json` covers `plugin/**` with `jsxImportSource: @opentui/solid`.

### Proposed Changes

```text
discovery-ui/
  index.html                 template: <meta name="csp-nonce" content="__CSP_NONCE__">, #root,
                             <script type="module" src="/assets/app.js">
  tsconfig.json              jsx react-jsx, strict, noEmit, allowImportingTsExtensions,
                             erasableSyntaxOnly, lib dom + es2022, moduleResolution bundler
                             (UI modules import types with `import type`, because Node type
                             stripping resolves every runtime import)
  src/main.tsx               nonce + document → createAppRenderer → RendererProvider → FluentProvider → App
  src/renderer.ts            createAppRenderer(nonce, targetDocument?) (pure factory, tested by ST-52)
  src/app.tsx                App({ route, api, initial? }): shell, header, breadcrumb, routed view, banner
  src/route.ts               parseRoute / formatRoute (pure)
  src/api.ts                 typed fetch wrappers and error mapping (pure apart from fetch)
  src/view-models.ts         projectsView / projectView / planView / questionView (pure)
  src/hooks.ts               useHashRoute, usePlanEvents, useSystemTheme
  src/views/                 ProjectsPage, ProjectPage, PlanPage, GroupSection, QuestionCard,
                             DeferFields, SubmitDialog, ConnectionBanner — presentational, props only
  dist/                      build output (gitignored, AR-37)
scripts/build-discovery-ui.mjs   buildDiscoveryUi({ outdir }) + CLI (npm run build:discovery)
```

`package.json`: devDependencies `react`, `react-dom` (^19), `@fluentui/react-components` (^9.74),
`@fluentui/react-icons` (^2), `@griffel/react` (the renderer the nonce is passed to; it is only a
transitive Fluent dependency otherwise), `esbuild`, `@types/react`, `@types/react-dom` (AR-36);
scripts `build:discovery`, `prepack` (`npm run build:discovery`), `typecheck`
(`tsc --noEmit && tsc -p discovery-ui --noEmit`); `files` adds `discovery-ui/dist/`; `.gitignore`
adds `discovery-ui/dist/` (AR-37).

## Implementation Details

### Routes (AR-3, AD-58)

| Hash | View | Pattern |
| --- | --- | --- |
| `#/` (or empty) | ProjectsPage | PAT-002 |
| `#/p/<project>` | ProjectPage | PAT-002 |
| `#/p/<project>/<plan>` | PlanPage | PAT-004 |

`parseRoute` decodes segments with `decodeURIComponent`, rejects segments that do not match the
slug pattern, and maps anything unknown to `{ view: "not-found" }`. The header shows a breadcrumb
`Projects › <project> › <plan>`.

### Module contracts

The pure modules expose these signatures; the views only consume their output:

```ts
type Route =
  | { view: "projects" }
  | { view: "project"; project: string }
  | { view: "plan"; project: string; plan: string }
  | { view: "not-found" }

parseRoute(hash: string): Route
formatRoute(route: Route): string

planView(record: PlanRecord): PlanView        // order, labels, counts, readiness
projectsView(repositories: Repository[]): ProjectsView

createApi(baseUrl: string, fetchImpl?: typeof fetch): DiscoveryApi
createAppRenderer(nonce: string, targetDocument?: Document): Renderer
```

`planView` derives everything from the stored record (questions with `state`, groups with
`submittedAt`) so the page and the tests see one representation. `createApi` returns
`{ ok: true, data }` or `{ ok: false, kind, message }`, where `kind` is the server's error code or
`network`.

### Views

- **ProjectsPage**: one section per repository (name), each listing its checkouts as rows with
  project name, branch, open/answered/submitted counts, and a "Not open in OpenCode" badge when
  `live` is false (answers still save and wait, AR-41).
- **ProjectPage**: the project's plans in a table (title, kind badge, counts, updated time,
  orphaned/archived badges); a switch shows archived plans.
- **PlanPage** (PAT-004): header with plan title, `project · branch`, kind badge, counts, and an
  action group with Archive/Unarchive and Delete… buttons (Dialog confirmation, AR-28); message bars for an
  orphaned plan (AR-40 text), an unarchived plan (AR-53), and connection state; group sections in
  `dependsOn` order; a command bar with **Submit all ready groups**.
- **GroupSection**: title, description, readiness summary ("3 of 5 ready"); locked groups render
  read-only with "Unlocks after <group> is submitted" (AR-43); a **Submit group** button enabled
  only when ready, with a tooltip listing what is missing.
- **QuestionCard**: title, `why`, evidence items as monospace text blocks; the input for its type
  (`RadioGroup`, `Checkbox` group, `Textarea`, `RadioGroup` + `Input` for "Other"); a
  "Recommended" badge on the recommended option, never pre-selected (AR-25); an implied answer
  shown selected with an "Implied by DQ-1 — <reason>" label and selectable alternatives (AR-6);
  a conflict warning listing the sources (AR-26); a "Question changed — re-confirm" warning with
  a Re-confirm button (AR-24); a proposal message with Confirm / Reopen (AR-6); a notes field;
  DeferFields (a switch revealing decision, owner, revisit — all required, AR-25); a "Needs
  discussion" switch; a status badge (Open, Answered, Deferred, Needs discussion, Submitted,
  Recorded as AR-7, Retired);
  submitted, recorded, and retired questions read-only (AR-52); retired questions collapsed under
  "Retired questions".
- **SubmitDialog**: names `project · branch · plan`, lists the groups to submit and the skipped
  groups with what is missing (AR-47), and confirms.
- **ConnectionBanner**: "Reconnecting…" while the event stream is down; "Discovery restarted —
  reload" when `instanceId` changed (AR-30).

All text from questions and answers is rendered as React text (escaped); evidence keeps line
breaks; no HTML or Markdown is interpreted (AR-29).

### Data flow (AR-24, AR-49, AD-58)

- PlanPage loads `GET …/plans/:plan` when `App` was rendered without `initial` data; with
  `initial`, it renders the same `planView` synchronously on the first pass (ST-51). The browser
  shell owns `useHashRoute`; `App` takes the route as a prop, so tests need no `window`.
- Choice changes save immediately; text saves 500 ms after the last keystroke and on blur
  (`PUT …/questions/:key` with `baseRevision`). `stale` reloads the plan and shows "This question
  changed — please re-check"; `read-only` and `locked` reload silently. Submit sends the same
  `baseRevision`, so a republish between rendering and submitting is rejected as `stale`.
- `usePlanEvents` opens `EventSource` on `…/events`; `changed` reloads; `delivered` refreshes the
  submission state.
- Save, submit, and error results are announced in an `aria-live="polite"` region (AR-32).

### CSP nonce and theme (AR-29, AR-32, AD-58)

`main.tsx` reads `<meta name="csp-nonce">` and calls `createAppRenderer(nonce, document)` from
`renderer.ts`, which returns `createDOMRenderer(targetDocument, { styleElementAttributes: { nonce } })`;
the app is wrapped in `RendererProvider` then `FluentProvider`. `targetDocument` defaults to
`globalThis.document`, and ST-52 passes a stub so the factory stays Node-testable. The theme is
`webDarkTheme` when `matchMedia("(prefers-color-scheme: dark)")` matches, else `webLightTheme`,
updating on change; the initial theme is light when `matchMedia` is absent, and the browser hook is
read from inside an effect. The bundle must contain exactly one copy of `@griffel/core` (07 ST-50).

### Build (AR-37, AR-44)

`buildDiscoveryUi({ outdir, metafile = true })` runs esbuild on `discovery-ui/src/main.tsx`
(bundle, ESM, minify, target `es2022`, `jsx: "automatic"`,
`define: { "process.env.NODE_ENV": "\"production\"" }`) into `<outdir>/assets/app.js`, copies
`index.html` into `<outdir>`, and returns `{ metafile }` for ST-50. Run directly, it builds into
`discovery-ui/dist/`.

### Manual checklist (AR-33)

Run once by the user in a current browser against a scratch project:

1. Projects → project → plan navigation and breadcrumb; back/forward buttons work.
2. Each question type saves; an implication pre-fills and can be overridden; a hidden question's
   answer returns when it becomes visible again.
3. A locked group unlocks after its prerequisite is submitted.
4. Submit group and Submit all ready groups show the confirmation with project · branch · plan.
5. Keyboard only: every control reachable, visible focus, dialogs return focus.
6. OS dark mode switches the theme.
7. Restarting OpenCode shows the restart notice and recovers on reload.
8. No console errors and no CSP violations in the browser's developer tools.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| --- | --- | --- |
| API error | Message bar with the server's message; no technical detail | AR #29 |
| Stale save | Reload the plan; warn on that question | AR #49 |
| Lost event stream | "Reconnecting…" banner; EventSource retries | AR #30 |
| Server restarted | "Discovery restarted — reload" | AR #30 |
| Unknown route | Not-found view with a link to Projects | AD-58 |

## Testing Requirements

- Spec: 07 ST-48…ST-55 (route, view models, render smoke, build, pack).
- Manual checklist above (07 ST-63).
