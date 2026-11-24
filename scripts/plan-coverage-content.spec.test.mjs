/**
 * Specification tests for the plan-stage coverage hunt.
 *
 * These content guards pin how `make-plan` schedules the hunt, parses its
 * flags, dispatches and merges clusters, writes the plan register and index
 * maps, keeps the Phase 1C gate, discloses effort, and leaves mini-plans
 * unchanged. A failure here means the shipped guidance lost a required
 * guarantee — never that the test is wrong.
 *
 * @module plan-coverage-content.spec.test
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SKILL = "skills/make-plan/SKILL.md"
const TEMPLATES = "skills/make-plan/templates.md"
const CHECKLIST = "skills/make-plan/quality-checklist.md"
const UPGRADE = "skills/upgrade-plan/SKILL.md"

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
 * Assert that markers appear in increasing order.
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
  it("runs after 1.2 and 1.3 and before Phase 1B and 1C", () => {
    const skill = read(SKILL)
    const phaseOne = skill.slice(skill.indexOf("## Phase 1 —"), skill.indexOf("## Phase 2 —"))

    assertOrder(phaseOne, [
      "### 1.2",
      "### 1.3",
      "## Phase 1A: Coverage Hunt",
      "## Phase 1B",
      "## Phase 1C",
    ])
    assert.match(phaseOne, /after Phase 1\.2[\s\S]{0,80}1\.3[\s\S]{0,100}before\s+Phase 1[BC]/i)
  })

  it("runs for full plans and skips mini-plans and trivial tasks", () => {
    const skill = read(SKILL)

    assert.match(skill, /full (?:feature )?plans?[\s\S]{0,120}default/i)
    assert.match(skill, /mini-plans?[\s\S]{0,120}(?:do not|skip|unchanged)/i)
    assert.match(skill, /trivial tasks?[\s\S]{0,120}(?:do not|skip|unchanged)/i)
    assert.match(skill, /mini-plan boundary|Mini-plans and trivial tasks skip/i)
  })
})

describe("flags", () => {
  it("parses disable and thorough before the sentinel with exact announcements", () => {
    const skill = read(SKILL)

    assert.match(skill, /--no-coverage-hunt/)
    assert.match(skill, /--thorough/)
    assert.match(skill, /before the first `--` sentinel/i)
    assert.match(skill, /Coverage hunt disabled for this run/)
    assert.match(skill, /Coverage hunt thorough — 12 clusters/)
    assert.match(skill, /--no-coverage-hunt[\s\S]{0,120}--thorough[\s\S]{0,80}(?:argument error|invalid)/i)
    assert.match(skill, /more than one[\s\S]{0,120}argument error/i)
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
    assert.match(skill, /every\s+material\s+candidate\s+enters\s+the register/i)
    assert.match(skill, /one consolidated (?:round|user round)/i)
    assert.match(skill, /`ambiguity`[\s\S]{0,40}`assumption`|ambiguity and assumption/i)
    assert.match(skill, /Scope Expansion Register/)
    assert.match(skill, /Complexity Escalation Gate/)
    assert.match(skill, /strict mode[\s\S]{0,120}omit|omit[\s\S]{0,80}strict mode/i)
  })

  it("keeps Phase 1C authority and the re-scan rule", () => {
    const skill = read(SKILL)

    assert.match(skill, /every row resolved|resolved or explicitly deferred/i)
    assert.match(skill, /user confirmation|confirmed the complete register/i)
    assert.match(skill, /does not (?:change|replace|bypass)[\s\S]{0,80}gate|gate[\s\S]{0,80}unchanged/i)
    assert.match(skill, /affected clusters only|re-run only\s+the\s+affected clusters/i)
  })
})

describe("coverage map placement", () => {
  it("writes the register map before 1C and copies it into the index after 1C", () => {
    const skill = read(SKILL)

    assert.match(skill, /00-ambiguity-register\.md/)
    assert.match(skill, /## Coverage Map/)
    assert.match(skill, /## Planning Coverage/)
    assert.match(skill, /00-index\.md/)
    assert.match(skill, /after Phase 1C|after the gate/i)
    assert.match(
      skill,
      /\| Cluster \| Area \| Examined \| Not examined \/ limit \| Candidates \| Notes \/ limit \| Confidence \|/
    )
    assert.match(skill, /<completed>\/<total> clusters/)
    assert.match(skill, /Freshness/)
    assert.match(skill, /Source note/)
    assert.match(skill, /CV-\*/)
    assert.match(skill, /DQ-\*/)
  })

  it("updates the index template and checklist", () => {
    const templates = read(TEMPLATES)
    const checklist = read(CHECKLIST)

    assert.match(templates, /## Planning Coverage/)
    assert.match(templates, /<completed>\/<total> clusters/)
    assert.match(templates, /Freshness/)
    assert.match(templates, /Source note/)
    assert.match(checklist, /Planning Coverage|coverage map/i)
    assert.match(checklist, /freshness/i)
  })

  it("marks an existing map stale when upgrade-plan changes the plan", () => {
    const upgrade = read(UPGRADE)

    assert.match(upgrade, /Planning Coverage|coverage map/i)
    assert.match(upgrade, /STALE|stale/)
    assert.match(upgrade, /Freshness|freshness/i)
  })
})

describe("effort, summary, and compatibility", () => {
  it("announces the effort map and discloses requested to applied", () => {
    const skill = read(SKILL)

    assert.match(skill, /C1[\s\S]{0,40}C3[\s\S]{0,80}`?high`?/i)
    assert.match(skill, /C4[\s\S]{0,40}`?xhigh`?/i)
    assert.match(skill, /recon[\s\S]{0,60}`?low`?[\s\S]{0,40}`?medium`?/i)
    assert.match(skill, /synthesis[\s\S]{0,40}`?high`?/i)
    assert.match(skill, /`max`[\s\S]{0,40}explicit-only|explicit-only[\s\S]{0,40}`max`/i)
    assert.match(skill, /requested→applied/)
    assert.match(skill, /Coverage hunt active — 4 clusters/i)
    assert.match(skill, /Effort:/)
    assert.match(skill, /Independence:/)
  })

  it("keeps the Reasoning suggestion and execution handoff intact", () => {
    const skill = read(SKILL)
    const templates = read(TEMPLATES)

    assert.match(skill, /Reasoning:[\s\S]{0,200}xhigh|Reasoning[\s\S]{0,120}xhigh/i)
    assert.match(skill, /never default to `max`|never default[\s\S]{0,40}max/i)
    assert.match(skill, /exec-plan[\s\S]{0,160}phase suggestion/i)
    assert.match(templates, /`xhigh`/)
    assert.match(templates, /`max`/)
  })

  it("states the discovery, fallback, metric, preflight, and specialist boundaries", () => {
    const skill = read(SKILL)

    assert.match(skill, /kind=plan/)
    assert.match(skill, /artifact=<plan (?:dir|folder)>/)
    assert.match(skill, /inline fallback/i)
    assert.match(skill, /incomplete/i)
    assert.match(skill, /effort unavailable/i)
    for (const event of ["completed", "accepted", "fallback", "independence", "effort"]) {
      assert.match(skill, new RegExp(`coverage_hunt\\.${event}`))
    }
    assert.match(skill, /stage=planning/)
    assert.match(skill, /does not (?:replace|change)[\s\S]{0,80}preflight|preflight[\s\S]{0,80}unchanged/i)
    assert.match(skill, /specialist[\s\S]{0,120}(?:after|still)/i)
  })

  it("keeps the security boundaries", () => {
    const skill = read(SKILL)

    assert.match(skill, /prompt[- ]injection/i)
    assert.match(skill, /canonicaliz/i)
    assert.match(skill, /no secrets|secrets/i)
    assert.match(skill, /no shell interpolation|never[\s\S]{0,80}interpolat/i)
  })
})
