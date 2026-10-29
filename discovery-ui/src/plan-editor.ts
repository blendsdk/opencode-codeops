/**
 * Plan-local editing state for the Discovery workspace.
 *
 * One editor belongs to one mounted plan. It owns the drafts, the debounce
 * timer, the serialized save queue, and the submission outcome. It does not
 * know about React or the browser, so the Node tests can drive every
 * interleaving with controlled promises.
 *
 * The editor is deliberately small: it is not a cache or a synchronization
 * service. The server remains the saved-answer authority.
 *
 * @module plan-editor
 */

import type { Answer, Defer } from "../../bin/lib/discovery-rules.mjs"
import type { DiscoveryApi, PlanResponse, ProjectInfo } from "./api.ts"
import { planView } from "./view-models.ts"

/** One save lifecycle label shown to the user. */
export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "recheck"

/** A patch for one question, typed to the existing server contract. */
export interface PlanPatch {
  answer?: Answer | null
  notes?: string
  defer?: Defer | null
  needsDiscussion?: boolean
  reconfirm?: true
  confirmProposal?: true
  dismissProposal?: true
}

/** A local control that holds unsendable, incomplete work. */
export interface IncompleteWork {
  reason: string
}

/** One group reported as skipped or missing by a submission. */
export interface MissingGroup {
  /** The group key. */
  group: string
  /** The server's missing-answer entries for that group. */
  missing: unknown[]
}

/** The observable result of one submission attempt. */
export interface SubmitOutcome {
  ok: boolean
  delivery: "woken" | "pending" | null
  message: string | null
  missing: MissingGroup[]
}

/** Everything a view needs to render one plan. */
export interface EditorSnapshot {
  /** The last accepted server response, or null before the first load. */
  server: PlanResponse | null
  /** Pending patches keyed by question. */
  drafts: Record<string, PlanPatch>
  /** Local controls that cannot be sent until the user finishes them. */
  incomplete: Record<string, IncompleteWork>
  /** Per-question save or validation failures. */
  errors: Record<string, string>
  /** The one save label shown in the footer. */
  status: SaveStatus
  /** True while a submission request is in flight. */
  submitting: boolean
  /** True when drafts, incomplete work, or a recheck remain. */
  unsaved: boolean
  /** The last submission's delivery state. */
  delivery: "woken" | "pending" | null
  /** A plan-level load, refresh, or submit failure. */
  lastError: string | null
  /** Groups skipped by the last successful submission. */
  missing: MissingGroup[]
  /** True when a stale or read-only response needs review before retry. */
  recheckRequired: boolean
  /** True when a refresh returned `not-found` after a successful load. */
  deleted: boolean
  /** Per-question discard counters, used to reset local controls. */
  discardVersion: Record<string, number>
  /** A plan-wide discard counter, used after "discard all". */
  discardAllVersion: number
}

/** The plan-local editor surface. */
export interface PlanEditor {
  /** Return an immutable view of the current state. */
  snapshot(): EditorSnapshot
  /** Merge a patch into one question and schedule its save. */
  edit(key: string, patch: PlanPatch): void
  /** Record or clear a local incomplete control. */
  setIncomplete(key: string, value: boolean, reason?: string): void
  /** Drop one question's local work without writing to the server. */
  discard(key: string): void
  /** Drop every local draft and incomplete marker. */
  discardAll(): void
  /** Wait for every valid pending draft, including edits made while waiting. */
  flush(): Promise<boolean>
  /** Read the server snapshot, waiting for local writes to drain first. */
  refresh(): Promise<void>
  /** Clear a retryable failure and try again; pass a key for one question. */
  retry(key?: string): Promise<boolean>
  /** Flush, recheck readiness, and submit the current revision. */
  submit(group: string | null): Promise<SubmitOutcome>
  /** Drop timers and callbacks; a late acknowledgement cannot apply. */
  dispose(): void
}

/** Options for {@link createPlanEditor}. */
export interface PlanEditorOptions {
  /** The project slug used by the API paths. */
  project: string
  /** The plan slug used by the API paths. */
  plan: string
  /** The API client; the editor never calls `fetch` directly. */
  api: DiscoveryApi
  /** An already loaded server response, used by SSR and initial-data renders. */
  initial?: PlanResponse
  /** Called after every state transition with an immutable snapshot. */
  onChange?: (snapshot: EditorSnapshot) => void
}

/** The debounce used for text-like edits. */
const DEBOUNCE_MS = 500

/** Copy the draft map and its answer arrays so consumers cannot mutate it. */
function copyDrafts(drafts: Record<string, PlanPatch>): Record<string, PlanPatch> {
  return Object.fromEntries(
    Object.entries(drafts).map(([key, patch]) => {
      const answer = patch.answer
      if (answer === null || answer === undefined) return [key, { ...patch }]
      if (Array.isArray(answer.choices)) {
        return [key, { ...patch, answer: { ...answer, choices: [...answer.choices] } }]
      }
      return [key, { ...patch, answer: { ...answer } }]
    }),
  )
}

/** Copy the incomplete map for the same reason. */
function copyIncomplete(
  incomplete: Record<string, IncompleteWork>,
): Record<string, IncompleteWork> {
  return Object.fromEntries(
    Object.entries(incomplete).map(([key, value]) => [key, { ...value }]),
  )
}

/** True when a patch edits a text-like control and should be debounced. */
function isTextLike(patch: PlanPatch): boolean {
  if ("notes" in patch || "defer" in patch) return true
  const answer = patch.answer
  return answer !== null && typeof answer === "object" && ("text" in answer || "other" in answer)
}

/** True when the API result is a conflict that needs a fresh read. */
function needsRecheck(kind: string): boolean {
  return kind === "stale" || kind === "read-only" || kind === "locked"
}

/**
 * Whether the browser should warn before leaving the page.
 *
 * The guard is active only while local work is unfinished. The browser decides
 * whether to show its native warning; the app never claims the write finished.
 *
 * @param snapshot - The current editor snapshot.
 * @returns True when an unload warning is appropriate.
 */
export function shouldWarnBeforeUnload(snapshot: EditorSnapshot): boolean {
  return snapshot.unsaved
}

/**
 * Create one plan editor.
 *
 * Construction makes no request. When initial data is absent the caller runs
 * {@link PlanEditor.refresh} on mount. Every state transition notifies the
 * optional change callback with a fresh snapshot.
 *
 * @param options - Identifiers, API client, optional initial data, and callback.
 * @returns The editor surface.
 *
 * @example
 * const editor = createPlanEditor({ project, plan, api })
 * editor.edit("DQ-1", { answer: { choice: "yes" } })
 * await editor.flush()
 */
export function createPlanEditor(options: PlanEditorOptions): PlanEditor {
  let server: PlanResponse | null = options.initial ?? null
  let drafts: Record<string, PlanPatch> = {}
  let incomplete: Record<string, IncompleteWork> = {}
  let errors: Record<string, string> = {}
  let submitting = false
  let delivery: "woken" | "pending" | null = null
  let missing: MissingGroup[] = []
  let lastError: string | null = null
  let deleted = false
  let outcomeUncertain = false
  let disposed = false
  let discardAllVersion = 0
  const discardVersions: Record<string, number> = {}

  /** Monotonic counter for local edits and discards. */
  let operationSeq = 0
  /** The operation sequence captured by each pending draft. */
  const draftSeq: Record<string, number> = {}
  /** The server revision visible when each draft was first edited. */
  const draftRevision: Record<string, number> = {}
  /** Questions whose rejected save still needs an explicit review. */
  const recheckKeys = new Set<string>()

  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight = false
  let drainPromise: Promise<boolean> | null = null
  let refreshPromise: Promise<void> | null = null
  let queuedRefresh: Promise<void> | null = null

  /** Build the immutable view of the current state. */
  function snapshot(): EditorSnapshot {
    const hasDrafts = Object.keys(drafts).length > 0
    const hasIncomplete = Object.keys(incomplete).length > 0
    const recheckRequired = recheckKeys.size > 0
    const hasErrors = Object.keys(errors).length > 0
    const unsaved = hasDrafts || hasIncomplete || inFlight || recheckRequired
    let status: SaveStatus = "saved"
    if (recheckRequired) status = "recheck"
    else if (hasErrors) status = "error"
    else if (inFlight) status = "saving"
    else if (unsaved) status = "dirty"
    return {
      server,
      drafts: copyDrafts(drafts),
      incomplete: copyIncomplete(incomplete),
      errors: { ...errors },
      status,
      submitting,
      unsaved,
      delivery,
      lastError,
      missing: [...missing],
      recheckRequired,
      deleted,
      discardVersion: { ...discardVersions },
      discardAllVersion,
    }
  }

  /** Notify the React integration unless the editor has been disposed. */
  function notify(): void {
    if (disposed) return
    options.onChange?.(snapshot())
  }

  /** Clear the debounce timer. */
  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  /** A minimal project record when a save response cannot supply one. */
  function knownProject(): ProjectInfo {
    return (
      server?.project ?? {
        slug: options.project,
        name: options.project,
        branch: null,
        directory: "",
      }
    )
  }

  /**
   * Write pending patches one at a time.
   *
   * A write captures the patch, the edit sequence, and the revision visible
   * when the draft started. A newer edit during the write keeps the whole
   * draft, so the next write carries the newer value. The sequence also makes
   * a discard win over an older acknowledgement.
   */
  async function runDrain(): Promise<boolean> {
    if (inFlight) return drainPromise ?? false
    inFlight = true
    notify()
    try {
      while (!disposed) {
        const key = Object.keys(drafts).find((candidate) => errors[candidate] === undefined)
        if (key === undefined) return Object.keys(drafts).length === 0
        const captured = { ...drafts[key] }
        const sequence = draftSeq[key] ?? 0
        const revision = draftRevision[key] ?? server?.plan.revision ?? 0
        let result
        try {
          result = await options.api.saveAnswer(
            options.project,
            options.plan,
            key,
            revision,
            captured,
          )
        } catch (error) {
          result = {
            ok: false as const,
            kind: "network" as const,
            message: error instanceof Error ? error.message : "Could not save.",
          }
        }
        if (disposed) return false
        if (result.ok) {
          server = { project: knownProject(), plan: result.data.plan }
          if ((draftSeq[key] ?? 0) === sequence) {
            delete drafts[key]
            delete draftRevision[key]
          }
          delete errors[key]
          recheckKeys.delete(key)
          notify()
          continue
        }
        errors[key] = result.message
        if (needsRecheck(result.kind)) {
          recheckKeys.add(key)
          notify()
          // Keep the attempted value visible, but read the current server
          // state before the user can review or discard.
          void startRefresh()
        } else if (result.kind === "not-found") {
          // The missing resource may be the plan or only this question. A save
          // 404 is not proof that the plan is gone; confirm with a plan read
          // before entering the terminal state.
          notify()
          void startRefresh()
        } else {
          notify()
        }
        return false
      }
      return Object.keys(drafts).length === 0
    } finally {
      inFlight = false
      notify()
    }
  }

  /** Join the current drain or start one. */
  function ensureDrain(): Promise<boolean> {
    if (drainPromise === null) {
      drainPromise = runDrain().finally(() => {
        drainPromise = null
      })
    }
    return drainPromise
  }

  /** Read the server snapshot and apply it when it is still current. */
  async function fetchAndApply(): Promise<boolean> {
    const sequence = operationSeq
    const result = await options.api.getPlan(options.project, options.plan)
    if (disposed) return false
    if (sequence < operationSeq) {
      // A local operation happened while this read was in flight. The result
      // may predate it, so discard it and read again.
      return true
    }
    if (result.ok) {
      server = result.data
      deleted = false
      lastError = null
      notify()
      return false
    }
    if (result.kind === "not-found" && server !== null) {
      deleted = true
    }
    lastError = result.message
    notify()
    return false
  }

  /** Start or join one read, repeating while local edits invalidate the read. */
  function startRefresh(attempt = 0): Promise<void> {
    if (refreshPromise !== null) return refreshPromise
    const promise = (async () => {
      const stale = await fetchAndApply()
      if (stale && !disposed) {
        refreshPromise = null
        if (attempt >= 2) {
          lastError = "Could not read the current plan."
          notify()
          return
        }
        await startRefresh(attempt + 1)
      }
    })()
    refreshPromise = promise
    return promise.finally(() => {
      if (refreshPromise === promise) refreshPromise = null
    })
  }

  /** Read the server, waiting for local writes to drain first. */
  function refresh(): Promise<void> {
    if (inFlight || drainPromise !== null) {
      if (queuedRefresh === null) {
        const pending = ensureDrain().then(() => startRefresh())
        queuedRefresh = pending.finally(() => {
          if (queuedRefresh === pending) queuedRefresh = null
        })
      }
      return queuedRefresh
    }
    return startRefresh()
  }

  /** Schedule the debounce or start an immediate write. */
  function edit(key: string, patch: PlanPatch): void {
    if (disposed || deleted) return
    const reviewed = recheckKeys.has(key)
    if (reviewed) {
      // The user has now seen the refreshed server state, so the next write
      // starts from that revision instead of the stale one.
      draftRevision[key] = server?.plan.revision ?? 0
      recheckKeys.delete(key)
    } else if (draftRevision[key] === undefined) {
      draftRevision[key] = server?.plan.revision ?? 0
    }
    drafts[key] = { ...(drafts[key] ?? {}), ...patch }
    operationSeq += 1
    draftSeq[key] = operationSeq
    delete errors[key]
    if (isTextLike(patch)) {
      clearTimer()
      timer = setTimeout(() => {
        timer = null
        void ensureDrain()
      }, DEBOUNCE_MS)
    } else {
      clearTimer()
      void ensureDrain()
    }
    notify()
  }

  /** Record or clear a local incomplete control. */
  function setIncomplete(key: string, value: boolean, reason = "incomplete"): void {
    if (disposed) return
    if (value) incomplete[key] = { reason }
    else delete incomplete[key]
    notify()
  }

  /** Drop one question's local work without writing to the server. */
  function discard(key: string): void {
    if (disposed) return
    delete drafts[key]
    delete incomplete[key]
    delete errors[key]
    delete draftRevision[key]
    recheckKeys.delete(key)
    operationSeq += 1
    draftSeq[key] = operationSeq
    discardVersions[key] = (discardVersions[key] ?? 0) + 1
    notify()
  }

  /** Drop every local draft and incomplete marker. */
  function discardAll(): void {
    if (disposed) return
    drafts = {}
    incomplete = {}
    errors = {}
    for (const key of Object.keys(draftRevision)) delete draftRevision[key]
    recheckKeys.clear()
    operationSeq += 1
    discardAllVersion += 1
    notify()
  }

  /** True when any local work still blocks navigation or submission. */
  function hasBlockingWork(): boolean {
    return (
      Object.keys(drafts).length > 0 ||
      Object.keys(incomplete).length > 0 ||
      Object.keys(errors).length > 0 ||
      recheckKeys.size > 0
    )
  }

  /** Wait for every valid pending draft, including edits made while waiting. */
  function flush(): Promise<boolean> {
    if (disposed) return Promise.resolve(false)
    clearTimer()
    if (Object.keys(errors).length > 0 || recheckKeys.size > 0) {
      return Promise.resolve(false)
    }
    if (Object.keys(drafts).length === 0 && !inFlight) {
      return Promise.resolve(!hasBlockingWork())
    }
    return ensureDrain().then((ok) => ok && !hasBlockingWork())
  }

  /** Clear a retryable failure and try again. */
  function retry(key?: string): Promise<boolean> {
    if (disposed) return Promise.resolve(false)
    if (key !== undefined) {
      if (recheckKeys.has(key)) return Promise.resolve(false)
      delete errors[key]
      return ensureDrain().then(() => errors[key] === undefined)
    }
    if (recheckKeys.size > 0) return Promise.resolve(false)
    errors = {}
    return flush()
  }

  /** Build a failed submission outcome. */
  function failedSubmit(message: string, groups: MissingGroup[] = []): SubmitOutcome {
    return { ok: false, delivery: null, message, missing: groups }
  }

  /** Flush, recheck readiness, and submit the current revision. */
  async function submit(group: string | null): Promise<SubmitOutcome> {
    if (disposed) return failedSubmit("This plan is no longer open.")
    if (submitting) return failedSubmit("A submission is already in progress.")
    if (outcomeUncertain) {
      outcomeUncertain = false
      await refresh()
      if (disposed) return failedSubmit("This plan is no longer open.")
    }
    const saved = await flush()
    if (disposed) return failedSubmit("This plan is no longer open.")
    if (submitting) return failedSubmit("A submission is already in progress.")
    if (!saved) {
      return failedSubmit(lastError ?? "Answers are not saved yet.", [...missing])
    }
    if (server === null) return failedSubmit("The plan has not loaded yet.")
    const view = planView(server.plan)
    if (group === null) {
      if (view.submitAll.ready.length === 0) {
        return failedSubmit(
          "No groups are ready to submit.",
          view.submitAll.skipped.map((entry) => ({
            group: entry.group,
            missing: [{ reason: entry.label }],
          })),
        )
      }
    } else {
      const target = view.groups.find((candidate) => candidate.key === group)
      if (target === undefined) return failedSubmit("That group is no longer available.")
      if (!target.ready) {
        return failedSubmit(target.missingLabel, [{ group, missing: target.missing }])
      }
    }
    submitting = true
    notify()
    let result
    try {
      result = await options.api.submit(
        options.project,
        options.plan,
        group,
        server.plan.revision,
      )
    } catch (error) {
      result = {
        ok: false as const,
        kind: "network" as const,
        message: error instanceof Error ? error.message : "Could not submit.",
      }
    }
    if (disposed) return failedSubmit("This plan is no longer open.")
    submitting = false
    if (result.ok) {
      delivery = result.data.delivery
      missing = result.data.skipped
      lastError = null
      outcomeUncertain = false
      notify()
      void refresh()
      return { ok: true, delivery, message: null, missing: [...missing] }
    }
    lastError = result.message
    if (result.kind === "network" || result.kind === "http") outcomeUncertain = true
    notify()
    return failedSubmit(result.message, [...missing])
  }

  /** Drop timers and callbacks; a late acknowledgement cannot apply. */
  function dispose(): void {
    if (disposed) return
    disposed = true
    clearTimer()
    options.onChange = undefined
  }

  return {
    snapshot,
    edit,
    setIncomplete,
    discard,
    discardAll,
    flush,
    refresh,
    retry,
    submit,
    dispose,
  }
}
