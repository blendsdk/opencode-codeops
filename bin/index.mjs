#!/usr/bin/env node
/**
 * The `opencode-codeops` command-line entry point.
 *
 * Routes each command to the skills installer (`install-skills.mjs`) or the
 * agent installer (`install-agents.mjs`), so one package binary exposes both.
 * `status` reports on both installs because the skills and the plugin can drift
 * in version and that is the check a user needs most.
 *
 * Usage:
 *   opencode-codeops install-skills [options]   Install or upgrade skills
 *   opencode-codeops install-agents [options]   Install or upgrade subagents
 *   opencode-codeops status [options]           Show installed skills and agents
 *   opencode-codeops uninstall [options]        Remove the managed skills
 *   opencode-codeops help                       Show this help
 *
 * @module index
 */

import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"

/** Prints command usage. */
function printUsage() {
  console.log(`CodeOps installer for OpenCode.

Usage:
  opencode-codeops install-skills [options]   Install or upgrade skills (default)
  opencode-codeops install-agents [options]   Install or upgrade subagents
  opencode-codeops status [options]           Show installed skills and agents
  opencode-codeops uninstall [options]        Remove the managed skills
  opencode-codeops help                       Show this help

Run \`opencode-codeops install-skills --help\` or
\`opencode-codeops install-agents --help\` for the option list.`)
}

/**
 * Chooses the installer module for a command line.
 *
 * @param argv - Arguments after the executable
 * @returns `"agents"` for agent commands, otherwise `"skills"`
 */
export function route(argv) {
  const first = argv[0]
  if (first === "install-agents" || first === "agents-status" || first === "agents-uninstall") {
    return "agents"
  }
  return "skills"
}

/**
 * Runs the requested command.
 *
 * The modules are imported lazily so a skills-only invocation never loads the
 * agent installer, and vice versa.
 */
async function run() {
  const args = process.argv.slice(2)
  const first = args[0]

  if (!first || first === "help" || first === "-h" || first === "--help") {
    printUsage()
    return
  }

  if (first === "status") {
    const skills = await import("./install-skills.mjs")
    const agents = await import("./install-agents.mjs")
    const skillsCode = skills.main(["status", ...args.slice(1)])
    const agentsCode = agents.main(["agents-status", ...args.slice(1)])
    process.exitCode = skillsCode || agentsCode
    return
  }

  if (route(args) === "agents") {
    const { main } = await import("./install-agents.mjs")
    process.exitCode = main(args)
    return
  }

  const { main } = await import("./install-skills.mjs")
  process.exitCode = main(args)
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
  await run()
}
