/**
 * Type declarations for the test-map loader and canonical hash.
 *
 * The implementation is plain JavaScript so Node's test runner can import it
 * directly; these declarations describe the public data shape for typed
 * consumers.
 */

/** One feature-slice test group. */
export interface TestMapGroup {
  id: string
  slice: string
  tier: "task" | "phase" | "release" | "acceptance"
  sources: string[]
  tests?: string[]
  dependsOn?: string[]
  alwaysRun?: boolean
  durationSec?: number
  parallelSafe?: boolean
  requires?: string[]
  owner?: string
  description?: string
  acceptance?: { mode: "manual" | "external" | "na"; reason: string }
  run: { command: string[]; cwd?: string }
}

/** Normalized map policy. */
export interface TestMapPolicy {
  schema: number
  full: string[] | string[][] | null
  budgets: { taskTargetSeconds: number; taskAcceptableSeconds: number }
  branches: Record<string, string | string[]>
  ignorePaths: Array<{ glob: string; reason: string }>
  fullOnPaths: string[]
  acceptance: { mode: "automated" | "manual" | "external"; groups: string[]; checklist: string | null }
  testRoots: string[] | null
  fullThreshold: number
  prSmoke: string[]
  requirements: Record<string, { check: string[] }>
  caseSensitive: boolean
  [key: string]: unknown
}

/** A loaded map. */
export interface TestMap {
  schema: number
  policy: TestMapPolicy
  groups: TestMapGroup[]
  layout: "single" | "directory"
  path: string
  fragments: string[]
  warnings: string[]
}

/** A map load result. */
export type LoadMapResult =
  | { mode: "no-map" }
  | { mode: "map"; map: TestMap; mapHash: string; path: string; fragments: string[]; warnings: string[] }

/** Error raised for an unreadable or unsafe map. */
export declare class MapLoadError extends Error {
  code: string
  path?: string
  constructor(code: string, message: string, path?: string)
}

/** The only supported map schema. */
export declare const MAP_SCHEMA: number

/** Layout marker for one file. */
export declare const SINGLE_LAYOUT: "single"

/** Layout marker for a directory. */
export declare const DIRECTORY_LAYOUT: "directory"

/** Default branch classification. */
export declare const DEFAULT_BRANCHES: Readonly<Record<string, string | readonly string[]>>

/** Default task budgets. */
export declare const DEFAULT_BUDGETS: Readonly<{ taskTargetSeconds: number; taskAcceptableSeconds: number }>

/** Deep-copy a JSON-compatible value. */
export declare function cloneValue<T>(value: T): T

/** Check whether a repository path stays inside the root. */
export declare function isSafeRepoPath(value: unknown): boolean

/** Normalize a path to forward slashes. */
export declare function normalizeRepoPath(value: string): string

/** Resolve the map layout for a project. */
export declare function resolveMapPath(input: { root: string; mapPath?: string }): {
  kind: "none" | "file" | "directory"
  path: string | null
  warning: string | null
}

/** Apply policy defaults. */
export declare function normalizePolicy(raw: unknown): TestMapPolicy

/** Load the project map. */
export declare function loadMap(input: { root: string; mapPath?: string }): LoadMapResult

/** Produce the canonical JSON used for hashing. */
export declare function canonicalMap(map: TestMap): string

/** Compute the stable map hash. */
export declare function hashMap(map: TestMap): string

/** Check whether a group relies on target discovery instead of `{tests}`. */
export declare function isTargetBasedGroup(group: TestMapGroup): boolean

/** Resolve a repo-relative path inside the root, or return null. */
export declare function resolveInsideRoot(root: string, relativePath: string): string | null
