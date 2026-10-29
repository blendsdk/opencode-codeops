#!/usr/bin/env node
/**
 * Enable or disable Discovery in an existing CodeOps project.
 *
 * The toggle is deliberately small and deterministic: it edits only
 * `codeops/codeops.json` and, when the managed block exists, the Discovery
 * line in `AGENTS.md`. It refuses symlinks and malformed configuration, and
 * preserves every unrelated key.
 *
 * @module discovery-toggle
 */

import { existsSync, lstatSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/** The managed AGENTS.md line for an enabled Discovery page. */
export const DISCOVERY_LINE =
  "- Discovery: enabled — question rounds open in the local Discovery page"

const START_MARKER = "<!-- CODEOPS-PROJECT:START -->"
const END_MARKER = "<!-- CODEOPS-PROJECT:END -->"

/** A user-facing toggle failure. */
export class DiscoveryToggleError extends Error {}

/** True for a non-null, non-array object. */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** Refuse a symlink or a missing regular file. */
function assertRegularFile(path, label) {
  if (!existsSync(path)) {
    throw new DiscoveryToggleError(`${label} does not exist.`)
  }
  const stats = lstatSync(path)
  if (stats.isSymbolicLink()) {
    throw new DiscoveryToggleError(`${label} is a symlink; refusing to write through it.`)
  }
  if (!stats.isFile()) {
    throw new DiscoveryToggleError(`${label} is not a regular file.`)
  }
}

/** Refuse a symlinked codeops directory. */
function assertDirectory(path, label) {
  if (!existsSync(path)) {
    throw new DiscoveryToggleError(`${label} does not exist; run setup-codeops first.`)
  }
  const stats = lstatSync(path)
  if (stats.isSymbolicLink()) {
    throw new DiscoveryToggleError(`${label} is a symlink; refusing to write through it.`)
  }
  if (!stats.isDirectory()) {
    throw new DiscoveryToggleError(`${label} is not a directory.`)
  }
}

/** Normalize a config's discovery object without discarding known keys. */
function nextDiscovery(existing, enable) {
  if (existing !== undefined && !isPlainObject(existing)) {
    throw new DiscoveryToggleError("codeops/codeops.json has a malformed discovery object.")
  }
  const discovery = { ...(existing ?? {}) }
  discovery.enabled = enable
  if (enable && discovery.chatMaxQuestions === undefined) {
    discovery.chatMaxQuestions = 3
  }
  if (
    discovery.chatMaxQuestions !== undefined &&
    (!Number.isInteger(discovery.chatMaxQuestions) || discovery.chatMaxQuestions < 0)
  ) {
    throw new DiscoveryToggleError("discovery.chatMaxQuestions must be a non-negative integer.")
  }
  return discovery
}

/** Add or remove the managed Discovery line inside an AGENTS.md managed block. */
function updateAgents(text, enable) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n"
  const lines = text.split(/\r?\n/)
  const starts = lines
    .map((line, index) => (line.trim() === START_MARKER ? index : -1))
    .filter((index) => index >= 0)
  const ends = lines
    .map((line, index) => (line.trim() === END_MARKER ? index : -1))
    .filter((index) => index >= 0)
  if (starts.length !== 1 || ends.length !== 1 || starts[0] > ends[0]) {
    return { status: "block-missing", changed: false, text }
  }
  const start = starts[0]
  const end = ends[0]
  const block = lines.slice(start, end + 1)
  const existing = block.findIndex((line) => line.trim() === DISCOVERY_LINE)
  if (enable) {
    if (existing >= 0) return { status: "already-enabled", changed: false, text }
    const anchor = block.findIndex((line) => line.trim().startsWith("- Specialist coverage:"))
    if (anchor === -1) {
      return { status: "anchor-missing", changed: false, text }
    }
    block.splice(anchor + 1, 0, DISCOVERY_LINE)
  } else {
    if (existing === -1) return { status: "already-disabled", changed: false, text }
    block.splice(existing, 1)
  }
  lines.splice(start, end - start + 1, ...block)
  return { status: enable ? "enabled" : "disabled", changed: true, text: lines.join(eol) }
}

/**
 * Toggle Discovery for one project.
 *
 * @param {{ root?: string, enable: boolean, dryRun?: boolean }} options
 * @returns {{ configPath: string, discovery: object, changed: boolean,
 *   agents: string, dryRun: boolean }}
 */
export function toggleDiscovery(options) {
  if (typeof options.enable !== "boolean") {
    throw new DiscoveryToggleError("enable must be true or false.")
  }
  const root = resolve(options.root ?? process.cwd())
  const dryRun = options.dryRun === true
  const codeopsDir = join(root, "codeops")
  assertDirectory(codeopsDir, "codeops/")
  const configPath = join(codeopsDir, "codeops.json")
  assertRegularFile(configPath, "codeops/codeops.json")

  const original = readFileSync(configPath, "utf8")
  let config
  try {
    config = JSON.parse(original)
  } catch {
    throw new DiscoveryToggleError("codeops/codeops.json is not valid JSON.")
  }
  if (!isPlainObject(config)) {
    throw new DiscoveryToggleError("codeops/codeops.json must contain a JSON object.")
  }
  const discovery = nextDiscovery(config.discovery, options.enable)
  const nextConfig = { ...config, discovery }
  const nextText = JSON.stringify(nextConfig, null, 2) + "\n"
  const configChanged = nextText !== original

  const agentsPath = join(root, "AGENTS.md")
  let agents = "missing"
  let agentsText = null
  let agentsChanged = false
  if (existsSync(agentsPath)) {
    const stats = lstatSync(agentsPath)
    if (stats.isSymbolicLink()) {
      agents = "symlink"
    } else if (!stats.isFile()) {
      agents = "not-a-file"
    } else {
      const result = updateAgents(readFileSync(agentsPath, "utf8"), options.enable)
      agents = result.status
      agentsChanged = result.changed
      agentsText = result.text
    }
  }

  if (!dryRun) {
    if (configChanged) writeFileSync(configPath, nextText)
    if (agentsChanged && agentsText !== null) writeFileSync(agentsPath, agentsText)
  }

  return {
    configPath,
    discovery,
    changed: configChanged,
    agents,
    dryRun,
  }
}

/** Print command usage. */
function printUsage() {
  console.log(`Toggle Discovery in an existing CodeOps project.

Usage:
  node scripts/discovery-toggle.mjs --root <repo> --enable-discovery [--dry-run]
  node scripts/discovery-toggle.mjs --root <repo> --disable-discovery [--dry-run]

Options:
  --root <dir>          Repository root (defaults to the current directory)
  --enable-discovery    Set discovery.enabled to true
  --disable-discovery   Set discovery.enabled to false
  --dry-run             Show the result without writing files
  -h, --help            Show this help
`)
}

/** Run the command line. */
function main() {
  const args = process.argv.slice(2)
  if (args.includes("--help") || args.includes("-h")) {
    printUsage()
    return
  }
  const rootIndex = args.indexOf("--root")
  const root = rootIndex >= 0 ? args[rootIndex + 1] : process.cwd()
  if (root === undefined) {
    throw new DiscoveryToggleError("--root requires a directory.")
  }
  const enable = args.includes("--enable-discovery")
  const disable = args.includes("--disable-discovery")
  if (enable === disable) {
    throw new DiscoveryToggleError("Use exactly one of --enable-discovery or --disable-discovery.")
  }
  const result = toggleDiscovery({
    root,
    enable,
    dryRun: args.includes("--dry-run"),
  })
  const action = enable ? "enabled" : "disabled"
  console.log(
    `${result.dryRun ? "[dry-run] " : ""}Discovery ${action} in ${result.configPath} ` +
      `(chatMaxQuestions: ${result.discovery.chatMaxQuestions ?? "default 3"}).`,
  )
  console.log(`AGENTS.md: ${result.agents}.`)
  if (result.dryRun && result.changed) {
    console.log("No files were written.")
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
