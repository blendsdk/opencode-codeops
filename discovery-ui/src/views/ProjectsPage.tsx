/**
 * The projects list: one section per repository, one row per checkout.
 *
 * @module views/ProjectsPage
 */

import { Badge, Text } from "@fluentui/react-components"

import type { ProjectsView } from "../view-models.ts"

/** Props for {@link ProjectsPage}. */
export interface ProjectsPageProps {
  view: ProjectsView
}

/** Render the projects list. */
export function ProjectsPage({ view }: ProjectsPageProps) {
  return (
    <main>
      <h1>Projects</h1>
      {view.repositories.length === 0 ? <Text>No opted-in projects yet.</Text> : null}
      {view.repositories.map((repository) => (
        <section key={repository.canonical} aria-label={repository.name}>
          <h2>{repository.name}</h2>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
            {repository.projects.map((project) => (
              <li
                key={project.slug}
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
                <a href={`#/p/${project.slug}`}>{project.name}</a>
                {project.branch ? <Badge appearance="outline">{project.branch}</Badge> : null}
                <Text size={200}>{project.countsLabel}</Text>
                {project.liveBadge ? (
                  <Badge appearance="tint" color="warning">
                    {project.liveBadge}
                  </Badge>
                ) : (
                  <Badge appearance="tint" color="success">
                    Live
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
