/**
 * Specification tests for the Discovery protocol content.
 *
 * These cases pin the agent-facing protocol, its adoption by make-plan and
 * preflight, and the analyze-project switch. The files are Markdown, so the
 * assertions are the required phrases and sections rather than rendered HTML.
 *
 * @module discovery-content.spec.test
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, it } from "node:test"

/** The repository root. */
const ROOT = fileURLToPath(new URL("..", import.meta.url))

/** Read one repository file. */
function read(relative) {
  return readFileSync(join(ROOT, relative), "utf8")
}

/** The section of a file between two headings (the end is exclusive). */
function section(text, start, end) {
  const from = text.indexOf(start)
  assert.ok(from >= 0, `missing section ${start}`)
  const to = end === undefined ? text.length : text.indexOf(end, from + start.length)
  return text.slice(from, to === -1 ? text.length : to)
}

describe("shared Discovery protocol", () => {
  it("should document the opt-in, round size, publishing, waking, and gate safety", () => {
    const text = read("_shared/discovery.md")
    assert.match(text, /\*\*CodeOps Artifact Schema\*\*: 1/)
    for (const needle of [
      "chatMaxQuestions",
      "--no-discovery",
      "Complexity Escalation",
      "takeover",
      "codeops_discovery_publish",
      "codeops_discovery_answers",
      "codeops_discovery_resolve",
      "implied by",
    ]) {
      assert.ok(text.includes(needle), `discovery.md must mention ${needle}`)
    }
    assert.ok(
      /end the turn/i.test(text) && /(do not poll|without polling)/i.test(text),
      "the protocol must end the turn without polling",
    )
    assert.ok(
      /never\s+(skip|weaken)/i.test(text),
      "the protocol must forbid skipping or weakening a gate",
    )
  })

  it("should keep the register authoritative in the shared gate", () => {
    const text = read("_shared/zero-ambiguity-gate.md")
    const discovery = section(text, "## Discovery", "## Deferral rules")
    assert.ok(discovery.includes("discovery.md"), "the section must link the protocol")
    assert.ok(/authoritative record/i.test(discovery), "the register stays authoritative")
    assert.ok(/complexity escalation/i.test(discovery), "escalations stay in the gate")
    assert.ok(discovery.includes("STOP packet"), "the escalation packet stays in chat")
    for (const needle of ["decision", "owner", "revisit"]) {
      assert.ok(discovery.includes(needle), `deferrals keep ${needle}`)
    }
  })
})

describe("make-plan adoption", () => {
  it("should offer --no-discovery and reference the protocol in both question phases", () => {
    const text = read("skills/make-plan/SKILL.md")
    assert.ok(text.includes("--no-discovery"), "make-plan must offer --no-discovery")
    const questions = section(text, "### 1.1 Ask clarifying questions", "### 1.2")
    assert.ok(questions.includes("discovery.md"), "Phase 1.1 must reference the protocol")
    const gate = section(text, "## Phase 1C", "## Phase 2")
    assert.ok(gate.includes("discovery.md"), "Phase 1C must reference the protocol")
  })
})

describe("preflight adoption", () => {
  it("should offer --no-discovery and the Discovery decision path in Step 5", () => {
    const skill = read("skills/preflight/SKILL.md")
    assert.ok(skill.includes("--no-discovery"), "preflight must offer --no-discovery")
    const format = read("skills/preflight/report-format.md")
    const step = section(format, "### Discovery path", "### Batch presentation rules")
    for (const needle of ["single-other", "PF-NNN", "CRITICAL", "MAJOR", "MINOR", "OBSERVATION"]) {
      assert.ok(step.includes(needle), `the Discovery path must mention ${needle}`)
    }
    assert.match(step, /CRITICAL.*MAJOR.*MINOR.*OBSERVATION/s)
    assert.match(step, /Defer is recorded as \*\*Accepted Risk\*\*/i)
  })
})

describe("analyze-project adoption", () => {
  it("should document both flags, the managed line, the minimal file, and the usage error", () => {
    const text = read("skills/analyze-project/SKILL.md")
    for (const needle of [
      "--with-discovery",
      "--without-discovery",
      '"mode": "strict"',
      '"discovery": { "enabled": true }',
      "- Discovery: enabled — question rounds open in the local Discovery page",
    ]) {
      assert.ok(text.includes(needle), `analyze-project must mention ${needle}`)
    }
    for (const rule of [/exactly one copy/i, /full-line/i, /dominant line ending/i, /symlink/i]) {
      assert.match(text, rule)
    }
    assert.ok(
      /both flags/i.test(text) && /usage error/i.test(text),
      "both flags together must be a usage error",
    )
  })
})
