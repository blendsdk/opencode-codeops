# Testing strategy: discovery-ui-redesign

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **CodeOps Artifact Schema**: 1

## Approach

Specification tests precede their implementation and first run red. Use existing `node --test`,
TypeScript imports, controlled API promises, Node timer facilities, and esbuild-built
`react-dom/server` fixtures. Real browser acceptance covers DOM/focus behaviour the render smoke
cannot establish. No committed browser harness or new dependency is authorized (AR-9).

Coverage goals: pure decision/editing logic 90%, support code 80%, UI glue 60%, consistent with the
repository standard. These are goals, not claims of measured coverage. Mock only external APIs
and browser boundaries. Keep fixtures local to the relevant suite; do not build a test framework.

## 🚨 Specification Test Cases

Expectations below are the immutable oracle. Source references live here; code comments state
durable behaviour in plain language without planning IDs.

### Navigation and theme

| # | Input / scenario | Expected output / behaviour | Source |
| --- | --- | --- | --- |
| ST-1 | Existing empty, projects, project, and plan hashes | Existing parsed shapes and format round trips unchanged; legacy plan route has no target property | R9; 03-01 §Routes; AR-5 |
| ST-2 | `#/p/repo/plan/groups/Scope` and `#/p/repo/plan/summary`; a group key `summary` | Correct distinct group/summary targets and exact round trips; `/groups/summary` does not select summary | R2; 03-01 §Routes |
| ST-3 | Malformed escapes, encoded slashes/traversal, invalid slugs/keys, unknown/extra suffixes, or empty segments | Not found for malformed input; empty segments keep the existing normalization, so trailing and doubled slashes parse as they do today; no decoded untrusted value becomes a path or markup | R9; 03-01 §Routes |
| ST-4 | No explicit target; first group complete, second locked, third unlocked and pending | Third group selected; if no unlocked pending group exists, summary selected | R2; 03-01 §Workspace selection |
| ST-5 | Explicit group becomes complete or locked; separately, explicit group is removed by republish | Existing group stays selected; removed group resolves to summary with the stated notice | R2; 03-01 §Workspace selection |
| ST-6 | Initial target normalization, user navigation, Continue at the last group, and a current group that retains only a needs-discussion question | Normalization requests history replacement; user navigation requests a new entry; Continue never returns the current group, wraps to the next eligible group, and falls back to summary when no other group qualifies; no auto-advance on Submit | R2, R5; 03-01 §Workspace selection |
| ST-7 | Theme preference System/Light/Dark crossed with OS Light/Dark | System follows OS; explicit overrides win; invalid/missing preference resolves to System | R7; 03-01 §Theme preference |
| ST-8 | No browser APIs, malformed stored preference, or storage access throws | SSR-safe light rendering; invalid preference uses System; selected theme remains usable in memory on write failure | R7; 03-01 §Theme preference |
| ST-9 | User changes theme, reloads, and later chooses System; separate pure preference and control cases | Only allowed preference string persisted under the theme key; override restored on reload; System resumes OS tracking without changing draft/selection. The pure parser/storage/reload case runs in Phase 1; the three-choice control's render/focus case runs in Phase 3 | R7; 03-01 §Theme preference |

### Editing, navigation, and live state

| # | Input / scenario | Expected output / behaviour | Source |
| --- | --- | --- | --- |
| ST-10 | Rapid text edits, a separate notes edit, and edits to two different questions before debounce | Latest value per field retained; distinct fields/questions are not overwritten; text waits 500ms or blur, choice flushes immediately | R4; 03-02 §Editing and acknowledgement |
| ST-11 | Save A is held pending; user enters newer B; A acknowledges before B | B remains displayed/pending; A cannot clear B's dirty state; Saved occurs only after B acknowledges | R4; 03-02 §Editing and acknowledgement |
| ST-12 | Two `flush()` callers while writes and later edits are pending | Writes serialized; no duplicate captured patch; both callers settle only once the pending work drains or fails | R4; 03-02 §Editing and acknowledgement |
| ST-13 | Group change, summary link, or browser history request while text save is pending | Old editor remains mounted/displayed until successful save; one destination committed; failed save restores current hash and retains draft; the pure navigation gate rejects stale requests and `cancel()` restores the displayed route | R2, R4; 03-02 §Navigation boundary |
| ST-14 | Several navigation requests while saving; old callback resolves after plan change/disposal | Only latest eligible request commits; `dispose()` drops late work; late work cannot navigate or update another plan | R4; 03-02 §Navigation boundary |
| ST-15 | Network failure or invalid patch followed by correction/Retry | Draft remains visible, error associated, no false Saved; retry uses the retained edit context and successful correction clears the failure | R4; 03-02 §Errors and submission |
| ST-16 | An old GET resolves after a local acknowledgement; live events arrive while writes drain | Old snapshot cannot replace newer local data; refresh coalesced and a current snapshot fetched after draining; draft overlay retained | R4; 03-02 §Live refresh and concurrency |
| ST-17 | Republish/stale, locked, read-only, hidden, retired, or removed-group state affects a dirty question | Current server state fetched; attempted value stays visible in the question or **Unsent drafts**; no automatic replay against a new definition/read-only state; `discard` clears it and navigation can then proceed; a 404 refresh is the terminal plan-deleted state | R3–R4; 03-02 §Live refresh and concurrency |
| ST-18 | Submit while dirty, duplicate confirm while submitting, save fails, or readiness changes before send | Save completes before submit; no concurrent duplicate submit; failed flush sends no submit; current revision/readiness governs the request; the dialog's ready/skipped lists are recomputed from the accepted snapshot after `flush` | R4–R5; 03-02 §Errors and submission |
| ST-19 | Submit returns woken or pending; network result is uncertain | `SubmitOutcome` and the snapshot distinguish delivery states, carry skipped/missing reasons, and never claim recording; selected view retained; refresh before retry reconciles uncertain outcome | R5; 03-02 §Errors and submission |
| ST-20 | Incomplete deferral, closing disclosure, navigation, and close/reload with dirty/clean state | The per-question `incomplete` map records the reason; partial fields survive a live refresh and a collapse; `DeferFields` does not adopt an external value over a dirty draft; invalid fields are revealed and navigation is blocked until complete/cancelled or explicitly discarded; unload warning only for unfinished work; no browser answer persistence | R3–R4; 03-02 §Editing and acknowledgement / §Navigation boundary |

### Workspace and delivery

| # | Input / scenario | Expected output / behaviour | Source |
| --- | --- | --- | --- |
| ST-21 | SSR `App` with initial data for project list, plan list, legacy plan, explicit group, summary | Real metadata, one main landmark, breadcrumb links/text (`Projects › project › plan`), correct selected destination and only selected group editable; initial-data render performs no fetch/window access; existing fixture assertions retained | R1–R2, R9; 03-03 §Layout and components |
| ST-22 | Single/multiple/text/Other questions with recommendations, implications, conflicts, changes and proposals | Exact accessible names/roles for each control and action; the `Recommended` badge is present and never preselects; empty answers not preselected; unsafe labels/evidence escaped; existing states remain usable | R3; 03-03 §Questions and details |
| ST-23 | Notes only, active deferral/discussion, validation issue, and an issue appearing after collapse | Details are expanded exactly for an active deferral/discussion or validation issue, collapsed for notes-only with a visible “Notes added” indicator; warnings and provenance stay outside disclosure; controls remain mounted | R3; 03-03 §Questions and details |
| ST-24 | Group with submittedAt plus a new pending question; empty/hidden/retired questions; all-current-questions recorded; changed/conflict/submitted answered questions | New work prevents Complete; hidden/retired excluded from progress; `workspaceView` shows “No visible questions” while `GroupView.summary` stays `0 of 0 ready`; genuinely completed group labelled Complete; the `answeredQuestions` matrix excludes unresolved change/conflict/proposal and counts submitted/recorded answers | R6; 03-03 §Navigation and progress derivations |
| ST-25 | Summary with open, answered, Other, multiple selections, deferral/discussion, submitted, recorded, retired, and removed-group entries | Correct labels/text/status/provenance and owning-group links; a clear unanswered label; retired entries show their stored answers and are separately collapsed; **Unsent drafts** lists retained drafts; all-ready list not restricted to selected group | R5–R6; 03-03 §Summary and actions |
| ST-26 | Selected group missing answers, locked group, loaded-content error, archive/delete controls, or restart notice | **Submit group** is always rendered for the selected group and disabled with visible missing reasons; locked inspection is read-only; loaded content retained; archive/delete confirm and cancel still work; orphan/unarchive banners remain | R3–R5; 03-03 §Summary and actions / §Accessibility and states |
| ST-27 | Fresh build/package after Nav/styles/theme integration | Reuse the existing nonce, single-Griffel, bundle-size, and pack assertions; dist included and UI sources excluded; add a package-diff or exact devDependency check to enforce the no-new-dependency rule; no remote assets | R9; 03-01 §Compatibility and security; AR-9 |
| ST-28 | README and newest Unreleased/release changelog | README describes group navigation, summary/all-ready Submit, server-backed save feedback, and System/Light/Dark; changelog has a `discovery:` redesign entry under Unreleased, or in release history after release | R10; AR-9, AR-10 |

## Files and test boundaries

| Phase | Specification suite | Implementation suite |
| --- | --- | --- |
| 1 | `scripts/discovery-ui-redesign-navigation.spec.test.mjs` (ST-1–ST-6), `scripts/discovery-ui-redesign-theme.spec.test.mjs` (ST-7–ST-9) | `scripts/discovery-ui-redesign-navigation.impl.test.mjs`, `scripts/discovery-ui-redesign-theme.impl.test.mjs` |
| 2 | `scripts/discovery-ui-redesign-editing.spec.test.mjs` (ST-10–ST-20, editor + pure navigation gate) | `scripts/discovery-ui-redesign-editing.impl.test.mjs` |
| 3 | `scripts/discovery-ui-redesign-workspace.spec.test.mjs` (ST-21–ST-27, plus the integration halves of ST-9/13/20) | `scripts/discovery-ui-redesign-workspace.impl.test.mjs` |
| 4 | `scripts/discovery-ui-redesign-content.spec.test.mjs` | Content-only; no mirrored implementation suite |

ST-9, ST-13, and ST-20 each have a pure half and an integration half. The pure half runs in the
phase named above; the integration half (three-choice control/reload/focus, browser history, and
details disclosure) runs in Phase 3 with the workspace suite. Keep the same ST number with a
`-ui` suffix in the case name so traceability is exact.

Browser hooks may expose small pure preference/navigation functions for existing Node test
patterns. SSR proves rendering, not effects or keyboard interaction; do not claim it covers them.
The browser checklist below owns those observations. No existing spec assertion needs replacement
under the proposed routing and Submit group label; changing one requires an explicit contract
decision before implementation, not an adjustment to make tests pass. Keep `GroupView.summary`
unchanged (`0 of 0 ready`); the empty label lives in `workspaceView`. Keep the always-rendered
`Submit group` action and the `Recommended` badge, and pin both in ST-22/ST-26.

## Live browser acceptance

Use the packed tarball in an opted-in isolated scratch project with a real project/branch/plan,
and the built UI. Fixtures include four question types, dependencies, hidden/implied answers,
conflicts, proposals, changed/submitted/recorded/retired states, long labels, and enough groups to
exercise sidebar scrolling. Use the existing scratch/store/tool patterns; keep temporary artifacts
under the session temp root. The user runs these checks; record browser/build, steps and outcomes
under the execution tasks. Native developer tools may provide offline/throttled-network conditions.

| ID | Steps | Required evidence |
| --- | --- | --- |
| B1 | Follow a legacy plan link; switch groups; use back/forward; open a group link and a summary link | Correct destination, real identity and breadcrumb, drafts preserved across in-app group changes; project/plan listing navigation still works. Dirty page reload is covered in B3 |
| B2 | Type normally in Firefox and Chrome; use Other/notes, edit a saved deferral, hide/show a question, override an implication, review a proposal/change; collapse and reopen Additional details after typing | Full text saved, partial deferral survives the collapse/refresh, and all existing question controls work |
| B3 | Delay writes; type then immediately navigate/submit; go offline, retry, restore network; close/reload with dirty work; attempt the same destination after a failed save | No lost/truncated input, premature Saved, or submit before save; failed navigation retains the draft and the same navigation can be retried; the native unload warning appears when the browser allows it and no answer is persisted |
| B4 | Submit one group and all-ready from summary; cancel/confirm each; inspect dependent group and delivery feedback | Both confirmations correct, locks respected, Continue explicit, `woken` and `pending` described honestly, live agent pointer/answers/recording still works |
| B5 | Republish while viewing/editing, remove a selected group, and inspect summary/retired answers | Selection/error policy followed; the summary notice and **Unsent drafts** show the retained context; retired answers remain visible; drafts can be discarded; no hidden/retired answer submitted |
| B6 | Keyboard-only navigation, skip link, all form controls, disclosure, dialogs, narrow-screen nav drawer Escape/backdrop, and focus return | Visible focus, useful focus destination, announced errors/results; the drawer returns focus to its toggle; live updates do not steal focus |
| B7 | System/Light/Dark through the three-choice control, OS change, reload, 390px width, desktop and 200% zoom | Preference behaviour correct; controls readable/reachable; no horizontal overflow or footer-covered input |
| B8 | Inspect console/CSP, restart the isolated host, reload, use long text and empty groups; archive/unarchive/delete confirm and cancel on an isolated scratch plan | No console/CSP errors, restart recovery works, long/empty states usable; orphan/unarchive banners and destructive confirmations still work; mock content absent |

## Completion evidence

Run `npm run verify`, `npm run build:discovery`, and `npm pack --dry-run`; record exact results.
Each B item must be confirmed or remain an explicit finding. Independent review follows the phase
quality policy, with MAJOR/CRITICAL rulings required before continuing. Remove owned scratch
artifacts after evidence is durable.
