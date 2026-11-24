#!/usr/bin/env node
/**
 * Registers (or inspects) the CodeOps plugin in OpenCode's own config.
 *
 * OpenCode 2 ships a command that installs a plugin and updates the config
 * safely, including JSON/JSONC formatting and version replacement. Two CLI
 * shapes exist across releases:
 *
 *   opencode plugin add <module>        (OpenCode 2 subcommand form)
 *   opencode plugin <module> [--global] (older form; still used by some builds)
 *
 * The installer probes the installed CLI once and uses the shape it accepts.
 * This CodeOps version requires OpenCode 2; running it against OpenCode 1
 * fails with a direct pointer to the 1.x line, because the plugin API changed.
 * All calls are best-effort: if the `opencode` executable is missing or the
 * command fails, the caller still completes the file install and tells the user
 * how to register the plugin manually.
 *
 * @module lib/opencode-plugin
 */

import { spawnSync } from "node:child_process"

/** The npm package name of the plugin. */
export const PLUGIN_NAME = "opencode-codeops"

/** The OpenCode major version this package requires. */
export const REQUIRED_OPENCODE_MAJOR = 2

/** Arguments that need no quoting on a Windows command line. */
const WINDOWS_BARE_ARGUMENT = /^[A-Za-z0-9_@./\\:=+,-]+$/

/** Characters the command processor would expand before the target sees them. */
const WINDOWS_UNSAFE_ARGUMENT = /["%!\r\n]/

/**
 * Quote one argument for the Windows command processor.
 *
 * CodeOps commands use bare tokens such as `--global` and package specs. A path
 * that contains spaces is wrapped in double quotes. Percent signs, exclamation
 * marks, quotes, and line breaks are rejected because `cmd.exe` expands them
 * before the target process receives the argument; no CodeOps command needs
 * those characters.
 *
 * @param value - Argument to quote
 * @returns The command-line form of the argument
 */
function quoteWindowsArgument(value) {
  const text = String(value)
  if (WINDOWS_BARE_ARGUMENT.test(text)) return text
  if (WINDOWS_UNSAFE_ARGUMENT.test(text)) {
    throw new Error(`unsupported character in Windows command argument: ${text}`)
  }
  return `"${text}"`
}

/**
 * Build the executable and arguments for one command invocation.
 *
 * Windows installs `npm`, `npx`, and `opencode` as `.cmd` shims. The Windows
 * process API cannot run a `.cmd` file directly, and Node rejects implicit shim
 * execution for security. Running the command through the system command
 * processor resolves the shim the same way a terminal does.
 *
 * The command line is passed verbatim so the quoting applied here is exactly
 * what `cmd.exe` receives.
 *
 * @param command - Executable name or path
 * @param args - Argument list
 * @param details - Platform and environment overrides for tests
 * @param details.platform - Platform to build for (defaults to the running platform)
 * @param details.env - Environment that may provide `ComSpec`
 * @returns The file to spawn, its arguments, and extra spawn options
 */
export function buildInvocation(
  command,
  args,
  { platform = process.platform, env = process.env } = {}
) {
  if (platform !== "win32") {
    return { file: command, args, options: {} }
  }

  const commandLine = [command, ...args].map(quoteWindowsArgument).join(" ")
  return {
    file: env.ComSpec ?? "cmd.exe",
    args: ["/d", "/s", "/c", commandLine],
    options: { windowsVerbatimArguments: true },
  }
}

/**
 * Runs a command and normalizes the result.
 *
 * @param command - Executable to run
 * @param args - Argument list
 * @param options - Spawn options (for example `cwd`)
 * @returns The exit status, stdout, stderr, and any spawn error
 */
export function defaultRun(command, args, options = {}) {
  let invocation
  try {
    invocation = buildInvocation(command, args)
  } catch (error) {
    return { status: 1, stdout: "", stderr: "", error }
  }

  const result = spawnSync(invocation.file, invocation.args, {
    encoding: "utf-8",
    ...invocation.options,
    ...options,
  })
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  }
}

/**
 * Turn a failed command result into one actionable line.
 *
 * A spawn failure has no stdout or stderr, so the error code is the only useful
 * detail. A normal command failure reports its last stderr line.
 *
 * @param result - Result returned by a command runner
 * @returns A short failure description
 *
 * @example
 * describeRunFailure({ status: 1, error: { code: "ENOENT" } }) // "ENOENT: ..."
 */
export function describeRunFailure(result) {
  const output = (result.stderr || result.stdout || "").trim()
  if (output) return output.split("\n").pop()

  if (result.error) {
    const code = result.error.code ? `${result.error.code}: ` : ""
    return `${code}${result.error.message ?? "command could not start"}`
  }

  return "unknown error"
}

/**
 * Extract the OpenCode major version from `opencode --version` output.
 *
 * @param versionText - Raw version output
 * @returns The major version, or `undefined` when no semver is present
 *
 * @example
 * parseOpenCodeMajor("2.0.24") // 2
 */
export function parseOpenCodeMajor(versionText) {
  const match = /(\d+)\.\d+\.\d+/.exec(String(versionText ?? ""))
  return match ? Number(match[1]) : undefined
}

/**
 * Builds the arguments for `opencode plugin`.
 *
 * @param details - Plugin registration inputs
 * @param details.scope - `"global"` adds `--global` when the CLI supports it
 * @param details.version - Exact version to pin, or `undefined` for the bare name
 * @param details.dialect - `"add"` for `plugin add <spec>`, `"positional"` otherwise
 * @param details.supportsGlobal - Whether the chosen dialect accepts `--global`
 * @returns Arguments after the `opencode` executable
 *
 * @example
 * buildPluginArgs({ scope: "global", version: "1.2.3", dialect: "add", supportsGlobal: true })
 * // ["plugin", "add", "opencode-codeops@1.2.3", "--global"]
 */
export function buildPluginArgs({ scope, version, dialect = "positional", supportsGlobal = true }) {
  const module = version ? `${PLUGIN_NAME}@${version}` : PLUGIN_NAME
  const global = scope === "global" && supportsGlobal

  if (dialect === "add") {
    const args = ["plugin", "add", module]
    if (global) args.push("--global")
    return args
  }

  const args = ["plugin", module]
  if (global) args.push("--global")
  args.push("--force")
  return args
}

/**
 * Detect which `opencode plugin` shape the installed CLI accepts.
 *
 * The subcommand form answers `opencode plugin add --help`; older builds treat
 * `add` as a module name and fail. The help text also tells whether the
 * subcommand accepts an explicit `--global` flag.
 *
 * @param details - Detection inputs
 * @param details.cwd - Working directory
 * @param details.run - Command runner, injectable for tests
 * @returns The dialect and whether it supports `--global`
 */
export function detectPluginDialect({ cwd, run = defaultRun }) {
  const help = run("opencode", ["plugin", "add", "--help"], { cwd })
  if (!help.error && help.status === 0) {
    const text = `${help.stdout}\n${help.stderr}`
    return { dialect: "add", supportsGlobal: /--global\b/.test(text) }
  }
  return { dialect: "positional", supportsGlobal: true }
}

/**
 * Registers the plugin in the OpenCode config.
 *
 * Requires OpenCode 2. Tries the exact version first so plugin and files stay
 * in sync; if the CLI rejects the versioned spec, falls back to the bare
 * package name. Never throws.
 *
 * @param details - Registration inputs
 * @param details.scope - `"global"` or `"project"`
 * @param details.version - Version to pin
 * @param details.cwd - Working directory (used for project scope)
 * @param details.run - Command runner, injectable for tests
 * @returns Whether registration succeeded, the spec used, the dialect, and a reason on failure
 */
export function registerPlugin({ scope, version, cwd, run = defaultRun }) {
  try {
    const probe = run("opencode", ["--version"], { cwd })
    if (probe.error || probe.status !== 0) {
      const detail = describeRunFailure(probe)
      return {
        ok: false,
        spec: null,
        reason: /ENOENT/.test(detail)
          ? "opencode CLI not found on PATH"
          : `opencode CLI could not be started: ${detail}`,
      }
    }

    const major = parseOpenCodeMajor(probe.stdout)
    if (major !== undefined && major < REQUIRED_OPENCODE_MAJOR) {
      return {
        ok: false,
        spec: null,
        reason:
          `OpenCode ${REQUIRED_OPENCODE_MAJOR} is required (found ${probe.stdout.trim()}); ` +
          "on OpenCode 1, use opencode-codeops@1",
      }
    }

    const { dialect, supportsGlobal } = detectPluginDialect({ cwd, run })
    let lastMessage = "opencode plugin command failed"

    for (const candidate of [version, null]) {
      const args = buildPluginArgs({ scope, version: candidate, dialect, supportsGlobal })
      const result = run("opencode", args, { cwd })
      if (!result.error && result.status === 0) {
        return {
          ok: true,
          spec: candidate ? `${PLUGIN_NAME}@${candidate}` : PLUGIN_NAME,
          dialect,
        }
      }
      const message = (result.stderr || result.stdout || "").trim()
      lastMessage = message.split("\n").pop() || lastMessage
    }

    return { ok: false, spec: null, reason: lastMessage }
  } catch (caught) {
    return { ok: false, spec: null, reason: caught.message }
  }
}

/**
 * Normalize one configured plugin entry to its package spec.
 *
 * OpenCode accepts plain spec strings, `[spec, options]` tuples, and
 * `{ package, options }` objects across versions, so the status readout must
 * understand all three.
 *
 * @param item - Raw config entry
 * @returns The spec string, or `undefined` when the entry is unusable
 */
function entrySpec(item) {
  if (typeof item === "string") return item
  if (Array.isArray(item) && typeof item[0] === "string") return item[0]
  if (item && typeof item === "object" && typeof item.package === "string") {
    return item.package
  }
  return undefined
}

/**
 * Normalize the plugin entries from one configuration document.
 *
 * A document's `info` may carry the native `plugins` array or the legacy
 * singular `plugin` array; both are read so mixed configurations are reported
 * correctly.
 *
 * @param info - Configuration document info object
 * @returns The document's plugin spec strings
 */
function documentPlugins(info) {
  if (!info || typeof info !== "object") return []
  const raw = Array.isArray(info.plugins)
    ? info.plugins
    : Array.isArray(info.plugin)
      ? info.plugin
      : []
  return raw.map(entrySpec).filter((spec) => typeof spec === "string")
}

/**
 * Reads the resolved plugin list from OpenCode's effective config.
 *
 * OpenCode 2 prints the list of configuration sources, each with its document
 * under `info`; OpenCode 1 printed one resolved config object. Both shapes are
 * understood, and the legacy `plugin` key is read as a fallback so mixed
 * configurations are reported correctly.
 *
 * @param details - Inspection inputs
 * @param details.cwd - Working directory
 * @param details.run - Command runner, injectable for tests
 * @returns The plugin spec strings, or `undefined` when the config cannot be read
 */
export function readConfiguredPlugin({ cwd, run = defaultRun } = {}) {
  try {
    const result = run("opencode", ["debug", "config"], { cwd })
    if (result.error || result.status !== 0) return undefined

    const parsed = JSON.parse(result.stdout)
    const sources = Array.isArray(parsed) ? parsed : [parsed]
    const specs = []
    for (const source of sources) {
      if (source && typeof source === "object" && "info" in source) {
        specs.push(...documentPlugins(source.info))
      }
    }
    if (specs.length > 0) return specs

    return documentPlugins(parsed)
  } catch {
    return undefined
  }
}
