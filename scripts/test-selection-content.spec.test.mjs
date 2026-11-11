/**
 * Specification tests for the lightweight scoped-verification contract.
 *
 * These tests pin the user-visible rules that let a plan run a small,
 * validated verification command per task while the full project verify stays
 * the phase, release, and CI gate. They read the shipped Markdown directly
 * because the product surface here is agent guidance, not executable code.
 *
 * A failure means the guidance no longer states a rule the feature promises.
 * Fix the documents, never the expectations.
 *
 * @module test-selection-content.spec.test
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

/** Collapse Markdown line wrapping so a phrase is checked across source lines. */
function collapse(text) {
  return text.replace(/\s+/g, " ")
}

/** Assert that every phrase appears in the text, ignoring line wrapping. */
function containsAll(text, phrases, label) {
  const flat = collapse(text)
  for (const phrase of phrases) {
    assert.ok(flat.includes(collapse(phrase)), `${label} must contain: ${phrase}`)
  }
}

describe("ST-49 prime directives and conditional standards wording", () => {
  const directives = [
    "Test-first is unchanged",
    "smallest safe verification slice",
    "outer gate is always full",
    "Selection fails closed",
    "Spec tests are never skipped",
    "Evidence is explicit",
  ]

  for (const file of ["standards/coding-standards.md", "standards/coding-standards-full.md"]) {
    it(`${file} carries all six prime directives`, () => {
      containsAll(read(file), directives, file)
    })

    it(`${file} keeps the full gate as the default and names the opt-in exception`, () => {
      const text = read(file)
      containsAll(
        text,
        [
          "codeops/test-map.json",
          "**Task verify**",
          "full verify",
          "falls back to the full",
        ],
        file,
      )
    })
  }
})

describe("ST-50 canonical shared selection protocol", () => {
  const path = "_shared/test-selection.md"

  it("exists", () => {
    assert.ok(existsSync(join(ROOT, path)), `${path} must exist`)
  })

  it("documents every gate and the no-map contract", () => {
    containsAll(
      read(path),
      [
        "task",
        "phase",
        "pr",
        "release",
        "acceptance",
        "nightly",
        "no-map",
        "fullCommand",
        "CODEOPS_LAST_FULL_SHA",
        "--include",
        "CODEOPS-TESTING",
        "organize-tests",
      ],
      path,
    )
  })

  it("links the selector CLI, map schema, and adoption skill", () => {
    containsAll(
      read(path),
      [
        "bin/codeops-test.mjs",
        "schemas/test-map.schema.json",
        "skills/organize-tests/SKILL.md",
      ],
      path,
    )
  })

  it("is the target of the spec-first phase-gate wording", () => {
    containsAll(read("_shared/spec-first-ordering.md"), ["test-selection.md"], "spec-first ordering")
  })
})

describe("ST-51 workflow skills expose the conditional path", () => {
  it("make-plan records both commands and validates the task command", () => {
    containsAll(
      read("skills/make-plan/SKILL.md"),
      ["**Task verify**", "**Verify (gate)**", "test count", "declared spec file"],
      "make-plan SKILL",
    )
    containsAll(
      read("skills/make-plan/templates.md"),
      ["Test Slices & Groups", "**Task verify**", "**Verify (gate)**"],
      "make-plan templates",
    )
    containsAll(
      read("skills/make-plan/quality-checklist.md"),
      ["task-tier", "Test slices", "full gate"],
      "make-plan checklist",
    )
  })

  it("exec-plan names the explicit phase baseline, spec include, and fallback", () => {
    containsAll(
      read("skills/exec-plan/SKILL.md"),
      ["--baseline", "--include", "expected modification set"],
      "exec-plan SKILL",
    )
    containsAll(
      read("skills/exec-plan/execution-protocol.md"),
      ["--baseline", "--include", "expected modification set", "old plan"],
      "execution protocol",
    )
  })

  it("git-commit scopes normal commits and keeps the full gate for release", () => {
    containsAll(
      read("skills/git-commit/SKILL.md"),
      ["scoped", "full gate", "release"],
      "git-commit SKILL",
    )
  })

  it("analyze-project preserves the testing block and never renders it", () => {
    containsAll(
      read("skills/analyze-project/SKILL.md"),
      ["CODEOPS-TESTING", "preserve", "organize-tests", "never render"],
      "analyze-project SKILL",
    )
  })
})

describe("ST-52 compatibility and containment", () => {
  it("states the old-plan fallback", () => {
    const text = read("skills/exec-plan/execution-protocol.md")
    containsAll(text, ["single `**Verify**`", "gate command"], "old-plan fallback")
  })

  it("keeps the shipped content free of plugin-root placeholders and .codex paths", () => {
    const files = [
      "standards/coding-standards.md",
      "standards/coding-standards-full.md",
      "_shared/test-selection.md",
      "skills/make-plan/SKILL.md",
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
