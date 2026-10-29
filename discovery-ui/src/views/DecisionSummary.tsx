/**
 * The decision summary for one plan.
 *
 * The summary is a read-only inspection surface: it shows the current visible
 * answers, their status and provenance, retired answers, and any retained
 * drafts that can no longer be edited in place. Links back to a group pass
 * through the same save boundary as the navigation column.
 *
 * @module views/DecisionSummary
 */

import { Badge, Button, MessageBar, MessageBarBody, Text } from "@fluentui/react-components"

import { useWorkspaceStyles } from "./workspace-styles.ts"
import { formatRoute } from "../route.ts"
import type { PlanPatch, IncompleteWork } from "../plan-editor.ts"
import type { PlanView, QuestionView } from "../view-models.ts"
import type { WorkspaceView } from "../workspace-model.ts"
import { answeredLabel, groupsLabel } from "../workspace-model.ts"

/** Props for {@link DecisionSummary}. */
export interface DecisionSummaryProps {
  plan: PlanView
  projectSlug: string
  progress: WorkspaceView
  drafts: Record<string, PlanPatch>
  incomplete: Record<string, IncompleteWork>
  errors: Record<string, string>
  onDiscard: (key: string) => void
  onRetry: (key?: string) => void
  retryDisabled?: boolean
}

/** All question rows the summary can look up, including retained ones. */
function allQuestions(plan: PlanView): Map<string, QuestionView> {
  const questions = new Map<string, QuestionView>()
  for (const group of plan.groups) {
    for (const question of group.questions) questions.set(question.key, question)
  }
  for (const question of plan.hidden) questions.set(question.key, question)
  for (const question of plan.retired) questions.set(question.key, question)
  return questions
}

/** A label built from the server's stored answer. */
function storedAnswerLabel(question: QuestionView): string | null {
  const answer = question.storedAnswer
  if (answer === null) return null
  if (typeof answer.choice === "string") {
    return question.options.find((option) => option.id === answer.choice)?.label ?? answer.choice
  }
  if (Array.isArray(answer.choices)) {
    return answer.choices
      .map((id) => question.options.find((option) => option.id === id)?.label ?? id)
      .join(", ")
  }
  if (typeof answer.text === "string") return answer.text
  if (typeof answer.other === "string") return `Other: ${answer.other}`
  return null
}

/** A short answer label for the displayed fields, including a draft overlay. */
function currentAnswerLabel(question: QuestionView): string {
  const selected = question.options.filter((option) => option.selected)
  if (selected.length > 0) {
    const labels = selected.map((option) => option.label).join(", ")
    return question.other ? `${labels} — Other: ${question.other}` : labels
  }
  if (question.text) return question.text
  if (question.other) return `Other: ${question.other}`
  if (question.defer) {
    return `Deferred — ${question.defer.decision} (${question.defer.owner}, ${question.defer.revisit})`
  }
  if (question.needsDiscussion) return "Needs discussion"
  return "Unanswered"
}

/** A short answer label for one question. */
function answerLabel(question: QuestionView): string {
  if (question.readOnly || question.removedGroup) {
    const stored = storedAnswerLabel(question)
    if (stored !== null) return stored
  }
  return currentAnswerLabel(question)
}

/** The reason a draft cannot be edited in place. */
function retentionLabel(question: QuestionView, plan: PlanView): string | null {
  if (question.removedGroup) return "group removed"
  if (question.hidden) return "hidden"
  if (question.readOnly) return "read-only"
  const group = plan.groups.find((candidate) => candidate.key === question.group)
  if (group?.locked) return "locked"
  return null
}

/** Render one question's answer and provenance. */
function SummaryQuestion({ question }: { question: QuestionView }) {
  const styles = useWorkspaceStyles()
  return (
    <div className={styles.summaryQuestion}>
      <Text weight="semibold">{question.title}</Text>
      <Text className={styles.summaryAnswer}>{answerLabel(question)}</Text>
      <Text size={200} className={styles.muted}>
        {question.statusLabel}
      </Text>
      {question.implied ? (
        <Text size={200} className={styles.muted}>
          {question.implied.label}
        </Text>
      ) : null}
      {question.overridesImplied ? (
        <Text size={200} className={styles.muted}>
          Overrides the implied answer
        </Text>
      ) : null}
      {question.conflict ? (
        <Text size={200} className={styles.muted}>
          {question.conflict.label}
        </Text>
      ) : null}
      {question.changed ? (
        <Text size={200} className={styles.muted}>
          Changed — re-confirm in the group
        </Text>
      ) : null}
      {question.proposal ? (
        <Text size={200} className={styles.muted}>
          {question.proposal.label}
        </Text>
      ) : null}
      {question.notes ? (
        <Text size={200} className={styles.muted}>
          Notes: {question.notes}
        </Text>
      ) : null}
    </div>
  )
}

/** Render the summary. */
export function DecisionSummary({
  plan,
  projectSlug,
  progress,
  drafts,
  incomplete,
  errors,
  onDiscard,
  onRetry,
  retryDisabled = false,
}: DecisionSummaryProps) {
  const styles = useWorkspaceStyles()
  const questions = allQuestions(plan)
  const draftKeys = [
    ...new Set([...Object.keys(drafts), ...Object.keys(incomplete), ...Object.keys(errors)]),
  ]

  return (
    <div>
      <div className={styles.groupHeader}>
        <Badge appearance="tint">{answeredLabel(progress)}</Badge>
        <Badge appearance="outline">{groupsLabel(progress)}</Badge>
      </div>

      {plan.groups.map((group) => {
        const groupProgress = progress.groups.find((entry) => entry.key === group.key)
        const href = formatRoute({
          view: "plan",
          project: projectSlug,
          plan: plan.slug,
          target: { kind: "group", key: group.key },
        })
        return (
          <section key={group.key} className={styles.summaryGroup} aria-label={group.title}>
            <div className={styles.groupHeader}>
              <a href={href}>{group.title}</a>
              {groupProgress?.complete ? <Badge color="success">Complete</Badge> : null}
              {groupProgress?.ready ? <Badge color="informative">Ready</Badge> : null}
              {group.locked ? <Badge>Locked</Badge> : null}
            </div>
            {group.questions.length === 0 ? (
              <Text size={200} className={styles.muted}>
                No visible questions.
              </Text>
            ) : (
              group.questions.map((question) => (
                <SummaryQuestion key={question.key} question={question} />
              ))
            )}
          </section>
        )
      })}

      {plan.retired.length > 0 ? (
        <details className={styles.summaryGroup}>
          <summary>Retired questions ({plan.retired.length})</summary>
          {plan.retired.map((question) => (
            <div key={question.key} className={styles.summaryQuestion}>
              <Text weight="semibold">{question.title}</Text>
              {retentionLabel(question, plan) ? (
                <Badge size="small">{retentionLabel(question, plan)}</Badge>
              ) : null}
              <Text>{answerLabel(question)}</Text>
              <Text size={200} className={styles.muted}>
                {question.statusLabel}
              </Text>
            </div>
          ))}
        </details>
      ) : null}

      <section className={styles.summaryGroup} aria-label="Unsent drafts">
        <Text weight="semibold">Unsent drafts</Text>
        {draftKeys.length === 0 ? (
          <Text size={200} className={styles.muted}>
            No drafts waiting to be sent.
          </Text>
        ) : (
          draftKeys.map((key) => {
            const question = questions.get(key)
            const label = question ? retentionLabel(question, plan) : "no longer available"
            const notesOnly =
              drafts[key]?.notes !== undefined &&
              drafts[key]?.answer === undefined &&
              incomplete[key] === undefined
            const group = question
              ? plan.groups.find((candidate) => candidate.key === question.group)
              : undefined
            const href = question && group
              ? formatRoute({
                  view: "plan",
                  project: projectSlug,
                  plan: plan.slug,
                  target: { kind: "group", key: group.key },
                })
              : formatRoute({
                  view: "plan",
                  project: projectSlug,
                  plan: plan.slug,
                  target: { kind: "summary" },
                })
            return (
              <div key={key} className={styles.summaryQuestion}>
                <Text weight="semibold">
                  {question?.title ?? key} {label ? <Badge size="small">{label}</Badge> : null}
                </Text>
                <Text size={200}>
                  {notesOnly
                    ? "Notes draft"
                    : question
                      ? currentAnswerLabel(question)
                      : "Draft retained"}
                </Text>
                {incomplete[key] ? (
                  <Text size={200}>{incomplete[key].reason}</Text>
                ) : null}
                {errors[key] ? (
                  <MessageBar intent="error">
                    <MessageBarBody>{errors[key]}</MessageBarBody>
                  </MessageBar>
                ) : null}
                <div className={styles.actionRow}>
                  <a href={href}>Open group</a>
                  {errors[key] &&
                  question !== undefined &&
                  !retryDisabled &&
                  !question?.readOnly &&
                  label !== "locked" &&
                  label !== "group removed" ? (
                    <Button size="small" onClick={() => onRetry(key)}>
                      Retry
                    </Button>
                  ) : null}
                  <Button size="small" appearance="secondary" onClick={() => onDiscard(key)}>
                    Discard unsaved change
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </section>
    </div>
  )
}
