/**
 * Typed client for the Discovery HTTP API.
 *
 * The server speaks plain JSON with an `{ error, message }` envelope. This
 * module turns that into a result union so the views never have to inspect
 * status codes, and maps an unreachable listener to `network` so the page can
 * show the reconnect banner.
 *
 * @module api
 */

import type { PlanRecordLike, RepositoryInput } from "./view-models.ts"

/** The failure kinds the UI reacts to. */
export type ApiErrorKind =
  | "stale"
  | "read-only"
  | "locked"
  | "not-ready"
  | "nothing-ready"
  | "not-found"
  | "invalid"
  | "http"
  | "network"

/** A successful call or a mapped failure. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: ApiErrorKind; status?: number; message: string }

/** One registered checkout. */
export interface ProjectInfo {
  slug: string
  name: string
  branch: string | null
  directory: string
  counts?: Record<string, number>
  repository?: { name?: string; canonical?: string }
  [key: string]: unknown
}

/** One plan row. */
export interface PlanSummaryInfo {
  slug: string
  title: string
  kind: string
  artifact: string
  revision: number
  archived: boolean
  orphaned?: boolean
  updatedAt: string
  counts: Record<string, number>
}

/** The payload shapes the views consume. */
export interface ProjectsResponse {
  repositories: RepositoryInput[]
}

export interface ProjectResponse {
  project: ProjectInfo
  plans: PlanSummaryInfo[]
}

export interface PlanResponse {
  project: ProjectInfo
  plan: PlanRecordLike
}

/** A save acknowledgement; the server returns the plan but not the project. */
export interface SavePlanResponse {
  plan: PlanRecordLike
}

export interface SubmitResponse {
  submission: { id: number; groups: string[]; count: number }
  skipped: Array<{ group: string; missing: unknown[] }>
  delivery: "woken" | "pending"
}

/** The client surface used by the app. */
export interface DiscoveryApi {
  listProjects(): Promise<ApiResult<ProjectsResponse>>
  getProject(project: string): Promise<ApiResult<ProjectResponse>>
  getPlan(project: string, plan: string): Promise<ApiResult<PlanResponse>>
  saveAnswer(
    project: string,
    plan: string,
    key: string,
    baseRevision: number,
    patch: Record<string, unknown>,
  ): Promise<ApiResult<SavePlanResponse>>
  submit(
    project: string,
    plan: string,
    group: string | null,
    baseRevision: number | null,
  ): Promise<ApiResult<SubmitResponse>>
  archive(project: string, plan: string, archived: boolean): Promise<ApiResult<{ archived: boolean }>>
  deletePlan(project: string, plan: string): Promise<ApiResult<{ deleted: boolean }>>
}

/** The error codes the server may return. */
const KNOWN_ERRORS: ApiErrorKind[] = [
  "stale",
  "read-only",
  "locked",
  "not-ready",
  "nothing-ready",
  "not-found",
  "invalid",
]

/** Encode one path segment. */
function segment(value: string): string {
  return encodeURIComponent(value)
}

/** Build the client. */
export function createApi(baseUrl: string, fetchImpl: typeof fetch = fetch): DiscoveryApi {
  const root = baseUrl.replace(/\/$/, "")

  async function call<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<ApiResult<T>> {
    let response: Response
    try {
      response = await fetchImpl(`${root}${path}`, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      return { ok: false, kind: "network", message: "Could not reach Discovery." }
    }
    const payload = await response.json().catch(() => null)
    if (response.ok) return { ok: true, data: payload as T }
    const raw = payload as { error?: string; message?: string } | null
    const kind = KNOWN_ERRORS.includes(raw?.error as ApiErrorKind)
      ? (raw?.error as ApiErrorKind)
      : "http"
    return {
      ok: false,
      kind,
      status: response.status,
      message: raw?.message || "Discovery request failed.",
    }
  }

  const planPath = (project: string, plan: string) =>
    `/api/projects/${segment(project)}/plans/${segment(plan)}`

  return {
    listProjects: () => call("GET", "/api/projects"),
    getProject: (project) => call("GET", `/api/projects/${segment(project)}`),
    getPlan: (project, plan) => call("GET", planPath(project, plan)),
    saveAnswer: (project, plan, key, baseRevision, patch) =>
      call("PUT", `${planPath(project, plan)}/questions/${segment(key)}`, {
        baseRevision,
        patch,
      }),
    submit: (project, plan, group, baseRevision) =>
      call("POST", `${planPath(project, plan)}/submit`, { group, baseRevision }),
    archive: (project, plan, archived) =>
      call("POST", `${planPath(project, plan)}/archive`, { archived }),
    deletePlan: (project, plan) =>
      call("DELETE", planPath(project, plan), { confirm: true }),
  }
}
