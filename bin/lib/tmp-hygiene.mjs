#!/usr/bin/env node
/**
 * Temporary-directory lifecycle for CodeOps sessions.
 *
 * The workspace-hygiene protocol asks every skill and agent to put scratch
 * files under `$CODEOPS_TMPDIR` and delete them when the run completes. This
 * module provides the safety net around that protocol:
 *
 * - it computes the per-session directory the plugin exports as
 *   `$CODEOPS_TMPDIR`, under a CodeOps-owned root inside the OS temp directory;
 * - it sweeps directories abandoned by interrupted runs once they are older
 *   than a safety cap.
 *
 * Safety is the whole point: every path derives from a sanitized session
 * identifier, the sweep walks only the CodeOps-owned root, symlinked entries
 * are treated as foreign, and cleanup is best effort so a failure never breaks
 * a session.
 *
 * @module lib/tmp-hygiene
 */

import { lstatSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

/**
 * Age after which a session directory is treated as abandoned.
 *
 * A crashed or interrupted run leaves its directory behind; once it is this
 * old, no live session can still need it, so the next sweep may remove it.
 */
export const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** Directory name used when no usable session identifier exists. */
export const SHARED_SESSION_NAME = "shared"

/**
 * Resolve the CodeOps-owned temp root under a base temp directory.
 *
 * The plugin owns this subtree and nothing else under the system temp
 * directory; keeping all CodeOps scratch under one root is what makes the
 * automatic sweep safe.
 *
 * @param base - Base temp directory (injectable for tests)
 * @returns Path to the CodeOps temp root
 */
export function codeopsTmpRoot(base = tmpdir()) {
  return join(base, "opencode", "codeops")
}

/**
 * Reduce a session identifier to a safe single path segment.
 *
 * Session identifiers come from the host and must never influence the path
 * shape: every character outside `A-Z`, `a-z`, `0-9`, `_`, and `-` is removed,
 * so a value like `../../etc` cannot escape the temp root. An empty result
 * falls back to a shared directory name.
 *
 * @param sessionID - Raw session identifier (may be missing)
 * @returns A safe directory name
 */
export function sanitizeSessionId(sessionID) {
  const cleaned = String(sessionID ?? "").replace(/[^A-Za-z0-9_-]/g, "")
  return cleaned.length > 0 ? cleaned : SHARED_SESSION_NAME
}

/**
 * Compute the temp directory for one session.
 *
 * @param sessionID - Raw session identifier (may be missing)
 * @param base - Base temp directory (injectable for tests)
 * @returns Path to the session's temp directory
 */
export function sessionTmpDir(sessionID, base = tmpdir()) {
  return join(codeopsTmpRoot(base), sanitizeSessionId(sessionID))
}

/**
 * Create the session temp directory when it does not exist yet.
 *
 * Called while exporting the shell environment, so the directory is ready
 * before the first command needs it.
 *
 * @param sessionID - Raw session identifier (may be missing)
 * @param base - Base temp directory (injectable for tests)
 * @returns Path to the session's temp directory
 * @throws {Error} When the directory cannot be created
 */
export function ensureSessionTmpDir(sessionID, base = tmpdir()) {
  const dir = sessionTmpDir(sessionID, base)
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Remove session directories abandoned by interrupted or crashed runs.
 *
 * Only direct children of the CodeOps temp root are considered. Fresh
 * directories, the current session's directory, plain files, and symlinks are
 * left untouched; a symlink is never followed, so a link planted inside the
 * root can never redirect a delete outside it. Failures are swallowed because
 * a sweep is maintenance, not a task requirement.
 *
 * @param options - Sweep inputs
 * @param options.sessionID - Current session identifier to preserve
 * @param options.base - Base temp directory (injectable for tests)
 * @param options.maxAgeMs - Abandonment age in milliseconds
 * @param options.now - Current time in milliseconds (injectable for tests)
 * @returns Paths of the directories that were removed
 */
export function cleanStaleTmpDirs({
  sessionID,
  base = tmpdir(),
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  now = Date.now(),
} = {}) {
  const root = codeopsTmpRoot(base)
  const keep = resolve(sessionTmpDir(sessionID, base))
  const removed = []

  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return removed
  }

  for (const entry of entries) {
    // Directory entries are lstat-based, so a symlink to a directory reports
    // as a symlink and is skipped here.
    if (!entry.isDirectory()) continue

    const full = join(root, entry.name)
    if (resolve(full) === keep) continue

    try {
      const info = lstatSync(full)
      if (!info.isDirectory()) continue
      if (now - info.mtimeMs < maxAgeMs) continue
      rmSync(full, { recursive: true, force: true })
      removed.push(full)
    } catch {
      // Best effort: a directory that vanished mid-sweep is already gone.
    }
  }

  return removed
}
