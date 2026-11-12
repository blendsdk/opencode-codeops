/**
 * Implementation tests for the runner and CLI internals.
 *
 * Covers direct runner behavior (logs, tails, timeouts, cwd containment,
 * fail-fast, parallel gating) and CLI edge paths that the specification tests
 * do not need to repeat.
 *
 * @module codeops-test.impl.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"

import {
  resolveWorkingDirectory,
  runArgv,
  runCommands,
  RunnerError,
  tailLines,
} from "./lib/test-runner.mjs"

const CLI = new URL("./codeops-test.mjs", import.meta.url).pathname
const roots = []

/** Create a temporary directory tracked for cleanup. */
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "codeops-runner-impl-"))
  roots.push(root)
  return root
}

/** Run the CLI. */
function runCli(root, args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CODEOPS_TMPDIR: join(root, "tmp") },
  })
}

/** Run Git in a fixture repository. */
function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
}

/** Build a one-command repository with a recorded runner script. */
function makeRepo() {
  const root = makeRoot()
  git(root, ["init", "-q"])
  git(root, ["config", "user.email", "test@example.com"])
  git(root, ["config", "user.name", "Test"])
  writeFileSync(
    join(root, "runner.mjs"),
    `const argv = process.argv.slice(2)\n` +
      `if (argv.includes("--fail")) { console.error("failure marker"); process.exit(1) }\n` +
      `if (argv.includes("--hang")) { setTimeout(() => {}, 60000) }\n` +
      `console.log("runner ok")\n`,
  )
  writeFileSync(join(root, "package-lock.json"), "{}\n")
  mkdirSync(join(root, "src", "a"), { recursive: true })
  mkdirSync(join(root, "tests", "a"), { recursive: true })
  mkdirSync(join(root, "src", "b"), { recursive: true })
  mkdirSync(join(root, "tests", "b"), { recursive: true })
  writeFileSync(join(root, "src", "a", "base.js"), "export const a = 1\n")
  writeFileSync(join(root, "tests", "a", "case.test.js"), "// a\n")
  writeFileSync(join(root, "src", "b", "base.js"), "export const b = 1\n")
  writeFileSync(join(root, "tests", "b", "case.test.js"), "// b\n")
  mkdirSync(join(root, "codeops"), { recursive: true })
  writeFileSync(
    join(root, "codeops", "test-map.json"),
    JSON.stringify({
      schema: 1,
      policy: {
        schema: 1,
        full: ["node", "runner.mjs"],
        fullThreshold: 1,
        fullOnPaths: ["package-lock.json"],
        requirements: { db: { check: ["node", "-e", "process.exit(1)"] } },
      },
      groups: [
        {
          id: "a.unit",
          slice: "a",
          tier: "task",
          sources: ["src/a/**"],
          tests: ["tests/a/**/*.test.js"],
          run: { command: ["node", "runner.mjs", "{tests}"] },
        },
        {
          id: "b.unit",
          slice: "b",
          tier: "task",
          sources: ["src/b/**"],
          tests: ["tests/b/**/*.test.js"],
          run: { command: ["node", "runner.mjs", "{tests}"] },
        },
      ],
    }),
  )
  git(root, ["add", "-A"])
  git(root, ["commit", "-qm", "fixture"])
  return root
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true })
})

describe("runArgv", () => {
  it("deletes a success log by default and keeps it when asked", async () => {
    const root = makeRoot()
    writeFileSync(join(root, "ok.mjs"), "console.log('ok')\n")
    const tmp = join(root, "logs")
    const first = await runArgv({ id: "ok", argv: [process.execPath, "ok.mjs"], root, env: { CODEOPS_TMPDIR: tmp } })
    assert.equal(first.status, "passed")
    assert.equal(first.logPath, null)
    assert.deepEqual(readdirSync(tmp), [])

    const kept = await runArgv({
      id: "ok",
      argv: [process.execPath, "ok.mjs"],
      root,
      env: { CODEOPS_TMPDIR: tmp },
      keepLogs: true,
    })
    assert.ok(kept.logPath)
    assert.ok(existsSync(kept.logPath))
  })

  it("retains a failure log and trims the tail", async () => {
    const root = makeRoot()
    writeFileSync(join(root, "fail.mjs"), "console.error('failure marker')\nprocess.exit(1)\n")
    const result = await runArgv({
      id: "fail",
      argv: [process.execPath, "fail.mjs"],
      root,
      env: { CODEOPS_TMPDIR: join(root, "logs") },
    })
    assert.equal(result.status, "failed")
    assert.equal(result.exitCode, 1)
    assert.match(result.tail, /failure marker/)
    assert.ok(existsSync(result.logPath))
    assert.equal(tailLines("a\nb\nc", 2), "b\nc")
  })

  it("reports a timeout as a failure", async () => {
    const root = makeRoot()
    writeFileSync(join(root, "hang.mjs"), "setTimeout(() => {}, 60000)\n")
    const result = await runArgv({
      id: "hang",
      argv: [process.execPath, "hang.mjs"],
      root,
      timeoutSeconds: 1,
      env: { CODEOPS_TMPDIR: join(root, "logs") },
    })
    assert.equal(result.status, "timeout")
    assert.equal(result.exitCode, 124)
  })
})

describe("cwd containment", () => {
  it("rejects parent traversal and symlink escapes", () => {
    const root = makeRoot()
    mkdirSync(join(root, "inside"))
    assert.throws(() => resolveWorkingDirectory(root, "../outside"), (error) => error instanceof RunnerError)
    assert.throws(() => resolveWorkingDirectory(root, "missing"), (error) => error instanceof RunnerError)

    const outside = makeRoot()
    symlinkSync(outside, join(root, "escape"))
    assert.throws(() => resolveWorkingDirectory(root, "escape"), (error) => error instanceof RunnerError)
  })
})

describe("runCommands", () => {
  it("stops at the first failure unless fail-fast is disabled", async () => {
    const root = makeRoot()
    writeFileSync(join(root, "fail.mjs"), "process.exit(1)\n")
    const commands = [
      { id: "one", argv: [process.execPath, "fail.mjs"] },
      { id: "two", argv: [process.execPath, "fail.mjs"] },
    ]
    const stopped = await runCommands(commands, { root, env: { CODEOPS_TMPDIR: join(root, "logs") } })
    assert.equal(stopped.length, 1)

    const all = await runCommands(commands, {
      root,
      failFast: false,
      env: { CODEOPS_TMPDIR: join(root, "logs2") },
    })
    assert.equal(all.length, 2)
  })

  it("runs a mixed set sequentially even with a concurrency request", async () => {
    const root = makeRoot()
    writeFileSync(join(root, "sleep.mjs"), "setTimeout(() => process.exit(0), 150)\n")
    const commands = [
      { id: "one", argv: [process.execPath, "sleep.mjs"], parallelSafe: true },
      { id: "two", argv: [process.execPath, "sleep.mjs"], parallelSafe: false },
    ]
    const started = Date.now()
    const results = await runCommands(commands, {
      root,
      concurrency: 2,
      env: { CODEOPS_TMPDIR: join(root, "logs") },
    })
    assert.equal(results.length, 2)
    assert.ok(Date.now() - started >= 250)
  })
})

describe("CLI edge paths", () => {
  it("fails a group when its requirement probe exits nonzero", () => {
    const root = makeRepo()
    const mapPath = join(root, "codeops", "test-map.json")
    const map = JSON.parse(readFileSync(mapPath, "utf8"))
    map.groups[0].requires = ["db"]
    writeFileSync(mapPath, JSON.stringify(map))
    git(root, ["add", "codeops/test-map.json"])
    git(root, ["commit", "-qm", "require db"])
    writeFileSync(join(root, "src", "a", "change.js"), "export const changed = true\n")
    const result = runCli(root, ["run", "--gate", "task", "--baseline", "HEAD"])
    assert.equal(result.status, 1)
    assert.match(result.stdout + result.stderr, /requires\.missing/)
  })

  it("rejects an unknown option and a missing option value", () => {
    const root = makeRoot()
    assert.equal(runCli(root, ["select", "--nope"]).status, 2)
    assert.equal(runCli(root, ["select", "--baseline"]).status, 2)
    assert.equal(runCli(root, ["frobnicate"]).status, 2)
  })

  it("emits check JSON without writing to the repository", () => {
    const root = makeRepo()
    const before = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout
    const result = runCli(root, ["check", "--json"])
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.ok(Array.isArray(report.errors))
    const after = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout
    assert.equal(after, before)
  })

  it("reports a selected-failure shadow verdict", () => {
    const root = makeRepo()
    const mapPath = join(root, "codeops", "test-map.json")
    const map = JSON.parse(readFileSync(mapPath, "utf8"))
    map.groups[0].run.command = ["node", "runner.mjs", "--fail"]
    writeFileSync(mapPath, JSON.stringify(map))
    git(root, ["add", "codeops/test-map.json"])
    git(root, ["commit", "-qm", "failing selected command"])
    writeFileSync(join(root, "src", "a", "change.js"), "export const changed = true\n")
    const result = runCli(root, ["shadow", "--baseline", "HEAD", "--record", "shadow.json", "--json"])
    assert.equal(result.status, 1)
    const record = JSON.parse(readFileSync(join(root, "shadow.json"), "utf8"))
    assert.equal(record.verdict, "selected-failure")
  })
})
