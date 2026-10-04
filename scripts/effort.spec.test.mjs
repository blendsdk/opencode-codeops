/**
 * Specification tests for the CodeOps reasoning-effort session CLI.
 *
 * These tests pin the observable contract of `scripts/codeops_effort.py`:
 * the `set`, `clear`, and `status` commands, the atomic write, the level
 * allowlist, and the temp-root path guard. Every case spawns the real
 * `python3` script against a temporary fixture tree with `TMPDIR` overridden,
 * so both Node and Python resolve the same CodeOps temp root.
 *
 * This is the specification oracle: a failing test means the CLI is wrong,
 * never the test.
 *
 * @module effort.spec.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** The CLI under test. */
const SCRIPT = join(ROOT, "scripts", "codeops_effort.py")

/** Fixture temp bases created by this suite; removed on exit. */
const fixtures = []

after(() => {
  while (fixtures.length > 0) {
    rmSync(fixtures.pop(), { recursive: true, force: true })
  }
})

/**
 * Create a throwaway base directory that stands in for the system temp root.
 *
 * @returns {string} Absolute path to the new directory.
 */
function makeBase() {
  const dir = mkdtempSync(join(tmpdir(), "codeops-effort-cli-"))
  fixtures.push(dir)
  return dir
}

/**
 * Create a session directory inside a fixture CodeOps temp root.
 *
 * @param {string} base - Fixture temp base (exported as TMPDIR).
 * @param {string} sessionID - Session directory name.
 * @returns {string} Absolute path to the session directory.
 */
function makeSessionDir(base, sessionID) {
  const dir = join(base, "opencode", "codeops", sessionID)
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Run the CLI once with TMPDIR pointed at a fixture base.
 *
 * @param {string} base - Fixture temp base.
 * @param {string[]} args - CLI arguments after the script path.
 * @returns {{status: number, stdout: string, stderr: string}} Spawn result.
 */
function runCli(base, args) {
  return spawnSync("python3", [SCRIPT, ...args], {
    encoding: "utf8",
    env: { ...process.env, TMPDIR: base },
  })
}

describe("codeops_effort.py set", () => {
  it("writes a schema-1 state file with the level and leaves no temp file", () => {
    const base = makeBase()
    const dir = makeSessionDir(base, "ses_set")

    const result = runCli(base, ["set", "--dir", dir, "--reasoning", "high"])

    assert.equal(result.status, 0, result.stderr)
    const statePath = join(dir, "reasoning-effort.json")
    const state = JSON.parse(readFileSync(statePath, "utf8"))
    assert.equal(state.schema, 1)
    assert.equal(state.reasoning, "high")
    assert.deepEqual(readdirSync(dir), ["reasoning-effort.json"])
  })
})

describe("codeops_effort.py status and clear", () => {
  it("reports the stored level, clears it, and reports the empty state", () => {
    const base = makeBase()
    const dir = makeSessionDir(base, "ses_status")
    const statePath = join(dir, "reasoning-effort.json")

    assert.equal(runCli(base, ["set", "--dir", dir, "--reasoning", "medium"]).status, 0)

    const status = runCli(base, ["status", "--dir", dir])
    assert.equal(status.status, 0)
    assert.match(status.stdout, /medium/)

    const cleared = runCli(base, ["clear", "--dir", dir])
    assert.equal(cleared.status, 0)
    assert.equal(existsSync(statePath), false, "clear must remove the state file")

    const afterClear = runCli(base, ["status", "--dir", dir])
    assert.equal(afterClear.status, 0)
    assert.match(afterClear.stdout, /No session reasoning effort set\./)
  })
})

describe("codeops_effort.py validation", () => {
  it("rejects an unknown level with exit 2 and names the allowed levels", () => {
    const base = makeBase()
    const dir = makeSessionDir(base, "ses_bad_level")

    const result = runCli(base, ["set", "--dir", dir, "--reasoning", "extreme"])

    assert.equal(result.status, 2)
    for (const level of ["low", "medium", "high", "max"]) {
      assert.match(result.stderr, new RegExp(level), `error must name allowed level ${level}`)
    }
    assert.equal(existsSync(join(dir, "reasoning-effort.json")), false)
  })

  it("rejects a directory outside the CodeOps temp root with exit 2 and no write", () => {
    const base = makeBase()
    const outside = join(base, "outside-the-root")
    mkdirSync(outside, { recursive: true })

    const result = runCli(base, ["set", "--dir", outside, "--reasoning", "high"])

    assert.equal(result.status, 2)
    assert.equal(existsSync(join(outside, "reasoning-effort.json")), false)
  })
})
