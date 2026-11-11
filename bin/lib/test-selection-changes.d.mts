/**
 * Type declarations for change detection and baseline resolution.
 */

/** A resolved Git base. */
export interface SelectionBase {
  kind: "tree" | "ref"
  value: string
}

/** A rename entry from `git diff --name-status`. */
export interface SelectionRename {
  from: string
  to: string
  score: string
}

/** Parsed Git name-status output. */
export interface ParsedNameStatus {
  changed: string[]
  renames: SelectionRename[]
  deleted: string[]
}

/** Git runner result. */
export interface GitResult {
  status: number
  stdout: string
  stderr?: string
}

/** Error raised when a base cannot be resolved. */
export declare class SelectionError extends Error {
  reason: string
  constructor(reason: string, message: string)
}

/** Run a read-only Git command. */
export declare function defaultRunGit(
  args: string[],
  options?: { cwd?: string }
): GitResult

/** Parse NUL-separated name-status output. */
export declare function parseNameStatusZ(output: string): ParsedNameStatus

/** Parse NUL-separated path lists. */
export declare function parseNullList(output: string): string[]

/** Resolve the selection base. */
export declare function resolveBaseline(input?: {
  baseline?: string
  lastFullSha?: string
  branch?: string
  isTag?: boolean
  env?: Record<string, string>
  runGit?: (args: string[], options?: { cwd?: string }) => GitResult
}): SelectionBase

/** Collect every changed path for a selection run. */
export declare function collectChanges(input: {
  root: string
  baseline?: string
  lastFullSha?: string
  branch?: string
  isTag?: boolean
  include?: string[]
  env?: Record<string, string>
  runGit?: (args: string[], options?: { cwd?: string }) => GitResult
}): {
  base: SelectionBase
  changed: string[]
  renames: SelectionRename[]
  deleted: string[]
  warnings: object[]
}
