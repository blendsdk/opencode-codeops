#!/usr/bin/env node
/**
 * `codeops-test` — select and run affected test groups.
 *
 * The CLI is intentionally thin: the map loader, validator, selector, and
 * runner own the behavior. This file parses argv, wires the pieces together,
 * chooses the documented exit code, and formats output.
 *
 * All commands are argv-safe and read-only except log creation and the optional
 * `--record` file. The tool never edits a test, a map, or CI configuration.
 *
 * @module bin/codeops-test
 */

import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { loadMap, MapLoadError, normalizeRepoPath } from "./lib/test-map.mjs"
import { exitCodeFor, validateMap } from "./lib/test-map-validate.mjs"
import { formatSelection, formatSelectionJson } from "./lib/test-selection-explain.mjs"
import { selectTests, ALL_GATES } from "./lib/test-selection.mjs"
import { collectChanges, SelectionError } from "./lib/test-selection-changes.mjs"
import {
  DEFAULT_FULL_TIMEOUT_SECONDS,
  probeRequirement,
  runArgv,
  runCommands,
} from "./lib/test-runner.mjs"

const USAGE = `Usage: codeops-test <command> [options]

Commands:
  select       Compute a test selection (does not execute)
  run          Compute and execute the selected groups
  check        Validate the map and report ownership/health issues
  plan         Emit a CI matrix for a gate
  shadow       Compare selected and full runs
  provenance   Write or verify release evidence

Options:
  --gate <task|phase|pr|release|acceptance|nightly>
  --baseline <tree|ref>      Explicit base (also --since)
  --root <path>              Repository root
  --map <path>               Alternate map file or directory
  --json                     Machine-readable output
  --explain                  Add reasons to select/run output
  --full                     Force the full suite
  --include <path>           Treat a path as changed (repeatable)
  --group <id>               Run only the named selected group (repeatable)
  --selection <file>         Run from a precomputed selection
  --full-command <argv...>   Full command tokens (repeatable)
  --last-full-sha <sha>      Last successful full-run marker
  --no-fallback              Fail instead of falling back to full
  --keep-logs                Keep successful logs
  --metrics                  Emit content-free metrics
  --strict                   Promote check warnings to errors
  --fail-fast / --no-fail-fast
  --concurrency <n>          Maximum parallel groups (default 1)
  --timeout <seconds>        Per-group timeout
  --record <file>            Write evidence JSON
  --artifact <path>          Artifact for provenance
  --quiet                    Compact output
`

/** Error raised for malformed command-line input. */
class UsageError extends Error {}

/** Options that consume one value. */
const VALUE_OPTIONS = new Set([
  "--gate",
  "--baseline",
  "--since",
  "--root",
  "--map",
  "--include",
  "--group",
  "--selection",
  "--last-full-sha",
  "--concurrency",
  "--timeout",
  "--record",
  "--artifact",
  "--coverage",
  "--acceptance",
  "--full-run-id",
  "--source-commit",
  "--commit",
])

/** Boolean options. */
const BOOLEAN_OPTIONS = new Set([
  "--json",
  "--explain",
  "--full",
  "--no-fallback",
  "--keep-logs",
  "--metrics",
  "--strict",
  "--fail-fast",
  "--no-fail-fast",
  "--quiet",
])

/**
 * Parse argv into one options object.
 *
 * `--full-command` consumes every following token up to the next option, so a
 * multi-token command stays one argv. Repeating the flag adds another command.
 *
 * @param {string[]} argv Raw arguments after the program name.
 * @returns {object} Parsed options.
 * @throws {UsageError} On unknown, duplicated, or incomplete options.
 */
function parseArgs(argv) {
  const command = argv[0]
  if (!command || command === "--help" || command === "-h") {
    return { command: "help" }
  }
  if (!["select", "run", "check", "plan", "shadow", "provenance"].includes(command)) {
    throw new UsageError(`unknown command: ${command}`)
  }

  const options = {
    command,
    include: [],
    group: [],
    fullCommands: [],
    failFast: true,
    concurrency: 1,
  }

  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === "--full-command") {
      const tokens = []
      const isKnownOption = (value) => VALUE_OPTIONS.has(value) || BOOLEAN_OPTIONS.has(value) || value === "--full-command"
      while (index + 1 < argv.length && !isKnownOption(argv[index + 1])) {
        tokens.push(argv[index + 1])
        index += 1
      }
      if (tokens.length === 0) throw new UsageError("--full-command needs at least one argv token")
      options.fullCommands.push(tokens)
      continue
    }

    if (BOOLEAN_OPTIONS.has(token)) {
      if (token === "--fail-fast") options.failFast = true
      else if (token === "--no-fail-fast") options.failFast = false
      else options[toKey(token)] = true
      continue
    }

    if (VALUE_OPTIONS.has(token)) {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith("--")) throw new UsageError(`${token} needs a value`)
      index += 1
      if (token === "--include") options.include.push(value)
      else if (token === "--group") options.group.push(value)
      else if (token === "--since") options.baseline = value
      else if (token === "--concurrency") options.concurrency = parsePositiveInteger(token, value)
      else if (token === "--timeout") options.timeout = parsePositiveInteger(token, value)
      else options[toKey(token)] = value
      continue
    }

    throw new UsageError(`unknown option: ${token}`)
  }

  if (options.gate && !ALL_GATES.includes(options.gate)) {
    throw new UsageError(`unknown gate: ${options.gate}`)
  }
  if (options.command === "provenance") {
    throw new UsageError("provenance support is added with the release-evidence phase")
  }
  return options
}

/**
 * Convert an option flag to its property name.
 *
 * @param {string} flag Flag such as `--last-full-sha`.
 * @returns {string} Camel-case property name.
 */
function toKey(flag) {
  return flag
    .replace(/^--/, "")
    .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Parse a positive integer option.
 *
 * @param {string} flag Option name for the error message.
 * @param {string} value Raw value.
 * @returns {number} Parsed integer.
 * @throws {UsageError} When the value is not a positive integer.
 */
function parsePositiveInteger(flag, value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new UsageError(`${flag} must be a positive integer`)
  return parsed
}

/**
 * Resolve the repository root from an explicit path or Git.
 *
 * @param {string} [explicit] Explicit root.
 * @returns {string} Absolute root.
 */
function resolveRoot(explicit) {
  if (explicit) return resolve(explicit)
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" })
  if (result.status === 0 && result.stdout.trim()) return resolve(result.stdout.trim())
  return process.cwd()
}

/**
 * Read the current branch or a detached tag name.
 *
 * @param {string} root Repository root.
 * @returns {string} Branch name.
 */
function currentBranch(root) {
  const branch = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root, encoding: "utf8" })
  const value = branch.stdout?.trim() ?? ""
  if (value && value !== "HEAD") return value
  const tag = spawnSync("git", ["describe", "--tags", "--exact-match"], { cwd: root, encoding: "utf8" })
  return tag.status === 0 && tag.stdout.trim() ? tag.stdout.trim() : value
}

/**
 * Choose a gate from the branch when `--gate` is absent.
 *
 * @param {string} branch Current branch or tag.
 * @returns {string} Gate name.
 */
function defaultGate(branch) {
  if (/^v\d/.test(branch) || branch.startsWith("release/") || branch.startsWith("release-") || branch.startsWith("hotfix/") || branch.startsWith("hotfix-")) {
    return "release"
  }
  if (branch.startsWith("acceptance/") || branch.startsWith("acceptance-")) return "acceptance"
  if (branch === "main" || branch === "master") return "pr"
  return "task"
}

/**
 * List tracked files for health checks and `{tests}` expansion.
 *
 * @param {string} root Repository root.
 * @returns {string[]} Repository-relative paths.
 */
function listTrackedFiles(root) {
  const result = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" })
  if (result.status !== 0) return []
  return result.stdout.split("\0").filter(Boolean).map(normalizeRepoPath)
}

/**
 * Build a full-suite result when the map cannot be used.
 *
 * @param {object} input Fallback input.
 * @param {string} input.reason Stable reason.
 * @param {string} [input.gate] Gate.
 * @param {object|null} input.policy Map policy.
 * @param {string|null} input.mapHash Map hash.
 * @param {string[]} [input.changed] Changed paths.
 * @returns {object} Full selection result.
 */
function fallbackResult({ reason, gate, policy, mapHash, changed = [] }) {
  const full = policy?.full ?? null
  const commands = !Array.isArray(full)
    ? []
    : full.every((token) => typeof token === "string")
      ? [{ id: "full", argv: [...full], cwd: "." }]
      : full.map((argv, index) => ({ id: `full.${index + 1}`, argv: [...argv], cwd: "." }))
  return {
    schema: 1,
    mode: "full",
    gate,
    base: null,
    mapHash,
    changed,
    selected: [],
    deferred: [],
    skipped: [],
    commands,
    budget: { estimatedSec: 0, status: "not-applicable" },
    warnings: [],
    reason,
    fullCommand: full,
    unknownPaths: [],
  }
}

/**
 * Load the map and compute a selection for the current options.
 *
 * @param {object} options Parsed options.
 * @returns {{root: string, map: object|null, mapHash: string|null, result: object, mapError: string|null}}
 */
function computeSelection(options) {
  const root = resolveRoot(options.root)
  let loaded
  try {
    loaded = loadMap({ root, mapPath: options.map })
  } catch (error) {
    if (!(error instanceof MapLoadError)) throw error
    return {
      root,
      map: null,
      mapHash: null,
      mapError: error.code,
      result: fallbackResult({ reason: error.code, gate: options.gate ?? "task", policy: null, mapHash: null }),
    }
  }

  const map = loaded.mode === "map" ? loaded.map : null
  const mapHash = loaded.mode === "map" ? loaded.mapHash : null
  const branch = currentBranch(root)
  const gate = options.gate ?? defaultGate(branch)
  const files = listTrackedFiles(root)

  if (map) {
    const report = validateMap(map, { files })
    if (report.errors.length > 0) {
      return {
        root,
        map,
        mapHash,
        mapError: report.errors[0].code,
        result: fallbackResult({ reason: report.errors[0].code, gate, policy: map.policy, mapHash }),
      }
    }
  }

  let changes
  try {
    changes = collectChanges({
      root,
      baseline: options.baseline,
      lastFullSha: options.lastFullSha,
      branch,
      include: options.include,
      env: process.env,
    })
  } catch (error) {
    if (!(error instanceof SelectionError)) throw error
    return {
      root,
      map,
      mapHash,
      mapError: error.reason,
      result: fallbackResult({
        reason: error.reason,
        gate,
        policy: map?.policy ?? null,
        mapHash,
        changed: options.include,
      }),
    }
  }

  const result = selectTests({
    map,
    mapHash,
    changed: changes.changed,
    files,
    gate,
    include: options.include,
    explicitFull: options.full === true,
    env: process.env,
    base: changes.base,
  })
  return { root, map, mapHash, result, mapError: null }
}

/**
 * Print a selection in the requested format.
 *
 * @param {object} result Selection result.
 * @param {object} options Parsed options.
 */
function printSelection(result, options) {
  process.stdout.write(options.json ? formatSelectionJson(result) : `${formatSelection(result)}\n`)
}

/**
 * Print one content-free metrics line.
 *
 * @param {object} result Selection result.
 * @param {object} options Parsed options.
 */
function printMetrics(result, options) {
  if (!options.metrics) return
  const total = result.selected.length + result.deferred.length + result.skipped.length
  process.stdout.write(
    `metrics: gate=${result.gate} selected=${result.selected.length} total=${total} budget=${result.budget.status} fallback=${result.reason ?? "none"} mapHash=${result.mapHash ?? "none"}\n`,
  )
}

/**
 * Execute the `select` command.
 *
 * @param {object} options Parsed options.
 * @returns {number} Exit code.
 */
function commandSelect(options) {
  const { result, mapError } = computeSelection(options)
  printSelection(result, options)
  printMetrics(result, options)
  if (options.noFallback && result.mode === "full" && result.reason !== "forced") {
    return mapError ? 3 : 5
  }
  return 0
}

/**
 * Load a precomputed selection and verify it matches the current map.
 *
 * @param {string} file Selection file.
 * @param {string} root Repository root.
 * @returns {object} Selection JSON.
 * @throws {UsageError} When the file is unreadable or stale.
 */
function readSelection(file, root) {
  const absolute = resolve(root, file)
  if (!existsSync(absolute)) throw new UsageError(`selection file not found: ${file}`)
  try {
    return JSON.parse(readFileSync(absolute, "utf8"))
  } catch (error) {
    throw new UsageError(`selection file is not valid JSON: ${error.message}`)
  }
}

/**
 * Execute the `run` command.
 *
 * @param {object} options Parsed options.
 * @returns {Promise<number>} Exit code.
 */
async function commandRun(options) {
  const computed = computeSelection(options)
  const { root, map } = computed
  let result = computed.result

  if (options.selection) {
    const selected = readSelection(options.selection, root)
    if (selected.mapHash !== computed.mapHash) {
      process.stderr.write("selection map hash does not match the current map\n")
      return 2
    }
    result = selected
  }

  if (map) {
    const report = validateMap(map, { files: listTrackedFiles(root) })
    if (report.errors.length > 0) {
      process.stderr.write(`invalid map: ${report.errors[0].code} ${report.errors[0].message}\n`)
      return 3
    }
  }

  if (result.mode === "none") {
    process.stdout.write("no tests required\n")
    return 0
  }

  let commands = result.commands ?? []
  if (result.mode === "full") {
    commands = options.fullCommands.length > 0
      ? options.fullCommands.map((argv, index) => ({ id: `full.${index + 1}`, argv, cwd: "." }))
      : commands
    if (commands.length === 0) {
      process.stderr.write("full selection has no configured command; pass --full-command <argv>\n")
      return 5
    }
  }

  if (options.group.length > 0) {
    const selectedIds = new Set((result.selected ?? []).map((entry) => entry.id))
    const unknown = options.group.filter((id) => !selectedIds.has(id))
    if (unknown.length > 0) {
      process.stderr.write(`group not selected: ${unknown.join(", ")}\n`)
      return 2
    }
    commands = commands.filter((command) => options.group.includes(command.id))
  }

  const groupById = new Map((map?.groups ?? []).map((group) => [group.id, group]))
  const executable = []
  const results = []
  const probes = new Map()
  for (const command of commands) {
    const group = groupById.get(command.id)
    if (group) {
      let missing = null
      for (const requirement of group.requires ?? []) {
        const probe = map?.policy?.requirements?.[requirement]?.check
        if (!probe) {
          missing = requirement
          break
        }
        if (!probes.has(requirement)) probes.set(requirement, await probeRequirement({ argv: probe, root }))
        if (!probes.get(requirement)) {
          missing = requirement
          break
        }
      }
      if (missing) {
        results.push({
          id: command.id,
          status: "failed",
          exitCode: 1,
          durationMs: 0,
          logPath: null,
          output: `requires.missing: ${missing}\n`,
          tail: `requires.missing: ${missing}`,
        })
        if (options.failFast) break
        continue
      }
    }
    executable.push({ ...command, parallelSafe: group?.parallelSafe === true })
  }

  const timeoutSeconds = options.timeout ?? (result.mode === "full" ? DEFAULT_FULL_TIMEOUT_SECONDS : undefined)
  const runResults = await runCommands(executable, {
    root,
    concurrency: options.concurrency,
    failFast: options.failFast,
    timeoutSeconds,
    env: process.env,
    gate: result.gate,
    keepLogs: options.keepLogs === true,
  })
  results.push(...runResults)

  let failed = false
  for (const entry of results) {
    if (entry.status === "passed") {
      if (!options.quiet) process.stdout.write(`${entry.id} PASS ${entry.durationMs}ms\n`)
      continue
    }
    failed = true
    process.stdout.write(`${entry.id} FAIL ${entry.durationMs}ms\n`)
    if (entry.tail) process.stdout.write(`${entry.tail}\n`)
    if (entry.logPath) process.stdout.write(`log: ${entry.logPath}\n`)
  }

  if (result.mode === "full" && !options.quiet) {
    process.stdout.write(`mode: full (${result.reason ?? "forced"})\n`)
  }
  process.stdout.write(failed ? "FAIL\n" : "PASS\n")
  printMetrics(result, options)

  if (options.record) {
    const recordPath = resolve(root, options.record)
    writeFileSync(
      recordPath,
      `${JSON.stringify({ schema: 1, selection: result, results, gate: result.gate, result: failed ? "failed" : "passed" }, null, 2)}\n`,
    )
  }
  return failed ? 1 : 0
}

/**
 * Execute the `check` command.
 *
 * @param {object} options Parsed options.
 * @returns {number} Exit code.
 */
function commandCheck(options) {
  const root = resolveRoot(options.root)
  let loaded
  try {
    loaded = loadMap({ root, mapPath: options.map })
  } catch (error) {
    if (!(error instanceof MapLoadError)) throw error
    process.stdout.write(`${error.code}: ${error.message}\n`)
    return 3
  }
  if (loaded.mode === "no-map") {
    process.stdout.write("no test map\n")
    return 0
  }

  const report = validateMap(loaded.map, { files: listTrackedFiles(root) })
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } else {
    for (const entry of report.errors) process.stdout.write(`${entry.code}: ${entry.message}\n`)
    for (const entry of report.warnings) process.stdout.write(`${entry.code}: ${entry.message}\n`)
    if (report.errors.length === 0 && report.warnings.length === 0) process.stdout.write("map ok\n")
  }
  return exitCodeFor(report, { strict: options.strict === true })
}

/**
 * Execute the `plan` command.
 *
 * @param {object} options Parsed options.
 * @returns {number} Exit code.
 */
function commandPlan(options) {
  const { result, map } = computeSelection(options)
  const total = map?.groups.length ?? 0
  const matrix =
    result.mode === "groups"
      ? {
          include: result.commands.map((command) => ({
            group: command.id,
            command: command.argv,
            cwd: command.cwd,
          })),
        }
      : { include: [] }
  const plan = {
    schema: 1,
    gate: result.gate,
    mode: result.mode,
    full: result.mode === "full" || result.gate === "release" || result.gate === "acceptance",
    selected: result.selected.length,
    total,
    mapHash: result.mapHash,
    matrix,
    fullCommand: result.fullCommand,
    reason: result.reason,
  }
  process.stdout.write(options.json ? `${JSON.stringify(plan, null, 2)}\n` : `${formatSelection(result)}\n`)
  if (options.noFallback && result.mode === "full" && result.reason !== "forced") return 5
  return 0
}

/**
 * Execute the `shadow` command.
 *
 * @param {object} options Parsed options.
 * @returns {Promise<number>} Exit code.
 */
async function commandShadow(options) {
  const { root, map, result } = computeSelection(options)
  const selectedResults = await runCommands(result.commands ?? [], {
    root,
    concurrency: options.concurrency,
    failFast: false,
    env: process.env,
    gate: result.gate,
    keepLogs: options.keepLogs === true,
  })
  const selectedPassed = selectedResults.every((entry) => entry.status === "passed")

  let fullCommands = options.fullCommands
  if (fullCommands.length === 0 && Array.isArray(map?.policy?.full)) {
    fullCommands = map.policy.full.every((token) => typeof token === "string")
      ? [map.policy.full]
      : map.policy.full
  }
  if (fullCommands.length === 0) {
    process.stderr.write("shadow needs a configured full command or --full-command <argv>\n")
    return 5
  }

  const fullResults = []
  for (const [index, argv] of fullCommands.entries()) {
    fullResults.push(
      await runArgv({
        id: `full.${index + 1}`,
        argv,
        root,
        env: process.env,
        gate: result.gate,
        keepLogs: options.keepLogs === true,
        serial: index,
      }),
    )
  }
  const fullPassed = fullResults.every((entry) => entry.status === "passed")
  const verdict = selectedPassed && fullPassed
    ? "zero-missed"
    : !selectedPassed && fullPassed
      ? "selected-failure"
      : selectedPassed && !fullPassed
        ? "escaped"
        : "both-failed"

  const record = {
    schema: 1,
    verdict,
    gate: result.gate,
    changed: result.changed,
    mapHash: result.mapHash,
    selected: (result.selected ?? []).map((entry) => entry.id),
    selectedResult: selectedPassed ? "passed" : "failed",
    fullResult: fullPassed ? "passed" : "failed",
    escaped: selectedPassed && !fullPassed ? ["full"] : [],
    enabled: false,
    failures: [...selectedResults, ...fullResults]
      .filter((entry) => entry.status !== "passed")
      .map((entry) => ({ id: entry.id, status: entry.status, tail: entry.tail, logPath: entry.logPath })),
  }

  if (options.record) writeFileSync(resolve(root, options.record), `${JSON.stringify(record, null, 2)}\n`)
  if (options.json) process.stdout.write(`${JSON.stringify(record, null, 2)}\n`)
  else {
    process.stdout.write(`verdict: ${verdict}\nselected: ${record.selectedResult}\nfull: ${record.fullResult}\n`)
    for (const failure of record.failures) {
      if (failure.tail) process.stdout.write(`${failure.id}: ${failure.tail}\n`)
      if (failure.logPath) process.stdout.write(`log: ${failure.logPath}\n`)
    }
  }
  return verdict === "zero-missed" ? 0 : 1
}

/**
 * Run the CLI.
 *
 * @param {string[]} argv Raw arguments.
 * @returns {Promise<number>} Exit code.
 */
async function main(argv) {
  const options = parseArgs(argv)
  if (options.command === "help") {
    process.stdout.write(USAGE)
    return 0
  }
  switch (options.command) {
    case "select":
      return commandSelect(options)
    case "run":
      return commandRun(options)
    case "check":
      return commandCheck(options)
    case "plan":
      return commandPlan(options)
    case "shadow":
      return commandShadow(options)
    default:
      throw new UsageError(`unknown command: ${options.command}`)
  }
}

try {
  process.exitCode = await main(process.argv.slice(2))
} catch (error) {
  if (error instanceof UsageError) {
    process.stderr.write(`${error.message}\n\n${USAGE}`)
    process.exitCode = 2
  } else if (error instanceof MapLoadError) {
    process.stderr.write(`${error.code}: ${error.message}\n`)
    process.exitCode = 3
  } else if (error instanceof SelectionError) {
    process.stderr.write(`${error.reason}: ${error.message}\n`)
    process.exitCode = 5
  } else {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}

export { main, parseArgs }
