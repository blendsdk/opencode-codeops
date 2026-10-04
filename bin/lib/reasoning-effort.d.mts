/**
 * Type declarations for the CodeOps adaptive reasoning-effort helper.
 *
 * The helper is plain JavaScript so `node --test` can exercise it directly;
 * these declarations give the TypeScript plugin entry point typed access.
 */

/** A level from the four-level suggestion vocabulary. */
export type EffortLevel = "low" | "medium" | "high" | "max"

/** A reasoning value accepted by `routing.roles.<agent>.reasoning`. */
export type RoutingReasoning =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max"

/** The four levels a plan or skill may suggest. */
export declare const EFFORT_LEVELS: readonly EffortLevel[]

/** Check whether a value is one of the four suggestion levels. */
export declare function isEffortLevel(value: unknown): value is EffortLevel

/** The reasoning values accepted by routing role entries. */
export declare const ROUTING_REASONING_VALUES: readonly RoutingReasoning[]

/** Check whether a value is a valid routing reasoning entry. */
export declare function isRoutingReasoning(value: unknown): value is RoutingReasoning

/** Find the first valid dispatch marker across message text parts. */
export declare function findEffortMarker(texts: unknown): EffortLevel | undefined

/** Candidate sources for {@link resolveEffort}. */
export interface ResolveEffortInput {
  marker?: unknown
  session?: unknown
  routing?: unknown
}

/** Resolve the effective level from the explicit sources, most specific first. */
export declare function resolveEffort(
  input?: ResolveEffortInput
): EffortLevel | RoutingReasoning | undefined

/** Compute the session state-file path inside the session temp directory. */
export declare function sessionEffortPath(sessionID?: string, base?: string): string

/** Parse session state-file text into a validated level. */
export declare function parseStateFile(text: string): EffortLevel | undefined

/** Read the session's reasoning-effort state file. */
export declare function readSessionEffort(
  sessionID?: string,
  base?: string
): EffortLevel | undefined

/** Read an agent's explicit reasoning entry from the project routing config. */
export declare function readRoutingReasoning(
  config: unknown,
  agent: unknown
): RoutingReasoning | undefined

/** Extract the model's runtime variant record, when the host exposes one. */
export declare function extractModelVariants(
  model: unknown
): Record<string, unknown> | undefined

/** Check whether a model advertises reasoning support. */
export declare function modelSupportsReasoning(model: unknown): boolean

/** Merge the model's variant options for a level into the request options. */
export declare function applyEffort(
  options: Record<string, unknown>,
  level: unknown,
  model: unknown
): Record<string, unknown>

/** Recursively merge plain objects into a new object. */
export declare function deepMergePlain(
  target: unknown,
  source: unknown
): Record<string, unknown>
