/**
 * Specification tests for the adaptive reasoning effort documentation.
 *
 * These content guards pin the required clauses of the shipped contract
 * document: the schema stamp, the four levels, the marker literal, the
 * precedence chain, the skill table, the derivation signals, and the
 * suggestion-only guarantee. They also guard the plugin wiring that consumes
 * the contract. A failure here means the content does not satisfy the
 * contract — never that the test is wrong.
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

describe("plugin wiring content", () => {
  it("should register the chat hooks and import the reasoning-effort helper", () => {
    const content = read("plugin/index.ts")
    assert.match(content, /"chat\.message"/)
    assert.match(content, /"chat\.params"/)
    assert.match(content, /reasoning-effort\.mjs/)
    assert.match(content, /CODEOPS_EFFORT_TRACE/)
  })
})

describe("make-plan integration content", () => {
  it("should carry the advisory reasoning line and link the shared contract", () => {
    assert.match(read("skills/make-plan/templates.md"), /> \*\*Reasoning\*\*:/)
    const skill = read("skills/make-plan/SKILL.md")
    assert.match(skill, /> \*\*Reasoning\*\*:/)
    assert.match(skill, /_shared\/reasoning-effort\.md/)
  })
})

describe("exec-plan integration content", () => {
  it("should carry the packet marker, inline suggestion, and the flag section", () => {
    const protocol = read("skills/exec-plan/execution-protocol.md")
    assert.match(protocol, /\[codeops-effort:/)
    assert.match(protocol, /Suggested reasoning:/)
    assert.match(read("skills/exec-plan/SKILL.md"), /--auto-effort/)
  })
})

describe("skill flag content", () => {
  it("should carry the flag section and the contract link in every supported skill", () => {
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
      const content = read(`skills/${skill}/SKILL.md`)
      assert.match(content, /--auto-effort/, `${skill} must document --auto-effort`)
      assert.match(
        content,
        /_shared\/reasoning-effort\.md/,
        `${skill} must link the shared contract`
      )
    }
    assert.match(
      read("skills/preflight/SKILL.md"),
      /`max`[^\n]*`--thorough`|`--thorough`[^\n]*`max`/,
      "preflight must document max with --thorough"
    )
  })
})

describe("documentation content", () => {
  it("should document the marker, the flag, the routing policy, and the contract link", () => {
    const readme = read("README.md")
    assert.match(readme, /\[codeops-effort:/)
    assert.match(readme, /--auto-effort/)
    assert.match(read("skills/setup-routing/routing.md"), /Reasoning effort/i)
    assert.match(read("_shared/quality-profile.md"), /reasoning-effort\.md/)
  })
})
