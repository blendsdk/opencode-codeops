/**
 * Specification tests for single-document plans in the plan tooling.
 *
 * A standard-tier plan is one `99-execution-plan.md` whose header declares
 * `Implements` and the verification tier; it has no `00-index.md`. The parser
 * and the nested-layout migration must treat it as current instead of
 * reporting a missing index or creating one.
 *
 * @module codeops-plan-single-doc.spec.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const PLAN_SCRIPT = join(ROOT, "scripts", "codeops_plan.py")
const MIGRATE_SCRIPT = join(ROOT, "scripts", "codeops_plan_migrate.py")

/** Throwaway directories created by the tests, removed afterward. */
const bases = []

after(() => {
  for (const base of bases) rmSync(base, { recursive: true, force: true })
})

/**
 * Write a single-document standard plan into a directory.
 *
 * @param {string} planDir - The plan directory.
 * @param {string} implementsValue - The Implements declaration.
 */
function writeSingleDocPlan(planDir, implementsValue) {
  mkdirSync(planDir, { recursive: true })
  writeFileSync(
    join(planDir, "99-execution-plan.md"),
    [
      "# Plan: Demo",
      "",
      "> **CodeOps Artifact Schema**: 1",
      `> **Implements**: ${implementsValue}`,
      "> **Verification tier**: standard — bounded UI change",
      "> **Progress**: 0/2 tasks (0%)",
      "",
      "## Tasks",
      "",
      "- [ ] 1.1.1 Write the spec tests for AC-1 and AC-2 and confirm they fail",
      "- [ ] 1.1.2 Implement the change; the spec tests pass",
      "",
    ].join("\n")
  )
}

describe("single-document plans", () => {
  it("SD-1 — the parser reads Implements from the plan header and reports no missing index", () => {
    const base = mkdtempSync(join(process.env.CODEOPS_TMPDIR || tmpdir(), "single-doc-spec-"))
    bases.push(base)
    writeSingleDocPlan(join(base, "plans", "demo"), "RD-07")
    const result = spawnSync("python3", [PLAN_SCRIPT, "--root", base, "--plan", "plans/demo", "--json"], {
      encoding: "utf8",
    })
    assert.equal(result.status, 0, result.stdout + result.stderr)
    const plan = JSON.parse(result.stdout).plans[0]
    assert.deepEqual(plan.implements, ["RD-07"])
    assert.deepEqual(plan.problems, [])
    assert.equal(plan.total, 2)
  })

  it("SD-2 — the nested migration keeps the declaration in the single document and creates no index", () => {
    const base = mkdtempSync(join(process.env.CODEOPS_TMPDIR || tmpdir(), "single-doc-spec-"))
    bases.push(base)
    const codeops = join(base, "codeops")
    mkdirSync(join(codeops, "features", "demo", "requirements"), { recursive: true })
    writeFileSync(join(codeops, "features", "demo", "requirements", "RD-07-demo.md"), "# RD-07: Demo\n")
    const planDir = join(codeops, "features", "demo", "plans", "demo-plan")
    writeSingleDocPlan(planDir, "demo/RD-07")
    const result = spawnSync("python3", [MIGRATE_SCRIPT, codeops], { encoding: "utf8" })
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.match(result.stdout, /KEEP \S*99-execution-plan\.md: demo\/RD-07 \(existing declaration\)/)
    assert.equal(existsSync(join(planDir, "00-index.md")), false, "no index is created")
  })
})
