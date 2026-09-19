#!/usr/bin/env node
/**
 * Registers (or inspects) the CodeOps plugin in OpenCode's own config.
 *
 * OpenCode ships a command that installs a plugin and updates the config
 * safely, including JSON/JSONC formatting and version replacement:
 *
 *   opencode plugin <module> [--global] [--force]
 *
 * The installer delegates to that command instead of editing `opencode.json`
 * itself, so it never has to parse JSONC or risk clobbering a user's config.
 * All calls are best-effort: if the `opencode` executable is missing or the
 * command fails, the caller still completes the file install and tells the user
 * how to register the plugin manually.
 *
 * @module lib/opencode-plugin
 */

import { spawnSync } from "node:child_process"

/** The npm package name of the plugin. */
export const PLUGIN_NAME = "opencode-codeops"

/**
 * Runs a command and normalizes the result.
 *
 * @param command - Executable to run
 * @param args - Argument list
 * @param options - Spawn options (for example `cwd`)
 * @returns The exit status, stdout, stderr, and any spawn error
 */
export function defaultRun(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf-8", ...options })
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  }
}

/**
 * Builds the arguments for `opencode plugin`.
 *
 * @param details - Plugin registration inputs
 * @param details.scope - `"global"` adds `--global`; `"project"` omits it
 * @param details.version - Exact version to pin, or `undefined` for the bare name
 * @returns Arguments after the `opencode` executable
 * @example
 * buildPluginArgs({ scope: "global", version: "1.0.0" })
 * // ["plugin", "opencode-codeops@1.0.0", "--global", "--force"]
 */
export function buildPluginArgs({ scope, version }) {
  const module = version ? `${PLUGIN_NAME}@${version}` : PLUGIN_NAME
  const args = ["plugin", module]
  if (scope === "global") args.push("--global")
  args.push("--force")
  return args
}

/**
 * Registers the plugin in the OpenCode config.
 *
 * Tries the exact version first so plugin and files stay in sync; if the CLI
 * rejects the versioned spec, falls back to the bare package name. Never throws.
 *
 * @param details - Registration inputs
 * @param details.scope - `"global"` or `"project"`
 * @param details.version - Version to pin
 * @param details.cwd - Working directory (used for project scope)
 * @param details.run - Command runner, injectable for tests
 * @returns Whether registration succeeded, the spec used, and a reason on failure
 */
export function registerPlugin({ scope, version, cwd, run = defaultRun }) {
  try {
    const probe = run("opencode", ["--version"], { cwd })
    if (probe.error || probe.status !== 0) {
      return { ok: false, spec: null, reason: "opencode CLI not found on PATH" }
    }

    const pinned = run("opencode", buildPluginArgs({ scope, version }), { cwd })
    if (!pinned.error && pinned.status === 0) {
      return { ok: true, spec: `${PLUGIN_NAME}@${version}` }
    }

    const bare = run("opencode", buildPluginArgs({ scope, version: null }), { cwd })
    if (!bare.error && bare.status === 0) {
      return { ok: true, spec: PLUGIN_NAME }
    }

    const message = (bare.stderr || bare.stdout || pinned.stderr || pinned.stdout || "").trim()
    return { ok: false, spec: null, reason: message.split("\n").pop() || "opencode plugin failed" }
  } catch (caught) {
    return { ok: false, spec: null, reason: caught.message }
  }
}

/**
 * Reads the resolved `plugin` list from OpenCode's effective config.
 *
 * @param details - Inspection inputs
 * @param details.cwd - Working directory
 * @param details.run - Command runner, injectable for tests
 * @returns The plugin entries, or `undefined` when the config cannot be read
 */
export function readConfiguredPlugin({ cwd, run = defaultRun } = {}) {
  try {
    const result = run("opencode", ["debug", "config"], { cwd })
    if (result.error || result.status !== 0) return undefined

    const config = JSON.parse(result.stdout)
    return Array.isArray(config.plugin) ? config.plugin : []
  } catch {
    return undefined
  }
}
