/**
 * One group section: title, readiness summary, questions, and its submit
 * button. A locked group is read-only and explains which prerequisite is
 * missing.
 *
 * @module views/GroupSection
 */

import { Badge, Button, MessageBar, MessageBarBody, Text, Tooltip } from "@fluentui/react-components"

import { QuestionCard } from "./QuestionCard.tsx"
import type { GroupView } from "../view-models.ts"

/** Props for {@link GroupSection}. */
export interface GroupSectionProps {
  group: GroupView
  onPatch?: (key: string, patch: Record<string, unknown>) => void
  onSubmit?: (group: string) => void
  onFlush?: () => void
}

/** Render one group. */
export function GroupSection({ group, onPatch = () => {}, onSubmit = () => {}, onFlush = () => {} }: GroupSectionProps) {
  return (
    <section aria-label={group.title} style={{ marginBlock: 24 }}>
      <header style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>{group.title}</h2>
        <Badge appearance="tint">{group.summary}</Badge>
      </header>
      {group.description ? <Text size={200}>{group.description}</Text> : null}
      {group.locked ? (
        <MessageBar intent="info">
          <MessageBarBody>{group.lockLabel}</MessageBarBody>
        </MessageBar>
      ) : null}
      {group.questions.map((question) => (
        <QuestionCard
          key={question.key}
          question={question}
          disabled={group.locked}
          onPatch={(patch) => onPatch(question.key, patch)}
          onFlush={onFlush}
        />
      ))}
      {!group.ready ? <Text size={200}>{group.missingLabel}</Text> : null}
      <Tooltip content={group.missingLabel} relationship="description">
        <Button appearance="primary" disabled={!group.ready} onClick={() => onSubmit(group.key)}>
          Submit group
        </Button>
      </Tooltip>
    </section>
  )
}
