/**
 * Type declarations for the CodeOps Discovery store.
 *
 * The store is plain JavaScript so `node --test` can exercise it directly;
 * these declarations give the TypeScript plugin entry point typed access.
 */

import type { Answer, Defer, Missing, PlanCounts, Question } from "./discovery-rules.mjs"

/** A refusal to read or write Discovery data. */
export declare class DiscoveryDataError extends Error {
  readonly code: "newer-version" | "unreadable"
  constructor(code: "newer-version" | "unreadable", message: string)
}

/** Resolve the Discovery data directory. */
export declare function resolveDataDir(
  env?: Record<string, string | undefined>,
  home?: string
): string

/** One checkout registered with Discovery. */
export interface ProjectRecord {
  schemaVersion: number
  slug: string
  directory: string
  name: string
  branch: string | null
  repository: { id: string; canonical: string; name: string }
  createdAt: string
  updatedAt: string
}

/** Aggregated question counts across a project's plans. */
export interface ProjectCounts extends PlanCounts {
  plans: number
}

/** A project with its aggregated counts. */
export interface ProjectSummary extends ProjectRecord {
  counts: ProjectCounts
}

/** The mutable state of one stored question. */
export interface StoredQuestionState {
  answer: Answer | null
  notes: string
  defer: Defer | null
  needsDiscussion: boolean
  proposalDismissed: boolean
  status: "open" | "submitted" | "recorded" | "retired"
  changed: boolean
  recordedAs: string | null
}

/** A stored question: the published content plus fingerprint and state. */
export interface StoredQuestion extends Question {
  fingerprint: string
  revisedAt: number
  state: StoredQuestionState
}

/** One answer captured in a submission. */
export interface SubmittedAnswer {
  key: string
  title: string
  answer: Answer | null
  source: "user" | "implied" | null
  impliedBy: string[]
  overridesImplied: boolean
  notes: string
  defer: Defer | null
  needsDiscussion: false
}

/** A submitted group batch. */
export interface Submission {
  id: number
  at: string
  groups: string[]
  questions: SubmittedAnswer[]
  claimedBy: { pid: number; at: string } | null
  deliveredAt: string | null
  deliveredTo: string | null
}

/** A stored group. */
export interface StoredGroup {
  key: string
  title: string
  description?: string
  dependsOn: string[]
  submittedAt: string | null
}

/** A full plan record. */
export interface PlanRecord {
  schemaVersion: number
  slug: string
  key: string
  kind: string
  artifact: string
  title: string
  owner: { sessionID: string } | null
  orphaned: boolean
  archived: boolean
  unarchivedAt: string | null
  revision: number
  createdAt: string
  updatedAt: string
  groups: StoredGroup[]
  questions: StoredQuestion[]
  submissions: Submission[]
}

/** A plan summary for list views. */
export interface PlanSummary {
  slug: string
  kind: string
  artifact: string
  title: string
  revision: number
  archived: boolean
  updatedAt: string
  counts: PlanCounts
}

/** Pending delivery work for one plan. */
export interface PendingDeliveries {
  planSlug: string
  submissions: Submission[]
}

/** The store API. */
export interface DiscoveryStore {
  registerProject(input: {
    directory: string
    branch: string | null
    repository: { id: string; canonical: string }
  }): Promise<ProjectRecord>
  listProjects(): Promise<ProjectSummary[]>
  getProject(slug: string): Promise<ProjectRecord | null>
  findProjectByDirectory(directory: string): Promise<ProjectRecord | null>
  listPlans(projectSlug: string): Promise<PlanSummary[]>
  getPlan(projectSlug: string, planSlug: string): Promise<PlanRecord | null>
  findPlan(projectSlug: string, kind: string, artifact: string): Promise<PlanRecord | null>
  publish(
    projectSlug: string,
    payload: unknown,
    sessionID: string
  ): Promise<
    | { ok: true; plan: PlanRecord; warnings: string[] }
    | { ok: false; reason: "invalid"; errors: string[] }
    | { ok: false; reason: "owned"; owner: string }
  >
  saveAnswer(
    projectSlug: string,
    planSlug: string,
    key: string,
    patch: {
      answer?: Answer | null
      notes?: string
      defer?: Defer | null
      needsDiscussion?: boolean
      reconfirm?: true
      confirmProposal?: true
      dismissProposal?: true
    },
    baseRevision: number
  ): Promise<
    | { ok: true; plan: PlanRecord }
    | { ok: false; reason: "not-found" | "read-only" | "locked" | "stale" | "invalid"; message: string }
  >
  submit(
    projectSlug: string,
    planSlug: string,
    group: string | null,
    baseRevision: number | null
  ): Promise<
    | { ok: true; submission: Submission; skipped: { group: string; missing: Missing[] }[] }
    | { ok: false; reason: "not-found" | "not-ready" | "nothing-ready" | "stale"; missing?: Missing[] }
  >
  pendingDeliveries(projectSlug: string): Promise<PendingDeliveries[]>
  claimDelivery(
    projectSlug: string,
    planSlug: string,
    submissionId: number,
    sessionID: string
  ): Promise<boolean>
  releaseDelivery(projectSlug: string, planSlug: string, submissionId: number): Promise<void>
  markDelivered(
    projectSlug: string,
    planSlug: string,
    submissionIds: number[],
    sessionID: string
  ): Promise<number>
  readAnswers(
    projectSlug: string,
    planSlug: string,
    sessionID: string
  ): Promise<
    | { ok: true; plan: PlanRecord; submissions: Submission[] }
    | { ok: false; reason: "owned" | "not-found"; owner?: string }
  >
  resolve(
    projectSlug: string,
    planSlug: string,
    sessionID: string,
    input: { recorded?: { key: string; as: string }[]; retire?: string[] }
  ): Promise<
    | { ok: true; recorded: number; retired: number }
    | { ok: false; reason: "owned" | "invalid" | "not-found"; owner?: string; errors?: string[] }
  >
  markOrphaned(projectSlug: string, sessionID: string): Promise<number>
  setArchived(projectSlug: string, planSlug: string, archived: boolean): Promise<boolean>
  deletePlan(projectSlug: string, planSlug: string): Promise<boolean>
}

/** Create a store over one data directory. */
export declare function createDiscoveryStore(options: {
  dataDir: string
  now?: () => Date
}): DiscoveryStore
