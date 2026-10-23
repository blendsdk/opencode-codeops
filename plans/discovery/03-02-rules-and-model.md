# Rules and Model: discovery

> **Document**: 03-02-rules-and-model.md
> **Parent**: [Index](00-index.md)

## Overview

`bin/lib/discovery-rules.mjs` (+ `.d.mts`) owns the publish contract, answer validation, rule
evaluation, and submit readiness. The browser bundle and the server both import it, so "visible",
"implied", "locked", and "ready" mean the same thing on both sides. The module is pure and
browser-safe: no `node:` imports, no I/O, no clock, no randomness.

## Architecture

### Current Architecture
No discovery code exists.

### Proposed Changes
One new module; consumers are 03-03 (store), 03-04 (server), 03-05 (tools), and 03-06 (UI).

## Implementation Details

### Constants

| Name | Value | Source |
| --- | --- | --- |
| `DISCOVERY_SCHEMA_VERSION` | `1` | AR-28 |
| `QUESTION_TYPES` | `["single", "multiple", "text", "single-other"]` | AR-25 |
| `PLAN_KINDS` | `["plan", "requirements", "preflight"]` | AR-16 |
| `KEY_PATTERN` | `^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$` (question keys, group keys, option ids) | AR-15, AR-34 |
| `TITLE_MAX` | 200 characters | AR-29 |
| `TEXT_MAX` | 4000 characters (why, evidence item, option description, answer text, other text, notes, defer fields, reasons) | AR-29 |
| `LIMITS` | groups ≤ 50, questions ≤ 200, options per question 2–20, evidence items ≤ 20 | AR-29 (keeps a publish under the 256 KB body cap) |
| `SLUG_PATTERN` | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, at most 52 characters including collision and kind suffixes | AR-15, AR-22 |
| `FINGERPRINT_FIELDS` | `type`, `title`, `why`, `evidence`, each option's `id`, `label`, and `description`, and `recommendation` | AR-24 |

### Publish contract

`DiscoveryPublishSchema` (JSON Schema, `additionalProperties: false` at every level) is the input
schema of `codeops_discovery_publish` (03-05):

```text
artifact      string 1..300, repository-relative POSIX path; no leading "/", no "\", no ".." segment
kind          enum PLAN_KINDS
title         string 1..TITLE_MAX
takeover      boolean, optional (AR-23)
groups[]      1..50: { key, title, description?, dependsOn?: [groupKey] }
questions[]   1..200: {
  key, group, type (enum QUESTION_TYPES), title, why?, evidence?: [string],
  options?: [{ id, label, description?, implies?: [{ question, answer, reason }] }],
  recommendation?: string | string[],
  showIf?: [{ question, anyOf: [optionId] }],
  proposal?: { answer, reason }        // agent-proposed settlement, AR-6
}
```

`answer` in `implies` and `proposal` is a **compact answer**: an option id for `single` and
`single-other`, an array of option ids for `multiple`, a string for `text`.

### Answer shape

A stored answer is `{ choice?: string, choices?: string[], text?: string, other?: string }`
holding exactly one field: `single` → `choice`; `multiple` → `choices`; `text` → `text`;
`single-other` → `choice` or `other`. `toAnswer(question, compact)` converts a compact answer.

### Functions

```ts
/** Validate and normalize a publish payload; never throws. */
export function validatePublish(input: unknown):
  | { ok: true; plan: PublishedPlan }
  | { ok: false; errors: string[] }        // "questions[2].showIf[0].question: unknown question \"DQ-9\""

/** Validate one answer for its question type. */
export function validateAnswer(question: Question, answer: unknown): { ok: true } | { ok: false; error: string }

/** Validate a deferral: decision, owner, and revisit all non-empty after trimming. */
export function validateDefer(defer: unknown): { ok: true } | { ok: false; error: string }

/** Canonical content string over FINGERPRINT_FIELDS, used to detect a changed question on republish. */
export function questionFingerprint(question: Question): string

/** Evaluate visibility, implications, conflicts, and group locks for the current state. */
export function evaluatePlan(plan: PublishedPlan, state: PlanState): Evaluation

/** Whether a group can be submitted, and what is missing when it cannot. */
export function groupReadiness(plan: PublishedPlan, state: PlanState, evaluation: Evaluation, groupKey: string):
  { ready: boolean; locked: boolean; missing: { key: string; reason: "unanswered" | "changed" | "conflict" | "proposal" | "nothing-to-submit" }[] }

/** Counts used by list views: open, answered, submitted, recorded. */
export function planCounts(plan: PublishedPlan, state: PlanState, evaluation: Evaluation): PlanCounts
```

`PlanState` holds, per question key: `answer`, `notes`, `defer`, `needsDiscussion`,
`proposalDismissed`, the stored lifecycle `status` (`open | submitted | recorded | retired`),
`changed`, `revisedAt`, `recordedAs`, and the set of submitted group keys. "Answered" (AR-16) means
an `open` question with an effective answer. A valid deferral and "needs discussion" also satisfy
readiness (AR-42) but are separate states: `planCounts` reports `answered`, `deferred`, and
`discussion` in their own buckets, so a count never claims a question was submitted when it was not.
A submitted question counts in `submitted` regardless of how it was answered.

`evaluatePlan` returns one `Evaluation` per plan; the store, `groupReadiness`, and the view models
consume exactly this shape:

```ts
interface Evaluation {
  questions: Map<string, {
    visible: boolean
    effective: Answer | null
    source: "user" | "implied" | null
    impliedBy: string[]
    impliedReasons: string[]
    overridesImplied: boolean
    conflict: { from: string; answer: Answer }[]
  }>
  lockedGroups: Set<string>
}
```

### `validatePublish` rules

1. Structure, types, caps, and patterns per the schema; unknown keys rejected.
2. Group keys, question keys, and option ids within a question are unique.
3. Every `question.group` names a group; every `dependsOn` names another existing group; the
   `dependsOn` graph is acyclic.
4. `single`, `multiple`, `single-other` have 2–20 options; `text` has none.
5. `recommendation`: one existing option id (`single`, `single-other`), a non-empty array of
   existing ids (`multiple`), or a non-empty string (`text`).
6. `showIf`: the referenced question exists, is not the question itself, is a choice type, and
   every `anyOf` id exists on it; the `showIf` graph is acyclic.
7. `implies` and `proposal`: the referenced question exists in this payload (AR-26: same plan
   only), is not the question itself, and the compact answer is valid for its type; `reason` is
   non-empty.
8. Strings are trimmed; empty optional strings are dropped.

### `evaluatePlan` semantics

- **Visible**: every `showIf` condition holds against the question's referenced question's
  **explicit** answer — an implied answer never reveals or hides a question (AR-50). `anyOf` holds
  when any listed option id is selected. A question with no `showIf` is visible, and retired
  questions are not visible.
- **Implied**: for each visible question with an **explicit** (user) answer, each selected option's
  `implies` targets a visible question; a hidden target is skipped and the implication is applied
  again when it becomes visible. Implications are computed from explicit answers only, in one pass
  — an implied answer never triggers further implications (AR-50).
- **Conflict**: two or more implications on one target with different answers (AR-26).
- **Effective answer**: the explicit answer when present, else the implied answer when there is
  no conflict, else none. `overridesImplied` is true when an explicit answer differs from a
  non-conflicting implied answer (AR-26: reported to the agent).
- **Hidden answers**: a hidden question keeps its stored answer, but it has no effective answer,
  is not counted, and is never submitted; it reappears when visible again (AR-51).
- **Locked**: a group is locked while any group in its `dependsOn` has not been submitted (AR-6,
  AR-43).

### `groupReadiness` semantics

A group is ready when it is unlocked and has at least one pending question (visible, status
`open`), and every pending question is one of: effectively answered without
conflict, deferred with a valid deferral, or marked "needs discussion" (AR-42) — and at least one of them is answered or deferred, so a submission
always carries something for the agent. When that last condition is the only blocker, `missing`
carries a single `nothing-to-submit` entry so the page can explain the block. A pending question
blocks readiness when it is `changed` and not re-confirmed (AR-24), when it has a conflict and no
explicit answer (AR-26), or when its only answer is an unconfirmed `proposal` (AR-6). Submitted,
recorded, and retired questions are not pending; submitted answers are read-only (AR-52).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| --- | --- | --- |
| Invalid publish payload | `{ ok: false, errors }` listing every problem with its path; nothing thrown | AR #14, #29 |
| Unknown or wrong-typed answer | `validateAnswer` error; the store rejects the save | AR #25, #29 |
| Incomplete deferral | `validateDefer` error naming the missing field | AR #25 |
| Cycles in `dependsOn` or `showIf` | Publish rejected with the cycle path | AR #26 |

## Testing Requirements

- Spec: 07 ST-1…ST-12. Implementation tests: boundary caps, normalization, every error path.
- A content test asserts the module imports nothing from `node:` (browser-safe).
