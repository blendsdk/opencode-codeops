#!/usr/bin/env node
/**
 * Shared filesystem helpers for the CodeOps installers.
 *
 * Both the skills installer (`install-skills.mjs`) and the agent installer
 * (`install-agents.mjs`) copy packaged files into an OpenCode discovery
 * directory, record what they own in a marker, and replace only what they own.
 * This module holds the parts of that work that are identical for both, so the
 * ownership and atomic-replace rules live in exactly one place.
 *
 * @module lib/opencode-install
 */

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"

/** Name of the marker file that records a managed install. */
export const MARKER_FILE = ".opencode-codeops.json"

// Working directories used during an atomic replace. They are namespaced by
// process id so two concurrent installs cannot collide, and any that survive a
// crash are removed at the start of the next run.
const TEMP_PREFIX = ".codeops.tmp-"
const OLD_PREFIX = ".codeops.old-"

/**
 * Tests whether a path exists as any entry type, including a dangling symlink.
 *
 * `fs.existsSync` follows symlinks and reports a broken link as absent, which
 * would make an installer try to move a file over an existing link.
 * `fs.lstatSync` inspects the link itself.
 *
 * @param targetPath - Path to test
 * @returns True when an entry exists at the path
 */
export function entryExists(targetPath) {
  try {
    lstatSync(targetPath)
    return true
  } catch {
    return false
  }
}

/**
 * Tests whether a path is a symbolic link, without following it.
 *
 * @param targetPath - Path to test
 * @returns True when the path itself is a symlink
 */
export function isSymlink(targetPath) {
  try {
    return lstatSync(targetPath).isSymbolicLink()
  } catch {
    return false
  }
}

/**
 * Removes temporary directories left behind by an interrupted earlier run.
 *
 * @param targetDir - Directory to clean
 */
export function cleanStaleArtifacts(targetDir) {
  for (const entry of readdirSync(targetDir)) {
    if (entry.startsWith(TEMP_PREFIX) || entry.startsWith(OLD_PREFIX)) {
      rmSync(join(targetDir, entry), { recursive: true, force: true })
    }
  }
}

/**
 * Reads the install marker from a target directory.
 *
 * @param targetDir - Directory that may hold a marker
 * @returns The parsed marker, or `undefined` when none exists or it is invalid
 */
export function readMarker(targetDir) {
  const markerPath = join(targetDir, MARKER_FILE)
  if (!entryExists(markerPath)) return undefined

  try {
    return JSON.parse(readFileSync(markerPath, "utf-8"))
  } catch {
    return undefined
  }
}

/**
 * Writes a marker object to a target directory as pretty-printed JSON.
 *
 * @param targetDir - Directory to mark
 * @param marker - Marker contents to serialize
 */
export function writeMarkerFile(targetDir, marker) {
  writeFileSync(join(targetDir, MARKER_FILE), `${JSON.stringify(marker, null, 2)}\n`, "utf-8")
}

/**
 * Replaces one entry atomically: build the new copy first, set the old entry
 * aside, move the new copy into place, then delete the old entry. If anything
 * fails, the previous entry is restored.
 *
 * @param details - Replace inputs
 * @param details.from - Source path to copy
 * @param details.targetDir - Directory that holds the destination
 * @param details.name - Destination entry name inside `targetDir`
 * @param details.recursive - Whether the source is a directory
 * @returns Whether a previous entry existed
 */
export function atomicReplace({ from, targetDir, name, recursive }) {
  const dest = join(targetDir, name)
  const existed = entryExists(dest)
  const tmp = join(targetDir, `${TEMP_PREFIX}${process.pid}-${name}`)
  const old = join(targetDir, `${OLD_PREFIX}${process.pid}-${name}`)

  rmSync(tmp, { recursive: true, force: true })
  cpSync(from, tmp, { recursive })

  try {
    if (existed) renameSync(dest, old)
    renameSync(tmp, dest)
    rmSync(old, { recursive: true, force: true })
  } catch (error) {
    rmSync(tmp, { recursive: true, force: true })
    if (existsSync(old) && !existsSync(dest)) renameSync(old, dest)
    throw error
  }

  return { existed }
}

/**
 * Creates a symlink at `dest` pointing to `from`, replacing anything already
 * there. Used by `--link` so a development checkout can be used in place of a
 * copied install.
 *
 * @param details - Link inputs
 * @param details.from - Source path the link points at
 * @param details.dest - Path of the link to create
 * @param details.type - Symlink type (`"dir"` or `"file"`); Windows uses a
 *   junction for directories because it does not need extra privileges
 */
export function linkEntry({ from, dest, type = "dir" }) {
  rmSync(dest, { recursive: true, force: true })
  const linkType = process.platform === "win32" && type === "dir" ? "junction" : type
  symlinkSync(from, dest, linkType)
}

/**
 * Resolves the directory an installer writes into, based on its CLI options.
 *
 * @param options - Parsed command options
 * @param options.target - Explicit target directory, when given
 * @param options.project - Use a project-relative directory instead of global
 * @param cwd - Project root used for `--project`
 * @param kind - Subdirectory name under `.opencode` (for example `skills`)
 * @param home - Home directory used for the global default (injectable for tests)
 * @returns Absolute path to the target directory
 */
export function resolveTarget(options, cwd, kind, home = homedir()) {
  if (options.target) return resolve(options.target)
  if (options.project) return resolve(cwd, ".opencode", kind)
  return join(home, ".config", "opencode", kind)
}

/**
 * Ensures a target directory exists before an install writes into it.
 *
 * @param targetDir - Directory to create
 */
export function ensureDir(targetDir) {
  mkdirSync(targetDir, { recursive: true })
}
