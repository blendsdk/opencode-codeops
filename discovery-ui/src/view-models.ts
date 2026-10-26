/**
 * Pure view models for the Discovery app.
 *
 * The React views stay thin: every label, badge, lock reason, and readiness
 * summary is derived here from the stored plan record. That keeps the browser
 * and the tests looking at the same data, and it keeps the render path free of
 * effects so server-side rendering works.
 *
 * @module view-models
 */

import {
  evaluatePlan,
  groupReadiness,
  planCounts,
  validateDefer,
} from "../../bin/lib/discovery-rules.mjs"
import type {
  Answer,
  Defer,
  EvaluationEntry,
  Missing,
  PlanCounts,
  PlanKind,
  Question,
} from "../../bin/lib/discovery-rules.mjs"

/** The stored state of one question. */
export interface QuestionStateLike {
  answer: Answer | null
  notes: string
  defer: Defer | null
  needsDiscussion: boolean
  proposalDismissed: boolean
  status: "open" | "submitted" | "recorded" | "retired"
  changed: boolean
  recordedAs: string | null
}

/** A stored question. */
export interface StoredQuestionLike extends Question {
  revisedAt: number
  state: QuestionStateLike
}

/** A stored group. */
export interface StoredGroupLike {
  key: string
  title: string
  description?: string
  dependsOn: string[]
  submittedAt: string | null
}

/** The subset of the stored plan the view models need. */
export interface PlanRecordLike {
  slug: string
  title: string
  kind: PlanKind
  artifact: string
  revision: number
  orphaned: boolean
  archived: boolean
  unarchivedAt?: string | null
  groups: StoredGroupLike[]
  questions: StoredQuestionLike[]
}

/** One option as the page renders it. */
export interface OptionView {
  id: string
  label: string
  description: string | null
  recommended: boolean
  selected: boolean
}

/** One question as the page renders it. */
export interface QuestionView {
  key: string
  title: string
  why: string | null
  evidence: string[]
  type: string
  options: OptionView[]
  text: string | null
  other: string | null
  implied: { by: string[]; label: string } | null
  conflict: { sources: string[]; label: string } | null
  changed: boolean
  proposal: { label: string } | null
  statusKey: string
  statusLabel: string
  readOnly: boolean
  notes: string
  defer: Defer | null
  needsDiscussion: boolean
  recommendation: string | null
}

/** One group as the page renders it. */
export interface GroupView {
  key: string
  title: string
  description: string | null
  locked: boolean
  lockLabel: string | null
  ready: boolean
  missing: Missing[]
  missingLabel: string
  summary: string
  questions: QuestionView[]
}

/** The whole plan view. */
export interface PlanView {
  slug: string
  title: string
  kind: PlanKind
  artifact: string
  revision: number
  orphaned: boolean
  archived: boolean
  unarchivedAt: string | null
  counts: PlanCounts
  groups: GroupView[]
  retired: QuestionView[]
  submitAll: {
    ready: string[]
    skipped: Array<{ group: string; title: string; label: string }>
  }
}

/** A project row in the projects list. */
export interface ProjectRowInput {
  slug: string
  name: string
  branch: string | null
  directory: string
  counts: Record<string, number>
  live: boolean
}

/** A repository section in the projects list. */
export interface RepositoryInput {
  name: string
  canonical: string
  projects: ProjectRowInput[]
}

/** The projects view. */
export interface ProjectsView {
  repositories: Array<{
    name: string
    canonical: string
    projects: Array<ProjectRowInput & { liveBadge: string | null; countsLabel: string }>
  }>
}

/** Build the rule-state container from a stored record. */
function ruleState(record: PlanRecordLike) {
  return {
    questions: Object.fromEntries(
      record.questions.map((question) => [
        question.key,
        { ...question.state, revisedAt: question.revisedAt },
      ]),
    ),
    submittedGroups: record.groups
      .filter((group) => Boolean(group.submittedAt))
      .map((group) => group.key),
  }
}

/** Order groups so every dependency precedes its dependants. */
function orderGroups(groups: StoredGroupLike[]): StoredGroupLike[] {
  const byKey = new Map(groups.map((group) => [group.key, group]))
  const ordered: StoredGroupLike[] = []
  const done = new Set<string>()
  const visiting = new Set<string>()

  const visit = (key: string) => {
    if (done.has(key) || visiting.has(key)) return
    const group = byKey.get(key)
    if (!group) return
    visiting.add(key)
    for (const dependency of group.dependsOn ?? []) visit(dependency)
    visiting.delete(key)
    done.add(key)
    ordered.push(group)
  }

  for (const group of groups) visit(group.key)
  return ordered
}

/** The status label shown on a question card. */
function statusLabel(question: StoredQuestionLike, entry: EvaluationEntry): { key: string; label: string } {
  const status = question.state.status
  if (status === "retired") return { key: "retired", label: "Retired" }
  if (status === "recorded") {
    return { key: "recorded", label: `Recorded as ${question.state.recordedAs ?? "—"}` }
  }
  if (status === "submitted") return { key: "submitted", label: "Submitted" }
  if (entry.effective !== null) return { key: "answered", label: "Answered" }
  if (question.state.needsDiscussion) return { key: "discussion", label: "Needs discussion" }
  if (question.state.defer && validateDefer(question.state.defer).ok) {
    return { key: "deferred", label: "Deferred" }
  }
  return { key: "open", label: "Open" }
}

/** The compact display of a proposal answer. */
function compactLabel(answer: string | string[]): string {
  return Array.isArray(answer) ? answer.join(", ") : answer
}

/** One question view. */
function questionView(
  question: StoredQuestionLike,
  evaluation: ReturnType<typeof evaluatePlan>,
  entry: EvaluationEntry,
): QuestionView {
  const effective = entry.effective
  const selectedIds = new Set<string>()
  if (effective && Array.isArray(effective.choices)) {
    for (const id of effective.choices) selectedIds.add(id)
  } else if (effective && typeof effective.choice === "string") {
    selectedIds.add(effective.choice)
  }
  const recommended = question.recommendation
  const recommendedIds = new Set(
    recommended === undefined ? [] : Array.isArray(recommended) ? recommended : [recommended],
  )
  const status = statusLabel(question, entry)
  const conflict = entry.conflict.length > 0
    ? {
        sources: [...new Set(entry.conflict.map((item) => item.from))],
        label: `Conflicting answers from ${[...new Set(entry.conflict.map((item) => item.from))].join(", ")}`,
      }
    : null
  const implied = entry.source === "implied"
    ? {
        by: entry.impliedBy,
        label: `Implied by ${entry.impliedBy.join(", ")} — ${entry.impliedReasons.join(", ")}`,
      }
    : null
  const proposal = question.proposal && question.state.proposalDismissed !== true && effective === null
    ? { label: `Proposed: ${compactLabel(question.proposal.answer)} — Confirm or Reopen` }
    : null
  const readOnly = ["submitted", "recorded", "retired"].includes(question.state.status)

  return {
    key: question.key,
    title: question.title,
    why: question.why ?? null,
    evidence: [...(question.evidence ?? [])],
    type: question.type,
    options: (question.options ?? []).map((option) => ({
      id: option.id,
      label: option.label,
      description: option.description ?? null,
      recommended: recommendedIds.has(option.id),
      selected: selectedIds.has(option.id),
    })),
    text: effective && typeof effective.text === "string" ? effective.text : null,
    other: effective && typeof effective.other === "string" ? effective.other : null,
    implied,
    conflict,
    changed: question.state.changed,
    proposal,
    statusKey: status.key,
    statusLabel: status.label,
    readOnly,
    notes: question.state.notes ?? "",
    defer: question.state.defer ?? null,
    needsDiscussion: question.state.needsDiscussion === true,
    recommendation: Array.isArray(recommended)
      ? recommended.join(", ")
      : (recommended ?? null),
  }
}

/** A human label for one missing reason. */
function missingReason(reason: string): string {
  if (reason === "changed") return "changed — re-confirm"
  if (reason === "conflict") return "in conflict"
  if (reason === "proposal") return "awaiting proposal review"
  if (reason === "nothing-to-submit") return "nothing to submit"
  return "unanswered"
}

/** The lock label for a group. */
function lockLabelFor(
  group: StoredGroupLike,
  groups: StoredGroupLike[],
): string | null {
  const titles = group.dependsOn
    .map((key) => groups.find((candidate) => candidate.key === key)?.title ?? key)
  if (titles.length === 0) return null
  return `Unlocks after ${titles.join(", ")} is submitted`
}

/**
 * Build the plan view.
 *
 * @param record - The stored plan record.
 * @returns Order, labels, counts, readiness, and the submit-all summary.
 */
export function planView(record: PlanRecordLike): PlanView {
  const state = ruleState(record)
  const evaluation = evaluatePlan(record, state)
  const counts = planCounts(record, state, evaluation)
  const ordered = orderGroups(record.groups)
  const retired: QuestionView[] = []
  const groups: GroupView[] = []

  for (const group of ordered) {
    const readiness = groupReadiness(record, state, evaluation, group.key)
    const locked = evaluation.lockedGroups.has(group.key)
    const questions = []
    for (const question of record.questions) {
      if (question.group !== group.key) continue
      const entry = evaluation.questions.get(question.key)
      if (entry === undefined) continue
      if (question.state.status === "retired") {
        retired.push(questionView(question, evaluation, entry))
        continue
      }
      if (entry.visible !== true) continue
      questions.push(questionView(question, evaluation, entry))
    }
    const pending = questions.filter(
      (question) => question.statusKey !== "submitted" && question.statusKey !== "recorded",
    )
    const blocking = readiness.missing.filter((missing) => missing.reason !== "nothing-to-submit")
    const satisfied = Math.max(0, pending.length - blocking.length)
    const lockLabel = locked ? lockLabelFor(group, ordered) : null
    const missingLabel =
      (lockLabel
        ?? readiness.missing
          .map((missing) => `${missing.key} is ${missingReason(missing.reason)}`)
          .join(", ")) || "Nothing to submit"
    groups.push({
      key: group.key,
      title: group.title,
      description: group.description ?? null,
      locked,
      lockLabel,
      ready: readiness.ready,
      missing: readiness.missing,
      missingLabel,
      summary: `${satisfied} of ${pending.length} ready`,
      questions,
    })
  }

  const ready: string[] = []
  const skipped: Array<{ group: string; title: string; label: string }> = []
  for (const group of groups) {
    if (group.ready) {
      ready.push(group.key)
      continue
    }
    skipped.push({
      group: group.key,
      title: group.title,
      label: group.missingLabel,
    })
  }

  return {
    slug: record.slug,
    title: record.title,
    kind: record.kind,
    artifact: record.artifact,
    revision: record.revision,
    orphaned: record.orphaned,
    archived: record.archived,
    unarchivedAt: record.unarchivedAt ?? null,
    counts,
    groups,
    retired,
    submitAll: { ready, skipped },
  }
}

/**
 * Build the projects view.
 *
 * @param repositories - The API's repository groups.
 * @returns The same groups with display labels.
 */
export function projectsView(repositories: RepositoryInput[]): ProjectsView {
  return {
    repositories: repositories.map((repository) => ({
      name: repository.name,
      canonical: repository.canonical,
      projects: repository.projects.map((project) => ({
        ...project,
        liveBadge: project.live ? null : "Not open in OpenCode",
        countsLabel:
          `${project.counts.open ?? 0} open · ${project.counts.answered ?? 0} answered` +
          ` · ${project.counts.submitted ?? 0} submitted`,
      })),
    })),
  }
}
