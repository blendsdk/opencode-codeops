/**
 * The Discovery application shell.
 *
 * `App` takes the route and the API client as props, so it renders the same
 * way in the browser and in a server-side test. Pages fetch only when the
 * caller did not pass `initial` data; with initial data the first render is
 * synchronous.
 *
 * The shell owns the requested/displayed route boundary, the polite live
 * region, and the one navigation gate. A mounted plan registers its save
 * boundary; every route change waits for that boundary before the new page is
 * displayed.
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

import { DiscoveryHeader } from "./views/DiscoveryHeader.tsx"
import { PlanPage } from "./views/PlanPage.tsx"
import { ProjectPage } from "./views/ProjectPage.tsx"
import { ProjectsPage } from "./views/ProjectsPage.tsx"
import { usePlanEvents, useUnloadGuard } from "./hooks.ts"
import { createNavigationGate } from "./navigation.ts"
import { createPlanEditor, shouldWarnBeforeUnload } from "./plan-editor.ts"
import { formatRoute, parseRoute } from "./route.ts"
import { selectWorkspace } from "./workspace-model.ts"
import { planView, projectsView } from "./view-models.ts"
import { useWorkspaceStyles } from "./views/workspace-styles.ts"
import type { EditorSnapshot, PlanEditor, PlanPatch } from "./plan-editor.ts"
import type { PlanRecordLike } from "./view-models.ts"
import type { HeaderIdentity } from "./views/DiscoveryHeader.tsx"
import type { ThemePreference } from "./theme.ts"
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

/** Optional browser-owned state. Tests and SSR omit it. */
export interface AppShell {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
  navigationOpen: boolean
  setNavigationOpen: (open: boolean) => void
  identity: HeaderIdentity
  setIdentity: (identity: HeaderIdentity) => void
}

/** Props for {@link App}. */
export interface AppProps {
  route: Route
  api: DiscoveryApi
  initial?: InitialData
  shell?: AppShell
  /** Writes the browser hash; omitted in SSR and render tests. */
  navigate?: (hash: string, options?: { replace?: boolean }) => void
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
function ProjectsRoute({
  api,
  initial,
  onIdentity,
}: {
  api: DiscoveryApi
  initial?: InitialData
  onIdentity: (identity: HeaderIdentity) => void
}) {
  const [repositories, setRepositories] = useState(initial?.repositories ?? null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onIdentity({ projectName: null, planTitle: null })
  }, [onIdentity])

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

  if (error !== null) {
    return (
      <main id="main-content" tabIndex={-1}>
        <ErrorBar message={error} />
      </main>
    )
  }
  if (repositories === null) {
    return (
      <main id="main-content" tabIndex={-1}>
        <Text>Loading…</Text>
      </main>
    )
  }
  return <ProjectsPage view={projectsView(repositories)} />
}

/** The project route. */
function ProjectRoute({
  api,
  route,
  initial,
  onIdentity,
}: {
  api: DiscoveryApi
  route: Extract<Route, { view: "project" }>
  initial?: InitialData
  onIdentity: (identity: HeaderIdentity) => void
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

  useEffect(() => {
    if (data !== null) {
      onIdentity({ projectName: data.project.name ?? route.project, planTitle: null })
    }
  }, [data, onIdentity, route.project])

  if (error !== null) {
    return (
      <main id="main-content" tabIndex={-1}>
        <ErrorBar message={error} />
      </main>
    )
  }
  if (data === null) {
    return (
      <main id="main-content" tabIndex={-1}>
        <Text>Loading…</Text>
      </main>
    )
  }
  return <ProjectPage project={data.project} plans={data.plans} />
}

/** The plan route. */
function PlanRoute({
  api,
  route,
  initial,
  announce,
  shell,
  navigate,
  replaceRoute,
  registerBoundary,
  navigationNotice,
  navigationDestination,
  onDismissNavigationNotice,
}: {
  api: DiscoveryApi
  route: Extract<Route, { view: "plan" }>
  initial?: InitialData
  announce: (message: string) => void
  shell?: AppShell
  navigate: (hash: string, options?: { replace?: boolean }) => void
  replaceRoute: (hash: string) => void
  registerBoundary: (flush: (() => Promise<boolean>) | null) => void
  navigationNotice: string | null
  navigationDestination: string | null
  onDismissNavigationNotice: () => void
}) {
  const [actionError, setActionError] = useState<string | null>(null)
  const snapshotRef = useRef<(snapshot: EditorSnapshot) => void>(() => undefined)

  const [editor] = useState<PlanEditor>(() => {
    const initialResponse =
      initial?.plan === undefined
        ? undefined
        : {
            project:
              initial.project ?? {
                slug: route.project,
                name: route.project,
                branch: null,
                directory: "",
              },
            plan: initial.plan,
          }
    return createPlanEditor({
      project: route.project,
      plan: route.plan,
      api,
      initial: initialResponse,
      onChange: (next) => snapshotRef.current(next),
    })
  })
  const [snapshot, setSnapshot] = useState<EditorSnapshot>(() => editor.snapshot())
  snapshotRef.current = setSnapshot
  useUnloadGuard(shouldWarnBeforeUnload(snapshot))

  useEffect(() => {
    registerBoundary(() => editor.flush())
    return () => registerBoundary(null)
  }, [editor, registerBoundary])

  useEffect(() => {
    return () => editor.dispose()
  }, [editor])

  const needsFetch = initial?.plan === undefined || initial?.project === undefined

  useEffect(() => {
    // A partial initial payload still needs the full project/plan response.
    if (needsFetch) void editor.refresh()
  }, [editor, needsFetch])

  const events = usePlanEvents(
    needsFetch
      ? `/api/projects/${encodeURIComponent(route.project)}/plans/${encodeURIComponent(route.plan)}/events`
      : null,
    () => void editor.refresh(),
    () => void editor.refresh(),
  )

  useEffect(() => {
    const identity: HeaderIdentity = {
      projectName: snapshot.server?.project?.name ?? initial?.project?.name ?? null,
      planTitle: snapshot.server?.plan.title ?? initial?.plan?.title ?? null,
    }
    shell?.setIdentity(identity)
  }, [
    initial?.plan?.title,
    initial?.project?.name,
    shell?.setIdentity,
    snapshot.server?.plan.title,
    snapshot.server?.project?.name,
  ])

  const view = snapshot.server === null ? null : planView(snapshot.server.plan)
  const selection = view === null ? null : selectWorkspace(view, route.target)
  const targetSignature =
    route.target === undefined
      ? "none"
      : route.target.kind === "group"
        ? `group:${route.target.key}`
        : "summary"
  const normalizedRef = useRef<string | null>(null)

  useEffect(() => {
    if (view === null || selection === null || !selection.replace) return
    const signature = `${view.revision}:${targetSignature}`
    if (normalizedRef.current === signature) return
    normalizedRef.current = signature
    replaceRoute(
      formatRoute({
        view: "plan",
        project: route.project,
        plan: route.plan,
        target: selection.target,
      }),
    )
  }, [replaceRoute, route.plan, route.project, selection, targetSignature, view])

  const archive = async (archived: boolean) => {
    const saved = await editor.flush()
    if (!saved) {
      setActionError("Save your changes before archiving.")
      announce("Save your changes before archiving.")
      return
    }
    const result = await api.archive(route.project, route.plan, archived)
    if (result.ok) {
      announce(archived ? "Archived" : "Unarchived")
      setActionError(null)
      await editor.refresh()
      return
    }
    setActionError(result.message)
  }

  const remove = async () => {
    const result = await api.deletePlan(route.project, route.plan)
    if (result.ok) {
      editor.discardAll()
      editor.dispose()
      announce("Plan deleted")
      replaceRoute(`#/p/${encodeURIComponent(route.project)}`)
      return
    }
    setActionError(result.message)
  }

  if (snapshot.deleted) {
    return (
      <main id="main-content" tabIndex={-1}>
        <h1>Plan deleted</h1>
        <Text>This plan no longer exists. Any unsent draft was kept locally until you discard it.</Text>
        <div>
          <a
            href="#/"
            onClick={(event) => {
              event.preventDefault()
              editor.discardAll()
              replaceRoute("#/")
            }}
          >
            Back to plans
          </a>
          <Button appearance="secondary" onClick={() => editor.discardAll()}>
            Discard draft
          </Button>
        </div>
      </main>
    )
  }

  if (snapshot.server === null) {
    if (snapshot.lastError !== null) {
      return (
        <main id="main-content" tabIndex={-1}>
          <ErrorBar message={snapshot.lastError} onDismiss={() => setActionError(null)} />
          <Button appearance="primary" onClick={() => void editor.refresh()}>
            Retry
          </Button>
        </main>
      )
    }
    return (
      <main id="main-content" tabIndex={-1}>
        <Text>Loading…</Text>
      </main>
    )
  }

  if (view === null || selection === null) {
    return (
      <main id="main-content" tabIndex={-1}>
        <Text>Loading…</Text>
      </main>
    )
  }

  return (
    <PlanPage
      plan={view}
      projectSlug={route.project}
      projectName={snapshot.server.project.name ?? route.project}
      branch={snapshot.server.project.branch ?? null}
      connection={events.status}
      target={selection.target}
      notice={selection.notice}
      navigationNotice={navigationNotice}
      navigationDestination={navigationDestination}
      onDismissNavigationNotice={onDismissNavigationNotice}
      snapshot={snapshot}
      navigationOpen={shell?.navigationOpen ?? false}
      onNavigationOpenChange={shell?.setNavigationOpen ?? (() => undefined)}
      onPatch={(key, patch) => editor.edit(key, patch as PlanPatch)}
      onFlush={() => void editor.flush()}
      onDiscard={(key) => editor.discard(key)}
      onDiscardAll={() => editor.discardAll()}
      onSetIncomplete={(key, value, reason) => editor.setIncomplete(key, value, reason)}
      onRetry={(key) => void editor.retry(key)}
      onNavigate={navigate}
      onSubmit={(group) => editor.submit(group)}
      onArchive={(archived) => void archive(archived)}
      onDelete={() => void remove()}
      onAnnounce={announce}
      actionError={actionError}
      onDismissActionError={() => setActionError(null)}
    />
  )
}

/** Render the shell and the displayed view. */
export function App({ route, api, initial, shell, navigate }: AppProps) {
  const styles = useWorkspaceStyles()
  const [announcement, setAnnouncement] = useState("")
  const [navigationNotice, setNavigationNotice] = useState<string | null>(null)
  const [navigationDestination, setNavigationDestination] = useState<string | null>(null)
  const [displayedRoute, setDisplayedRoute] = useState<Route>(route)
  const [fallbackIdentity, setFallbackIdentity] = useState<HeaderIdentity>({
    projectName:
      initial?.project?.name ??
      (route.view === "plan" || route.view === "project" ? route.project : null),
    planTitle: initial?.plan?.title ?? (route.view === "plan" ? route.plan : null),
  })
  const displayedHashRef = useRef(formatRoute(route))
  const propHashRef = useRef(formatRoute(route))
  const pendingRouteRef = useRef<Route | null>(null)
  const boundaryRef = useRef<(() => Promise<boolean>) | null>(null)
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  const gateRef = useRef<ReturnType<typeof createNavigationGate> | null>(null)
  if (gateRef.current === null) {
    gateRef.current = createNavigationGate({
      flush: () => boundaryRef.current?.() ?? Promise.resolve(true),
      write: (hash, options) => {
        const current =
          typeof window === "undefined" ? "" : window.location.hash || "#/"
        if (current === hash) return
        navigateRef.current?.(hash, options)
      },
      current: () => displayedHashRef.current,
    })
  }

  /** Commit a destination only after the mounted plan is clean. */
  const requestNavigation = useCallback(
    (hash: string, options?: { replace?: boolean }) => {
      if (navigate === undefined) return
      const target = parseRoute(hash)
      if (formatRoute(target) === displayedHashRef.current) return
      pendingRouteRef.current = target
      gateRef.current?.request(hash, options)
      void gateRef.current?.settle().then((settled) => {
        const pending = pendingRouteRef.current
        if (!settled || pending === null) {
          pendingRouteRef.current = null
          if (!settled) {
            const message =
              "Your changes are not saved yet. Retry the save or discard the draft before leaving."
            setNavigationNotice(message)
            setNavigationDestination(hash)
            setAnnouncement(message)
          }
          return
        }
        if (formatRoute(pending) !== hash) return
        pendingRouteRef.current = null
        setNavigationNotice(null)
        setNavigationDestination(null)
        displayedHashRef.current = hash
        setDisplayedRoute(pending)
      })
    },
    [navigate],
  )

  /** Normalize the initial destination without running the save boundary. */
  const replaceRoute = useCallback((hash: string) => {
    const next = parseRoute(hash)
    displayedHashRef.current = hash
    propHashRef.current = hash
    setDisplayedRoute(next)
    navigateRef.current?.(hash, { replace: true })
  }, [])

  const registerBoundary = useCallback((flush: (() => Promise<boolean>) | null) => {
    boundaryRef.current = flush
  }, [])

  const routeHash = formatRoute(route)
  useEffect(() => {
    if (routeHash === propHashRef.current) return
    propHashRef.current = routeHash
    if (routeHash === displayedHashRef.current) return
    requestNavigation(routeHash)
  }, [requestNavigation, routeHash])

  const identity = shell?.identity ?? fallbackIdentity
  const setIdentity = shell?.setIdentity ?? setFallbackIdentity

  useEffect(() => {
    shell?.setNavigationOpen(false)
  }, [displayedRoute, shell?.setNavigationOpen])

  return (
    <div className={styles.shell}>
      <DiscoveryHeader
        route={displayedRoute}
        identity={identity}
        preference={shell?.preference ?? "system"}
        onPreference={shell?.setPreference ?? (() => undefined)}
        navigationOpen={shell?.navigationOpen ?? false}
        onToggleNavigation={() => shell?.setNavigationOpen(!(shell?.navigationOpen ?? false))}
        showNavigationTrigger={displayedRoute.view === "plan"}
      />
      <div aria-live="polite" role="status" style={{ minHeight: 20 }}>
        {announcement}
      </div>
      {displayedRoute.view === "projects" ? (
        <ProjectsRoute api={api} initial={initial} onIdentity={setIdentity} />
      ) : null}
      {displayedRoute.view === "project" ? (
        <ProjectRoute
          key={displayedRoute.project}
          api={api}
          route={displayedRoute}
          initial={initial}
          onIdentity={setIdentity}
        />
      ) : null}
      {displayedRoute.view === "plan" ? (
        <PlanRoute
          key={`${displayedRoute.project}/${displayedRoute.plan}`}
          api={api}
          route={displayedRoute}
          initial={initial}
          announce={setAnnouncement}
          shell={shell}
          navigate={requestNavigation}
          replaceRoute={replaceRoute}
          registerBoundary={registerBoundary}
          navigationNotice={navigationNotice}
          navigationDestination={navigationDestination}
          onDismissNavigationNotice={() => {
            setNavigationNotice(null)
            setNavigationDestination(null)
          }}
        />
      ) : null}
      {displayedRoute.view === "not-found" ? (
        <main id="main-content" tabIndex={-1}>
          <h1>Not found</h1>
          <Text>
            That page does not exist. <a href="#/">Back to projects</a>
          </Text>
        </main>
      ) : null}
    </div>
  )
}
