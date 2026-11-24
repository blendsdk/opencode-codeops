/**
 * Specification tests for the upgrade command.
 *
 * The command replaces the global npm package, removes stale CodeOps plugin
 * entries from OpenCode's config, re-registers the new version, and refreshes
 * both the global and current-project skill/agent files. These cases pin the
 * command sequence and its failure boundaries without touching the real npm
 * registry or OpenCode config.
 *
 * @module upgrade.spec.test
 */

import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"

import { upgrade } from "./lib/upgrade.mjs"

const fixtures = []

after(() => {
  while (fixtures.length > 0) {
    rmSync(fixtures.pop(), { recursive: true, force: true })
  }
})

/**
 * Create a throwaway working directory.
 *
 * @param project - Whether to mark it as a CodeOps project
 * @returns Absolute fixture path
 */
function makeDir(project) {
  const dir = mkdtempSync(join(tmpdir(), "codeops-upgrade-"))
  fixtures.push(dir)
  if (project) mkdirSync(join(dir, ".opencode"), { recursive: true })
  return dir
}

/**
 * Build a recording command runner.
 *
 * @param details - Fixture details
 * @param details.plugins - Configured plugin specs
 * @param details.gitRoot - Git root reported by `git rev-parse`
 * @param details.fail - Command prefix that should fail, if any
 * @returns The runner and the recorded calls
 */
function makeRun({ plugins = [], gitRoot = null, fail = null } = {}) {
  const calls = []
  function run(command, args, options = {}) {
    calls.push([command, ...args])
    const line = [command, ...args].join(" ")
    if (fail && line.startsWith(fail)) {
      return { status: 1, stdout: "", stderr: "simulated failure" }
    }
    if (command === "git") {
      return gitRoot
        ? { status: 0, stdout: `${gitRoot}\n`, stderr: "" }
        : { status: 1, stdout: "", stderr: "" }
    }
    if (command === "opencode" && args[0] === "debug" && args[1] === "config") {
      return {
        status: 0,
        stdout: JSON.stringify([{ info: { plugins } }]),
        stderr: "",
      }
    }
    return { status: 0, stdout: "", stderr: "" }
  }
  return { calls, run }
}

/**
 * Drop read-only inspection calls from the recorded command list.
 *
 * @param calls - Recorded commands
 * @returns The mutating or user-visible commands
 */
function actions(calls) {
  return calls.filter(
    ([command, first]) =>
      command !== "git" && !(command === "opencode" && first === "debug")
  )
}

/**
 * Collect logged lines.
 *
 * @returns {{ log: Function, lines: string[] }} Logger and its output
 */
function makeLog() {
  const lines = []
  return { log: (line) => lines.push(String(line)), lines }
}

describe("upgrade sequence", () => {
  it("installs the global package, cleans stale plugin entries, and refreshes both scopes", () => {
    const cwd = makeDir(true)
    const { calls, run } = makeRun({
      plugins: ["opencode-codeops@2.6.0", "@openchamber/opencode-claude"],
      gitRoot: cwd,
    })
    const { log, lines } = makeLog()

    const result = upgrade({ cwd, version: "latest", run, log })

    assert.equal(result.code, 0, result.message)
    assert.deepEqual(actions(calls), [
      ["npm", "install", "--global", "opencode-codeops@latest"],
      ["opencode", "plugin", "remove", "opencode-codeops@2.6.0"],
      ["npx", "-y", "opencode-codeops@latest", "install", "--global"],
      ["npx", "-y", "opencode-codeops@latest", "install", "--project", "--no-plugin"],
    ])
    assert.ok(lines.some((line) => /removed opencode-codeops@2\.6\.0/.test(line)))
    assert.ok(lines.some((line) => /Restart OpenCode/.test(line)))
  })

  it("skips the project scope when not in a CodeOps project", () => {
    const cwd = makeDir(false)
    const { calls, run } = makeRun({ gitRoot: null })
    const { log } = makeLog()

    const result = upgrade({ cwd, version: "2.8.0", run, log })

    assert.equal(result.code, 0, result.message)
    assert.deepEqual(actions(calls), [
      ["npm", "install", "--global", "opencode-codeops@2.8.0"],
      ["npx", "-y", "opencode-codeops@2.8.0", "install", "--global"],
    ])
  })

  it("honors --no-project even inside a project", () => {
    const cwd = makeDir(true)
    const { calls, run } = makeRun({ gitRoot: cwd })
    const { log } = makeLog()

    const result = upgrade({ cwd, version: "latest", project: false, run, log })

    assert.equal(result.code, 0, result.message)
    assert.equal(
      calls.some((call) => call.includes("--project")),
      false
    )
  })

  it("does not execute anything in dry-run mode", () => {
    const cwd = makeDir(true)
    const { calls, run } = makeRun({ gitRoot: cwd })
    const { log, lines } = makeLog()

    const result = upgrade({ cwd, version: "latest", dryRun: true, run, log })

    assert.equal(result.code, 0)
    assert.deepEqual(actions(calls), [])
    assert.ok(lines.some((line) => /would install opencode-codeops@latest globally/.test(line)))
  })
})

describe("failure boundaries", () => {
  it("stops before removing the plugin when the npm install fails", () => {
    const cwd = makeDir(true)
    const { calls, run } = makeRun({
      plugins: ["opencode-codeops@2.6.0"],
      gitRoot: cwd,
      fail: "npm install",
    })
    const { log } = makeLog()

    const result = upgrade({ cwd, version: "latest", run, log })

    assert.notEqual(result.code, 0)
    assert.match(result.message, /npm install failed/i)
    assert.equal(actions(calls).length, 1)
  })

  it("surfaces the spawn error code when npm cannot start", () => {
    const cwd = makeDir(true)
    const { run } = makeRun({ gitRoot: cwd })
    const spawnFailingRun = (command, args, options) =>
      command === "npm"
        ? {
            status: 1,
            stdout: "",
            stderr: "",
            error: { code: "EINVAL", message: "spawn npm EINVAL" },
          }
        : run(command, args, options)
    const { log } = makeLog()

    const result = upgrade({ cwd, version: "latest", run: spawnFailingRun, log })

    assert.notEqual(result.code, 0)
    assert.match(result.message, /EINVAL/)
    assert.doesNotMatch(result.message, /unknown error/)
  })

  it("rejects an unsafe version token before running a command", () => {
    const cwd = makeDir(true)
    const { calls, run } = makeRun({ gitRoot: cwd })
    const { log } = makeLog()

    const result = upgrade({ cwd, version: "latest; rm -rf /", run, log })

    assert.equal(result.code, 2)
    assert.deepEqual(calls, [])
  })
})
