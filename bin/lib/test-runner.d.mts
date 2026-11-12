/**
 * Type declarations for the argv-safe test runner.
 */

/** One command result. */
export interface RunResult {
  id: string
  status: "passed" | "failed" | "timeout"
  exitCode: number
  durationMs: number
  logPath: string | null
  output: string
  tail: string
}

/** Error raised when a command cannot run safely. */
export declare class RunnerError extends Error {
  code: string
  constructor(code: string, message: string)
}

/** Default per-group timeout. */
export declare const DEFAULT_GROUP_TIMEOUT_SECONDS: number

/** Default full-suite timeout. */
export declare const DEFAULT_FULL_TIMEOUT_SECONDS: number

/** Resolve the captured-log directory. */
export declare function resolveLogDir(env?: Record<string, string>): string

/** Resolve and contain a command working directory. */
export declare function resolveWorkingDirectory(root: string, cwd?: string): string

/** Keep the last N lines of a log. */
export declare function tailLines(text: string, count?: number): string

/** Run one argv command. */
export declare function runArgv(input: {
  id: string
  argv: string[]
  cwd?: string
  root: string
  timeoutSeconds?: number
  env?: Record<string, string>
  gate?: string
  keepLogs?: boolean
  serial?: number
}): Promise<RunResult>

/** Read a retained log. */
export declare function readRetainedLog(logPath: string | null): string

/** Run commands sequentially or in a bounded pool. */
export declare function runCommands(
  commands: Array<{ id: string; argv: string[]; cwd?: string; parallelSafe?: boolean }>,
  options: {
    root: string
    concurrency?: number
    failFast?: boolean
    timeoutSeconds?: number
    env?: Record<string, string>
    gate?: string
    keepLogs?: boolean
  }
): Promise<RunResult[]>

/** Run one requirement probe. */
export declare function probeRequirement(input: {
  argv: string[]
  root: string
  env?: Record<string, string>
}): Promise<boolean>
