/**
 * One project: its metadata and the plans published for it.
 *
 * @module views/ProjectPage
 */

import { useState } from "react"
import { Badge, Switch, Text } from "@fluentui/react-components"

import type { PlanSummaryInfo, ProjectInfo } from "../api.ts"

/** Props for {@link ProjectPage}. */
export interface ProjectPageProps {
  project: ProjectInfo
  plans: PlanSummaryInfo[]
}

/** Render one project and its plan rows. */
export function ProjectPage({ project, plans }: ProjectPageProps) {
  const [showArchived, setShowArchived] = useState(false)
  const visible = showArchived ? plans : plans.filter((plan) => !plan.archived)
  return (
    <main id="main-content" tabIndex={-1}>
      <h1>{project.name}</h1>
      <Text size={200}>
        {project.slug}
        {project.branch ? ` · ${project.branch}` : ""}
      </Text>
      <Switch
        checked={showArchived}
        label="Show archived plans"
        onChange={(_, data) => setShowArchived(data.checked)}
      />
      {visible.length === 0 ? <Text>No plans published yet.</Text> : null}
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
        {visible.map((plan) => (
          <li
            key={plan.slug}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              border: "1px solid var(--colorNeutralStroke2)",
              borderRadius: 8,
              padding: 12,
            }}
          >
            <a href={`#/p/${project.slug}/${plan.slug}`}>{plan.title}</a>
            <Badge appearance="outline">{plan.kind}</Badge>
            <Text size={200}>
              {plan.counts.open ?? 0} open · {plan.counts.answered ?? 0} answered
            </Text>
            {plan.orphaned ? <Badge color="warning">Orphaned</Badge> : null}
            {plan.archived ? <Badge color="subtle">Archived</Badge> : null}
            <Text size={100}>{plan.updatedAt}</Text>
          </li>
        ))}
      </ul>
    </main>
  )
}
