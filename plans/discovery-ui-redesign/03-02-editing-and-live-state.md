# Editing and live state: discovery-ui-redesign

> **Document**: 03-02-editing-and-live-state.md
> **Parent**: [Index](00-index.md)
> **CodeOps Artifact Schema**: 1
> **Decisions**: AR-3, AR-6, AR-9

## Overview

The server remains the saved-answer authority. A mounted plan keeps its unsaved drafts and tracks
its own asynchronous work. The required correction is local to the existing plan route: one
pending patch and a fire-and-forget flush cannot protect editors that navigation hides.

Extract this bounded lifecycle into `discovery-ui/src/plan-editor.ts` so Node tests can drive it
without a DOM. It is a helper for one plan, not a shared service or generalized cache. Plan
lifecycle state and subscriptions stay in `app.tsx`; presentational components keep their local
draft and disclosure state. HTTP remains in `api.ts`; browser events stay in `hooks.ts`.

## State and interface

The helper receives the current project/plan identifiers, the existing `DiscoveryApi`, an initial
server snapshot when supplied, and a change callback. It owns:

- the last accepted server plan;
- pending patches keyed by question, with a local edit sequence and the revision at editing time;
- an in-flight write, debounce timer, and blocked/error state;
- whether submission is in flight and whether unsaved work remains.

Expose a small interface: `snapshot()`, `edit(key, patch)`, `setIncomplete(key, value, reason?)`,
`discard(key)`, `discardAll()`, `flush(): Promise<boolean>`, `refresh(): Promise<void>`,
`retry(): Promise<boolean>`, `submit(group): Promise<SubmitOutcome>`, and `dispose()`. The snapshot
carries the server record, draft overlays, per-question incomplete work, per-question errors, save
status (`saved`, `dirty`, `saving`, `error`, `recheck`), submission state, delivery/missing outcome,
and plan-level error. Use typed patch fields matching the existing API; never widen the server
contract.

Public contract for specification authors (types imported from existing public UI/rule modules):

```ts
type SaveStatus = "saved" | "dirty" | "saving" | "error" | "recheck"
type PlanPatch = {
  answer?: Answer | null
  notes?: string
  defer?: Defer | null
  needsDiscussion?: boolean
  reconfirm?: true
  confirmProposal?: true
  dismissProposal?: true
}
type IncompleteWork = { reason: string }
type SubmitOutcome = {
  ok: boolean
  delivery: "woken" | "pending" | null
  message: string | null
  missing: Array<{ group: string; missing: unknown[] }>
}
interface EditorSnapshot {
  server: PlanResponse | null
  drafts: Record<string, PlanPatch>
  incomplete: Record<string, IncompleteWork>
  errors: Record<string, string>
  status: SaveStatus
  submitting: boolean
  unsaved: boolean
  delivery: "woken" | "pending" | null
  lastError: string | null
  missing: Array<{ group: string; missing: unknown[] }>
  recheckRequired: boolean
}
interface PlanEditor {
  snapshot(): EditorSnapshot
  edit(key: string, patch: PlanPatch): void
  setIncomplete(key: string, value: boolean, reason?: string): void
  discard(key: string): void
  discardAll(): void
  flush(): Promise<boolean>
  refresh(): Promise<void>
  retry(): Promise<boolean>
  submit(group: string | null): Promise<SubmitOutcome>
  dispose(): void
}
function createPlanEditor(options: {
  project: string
  plan: string
  api: DiscoveryApi
  initial?: PlanResponse
  onChange?: (snapshot: EditorSnapshot) => void
}): PlanEditor
```

Snapshots are read-only to consumers. Initial construction makes no request; the route calls
`refresh()` when initial data is absent. Save responses contain the updated plan but no project;
merge the known project and declare `SavePlanResponse = { plan: PlanRecordLike }` in `api.ts` rather
than claiming a `project` the server does not send. `setIncomplete` marks unsendable local control work
without pretending it is a valid API patch; it records a reason so the React layer can reveal the
right fields. `discard` and `discardAll` clear drafts, incomplete markers, and related errors for
one question or the whole plan; they never write to the server, and they restore the last accepted
server value in the display. Discarding advances the local operation sequence so an in-flight
acknowledgement cannot reapply the discarded value. Every state transition notifies the callback;
user-facing announcements
are composed by the React integration from those states/results. `lastError` holds plan-level load,
refresh, or submit failures; `errors` remains per question. `delivery`, `missing`, and
`recheckRequired` retain the outcome of the latest submission or stale response.

`dispose` cancels scheduled timers, clears pending requests, and detaches callbacks; normal
navigation must call the save boundary before disposal. It must not report unfinished edits as
saved. Initial-data rendering does not fetch synchronously or require a browser global.

## Editing and acknowledgement

1. An edit updates the displayed draft immediately. Choice changes schedule an immediate save;
   text, Other, notes, and complete deferrals keep the existing 500ms debounce and blur flush. The
   display reads the draft overlay, never only the last server echo, so a pending choice is visible
   before its acknowledgement and two rapid multiple-choice clicks cannot drop the first one.
2. Pending edits are retained per question. Merge different patch fields for the same question;
   the latest value wins only for the same field. An answer and a note must not replace each other.
3. Send writes sequentially for this plan. A request captures its patch, local sequence, and
   `baseRevision`; an acknowledgement clears only the captured edits it actually saved.
4. If the user types while a save is in flight, keep the newer draft visible and pending. Older
   acknowledgements must not replace it or clear its dirty indicator. Normalization in the server
   response applies after the corresponding edit is acknowledged, not over a newer edit.
5. `flush()` cancels debounce and waits until the current write and all pending valid patches are
   acknowledged, including edits made while waiting. It returns false if any save is blocked or
   fails. Repeated flush calls share ongoing work rather than sending duplicate patches.
6. “Saved” requires an empty pending set, no unresolved local input, and no in-flight write.
   Show “Unsaved changes”, “Saving…”, or the failure message otherwise. Announce outcomes politely.

Partially completed deferrals remain local in their existing control until valid; they are reported
to the plan route through `setIncomplete(key, true, reason)` and appear in the snapshot's
`incomplete` map. Navigation/submission with such a draft reveals the required fields and stays on
the current group. The existing deferral switch can cancel that unfinished deferral. A refresh must
not adopt an external `defer` over a dirty partial draft: `DeferFields` keeps its local values and
keeps reporting incomplete until the user completes or cancels. Collapsing Additional details never
destroys its draft; use a disclosure that keeps its children mounted (or `unmountOnExit={false}`).

## Navigation boundary

`App` distinguishes the requested route from the displayed route. A mounted PlanRoute registers
its save boundary with that parent. Nav links, breadcrumbs, Continue, summary links, and browser
hash history all pass through the same boundary before the displayed route or plan identity
changes. The rest of the app keeps its public `{ route, api, initial }` render contract; optional
shell coordination props are additive (03-01).

`discovery-ui/src/navigation.ts` owns a pure navigation gate: `request(target, { replace })`,
`settle()`, `cancel()`, and `dispose()`, with an injected `flush` and `write(hash, { replace })`.
The gate stores only the latest request; `settle()` flushes and commits that request, `cancel()`
restores the displayed route, and `dispose()` drops late work. `useHashRoute` exposes
`navigate(hash, { replace })` and listens to both `popstate` and `hashchange`, deduping the two.
`App` owns one gate for the mounted shell.

- If clean, navigate immediately.
- If dirty/saving, keep the editor mounted and finish `flush()`; only then commit the destination.
- On failure, keep the current group and draft, restore the current hash with replacement rather
  than adding a second history entry, show Retry, and require the user to navigate again.
- If several destinations are requested while saving, only the latest request may commit.
- The blocked-navigation notice offers the applicable recovery: **Retry** for a retryable failure,
  or **Discard unsaved change** / **Leave without saving** for a terminal draft. Leaving requires an
  explicit confirmation, calls `discardAll()`, and then commits the destination; a late promise
  must not move a different plan's page.
- A read-only, locked, retired, hidden, or removed question keeps its draft visible for review and
  exposes **Discard unsaved change** for that question. Discarding is the only way to clear a draft
  that can no longer be saved; it never writes to the server.
- A refresh that returns `not-found` after a successful load is terminal: show **Plan deleted**,
  **Back to plans**, and **Discard draft** instead of pretending the plan still exists.
- Delete is destructive: if work is unsaved, its confirmation includes an explicit discard warning;
  on success dispose the editor and navigate outside the save boundary. Archive follows the same
  guard as an ordinary navigation.
- A browser `beforeunload` guard is active only for dirty/in-flight/blocked work. Browser tab close
  or reload cannot be awaited reliably: warn, but do not claim the write completed or persist
  answers in localStorage. The browser controls whether its native warning is shown.

## Live refresh and concurrency

Keep one events subscription for the mounted plan, not one per group. Refreshes update clean
questions and metadata; local draft overlays stay visible. Coalesce refresh requests while local
writes drain, then read the latest server snapshot. Ignore stale results started before a newer
accepted local operation; schedule a fresh read rather than trusting response arrival order.

Publish revision alone is insufficient to order answer saves. Use local operation sequences to
prevent old reads/writes from replacing newer acknowledged state. This protects one editor;
existing server behaviour for separate clients writing the same question is unchanged.

If a refreshed question is revised, locked, submitted, recorded, retired, or hidden while it has a
draft, keep the attempted text visible as unsaved context and require review. Never automatically
apply it to a new question definition or send it through a read-only state. Re-confirmation reuses
the existing control and server validation; retry follows only after that explicit user action.
Discarding is always available for a retained draft that can no longer be saved.

Hidden questions stay in the editor's draft map and appear in the summary's **Unsent drafts**
section; a retired question keeps its stored answer visible in the retired section; a question
whose group was removed by republish is listed there with a **group removed** label, so the
summary notice and the retained context have a real surface. A group removed by republish also
uses 03-01's summary notice.

## Errors and submission

| Result | Behaviour |
| --- | --- |
| Network/HTTP save failure | Retain pending values and editing revision; show error and Retry. Navigation and Submit remain blocked until resolved or the draft is explicitly discarded. |
| Invalid input | Associate error with the question; reveal Additional details when relevant; user corrects it before retry. |
| Stale / read-only / locked | Fetch current server state; retain attempted values as unsaved context; set `recheckRequired` and label the footer **Recheck needed**. Retry stays disabled until the user reviews/reconfirms the question or discards the draft. Do not silently rebase and overwrite. |
| Terminal draft (read-only, locked, retired, hidden, or removed) | Keep the draft visible in the question or **Unsent drafts**; Retry is unavailable; **Discard unsaved change** clears it. Navigation stays blocked until the user discards or the question becomes editable again. |
| Plan deleted (refresh returns `not-found` after a successful load) | Show the terminal **Plan deleted** state with **Back to plans** and **Discard draft**; clear the pending navigation gate. |
| Initial load failure | Keep shared header; error with Retry rather than an endless loading state. |
| Refresh failure after a successful load | Keep the current page/drafts and show the error/connection state. |
| Submit failure | Keep selected group and answers; retain `lastError` and `missing` from the response. Refresh server state before retry when the outcome is uncertain; do not promise duplicate network delivery. |

Submit waits for `flush`, rechecks readiness against the accepted snapshot, then sends the current
revision using the unchanged API. Disable repeat confirmation while it is in flight. A successful
response refreshes the snapshot and distinguishes `delivery: woken` from `pending` in the feedback;
neither implies the agent has already recorded a decision. Group submission remains on the group;
all-ready submission remains on summary. Recompute the confirmation's ready/skipped lists from the
accepted snapshot after `flush`; if readiness changed, show the current missing reasons before
sending. Store the outcome in `SubmitOutcome` and the snapshot's `delivery`/`missing` fields.

Every `SaveStatus` has one label: `saved` → Saved, `dirty` → Unsaved changes, `saving` → Saving…,
`error` → the failure message, and `recheck` → Recheck needed. `unsaved` includes drafts, incomplete
work, and `recheckRequired`. Archive follows the navigation guard; Delete follows the destructive
path in the navigation boundary above.

## Verification

07 ST-10–ST-20 use controlled API promises and Node timer facilities to exercise observable
interleavings. ST-13/ST-14 drive the pure navigation gate with an injected history writer; the
discard/terminal and incomplete-deferral cases stay in the editor. Pure API fakes are
external-boundary substitutes, not replicas of the editor. The disclosure and summary-link
integration halves run in Phase 3. Real browser acceptance checks the integration, especially typing
while requests are delayed.
