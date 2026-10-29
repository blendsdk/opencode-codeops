# Workspace composition: discovery-ui-redesign

> **Document**: 03-03-workspace.md
> **Parent**: [Index](00-index.md)
> **CodeOps Artifact Schema**: 1
> **Decisions**: AR-1–AR-4, AR-7–AR-9

## Layout and components

Use the approved preview's visual hierarchy, translated to real metadata and all existing question
states. Executors read the installed `fluentui` and `fluentui-design` references and verify public
exports. Use tokens/Griffel for surfaces, typography, spacing, focus, and theme states.

| Region | Implementation owner | Content |
| --- | --- | --- |
| Shared top header | `views/DiscoveryHeader.tsx`, mounted by `App` | Discovery identity, real breadcrumb (**Projects › project › plan**) on every route, labelled theme preference, narrow-screen group-navigation trigger when on a plan |
| Plan navigation | `views/PlanNavigation.tsx` | Project and branch, dependency-ordered Nav group links built from the project slug, count/status cues, Decision summary link, group progress |
| Main plan heading | `views/PlanPage.tsx` | Plan title/kind, selected group title/description, current state; no second breadcrumb |
| Selected group | Existing `GroupSection.tsx` / `QuestionCard.tsx` | One group's question form, including locked/read-only inspection |
| Context rail | `PlanPage` | Honest plan progress and next eligible group; derived content only |
| Sticky action footer | `PlanPage` | Save state, missing-answer details, group Submit / Continue; summary offers all-ready Submit |
| Decision summary | `views/DecisionSummary.tsx` | Grouped answers/statuses with links back; **Unsent drafts**; retired items with stored answers and group-removed labels in a separate collapsed section |

Keep one `main` landmark. The shell shows actual project/plan titles loaded by ProjectRoute and
PlanRoute, not only slugs from the requested route; the header receives them through the optional
shell object in 03-01. `PlanPage` also receives `projectSlug`; group and summary links are built with `formatRoute`
from `route.ts`, so a display name is never used as a URL segment. Missing branch metadata is
omitted; never fabricate it. Project and plan listings get the common header (including the
breadcrumb) and retain their existing controls and functions.

## Visual reference

- Header approximately 68px high; a roughly 256px navigation column on desktop.
- The shared header carries the breadcrumb; content starts with small group-position text, a strong group heading, and the description.
- Neutral page surface with clearly bounded question cards; selected options use Fluent brand tint.
- Two columns of options when space permits; wrap long labels and use one column on narrow cards.
- A secondary progress rail is visible at wide widths (approximately 1200px and above).
- Below approximately 850px, group navigation collapses behind a labelled toggle. Selecting a
  destination closes it and moves focus to the new heading. The current group stays identifiable.
- On narrow screens, the footer wraps without covering the last input; reserve scroll space for it.
- Notes and other supplemental controls are not rendered as permanently expanded blocks.

These measurements express the approved visual direction, not a pixel-perfect screenshot test.
Cosmetic refinements may use tokens; functional availability and the reading order must hold at
390px, typical desktop widths, and 200% zoom. The product UI has no demo badge/reset/sample data.

## Navigation and progress derivations

Extend `workspace-model.ts` with display-only models. Continue calling `planView` and the shared
rules; do not implement a second readiness evaluator.

Export `workspaceView(plan: PlanView)` returning `groups` plus `completedGroups`, `totalGroups`,
`answeredQuestions`, and `visibleQuestions` numbers. Each group row has `key`, `title`, `locked`,
`complete`, `empty`, `ready`, `pendingCount`, and `readyCount`. Derive pending/ready counts from
question lifecycle and the existing `missing` reasons, not by parsing the human-readable summary.
Also export a pure `applyDrafts(plan: PlanView, drafts, errors)` overlay so the rendered question
value is the draft while a save is pending. The overlay changes display fields only; visibility,
readiness, and counts still come from the accepted server snapshot.

- All groups are listed, including locked, completed, and currently empty groups. Nav item identity
  is namespaced by kind plus group key so a group called `summary` cannot collide with the summary.
- Locked: lock icon plus accessible Locked text and prerequisite explanation; the link can be
  selected for inspection. Inputs remain disabled according to current group/question rules.
- Pending: show the existing ready/pending count and distinct missing-reason labels.
- Ready and Complete are distinct labels, never synonyms. `ready` is the existing `groupReadiness`
  result used for the AR-7 row counts; `complete` is the lifecycle progress measure. Show both
  labels where both are relevant.
- Complete: at least one visible current question and every such question submitted/recorded;
  a later publish adding a pending question makes the group pending again. `submittedAt` alone
  never labels a newly extended group complete. Empty groups show **No visible questions** in the
  Nav/`workspaceView`; keep `GroupView.summary` at its existing `0 of 0 ready` value so the existing
  implementation test stays valid.
- Group progress counts complete groups out of groups with visible current questions. For a zero
  denominator show the empty label rather than an invalid progress value.
- The questions-answered display counts visible current questions with valid effective answers,
  no unresolved change/conflict/proposal; submitted/recorded answers count when they contain an
  effective answer. Deferrals and discussion-only entries retain their own counts/statuses. Use this
  one `answeredQuestions` derivation in the header, rail, and summary; `planCounts` remains the
  source for listing rows only.
- The next-group label follows the same selection helper as Continue. No hard-coded workflow
  names or sample totals are shipped.

## Questions and details

Keep `QuestionCard` as the owner of question content and the existing input types. Move styling
into a small `views/workspace-styles.ts` module where repeated tokens/layout are shared. Avoid a
second card implementation for summary or locked inspection.

Always show: title, rationale, status, recommendations, implication provenance (including when the
user overrides an implied answer), conflict/changed/proposal messages, and their existing actions.
Evidence remains escaped readable text with line breaks. Recommendations never populate an empty
answer. Preserve local text/Other/notes draft behaviour; acknowledgements and live updates follow
03-02 rather than reverting keystrokes. The card renders the `applyDrafts` overlay so a pending
choice or text edit is visible before its save echo.

Additional details contains notes, DeferFields, and Needs discussion. It starts expanded for an
active deferral or discussion flag or an associated validation issue, and reveals itself when one
appears. Notes alone can remain collapsed with a visible “Notes added” indication. A user may
collapse completed supplementary context; any newly introduced validation issue reopens it.
Keep the controls mounted while collapsed so partial drafts survive; use a disclosure that does not
unmount its children (for example, `Accordion` with `unmountOnExit={false}` or an equivalent
controlled panel). A refresh must not replace a dirty partial deferral. Invalid/incomplete
deferrals report unfinished work to the save boundary and expose their required fields.

Submitted/recorded/retired answers stay read-only, with Recorded as IDs visible. Retired questions
show their stored answer (text or choice) read-only; a question whose group was removed by
republish is listed under retired with a **group removed** label. Hidden questions are absent from
the form and summary but retain server state; showing them again restores their answers. A hidden
question that carries a draft appears in **Unsent drafts** so the draft is reviewable and can be
discarded. No hidden answer is submitted.

## Summary and actions

The summary groups current visible questions in dependency order, with title, answer labels or
text, status, and relevant implication/conflict/proposal/deferral/discussion information. Show a
clear unanswered label rather than blank content. Choice answers use option labels; Other uses
its entered text; multiple choice keeps the declared option order. Retired questions show their
stored answer. Preserve notes and provenance in expandable detail. A separate **Unsent drafts**
section lists drafts for questions that are hidden, retired, locked, read-only, or part of a
removed group, with **Retry** where it can succeed and **Discard unsaved change** always. Links
navigate to the owning group using 03-02's save boundary and the project slug.

The selected group's footer always renders **Submit group**, retaining the existing semantic label;
it is disabled with visible missing reasons when the group is not ready. It opens the shared
`SubmitDialog` with `project · branch · plan` and the group identity. The summary uses **Submit all
ready groups**, listing ready/skipped groups and reasons in that same confirmation. No active group
is an implicit filter on an all-ready submission. Recheck readiness after saving and before sending;
recompute the dialog's ready/skipped lists from the accepted snapshot and show current missing
reasons if it changed. Group submission's post-submit flow is owned by 03-01; all-ready submission
stays on the summary per 03-02.

Keep Archive/Unarchive and Delete as their current plan-level action group, with Delete confirmation.
If work is unsaved, the Delete confirmation includes an explicit discard warning; on success dispose
the editor and navigate outside the save boundary. Retain all connection, restart, orphan, and
unarchive feedback. Display missing-answer reasons visibly near the primary action, not only in a
tooltip on a disabled button.

## Accessibility and states

Nav uses real links, an accessible label, selected/current semantics, and textual status equivalents.
Provide a skip link; destination changes focus the main heading. Theme controls, notes/disclosure,
all answer controls, and actions are keyboard-operable. The narrow-screen navigation uses a modal
`NavDrawer`: Escape or the backdrop closes it and returns focus to the labelled toggle; selecting a
destination closes it and moves focus to the new heading. Dialogs restore focus to their trigger;
successful submission focuses useful feedback when the trigger becomes disabled. Live events do
not steal focus or collapse an editor. Status is announced politely and never conveyed by colour
alone. Use Fluent components' slots rather than overriding internal DOM.

Loading uses a named loading region within the common shell. Empty selection/summary, unknown
routes, offline/restarted state, validation, stale responses, and failed initial/refetch operations
have the behaviours in 03-01/03-02. Keep already loaded content visible during refresh.

## Verification

07 ST-21–ST-27 cover initial-data rendering, identity, selection, controls, summary, and
package/CSP; ST-28 covers documentation in Phase 4. The control, disclosure, and summary-link
integration halves of ST-9, ST-13, and ST-20 also run here, in Phase 3. Browser checklist B1–B8
verifies interactions and visual coherence.
Retain the existing immutable UI spec tests: the legacy fixture still selects Scope and contains
Submit group, and the empty-group implementation assertion keeps `0 of 0 ready`.
