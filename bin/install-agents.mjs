#!/usr/bin/env node
/**
 * Install, inspect, and remove the CodeOps subagents for OpenCode.
 *
 * OpenCode discovers subagents from the filesystem: `.opencode/agents/` in a
 * project, or `~/.config/opencode/agents/` globally. This script copies the
 * packaged agent definitions (one `.md` file per role) into one of those
 * locations.
 *
 * The shipped agent files are generated from `agent-templates/` by
 * `scripts/install_agents.py`, which can also apply per-role model and
 * permission overrides from `codeops/codeops.json`. This installer copies the
 * packaged defaults; running the Python generator afterward re-applies any
 * routing overrides a project has configured.
 *
 * Ownership and atomic-replace rules match the skills installer: only files the
 * marker records are replaced, so hand-authored agents survive, and a re-run
 * upgrades in place.
 *
 * Usage:
 *   opencode-codeops install-agents [options]   Install or upgrade (default)
 *   opencode-codeops agents-status [options]    Show the installed version
 *   opencode-codeops agents-uninstall [options] Remove the managed agents
 *
 * @module install-agents
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
// package root that contains agents/ and package.json.
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

export { MARKER_FILE, readMarker }

/**
 * Reads the marker only when it is an agents marker.
 *
 * Both installers use the same marker file name, so a marker written by the
 * skills installer must not be mistaken for one that lists agents. Treating it
 * as absent is safe: it makes the install behave like a first run instead of
 * silently skipping every packaged agent.
 *
 * @param targetDir - Agents directory that may hold a marker
 * @returns The parsed agents marker, or `undefined`
 */
function readAgentsMarker(targetDir) {
  const marker = readMarker(targetDir)
  return marker && Array.isArray(marker.agents) ? marker : undefined
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
 * Resolves the directory that holds the packaged agent definitions.
 *
 * The package's own `agents/` directory is always the source, so the installed
 * agents match the package that was invoked. The `CODEOPS_PLUGIN_ROOT`
 * environment variable is deliberately ignored: the plugin exports it into
 * every shell, and honouring it would install a different checkout's agents.
 * Pass `--source` to override for development.
 *
 * @param override - Optional explicit agents directory
 * @returns Absolute path to the agents directory
 */
export function resolveSourceDir(override) {
  if (override) return resolve(override)
  return join(PACKAGE_ROOT, "agents")
}

/**
 * Lists the agent definition files shipped in a directory.
 *
 * @param sourceDir - Directory to scan
 * @returns Sorted file names ending in `.md`
 */
export function listAgents(sourceDir) {
  if (!existsSync(sourceDir)) return []

  return readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort()
}

/**
 * Writes the install marker that records ownership and the installed version.
 *
 * @param targetDir - Agents directory to mark
 * @param details - Marker contents
 * @param details.version - Installed package version
 * @param details.agents - Agent file names the package owns
 */
export function writeMarker(targetDir, { version, agents }) {
  writeMarkerFile(targetDir, {
    schema: 1,
    source: "opencode-codeops",
    version,
    installedAt: new Date().toISOString(),
    agents,
  })
}

/**
 * Installs one agent file by replacing it atomically, or by linking to it when
 * `link` is set (used by development checkouts).
 *
 * @param details - Install inputs
 * @param details.sourceDir - Agents directory holding the packaged file
 * @param details.targetDir - Agents directory to install into
 * @param details.name - Agent file name
 * @param details.dryRun - Report only, write nothing
 * @param details.link - Symlink to the source instead of copying
 * @returns Whether a previous file existed
 */
function installOneAgent({ sourceDir, targetDir, name, dryRun, link }) {
  const from = join(sourceDir, name)
  const dest = join(targetDir, name)
  const existed = entryExists(dest)

  if (dryRun) return { existed }

  if (link) {
    ensureDir(targetDir)
    linkEntry({ from, dest, type: "file" })
    return { existed }
  }

  return atomicReplace({ from, targetDir, name, recursive: false })
}

/**
 * Installs or upgrades every packaged agent into a target directory.
 *
 * Agent files named by an existing marker, plus every packaged file on a first
 * run, are replaced. A same-named file the marker does not own is skipped
 * unless `force` is set, so a hand-authored or routing-generated agent is never
 * overwritten by accident.
 *
 * @param details - Install inputs
 * @param details.sourceDir - Agents directory holding the packaged files
 * @param details.targetDir - Agents directory to install into
 * @param details.version - Version stored in the marker
 * @param details.force - Replace same-named files the marker does not own
 * @param details.dryRun - Report only, write nothing
 * @param details.link - Symlink to the source instead of copying
 * @returns Counts plus the agent names recorded in the marker
 */
export function installAgents({
  sourceDir,
  targetDir,
  version,
  force = false,
  dryRun = false,
  link = false,
}) {
  const names = listAgents(sourceDir)
  const marker = readAgentsMarker(targetDir)
  const managed = marker ? new Set(marker.agents ?? []) : null
  const counts = { agents: names.length, installed: 0, replaced: 0, skipped: 0 }
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

    const { existed } = installOneAgent({ sourceDir, targetDir, name, dryRun, link })
    owned.push(name)
    if (existed) counts.replaced += 1
    else counts.installed += 1
    console.log(`${prefix}${existed ? "replace" : "install"}: ${dest}`)
  }

  if (!dryRun) writeMarker(targetDir, { version, agents: owned })

  return { ...counts, owned }
}

/**
 * Removes only the agent files recorded as owned by this package.
 *
 * @param details - Uninstall inputs
 * @param details.targetDir - Agents directory to clean
 * @param details.dryRun - Report only, write nothing
 * @returns Removed file names plus the marker outcome, or a reason it refused
 */
export function uninstallAgents({ targetDir, dryRun = false }) {
  const marker = readAgentsMarker(targetDir)

  if (!marker) {
    return { removed: [], markerRemoved: false, error: "no opencode-codeops marker found" }
  }

  const removed = []

  for (const name of marker.agents ?? []) {
    const dest = join(targetDir, name)
    if (!entryExists(dest)) continue

    if (!dryRun) rmSync(dest, { force: true })
    removed.push(name)
    console.log(`${dryRun ? "would remove" : "removed"}: ${dest}`)
  }

  if (!dryRun) rmSync(join(targetDir, MARKER_FILE), { force: true })

  return { removed, markerRemoved: true }
}

/** Prints command usage. */
function printUsage() {
  console.log(`Install the CodeOps subagents so OpenCode can discover them.

Usage:
  opencode-codeops install-agents [options]   Install or upgrade (default)
  opencode-codeops agents-status [options]    Show the installed version
  opencode-codeops agents-uninstall [options] Remove the managed agents

Options:
  --global           Use ~/.config/opencode/agents (default)
  --project          Use ./.opencode/agents
  --target <dir>     Use a custom agents directory
  --source <dir>     Override the packaged agents directory
  --link             Symlink to the source instead of copying (development)
  --dry-run          Show what would happen without writing files
  --force            Replace same-named files this package does not own
  -h, --help         Show this help`)
}

/**
 * Parses argv into a subcommand and options.
 *
 * The subcommand is optional and defaults to `install`. The dispatcher passes
 * `agents-status` and `agents-uninstall`; the short forms are accepted too.
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
    if (first === "install" || first === "install-agents") command = "install"
    else if (first === "status" || first === "agents-status") command = "status"
    else if (first === "uninstall" || first === "agents-uninstall") command = "uninstall"
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
function printStatus({ targetDir, sourceVersion }) {
  const marker = readAgentsMarker(targetDir)

  if (marker) {
    const owned = marker.agents ?? []
    console.log(`agents: installed: v${marker.version} (${owned.length} agents)`)
    if (sourceVersion && marker.version !== sourceVersion) {
      console.log(`agents: update available: v${sourceVersion} — run install-agents to upgrade`)
    }
    const missing = owned.filter((name) => !entryExists(join(targetDir, name)))
    if (missing.length > 0) {
      console.log(`agents: warning: missing managed agents: ${missing.join(", ")}`)
    }
    return
  }

  console.log("agents: not installed")
}

/**
 * Runs the installer CLI.
 *
 * @param argv - Arguments after the executable
 * @param io - Injectable environment for tests
 * @param io.cwd - Project root used for `--project`
 * @param io.source - Override the packaged agents directory
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
  const targetDir = resolveTarget(options, cwd, "agents", io.home)

  if (!existsSync(sourceDir)) {
    console.error(`error: agents directory not found: ${sourceDir}`)
    return 1
  }

  console.log(`Source: ${sourceDir}`)
  console.log(`Target: ${targetDir}`)

  // Writing through a symlinked target would mutate whatever the link points
  // at. Refuse unless the user explicitly overrides with --force. Status is
  // read-only and always allowed.
  if (command !== "status" && !options.force && isSymlink(targetDir)) {
    console.error(
      `error: target agents directory is a symlink to ${realpathSync(targetDir)}; ` +
        "install/uninstall would write through it. Pass --force to proceed."
    )
    return 2
  }

  if (command === "status") {
    printStatus({ targetDir, sourceVersion: version })
    return 0
  }

  if (command === "uninstall") {
    const result = uninstallAgents({ targetDir, dryRun: options.dryRun })
    if (result.error) {
      console.log(`nothing to remove at ${targetDir} (${result.error})`)
      return 0
    }
    console.log(
      `${options.dryRun ? "would remove" : "removed"} ${result.removed.length} agent(s); ` +
        `marker ${options.dryRun ? "would be removed" : "removed"}`
    )
    return 0
  }

  const counts = installAgents({
    sourceDir,
    targetDir,
    version,
    force: options.force,
    dryRun: options.dryRun,
    link: options.link,
  })
  const mode = options.dryRun ? " (dry-run, nothing written)" : ""
  console.log(
    `Done${mode}: ${counts.agents} agents | ` +
      `installed ${counts.installed}, replaced ${counts.replaced}, ${counts.skipped} skipped`
  )
  if (counts.skipped > 0) {
    console.log("Re-run with --force to replace skipped files.")
  }
  return 0
}

/**
 * True when this module is the process entry point.
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
