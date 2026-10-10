/**
 * Specification tests for the CodeOps plan-progress parser.
 *
 * These tests pin the observable contract of `scripts/codeops_plan.py`: which
 * checklist lines count as execution tasks, the fence-stripping and
 * first-occurrence rules, the per-marker counts and lifecycle, and the
 * unchanged `--json` / `--progress-bar` surfaces. Every case spawns the real
 * `python3` script against a temporary complete plan directory, so the tested
 * interface is exactly the one the skills consume.
 *
 * This is the specification oracle: a failing test means the parser is wrong,
 * never the test.
 *
 * @module codeops_plan.spec.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
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
  const dir = mkdtempSync(join(tmpdir(), "codeops-plan-spec-"))
  fixtures.push(dir)
  return dir
}

/**
 * Write a complete plan directory (index plus execution plan) under a fixture root.
 *
 * The index declares an Implements target so the fixture is structurally
 * complete and only counting behavior can produce reported problems.
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

describe("codeops_plan.py counting rule", () => {
  it("should count only id-prefixed tasks when deliverables and fenced examples are present (ST-1)", () => {
    const base = makeBase()
    const planDir = makePlan(
      base,
      doc([
        "# Fixture Execution Plan",
        "",
        "- [ ] 1.1.1 A",
        "- [x] 1.1.2 B",
        "",
        "**Deliverables**:",
        "- [ ] Deliverable 1",
        "",
        "```markdown",
        "- [ ] 1.1.9 quoted",
        "```",
      ])
    )

    const result = runPlan(base, planDir, "--json")
    const plan = status(result)

    assert.equal(plan.total, 2)
    assert.equal(plan.verified, 1)
    assert.equal(plan.not_started, 1)
    assert.equal(plan.next_task, "1.1.1 A")
  })

  it("should count a repeated task id once, from its first occurrence (ST-2)", () => {
    const base = makeBase()
    const planDir = makePlan(base, doc(["- [ ] 1.1.1 First", "- [x] 1.1.1 First again"]))

    const plan = status(runPlan(base, planDir, "--json"))

    assert.equal(plan.total, 1)
    assert.equal(plan.not_started, 1)
    assert.equal(plan.verified, 0)
    assert.equal(plan.next_task, "1.1.1 First")
  })

  it("should count bold mini-plan task ids (ST-5)", () => {
    const base = makeBase()
    const planDir = makePlan(base, doc(["- [ ] T-05.1 First", "- [x] **T-05.2 — Second**"]))

    const plan = status(runPlan(base, planDir, "--json"))

    assert.equal(plan.total, 2)
    assert.equal(plan.verified, 1)
    assert.equal(plan.not_started, 1)
  })

  it("should ignore id-like text that never starts a task (ST-7)", () => {
    const base = makeBase()
    const planDir = makePlan(
      base,
      doc(["- [ ] 1.1.1.1 nested", "- [ ] T-05.1x weird", "- [ ] 1.1.1: colon"])
    )

    const result = runPlan(base, planDir, "--json")
    const plan = status(result)

    assert.equal(plan.total, 0)
    assert.ok(
      plan.problems.some((problem) => problem.includes("contains no execution tasks")),
      `expected the no-execution-tasks problem, got: ${JSON.stringify(plan.problems)}`
    )
    assert.equal(result.status, 1, "a reported problem must exit non-zero")
  })
})

describe("codeops_plan.py contract surfaces", () => {
  it("should report one count per marker state and the blocked lifecycle (ST-4)", () => {
    const base = makeBase()
    const planDir = makePlan(
      base,
      doc([
        "- [ ] 1.1.1 One",
        "- [~] 1.1.2 Two",
        "- [x] 1.1.3 Three",
        "- [!] 1.1.4 Blocked: waiting on inputs",
        "- [!] 1.1.5 Four",
      ])
    )

    const plan = status(runPlan(base, planDir, "--json"))

    assert.equal(plan.not_started, 1)
    assert.equal(plan.verification_pending, 1)
    assert.equal(plan.verified, 1)
    assert.equal(plan.blocked, 2)
    assert.equal(plan.lifecycle, "Blocked")
    assert.equal(plan.problems.length, 1, "only the reason-less blocked task is a problem")
    assert.match(plan.problems[0], /blocked task lacks a visible/)
  })

  it("should keep the ten-cell progress-bar format (ST-6)", () => {
    const base = makeBase()
    const planDir = makePlan(
      base,
      doc(["- [x] 1.1.1 One", "- [ ] 1.1.2 Two", "- [ ] 1.1.3 Three"])
    )

    const result = runPlan(base, planDir, "--progress-bar")

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), "Progress: [███░░░░░░░] 1/3 tasks (33%)")
  })

  it("should match an independent fence-aware distinct-id count on every repository plan (ST-3)", () => {
    const plansDir = join(ROOT, "plans")
    const planDirs = readdirSync(plansDir)
      .map((name) => join(plansDir, name))
      .filter((dir) => existsSync(join(dir, "99-execution-plan.md")))

    assert.ok(planDirs.length > 0, "expected repository plans to exist")

    for (const planDir of planDirs) {
      const text = readFileSync(join(planDir, "99-execution-plan.md"), "utf8")
      const plan = status(runPlan(ROOT, planDir, "--json"))
      assert.equal(
        plan.total,
        countDistinctTaskIds(text),
        `parser total must match the independent distinct-id count for ${planDir}`
      )
    }
  })
})

/**
 * Count distinct id-prefixed checkbox tasks in a plan document.
 *
 * This is the parity oracle: it implements the counting rule independently of
 * the parser — fence-aware, id-gated, first occurrence per id — so both sides
 * must agree without sharing code.
 *
 * @param {string} text - Full `99-execution-plan.md` content.
 * @returns {number} Number of distinct task ids outside fenced blocks.
 */
function countDistinctTaskIds(text) {
  const seen = new Set()
  let fence = null

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "")

    if (fence) {
      const body = line.slice(/^ {0,3}/.exec(line)[0].length)
      if (body.length >= fence.length && body === fence.char.repeat(body.length)) {
        fence = null
      }
      continue
    }

    const opener = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (opener) {
      fence = { char: opener[1][0], length: opener[1].length }
      continue
    }

    const task = /^-\s*\[[ xX~!]\]\s+(.+?)\s*$/.exec(line)
    if (!task) continue
    const id = /^\s*(?:\*\*)?([0-9]+\.[0-9]+\.[0-9]+|T-[0-9]+\.[0-9]+)(?=[\s*—–-]|$)/.exec(task[1])
    if (id) seen.add(id[1])
  }

  return seen.size
}
