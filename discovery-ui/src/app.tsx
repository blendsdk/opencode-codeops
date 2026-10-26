/**
 * The Discovery application shell.
 *
 * `App` takes the route and the API client as props, so it renders the same
 * way in the browser and in a server-side test. Pages fetch only when the
 * caller did not pass `initial` data; with initial data the first render is
 * synchronous. The shell owns the polite live region that announces save and
 * submit outcomes.
 *
 * @module app
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Button,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Text,
} from "@fluentui/react-components"

import { PlanPage } from "./views/PlanPage.tsx"
import { ProjectPage } from "./views/ProjectPage.tsx"
import { ProjectsPage } from "./views/ProjectsPage.tsx"
import { usePlanEvents } from "./hooks.ts"
import { planView, projectsView } from "./view-models.ts"
import type { PlanRecordLike } from "./view-models.ts"
import type {
  DiscoveryApi,
  PlanSummaryInfo,
  ProjectInfo,
  ProjectsResponse,
} from "./api.ts"
import type { Route } from "./route.ts"

/** Data the caller can pass to skip the first fetch. */
export interface InitialData {
  repositories?: ProjectsResponse["repositories"]
  project?: ProjectInfo
  plans?: PlanSummaryInfo[]
  plan?: PlanRecordLike
}

/** Props for {@link App}. */
export interface AppProps {
  route: Route
  api: DiscoveryApi
  initial?: InitialData
}

/** Render a short error bar with an optional dismiss action. */
function ErrorBar({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <MessageBar intent="error">
      <MessageBarBody>{message}</MessageBarBody>
      {onDismiss ? (
        <MessageBarActions>
          <Button size="small" onClick={onDismiss}>
            Dismiss
          </Button>
        </MessageBarActions>
      ) : null}
    </MessageBar>
  )
}

/** The projects route. */
function ProjectsRoute({ api, initial }: { api: DiscoveryApi; initial?: InitialData }) {
  const [repositories, setRepositories] = useState(initial?.repositories ?? null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (repositories !== null) return
    let cancelled = false
    void api.listProjects().then((result) => {
      if (cancelled) return
      if (result.ok) setRepositories(result.data.repositories)
      else setError(result.message)
    })
    return () => {
      cancelled = true
    }
  }, [api, repositories])

  if (error !== null) return <ErrorBar message={error} />
  if (repositories === null) return <Text>Loading…</Text>
  return <ProjectsPage view={projectsView(repositories)} />
}

/** The project route. */
function ProjectRoute({
  api,
  route,
  initial,
}: {
  api: DiscoveryApi
  route: Extract<Route, { view: "project" }>
  initial?: InitialData
}) {
  const [data, setData] = useState(
    initial?.project && initial?.plans
      ? { project: initial.project, plans: initial.plans }
      : null,
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (data !== null) return
    let cancelled = false
    void api.getProject(route.project).then((result) => {
      if (cancelled) return
      if (result.ok) setData(result.data)
      else setError(result.message)
    })
    return () => {
      cancelled = true
    }
  }, [api, data, route.project])

  if (error !== null) return <ErrorBar message={error} />
  if (data === null) return <Text>Loading…</Text>
  return <ProjectPage project={data.project} plans={data.plans} />
}

/** The plan route. */
function PlanRoute({
  api,
  route,
  initial,
  announce,
}: {
  api: DiscoveryApi
  route: Extract<Route, { view: "plan" }>
  initial?: InitialData
  announce: (message: string) => void
}) {
  const [plan, setPlan] = useState(initial?.plan ?? null)
  const [project, setProject] = useState(initial?.project ?? null)
  const [error, setError] = useState<string | null>(null)
  const planRef = useRef(plan)
  planRef.current = plan
  const pending = useRef<{ key: string; patch: Record<string, unknown> } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const announceRef = useRef(announce)
  announceRef.current = announce

  const load = useCallback(async () => {
    const result = await api.getPlan(route.project, route.plan)
    if (result.ok) {
      setPlan(result.data.plan)
      setProject(result.data.project)
      setError(null)
    } else {
      setError(result.message)
    }
  }, [api, route.project, route.plan])

  useEffect(() => {
    if (plan === null || project === null) void load()
  }, [plan, project, load])

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  const sendPatch = useCallback(
    async (key: string, answerPatch: Record<string, unknown>) => {
      const current = planRef.current
      if (current === null) return
      const result = await api.saveAnswer(
        route.project,
        route.plan,
        key,
        current.revision,
        answerPatch,
      )
      if (result.ok) {
        setPlan(result.data.plan)
        setError(null)
        announceRef.current("Saved")
        return
      }
      if (result.kind === "stale" || result.kind === "read-only" || result.kind === "locked") {
        await load()
        setError(null)
        return
      }
      setError(result.message)
      announceRef.current(result.message)
    },
    [api, route.project, route.plan, load],
  )

  const flush = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const item = pending.current
    pending.current = null
    if (item !== null) void sendPatch(item.key, item.patch)
  }, [sendPatch])

  const patch = (key: string, answerPatch: Record<string, unknown>) => {
    const answer = answerPatch.answer
    const textLike =
      "notes" in answerPatch ||
      "defer" in answerPatch ||
      (answer !== null &&
        typeof answer === "object" &&
        ("text" in answer || "other" in answer))
    if (!textLike) {
      flush()
      void sendPatch(key, answerPatch)
      return
    }
    pending.current = { key, patch: answerPatch }
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      const item = pending.current
      pending.current = null
      if (item !== null) void sendPatch(item.key, item.patch)
    }, 500)
  }

  const events = usePlanEvents(
    initial === undefined
      ? `/api/projects/${encodeURIComponent(route.project)}/plans/${encodeURIComponent(route.plan)}/events`
      : null,
    () => void load(),
    () => void load(),
  )

  const submit = async (group: string | null) => {
    const current = planRef.current
    if (current === null) return
    const result = await api.submit(route.project, route.plan, group, current.revision)
    if (result.ok) {
      announceRef.current("Submitted")
      setError(null)
      await load()
      return
    }
    setError(result.message)
    announceRef.current(result.message)
  }

  if (error !== null && (plan === null || project === null)) {
    return <ErrorBar message={error} onDismiss={() => setError(null)} />
  }
  if (plan === null || project === null) return <Text>Loading…</Text>

  const view = planView(plan)
  return (
    <>
      {error !== null ? <ErrorBar message={error} onDismiss={() => setError(null)} /> : null}
      <PlanPage
        plan={view}
        projectName={project.name ?? route.project}
        branch={project.branch ?? null}
        connection={events.status}
        onPatch={patch}
        onFlush={flush}
        onSubmitGroup={(group) => void submit(group)}
        onSubmitAll={() => void submit(null)}
        onArchive={(archived) => {
          void api.archive(route.project, route.plan, archived).then((result) => {
            if (result.ok) {
              announceRef.current(archived ? "Archived" : "Unarchived")
              setError(null)
              void load()
            } else {
              setError(result.message)
            }
          })
        }}
        onDelete={() => {
          void api.deletePlan(route.project, route.plan).then((result) => {
            if (result.ok) {
              announceRef.current("Plan deleted")
              window.location.hash = `#/p/${route.project}`
            } else {
              setError(result.message)
            }
          })
        }}
      />
    </>
  )
}

/** Render the shell and the routed view. */
export function App({ route, api, initial }: AppProps) {
  const [announcement, setAnnouncement] = useState("")
  const projectSlug = route.view === "project" || route.view === "plan" ? route.project : null
  const projectName =
    route.view === "plan" || route.view === "project"
      ? initial?.project?.name ?? projectSlug
      : null
  const planTitle = route.view === "plan" ? initial?.plan?.title ?? route.plan : null

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24, display: "grid", gap: 16 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href="#/">Projects</a>
        {projectName !== null ? <span>›</span> : null}
        {projectName !== null ? <a href={`#/p/${projectSlug}`}>{projectName}</a> : null}
        {planTitle !== null ? <span>›</span> : null}
        {planTitle !== null ? <span>{planTitle}</span> : null}
      </nav>
      <div aria-live="polite" role="status" style={{ minHeight: 20 }}>
        {announcement}
      </div>
      {route.view === "projects" ? <ProjectsRoute api={api} initial={initial} /> : null}
      {route.view === "project" ? (
        <ProjectRoute key={route.project} api={api} route={route} initial={initial} />
      ) : null}
      {route.view === "plan" ? (
        <PlanRoute
          key={`${route.project}/${route.plan}`}
          api={api}
          route={route}
          initial={initial}
          announce={setAnnouncement}
        />
      ) : null}
      {route.view === "not-found" ? (
        <main>
          <h1>Not found</h1>
          <Text>
            That page does not exist. <a href="#/">Back to projects</a>
          </Text>
        </main>
      ) : null}
    </div>
  )
}
