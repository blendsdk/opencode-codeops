/**
 * The group navigation for one plan.
 *
 * Desktop renders a sticky column; narrow screens render the same links in an
 * overlay drawer. Every destination is a real link, so the browser's history
 * and the app's save boundary stay in charge of navigation.
 *
 * @module views/PlanNavigation
 */

import {
  Badge,
  Nav,
  NavDrawer,
  NavDrawerBody,
  NavDrawerHeader,
  NavItem,
  Text,
} from "@fluentui/react-components"
import { LockClosedRegular } from "@fluentui/react-icons"

import { useWorkspaceStyles } from "./workspace-styles.ts"
import { formatRoute } from "../route.ts"
import type { WorkspaceTarget } from "../route.ts"
import type { PlanView } from "../view-models.ts"
import type { WorkspaceView } from "../workspace-model.ts"

/** Props for {@link PlanNavigation}. */
export interface PlanNavigationProps {
  plan: PlanView
  projectSlug: string
  projectName: string
  branch: string | null
  target: WorkspaceTarget
  progress: WorkspaceView
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The selected Nav value, namespaced by destination kind. */
function selectedValue(target: WorkspaceTarget): string {
  return target.kind === "group" ? `group:${target.key}` : "summary"
}

/** Build the group and summary links shared by desktop and the drawer. */
function NavigationItems({
  plan,
  projectSlug,
  target,
  progress,
  onSelect,
}: {
  plan: PlanView
  projectSlug: string
  target: WorkspaceTarget
  progress: WorkspaceView
  onSelect: () => void
}) {
  const styles = useWorkspaceStyles()
  return (
    <Nav aria-label="Plan groups" selectedValue={selectedValue(target)}>
      {plan.groups.map((group) => {
        const groupProgress = progress.groups.find((entry) => entry.key === group.key)
        const href = formatRoute({
          view: "plan",
          project: projectSlug,
          plan: plan.slug,
          target: { kind: "group", key: group.key },
        })
        return (
          <NavItem
            key={group.key}
            value={`group:${group.key}`}
            href={href}
            icon={group.locked ? <LockClosedRegular aria-hidden /> : undefined}
            onClick={onSelect}
          >
            <span className={styles.navItemLabel}>
              <span>{group.title}</span>
              <span>
                {group.locked ? <Badge size="small">Locked</Badge> : null}
                {groupProgress?.empty ? <Badge size="small">No visible questions</Badge> : null}
                {groupProgress?.complete ? <Badge size="small">Complete</Badge> : null}
                {!groupProgress?.empty && !groupProgress?.complete ? (
                  <Badge size="small" appearance="tint">
                    {groupProgress?.readyCount ?? 0}/{groupProgress?.pendingCount ?? 0}
                  </Badge>
                ) : null}
              </span>
            </span>
          </NavItem>
        )
      })}
      <NavItem
        value="summary"
        href={formatRoute({
          view: "plan",
          project: projectSlug,
          plan: plan.slug,
          target: { kind: "summary" },
        })}
        onClick={onSelect}
      >
        Decision summary
      </NavItem>
    </Nav>
  )
}

/** Render the plan navigation in its desktop and narrow-screen forms. */
export function PlanNavigation({
  plan,
  projectSlug,
  projectName,
  branch,
  target,
  progress,
  open,
  onOpenChange,
}: PlanNavigationProps) {
  const styles = useWorkspaceStyles()
  const header = (
    <div>
      <Text weight="semibold">{projectName}</Text>
      {branch ? (
        <Text block size={200} className={styles.muted}>
          {branch}
        </Text>
      ) : null}
      <Text block size={200} className={styles.progressText}>
        {progress.completedGroups} of {progress.totalGroups} groups complete ·{" "}
        {progress.answeredQuestions} of {progress.visibleQuestions} answered
      </Text>
    </div>
  )
  return (
    <>
      <aside id="plan-navigation-desktop" className={styles.nav}>
        {header}
        <NavigationItems
          plan={plan}
          projectSlug={projectSlug}
          target={target}
          progress={progress}
          onSelect={() => undefined}
        />
      </aside>
      <NavDrawer
        open={open}
        onOpenChange={(_, data) => onOpenChange(data.open)}
        type="overlay"
      >
        <NavDrawerHeader>
          <Text weight="semibold">Groups</Text>
        </NavDrawerHeader>
        <NavDrawerBody>
          <div id="plan-navigation">
            {header}
            <NavigationItems
              plan={plan}
              projectSlug={projectSlug}
              target={target}
              progress={progress}
              onSelect={() => onOpenChange(false)}
            />
          </div>
        </NavDrawerBody>
      </NavDrawer>
    </>
  )
}
