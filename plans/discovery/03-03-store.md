# Store: discovery

> **Document**: 03-03-store.md
> **Parent**: [Index](00-index.md)

## Overview

`bin/lib/discovery-store.mjs` (+ `.d.mts`) persists projects, plans, answers, and submissions as
JSON files and implements every state transition. The server (03-04) and the tools (03-05) are its
only callers; the rules module (03-02) supplies validation and evaluation.

## Architecture

### Current Architecture
No discovery data exists. The CodeOps data base path is `$CODEOPS_DATA_DIR` or
`~/.local/share/opencode/codeops/` (`scripts/codeops_outcomes.py:41-50`).

### Proposed Changes

```text
<base>/discovery/                         0700
  projects/<projectSlug>/project.json     0600
  projects/<projectSlug>/plans/<planSlug>.json
```

## Implementation Details

### Records

```text
project.json  { schemaVersion: 1, slug, directory, name, branch, repository: { id, canonical, name },
                createdAt, updatedAt }
<plan>.json   { schemaVersion: 1, slug, key: "<kind>:<artifact>", kind, artifact, title,
                owner: { sessionID } | null, orphaned, archived, unarchivedAt | null,
                revision, createdAt, updatedAt,
                groups: [{ key, title, description?, dependsOn: [], submittedAt | null }],
                questions: [{ …published fields (03-02), fingerprint, revisedAt,
                              state: { answer, notes, defer, needsDiscussion, proposalDismissed,
                                       status, changed, recordedAs } }],
                submissions: [{ id, at, groups: [key], questions: [SubmittedAnswer],
                                claimedBy: { pid, at } | null, deliveredAt | null, deliveredTo | null }] }
```

Times are ISO-8601 strings from an injectable clock. `SubmittedAnswer` is
`{ key, title, answer, source: "user" | "implied", impliedBy: [key], overridesImplied, notes,
defer, needsDiscussion: false }` — the effective answer at submit time (AR-27). Questions marked
"needs discussion" stay `open` and are not part of the submission (AR-42).

### Identity (AR-15, AR-22, AD-54)

- **Project**: keyed by the realpath of the checkout directory. Slug = directory name lowercased,
  every run of characters outside `[a-z0-9]` replaced by `-`, trimmed of `-`, at most 40
  characters, `project` when empty; `-2`, `-3`, … when another directory already owns it. The
  repository name is the basename of `repository.canonical`.
- **Plan**: keyed by `<kind>:<artifact>` within a project. Slug = the artifact's last path segment
  slugified the same way, plus `-<kind>` for kinds other than `plan` unless the slug already
  equals the kind; `-2`, … on collision with a different key.

### API

```ts
export function resolveDataDir(env?: NodeJS.ProcessEnv, home?: string): string  // "<base>/discovery"

export function createDiscoveryStore(options: { dataDir: string; now?: () => Date }): DiscoveryStore

interface DiscoveryStore {
  registerProject(input: { directory: string; branch: string | null;
                           repository: { id: string; canonical: string } }): Promise<ProjectRecord>
  listProjects(): Promise<ProjectSummary[]>                       // with plan counts (03-02 planCounts)
  getProject(slug: string): Promise<ProjectRecord | null>
  findProjectByDirectory(directory: string): Promise<ProjectRecord | null>
  listPlans(projectSlug: string): Promise<PlanSummary[]>          // archived plans included and flagged
  getPlan(projectSlug: string, planSlug: string): Promise<PlanRecord | null>
  findPlan(projectSlug: string, kind: string, artifact: string): Promise<PlanRecord | null>

  publish(projectSlug: string, payload: unknown, sessionID: string):
    Promise<{ ok: true; plan: PlanRecord; warnings: string[] } |
            { ok: false; reason: "invalid"; errors: string[] } |
            { ok: false; reason: "owned"; owner: string }>
  saveAnswer(projectSlug: string, planSlug: string, key: string, patch: AnswerPatch, baseRevision: number):
    Promise<{ ok: true; plan: PlanRecord } |
            { ok: false; reason: "not-found" | "read-only" | "locked" | "stale" | "invalid"; message: string }>
  submit(projectSlug: string, planSlug: string, group: string | null, baseRevision: number | null):
    Promise<{ ok: true; submission: Submission; skipped: { group: string; missing: Missing[] }[] } |
            { ok: false; reason: "not-found" | "not-ready" | "nothing-ready" | "stale"; missing?: Missing[] }>
  pendingDeliveries(projectSlug: string): Promise<{ planSlug: string; submissions: Submission[] }[]>
  claimDelivery(projectSlug: string, planSlug: string, submissionId: number, sessionID: string): Promise<boolean>
  releaseDelivery(projectSlug: string, planSlug: string, submissionId: number): Promise<void>
  readAnswers(projectSlug: string, planSlug: string, sessionID: string):
    Promise<{ ok: true; plan: PlanRecord; submissions: Submission[] } | { ok: false; reason: "owned"; owner: string }>
  resolve(projectSlug: string, planSlug: string, sessionID: string,
          input: { recorded?: { key: string; as: string }[]; retire?: string[] }):
    Promise<{ ok: true; recorded: number; retired: number } |
            { ok: false; reason: "owned" | "invalid"; owner?: string; errors?: string[] }>
  markOrphaned(projectSlug: string, sessionID: string): Promise<number>
  setArchived(projectSlug: string, planSlug: string, archived: boolean): Promise<boolean>
  deletePlan(projectSlug: string, planSlug: string): Promise<boolean>
}
```

`AnswerPatch` = `{ answer?: Answer | null; notes?: string; defer?: Defer | null;
needsDiscussion?: boolean; reconfirm?: true; confirmProposal?: true; dismissProposal?: true }`.

Every method throws `DiscoveryDataError { code: "newer-version" | "unreadable" }` when a file must
be refused; the server maps it to `409` and the tools map it to `{ ok: false, reason: "error" }`.
Refusing is the only throw: every other failure uses the documented result unions.

### Transitions

| Operation | Rule | AR |
| --- | --- | --- |
| `publish` | Validate (03-02). A publish carries the plan's **full** question set; a follow-up round resends earlier questions. Ownership: no owner or orphaned → caller becomes owner; same owner → continue; other owner → `owned` unless `takeover: true`. Archived → unarchived, `unarchivedAt` set. `revision + 1` and nothing else changes `revision`. Questions matched by key: new → `open`, `revisedAt = revision`; same fingerprint → state kept; different fingerprint on `open` → answer kept, `changed: true`, `revisedAt = revision`; a changed `type` on any question → publish refused ("use a new key for a new decision"); recorded, retired, or **submitted** → unchanged, warning when the content differs ("DQ-3 is recorded/submitted; use a new key for a new decision"). Keys missing from the payload → `retired` unless recorded, retired, or submitted. Groups replaced by the payload, keeping `submittedAt` for surviving keys. | AR-23, AR-24, AR-28, AR-40, AR-53, AD-54 |
| `saveAnswer` | Question must be `open` (submitted, recorded, retired → `read-only`, AR-52); its group must be unlocked (`locked`, AR-43); `baseRevision < revisedAt` → `stale` (AR-49); `answer`, `defer`, `notes` validated (03-02). `reconfirm` re-runs `validateAnswer` against the current question and clears `changed`; an answer that no longer validates is cleared and reported as `invalid`. `confirmProposal` sets the answer from the proposal; `dismissProposal` sets `proposalDismissed`. Latest write wins per question. | AR-6, AR-24, AR-25, AR-49, AR-52 |
| `submit` | `group` given → that group must be ready (`not-ready` with `missing`); `null` → every ready unlocked group, the rest listed in `skipped`; none ready → `nothing-ready`. `baseRevision` older than any pending question's `revisedAt` in the submitted groups → `stale` (AR-49). Answered and deferred questions become `submitted`; "needs discussion" ones stay `open`; each submitted group gets `submittedAt` (first time); a submission with the next id, `claimedBy: null`, and `deliveredAt: null` is appended. | AR-5, AR-42, AR-47 |
| `claimDelivery` | Sets `claimedBy` (pid and time) only when `deliveredAt` is unset and no live claim exists; returns whether this call claimed it. `deliveredAt` is written by the caller after the prompt resolves, or by `readAnswers` when it hands the submission to the agent. | AR-5, AR-46 |
| `releaseDelivery` | Clears `claimedBy` (and any `deliveredAt`) after a failed wake prompt so the next delivery point retries. Claims whose pid is no longer running are released at store creation. | AR-5, AD-57 |
| `readAnswers` | Ownership as in `publish` without takeover (no owner or orphaned → caller adopts, AR-40; other owner → `owned`). Returns submissions whose questions are still `submitted`; claims every undelivered submission for the caller. | AR-40, AD-56 |
| `resolve` | Ownership as in `readAnswers`. `recorded` keys must be `submitted` → `recorded` with `recordedAs`; `retire` keys → `retired` unless recorded. Unknown keys → `invalid`. | AR-14, AR-27 |
| `markOrphaned` | Every plan of the project owned by the session gets `orphaned: true`. | AR-40 |
| `setArchived` / `deletePlan` | Archive flag only; delete removes the plan file. Nothing is deleted automatically. | AR-28 |

### Durability (AR-29, AR-46, AD-54)

- The discovery directory and every subdirectory are created with mode `0700` on the first
  **enabled** use; an existing discovery directory is chmod-ed to `0700` at store creation. A
  disabled project never creates it. Files are written with mode `0600`.
- Every mutation runs inside `withPlan`/`withProject`: one process-wide queue per absolute file
  path (module scope, shared by every store instance in the process); the file is re-read, the
  change applied, the result written to `<file>.<pid>.<random>.tmp` in the same directory and
  renamed over the original.
- Every read and write resolves the file path first and refuses it unless the resolved path stays
  inside the discovery data directory, so a slug from a route cannot reach another file.
- A file whose `schemaVersion` is greater than 1 makes that project or plan unavailable with the
  message "written by a newer CodeOps version — update CodeOps"; it is never rewritten. A
  malformed file reports "unreadable Discovery data: <file name>" and is never rewritten.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| --- | --- | --- |
| Newer `schemaVersion` | `DiscoveryDataError("newer-version")`; refuse, never rewrite, clear message | AR #28 |
| Malformed JSON | `DiscoveryDataError("unreadable")`; refuse that file only; other projects keep working | AR #28, AD-54 |
| Permission or disk error | Operation fails with `{ ok: false, reason: "error" }` at the tool/server layer; no partial file (temp + rename) | AR #29 |
| Concurrent writers (two processes) | Re-read before write; per-file queue in-process | AR #46 |

## Testing Requirements

- Spec: 07 ST-13…ST-26. Implementation tests: slug collisions, temp-file cleanup on failure,
  permission modes, queue ordering.
