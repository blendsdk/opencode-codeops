/**
 * Pure workspace selection for a Discovery plan.
 *
 * These functions decide which destination a plan should show. They never
 * touch the browser: the app writes the returned destination through its own
 * history boundary. That separation keeps the initial-selection and Continue
 * rules testable in Node.
 *
 * @module workspace-model
 */

import type { PlanView, QuestionView } from "./view-models.ts"
import type { PlanPatch } from "./plan-editor.ts"
import type { WorkspaceTarget } from "./route.ts"

/** The outcome of resolving a requested destination. */
export interface WorkspaceSelection {
  /** The destination to display. */
  target: WorkspaceTarget
  /** Whether the current history entry should be replaced. */
  replace: boolean
  /** An explanation shown when the requested group disappeared. */
  notice: string | null
}

/** True when the group still has visible work that is not submitted yet. */
function hasPendingQuestion(group: PlanView["groups"][number]): boolean {
  return group.questions.some(
    (question) => question.statusKey !== "submitted" && question.statusKey !== "recorded",
  )
}

/** True when the group can receive new answers and still has work to do. */
function isActionable(group: PlanView["groups"][number]): boolean {
  return group.locked !== true && hasPendingQuestion(group)
}

/**
 * Resolve the destination a plan route should display.
 *
 * Without an explicit target the first actionable group is selected. That is
 * an initial normalization, so the caller replaces the current history entry
 * instead of adding another one. An explicit group is always honoured, even
 * when it became locked, complete, or empty, because the user may want to
 * inspect it. A group that no longer exists resolves to the summary and asks
 * the caller to replace the stale link.
 *
 * @param plan - The current plan view.
 * @param target - The destination parsed from the route, when present.
 * @returns The destination, the history intent, and an optional notice.
 *
 * The walk relies on `plan.groups` being in dependency order, which
 * {@link planView} guarantees. A hand-built or unordered view would change
 * which group counts as "first".
 */
export function selectWorkspace(
  plan: PlanView,
  target?: WorkspaceTarget,
): WorkspaceSelection {
  if (target === undefined) {
    const first = plan.groups.find(isActionable)
    return {
      target: first ? { kind: "group", key: first.key } : { kind: "summary" },
      replace: true,
      notice: null,
    }
  }
  if (target.kind === "summary") {
    return { target, replace: false, notice: null }
  }
  const group = plan.groups.find((candidate) => candidate.key === target.key)
  if (group === undefined) {
    return {
      target: { kind: "summary" },
      replace: true,
      notice: "This group is no longer available.",
    }
  }
  return { target, replace: false, notice: null }
}

/**
 * Choose the destination for Continue.
 *
 * The next group is the next actionable group in dependency order, wrapping
 * to the first one. The current group is always excluded so a group that
 * retains only a discussion question cannot make Continue do nothing. When no
 * other group qualifies the summary is the safe fallback.
 *
 * @param plan - The current plan view.
 * @param currentKey - The group currently displayed.
 * @returns The next destination; never the current group.
 *
 * The walk relies on `plan.groups` being in dependency order, which
 * {@link planView} guarantees.
 */
export function nextWorkspace(plan: PlanView, currentKey: string): WorkspaceTarget {
  const eligible = plan.groups.filter(isActionable)
  if (eligible.length === 0) return { kind: "summary" }
  const currentIndex = eligible.findIndex((group) => group.key === currentKey)
  const start = currentIndex >= 0 ? currentIndex + 1 : 0
  for (let offset = 0; offset < eligible.length; offset += 1) {
    const group = eligible[(start + offset) % eligible.length]
    if (group.key !== currentKey) return { kind: "group", key: group.key }
  }
  return { kind: "summary" }
}

/** One group's display-only progress summary. */
export interface WorkspaceGroup {
  key: string
  title: string
  locked: boolean
  complete: boolean
  empty: boolean
  ready: boolean
  pendingCount: number
  readyCount: number
}

/** The progress numbers shared by the header, navigation, rail, and summary. */
export interface WorkspaceView {
  groups: WorkspaceGroup[]
  completedGroups: number
  totalGroups: number
  answeredQuestions: number
  visibleQuestions: number
  /** The next actionable destination, used by the context rail. */
  next: WorkspaceTarget
}

/** True when a visible question carries an effective, settled answer. */
function isAnswered(question: QuestionView): boolean {
  if (question.changed || question.conflict !== null || question.proposal !== null) return false
  if (question.statusKey === "submitted" || question.statusKey === "recorded") {
    return question.storedAnswer !== null || question.implied !== null
  }
  return question.statusKey === "answered"
}

/**
 * Derive the display progress for a plan.
 *
 * Readiness still comes from the shared rules; this function only turns the
 * existing group missing reasons and question statuses into counts. It never
 * parses the human-readable summary.
 *
 * @param plan - The plan view, with any display overlay already applied.
 * @returns Group progress plus the plan-wide answered/visible counts.
 */
export function workspaceView(plan: PlanView): WorkspaceView {
  const groups: WorkspaceGroup[] = plan.groups.map((group) => {
    const pending = group.questions.filter(
      (question) => question.statusKey !== "submitted" && question.statusKey !== "recorded",
    )
    const blocking = group.missing.filter((entry) => entry.reason !== "nothing-to-submit")
    return {
      key: group.key,
      title: group.title,
      locked: group.locked,
      complete:
        group.questions.length > 0 &&
        group.questions.every(
          (question) =>
            question.statusKey === "submitted" || question.statusKey === "recorded",
        ),
      empty: group.questions.length === 0,
      ready: group.ready,
      pendingCount: pending.length,
      readyCount: group.ready
        ? pending.length
        : Math.max(0, pending.length - blocking.length),
    }
  })
  const populated = groups.filter((group) => !group.empty)
  const visibleQuestions = plan.groups.reduce(
    (total, group) => total + group.questions.length,
    0,
  )
  const answeredQuestions = plan.groups.reduce(
    (total, group) => total + group.questions.filter(isAnswered).length,
    0,
  )
  return {
    groups,
    completedGroups: populated.filter((group) => group.complete).length,
    totalGroups: populated.length,
    answeredQuestions,
    visibleQuestions,
    next: selectWorkspace(plan).target,
  }
}

/** A human label for the group progress, including the zero-denominator case. */
export function groupsLabel(progress: WorkspaceView): string {
  return progress.totalGroups === 0
    ? "No groups with visible questions"
    : `${progress.completedGroups} of ${progress.totalGroups} groups complete`
}

/** A human label for the answered progress, including the empty case. */
export function answeredLabel(progress: WorkspaceView): string {
  return progress.visibleQuestions === 0
    ? "No visible questions"
    : `${progress.answeredQuestions} of ${progress.visibleQuestions} answered`
}

/** Apply a draft answer to the display fields of one question view. */
function overlayAnswer(question: QuestionView, answer: NonNullable<PlanPatch["answer"]>): QuestionView {
  const cleared = {
    ...question,
    options: question.options.map((option) => ({ ...option, selected: false })),
    text: null,
    other: null,
  }
  if (Array.isArray(answer.choices)) {
    const selected = new Set(answer.choices)
    return {
      ...cleared,
      options: question.options.map((option) => ({
        ...option,
        selected: selected.has(option.id),
      })),
    }
  }
  if (typeof answer.choice === "string") {
    return {
      ...cleared,
      options: question.options.map((option) => ({
        ...option,
        selected: option.id === answer.choice,
      })),
    }
  }
  if (typeof answer.text === "string") {
    return { ...cleared, text: answer.text }
  }
  if (typeof answer.other === "string") {
    return { ...cleared, other: answer.other }
  }
  return cleared
}

/** Apply one patch to a question view without touching rule-derived fields. */
function overlayQuestion(
  question: QuestionView,
  patch: PlanPatch | undefined,
  error: string | undefined,
): QuestionView {
  if (patch === undefined && error === undefined) return question
  let next = question
  if (patch?.answer !== undefined) {
    next = patch.answer === null
      ? {
          ...question,
          options: question.options.map((option) => ({ ...option, selected: false })),
          text: null,
          other: null,
        }
      : overlayAnswer(question, patch.answer)
  }
  if (patch?.notes !== undefined) next = { ...next, notes: patch.notes }
  if (patch?.defer !== undefined) next = { ...next, defer: patch.defer }
  if (patch?.needsDiscussion !== undefined) next = { ...next, needsDiscussion: patch.needsDiscussion }
  return {
    ...next,
    hasDraft: patch !== undefined,
    error: error ?? next.error,
  }
}

/**
 * Overlay unsaved drafts on a plan for rendering.
 *
 * Only display fields change. Visibility, readiness, counts, and submit lists
 * still come from the accepted server snapshot.
 *
 * @param plan - The accepted plan view.
 * @param drafts - Pending patches keyed by question.
 * @param errors - Per-question save or validation errors.
 * @returns A new plan view whose question controls show the drafts.
 */
export function applyDrafts(
  plan: PlanView,
  drafts: Record<string, PlanPatch>,
  errors: Record<string, string> = {},
): PlanView {
  const apply = (question: QuestionView) =>
    overlayQuestion(question, drafts[question.key], errors[question.key])
  return {
    ...plan,
    groups: plan.groups.map((group) => ({
      ...group,
      questions: group.questions.map(apply),
    })),
    retired: plan.retired.map(apply),
    hidden: plan.hidden.map(apply),
  }
}
