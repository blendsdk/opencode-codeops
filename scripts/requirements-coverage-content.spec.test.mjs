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

    assert.match(skill, /default/i)
    assert.match(skill, /Full Discovery[\s\S]{0,160}(?:coverage )?hunt/i)
    assert.match(review, /Health Check[\s\S]{0,300}(?:coverage )?hunt/i)
    assert.match(review, /add_requirement[\s\S]{0,200}(?:does not run|unchanged|not run)/i)
  })
})

describe("flags", () => {
  it("parses the disable and thorough flags before the sentinel", () => {
    const skill = read(SKILL)

    assert.match(skill, /--no-coverage-hunt/)
    assert.match(skill, /--thorough/)
    assert.match(skill, /before the first `--` sentinel/i)
    assert.match(skill, /Coverage hunt disabled for this run/)
    assert.match(skill, /Coverage hunt thorough — 12 clusters/)
    assert.match(skill, /--no-coverage-hunt[\s\S]{0,200}--thorough[\s\S]{0,80}argument error|--no-coverage-hunt[\s\S]{0,80}--thorough[\s\S]{0,80}invalid/i)
    assert.match(skill, /more than one[\s\S]{0,120}argument error/i)
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
    assert.match(review, /does not add open (?:register )?rows/i)
    assert.match(review, /reopen(?:s)? the gate/i)
    assert.match(review, /asks? (?:you )?to act|user asks to act/i)
    assert.match(review, /writes? the (?:consolidated )?map|write the consolidated map/i)
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
    assert.match(skill, /Coverage hunt active — 4 clusters/i)
  })
})

describe("fallback, metrics, and security", () => {
  it("states the fallback and content-free metric rules", () => {
    const skill = read(SKILL)

    assert.match(skill, /inline fallback/i)
    assert.match(skill, /incomplete/i)
    assert.match(skill, /effort unavailable/i)
    assert.match(skill, /raw `reasoningEffort`|raw reasoningEffort/i)
    for (const event of ["completed", "accepted", "fallback", "independence", "effort"]) {
      assert.match(skill, new RegExp(`coverage_hunt\\.${event}`))
    }
    assert.match(skill, /stage=requirements/)
    assert.match(skill, /no (?:prompt|content)|never .*prompt/i)
  })

  it("references the injection and path rules without duplicating them", () => {
    const skill = read(SKILL)

    assert.match(skill, /prompt[- ]injection/i)
    assert.match(skill, /path canonicaliz|canonicaliz/i)
    assert.match(skill, /no shell interpolation|never[\s\S]{0,80}interpolat/i)
    assert.match(skill, /no secrets|secrets/i)
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
