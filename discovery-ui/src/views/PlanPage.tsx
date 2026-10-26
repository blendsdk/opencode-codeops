/**
 * One plan: header, messages, group sections, retired questions, and the
 * submit-all, archive, and delete actions.
 *
 * @module views/PlanPage
 */

import { useState } from "react"
import { Badge, Button, MessageBar, MessageBarBody, Text } from "@fluentui/react-components"

import { ConnectionBanner } from "./ConnectionBanner.tsx"
import { GroupSection } from "./GroupSection.tsx"
import { QuestionCard } from "./QuestionCard.tsx"
import { SubmitDialog } from "./SubmitDialog.tsx"
import type { PlanEventsState } from "../hooks.ts"
import type { PlanView } from "../view-models.ts"

/** Props for {@link PlanPage}. */
export interface PlanPageProps {
  plan: PlanView
  projectName: string
  branch: string | null
  connection: PlanEventsState["status"]
  onPatch: (key: string, patch: Record<string, unknown>) => void
  onFlush: () => void
  onSubmitGroup: (group: string) => void
  onSubmitAll: () => void
  onArchive: (archived: boolean) => void
  onDelete: () => void
}

/** Render one plan. */
export function PlanPage({
  plan,
  projectName,
  branch,
  connection,
  onPatch,
  onFlush,
  onSubmitGroup,
  onSubmitAll,
  onArchive,
  onDelete,
}: PlanPageProps) {
  const [submitOpen, setSubmitOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { counts } = plan

  return (
    <main>
      <header style={{ display: "grid", gap: 4 }}>
        <h1 style={{ margin: 0 }}>{plan.title}</h1>
        <Text size={200}>
          {projectName}
          {branch ? ` · ${branch}` : ""}
        </Text>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Badge appearance="outline">{plan.kind}</Badge>
          <Text size={200}>
            Open {counts.open} · Answered {counts.answered} · Submitted {counts.submitted} ·
            Recorded {counts.recorded}
          </Text>
          {plan.archived ? <Badge color="subtle">Archived</Badge> : null}
        </div>
      </header>

      <ConnectionBanner status={connection} />
      {plan.orphaned ? (
        <MessageBar>
          <MessageBarBody>
            This plan&apos;s session ended. The next session takes it over without asking.
          </MessageBarBody>
        </MessageBar>
      ) : null}
      {plan.unarchivedAt ? (
        <MessageBar>
          <MessageBarBody>This plan was unarchived by a new publish.</MessageBarBody>
        </MessageBar>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBlock: 16 }}>
        <Button
          appearance="primary"
          disabled={plan.submitAll.ready.length === 0}
          onClick={() => setSubmitOpen(true)}
        >
          Submit all ready groups
        </Button>
        <Button appearance="secondary" onClick={() => onArchive(!plan.archived)}>
          {plan.archived ? "Unarchive" : "Archive"}
        </Button>
        <Button appearance="secondary" onClick={() => setDeleteOpen(true)}>
          Delete…
        </Button>
      </div>

      {plan.groups.map((group) => (
        <GroupSection
          key={group.key}
          group={group}
          onPatch={onPatch}
          onFlush={onFlush}
          onSubmit={onSubmitGroup}
        />
      ))}

      {plan.retired.length > 0 ? (
        <details>
          <summary>Retired questions</summary>
          {plan.retired.map((question) => (
            <QuestionCard key={question.key} question={question} disabled />
          ))}
        </details>
      ) : null}

      <SubmitDialog
        open={submitOpen}
        title="Submit answers"
        intro={`${projectName}${branch ? ` · ${branch}` : ""} · ${plan.title}`}
        ready={plan.submitAll.ready}
        skipped={plan.submitAll.skipped}
        confirmLabel="Submit"
        onConfirm={() => {
          setSubmitOpen(false)
          onSubmitAll()
        }}
        onClose={() => setSubmitOpen(false)}
      />
      <SubmitDialog
        open={deleteOpen}
        title="Delete plan"
        intro="This removes the plan file and its answers."
        ready={[]}
        skipped={[]}
        confirmLabel="Delete"
        onConfirm={() => {
          setDeleteOpen(false)
          onDelete()
        }}
        onClose={() => setDeleteOpen(false)}
      />
    </main>
  )
}
