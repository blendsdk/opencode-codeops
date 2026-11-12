/**
 * Specification tests for the CI and release integration.
 *
 * The reusable full gate is the only place CI runs the whole suite. These cases
 * pin that invariant, the stable required check, and the advisory templates that
 * user projects receive.
 *
 * @module ci-workflows-content.spec.test
 */

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const ROOT = new URL("..", import.meta.url).pathname

/** Read a repository file. */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

/** Collapse whitespace for phrase checks. */
function flat(text) {
  return text.replace(/\s+/g, " ")
}

/** Assert every phrase is present. */
function containsAll(text, phrases, label) {
  const value = flat(text)
  for (const phrase of phrases) {
    assert.ok(value.includes(flat(phrase)), `${label} must contain: ${phrase}`)
  }
}

describe("ST-53 reusable full gate", () => {
  it("exists and exposes workflow_call", () => {
    assert.ok(existsSync(join(ROOT, ".github/workflows/verify-full.yml")))
    const workflow = read(".github/workflows/verify-full.yml")
    containsAll(workflow, ["workflow_call", "npm ci --ignore-scripts", "npm run verify", "npm pack --dry-run"], "verify-full")
  })

  it("is called by CI and release instead of duplicating the full command", () => {
    const reusable = "./.github/workflows/verify-full.yml"
    const ci = read(".github/workflows/ci.yml")
    const release = read(".github/workflows/release.yml")
    assert.ok(ci.includes(`uses: ${reusable}`))
    assert.ok(release.includes(`uses: ${reusable}`))
    assert.ok(!ci.includes("npm run verify"), "ci.yml must not run the full suite twice")
    assert.ok(!release.includes("npm run verify"), "release.yml must not run the full suite twice")
  })

  it("keeps a stable required verify check", () => {
    const ci = read(".github/workflows/ci.yml")
    containsAll(ci, ["verify:", "name: Verify", "needs:", "if: always()"], "ci.yml")
  })
})

describe("ST-53 advisory template", () => {
  const path = "skills/organize-tests/references/ci-github-actions.md"

  it("exists and covers the gate ladder", () => {
    assert.ok(existsSync(join(ROOT, path)))
    containsAll(
      read(path),
      [
        "release",
        "acceptance",
        "full gate",
        "stable `verify`",
        "check --strict",
        "CODEOPS_LAST_FULL_SHA",
        "success",
        "--source-commit",
        "CODEOWNERS",
        "pull_request_target",
      ],
      "CI template",
    )
  })

  it("documents all four plan modes and an always-present matrix", () => {
    containsAll(
      read(path),
      ["groups", "full", "none", "skip", "matrix", "include"],
      "CI template",
    )
  })
})

describe("ST-54 package payload", () => {
  it("declares the new skill, schema, CLI, shared protocol, and references", () => {
    const pkg = JSON.parse(read("package.json"))
    assert.ok(pkg.files.includes("skills/"))
    assert.ok(pkg.files.includes("schemas/"))
    assert.ok(pkg.files.includes("bin/"))
    assert.ok(pkg.files.includes("_shared/"))
    assert.equal(pkg.bin["codeops-test"], "bin/codeops-test.mjs")
    assert.ok(pkg.files.includes("!bin/fixtures/"))
    for (const file of [
      "skills/organize-tests/SKILL.md",
      "schemas/test-map.schema.json",
      "bin/codeops-test.mjs",
      "_shared/test-selection.md",
    ]) {
      assert.ok(existsSync(join(ROOT, file)), file)
    }
  })
})

describe("ST-58 plan modes", () => {
  it("keeps full and none as modes, never fake group entries", () => {
    const template = read("skills/organize-tests/references/ci-github-actions.md")
    containsAll(template, ["mode == 'groups'", "mode == 'full'", "empty matrix"], "CI template")
    assert.ok(!template.includes("group: full"))
  })
})
