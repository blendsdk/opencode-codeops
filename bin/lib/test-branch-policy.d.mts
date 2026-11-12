/**
 * Type declarations for branch classification and plan generation.
 */

/** Branch classes a ref can resolve to. */
export declare const BRANCH_CLASSES: readonly string[]

/** Classification result. */
export interface BranchClassification {
  class: string
  gate: string
  full: boolean
  warning: { code: string; message: string } | null
}

/** Choose a gate for a branch class. */
export declare function gateForClass(
  branchClass: string,
  options?: { ci?: boolean }
): string

/** Classify a branch or tag. */
export declare function classifyRef(
  ref: string,
  options?: { branches?: object; isTag?: boolean; ci?: boolean }
): BranchClassification

/** Decide whether a nightly run must execute. */
export declare function nightlyDecision(input?: {
  changed?: string[]
  map?: object | null
  marker?: string | null
}): { mode: "full" | "skip" | "groups"; reason: string | null; relevant: string[] }

/** Build the CI plan JSON. */
export declare function buildPlan(input: {
  selection: object
  gate: string
  total: number
}): {
  schema: number
  gate: string
  mode: string
  full: boolean
  selected: number
  total: number
  mapHash: string | null
  matrix: { include: Array<{ group: string; command: string[]; cwd: string }> }
  fullCommand: string[] | string[][] | null
  reason: string | null
}
