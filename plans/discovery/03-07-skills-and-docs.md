# Skills and Docs: discovery

> **Document**: 03-07-skills-and-docs.md
> **Parent**: [Index](00-index.md)

## Overview

The agent-facing protocol for Discovery, its adoption by `make-plan` and `preflight`, the
`analyze-project` switch, and the user documentation. All files are Markdown read by agents or
users; content tests pin their contracts.

## Architecture

### Current Architecture
Question rounds happen in chat (`skills/make-plan/SKILL.md:160-220`,
`skills/preflight/report-format.md:109-155`). The gate protocol lives once in
`_shared/zero-ambiguity-gate.md`; skills link to `_shared/` (installed beside the skills,
`bin/install-skills.mjs:59`).

### Proposed Changes

| File | Change |
| --- | --- |
| `_shared/discovery.md` (new) | The protocol (below) |
| `_shared/zero-ambiguity-gate.md` | New section "Discovery (optional answer surface)" |
| `skills/make-plan/SKILL.md` | "Discovery option" section; Phase 1.1 and Phase 1C references |
| `skills/preflight/SKILL.md` | "Discovery option" section |
| `skills/preflight/report-format.md` | Step 5 Discovery path |
| `skills/analyze-project/SKILL.md` | `--with-discovery` / `--without-discovery` |
| `README.md` | "Discovery" section |
| `CHANGELOG.md` | `## Unreleased` entry |

## Implementation Details

### `_shared/discovery.md` (AR-11, AR-13, AR-20, AR-23, AR-27, AR-38, AR-39, AD-62)

Sections and required content:

1. **When it applies** — `discovery.enabled` is true in `codeops/codeops.json`, the
   `codeops_discovery_*` tools are available, and the run has no `--no-discovery` token. Otherwise
   ask in chat exactly as before.
2. **Round size** — a round with at most `discovery.chatMaxQuestions` questions (default 3) stays
   in chat; larger rounds are published.
3. **What never goes to the page** — Complexity Escalation Gate packets (visible STOP packet in
   chat); there is no "accept all" on the page.
4. **Publishing** — one Discovery plan per artifact (`kind` + `artifact`); groups in dependency
   order with `dependsOn` for foundational groups; per question: `why`, `evidence` (`file:line`),
   options with trade-offs, `recommendation` (shown, never pre-selected), `showIf` / `implies`
   where one answer settles another (same plan only, no chains — AR-50); stable keys (`DQ-<n>`,
   `PF-NNN`) never reused for a different decision.
5. **After publishing** — one chat line with the link (and the fallback-port notice when present),
   then end the turn; do not poll. (Fallback A: call `codeops_discovery_answers` with
   `wait: true`.)
6. **Ownership** — on `owned`, ask the user in chat whether to take over; publish with
   `takeover: true` only after a yes.
7. **Reading and recording** — on the wake message (or when the user says they answered), call
   `codeops_discovery_answers`; record each answer as exact text with its key and source; implied
   answers as "implied by <key>, shown and submitted"; note overridden implications; Defer as a
   named deferral (decision · owner · revisit); "needs discussion" stays open; then call
   `codeops_discovery_resolve` with the record ids. Answers the user gives in chat for published
   questions are recorded and resolved the same way.
8. **Follow-ups** — republish the same artifact with **every earlier question plus the new ones**.
   A publish is the plan's full question set: omitting a question retires it, and submitted
   questions are kept until they are recorded. Use `proposal` for settlements the agent infers
   (Confirm / Reopen on the page).
9. **Unavailable** — on `disabled` or `unavailable`, say so in one line and ask in chat; never
   skip or weaken a gate.

### `_shared/zero-ambiguity-gate.md` (AR-27)

A short section after "Gate enforcement rules": the register stays the authoritative record when
answers come from Discovery; transcription is exact text with the question key; implied answers
count as user decisions only when they were shown and submitted; complexity escalations stay in
chat; deferrals still need decision, owner, and revisit. Links `discovery.md`.

### `skills/make-plan/SKILL.md` (AR-13, AR-38)

- **Discovery option** section (beside the existing option sections): an exact standalone
  `--no-discovery` token before the first `--` sentinel is removed before resolving targets;
  more than one is invalid; when present, every round stays in chat for this run.
- Phase 1.1 and Phase 1C: when Discovery applies, publish the interview and the register review
  per `_shared/discovery.md` (groups by register category, Scope first); questions surfacing while
  writing documents go to chat when within the cutoff, otherwise to a new group.

### `skills/preflight/SKILL.md` and `report-format.md` (AR-13, AR-39, AD-62)

- `SKILL.md`: the same **Discovery option** section for `--no-discovery`.
- `report-format.md` Step 5: when Discovery applies, after the challenger has run, publish all
  findings as kind `preflight` grouped Critical, Major, Minor, Observation; each finding
  `PF-NNN` of type `single-other` (its options, plus "Other" for a custom decision or a dismissal
  with reasoning); Defer maps to `Accepted Risk` with decision, owner, revisit; answers are
  written back as `**User Decision:**` lines; the batch pacing rules apply only to chat
  presentation; the previous-decisions rule is unchanged.

### `skills/analyze-project/SKILL.md` (AR-13, AR-35, AD-62)

A step for the flags: refuse an invalid existing `codeops/codeops.json` with its validation
error; `--with-discovery` sets `discovery.enabled: true` keeping every other key (or creates the
AR-35 minimal file), previews, writes, and adds
`- Discovery: enabled — question rounds open in the local Discovery page` to the
`CODEOPS-PROJECT` managed block; `--without-discovery` sets `enabled: false` (keeping
`chatMaxQuestions`) and removes that line; both flags together are a usage error. The
`CODEOPS-SPECIALISTS` block stays byte-for-byte.

### `README.md` (R16)

A "Discovery" section after "Live task progress in the sidebar": what it is; enabling with
`analyze-project --with-discovery` (or the config keys); the URL and `CODEOPS_DISCOVERY_PORT`;
the data location (`CODEOPS_DATA_DIR`); local-only, no login, and the single-user-machine
assumption (any local user can read the page); the browser's six-connections-per-host limit when
many plan tabs stay open; that the agent continues only while OpenCode runs in that project;
`--no-discovery`; building from a checkout (`npm run build:discovery`, no restart needed);
remote/SSH not supported.

### `CHANGELOG.md`

An `## Unreleased` entry under Features: "discovery: answer CodeOps question rounds in a local
Fluent UI page (opt-in)". The release tool replaces the section with the generated entry
(`scripts/release.mjs:298-313`); the content test accepts either heading. Because
`scripts/exec-plan-progress-content.spec.test.mjs` pins the contents of an `## Unreleased` section
to the progress feature, Phase 8 also relaxes that test and pins the Discovery entry document-wide
(see 07 ST-61).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| --- | --- | --- |
| Tools missing while enabled | Chat fallback, one-line notice | AR #13 |
| Invalid `codeops/codeops.json` in `analyze-project` | Stop with the validation error; never overwrite | AR #35, AD-62 |
| Both flags given | Usage error | AD-62 |

## Testing Requirements

- Content spec tests: 07 ST-56…ST-61.
- The live end-to-end run (07 ST-62) exercises `make-plan` through Discovery.
