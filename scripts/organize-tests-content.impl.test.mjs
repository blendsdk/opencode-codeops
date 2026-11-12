/**
 * Implementation tests for the `organize-tests` skill package.
 *
 * These check the internal consistency a reviewer would otherwise have to
 * verify by hand: reference files exist, the skill is discoverable by the
 * installer, the testing block has one owner, and the safety wording is not
 * contradicted elsewhere.
 *
 * @module organize-tests-content.impl.test
 */

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { describe, it } from "node:test"

const ROOT = new URL("..", import.meta.url).pathname
const SKILL_DIR = join(ROOT, "skills", "organize-tests")

/** Read a repository file. */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

/** Collapse Markdown wrapping. */
function flat(text) {
  return text.replace(/\s+/g, " ")
}

describe("skill package", () => {
  it("has a frontmatter name that matches its directory", () => {
    const text = read("skills/organize-tests/SKILL.md")
    const match = text.match(/^---\nname: ([^\n]+)\n/)
    assert.ok(match)
    assert.equal(match[1], basename(SKILL_DIR))
  })

  it("ships every referenced file", () => {
    const text = read("skills/organize-tests/SKILL.md")
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      const link = match[1]
      if (link.startsWith("http") || link.startsWith("#")) continue
      assert.ok(existsSync(join(SKILL_DIR, link)), `missing ${link}`)
    }
  })

  it("is discoverable by the installer convention", () => {
    const installer = read("bin/install-skills.mjs")
    assert.match(installer, /skills/)
    assert.match(installer, /SKILL\.md/)
  })
})

describe("ownership and preservation", () => {
  it("states one writer and a byte-for-byte preserver", () => {
    const block = flat(read("skills/organize-tests/references/agents-testing-block.md"))
    assert.ok(block.includes("sole writer"))
    assert.ok(block.includes("preserves it byte-for-byte"))
    assert.ok(block.includes("never render"))

    const analyze = flat(read("skills/analyze-project/SKILL.md"))
    assert.ok(analyze.includes("CODEOPS-TESTING"))
    assert.ok(analyze.includes("preserve it byte-for-byte"))
    assert.ok(analyze.includes("never render"))
  })

  it("documents the no-map text without creating a block", () => {
    const block = flat(read("skills/organize-tests/references/agents-testing-block.md"))
    assert.ok(block.includes("full suite only (no test map)"))
    assert.ok(block.includes("analyze-project") && block.includes("no map"))
  })
})

describe("safety wording", () => {
  it("never suggests editing tests or removing CI jobs", () => {
    const text = flat(read("skills/organize-tests/SKILL.md"))
    assert.ok(text.includes("Never edit, move, delete, or weaken a test"))
    assert.ok(text.includes("Never remove a CI job"))
    assert.ok(!text.includes("delete the failing test"))
    assert.ok(!text.includes("remove the full gate"))
  })

  it("requires staging and rollback before a write", () => {
    const text = flat(read("skills/organize-tests/SKILL.md"))
    assert.ok(text.includes("Apply with staging"))
    assert.ok(text.includes("restore every prior file on failure"))
    assert.ok(text.includes("Never leave a partial map"))
  })

  it("keeps CI guidance additive and fork-safe", () => {
    const text = flat(read("skills/organize-tests/SKILL.md"))
    assert.ok(text.includes("Preserve existing jobs"))
    assert.ok(text.includes("never remove a job"))
    assert.ok(text.includes("pull_request_target"))
  })
})

describe("references", () => {
  it("links the workspace hygiene protocol", () => {
    assert.ok(read("skills/organize-tests/SKILL.md").includes("_shared/workspace-hygiene.md"))
  })

  it("documents acceptance modes and metrics fields", () => {
    const text = flat(read("skills/organize-tests/SKILL.md"))
    for (const phrase of ["manual", "external", "na", "selected/total", "fallback reason", "map hash"]) {
      assert.ok(text.includes(phrase), phrase)
    }
  })

  it("contains no plugin-root or legacy host path leaks in any shipped file", () => {
    for (const name of [
      "SKILL.md",
      "references/analysis-protocol.md",
      "references/language-adapters.md",
      "references/shadow-mode.md",
      "references/map-health.md",
      "references/agents-testing-block.md",
    ]) {
      const text = readFileSync(join(SKILL_DIR, name), "utf8")
      assert.ok(!text.includes("${PLUGIN_ROOT}"), `${name} leaks \${PLUGIN_ROOT}`)
      assert.ok(!text.includes(".codex/"), `${name} leaks .codex/`)
    }
  })
})
