/**
 * Type declarations for the live progress core.
 *
 * The module is plain JavaScript so `node --test` can exercise it directly;
 * these declarations give the TypeScript plugin entries typed access.
 */

/** The eight activity states a run can report. */
export type CodeOpsActivity =
  | "starting"
  | "implementing"
  | "verifying"
  | "reviewing"
  | "delegating"
  | "waiting"
  | "blocked"
  | "done"

/** A progress report as sent by an agent through the tool. */
export interface CodeOpsProgressReport {
  readonly plan: string
  readonly activity: CodeOpsActivity
  readonly phase?: string
  readonly task?: string
  readonly detail?: string
  readonly verified?: number
  readonly total?: number
}

/**
 * A report after normalization.
 *
 * Only fields present in the input appear; optional text fields may be `null`
 * when the input carried a whitespace-only string.
 */
export interface NormalizedProgressReport {
  readonly plan: string
  readonly activity: CodeOpsActivity
  readonly phase?: string | null
  readonly task?: string | null
  readonly detail?: string | null
  readonly verified?: number
  readonly total?: number
}

/** One complete run snapshot: the `progress` payload and `updated` event data. */
export interface CodeOpsRunState {
  readonly plan: string
  readonly phase: string | null
  readonly task: string | null
  readonly detail: string | null
  readonly activity: CodeOpsActivity
  readonly verified: number
  readonly total: number | null
  readonly startedAt: number
  readonly updatedAt: number
  readonly sessionID: string
}

/** The cleared-event payload: the cleared run's identity and clear time. */
export interface CodeOpsRunCleared {
  readonly plan: string
  readonly sessionID: string
  readonly clearedAt: number
}

/** JSON-Schema shape of the progress tool's input. */
export type CodeOpsProgressReportSchema = {
  readonly type: "object"
  readonly additionalProperties: false
  readonly required: readonly ["plan", "activity"]
  readonly properties: {
    readonly plan: { readonly type: "string" }
    readonly phase: { readonly type: "string" }
    readonly task: { readonly type: "string" }
    readonly activity: { readonly type: "string"; readonly enum: readonly CodeOpsActivity[] }
    readonly detail: { readonly type: "string" }
    readonly verified: { readonly type: "integer"; readonly minimum: 0 }
    readonly total: { readonly type: "integer"; readonly minimum: 0 }
  }
}

/** JSON-Schema shape of the progress tool's acknowledgement. */
export type CodeOpsProgressOutputSchema = {
  readonly type: "object"
  readonly additionalProperties: false
  readonly required: readonly ["ok"]
  readonly properties: { readonly ok: { readonly type: "boolean" } }
}

/** JSON-Schema shape of a complete run snapshot. */
export type CodeOpsRunStateSchema = {
  readonly type: "object"
  readonly additionalProperties: false
  readonly required: readonly [
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
  readonly properties: {
    readonly plan: { readonly type: "string" }
    readonly phase: { readonly type: readonly ["string", "null"] }
    readonly task: { readonly type: readonly ["string", "null"] }
    readonly detail: { readonly type: readonly ["string", "null"] }
    readonly activity: { readonly type: "string"; readonly enum: readonly CodeOpsActivity[] }
    readonly verified: { readonly type: "integer"; readonly minimum: 0 }
    readonly total: { readonly type: readonly ["integer", "null"]; readonly minimum: 0 }
    readonly startedAt: { readonly type: "integer"; readonly minimum: 0 }
    readonly updatedAt: { readonly type: "integer"; readonly minimum: 0 }
    readonly sessionID: { readonly type: "string" }
  }
}

/** JSON-Schema shape of the cleared-event payload. */
export type CodeOpsRunClearedSchema = {
  readonly type: "object"
  readonly additionalProperties: false
  readonly required: readonly ["plan", "sessionID", "clearedAt"]
  readonly properties: {
    readonly plan: { readonly type: "string" }
    readonly sessionID: { readonly type: "string" }
    readonly clearedAt: { readonly type: "integer"; readonly minimum: 0 }
  }
}

/** The name of the agent-callable tool that reports task progress. */
export declare const CODE_OPS_TOOL_NAME: "codeops_progress"

/** The description of the progress tool, shown in the host's tool list. */
export declare const CODE_OPS_TOOL_DESCRIPTION: string

/** Longest accepted free-text value; longer values are truncated. */
export declare const CODE_OPS_STRING_CAP: 200

/** Largest accepted `verified`/`total` count; larger values are clamped. */
export declare const CODE_OPS_COUNT_MAX: 1000000

/** Age in milliseconds at which a run is shown as stale (10 minutes). */
export declare const CODE_OPS_STALE_MS: 600000

/** The input schema of the progress tool. */
export declare const ProgressReportSchema: CodeOpsProgressReportSchema

/** The output schema of the progress tool. */
export declare const ProgressOutputSchema: CodeOpsProgressOutputSchema

/** The schema of one complete run snapshot. */
export declare const RunStateSchema: CodeOpsRunStateSchema

/** The schema of the cleared-event payload. */
export declare const RunClearedSchema: CodeOpsRunClearedSchema

/** Validate an unknown value as a progress report. */
export declare function isCodeOpsProgressReport(value: unknown): value is CodeOpsProgressReport

/** Validate an unknown value as a complete run snapshot. */
export declare function isCodeOpsRunState(value: unknown): value is CodeOpsRunState

/**
 * Accept a validated snapshot from an `updated` event scoped to the viewer's
 * directory; `null` when the event is foreign or its data is invalid.
 */
export declare function acceptRunUpdate(event: unknown, directory: string): CodeOpsRunState | null

/**
 * Accept a validated cleared payload from a `cleared` event scoped to the
 * viewer's directory; `null` when the event is foreign or its data is invalid.
 */
export declare function acceptRunCleared(
  event: unknown,
  directory: string
): CodeOpsRunCleared | null

/** Normalize an unknown report; `null` means rejection. */
export declare function normalizeProgressReport(value: unknown): NormalizedProgressReport | null

/** Emit binding accepted by {@link CodeOpsProgressRuntime.bindEmit}. */
export type CodeOpsEmit = (name: string, payload: unknown) => void | Promise<void>

/** The in-memory run-state runtime shared by the tool handler and the RPC. */
export interface CodeOpsProgressRuntime {
  /** Normalize and apply a report; `null` means the report was rejected. */
  report(input: unknown, sessionID: string, nowMs?: number): CodeOpsRunState | null
  /** The current snapshot, or `null` when no run is active. */
  snapshot(): CodeOpsRunState | null
  /**
   * Clear the active run when `sessionID` is the last reporter; returns the
   * cleared identity, or `null` when a different session owns the run.
   */
  clearSession(sessionID: string): CodeOpsRunCleared | null
  /** Bind the event emitter; a throwing or rejecting emitter is swallowed. */
  bindEmit(emit: CodeOpsEmit): void
}

/** Create one in-memory run-state runtime. */
export declare function createCodeOpsProgress(): CodeOpsProgressRuntime

/**
 * Pick the newer of two snapshots; an equal `updatedAt` lets `incoming` win,
 * so the view converges on the latest delivery.
 */
export declare function mergeRunState(
  current: CodeOpsRunState | null,
  incoming: CodeOpsRunState
): CodeOpsRunState

/** Test whether a run has not been updated for ten minutes. */
export declare function isRunStale(snapshot: Pick<CodeOpsRunState, "updatedAt">, nowMs: number): boolean

/** The rendered sidebar text for a run snapshot. */
export interface CodeOpsRunDisplay {
  /** The three display lines (fewer segments when values are unknown). */
  readonly lines: string[]
  /** Whether the last update is ten minutes old or older. */
  readonly stale: boolean
}

/** Render the visible sidebar lines for a run snapshot. */
export declare function describeRun(snapshot: CodeOpsRunState, nowMs: number): CodeOpsRunDisplay

/**
 * Register the agent-callable progress tool on a plugin context,
 * feature-detected and never-throwing; `false` when the host lacks the tool
 * API or the registration failed.
 */
export declare function registerCodeOpsProgressTool(
  ctx: unknown,
  runtime: CodeOpsProgressRuntime
): Promise<boolean>
