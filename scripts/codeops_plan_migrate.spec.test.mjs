/**
 * Specification tests for the CodeOps plan migration preview.
 *
 * These tests pin the migration admission contract: a legacy plan whose
 * checklist lines carry no task ids must not newly block the migration
 * preview, while the progress oracle still reports the narrowed (corrected)
 * counting result for the same document.
 *
 * Both commands spawn the real `python3` scripts against a temporary nested
 * CodeOps-style fixture, so the tested surface is exactly the one the skills
 * consume.
 *
 * This is the specification oracle: a failing test means the migration or the
 * parser is wrong, never the test.
 *
 * @module codeops_plan_migrate.spec.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** The migration preview under test. */
const MIGRATE_SCRIPT = join(ROOT, "scripts", "codeops_plan_migrate.py")

/** The progress oracle used for the cross-check. */
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
  const dir = mkdtempSync(join(tmpdir(), "codeops-migrate-spec-"))
  fixtures.push(dir)
  return dir
}

/**
 * Write a legacy nested plan whose only checklist lines are id-less.
 *
 * The plan declares its Implements target, so the migration preview's only
 * possible complaint would be the missing execution tasks.
 *
 * @param {string} base - Fixture root containing the nested migration tree.
 * @returns {string} Absolute path to the plan directory.
 */
function makeNestedLegacyPlan(base) {
  const planDir = join(base, "codeops", "features", "demo", "plans", "demo-plan")
  mkdirSync(planDir, { recursive: true })
  writeFileSync(join(planDir, "00-index.md"), "# Demo Plan\n\n> **Implements**: REQ-DEMO\n", "utf8")
  writeFileSync(join(planDir, "99-execution-plan.md"), "# Demo Plan\n\n- [ ] Do the thing\n", "utf8")
  return planDir
}

describe("codeops_plan_migrate.py admission", () => {
  it("should keep the migration preview clean for an id-less checklist while the parser reports it (ST-13)", () => {
    const base = makeBase()
    const planDir = makeNestedLegacyPlan(base)

    const preview = spawnSync("python3", [MIGRATE_SCRIPT, join(base, "codeops")], {
      encoding: "utf8",
    })

    assert.equal(preview.status, 0, preview.stdout + preview.stderr)
    assert.doesNotMatch(preview.stdout, /contains no execution tasks/)
    assert.doesNotMatch(preview.stdout, /BLOCKED/)

    const parsed = spawnSync(
      "python3",
      [PLAN_SCRIPT, "--root", base, "--plan", planDir, "--json"],
      { encoding: "utf8" }
    )
    const plan = JSON.parse(parsed.stdout).plans[0]

    assert.equal(plan.total, 0)
    assert.ok(
      plan.problems.some((problem) => problem.includes("contains no execution tasks")),
      `expected the no-execution-tasks problem, got: ${JSON.stringify(plan.problems)}`
    )
  })
})
