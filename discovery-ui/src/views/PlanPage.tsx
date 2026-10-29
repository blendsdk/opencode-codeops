/**
 * The selected-group workspace and decision summary.
 *
 * The page owns the sticky action footer and the submission and delete
 * dialogs. Group navigation, the context rail, and the summary are separate
 * presentational components. All question values come from the draft overlay,
 * so a pending edit is visible before its save acknowledgement.
 *
 * @module views/PlanPage
 */

import { useState } from "react"
import {
  Badge,
  Button,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Text,
} from "@fluentui/react-components"

import { ConnectionBanner } from "./ConnectionBanner.tsx"
import { DecisionSummary } from "./DecisionSummary.tsx"
import { GroupSection } from "./GroupSection.tsx"
import { PlanNavigation } from "./PlanNavigation.tsx"
import { SubmitDialog } from "./SubmitDialog.tsx"
import { useWorkspaceStyles } from "./workspace-styles.ts"
import { applyDrafts, nextWorkspace, workspaceView } from "../workspace-model.ts"
import { formatRoute } from "../route.ts"
import type { WorkspaceTarget } from "../route.ts"
import type { PlanEventsState } from "../hooks.ts"
import type { EditorSnapshot, SubmitOutcome } from "../plan-editor.ts"
import type { PlanView } from "../view-models.ts"

/** Props for {@link PlanPage}. */
export interface PlanPageProps {
  plan: PlanView
  projectSlug: string
  projectName: string
  branch: string | null
  connection: PlanEventsState["status"]
  target: WorkspaceTarget
  notice: string | null
  /** A blocked-navigation message from the app shell. */
  navigationNotice?: string | null
  /** The destination that was blocked, used by "discard and leave". */
  navigationDestination?: string | null
  onDismissNavigationNotice?: () => void
  snapshot: EditorSnapshot
  navigationOpen: boolean
  onNavigationOpenChange: (open: boolean) => void
  onPatch: (key: string, patch: Record<string, unknown>) => void
  onFlush: () => void
  onDiscard: (key: string) => void
  onDiscardAll: () => void
  onSetIncomplete: (key: string, value: boolean, reason?: string) => void
  onRetry: (key?: string) => void
  onNavigate: (hash: string, options?: { replace?: boolean }) => void
  onSubmit: (group: string | null) => Promise<SubmitOutcome>
  onArchive: (archived: boolean) => void
  onDelete: () => void
  /** A plan-level action failure such as archive or delete. */
  actionError?: string | null
  onDismissActionError?: () => void
}

/** The user-facing label for the current save status. */
function saveLabel(snapshot: EditorSnapshot): string {
  if (snapshot.status === "saved") return "Saved"
  if (snapshot.status === "dirty") return "Unsaved changes"
  if (snapshot.status === "saving") return "Saving…"
  if (snapshot.status === "recheck") return "Recheck needed"
  return snapshot.lastError ?? Object.values(snapshot.errors)[0] ?? "Could not save"
}

/** Render one plan. */
export function PlanPage({
  plan,
  projectSlug,
  projectName,
  branch,
  connection,
  target,
  notice,
  navigationNotice = null,
  navigationDestination = null,
  onDismissNavigationNotice = () => {},
  snapshot,
  navigationOpen,
  onNavigationOpenChange,
  onPatch,
  onFlush,
  onDiscard,
  onDiscardAll,
  onSetIncomplete,
  onRetry,
  onNavigate,
  onSubmit,
  onArchive,
  onDelete,
  actionError = null,
  onDismissActionError = () => {},
}: PlanPageProps) {
  const styles = useWorkspaceStyles()
  const displayPlan = applyDrafts(plan, snapshot.drafts, snapshot.errors)
  const progress = workspaceView(displayPlan)
  const selectedGroup =
    target.kind === "group"
      ? displayPlan.groups.find((group) => group.key === target.key)
      : undefined
  const selectedProgress = selectedGroup
    ? progress.groups.find((group) => group.key === selectedGroup.key)
    : undefined
  const [submitTarget, setSubmitTarget] = useState<string | null | undefined>(undefined)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [submittedGroup, setSubmittedGroup] = useState<string | null>(null)

  const targetGroup =
    typeof submitTarget === "string"
      ? displayPlan.groups.find((group) => group.key === submitTarget)
      : undefined
  const canSubmitGroup = Boolean(selectedGroup?.ready) && !snapshot.submitting
  const canSubmitAll = displayPlan.submitAll.ready.length > 0 && !snapshot.submitting

  const openSubmit = (group: string | null) => {
    setDialogError(null)
    setSubmitTarget(group)
  }

  const confirmSubmit = async () => {
    if (submitTarget === undefined) return
    const previous = submitTarget
    setBusy(true)
    setDialogError(null)
    const outcome = await onSubmit(previous)
    setBusy(false)
    if (outcome.ok) {
      setSubmitTarget(undefined)
      if (typeof previous === "string") setSubmittedGroup(previous)
      return
    }
    setDialogError(outcome.message ?? "Submission failed.")
  }

  const continueToNext = () => {
    if (!selectedGroup) return
    const next = nextWorkspace(displayPlan, selectedGroup.key)
    onNavigate(
      formatRoute({
        view: "plan",
        project: projectSlug,
        plan: plan.slug,
        target: next,
      }),
    )
  }

  return (
    <main id="main-content">
      <div className={styles.body}>
        <PlanNavigation
          plan={displayPlan}
          projectSlug={projectSlug}
          projectName={projectName}
          branch={branch}
          target={target}
          progress={progress}
          open={navigationOpen}
          onOpenChange={onNavigationOpenChange}
        />

        <div className={styles.content}>
          <header className={styles.heading}>
            <Text className={styles.positionLabel}>
              {selectedGroup
                ? `Group ${displayPlan.groups.findIndex((group) => group.key === selectedGroup.key) + 1} of ${displayPlan.groups.length}`
                : "Decision summary"}
            </Text>
            <h1 className={styles.title}>{displayPlan.title}</h1>
            <div className={styles.groupHeader}>
              <Badge appearance="outline">{displayPlan.kind}</Badge>
              <Text size={200}>
                {progress.answeredQuestions} of {progress.visibleQuestions} answered ·{" "}
                {progress.completedGroups} of {progress.totalGroups} groups complete
              </Text>
              {displayPlan.archived ? <Badge color="subtle">Archived</Badge> : null}
            </div>
            {selectedGroup ? (
              <h2 className={styles.groupTitle}>{selectedGroup.title}</h2>
            ) : (
              <h2 className={styles.groupTitle}>Decision summary</h2>
            )}
            {selectedGroup?.description ? (
              <Text size={200} className={styles.muted}>
                {selectedGroup.description}
              </Text>
            ) : null}
          </header>

          <ConnectionBanner status={connection} />
          {notice ? (
            <MessageBar intent="warning">
              <MessageBarBody>{notice}</MessageBarBody>
            </MessageBar>
          ) : null}
          {navigationNotice ? (
            <MessageBar intent="warning">
              <MessageBarBody>{navigationNotice}</MessageBarBody>
              <MessageBarActions>
                {!snapshot.recheckRequired ? (
                  <Button size="small" onClick={() => onRetry()}>
                    Retry save
                  </Button>
                ) : null}
                <Button size="small" onClick={() => setLeaveOpen(true)}>
                  Leave without saving
                </Button>
                <Button size="small" onClick={onDismissNavigationNotice}>
                  Dismiss
                </Button>
              </MessageBarActions>
            </MessageBar>
          ) : null}
          {displayPlan.orphaned ? (
            <MessageBar>
              <MessageBarBody>
                This plan&apos;s session ended. The next session takes it over without asking.
              </MessageBarBody>
            </MessageBar>
          ) : null}
          {displayPlan.unarchivedAt ? (
            <MessageBar>
              <MessageBarBody>This plan was unarchived by a new publish.</MessageBarBody>
            </MessageBar>
          ) : null}
          {snapshot.lastError ? (
            <MessageBar intent="error">
              <MessageBarBody>{snapshot.lastError}</MessageBarBody>
            </MessageBar>
          ) : null}
          {actionError ? (
            <MessageBar intent="error">
              <MessageBarBody>{actionError}</MessageBarBody>
              <MessageBarActions>
                <Button size="small" onClick={onDismissActionError}>
                  Dismiss
                </Button>
              </MessageBarActions>
            </MessageBar>
          ) : null}

          {selectedGroup ? (
            <GroupSection
              group={selectedGroup}
              discardVersions={snapshot.discardVersion}
              discardAllVersion={snapshot.discardAllVersion}
              onPatch={onPatch}
              onFlush={onFlush}
              onDiscard={onDiscard}
              onSetIncomplete={onSetIncomplete}
              onRetry={onRetry}
              retryDisabled={snapshot.recheckRequired}
            />
          ) : (
            <DecisionSummary
              plan={displayPlan}
              projectSlug={projectSlug}
              progress={progress}
              drafts={snapshot.drafts}
              incomplete={snapshot.incomplete}
              errors={snapshot.errors}
              onDiscard={onDiscard}
              onRetry={onRetry}
              retryDisabled={snapshot.recheckRequired}
            />
          )}

          <footer className={styles.footer}>
            <div className={styles.footerGrow}>
              <Text weight="semibold">{saveLabel(snapshot)}</Text>
              {snapshot.unsaved ? (
                <Text block size={200} className={styles.muted}>
                  Unsaved work is kept while you change views.
                </Text>
              ) : null}
              {selectedGroup && !selectedGroup.ready ? (
                <Text block size={200}>
                  Missing: {selectedGroup.missingLabel}
                </Text>
              ) : null}
              {snapshot.recheckRequired ? (
                <Text block size={200}>
                  Review the server state, then re-confirm or discard the draft.
                </Text>
              ) : null}
              {snapshot.missing.length > 0 ? (
                <>
                  <Text block size={200} weight="semibold">
                    Skipped groups:
                  </Text>
                  {snapshot.missing.map((entry) => (
                    <Text key={entry.group} block size={200}>
                      {entry.group}
                    </Text>
                  ))}
                </>
              ) : null}
            </div>
            <div className={styles.actionRow}>
              {selectedGroup ? (
                <>
                  <Button
                    appearance="secondary"
                    disabled={!canSubmitGroup || busy}
                    onClick={() => openSubmit(selectedGroup.key)}
                  >
                    Submit group
                  </Button>
                  {submittedGroup === selectedGroup.key || selectedProgress?.complete ? (
                    <Button appearance="primary" onClick={continueToNext}>
                      Continue
                    </Button>
                  ) : null}
                </>
              ) : (
                <Button
                  appearance="primary"
                  disabled={!canSubmitAll || busy}
                  onClick={() => openSubmit(null)}
                >
                  Submit all ready groups
                </Button>
              )}
              <Button appearance="secondary" onClick={() => onArchive(!displayPlan.archived)}>
                {displayPlan.archived ? "Unarchive" : "Archive"}
              </Button>
              <Button appearance="secondary" onClick={() => setDeleteOpen(true)}>
                Delete…
              </Button>
            </div>
          </footer>
        </div>

        <aside className={styles.rail} aria-label="Plan progress">
          <Text weight="semibold">Progress</Text>
          <Text size={200}>
            {progress.completedGroups} of {progress.totalGroups} groups complete
          </Text>
          <Text size={200}>
            {progress.answeredQuestions} of {progress.visibleQuestions} questions answered
          </Text>
          <Text size={200} className={styles.muted}>
            {selectedGroup
              ? selectedProgress?.ready
                ? "This group is ready to submit."
                : `Missing: ${selectedGroup.missingLabel}`
              : "Choose a group to continue."}
          </Text>
          {snapshot.delivery ? (
            <Text size={200}>
              Last submission:{" "}
              {snapshot.delivery === "woken"
                ? "the agent was woken."
                : "delivery is pending."}
            </Text>
          ) : null}
        </aside>
      </div>

      <SubmitDialog
        open={submitTarget !== undefined}
        title={targetGroup ? `Submit ${targetGroup.title}` : "Submit answers"}
        intro={`${projectName}${branch ? ` · ${branch}` : ""} · ${displayPlan.title}`}
        ready={targetGroup ? [targetGroup.key] : displayPlan.submitAll.ready}
        skipped={targetGroup ? [] : displayPlan.submitAll.skipped}
        confirmLabel="Submit"
        error={dialogError}
        busy={busy}
        onConfirm={() => void confirmSubmit()}
        onClose={() => {
          setSubmitTarget(undefined)
          setDialogError(null)
        }}
      />
      <SubmitDialog
        open={leaveOpen}
        title="Leave without saving"
        intro="Your unsent changes will be discarded and the destination will open."
        ready={[]}
        skipped={[]}
        confirmLabel="Leave"
        onConfirm={() => {
          setLeaveOpen(false)
          onDiscardAll()
          if (navigationDestination !== null) onNavigate(navigationDestination)
        }}
        onClose={() => setLeaveOpen(false)}
      />
      <SubmitDialog
        open={deleteOpen}
        title="Delete plan"
        intro={
          snapshot.unsaved
            ? "This removes the plan file and its answers. Unsaved changes will be discarded."
            : "This removes the plan file and its answers."
        }
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
