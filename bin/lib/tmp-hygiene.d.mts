/**
 * Type declarations for the CodeOps temporary-directory lifecycle helper.
 *
 * The helper is plain JavaScript so `node --test` can exercise it directly;
 * these declarations give the TypeScript plugin entry point typed access.
 */

/** Age after which a session directory is treated as abandoned. */
export declare const DEFAULT_MAX_AGE_MS: number

/** Directory name used when no usable session identifier exists. */
export declare const SHARED_SESSION_NAME: string

/** Resolve the CodeOps-owned temp root under a base temp directory. */
export declare function codeopsTmpRoot(base?: string): string

/** Reduce a session identifier to a safe single path segment. */
export declare function sanitizeSessionId(sessionID?: string): string

/** Compute the temp directory for one session. */
export declare function sessionTmpDir(sessionID?: string, base?: string): string

/** Create the session temp directory when it does not exist yet. */
export declare function ensureSessionTmpDir(sessionID?: string, base?: string): string

/** Inputs for a stale-directory sweep. */
export interface CleanStaleTmpDirsOptions {
  sessionID?: string
  base?: string
  maxAgeMs?: number
  now?: number
}

/** Remove session directories abandoned by interrupted or crashed runs. */
export declare function cleanStaleTmpDirs(options?: CleanStaleTmpDirsOptions): string[]

/** Remove exactly one session's temp directory. */
export declare function removeSessionTmpDir(sessionID?: string, base?: string): boolean
