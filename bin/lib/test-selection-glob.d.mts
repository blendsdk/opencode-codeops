/**
 * Type declarations for the repository glob matcher.
 */

/** Validation result for one glob pattern. */
export type GlobValidation = { ok: true } | { ok: false; message: string }

/** Validate syntax without compiling. */
export declare function validateGlobPattern(pattern: unknown): GlobValidation

/** Compile a glob to an anchored regular expression. */
export declare function globToRegExp(
  pattern: string,
  options?: { caseSensitive?: boolean }
): RegExp

/** Match one normalized repository path. */
export declare function matchesGlob(
  path: string,
  pattern: string,
  options?: { caseSensitive?: boolean }
): boolean

/** Match one path against a pattern list. */
export declare function matchesAnyGlob(
  path: string,
  patterns: string[],
  options?: { caseSensitive?: boolean }
): boolean

/** Check whether two globs can share a path. */
export declare function globsIntersect(left: string, right: string): boolean
