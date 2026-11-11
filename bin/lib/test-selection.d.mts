/**
 * Type declarations for the pure selector.
 */

import type { TestMap, TestMapGroup, TestMapPolicy } from "./test-map.mjs"
import type { SelectionBase } from "./test-selection-changes.mjs"

/** Gates accepted by the selector. */
export type SelectionGate = "task" | "phase" | "pr" | "release" | "acceptance" | "nightly"

/** Partial gates that may narrow the run. */
export declare const PARTIAL_GATES: readonly SelectionGate[]

/** Every accepted gate. */
export declare const ALL_GATES: readonly SelectionGate[]

/** One selected group. */
export interface SelectedGroup {
  id: string
  slice: string
  reasons: string[]
}

/** One deferred group. */
export interface DeferredGroup {
  id: string
  reason: string
}

/** One expanded command. */
export interface SelectionCommand {
  id: string
  argv: string[]
  cwd: string
}

/** Budget summary. */
export interface SelectionBudget {
  estimatedSec: number
  status: "within-target" | "acceptable" | "over-budget" | "not-applicable"
  breakdown?: Array<{ id: string; durationSec: number }>
}

/** Selection result shared by every mode. */
export interface SelectionResult {
  schema: number
  mode: "groups" | "full" | "none"
  gate: SelectionGate
  base: SelectionBase | null
  mapHash: string | null
  changed: string[]
  selected: SelectedGroup[]
  deferred: DeferredGroup[]
  skipped: string[]
  commands: SelectionCommand[]
  budget: SelectionBudget
  warnings: Array<{ code: string; message: string; breakdown?: object[] }>
  reason: string | null
  fullCommand: string[] | string[][] | null
  unknownPaths: string[]
}

/** Select groups for one gate. */
export declare function selectTests(input: {
  map: TestMap | null
  mapHash?: string | null
  changed?: string[]
  files?: string[] | null
  gate?: SelectionGate
  include?: string[]
  explicitFull?: boolean
  env?: Record<string, string>
  base?: SelectionBase | null
}): SelectionResult

/** Check whether a group relies on target discovery. */
export declare function groupUsesTargetDiscovery(group: TestMapGroup): boolean

/** Policy type re-export for consumers. */
export type { TestMapPolicy }
