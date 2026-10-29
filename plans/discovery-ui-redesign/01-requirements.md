# Requirements: discovery-ui-redesign

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **CodeOps Artifact Schema**: 1

## Feature overview

Make Discovery's plan workspace easier to scan, navigate, and complete. The user approved a
Fluent UI Nav preview and then explicitly selected a plan-workspace-first scope with the existing
Discovery behaviour and a remembered System/Light/Dark preference.

## Functional requirements

| ID | Must have | Authority |
| --- | --- | --- |
| R1 | Shared product header, project/plan identity, real breadcrumb, and persistent group navigation with selected/progress/locked states | AR-1, AR-2 |
| R2 | One selected group in the main area, using existing dependency order; stable group and summary links with browser back/forward | AR-1, AR-5 |
| R3 | All existing question types and decision semantics, with clearer choice cards and progressive disclosure of supplementary controls | AR-3, AR-8 |
| R4 | Accurate saved/dirty/saving/error feedback; edits survive view changes and live updates, navigation/submission waits for successful saving, and a draft that can no longer be saved can be explicitly discarded or left after review | AR-6 |
| R5 | Group confirmation, explicit Continue after submission, and a decision summary offering Submit all ready groups | AR-3, AR-7 |
| R6 | Progress and summaries derived from existing visibility, readiness, and lifecycle rules, with readiness and completion labelled distinctly; recommendations are displayed without being selected automatically | AR-3, AR-7 |
| R7 | System/Light/Dark control defaulting to System, with a remembered browser preference and safe fallback if storage is unavailable | AR-4, AR-8 |
| R8 | Responsive navigation and question controls, keyboard operation, visible focus, overlay focus return, and announced results | AR-1, AR-8 |
| R9 | Compatibility with existing project/plan URLs, stored answers, API payloads, live events, and packaged offline assets | AR-3, AR-5, AR-9 |
| R10 | README/CHANGELOG coverage and meaningful automated plus user-browser evidence | AR-9, AR-10 |

No optional requirements are included.

## Scope boundaries

The work covers the plan workspace and common header. Current project/plan listings remain
functional within that header. UI state handling required to protect edits during navigation is
included. Preserve Archive/Unarchive, Delete confirmation, retired-answer inspection, connection
messages, and orphan/unarchive messages as required by the existing Discovery contract (AR-3).

This plan does not authorize redesigning the listing screens, changing agent workflow or server
protocols, adding browser-only answer persistence, creating a specialist, or releasing a package
(AR-2, AR-3, AR-9, AR-10).

## Technical requirements

- **Compatibility:** use React 19, installed Fluent UI v9, Griffel design tokens, esbuild and the
  existing nonce-aware renderer. The new UI reads the same stored-plan schema and uses the same
  API operations. Legacy links remain valid; no data migration is needed (AR-3, AR-9).
- **State:** only the theme preference is stored in browser local storage. Saved answer state
  comes from the API; unfinished drafts remain in the mounted plan editor until saved, explicitly
  discarded, or the user leaves after an unsaved-work warning (AR-4, AR-6).
- **Security:** retain loopback-only, no-login/single-user-machine semantics, Host/Origin checks,
  JSON writes, CSP nonces, and escaped text. Do not parse question content as HTML. New hash
  destinations and theme values use allowlists. No auth/public endpoint or infrastructure change
  is introduced; new rate-limit, TLS, container, and credential work is not applicable (AR-3, AR-9).
- **Scale:** support the existing 50-group / 200-question / 20-option caps; render only the selected
  group as an editable form. Long labels, descriptions, and evidence wrap without hiding controls.
  Retain the current bundle-size and single-Griffel-instance checks (AR-3, AR-9).
- **Verification:** `npm run verify`, `npm run build:discovery`, and `npm pack --dry-run`, plus the
  browser scenarios in 07. Maintain the existing automated tests; new requirements get new
  specification tests before implementation (AR-9, AR-10).

## Acceptance criteria

1. A user can locate a group through Nav, answer it, review the confirmation, submit it, and choose
   Continue; navigation does not require scrolling past other groups (R1–R5).
2. Drafts are not silently dropped when selecting another group, using browser history, submitting,
   or receiving a newer plan snapshot. Failed saves remain visibly unresolved. A draft that becomes
   read-only, locked, retired, hidden, or part of a removed group stays visible for review and can
   be explicitly discarded; the user is never trapped on the group (R4).
3. The summary accurately distinguishes open, answered, deferred, needs-discussion, submitted,
   recorded, and retired states; it never labels an unsent answer as delivered (R5–R6).
4. All existing question behaviours are usable in the new layout, including Other, deferral
   editing, implication override, visibility changes, proposals, and re-confirmation (R3).
5. Theme selection survives reload; System follows OS changes; keyboard and narrow-screen use
   complete the same workflow (R7–R8).
6. Existing data and links work, automated verification and packaging pass, and the user confirms
   the real-browser checklist against the packed application (R9–R10).
