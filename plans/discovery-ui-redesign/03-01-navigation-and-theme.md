# Navigation and theme: discovery-ui-redesign

> **Document**: 03-01-navigation-and-theme.md
> **Parent**: [Index](00-index.md)
> **CodeOps Artifact Schema**: 1
> **Decisions**: AR-4, AR-5, AR-8, AR-9

## Overview

Group selection is a destination in the existing hash router. Theme preference is a browser-local
display setting. Neither belongs in the stored Discovery plan or its publish payload.

## Routes

Extend `discovery-ui/src/route.ts` using the existing parse/format convention:

| Hash | Meaning |
| --- | --- |
| `#/` | Existing project list |
| `#/p/<project>` | Existing project-plan list |
| `#/p/<project>/<plan>` | Existing plan link; resolve its initial workspace selection |
| `#/p/<project>/<plan>/groups/<key>` | Selected group |
| `#/p/<project>/<plan>/summary` | Decision summary |

Project/plan segments continue to use `SLUG_PATTERN`; group keys use the existing `KEY_PATTERN`.
Encode each segment separately. Decode once and reject malformed escapes, encoded separators,
invalid keys, unexpected suffixes, and extra segments. Keep the existing empty-segment
normalization: empty segments are removed before validation, so trailing and doubled slashes parse
exactly as they do today. An unknown group key that is syntactically valid is a
selection-reconciliation case; a malformed route remains the existing Not found view.

Keep the existing `Route` variants and add an optional `target` to the `view: "plan"` variant:
`{ kind: "group"; key: string } | { kind: "summary" }`. Legacy routes omit the property, preserving
their current parse results and round trips. `formatRoute` emits the corresponding suffix only
when `target` is present. Group keys such as `summary` remain legal under `/groups/summary`.

## Workspace selection

Add pure, plan-specific derivations in `discovery-ui/src/workspace-model.ts`, consuming `PlanView`:

- Export `WorkspaceTarget = { kind: "group"; key: string } | { kind: "summary" }` from
  `route.ts`, and use it for the optional plan-route target.
- `selectWorkspace(plan: PlanView, target?: WorkspaceTarget)` returns
  `{ target: WorkspaceTarget; replace: boolean; notice: string | null }`; `replace` is true
  only for initial resolution or a missing-group correction.
- `nextWorkspace(plan: PlanView, currentKey: string): WorkspaceTarget` provides Continue's
  destination using the ordering rules below, excluding `currentKey` and falling back to summary
  when no other group qualifies. It does not navigate as a side effect.
- No explicit target: first dependency-ordered, unlocked group with a visible question whose
  status is neither submitted nor recorded; otherwise summary.
- Explicit existing group: keep it even if it becomes locked, completed, or empty. This permits
  inspection and avoids focus jumps when the last answer is saved.
- Missing group after a valid link or republish: summary with “This group is no longer available.”
- Summary is always reachable, including a plan with no currently visible questions.
- Initial resolution and missing-group correction replace the current hash entry; intentional
  group/summary navigation adds an entry. Back/forward restores the selected destination.
- Live refresh does not recompute the initial selection once a concrete destination is selected.
- After successful group Submit, remain on that group. Continue selects the next unlocked group
  with pending visible questions in dependency order, wrapping to the first if needed but never
  returning the current group; if no other group qualifies, it goes to summary. A group that keeps
  only a needs-discussion question therefore cannot turn Continue into a no-op. There is no
  automatic advance.

The asynchronous permission to commit navigation is owned by 03-02. URL selection must not remount
the plan editor when only the group changes: the editor identity stays `<project>/<plan>`.

## Theme preference

`discovery-ui/src/theme.ts` owns the pure `ThemePreference = "system" | "light" | "dark"` parser
and `resolveTheme(preference, systemTheme)`, plus `readThemePreference(storage)` and
`writeThemePreference(storage, preference)` so ST-8/ST-9 can use a fake storage in Node.
Missing/invalid stored values resolve to `system`. `hooks.ts` owns reading browser APIs inside
effects and listening to OS theme changes. `main.tsx` passes the resolved theme to the existing
`FluentProvider` beneath `RendererProvider`.

Use localStorage key `codeops.discovery.theme` with one allowed preference string. Persist only
that value. System follows changes from `matchMedia`; explicit Light/Dark ignores OS changes.
If storage cannot be read, begin with System. If it cannot be written, retain the selected
preference in memory for the current tab. Missing `window`/`matchMedia` renders light safely during
SSR. No storage access occurs while a presentational component renders.

The header uses a labelled Fluent UI control exposing all three choices; it receives the current
preference and setter through the shell object described below. This replaces the preview's
two-state icon toggle so the user can return to System. Theme changes do not change the active
group, scroll position, or drafts.

## Shell coordination

`Root` owns the preference and the `FluentProvider`. It passes one optional shell object to `App`
with the current preference and setter, the narrow-screen navigation open state, and an identity
slot. `DiscoveryHeader` renders the three-choice control and the navigation trigger;
`PlanNavigation` consumes the open state. `ProjectRoute` and `PlanRoute` update the identity slot
through an optional callback, so the header shows real project/plan names instead of route slugs
once the data loads. Existing `App({ route, api, initial })` renders keep working; when the shell
object is absent (SSR and render tests), the header shows the System preference with a no-op setter
and reads no browser global. A small context is the alternative if the shell later grows beyond
theme, navigation, and identity.

## Compatibility and security

Old links emitted by the plugin remain accepted. New suffixes are browser-only; no server routes
or JSON formats change. Existing data is immediately usable; rollback to the old UI uses its base
plan URL and the same data files. The old UI need not understand new suffixes. The new theme key
is harmless to older clients and requires no cleanup migration.

Plain text labels remain React-escaped. Keep strict route allowlists and do not use hash content
as HTML, a file path, or an unvalidated redirect. Preserve nonce-based Griffel styles and the
existing bundle/import boundaries.

## Verification

07 ST-1–ST-9 cover routes, selection, theme, and invalid input. Phase 1 adds pure specification
tests using Node's existing TypeScript support, including fake storages for the preference seam and
the pure selection/Continue rules. The three-choice control's render, reload, and focus integration
case runs in Phase 3 with the header, so no phase claims green before the control exists. Browser
effects and history/focus are also checked through the later live checklist; no router dependency
or browser-test framework is introduced.
