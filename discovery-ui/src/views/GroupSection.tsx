/**
 * One group section: title, readiness summary, and the group's questions.
 *
 * The group is read-only when a dependency is missing. Submission lives in the
 * plan page's sticky footer so the primary action stays in one place.
 *
 * @module views/GroupSection
 */

import { Badge, MessageBar, MessageBarBody, Text } from "@fluentui/react-components"

import { QuestionCard } from "./QuestionCard.tsx"
import { useWorkspaceStyles } from "./workspace-styles.ts"
import type { GroupView } from "../view-models.ts"

/** Props for {@link GroupSection}. */
export interface GroupSectionProps {
  group: GroupView
  /** Per-question discard counters, used to reset local controls. */
  discardVersions?: Record<string, number>
  /** A plan-wide discard counter, used after "discard all". */
  discardAllVersion?: number
  onPatch?: (key: string, patch: Record<string, unknown>) => void
  onFlush?: () => void
  onDiscard?: (key: string) => void
  onSetIncomplete?: (key: string, value: boolean, reason?: string) => void
  onRetry?: (key?: string) => void
  retryDisabled?: boolean
}

/** Render one group. */
export function GroupSection({
  group,
  discardVersions = {},
  discardAllVersion = 0,
  onPatch = () => {},
  onFlush = () => {},
  onDiscard = () => {},
  onSetIncomplete = () => {},
  onRetry = () => {},
  retryDisabled = false,
}: GroupSectionProps) {
  const styles = useWorkspaceStyles()
  return (
    <section aria-label={group.title}>
      <header className={styles.groupHeader}>
        <h2 className={styles.groupTitle}>{group.title}</h2>
        <Badge appearance="tint">{group.summary}</Badge>
        {group.ready ? <Badge color="informative">Ready</Badge> : null}
      </header>
      {group.description ? (
        <Text size={200} className={styles.muted}>
          {group.description}
        </Text>
      ) : null}
      {group.locked ? (
        <MessageBar intent="info">
          <MessageBarBody>{group.lockLabel}</MessageBarBody>
        </MessageBar>
      ) : null}
      {group.questions.length === 0 ? (
        <Text size={200} className={styles.muted}>
          No visible questions.
        </Text>
      ) : null}
      {group.questions.map((question) => (
        <QuestionCard
          key={question.key}
          question={question}
          disabled={group.locked}
          resetKey={`${discardAllVersion}:${discardVersions[question.key] ?? 0}`}
          onPatch={(patch) => onPatch(question.key, patch)}
          onFlush={onFlush}
          onDiscard={onDiscard}
          onIncomplete={onSetIncomplete}
          onRetry={onRetry}
          retryDisabled={retryDisabled}
        />
      ))}
      {!group.ready ? <Text size={200}>{group.missingLabel}</Text> : null}
    </section>
  )
}
