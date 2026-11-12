#!/usr/bin/env node
/**
 * Argv-safe command execution for the test selector.
 *
 * The runner never builds a shell string. It spawns the program named by the
 * first argv token with the remaining tokens as arguments, so a path containing
 * spaces, semicolons, or `$()` stays one inert argument.
 *
 * Logs are temporary artifacts. A passing command deletes its log; a failing or
 * timed-out command keeps the log, reports its path, and exposes the last lines
 * so a developer can act without re-running the suite.
 *
 * @module lib/test-runner
 */

import { spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { isAbsolute, join, relative, resolve } from "node:path"

/** Default per-group timeout in seconds. */
export const DEFAULT_GROUP_TIMEOUT_SECONDS = 600

/** Default full-suite timeout in seconds. */
export const DEFAULT_FULL_TIMEOUT_SECONDS = 1800

/** Maximum captured output retained in memory per stream. */
const MAX_CAPTURE_BYTES = 2 * 1024 * 1024

/** Number of trailing log lines reported on failure. */
const FAILURE_TAIL_LINES = 50

/**
 * Error raised when a command cannot be run safely.
 *
 * `code` is stable (`cwd-escape`, `missing-command`) so the CLI can choose the
 * documented exit code.
 */
export class RunnerError extends Error {
  /**
   * @param {string} code Stable error code.
   * @param {string} message Human-readable explanation.
   */
  constructor(code, message) {
    super(message)
    this.name = "RunnerError"
    this.code = code
  }
}

/**
 * Resolve the directory that holds captured logs.
 *
 * @param {Record<string, string>} [env] Environment values.
 * @returns {string} Existing temporary directory.
 */
export function resolveLogDir(env = process.env) {
  const directory = env.CODEOPS_TMPDIR || tmpdir()
  mkdirSync(directory, { recursive: true })
  return directory
}

/**
 * Resolve and contain a command working directory.
 *
 * Both the lexical path and the real path must stay under the repository root,
 * which also blocks a symlinked subdirectory from escaping.
 *
 * @param {string} root Repository root.
 * @param {string} [cwd="."] Requested working directory.
 * @returns {string} Absolute, contained working directory.
 * @throws {RunnerError} When the directory escapes the root or does not exist.
 */
export function resolveWorkingDirectory(root, cwd = ".") {
  const absoluteRoot = realpathSync(resolve(root))
  const candidate = isAbsolute(cwd) ? resolve(cwd) : resolve(absoluteRoot, cwd)
  const relation = relative(absoluteRoot, candidate)
  if (relation.startsWith("..") || isAbsolute(relation)) {
    throw new RunnerError("cwd-escape", `cwd ${cwd} escapes the repository root`)
  }
  if (!existsSync(candidate)) throw new RunnerError("missing-cwd", `cwd ${cwd} does not exist`)
  const real = realpathSync(candidate)
  const realRelation = relative(absoluteRoot, real)
  if (realRelation.startsWith("..") || isAbsolute(realRelation)) {
    throw new RunnerError("cwd-escape", `cwd ${cwd} resolves outside the repository root`)
  }
  return real
}

/**
 * Keep only the last N lines of a log.
 *
 * @param {string} text Log text.
 * @param {number} [count=FAILURE_TAIL_LINES] Number of lines to keep.
 * @returns {string} Trailing lines.
 */
export function tailLines(text, count = FAILURE_TAIL_LINES) {
  return String(text ?? "")
    .split(/\r?\n/)
    .filter((line, index, lines) => !(index === lines.length - 1 && line === ""))
    .slice(-count)
    .join("\n")
}

/**
 * Create a safe log file name from a group ID.
 *
 * @param {string} id Group or command ID.
 * @param {number} serial Monotonic serial for uniqueness.
 * @returns {string} File name with no path separators.
 */
function logFileName(id, serial) {
  const safe = String(id).replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 80)
  return `codeops-test-${safe}-${process.pid}-${serial}.log`
}

/**
 * Run one argv command asynchronously.
 *
 * @param {object} input Execution input.
 * @param {string} input.id Group or command ID.
 * @param {string[]} input.argv Program and arguments.
 * @param {string} [input.cwd="."] Working directory inside the root.
 * @param {string} input.root Repository root.
 * @param {number} [input.timeoutSeconds] Timeout override.
 * @param {Record<string, string>} [input.env] Extra environment values.
 * @param {string} [input.gate] Gate name for diagnostics.
 * @param {boolean} [input.keepLogs=false] Keep success logs.
 * @param {number} [input.serial=0] Serial used in the log name.
 * @returns {Promise<{id: string, status: "passed"|"failed"|"timeout", exitCode: number, durationMs: number, logPath: string|null, output: string, tail: string}>}
 * @throws {RunnerError} When the command cannot start safely.
 * @example
 * const result = await runArgv({ id: "a.unit", argv: ["node", "--test", "a.test.js"], root: process.cwd() })
 */
export async function runArgv({
  id,
  argv,
  cwd = ".",
  root,
  timeoutSeconds = DEFAULT_GROUP_TIMEOUT_SECONDS,
  env = {},
  gate,
  keepLogs = false,
  serial = 0,
}) {
  if (!Array.isArray(argv) || argv.length === 0 || typeof argv[0] !== "string") {
    throw new RunnerError("missing-command", `group ${id} has no runnable command`)
  }
  const workingDirectory = resolveWorkingDirectory(root, cwd)
  const logPath = join(resolveLogDir(env), logFileName(id, serial))
  const started = Date.now()

  return new Promise((resolvePromise) => {
    let stdout = ""
    let stderr = ""
    let timedOut = false

    const child = spawn(argv[0], argv.slice(1), {
      cwd: workingDirectory,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
        CODEOPS_TEST_GROUP: id,
        ...(gate ? { CODEOPS_TEST_GATE: gate } : {}),
      },
    })

    const append = (current, chunk) => {
      const next = current + chunk.toString("utf8")
      return next.length > MAX_CAPTURE_BYTES ? next.slice(-MAX_CAPTURE_BYTES) : next
    }
    child.stdout.on("data", (chunk) => {
      stdout = append(stdout, chunk)
    })
    child.stderr.on("data", (chunk) => {
      stderr = append(stderr, chunk)
    })

    const timer =
      timeoutSeconds > 0
        ? setTimeout(() => {
            timedOut = true
            child.kill("SIGKILL")
          }, timeoutSeconds * 1000)
        : null

    child.on("error", (error) => {
      if (timer) clearTimeout(timer)
      const output = `cannot start ${argv[0]}: ${error.message}\n`
      writeFileSync(logPath, output)
      resolvePromise({
        id,
        status: "failed",
        exitCode: 127,
        durationMs: Date.now() - started,
        logPath,
        output,
        tail: output.trim(),
      })
    })

    child.on("close", (code) => {
      if (timer) clearTimeout(timer)
      const output = `${stdout}${stderr}`
      const status = timedOut ? "timeout" : code === 0 ? "passed" : "failed"
      writeFileSync(logPath, output)

      if (status === "passed" && !keepLogs) {
        unlinkSync(logPath)
        resolvePromise({
          id,
          status,
          exitCode: 0,
          durationMs: Date.now() - started,
          logPath: null,
          output,
          tail: "",
        })
        return
      }

      const header = timedOut ? `timeout after ${timeoutSeconds}s\n` : ""
      resolvePromise({
        id,
        status,
        exitCode: timedOut ? 124 : code ?? 1,
        durationMs: Date.now() - started,
        logPath,
        output: `${header}${output}`,
        tail: tailLines(`${header}${output}`),
      })
    })
  })
}

/**
 * Read a retained log when a caller needs more than the tail.
 *
 * @param {string|null} logPath Retained log path.
 * @returns {string} Log text, or an empty string when unavailable.
 */
export function readRetainedLog(logPath) {
  if (!logPath || !existsSync(logPath)) return ""
  return readFileSync(logPath, "utf8")
}

/**
 * Run commands sequentially or in a bounded pool.
 *
 * Concurrency is allowed only when every command declares `parallelSafe`. A
 * mixed set runs sequentially, because one shared resource would otherwise make
 * results depend on scheduling.
 *
 * @param {Array<{id: string, argv: string[], cwd?: string, parallelSafe?: boolean}>} commands Commands to run.
 * @param {object} options Execution options.
 * @param {string} options.root Repository root.
 * @param {number} [options.concurrency=1] Maximum concurrent commands.
 * @param {boolean} [options.failFast=true] Stop after the first failure.
 * @param {number} [options.timeoutSeconds] Per-command timeout.
 * @param {Record<string, string>} [options.env] Extra environment values.
 * @param {string} [options.gate] Gate name.
 * @param {boolean} [options.keepLogs=false] Keep success logs.
 * @returns {Promise<Array<object>>} Results in completion order.
 * @example
 * const results = await runCommands([{ id: "a", argv: ["node", "--test", "a.test.js"] }], { root: "." })
 */
export async function runCommands(
  commands,
  { root, concurrency = 1, failFast = true, timeoutSeconds, env = {}, gate, keepLogs = false } = {},
) {
  const results = []
  const parallel = concurrency > 1 && commands.every((command) => command.parallelSafe === true)

  if (!parallel) {
    for (const [index, command] of commands.entries()) {
      const result = await runArgv({
        ...command,
        root,
        timeoutSeconds,
        env,
        gate,
        keepLogs,
        serial: index,
      })
      results.push(result)
      if (failFast && result.status !== "passed") break
    }
    return results
  }

  let cursor = 0
  let stopped = false
  const worker = async () => {
    while (!stopped && cursor < commands.length) {
      const index = cursor
      cursor += 1
      const result = await runArgv({
        ...commands[index],
        root,
        timeoutSeconds,
        env,
        gate,
        keepLogs,
        serial: index,
      })
      results.push(result)
      if (failFast && result.status !== "passed") stopped = true
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, commands.length) }, () => worker()))
  return results
}

/**
 * Run one requirement probe.
 *
 * A failing probe is reported as `false`; the caller fails the dependent group
 * instead of skipping it.
 *
 * @param {object} input Probe input.
 * @param {string[]} input.argv Probe argv.
 * @param {string} input.root Repository root.
 * @param {Record<string, string>} [input.env] Extra environment values.
 * @returns {Promise<boolean>} `true` when the probe exits zero.
 */
export async function probeRequirement({ argv, root, env = {} }) {
  const workingDirectory = resolveWorkingDirectory(root, ".")
  return new Promise((resolvePromise) => {
    const child = spawn(argv[0], argv.slice(1), {
      cwd: workingDirectory,
      shell: false,
      stdio: "ignore",
      env: { ...process.env, ...env },
    })
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      resolvePromise(false)
    }, 30_000)
    child.on("error", () => {
      clearTimeout(timer)
      resolvePromise(false)
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolvePromise(code === 0)
    })
  })
}
