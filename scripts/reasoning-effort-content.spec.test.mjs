/**
 * Specification tests for the adaptive reasoning effort documentation.
 *
 * These content guards pin the required clauses of the shipped contract
 * document: the schema stamp, the four levels, the marker literal, the
 * precedence chain, the skill table, the derivation signals, and the
 * suggestion-only guarantee. A failure here means the documentation does not
 * satisfy the contract — never that the test is wrong.
 *
 * @module reasoning-effort-content.spec.test
 */

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** Shipped contract document consumed by the plugin and the plan skills. */
const CONTRACT_DOC = "_shared/reasoning-effort.md"

/**
 * Read a repository file as UTF-8 text.
 *
 * @param {string} relativePath - Path relative to the repository root.
 * @returns {string} The file contents.
 */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("reasoning-effort contract document", () => {
  it("exists with the CodeOps artifact schema stamp", () => {
    assert.equal(existsSync(join(ROOT, CONTRACT_DOC)), true, `${CONTRACT_DOC} must exist`)
    assert.match(read(CONTRACT_DOC), /^> \*\*CodeOps Artifact Schema\*\*: 1$/m)
  })

  it("documents the four levels and the marker literal", () => {
    const content = read(CONTRACT_DOC)
    for (const level of ["low", "medium", "high", "max"]) {
      assert.match(content, new RegExp("`" + level + "`"), `must document level ${level}`)
    }
    assert.match(content, /\[codeops-effort:/)
  })

  it("documents the precedence chain from most specific to inherited", () => {
    const content = read(CONTRACT_DOC)
    assert.match(content, /dispatch marker[\s\S]*?session[\s\S]*?routing[\s\S]*?inherit/i)
  })

  it("lists the seven skills that accept the flag", () => {
    const content = read(CONTRACT_DOC)
    const skills = [
      "make-requirements",
      "make-plan",
      "preflight",
      "grill-me",
      "exec-plan",
      "retro-requirements",
      "upgrade-plan",
    ]
    for (const skill of skills) {
      assert.match(content, new RegExp("`" + skill + "`"), `must list ${skill}`)
    }
    assert.match(content, /--auto-effort/)
  })

  it("documents the derivation signals for plan suggestions", () => {
    const content = read(CONTRACT_DOC)
    assert.match(content, /complexity escalation/i)
    assert.match(content, /security/i)
    assert.match(content, /financial/i)
    assert.match(content, /rename/i)
  })

  it("states the suggestion-only guarantee", () => {
    const content = read(CONTRACT_DOC)
    assert.match(content, /suggestion[- ]only/i)
    assert.match(content, /never (?:a )?gate|no gate/i)
  })
})
