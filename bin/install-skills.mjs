#!/usr/bin/env node
/**
 * Install, inspect, and remove the CodeOps skills for OpenCode.
 *
 * OpenCode discovers skills only from the filesystem: `.opencode/skills/` in a
 * project, or `~/.config/opencode/skills/` globally. It never reads them from a
 * plugin package. This script copies every shipped skill directory (SKILL.md
 * plus its supporting files) into one of those locations.
 *
 * Ownership rules keep the installer safe to run repeatedly:
 * - `install` replaces the skills this package owns, so re-running upgrades an
 *   existing install in place.
 * - A marker file records which skill directories the package owns. Skills the
 *   marker does not name are never touched, so user-authored skills and skills
 *   installed by other tools survive.
 * - Each skill is replaced atomically: a temporary copy is built first, the old
 *   directory is set aside, and only then is the new copy moved into place. If
 *   anything fails, the previous directory is restored.
 *
 * Usage:
 *   opencode-codeops install-skills [options]   Install or upgrade (default)
 *   opencode-codeops status [options]           Show the installed version
 *   opencode-codeops uninstall [options]        Remove the managed skills
 *
 * @module install-skills
 */

import { existsSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  MARKER_FILE,
  atomicReplace,
  cleanStaleArtifacts,
  ensureDir,
  entryExists,
  isSymlink,
  linkEntry,
  readMarker,
  resolveTarget,
  writeMarkerFile,
} from "./lib/opencode-install.mjs"

// This file lives in <package root>/bin/, so the parent of its directory is the
// package root that contains skills/ and package.json.
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

export { MARKER_FILE, readMarker }

/**
 * Reads the marker only when it is a skills marker.
 *
 * Both installers use the same marker file name, so a marker written by the
 * agent installer must not be mistaken for one that lists skills. Treating it
 * as absent is safe: it makes the install behave like a first run instead of
 * silently skipping every packaged skill.
 *
 * @param targetDir - Skills directory that may hold a marker
 * @returns The parsed skills marker, or `undefined`
 */
function readSkillsMarker(targetDir) {
  const marker = readMarker(targetDir)
  return marker && Array.isArray(marker.skills) ? marker : undefined
}

/**
 * Reads this package's own version, recorded in the install marker.
 *
 * @returns The package version, or `"0.0.0"` when package.json cannot be read
 */
export function readPackageVersion() {
  try {
    const manifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf-8"))
    return typeof manifest.version === "string" ? manifest.version : "0.0.0"
  } catch {
    return "0.0.0"
  }
}

/**
 * Resolves the directory that holds the shipped skills.
 *
 * The package's own `skills/` directory is always the source, so the installed
 * skills match the package that was invoked. The `CODEOPS_PLUGIN_ROOT`
 * environment variable is deliberately ignored: the plugin exports it into
 * every shell, and honouring it would install a different checkout's skills.
 * Pass `--source` to override for development.
 *
 * @param override - Optional explicit skills directory
 * @returns Absolute path to the skills directory
 */
export function resolveSourceDir(override) {
  if (override) return resolve(override)
  return join(PACKAGE_ROOT, "skills")
}

/**
 * Lists the skill names shipped in a skills directory.
 *
 * A directory counts as a skill when it contains `SKILL.md`. Symbolic links are
 * skipped, so a development link to an external skill tree is not packaged.
 *
 * @param sourceDir - Directory to scan
 * @returns Sorted skill directory names
 */
export function listSkills(sourceDir) {
  if (!existsSync(sourceDir)) return []

  return readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(sourceDir, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort()
}

/**
 * Writes the install marker that records ownership and the installed version.
 *
 * @param targetDir - Skills directory to mark
 * @param details - Marker contents
 * @param details.version - Installed package version
 * @param details.skills - Skill directory names the package owns
 */
export function writeMarker(targetDir, { version, skills }) {
  writeMarkerFile(targetDir, {
    schema: 1,
    source: "opencode-codeops",
    version,
    installedAt: new Date().toISOString(),
    skills,
  })
}

/**
 * Installs one skill by replacing its directory atomically, or by linking to it
 * when `link` is set (used by development checkouts).
 *
 * @param details - Install inputs
 * @param details.sourceDir - Skills directory holding the packaged skill
 * @param details.targetDir - Skills directory to install into
 * @param details.name - Skill directory name
 * @param details.dryRun - Report only, write nothing
 * @param details.link - Symlink to the source instead of copying
 * @returns Whether a previous directory existed
 */
function installOneSkill({ sourceDir, targetDir, name, dryRun, link }) {
  const from = join(sourceDir, name)
  const dest = join(targetDir, name)
  const existed = entryExists(dest)

  if (dryRun) return { existed }

  if (link) {
    ensureDir(targetDir)
    linkEntry({ from, dest, type: "dir" })
    return { existed }
  }

  return atomicReplace({ from, targetDir, name, recursive: true })
}

/**
 * Installs or upgrades every packaged skill into a target directory.
 *
 * Skills named by an existing marker, plus every packaged skill on a first run,
 * are replaced. A same-named directory that the marker does not own is skipped
 * unless `force` is set, so an unrelated skill is never overwritten by accident.
 *
 * @param details - Install inputs
 * @param details.sourceDir - Skills directory holding the packaged skills
 * @param details.targetDir - Skills directory to install into
 * @param details.version - Version stored in the marker
 * @param details.force - Replace same-named directories the marker does not own
 * @param details.dryRun - Report only, write nothing
 * @param details.link - Symlink to the source instead of copying
 * @returns Counts plus the skill names recorded in the marker
 */
export function installSkills({
  sourceDir,
  targetDir,
  version,
  force = false,
  dryRun = false,
  link = false,
}) {
  const names = listSkills(sourceDir)
  const marker = readSkillsMarker(targetDir)
  const managed = marker ? new Set(marker.skills ?? []) : null
  const counts = { skills: names.length, installed: 0, replaced: 0, skipped: 0 }
  const owned = []
  const prefix = dryRun ? "[dry-run] would " : ""

  if (!dryRun) {
    ensureDir(targetDir)
    cleanStaleArtifacts(targetDir)
  }

  for (const name of names) {
    const dest = join(targetDir, name)

    if (entryExists(dest) && managed && !managed.has(name) && !force) {
      console.log(`conflict, skipped (not managed by opencode-codeops; use --force): ${dest}`)
      counts.skipped += 1
      continue
    }

    const { existed } = installOneSkill({ sourceDir, targetDir, name, dryRun, link })
    owned.push(name)
    if (existed) counts.replaced += 1
    else counts.installed += 1
    console.log(`${prefix}${existed ? "replace" : "install"}: ${dest}`)
  }

  if (!dryRun) writeMarker(targetDir, { version, skills: owned })

  return { ...counts, owned }
}

/**
 * Removes only the skills recorded as owned by this package.
 *
 * The marker is the ownership record, so an unmanaged install is left intact.
 * Without a marker the function reports an error instead of guessing.
 *
 * @param details - Uninstall inputs
 * @param details.targetDir - Skills directory to clean
 * @param details.dryRun - Report only, write nothing
 * @returns Removed skill names plus the marker outcome, or a reason it refused
 */
export function uninstallSkills({ targetDir, dryRun = false }) {
  const marker = readSkillsMarker(targetDir)

  if (!marker) {
    return { removed: [], markerRemoved: false, error: "no opencode-codeops marker found" }
  }

  const removed = []

  for (const name of marker.skills ?? []) {
    const dest = join(targetDir, name)
    if (!entryExists(dest)) continue

    if (!dryRun) rmSync(dest, { recursive: true, force: true })
    removed.push(name)
    console.log(`${dryRun ? "would remove" : "removed"}: ${dest}`)
  }

  if (!dryRun) rmSync(join(targetDir, MARKER_FILE), { force: true })

  return { removed, markerRemoved: true }
}

/** Prints command usage. */
function printUsage() {
  console.log(`Install the CodeOps skills so OpenCode can discover them.

Usage:
  opencode-codeops install-skills [options]   Install or upgrade (default)
  opencode-codeops status [options]           Show the installed version
  opencode-codeops uninstall [options]        Remove the managed skills

Options:
  --global           Use ~/.config/opencode/skills (default)
  --project          Use ./.opencode/skills
  --target <dir>     Use a custom skills directory
  --source <dir>     Override the packaged skills directory
  --link             Symlink to the source instead of copying (development)
  --dry-run          Show what would happen without writing files
  --force            Replace same-named directories this package does not own
  -h, --help         Show this help`)
}

/**
 * Parses argv into a subcommand and options.
 *
 * The subcommand is optional and defaults to `install`. `install-skills` is
 * accepted as an alias for `install` so the documented `npx` invocation keeps
 * working.
 *
 * @param argv - Arguments after the executable
 * @returns The command, parsed options, and an error message when invalid
 */
export function parseArgs(argv) {
  const options = {
    project: false,
    target: null,
    source: null,
    dryRun: false,
    force: false,
    link: false,
    help: false,
  }
  let command = "install"
  let index = 0

  const first = argv[0]
  if (first && !first.startsWith("-")) {
    if (first === "install" || first === "install-skills") command = "install"
    else if (first === "status" || first === "uninstall") command = first
    else if (first === "help") command = "help"
    else return { command, options, error: `unknown command '${first}'` }
    index = 1
  }

  for (; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--global") options.project = false
    else if (arg === "--project") options.project = true
    else if (arg === "--dry-run") options.dryRun = true
    else if (arg === "--force") options.force = true
    else if (arg === "--link") options.link = true
    else if (arg === "--help" || arg === "-h") options.help = true
    else if (arg === "--target" || arg === "--source") {
      const value = argv[index + 1]
      if (!value || value.startsWith("--")) {
        return { command, options, error: `${arg} requires a directory argument` }
      }
      if (arg === "--target") options.target = value
      else options.source = value
      index += 1
    } else {
      return { command, options, error: `unknown argument '${arg}'` }
    }
  }

  return { command, options }
}

/** Prints the installed version and health for one target directory. */
function printStatus({ targetDir, sourceDir, sourceVersion }) {
  const marker = readSkillsMarker(targetDir)

  if (marker) {
    const owned = marker.skills ?? []
    console.log(`installed: v${marker.version} (${owned.length} skills)`)
    if (sourceVersion && marker.version !== sourceVersion) {
      console.log(`update available: v${sourceVersion} — run install-skills to upgrade`)
    }
    const missing = owned.filter((name) => !entryExists(join(targetDir, name)))
    if (missing.length > 0) {
      console.log(`warning: missing managed skills: ${missing.join(", ")}`)
    }
    return
  }

  const present = listSkills(sourceDir).filter((name) => entryExists(join(targetDir, name)))
  if (present.length > 0) {
    console.log(`not managed by opencode-codeops (found ${present.length} packaged skills, no marker)`)
  } else {
    console.log("not installed")
  }
}

/**
 * Runs the installer CLI.
 *
 * @param argv - Arguments after the executable
 * @param io - Injectable environment for tests
 * @param io.cwd - Project root used for `--project`
 * @param io.source - Override the packaged skills directory
 * @param io.version - Override the version recorded in the marker
 * @returns Process exit code
 */
export function main(argv, io = {}) {
  if (argv.length === 0) {
    printUsage()
    return 0
  }

  const { command, options, error } = parseArgs(argv)
  if (error) {
    console.error(`error: ${error}`)
    return 2
  }

  if (options.help || command === "help") {
    printUsage()
    return 0
  }

  const cwd = io.cwd ?? process.cwd()
  const version = io.version ?? readPackageVersion()
  const sourceDir = io.source ?? resolveSourceDir(options.source)
  const targetDir = resolveTarget(options, cwd, "skills", io.home)

  if (!existsSync(sourceDir)) {
    console.error(`error: skills directory not found: ${sourceDir}`)
    return 1
  }

  console.log(`Source: ${sourceDir}`)
  console.log(`Target: ${targetDir}`)

  // Writing through a symlinked target would mutate whatever the link points
  // at, which is often the package's own source tree. Refuse unless the user
  // explicitly overrides with --force. Status is read-only and always allowed.
  if (command !== "status" && !options.force && isSymlink(targetDir)) {
    console.error(
      `error: target skills directory is a symlink to ${realpathSync(targetDir)}; ` +
        "install/uninstall would write through it. Pass --force to proceed."
    )
    return 2
  }

  if (command === "status") {
    printStatus({ targetDir, sourceDir, sourceVersion: version })
    return 0
  }

  if (command === "uninstall") {
    const result = uninstallSkills({ targetDir, dryRun: options.dryRun })
    if (result.error) {
      console.log(`nothing to remove at ${targetDir} (${result.error})`)
      return 0
    }
    console.log(
      `${options.dryRun ? "would remove" : "removed"} ${result.removed.length} skill(s); ` +
        `marker ${options.dryRun ? "would be removed" : "removed"}`
    )
    return 0
  }

  const counts = installSkills({
    sourceDir,
    targetDir,
    version,
    force: options.force,
    dryRun: options.dryRun,
    link: options.link,
  })
  const mode = options.dryRun ? " (dry-run, nothing written)" : ""
  console.log(
    `Done${mode}: ${counts.skills} skills | ` +
      `installed ${counts.installed}, replaced ${counts.replaced}, ${counts.skipped} skipped`
  )
  if (counts.skipped > 0) {
    console.log("Re-run with --force to replace skipped directories.")
  }
  return 0
}

/**
 * True when this module is the process entry point.
 *
 * The comparison resolves symlinks because npm installs the bin as a symlink in
 * `node_modules/.bin`, so `process.argv[1]` is the link path, not the real path.
 *
 * @returns True when this file is the entry point
 */
function isMainModule() {
  if (!process.argv[1]) return false

  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1])
  } catch {
    return false
  }
}

if (isMainModule()) {
  process.exitCode = main(process.argv.slice(2))
}
