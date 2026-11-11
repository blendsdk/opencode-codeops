/**
 * Type declarations for test-map validation and health checks.
 */

import type { TestMap, TestMapGroup } from "./test-map.mjs"

/** Supported group tiers. */
export declare const GROUP_TIERS: readonly TestMapGroup["tier"][]

/** Supported branch classes. */
export declare const BRANCH_CLASSES: readonly string[]

/** Supported acceptance modes. */
export declare const ACCEPTANCE_MODES: readonly string[]

/** Supported per-slice acceptance exception modes. */
export declare const SLICE_ACCEPTANCE_MODES: readonly string[]

/** Rules that warn in normal mode and fail under strict mode. */
export declare const WARNING_CODES: readonly string[]

/** One validation diagnostic. */
export interface ValidationDiagnostic {
  code: string
  message: string
  path?: string
}

/** Validation result. */
export interface ValidationReport {
  errors: ValidationDiagnostic[]
  warnings: ValidationDiagnostic[]
}

/** Validate a map, optionally with a tracked-file inventory for health checks. */
export declare function validateMap(
  map: TestMap,
  options?: { files?: string[] | null }
): ValidationReport

/** Map a report to the documented exit code. */
export declare function exitCodeFor(report: ValidationReport, options?: { strict?: boolean }): number
