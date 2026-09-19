#!/usr/bin/env node
/**
 * The `opencode-codeops` command-line entry point.
 *
 * There is exactly one installation path: a command installs or updates the
 * skills and the subagents together. The two filesystems installers
 * (`install-skills.mjs` and `install-agents.mjs`) are implementation details
 * this module orchestrates; they are never exposed as separate user commands.
 *
 * The scope is auto-detected. Inside a CodeOps project the files go to
 * `.opencode/skills` and `.opencode/agents`; anywhere else they go to the
 * global `~/.config/opencode/` directories. `--project` and `--global` override
 * the detection.
 *
 * Usage:
 *   opencode-codeops install [options]     Install or upgrade skills and agents
 *   opencode-codeops update [options]      Alias of install
 *   opencode-codeops status [options]      Show installed versions
 *   opencode-codeops uninstall [options]   Remove managed files
 *   opencode-codeops help                  Show this help
 *
 * @module index
 */

import { execFileSync } from "node:child_process"
import { existsSync, realpathSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

/** Commands this CLI understands. */
const COMMANDS = new Set(["install", "update", "status", "uninstall", "help"])

/** Prints command usage. */
function printUsage() {
  console.log(`CodeOps installer for OpenCode.

Usage:
  opencode-codeops install [options]     Install or upgrade skills and agents (default)
  opencode-codeops update [options]      Alias of install
  opencode-codeops status [options]      Show installed skills and agents
  opencode-codeops uninstall [options]   Remove managed skills and agents
  opencode-codeops help                  Show this help

Options:
  --project          Force the project scope (./.opencode)
  --global           Force the global scope (~/.config/opencode)
  --dry-run          Show what would happen without writing files
  --force            Replace same-named files this package does not own
  --link             Symlink to the source instead of copying (development)
  -h, --help         Show this help

Scope is auto-detected: inside a CodeOps project (a git repo with .opencode/ or
codeops/.codeops.yml) the files go to .opencode/; otherwise to ~/.config/opencode/.`)
}

/**
 * Finds the git top-level directory for a working directory.
 *
 * @param cwd - Directory to start from
 * @returns The repository root, or `cwd` when it is not a git checkout
 */
function findProjectRoot(cwd) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return cwd
  }
}

/**
 * Resolves whether files install into the project or globally.
 *
 * Explicit flags win. Otherwise a git repository is a CodeOps project when it
 * already contains `.opencode/` or `codeops/.codeops.yml`; anything else uses
 * the global scope.
 *
 * @param options - Scope flags from the command line
 * @param options.project - Force the project scope
 * @param options.global - Force the global scope
 * @param cwd - Directory the command ran from
 * @returns `"project"` or `"global"`
 */
export function resolveScope(options, cwd) {
  if (options.project) return "project"
  if (options.global) return "global"

  const root = findProjectRoot(cwd)
  if (existsSync(join(root, ".opencode")) || existsSync(join(root, "codeops", ".codeops.yml"))) {
    return "project"
  }
  return "global"
}

/**
 * Runs one command against both installers.
 *
 * @param command - `install`, `status`, or `uninstall`
 * @param rest - Options to forward, without the scope flags (re-added below)
 * @param io - Injectable environment (`cwd`, `home`) for tests
 * @returns The combined process exit code
 */
async function runCombined(command, rest, io) {
  const skills = await import("./install-skills.mjs")
  const agents = await import("./install-agents.mjs")

  const cwd = io.cwd ?? process.cwd()
  const scope = resolveScope(
    { project: rest.includes("--project"), global: rest.includes("--global") },
    cwd
  )
  const passed = rest.filter((arg) => arg !== "--project" && arg !== "--global")
  const scoped = [scope === "project" ? "--project" : "--global", ...passed]

  const skillsCode = skills.main([command, ...scoped], io)
  const agentsCode = agents.main([command, ...scoped], io)
  return skillsCode || agentsCode
}

/**
 * Dispatches a command line.
 *
 * Bare options (for example `opencode-codeops --project`) mean `install`, so the
 * common case needs no subcommand.
 *
 * @param argv - Arguments after the executable
 * @param io - Injectable environment (`cwd`, `home`) for tests
 * @returns The process exit code
 */
export async function dispatch(argv, io = {}) {
  const first = argv[0]
  const rest = argv.slice(1)

  if (!first || first === "help" || first === "-h" || first === "--help") {
    printUsage()
    return 0
  }

  // Keep the unified help; the internal installers still document the old
  // component commands in their own usage text.
  if (rest.includes("--help") || rest.includes("-h")) {
    printUsage()
    return 0
  }

  if (first.startsWith("-")) return runCombined("install", argv, io)

  if (!COMMANDS.has(first)) {
    console.error(`error: unknown command '${first}'`)
    printUsage()
    return 2
  }

  const command = first === "update" ? "install" : first
  return runCombined(command, rest, io)
}

/**
 * Runs the CLI when this module is the process entry point.
 *
 * The comparison resolves symlinks because npm installs the bin as a symlink in
 * `node_modules/.bin`, so `process.argv[1]` is the link path, not the real path.
 */
async function run() {
  process.exitCode = await dispatch(process.argv.slice(2))
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
  await run()
}
