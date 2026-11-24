#!/usr/bin/env node
/**
 * Full CodeOps upgrade orchestration.
 *
 * `install`/`update` refresh the skills, agents, and plugin registration from
 * the version that is already running. `upgrade` goes one step further: it
 * replaces the globally installed npm package with the requested release,
 * removes every stale CodeOps plugin entry from OpenCode's config, then runs
 * the new version's installer for the global scope and, when the working
 * directory is a CodeOps project, for the project scope as well.
 *
 * The command is intentionally boring: each step is one child process whose
 * failure is reported instead of hidden. Package installation runs before the
 * plugin is removed so a failed download never leaves the user without a
 * working plugin.
 *
 * @module lib/upgrade
 */

import { existsSync } from "node:fs"
import { join } from "node:path"

import { defaultRun, PLUGIN_NAME, readConfiguredPlugin } from "./opencode-plugin.mjs"

/**
 * Reject a version or dist-tag that could change the meaning of a package
 * specifier.
 *
 * @param version - Raw version, dist-tag, or `latest`
 * @returns True when the value is safe to interpolate
 */
export function isSafeVersion(version) {
  return typeof version === "string" && /^[A-Za-z0-9._-]+$/.test(version)
}

/**
 * Resolve the project root and decide whether the project scope applies.
 *
 * @param cwd - Working directory
 * @param run - Command runner
 * @returns True when `.opencode/` or `codeops/.codeops.yml` exists at the root
 */
export function isProjectScope(cwd, run) {
  let root = cwd
  const git = run("git", ["rev-parse", "--show-toplevel"], { cwd })
  if (git.status === 0 && git.stdout.trim() !== "") root = git.stdout.trim()
  return existsSync(join(root, ".opencode")) || existsSync(join(root, "codeops", ".codeops.yml"))
}

/**
 * Upgrade CodeOps globally and, when applicable, in the current project.
 *
 * @param details - Upgrade inputs
 * @param details.cwd - Working directory (defaults to the process directory)
 * @param details.version - Dist-tag or exact version (defaults to `latest`)
 * @param details.project - Whether to refresh a detected project scope
 * @param details.dryRun - Print the planned commands without running them
 * @param details.run - Command runner, injectable for tests
 * @param details.log - Output sink, injectable for tests
 * @returns The exit code and a short result message
 */
export function upgrade({
  cwd = process.cwd(),
  version = process.env.CODEOPS_VERSION ?? "latest",
  project = true,
  dryRun = false,
  run = defaultRun,
  log = console.log,
} = {}) {
  if (!isSafeVersion(version)) {
    return { code: 2, message: `invalid CODEOPS_VERSION or version: ${String(version)}` }
  }

  const spec = `${PLUGIN_NAME}@${version}`
  const includeProject = project && isProjectScope(cwd, run)

  if (dryRun) {
    log(`[dry-run] would install ${spec} globally`)
    log(`[dry-run] would remove stale ${PLUGIN_NAME} plugin entries from OpenCode`)
    log(`[dry-run] would run: npx -y ${spec} install --global`)
    if (includeProject) log(`[dry-run] would run: npx -y ${spec} install --project --no-plugin`)
    log("[dry-run] no files or packages were changed")
    return { code: 0, message: "dry run" }
  }

  log(`Installing ${spec} globally...`)
  const installed = run("npm", ["install", "--global", spec], { cwd })
  if (installed.status !== 0) {
    const detail = (installed.stderr || installed.stdout || "").trim().split("\n").pop()
    return {
      code: 1,
      message: `npm install failed: ${detail || "unknown error"}. ` +
        `Retry with: npm install --global ${spec}`,
    }
  }

  const configured = readConfiguredPlugin({ cwd, run })
  if (configured === undefined) {
    log("Plugin: could not read the OpenCode config; the installer will re-register the plugin.")
  } else {
    const stale = [
      ...new Set(
        configured.filter(
          (entry) => entry === PLUGIN_NAME || entry.startsWith(`${PLUGIN_NAME}@`)
        )
      ),
    ]
    for (const entry of stale) {
      const removed = run("opencode", ["plugin", "remove", entry], { cwd })
      if (removed.status === 0) {
        log(`Plugin: removed ${entry}`)
      } else {
        log(`Plugin: could not remove ${entry}; the installer will replace it.`)
      }
    }
  }

  log("Installing global skills, agents, and plugin...")
  const global = run("npx", ["-y", spec, "install", "--global"], { cwd })
  if (global.status !== 0) {
    const detail = (global.stderr || global.stdout || "").trim().split("\n").pop()
    return {
      code: 1,
      message: `global installer failed: ${detail || "unknown error"}. ` +
        `Retry with: npx -y ${spec} install --global`,
    }
  }

  if (includeProject) {
    log("Installing project skills and agents...")
    const local = run("npx", ["-y", spec, "install", "--project", "--no-plugin"], { cwd })
    if (local.status !== 0) {
      const detail = (local.stderr || local.stdout || "").trim().split("\n").pop()
      return {
        code: 1,
        message: `project installer failed: ${detail || "unknown error"}. ` +
          `Retry with: npx -y ${spec} install --project --no-plugin`,
      }
    }
  } else {
    log("Project: no CodeOps project detected; skipped the project scope.")
  }

  log(`Upgrade complete: ${spec}. Restart OpenCode to load the new version.`)
  return { code: 0, message: `upgraded to ${spec}` }
}
