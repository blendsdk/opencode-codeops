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
 * Return one heading section, without its heading.
 *
 * @param content - Full document
 * @param prefix - `##` or `###`
 * @param title - Exact heading text
 * @returns The section body
 */
function headingSection(content, prefix, title) {
  const lines = content.split("\n")
  const start = lines.findIndex((line) => line.trim() === `${prefix} ${title}`)
  assert.notEqual(start, -1, `missing heading: ${prefix} ${title}`)
  const body = []
  let fenced = false
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim().startsWith("```")) fenced = !fenced
    if (!fenced && line.startsWith("## ")) break
    if (!fenced && prefix === "###" && line.startsWith("### ")) break
    body.push(line)
  }
  return body.join("\n")
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

  it("skips mini-plans and trivial tasks", () => {
    const skill = read(SKILL)

    // Which full plans run the hunt by default (critical only) is pinned by LP-5 in
    // lean-plan-content.spec.test.mjs; it superseded the "every full plan" default.
    assert.match(skill, /mini-plans?[\s\S]{0,120}(?:do not|skip|unchanged)/i)
    assert.match(skill, /trivial tasks?[\s\S]{0,120}(?:do not|skip|unchanged)/i)
    assert.match(skill, /mini-plan boundary|Mini-plans and trivial tasks skip/i)
  })
})

describe("flags", () => {
  it("parses disable and thorough before the sentinel with exact announcements", () => {
    const options = headingSection(read(SKILL), "##", "Coverage hunt option")

    assert.match(options, /--no-coverage-hunt/)
    assert.match(options, /--thorough/)
    assert.equal(
      (options.match(/before the first\s+`--`\s+sentinel/g) || []).length,
      2,
      "both flag paragraphs must parse before the sentinel"
    )
    assert.match(options, /Coverage hunt disabled for this run/)
    assert.match(options, /Coverage hunt thorough — 12 clusters/)
    assert.match(options, /--no-coverage-hunt` with `--thorough` is an argument error/i)
    assert.equal(
      (options.match(/more than one is an argument error/g) || []).length,
      2,
      "both flags must reject duplicates"
    )
    assert.match(options, /disabled — --no-coverage-hunt/)
  })
})

describe("dispatch, merge, and register routing", () => {
  it("dispatches the RD-01 clusters in either host mode", () => {
    const phase = headingSection(read(SKILL), "##", "Phase 1A: Coverage Hunt (before Phase 1B and 1C)")

    assert.match(phase, /four default clusters/i)
    assert.match(phase, /twelve single-category clusters/i)
    assert.match(phase, /parallel/i)
    assert.match(phase, /sequential/i)
    assert.match(phase, /identical packets/i)
    assert.match(phase, /preflight-auditor/)
    assert.match(phase, /coverage-hunt/)
    assert.match(phase, /_shared\/coverage-hunt\.md/)
  })

  it("merges once, caps the batch, and routes candidates by classification", () => {
    const phase = headingSection(read(SKILL), "##", "Phase 1A: Coverage Hunt (before Phase 1B and 1C)")
    const merge = headingSection(phase, "###", "Merge and filter")
    const routing = headingSection(phase, "###", "Register routing")

    assert.match(merge, /dedupe[\s\S]{0,80}root cause/i)
    assert.match(merge, /resolve from evidence|evidence already answers/i)
    assert.match(merge, /\b12\b[\s\S]{0,80}material candidates/i)
    assert.match(merge, /every\s+material\s+candidate\s+enters\s+the register/i)
    assert.match(merge, /one consolidated (?:round|user round)/i)
    assert.match(routing, /`ambiguity`[\s\S]{0,40}`assumption`|ambiguity and assumption/i)
    assert.match(routing, /Scope Expansion Register/)
    assert.match(routing, /Complexity Escalation Gate/)
    assert.match(routing, /strict mode[\s\S]{0,120}omit|omit[\s\S]{0,80}strict mode/i)
  })

  it("keeps Phase 1C authority and the re-scan rule", () => {
    const phase = headingSection(read(SKILL), "##", "Phase 1A: Coverage Hunt (before Phase 1B and 1C)")
    const gate = headingSection(phase, "###", "Gate unchanged")

    assert.match(gate, /every row resolved or explicitly deferred/i)
    assert.match(gate, /user confirmation of the\s+complete register/i)
    assert.match(gate, /delegated provenance/)
    assert.match(gate, /does not bypass, replace, or close the gate/i)
    assert.match(phase, /re-run only\s+the\s+affected clusters/i)
  })
})

describe("coverage map placement", () => {
  it("writes the register map before 1C and copies it into the index after 1C", () => {
    const phase = headingSection(read(SKILL), "##", "Phase 1A: Coverage Hunt (before Phase 1B and 1C)")
    const placement = headingSection(phase, "###", "Coverage map placement")

    assert.match(
      placement,
      /Before Phase 1C[\s\S]{0,200}00-ambiguity-register\.md[\s\S]{0,80}## Coverage Map/
    )
    assert.match(
      placement,
      /After Phase 1C[\s\S]{0,200}00-index\.md[\s\S]{0,80}## Planning Coverage/
    )
    assert.match(
      placement,
      /\| Cluster \| Area \| Examined \| Not examined \/ limit \| Candidates \| Notes \/ limit \| Confidence \|/
    )
    assert.match(placement, /<completed>\/<total> clusters/)
    assert.match(placement, /Freshness/)
    assert.match(placement, /Source note/)
    assert.match(placement, /CV-\*/)
    assert.match(placement, /DQ-\*/)
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

    assert.match(upgrade, /every existing copy/i)
    assert.match(upgrade, /00-index\.md/)
    assert.match(upgrade, /00-ambiguity-register\.md/)
    assert.match(upgrade, /STALE|stale/)
    assert.match(upgrade, /Freshness|freshness/i)
  })
})

describe("effort, summary, and compatibility", () => {
  it("announces the effort map and discloses requested to applied", () => {
    const phase = headingSection(read(SKILL), "##", "Phase 1A: Coverage Hunt (before Phase 1B and 1C)")

    assert.match(phase, /C1[\s\S]{0,40}C3[\s\S]{0,80}`?high`?/i)
    assert.match(phase, /C4[\s\S]{0,40}`?xhigh`?/i)
    assert.match(phase, /recon[\s\S]{0,60}`?low`?[\s\S]{0,40}`?medium`?/i)
    assert.match(phase, /synthesis[\s\S]{0,40}`?high`?/i)
    assert.match(phase, /`max`[\s\S]{0,40}explicit-only|explicit-only[\s\S]{0,40}`max`/i)
    assert.match(phase, /requested→applied/)
    assert.match(phase, /Coverage hunt active — 4 clusters, <N> agents/i)
    assert.match(phase, /Effort:/)
    assert.match(phase, /Independence:/)
    assert.match(phase, /RD-03 task-class policy and shared effort contract are canonical/i)
  })

  it("keeps the Reasoning suggestion and execution handoff intact", () => {
    const skill = read(SKILL)
    const templates = read(TEMPLATES)

    assert.match(skill, /Reasoning:[\s\S]{0,200}xhigh|Reasoning[\s\S]{0,120}xhigh/i)
    assert.match(skill, /never default to `max`|never default[\s\S]{0,40}max/i)
    assert.match(skill, /exec-plan[\s\S]{0,160}phase suggestion/i)
    for (const level of ["low", "medium", "high", "xhigh", "max"]) {
      assert.match(templates, new RegExp("`" + level + "`"), `templates must list ${level}`)
    }
  })

  it("states the discovery, fallback, metric, preflight, and specialist boundaries", () => {
    const phase = headingSection(read(SKILL), "##", "Phase 1A: Coverage Hunt (before Phase 1B and 1C)")
    const discovery = headingSection(phase, "###", "Discovery integration")
    const fallback = headingSection(phase, "###", "Fallback")
    const metrics = headingSection(phase, "###", "Metrics")
    const boundaries = headingSection(phase, "###", "Boundaries and summary")

    assert.match(discovery, /discovery\.enabled: true/)
    assert.match(discovery, /three Discovery tools/)
    assert.match(discovery, /chatMaxQuestions/)
    assert.match(discovery, /kind=plan/)
    assert.match(discovery, /artifact=<plan dir>/)
    assert.match(discovery, /DQ-<n>/)
    assert.match(discovery, /(?:no new|do not add a) page, endpoint, or\s+question-key scheme/i)
    assert.match(fallback, /inline fallback/i)
    assert.match(fallback, /incomplete/i)
    assert.match(fallback, /effort unavailable/i)
    for (const event of ["completed", "accepted", "fallback", "independence", "effort"]) {
      assert.match(metrics, new RegExp(`coverage_hunt\\.${event}`))
    }
    assert.match(metrics, /stage=planning/)
    assert.match(metrics, /no prompt, decision, path, or artifact content/i)
    assert.match(boundaries, /does not replace or\s+change preflight/i)
    assert.match(boundaries, /specialist[\s\S]{0,120}still runs/i)
  })

  it("keeps the security boundaries", () => {
    const phase = headingSection(read(SKILL), "##", "Phase 1A: Coverage Hunt (before Phase 1B and 1C)")
    const security = headingSection(phase, "###", "Security")

    assert.match(security, /prompt[- ]injection/i)
    assert.match(security, /canonicaliz/i)
    assert.match(security, /no secrets/i)
    assert.match(security, /no shell interpolation|never[\s\S]{0,80}interpolat/i)
    assert.match(security, /Discovery keeps its\s+existing local-only binding/i)
  })
})
