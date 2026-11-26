/**
 * Specification tests for the standard-tier single-document plan.
 *
 * At the `standard` verification tier make-plan writes one document —
 * `99-execution-plan.md` with a header, Decisions, Acceptance criteria, and
 * Tasks — after one batched question round, with no coverage hunt, no separate
 * ambiguity register, and no preflight; its acceptance criteria are its spec
 * cases; and the verification balance stops for the user above 1:1. The
 * `critical` tier keeps the full document set and today's rules. These content
 * guards pin that contract in the shipped skills and shared protocols.
 *
 * @module lean-plan-content.spec.test
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Read a repository file.
 *
 * @param {string} path - Path relative to the repository root.
 * @returns {string} The file text.
 */
function read(path) {
  return readFileSync(join(ROOT, path), "utf8")
}

/**
 * Return a Markdown section: from a heading to the next heading of the same or higher level.
 * Headings inside fenced code blocks (templates quote whole documents) do not end a section.
 *
 * @param {string} text - Document text.
 * @param {string} heading - The exact heading line.
 * @returns {string} The section, or "" when the heading is missing.
 */
function section(text, heading) {
  const start = text.indexOf(`${heading}\n`)
  if (start === -1) return ""
  const level = heading.match(/^#+/)[0].length
  const lines = text.slice(start + heading.length + 1).split("\n")
  const ends = new RegExp(`^#{1,${level}} `)
  let fenced = false
  const kept = []
  for (const line of lines) {
    if (/^ {0,3}(```|~~~)/.test(line)) fenced = !fenced
    if (!fenced && ends.test(line)) break
    kept.push(line)
  }
  return heading + "\n" + kept.join("\n")
}

/**
 * Collapse Markdown emphasis, code ticks, and whitespace for wording checks.
 *
 * @param {string} text - Markdown text.
 * @returns {string} Plain prose on one line.
 */
function prose(text) {
  return text.replace(/[*`]/g, "").replace(/\s+/g, " ")
}

const MAKE_PLAN = "skills/make-plan/SKILL.md"

describe("make-plan standard path", () => {
  it("LP-1 — writes one document after one batched question round, without hunt, register, or preflight", () => {
    const standard = section(read(MAKE_PLAN), "## Standard plan (single document)")
    assert.notEqual(standard, "", "make-plan must define the standard single-document path")
    const text = prose(standard)
    assert.match(text, /only 99-execution-plan\.md/i)
    assert.match(text, /one batched (?:question )?round/i)
    assert.match(text, /recommended (?:answer|option)/i)
    assert.match(text, /no coverage hunt/i)
    assert.match(text, /no separate (?:ambiguity )?register/i)
    assert.match(text, /no preflight/i)
    assert.match(text, /critical.{0,120}(?:full|00–07|unchanged)/i)
  })

  it("LP-2 — the template carries the single-document form with Decisions and Acceptance criteria", () => {
    const template = section(read("skills/make-plan/templates.md"), "## Standard single-document plan")
    assert.notEqual(template, "", "templates.md must carry the standard single-document template")
    for (const token of [
      "> **Implements**:",
      "> **Verification tier**: standard",
      "## Goal",
      "## Decisions",
      "## Acceptance criteria",
      "## Tasks",
      "D-1",
      "AC-1",
    ]) {
      assert.ok(template.includes(token), `the template must contain ${token}`)
    }
  })

  it("LP-5 — runs the coverage hunt by default for critical plans and skips it at standard", () => {
    const text = prose(read(MAKE_PLAN))
    assert.match(text, /critical(?:-tier)? (?:feature )?plans? run the coverage hunt by default/i)
    assert.match(text, /standard(?:-tier)? plans? skip (?:the coverage hunt|it)/i)
  })
})

describe("shared protocols for the standard plan", () => {
  it("LP-3 — the plan's Decisions table owns decisions, runtime ambiguities, and complexity approvals", () => {
    const text = prose(read("_shared/zero-ambiguity-gate.md"))
    assert.match(text, /standard.{0,80}single-document plan.{0,160}## Decisions/i)
    assert.match(text, /## Decisions.{0,240}runtime ambiguit/i)
    assert.match(text, /## Decisions.{0,320}complexity.{0,120}(?:full|complete) (?:approval )?evidence/i)
  })

  it("LP-4 — spec cases are the acceptance criteria; implementation tests only for named error paths", () => {
    const text = prose(read("_shared/spec-first-ordering.md"))
    assert.match(text, /standard.{0,160}spec(?:ification)? (?:test )?cases are the acceptance criteria/i)
    assert.match(text, /3[–-]8 per phase/)
    assert.match(text, /implementation tests? only (?:where|when) an acceptance criterion names an error path or edge case/i)
  })

  it("LP-6 — the verification balance stops for the user above 1:1 at standard and stays report-only at critical", () => {
    const protocol = read("skills/exec-plan/execution-protocol.md")
    const text = prose(section(protocol, "### Post-phase quality step (profile-gated)"))
    assert.match(text, /above 1:1/)
    assert.match(text, /standard.{0,200}(?:stop|STOP packet).{0,200}(?:user|decision)/i)
    assert.match(text, /critical.{0,80}report-only/i)
    assert.doesNotMatch(text, /above 1\.5:1/, "the 1.5:1 warning threshold is superseded")
  })

  it("LP-7 — exec-plan reads tier, goal, and baseline from the single document and records escalations there", () => {
    const text = prose(read("skills/exec-plan/execution-protocol.md") + "\n" + read("skills/exec-plan/SKILL.md"))
    assert.match(text, /Verification tier.{0,200}(?:00-index\.md|the plan's own header).{0,120}(?:single[- ]document|its own header|00-index\.md)/i)
    assert.match(text, /goal and smallest viable design from 00-index\.md or the single document/i)
    assert.match(text, /single-document (?:standard )?plan.{0,200}records? (?:it|the escalation|the decision) in its (?:## )?Decisions table/i)
  })
})
