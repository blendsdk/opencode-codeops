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

import type { PlanView } from "./view-models.ts"
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
