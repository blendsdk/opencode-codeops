/**
 * Specification tests for phase-scoped execution and the standard review round.
 *
 * exec-plan hands each phase of three or more tasks to a fresh executor with a
 * compact phase packet and gets a structured report back, so the primary
 * session keeps the plan and short summaries instead of every edit. The parent
 * alone records marks and computes the verification balance. At the `standard`
 * tier one end-of-plan review round replaces per-phase rounds, except for
 * risk-tagged phases. These content guards pin that contract.
 *
 * @module phase-dispatch-content.spec.test
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const PROTOCOL = "skills/exec-plan/execution-protocol.md"

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
 * Return a Markdown section, ignoring headings inside fenced code blocks.
 *
 * @param {string} text - Document text.
 * @param {string} heading - The exact heading line.
 * @returns {string} The section, or "" when the heading is missing.
 */
function section(text, heading) {
  const start = text.indexOf(`${heading}\n`)
  if (start === -1) return ""
  const level = heading.match(/^#+/)[0].length
  const ends = new RegExp(`^#{1,${level}} `)
  const kept = []
  let fenced = false
  for (const line of text.slice(start + heading.length + 1).split("\n")) {
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

describe("phase-scoped execution", () => {
  const mode = () => prose(section(read(PROTOCOL), "## Execution mode — phase-scoped dispatch"))

  it("PD-1 — dispatches each phase of three or more tasks to a fresh executor at both tiers", () => {
    const text = mode()
    assert.notEqual(text, "", "the protocol must define phase-scoped dispatch")
    assert.match(text, /three or more tasks.{0,160}fresh executor/i)
    assert.match(text, /both tiers|standard and critical|every tier/i)
    assert.match(text, /fewer than three tasks.{0,120}inline/i)
  })

  it("PD-2 — sends a compact phase packet and receives a structured report", () => {
    const text = mode()
    assert.match(text, /phase packet/i)
    for (const field of ["files changed", "verify command", "result", "blockers"]) {
      assert.match(text, new RegExp(field, "i"), `the report carries ${field}`)
    }
    assert.match(text, /summar(?:y|ies)/i, "the parent keeps per-phase summaries")
  })

  it("PD-3 — only the parent records marks and computes the verification balance", () => {
    const text = mode()
    assert.match(text, /parent.{0,120}mark/i)
    assert.match(text, /parent.{0,200}(?:verification )?balance/i)
    assert.match(text, /executor never edits.{0,40}99-execution-plan\.md|never edits the plan/i)
  })

  it("PD-4 — critical phases run on the session model; standard phases on the executor role", () => {
    const text = mode()
    assert.match(text, /critical.{0,160}session model/i)
    assert.match(text, /standard.{0,120}executor/i)
  })

  it("PD-5 — at standard, one end-of-plan review round; per-phase review only for risk-tagged phases", () => {
    const protocol = prose(section(read(PROTOCOL), "### Post-phase quality step (profile-gated)"))
    const profile = prose(read("_shared/quality-profile.md"))
    for (const text of [protocol, profile]) {
      assert.match(text, /standard.{0,200}one (?:end-of-plan )?review round/i)
      assert.match(text, /risk-tagged/i)
      assert.doesNotMatch(text, /150 or more product lines|150.{0,40}product lines/i, "no line-count trigger")
    }
  })
})

describe("executor templates", () => {
  it("PD-6 — both executor templates accept the phase packet and return the phase report", () => {
    for (const template of ["agent-templates/plan-task-executor.md", "agent-templates/plan-task-executor-opus.md"]) {
      const text = prose(read(template))
      assert.match(text, /phase report/i, `${template} must define the phase report`)
      for (const field of ["files changed", "verify", "blockers"]) {
        assert.match(text, new RegExp(field, "i"), `${template}: the report carries ${field}`)
      }
      assert.match(text, /never edit.{0,60}99-execution-plan\.md|do not edit the plan/i)
    }
  })
})
