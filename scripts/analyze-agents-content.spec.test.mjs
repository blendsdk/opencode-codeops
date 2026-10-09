/**
 * Specification tests for the analyze-agents specialist discovery content.
 *
 * These tests pin the repository-visible contract of the manual specialist
 * check: the analyze-agents skill exists with its documented flow, the
 * protocol document defines the per-plan findings ledger and names the skill
 * as the detection execution surface, and the existing detection steps
 * delegate to it while keeping the manual fallback.
 *
 * This is the specification oracle for the content side of the feature: a
 * failure here means the repository content is wrong, never the test.
 *
 * @module analyze-agents-content.spec.test
 */

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SKILL_PATH = "skills/analyze-agents/SKILL.md"

/**
 * Read a repository file as UTF-8 text.
 * @param {string} relativePath - Path relative to the repository root.
 * @returns {string} The file contents.
 */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("analyze-agents skill contract", () => {
  it("ships with a name, a description, and the documented flow sections", () => {
    assert.equal(existsSync(join(ROOT, SKILL_PATH)), true, "the analyze-agents skill must exist")
    const content = read(SKILL_PATH)
    assert.match(content, /^name:\s*analyze-agents$/m)
    assert.match(content, /^description:\s*\S+/m)
    for (const section of [/evidence/i, /detection flow/i, /output/i, /check state/i, /hand.?off/i, /layout/i]) {
      assert.match(content, section, "the skill must document its full flow")
    }
  })

  it("reads repository artifacts natively without invoking a script", () => {
    const content = read(SKILL_PATH)
    assert.match(content, /requirements and plans|requirements\/|plan documents/i)
    assert.match(content, /ledger/i)
    assert.match(content, /manifest/i)
    assert.doesNotMatch(content, /\bpython3\b|\bpip\b|\bnode\b|\bnpm\b|\bnpx\b|\byarn\b|\bpnpm\b|\bcurl\b|\bwget\b|\bbash\b|https?:\/\/|scripts\//i)
  })

  it("writes the check-state file on every run, including a None outcome", () => {
    const content = read(SKILL_PATH)
    assert.match(content, /codeops\/specialist-check\.json/)
    assert.match(content, /"checkedAt"/)
    assert.match(content, /"plans"/)
    assert.match(content, /every run/i)
    assert.match(content, /none/i)
  })

  it("emits at most two lightweight proposals or a None with evidence", () => {
    const content = read(SKILL_PATH)
    assert.match(content, /at most (?:two|2)/i)
    assert.match(content, /lightweight proposal/i)
    assert.match(content, /file:line/)
    assert.match(content, /None[^.]*evidence/i)
    assert.match(content, /smallest alternative/i)
  })

  it("degrades loudly on missing or malformed records", () => {
    const content = read(SKILL_PATH)
    assert.match(content, /reduced/i)
    assert.match(content, /malformed/i)
    assert.match(content, /never checked/i)
  })

  it("never creates agents and hands off to setup-routing", () => {
    const content = read(SKILL_PATH)
    assert.match(content, /setup-routing/)
    assert.match(content, /never (?:create|write|modify)/i)
  })
})

describe("specialist protocol ledger and execution surface", () => {
  it("defines the per-plan findings ledger with its location, row format, and writer", () => {
    const content = read("_shared/specialist-agents.md")
    assert.match(content, /05-findings\.md/)
    assert.match(content, /plans\/<plan>\/05-findings\.md/)
    assert.match(content, /\| Finding \| Phase \| Severity \| Area \| Ruling \|/)
    assert.match(content, /exec-plan[^.]*ruling step/i)
  })

  it("names analyze-agents as the detection execution surface", () => {
    const content = read("_shared/specialist-agents.md")
    assert.match(content, /analyze-agents/)
    assert.match(content, /execution surface for the criteria/i)
  })
})

describe("detection delegation in the existing skills", () => {
  it("delegates make-plan and make-requirements detection to the analyze-agents flow with a fallback", () => {
    for (const file of ["skills/make-plan/SKILL.md", "skills/make-requirements/SKILL.md"]) {
      const content = read(file)
      assert.match(content, /analyze-agents/, `${file} must delegate to analyze-agents`)
      assert.match(content, /fallback when the skill is unavailable/i, `${file} must retain the manual fallback`)
    }
  })
})

describe("findings ledger wiring in exec-plan", () => {
  it("records ruling batches in the per-plan findings ledger with the documented format", () => {
    const protocol = read("skills/exec-plan/execution-protocol.md")
    assert.match(protocol, /plans\/<plan>\/05-findings\.md/)
    assert.match(protocol, /one-line title/i)
    assert.match(protocol, /\| Finding \| Phase \| Severity \| Area \| Ruling \|/)
    assert.match(protocol, /fixed[^.]*accepted[^.]*deferred[^.]*dismissed/i)
    assert.match(protocol, /lazily/i)
    assert.doesNotMatch(protocol, /durable finding artifact|the finding artifact/i)
  })

  it("removes the undefined finding-artifact reference from the exec-plan summary", () => {
    const skill = read("skills/exec-plan/SKILL.md")
    assert.match(skill, /05-findings\.md/)
    assert.doesNotMatch(skill, /durable finding artifact/i)
  })
})
