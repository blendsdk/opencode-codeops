/**
 * Implementation tests for the lightweight scoped-verification guidance.
 *
 * The specification tests pin the promised rules. These tests cover the
 * internal consistency that keeps the guidance safe to ship: one owner for the
 * managed testing block, no stale "always run the full suite per task" text,
 * working cross-links, and no leaked installation placeholders.
 *
 * @module test-selection-content.impl.test
 */

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const ROOT = new URL("..", import.meta.url).pathname

/** Read a repository file as UTF-8 text. */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

/** Collapse Markdown line wrapping so phrases are checked across source lines. */
function collapse(text) {
  return text.replace(/\s+/g, " ")
}

describe("scoped verification consistency", () => {
  it("keeps the old-plan fallback in both the skill and the protocol", () => {
    assert.ok(collapse(read("skills/exec-plan/SKILL.md")).includes("old plan"))
    assert.ok(collapse(read("skills/exec-plan/execution-protocol.md")).includes("single `**Verify**`"))
  })

  it("does not restore an unconditional full-verify-per-task rule", () => {
    const files = [
      "skills/exec-plan/SKILL.md",
      "skills/exec-plan/execution-protocol.md",
      "skills/make-plan/SKILL.md",
      "skills/git-commit/SKILL.md",
    ]
    for (const file of files) {
      const text = collapse(read(file))
      assert.ok(!text.includes("run the full verify before every task"), `${file} restored the old rule`)
      assert.ok(!text.includes("full verify per task"), `${file} restored the old rule`)
    }
  })

  it("names organize-tests as the only writer of the testing block", () => {
    const text = collapse(read("_shared/test-selection.md"))
    assert.ok(text.includes("sole writer of the `CODEOPS-TESTING` block"))
    assert.ok(text.includes("preserves that block byte-for-byte"))
  })

  it("links the workspace hygiene protocol from the workflow guidance", () => {
    for (const file of ["skills/make-plan/SKILL.md", "skills/exec-plan/SKILL.md", "skills/git-commit/SKILL.md"]) {
      assert.ok(collapse(read(file)).includes("workspace-hygiene.md"), `${file} is missing the hygiene link`)
    }
  })

  it("keeps every referenced shared document present", () => {
    const text = collapse(read("_shared/test-selection.md"))
    for (const reference of [
      "bin/codeops-test.mjs",
      "schemas/test-map.schema.json",
      "skills/organize-tests/SKILL.md",
      "_shared/spec-first-ordering.md",
    ]) {
      assert.ok(text.includes(reference), `missing reference: ${reference}`)
    }
    assert.ok(existsSync(join(ROOT, "_shared/test-selection.md")))
  })

  it("contains no plugin-root or legacy host path leaks", () => {
    const files = [
      "standards/coding-standards.md",
      "standards/coding-standards-full.md",
      "_shared/test-selection.md",
      "_shared/spec-first-ordering.md",
      "skills/make-plan/SKILL.md",
      "skills/make-plan/templates.md",
      "skills/make-plan/quality-checklist.md",
      "skills/exec-plan/SKILL.md",
      "skills/exec-plan/execution-protocol.md",
      "skills/git-commit/SKILL.md",
      "skills/analyze-project/SKILL.md",
    ]
    for (const file of files) {
      const text = read(file)
      assert.ok(!text.includes("${PLUGIN_ROOT}"), `${file} leaks \${PLUGIN_ROOT}`)
      assert.ok(!text.includes(".codex/"), `${file} leaks .codex/`)
    }
  })
})
