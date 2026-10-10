/**
 * Implementation tests for the CodeOps plan-progress parser.
 *
 * These tests cover pathological and boundary inputs of the counting rule —
 * unclosed fences, mixed fence characters, CRLF documents, tabs, long task
 * ids, and documents with nothing to count. They are derived from the
 * implementation's edge behavior (unlike the spec suite, which is an
 * independent oracle), so they may evolve with the parser's internals.
 *
 * @module codeops_plan.impl.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** The progress oracle under test. */
const PLAN_SCRIPT = join(ROOT, "scripts", "codeops_plan.py")

/** Fixture temp bases created by this suite; removed on exit. */
const fixtures = []

after(() => {
  while (fixtures.length > 0) {
    rmSync(fixtures.pop(), { recursive: true, force: true })
  }
})

/**
 * Create a throwaway root directory for one fixture.
 *
 * @returns {string} Absolute path to the new directory.
 */
function makeBase() {
  const dir = mkdtempSync(join(tmpdir(), "codeops-plan-impl-"))
  fixtures.push(dir)
  return dir
}

/**
 * Write a complete plan directory (index plus execution plan) under a fixture root.
 *
 * @param {string} base - Fixture root (passed to the parser as `--root`).
 * @param {string} executionText - Full `99-execution-plan.md` content.
 * @returns {string} Absolute path to the plan directory.
 */
function makePlan(base, executionText) {
  const planDir = join(base, "plans", "fixture-plan")
  mkdirSync(planDir, { recursive: true })
  writeFileSync(join(planDir, "00-index.md"), "# Fixture Plan\n\n> **Implements**: REQ-FIXTURE\n", "utf8")
  writeFileSync(join(planDir, "99-execution-plan.md"), executionText, "utf8")
  return planDir
}

/**
 * Join execution-plan lines into one document string.
 *
 * @param {string[]} lines - Document lines without trailing newlines.
 * @returns {string} The document text ending with a newline.
 */
function doc(lines) {
  return lines.join("\n") + "\n"
}

/**
 * Run the progress oracle once against a plan directory.
 *
 * @param {string} base - Fixture root (passed as `--root`).
 * @param {string} planDir - Plan directory (passed as `--plan`).
 * @param {string} flag - Output flag, `--json` or `--progress-bar`.
 * @returns {import("node:child_process").SpawnSyncReturns<string>} Spawn result.
 */
function runPlan(base, planDir, flag) {
  return spawnSync("python3", [PLAN_SCRIPT, "--root", base, "--plan", planDir, flag], {
    encoding: "utf8",
  })
}

/**
 * Parse the oracle's JSON output and return the first plan status.
 *
 * @param {{stdout: string}} result - Spawn result of a `--json` run.
 * @returns {object} The first entry of the `plans` array.
 */
function status(result) {
  return JSON.parse(result.stdout).plans[0]
}

describe("counting rule fence handling", () => {
  it("should strip to end of document when a fence is never closed", () => {
    const base = makeBase()
    const planDir = makePlan(
      base,
      doc(["- [ ] 1.1.1 A", "", "```", "- [ ] 1.1.2 hidden behind the unclosed fence"])
    )

    const plan = status(runPlan(base, planDir, "--json"))

    assert.equal(plan.total, 1)
    assert.equal(plan.next_task, "1.1.1 A")
  })

  it("should treat tilde fences like backtick fences", () => {
    const base = makeBase()
    const planDir = makePlan(
      base,
      doc(["- [ ] 1.1.1 A", "~~~", "- [ ] 1.1.2 hidden", "~~~", "- [x] 1.1.3 C"])
    )

    const plan = status(runPlan(base, planDir, "--json"))

    assert.equal(plan.total, 2)
    assert.equal(plan.verified, 1)
  })

  it("should accept an info string on the opening fence", () => {
    const base = makeBase()
    const planDir = makePlan(
      base,
      doc(["- [ ] 1.1.1 A", "```markdown", "- [ ] 1.1.2 hidden", "```", "- [x] 1.1.3 C"])
    )

    const plan = status(runPlan(base, planDir, "--json"))

    assert.equal(plan.total, 2)
    assert.equal(plan.verified, 1)
  })

  it("should recognize fences indented by up to three spaces and ignore deeper indentation", () => {
    const base = makeBase()
    const planDir = makePlan(
      base,
      doc([
        "- [ ] 1.1.1 A",
        "   ```",
        "- [ ] 1.1.2 hidden",
        "   ```",
        "    ```",
        "- [x] 1.1.3 C",
      ])
    )

    const plan = status(runPlan(base, planDir, "--json"))

    assert.equal(plan.total, 2)
    assert.equal(plan.verified, 1)
  })

  it("should not let the other fence character close a fence", () => {
    const base = makeBase()
    const planDir = makePlan(
      base,
      doc(["- [ ] 1.1.1 A", "```", "~~~", "- [ ] 1.1.2 hidden", "```", "- [ ] 1.1.3 C"])
    )

    const plan = status(runPlan(base, planDir, "--json"))

    assert.equal(plan.total, 2)
    assert.equal(plan.not_started, 2)
  })

  it("should treat a stray closing fence as an opening fence", () => {
    const base = makeBase()
    const planDir = makePlan(base, doc(["- [ ] 1.1.1 A", "```", "- [ ] 1.1.2 hidden"]))

    const plan = status(runPlan(base, planDir, "--json"))

    assert.equal(plan.total, 1)
    assert.equal(plan.next_task, "1.1.1 A")
  })

  it("should close a fence with a longer run of the same character", () => {
    const base = makeBase()
    const planDir = makePlan(
      base,
      doc(["- [ ] 1.1.1 A", "```", "- [ ] 1.1.2 hidden", "````", "- [x] 1.1.3 C"])
    )

    const plan = status(runPlan(base, planDir, "--json"))

    assert.equal(plan.total, 2)
    assert.equal(plan.verified, 1)
  })
})

describe("counting rule document handling", () => {
  it("should parse CRLF documents like LF documents", () => {
    const base = makeBase()
    const planDir = makePlan(
      base,
      ["- [ ] 1.1.1 A", "- [x] 1.1.2 B", "```", "- [ ] 1.1.3 hidden", "```", ""].join("\r\n")
    )

    const plan = status(runPlan(base, planDir, "--json"))

    assert.equal(plan.total, 2)
    assert.equal(plan.verified, 1)
  })

  it("should accept a tab between the dash and the checkbox", () => {
    const base = makeBase()
    const planDir = makePlan(base, doc(["-\t[ ] 1.1.1 A"]))

    const plan = status(runPlan(base, planDir, "--json"))

    assert.equal(plan.total, 1)
    assert.equal(plan.next_task, "1.1.1 A")
  })

  it("should count ids with multi-digit segments", () => {
    const base = makeBase()
    const planDir = makePlan(base, doc(["- [ ] 1.10.2 A", "- [ ] T-05.12 B"]))

    const plan = status(runPlan(base, planDir, "--json"))

    assert.equal(plan.total, 2)
    assert.equal(plan.not_started, 2)
  })

  it("should keep the first occurrence when the same id repeats across a fence", () => {
    const base = makeBase()
    const planDir = makePlan(
      base,
      doc(["- [ ] 1.1.1 First", "```", "- [x] 1.1.1 Second (quoted)", "```", "- [~] 1.1.1 Third"])
    )

    const plan = status(runPlan(base, planDir, "--json"))

    assert.equal(plan.total, 1)
    assert.equal(plan.not_started, 1)
    assert.equal(plan.verification_pending, 0)
    assert.equal(plan.verified, 0)
    assert.equal(plan.next_task, "1.1.1 First")
  })

  it("should report the empty document as having no execution tasks", () => {
    const base = makeBase()
    const planDir = makePlan(base, "")

    const result = runPlan(base, planDir, "--json")
    const plan = status(result)

    assert.equal(plan.total, 0)
    assert.ok(
      plan.problems.some((problem) => problem.includes("contains no execution tasks")),
      `expected the no-execution-tasks problem, got: ${JSON.stringify(plan.problems)}`
    )
    assert.equal(result.status, 1)
  })
})
