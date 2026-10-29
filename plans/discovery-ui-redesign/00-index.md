# Discovery UI redesign implementation plan

> **Feature**: A group-focused Fluent UI Discovery workspace
> **Status**: Planning Complete
> **Created**: 2026-10-29
> **Implements**: REQ-DISCOVERY-UI-REDESIGN
> **CodeOps Artifact Schema**: 1

## Overview

The user found the current vertical question list difficult to use and asked for a more
professional Discovery website using Fluent UI Nav. An interactive preview established the
approved direction: persistent group navigation, a focused form area, clear progress, and a
consistent submission location. This plan integrates that direction with real Discovery data.

The target is the plan workspace plus the shared header. The Projects and project-plan listing
screens retain their current functions. Existing question semantics and the agent hand-off remain
the governing behavioural contract; the demo's sample answers and browser-only storage do not
become production behaviour. See AR-1–AR-4 and the owning requirements document.

## Minimum-Sufficient Baseline

**Original goal:** make answering Discovery questions easier to navigate and visually coherent,
using the approved Fluent UI Nav layout instead of showing every group in one long form.

**Smallest viable design:** extend the existing hash router and pure view models, compose existing
question components into a Nav-based workspace and summary, and replace the plan route's single
pending-patch slot with plan-local save handling plus an explicit discard/terminal state for drafts
that can no longer be saved. Reuse the current API, shared rules, nonce-aware renderer, dependencies,
and build. The save helper is bounded to one mounted plan; it is not a general state-management or
synchronization framework (AR-5–AR-9).

**Excluded machinery:** new router/state libraries, persistence services, browser-test frameworks,
and generated agents. Existing data files need no migration (AR-3, AR-9).

**Approved complexity:** none beyond the existing Discovery stack; direct navigation and edit
coordination are required feature code under AR-6.

## Document index

| Document | Owns |
| --- | --- |
| [00-ambiguity-register.md](00-ambiguity-register.md) | User decisions and scope authority |
| [01-requirements.md](01-requirements.md) | Product requirements and acceptance |
| [02-current-state.md](02-current-state.md) | Observed implementation and affected boundaries |
| [03-01-navigation-and-theme.md](03-01-navigation-and-theme.md) | URL selection, theme, and compatibility |
| [03-02-editing-and-live-state.md](03-02-editing-and-live-state.md) | Drafts, saving, navigation guards, and live refreshes |
| [03-03-workspace.md](03-03-workspace.md) | Layout, question controls, summary, and feedback |
| [07-testing-strategy.md](07-testing-strategy.md) | Specification tests and browser acceptance |
| [99-execution-plan.md](99-execution-plan.md) | Ordered implementation tasks and progress |

## Execution overview

Four phases: navigation/theme models → edit lifecycle → workspace composition → docs and live
acceptance. Every phase begins with specification tests and a recorded red run. Pure preference,
selection, editor, and navigation-gate cases run in Phases 1–2; the control, disclosure, and
summary-link integration cases run in Phase 3. Production work starts through `exec-plan`; this
planning run writes documents only.

Verification: `npm run verify`; final UI build and package checks use `npm run build:discovery`
and `npm pack --dry-run` (AR-9). Required browser evidence is defined in the testing strategy.

## Domain lenses

| Lens | Application |
| --- | --- |
| Web application | Form states, responsive navigation, focus, escaped text, and CSP |
| Distributed/concurrent | Debounce, pending writes, live events, republish, and navigation races |
| Data/migration | Existing data and plan-link compatibility; browser-local theme preference |

## Specialist Agents

**None created or required for the planned modification set.** The existing
`agent-pipeline-reviewer` applies to installer/agent/managed-guidance changes; none are planned.
The user previously retained `discovery-ui-reviewer` as a proposal only. Respect that decision.

The recurring UI findings at `plans/discovery/05-findings.md:47-64,77-81` remain review evidence.
Use independent generic correctness review with the Fluent UI skills and those failure cases in
the packet; include concurrency review for Phase 2. Do not repeat the specialist creation proposal
without new evidence. This preserves review independence without creating standing machinery.

## Related files

Primary changes: `discovery-ui/src/{route,hooks,app,main,view-models,workspace-model,plan-editor,navigation,theme}.ts*`,
its `views/`, and new `scripts/discovery-ui-redesign-*.test.mjs` suites. `view-models.ts` keeps the
shared server-derived model and gains the display fields the workspace needs; `workspace-model.ts`
owns selection, progress, and the draft overlay; `plan-editor.ts` owns one plan's save lifecycle;
`navigation.ts` owns the guarded history intent. README and CHANGELOG document the result. The
execution plan names each exact target.

The approved temporary preview is an authoring reference only. The specifications below capture
the durable design; execution must not depend on a temporary server surviving a machine restart.
