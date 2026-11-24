/**
 * Specification tests for the five-level effort vocabulary.
 *
 * These cases pin the observable contract before implementation: the
 * canonical level set, marker grammar, helper acceptance, and cross-language
 * parity. A failure here means the implementation is wrong, never the test.
 *
 * @module effort-vocabulary.spec.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { after, describe, it } from "node:test"

import {
  EFFORT_LEVELS,
  findEffortMarker,
  isEffortLevel,
  resolveEffort,
} from "./lib/reasoning-effort.mjs"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const HELPER = join(ROOT, "scripts", "codeops_effort.py")
const fixtures = []

after(() => {
  while (fixtures.length > 0) {
    rmSync(fixtures.pop(), { recursive: true, force: true })
  }
})

/**
 * Create a throwaway temp base for the helper.
 *
 * @returns {string} Absolute fixture base
 */
function makeBase() {
  const base = mkdtempSync(join(tmpdir(), "codeops-effort-vocab-"))
  fixtures.push(base)
  return base
}

/**
 * Create a session directory inside the CodeOps temp root.
 *
 * @param {string} base - Fixture temp base
 * @param {string} sessionID - Session directory name
 * @returns {string} Absolute session directory
 */
function makeSessionDir(base, sessionID) {
  const dir = join(base, "opencode", "codeops", sessionID)
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Run the Python helper with a fixture TMPDIR.
 *
 * @param {string} base - Fixture temp base
 * @param {string[]} args - CLI arguments
 * @returns {import("node:child_process").SpawnSyncReturns<string>} Spawn result
 */
function runHelper(base, args) {
  return spawnSync("python3", [HELPER, ...args], {
    encoding: "utf8",
    env: { ...process.env, TMPDIR: base },
  })
}

/**
 * Read the helper's level allowlist through Python's AST.
 *
 * @returns {string[]} The Python level tuple as an array
 */
function pythonLevels() {
  const code = [
    "import ast, json, pathlib",
    'tree = ast.parse(pathlib.Path("scripts/codeops_effort.py").read_text())',
    "levels = None",
    "for node in tree.body:",
    "    if isinstance(node, ast.Assign):",
    "        for target in node.targets:",
    "            if isinstance(target, ast.Name) and target.id == 'EFFORT_LEVELS':",
    "                levels = ast.literal_eval(node.value)",
    "print(json.dumps(list(levels)))",
  ].join("\n")
  const result = spawnSync("python3", ["-c", code], { cwd: ROOT, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

describe("effort vocabulary", () => {
  it("should expose exactly the five canonical levels", () => {
    assert.deepEqual(EFFORT_LEVELS, ["low", "medium", "high", "xhigh", "max"])
  })

  it("should accept the five levels and reject routing-only values", () => {
    for (const level of ["low", "medium", "high", "xhigh", "max"]) {
      assert.equal(isEffortLevel(level), true, `must accept ${level}`)
    }
    for (const level of ["none", "minimal", "default", "extreme"]) {
      assert.equal(isEffortLevel(level), false, `must reject ${level}`)
    }
  })
})

describe("marker grammar", () => {
  it("should accept xhigh", () => {
    assert.equal(findEffortMarker(["[codeops-effort: xhigh]"]), "xhigh")
  })

  it("should keep the existing four levels", () => {
    for (const level of ["low", "medium", "high", "max"]) {
      assert.equal(findEffortMarker([`[codeops-effort: ${level}]`]), level)
    }
  })

  it("should ignore unknown and malformed markers", () => {
    for (const value of ["HIGH", "none", "minimal", "default", "extreme"]) {
      assert.equal(findEffortMarker([`[codeops-effort: ${value}]`]), undefined)
    }
    assert.equal(findEffortMarker(["[codeops-effort: xhigh] extra"]), undefined)
  })

  it("should resolve xhigh through the normal precedence", () => {
    assert.equal(resolveEffort({ marker: "xhigh", session: "high", routing: "low" }), "xhigh")
    assert.equal(resolveEffort({ session: "xhigh", routing: "low" }), "xhigh")
  })
})

describe("session helper", () => {
  it("should accept xhigh and write the state file", () => {
    const base = makeBase()
    const dir = makeSessionDir(base, "ses_xhigh")
    const result = runHelper(base, ["set", "--dir", dir, "--reasoning", "xhigh"])

    assert.equal(result.status, 0, result.stderr)
    assert.equal(existsSync(join(dir, "reasoning-effort.json")), true)
    const state = JSON.parse(readFileSync(join(dir, "reasoning-effort.json"), "utf8"))
    assert.equal(state.schema, 1)
    assert.equal(state.reasoning, "xhigh")
    assert.equal(typeof state.setAt, "string")
  })

  it("should reject default with exit 2 and name the five levels", () => {
    const base = makeBase()
    const dir = makeSessionDir(base, "ses_default")
    const result = runHelper(base, ["set", "--dir", dir, "--reasoning", "default"])

    assert.equal(result.status, 2)
    for (const level of ["low", "medium", "high", "xhigh", "max"]) {
      assert.match(result.stderr, new RegExp(level), `error must name ${level}`)
    }
    assert.equal(existsSync(join(dir, "reasoning-effort.json")), false)
  })

  it("should keep the Python and JavaScript level lists in parity", () => {
    assert.deepEqual(pythonLevels(), [...EFFORT_LEVELS])
  })
})
