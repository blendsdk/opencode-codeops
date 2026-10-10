/**
 * The live progress core: contracts, guards, normalization, and the run-state
 * runtime shared by the server plugin and the TUI.
 *
 * The module is deliberately host-free. Schemas are plain JSON-Schema objects,
 * the runtime keeps one in-memory run per location, and every guard is total
 * (it never throws on unknown input). `node --test` can therefore exercise the
 * whole contract without an OpenCode host.
 *
 * @module codeops-progress
 */

/**
 * The eight activity values a progress report and a run snapshot can carry.
 * The order is the presentation order used in the tool schema.
 */
const CODE_OPS_ACTIVITIES = [
  "starting",
  "implementing",
  "verifying",
  "reviewing",
  "delegating",
  "waiting",
  "blocked",
  "done",
]

/** The keys a progress report may carry; anything else is rejected. */
const CODE_OPS_REPORT_KEYS = [
  "plan",
  "phase",
  "task",
  "activity",
  "detail",
  "verified",
  "total",
]

/** The keys a complete run snapshot carries. */
const CODE_OPS_RUN_STATE_KEYS = [
  "plan",
  "phase",
  "task",
  "activity",
  "detail",
  "verified",
  "total",
  "startedAt",
  "updatedAt",
  "sessionID",
]

/** The name of the agent-callable tool that reports task progress. */
export const CODE_OPS_TOOL_NAME = "codeops_progress"

/** The description of the progress tool, shown in the host's tool list. */
export const CODE_OPS_TOOL_DESCRIPTION =
  "Report live CodeOps task progress so the sidebar shows the current run. Use at run, phase, and task transitions, and for blocked, waiting, delegating, reviewing, and done states."

/** Longest accepted free-text value; longer values are truncated at this length. */
export const CODE_OPS_STRING_CAP = 200

/** Largest accepted `verified`/`total` count; larger values are clamped. */
export const CODE_OPS_COUNT_MAX = 1_000_000

/** Age in milliseconds at which a run is shown as stale (10 minutes). */
export const CODE_OPS_STALE_MS = 600_000

/**
 * The input schema of the progress tool: a partial run report.
 *
 * Only `plan` and `activity` are required; every other field is an optional
 * update, and unknown fields are rejected by the host's schema validation and
 * by the runtime guard alike.
 */
export const ProgressReportSchema = {
  type: "object",
  additionalProperties: false,
  required: ["plan", "activity"],
  properties: {
    plan: { type: "string" },
    phase: { type: "string" },
    task: { type: "string" },
    activity: { type: "string", enum: CODE_OPS_ACTIVITIES },
    detail: { type: "string" },
    verified: { type: "integer", minimum: 0 },
    total: { type: "integer", minimum: 0 },
  },
}

/** The output schema of the progress tool: a boolean acknowledgement. */
export const ProgressOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok"],
  properties: { ok: { type: "boolean" } },
}

/**
 * The schema of one complete run snapshot.
 *
 * A snapshot is the RPC `progress` payload and the `updated` event data; it
 * always carries all ten fields, with `null` marking an unknown optional value
 * and `total: null` meaning "counts unknown".
 */
export const RunStateSchema = {
  type: "object",
  additionalProperties: false,
  required: CODE_OPS_RUN_STATE_KEYS,
  properties: {
    plan: { type: "string" },
    phase: { type: ["string", "null"] },
    task: { type: ["string", "null"] },
    detail: { type: ["string", "null"] },
    activity: { type: "string", enum: CODE_OPS_ACTIVITIES },
    verified: { type: "integer", minimum: 0 },
    total: { type: ["integer", "null"], minimum: 0 },
    startedAt: { type: "integer", minimum: 0 },
    updatedAt: { type: "integer", minimum: 0 },
    sessionID: { type: "string" },
  },
}

/**
 * The schema of the `cleared` event payload: the cleared run's identity and
 * the server-stamped clear time. A viewer uses `clearedAt` to ignore late
 * updates or snapshots that belong to the cleared run.
 */
export const RunClearedSchema = {
  type: "object",
  additionalProperties: false,
  required: ["plan", "sessionID", "clearedAt"],
  properties: {
    plan: { type: "string" },
    sessionID: { type: "string" },
    clearedAt: { type: "integer", minimum: 0 },
  },
}

/**
 * Test whether a value is a plain object (and not null or an array).
 *
 * @param value - Any value.
 * @returns `true` for a plain, non-array object.
 */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Test whether a value is a non-negative integer count.
 *
 * @param value - Any value.
 * @returns `true` for an integer `>= 0`.
 */
function isCount(value) {
  return Number.isInteger(value) && value >= 0
}

/**
 * Test whether a value is a string or `null`.
 *
 * @param value - Any value.
 * @returns `true` for a string or `null`.
 */
function isNullableString(value) {
  return value === null || typeof value === "string"
}

/**
 * Validate an unknown value as a progress report.
 *
 * Mirrors {@link ProgressReportSchema}: `plan` and `activity` are required,
 * the optional fields must have their declared types, and unknown fields are
 * rejected. This is the runtime's line of defense if the host's schema
 * validation is bypassed or stricter than the schema.
 *
 * @param value - Value received from the tool handler or a test.
 * @returns `true` only for a report matching the schema.
 */
export function isCodeOpsProgressReport(value) {
  if (!isPlainObject(value)) return false
  const keys = Object.keys(value)
  if (keys.length < 2 || keys.length > CODE_OPS_REPORT_KEYS.length) return false
  if (!keys.every((key) => CODE_OPS_REPORT_KEYS.includes(key))) return false
  if (typeof value.plan !== "string") return false
  if (!CODE_OPS_ACTIVITIES.includes(value.activity)) return false
  if (Object.hasOwn(value, "phase") && typeof value.phase !== "string") return false
  if (Object.hasOwn(value, "task") && typeof value.task !== "string") return false
  if (Object.hasOwn(value, "detail") && typeof value.detail !== "string") return false
  if (Object.hasOwn(value, "verified") && !isCount(value.verified)) return false
  if (Object.hasOwn(value, "total") && !isCount(value.total)) return false
  return true
}

/**
 * Validate an unknown value as a complete run snapshot.
 *
 * Mirrors {@link RunStateSchema}: all ten fields are required, optional
 * string fields may be `null`, counts and timestamps must be non-negative
 * integers, and unknown fields are rejected.
 *
 * @param value - Value received from an RPC call or an event.
 * @returns `true` only for a snapshot matching the schema.
 */
export function isCodeOpsRunState(value) {
  if (!isPlainObject(value)) return false
  const keys = Object.keys(value)
  if (keys.length !== CODE_OPS_RUN_STATE_KEYS.length) return false
  if (!keys.every((key) => CODE_OPS_RUN_STATE_KEYS.includes(key))) return false
  return (
    typeof value.plan === "string" &&
    isNullableString(value.phase) &&
    isNullableString(value.task) &&
    isNullableString(value.detail) &&
    CODE_OPS_ACTIVITIES.includes(value.activity) &&
    isCount(value.verified) &&
    (value.total === null || isCount(value.total)) &&
    isCount(value.startedAt) &&
    isCount(value.updatedAt) &&
    typeof value.sessionID === "string"
  )
}

/**
 * Validate an unknown value as a cleared-event payload.
 *
 * @param value - Value received from a `cleared` event.
 * @returns `true` only for a payload matching {@link RunClearedSchema}.
 */
function isRunCleared(value) {
  if (!isPlainObject(value)) return false
  const keys = Object.keys(value)
  if (keys.length !== 3) return false
  return (
    typeof value.plan === "string" &&
    typeof value.sessionID === "string" &&
    isCount(value.clearedAt)
  )
}

/**
 * Accept a validated run snapshot from an `updated` event.
 *
 * The event envelope must target the viewer's directory, and the event data
 * must pass {@link isCodeOpsRunState}. A plain function (not a predicate) is
 * used so the narrowed value is directly usable at the call site.
 *
 * @param event - Event envelope carrying `location.directory` and `data`.
 * @param directory - The viewer's project directory.
 * @returns The validated snapshot, or `null` when the event does not belong
 *   to the viewer or its data is invalid.
 */
export function acceptRunUpdate(event, directory) {
  if (event?.location?.directory !== directory) return null
  return isCodeOpsRunState(event.data) ? event.data : null
}

/**
 * Accept a validated cleared payload from a `cleared` event.
 *
 * @param event - Event envelope carrying `location.directory` and `data`.
 * @param directory - The viewer's project directory.
 * @returns The validated cleared identity, or `null` when the event does not
 *   belong to the viewer or its data is invalid.
 */
export function acceptRunCleared(event, directory) {
  if (event?.location?.directory !== directory) return null
  return isRunCleared(event.data) ? event.data : null
}

/**
 * Normalize an unknown progress report into the merge-ready form.
 *
 * Text fields are trimmed and truncated at {@link CODE_OPS_STRING_CAP};
 * whitespace-only optional strings become `null` (an explicit clear). Counts
 * are floored and clamped to `0…CODE_OPS_COUNT_MAX`. Only fields present in
 * the input appear in the result, so the runtime can distinguish "absent,
 * carry the current value" from "present, replace it".
 *
 * @param value - Value received from the tool handler.
 * @returns The normalized report, or `null` when the shape is not a valid
 *   report (the caller must treat `null` as a rejection).
 */
export function normalizeProgressReport(value) {
  if (!isPlainObject(value)) return null
  if (!Object.keys(value).every((key) => CODE_OPS_REPORT_KEYS.includes(key))) return null
  if (typeof value.plan !== "string") return null
  if (!CODE_OPS_ACTIVITIES.includes(value.activity)) return null

  const plan = truncateText(value.plan.trim())
  if (plan === "") return null

  const normalized = { plan, activity: value.activity }
  for (const key of ["phase", "task", "detail"]) {
    if (!Object.hasOwn(value, key)) continue
    if (typeof value[key] !== "string") return null
    const text = truncateText(value[key].trim())
    normalized[key] = text === "" ? null : text
  }
  for (const key of ["verified", "total"]) {
    if (!Object.hasOwn(value, key)) continue
    if (typeof value[key] !== "number" || !Number.isFinite(value[key])) return null
    normalized[key] = Math.min(CODE_OPS_COUNT_MAX, Math.max(0, Math.floor(value[key])))
  }
  return normalized
}

/**
 * Truncate free text at the string cap.
 *
 * @param text - The (already trimmed) text.
 * @returns The text, at most {@link CODE_OPS_STRING_CAP} characters long.
 */
function truncateText(text) {
  return text.length > CODE_OPS_STRING_CAP ? text.slice(0, CODE_OPS_STRING_CAP) : text
}

/**
 * Build the display label for a snapshot's activity.
 *
 * Four activities render as their own word. `delegating`, `waiting`, and
 * `blocked` attach the reported detail when one is present, so the sidebar
 * shows where a delegation went, what the run waits for, or why it stopped.
 *
 * @param snapshot - The run snapshot.
 * @returns The activity label for the second display line.
 */
function activityLabel(snapshot) {
  switch (snapshot.activity) {
    case "delegating":
      return snapshot.detail === null ? "delegating" : `delegating to ${snapshot.detail}`
    case "waiting":
      return snapshot.detail === null ? "waiting" : `waiting (${snapshot.detail})`
    case "blocked":
      return snapshot.detail === null ? "blocked" : `blocked: ${snapshot.detail}`
    default:
      return snapshot.activity
  }
}

/**
 * Format a snapshot timestamp as local `HH:MM` clock text.
 *
 * The viewer's local time zone applies: exact for a same-host client,
 * approximate when the server runs elsewhere.
 *
 * @param ms - Epoch milliseconds (server-stamped).
 * @returns The local time as `HH:MM`.
 */
function formatLocalTime(ms) {
  const date = new Date(ms)
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

/**
 * Create one in-memory run-state runtime.
 *
 * The runtime holds a single active run: the first accepted report creates it,
 * same-plan reports merge into it field by field, and a report for a different
 * plan replaces it (last reporter owns). Every accepted report emits the new
 * snapshot to a bound emitter; clearing emits the cleared identity.
 *
 * @returns {object} The runtime: `report`, `snapshot`, `clearSession`, and
 *   `bindEmit`.
 */
export function createCodeOpsProgress() {
  let current = null
  let emitFn = null

  /**
   * Emit one event through the bound emitter, swallowing every failure.
   *
   * A missing binding, a synchronous throw, and a rejected promise all leave
   * the report or clear successful — the state is already truthful.
   *
   * @param name - Event name (`updated` or `cleared`).
   * @param payload - Event data.
   */
  function emitEvent(name, payload) {
    if (emitFn === null) return
    try {
      const result = emitFn(name, payload)
      if (result !== null && typeof result === "object" && typeof result.then === "function") {
        result.then(undefined, () => {})
      }
    } catch {
      // An emitter failure never breaks a report or a clear.
    }
  }

  return {
    /**
     * Normalize and apply one progress report.
     *
     * @param input - The raw report; rejected when it does not normalize.
     * @param sessionID - The reporting session, recorded as the run's owner.
     * @param nowMs - Server time override for tests; defaults to `Date.now()`.
     * @returns The resulting snapshot, or `null` when the report is rejected
     *   (the state is then untouched and no event is emitted).
     */
    report(input, sessionID, nowMs) {
      const normalized = normalizeProgressReport(input)
      if (normalized === null) return null
      const now = nowMs ?? Date.now()
      if (current === null || current.plan !== normalized.plan) {
        current = {
          plan: normalized.plan,
          phase: Object.hasOwn(normalized, "phase") ? normalized.phase : null,
          task: Object.hasOwn(normalized, "task") ? normalized.task : null,
          detail: Object.hasOwn(normalized, "detail") ? normalized.detail : null,
          activity: normalized.activity,
          verified: Object.hasOwn(normalized, "verified") ? normalized.verified : 0,
          total: Object.hasOwn(normalized, "total") ? normalized.total : null,
          startedAt: now,
          updatedAt: now,
          sessionID,
        }
      } else {
        const merged = { ...current, activity: normalized.activity, updatedAt: now, sessionID }
        for (const key of ["phase", "task", "detail", "verified", "total"]) {
          if (Object.hasOwn(normalized, key)) merged[key] = normalized[key]
        }
        current = merged
      }
      emitEvent("updated", current)
      return current
    },

    /**
     * Read the current snapshot.
     *
     * @returns The snapshot, or `null` when no run is active.
     */
    snapshot() {
      return current
    },

    /**
     * Clear the active run when the session owns it.
     *
     * @param sessionID - The session requesting the clear.
     * @returns The cleared identity `{ plan, sessionID, clearedAt }`, or
     *   `null` when no run exists or a different session owns it.
     */
    clearSession(sessionID) {
      if (current === null || current.sessionID !== sessionID) return null
      const cleared = { plan: current.plan, sessionID: current.sessionID, clearedAt: Date.now() }
      current = null
      emitEvent("cleared", cleared)
      return cleared
    },

    /**
     * Bind the event emitter used by every later report and clear.
     *
     * @param emit - `(name, payload) => void|Promise<void>`; a non-function
     *   value unbinds emission without failing the runtime.
     */
    bindEmit(emit) {
      emitFn = typeof emit === "function" ? emit : null
    },
  }
}

/**
 * Pick the newer of two snapshots for a monotonic view update.
 *
 * An equal `updatedAt` lets the incoming snapshot win so the view converges
 * on the latest delivery.
 *
 * @param current - The snapshot currently displayed, or `null`.
 * @param incoming - The snapshot that just arrived.
 * @returns `incoming` when it is at least as new, otherwise `current`.
 */
export function mergeRunState(current, incoming) {
  if (current === null) return incoming
  return incoming.updatedAt >= current.updatedAt ? incoming : current
}

/**
 * Test whether a run has not been updated for ten minutes.
 *
 * @param snapshot - The run snapshot (only `updatedAt` is read).
 * @param nowMs - The viewer's current time.
 * @returns `true` when the last update is {@link CODE_OPS_STALE_MS} old or older.
 */
export function isRunStale(snapshot, nowMs) {
  return nowMs - snapshot.updatedAt >= CODE_OPS_STALE_MS
}

/**
 * Render the visible sidebar lines for a run snapshot.
 *
 * The function is the single source of the displayed text; the TUI renders
 * these strings as plain text. The as-of time refreshes whenever the
 * component re-renders — there are no timers — so a longer-idle run shows
 * the stale suffix on its next render.
 *
 * @param snapshot - The run snapshot.
 * @param nowMs - The viewer's current time, used only for the stale check.
 * @returns The three display lines and the stale flag.
 */
export function describeRun(snapshot, nowMs) {
  const stale = isRunStale(snapshot, nowMs)
  const activityText = activityLabel(snapshot)
  const lines = [
    `CodeOps · ${snapshot.plan}`,
    snapshot.phase === null ? activityText : `${snapshot.phase} · ${activityText}`,
  ]
  const segments = []
  if (snapshot.task !== null) segments.push(snapshot.task)
  if (snapshot.total !== null) segments.push(`${snapshot.verified}/${snapshot.total} verified`)
  segments.push(`as of ${formatLocalTime(snapshot.updatedAt)}${stale ? " (stale)" : ""}`)
  lines.push(segments.join(" · "))
  return { lines, stale }
}

/**
 * Register the agent-callable progress tool on a plugin context,
 * feature-detected and never-throwing.
 *
 * The handler validates defensively through the runtime and always answers
 * with the boolean acknowledgement shape: a rejected report yields
 * `{ ok: false }` without throwing, so a reporting mistake can never break an
 * agent turn. Registration failures are contained the same way as the RPC
 * guard: a missing `tool.transform`, a throwing transform, and any other
 * failure all report `false`.
 *
 * @param ctx - Server plugin context; only `tool.transform` is read.
 * @param runtime - The run-state runtime the handler reports into.
 * @returns `true` when the transform completed, `false` when the host lacks
 *   the tool API or the registration failed. Never throws.
 */
export async function registerCodeOpsProgressTool(ctx, runtime) {
  if (typeof ctx?.tool?.transform !== "function") return false
  try {
    await ctx.tool.transform((tool) =>
      tool.add({
        name: CODE_OPS_TOOL_NAME,
        description: CODE_OPS_TOOL_DESCRIPTION,
        input: ProgressReportSchema,
        output: ProgressOutputSchema,
        // The host adapter wraps the handler in a promise constructor and
        // rejects a synchronous return, so the handler must be async even
        // though it never awaits.
        async execute(input, toolContext) {
          try {
            const accepted = runtime?.report(input, toolContext?.sessionID ?? "") ?? null
            return { output: { ok: accepted !== null } }
          } catch {
            // A reporting failure must never break an agent turn.
            return { output: { ok: false } }
          }
        },
      })
    )
    return true
  } catch {
    return false
  }
}
