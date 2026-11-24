/**
 * Specification tests for the requirements-stage coverage hunt.
 *
 * These content guards pin how `make-requirements` schedules the hunt, parses
 * its flags, dispatches and merges clusters, routes candidates into the
 * register, persists the coverage map, runs the diagnostic health check, and
 * discloses effort. A failure here means the shipped skill guidance lost a
 * required guarantee — never that the test is wrong.
 *
 * @module requirements-coverage-content.spec.test
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SKILL = "skills/make-requirements/SKILL.md"
const PHASES = "skills/make-requirements/discovery-phases.md"
const REVIEW = "skills/make-requirements/review-and-add.md"
const SCOPE = "_shared/scope-expansion-control.md"

/**
 * Read one repository document.
 *
 * @param relativePath - Path relative to the repository root
 * @returns The document text
 */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

/**
 * Return one level-2 section, without its heading.
 *
 * @param content - Full document
 * @param title - Exact level-2 heading text
 * @returns The section body, excluding headings inside fenced code
 */
function section(content, title) {
  const lines = content.split("\n")
  const start = lines.findIndex((line) => line.trim() === `## ${title}`)
  assert.notEqual(start, -1, `missing section: ${title}`)
  const body = []
  let fenced = false
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim().startsWith("```")) fenced = !fenced
    if (!fenced && line.startsWith("## ")) break
    body.push(line)
  }
  return body.join("\n")
}

/**
 * Assert that the markers appear in increasing order.
 *
 * @param content - Text to search
 * @param markers - Marker strings
 */
function assertOrder(content, markers) {
  let previous = -1
  for (const marker of markers) {
    const at = content.indexOf(marker)
    assert.notEqual(at, -1, `missing marker: ${marker}`)
    assert.ok(at > previous, `${marker} must come after the previous marker`)
    previous = at
  }
}

describe("placement and defaults", () => {
  it("runs after Phase 2 structuring and before the Phase 2B gate", () => {
    const skill = read(SKILL)

    assertOrder(skill, ["2. Structuring", "2A. Coverage Hunt", "2B. Zero-Ambiguity Gate"])
    assert.match(
      skill,
      /after Phase 2 structuring[\s\S]{0,80}before Phase 2B|Phase 2 structuring[\s\S]{0,160}before Phase 2B/i
    )
  })

  it("is on by default for full discovery and health checks; add mode is unchanged", () => {
    const skill = read(SKILL)
    const review = read(REVIEW)
    const options = section(skill, "Coverage hunt option")

    assert.match(options, /hunt is on by default for Full\s+Discovery and Health Check/i)
    assert.match(options, /add_requirement`? does not run it/i)
    assert.match(
      review,
      /Health Check runs the coverage hunt by\s+default|runs the coverage hunt by\s+default/i
    )
    const add = review.slice(
      review.indexOf("## add_requirement Protocol"),
      review.indexOf("## review_requirements Protocol")
    )
    assert.match(add, /does not run the coverage hunt/i)
  })
})

describe("flags", () => {
  it("parses the disable and thorough flags before the sentinel", () => {
    const options = section(read(SKILL), "Coverage hunt option")

    assert.match(options, /--no-coverage-hunt/)
    assert.match(options, /--thorough/)
    assert.match(options, /before the first `--`\s+sentinel/i)
    assert.match(options, /Coverage hunt disabled for this run/)
    assert.match(options, /Coverage hunt thorough — 12 clusters/)
    assert.match(options, /--no-coverage-hunt` with `--thorough` is an argument error/i)
    assert.match(options, /more than one is an argument error/i)
  })

  it("parses Discovery and scope flags and lists the supported workflow", () => {
    const skill = read(SKILL)
    const scope = read(SCOPE)

    assert.match(skill, /--no-discovery/)
    assert.match(skill, /--explore-scope/)
    assert.match(scope, /`make-requirements`/)
  })
})

describe("dispatch, merge, and register routing", () => {
  it("dispatches the RD-01 clusters in either host mode", () => {
    const skill = read(SKILL)

    assert.match(skill, /four (?:default )?(?:RD-01 )?clusters/i)
    assert.match(skill, /12 (?:single-category )?clusters|twelve single-category clusters/i)
    assert.match(skill, /parallel/i)
    assert.match(skill, /sequential/i)
    assert.match(skill, /identical packets/i)
    assert.match(skill, /preflight-auditor/)
    assert.match(skill, /coverage-hunt/)
    assert.match(skill, /_shared\/coverage-hunt\.md/)
  })

  it("merges once, caps the batch, and routes candidates by classification", () => {
    const skill = read(SKILL)

    assert.match(skill, /dedupe[\s\S]{0,80}root cause/i)
    assert.match(skill, /resolve from evidence|evidence already answers/i)
    assert.match(skill, /\b12\b[\s\S]{0,80}material candidates/i)
    assert.match(skill, /every\s+material candidate\s+enters\s+the register/i)
    assert.match(skill, /one consolidated round|one consolidated user round/i)
    assert.match(skill, /`ambiguity`[\s\S]{0,40}`assumption`|ambiguity and assumption/i)
    assert.match(skill, /Scope Expansion Register/)
    assert.match(skill, /Complexity Escalation Gate/)
    assert.match(skill, /strict mode[\s\S]{0,120}omit|omit[\s\S]{0,80}strict mode/i)
  })

  it("keeps the Phase 2B gate authority and the re-scan rule", () => {
    const skill = read(SKILL)

    assert.match(skill, /every row resolved|resolved or explicitly deferred/i)
    assert.match(skill, /user confirmation|confirmed the complete register/i)
    assert.match(skill, /does not (?:change|replace|bypass)[\s\S]{0,80}gate|gate[\s\S]{0,80}unchanged/i)
    assert.match(skill, /affected clusters only|re-run only\s+the affected clusters/i)
  })
})

describe("coverage map", () => {
  it("persists the RD-01 map in the requirements register", () => {
    const skill = read(SKILL)
    const section = skill.slice(skill.indexOf("## Phase 2A"))

    assert.match(section, /00-ambiguity-register\.md/)
    assert.match(section, /## Coverage Map/)
    assert.match(
      section,
      /\| Cluster \| Area \| Examined \| Not examined \/ limit \| Candidates \| Notes \/ limit \| Confidence \|/
    )
    assert.match(section, /<completed>\/<total> clusters/)
    assert.match(section, /Freshness/)
    assert.match(section, /Source note/)
    assert.match(section, /CV-\*/)
    assert.match(section, /DQ-\*/)
    assert.match(section, /after the register table|before the resolution notes/i)
  })

  it("marks an existing map stale when add mode changes the set", () => {
    const review = read(REVIEW)
    const add = review.slice(
      review.indexOf("## add_requirement Protocol"),
      review.indexOf("## review_requirements Protocol")
    )

    assert.match(add, /does not run the coverage hunt/i)
    assert.match(add, /STALE/)
    assert.match(add, /freshness/i)
    assert.match(add, /no new (?:schema stamp|artifact)/i)
  })
})

describe("health check", () => {
  it("is diagnostic and writes the map without reopening the gate", () => {
    const review = read(REVIEW)

    assert.match(review, /review_requirements/)
    assert.match(review, /### Coverage/)
    assert.match(review, /diagnostic/i)
    assert.match(
      review,
      /does not add open\s+(?:register )?rows or reopen the gate unless the user asks to act/i
    )
    assert.match(review, /after presenting the report, write the consolidated coverage map/i)
  })
})

describe("effort and summary disclosure", () => {
  it("announces the effort map and discloses requested to applied", () => {
    const skill = read(SKILL)

    assert.match(skill, /C1[\s\S]{0,40}C3[\s\S]{0,80}`?high`?/i)
    assert.match(skill, /C4[\s\S]{0,40}`?xhigh`?/i)
    assert.match(skill, /recon[\s\S]{0,60}`?low`?[\s\S]{0,40}`?medium`?/i)
    assert.match(skill, /synthesis[\s\S]{0,40}`?high`?/i)
    assert.match(skill, /`max`[\s\S]{0,40}explicit-only|explicit-only[\s\S]{0,40}`max`/i)
    assert.match(skill, /requested→applied/)
    assert.match(skill, /Effort:/)
    assert.match(skill, /Independence:/)
    assert.match(skill, /Coverage hunt active — 4 clusters, <N> agents/i)
    assert.match(skill, /Fallback: inline/)
  })
})

describe("fallback, metrics, and security", () => {
  it("states the fallback and content-free metric rules", () => {
    const skill = read(SKILL)
    const phase = section(skill, "Phase 2A: Coverage Hunt (before the gate)")

    assert.match(phase, /inline fallback/i)
    assert.match(phase, /incomplete/i)
    assert.match(phase, /effort unavailable/i)
    assert.match(phase, /raw `reasoningEffort`|raw reasoningEffort/i)
    for (const event of ["completed", "accepted", "fallback", "independence", "effort"]) {
      assert.match(phase, new RegExp(`coverage_hunt\\.${event}`))
    }
    assert.match(phase, /stage=requirements/)
    assert.match(phase, /no (?:prompt|content)|never .*prompt/i)
  })

  it("references the injection and path rules without duplicating them", () => {
    const skill = read(SKILL)
    const phase = section(skill, "Phase 2A: Coverage Hunt (before the gate)")
    const security = phase.slice(phase.indexOf("### Security"), phase.indexOf("### Metrics"))

    assert.match(security, /prompt[- ]injection/i)
    assert.match(security, /canonicaliz/i)
    assert.match(security, /no shell interpolation|never[\s\S]{0,80}interpolat/i)
    assert.match(security, /no secrets|secrets/i)
    assert.match(security, /preflight-auditor/)
    assert.doesNotMatch(skill, /coverage-auditor template/)
  })
})

describe("stage reference files", () => {
  it("updates the discovery phase reference and the review protocol", () => {
    const phases = read(PHASES)

    assert.match(phases, /coverage hunt/i)
    assert.match(phases, /Phase 2B/)
    assert.match(read(REVIEW), /coverage hunt/i)
  })
})
