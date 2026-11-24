/**
 * Specification tests for right-sized verification.
 *
 * These content guards pin the shipped guidance for verification tiers, review
 * timing, finding calibration, the refute pass, the verification balance line,
 * and trigger-only skill descriptions. Each test is named `ST-<n> — …` so a
 * phase can run its own cases with `--test-name-pattern`. Assertions match the
 * required tokens case-insensitively after collapsing whitespace; surrounding
 * prose is free. A failure here means the shipped guidance lost a required
 * guarantee — never that the test is wrong.
 *
 * @module right-sized-verification-content.spec.test
 */

import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const ORDERING = "_shared/spec-first-ordering.md"
const PROFILE = "_shared/quality-profile.md"
const MAKE_PLAN = "skills/make-plan/SKILL.md"
const TEMPLATES = "skills/make-plan/templates.md"
const EXEC_SKILL = "skills/exec-plan/SKILL.md"
const PROTOCOL = "skills/exec-plan/execution-protocol.md"
const COMMIT_MODES = "skills/exec-plan/commit-modes.md"
const UPGRADE_CHECKLISTS = "skills/upgrade-plan/upgrade-checklists.md"
const REVIEWER_TEMPLATE = "agent-templates/phase-reviewer.md"
const REVIEWER_AGENT = "agents/correctness-reviewer.md"
const SCHEMA = "schemas/codeops-config.schema.json"

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
 * Collapse whitespace so assertions do not depend on line wrapping.
 *
 * @param text - Any text
 * @returns The text with every whitespace run replaced by one space
 */
function flat(text) {
  return text.replace(/\s+/g, " ")
}

/**
 * Prepare prose for wording checks: drop Markdown emphasis and code markers,
 * then collapse whitespace.
 *
 * @param text - Any text
 * @returns The text without `*` and backtick characters, whitespace collapsed
 */
function prose(text) {
  return flat(text.replace(/[*`]/g, ""))
}

/**
 * Assert that text contains every token, case-insensitively, after collapsing whitespace.
 *
 * @param text - Text to search
 * @param tokens - Required tokens
 * @param where - Label used in the failure message
 */
function assertTokens(text, tokens, where) {
  const haystack = flat(text).toLowerCase()
  for (const token of tokens) {
    assert.ok(haystack.includes(flat(token).toLowerCase()), `${where} must contain "${token}"`)
  }
}

/**
 * Return one heading section, without its heading; fenced blocks do not end it.
 *
 * @param content - Full document
 * @param heading - Exact heading line, e.g. `## Verification tiers`
 * @returns The section body up to the next heading of the same or higher level
 */
function section(content, heading) {
  const level = heading.match(/^#+/)[0].length
  const lines = content.split("\n")
  const start = lines.findIndex((line) => line.trim() === heading)
  assert.notEqual(start, -1, `missing heading: ${heading}`)
  const body = []
  let fenced = false
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim().startsWith("```")) fenced = !fenced
    const match = !fenced && line.match(/^(#+) /)
    if (match && match[1].length <= level) break
    body.push(line)
  }
  return body.join("\n")
}

/**
 * Return the 07 testing-strategy template block from the plan templates.
 *
 * @returns The text between the 07 heading and the 99 heading
 */
function testingTemplate() {
  const templates = read(TEMPLATES)
  const start = templates.indexOf("## 07-testing-strategy.md")
  const end = templates.indexOf("## 99-execution-plan.md")
  assert.ok(start !== -1 && end > start, "templates must keep the 07 and 99 template headings")
  return templates.slice(start, end)
}

/**
 * Read and fold a skill's `description:` frontmatter value.
 *
 * An inline plain value is taken as-is; a `>-` block has its indented lines
 * trimmed and joined with single spaces. Any other shape is reported.
 *
 * @param skill - Skill directory name under `skills/`
 * @returns The folded value and its shape (`inline`, `folded`, or the unsupported indicator)
 */
function description(skill) {
  const lines = read(`skills/${skill}/SKILL.md`).split("\n")
  assert.equal(lines[0], "---", `${skill} must start with frontmatter`)
  const end = lines.indexOf("---", 1)
  const front = lines.slice(1, end)
  const at = front.findIndex((line) => line.startsWith("description:"))
  assert.notEqual(at, -1, `${skill} must have a description`)
  const raw = front[at].slice("description:".length).trim()
  if (raw === ">-") {
    const parts = []
    for (let index = at + 1; index < front.length && /^\s+\S/.test(front[index]); index += 1) {
      parts.push(front[index].trim())
    }
    return { value: parts.join(" "), shape: "folded" }
  }
  if (/^[>|"']/.test(raw)) return { value: raw, shape: raw.slice(0, 2) }
  if (at + 1 < front.length && /^\s+\S/.test(front[at + 1])) return { value: raw, shape: "multiline-plain" }
  return { value: raw, shape: "inline" }
}

/** Every shipped skill directory. */
const SKILLS = readdirSync(join(ROOT, "skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

// --- Verification tiers ----------------------------------------------------

it("ST-1 — the ordering protocol defines the standard and critical tiers, defaulting to critical", () => {
  const tiers = section(read(ORDERING), "## Verification tiers")
  assertTokens(tiers, ["`standard`", "`critical`"], "the tiers section")
  assert.match(prose(tiers), /\b(no|without|missing)\b.{0,60}\btier\W{0,6}line.{0,160}critical/i)
})

it("ST-2 — standard folds the red check into the spec-test task; the distinct red task is critical-only", () => {
  const ordering = read(ORDERING)
  const tiers = prose(section(ordering, "## Verification tiers"))
  assert.match(tiers, /red check.{0,80}(inside|within|part of).{0,40}spec-test task/i)
  assertTokens(tiers, ["error paths", "edge cases"], "the tiers section")
  assert.match(prose(section(ordering, "## Enforcement")), /red[- ]phase.{0,160}critical/i)
  assert.match(prose(section(ordering, "## Small features (compressed form)")), /red[- ]phase.{0,160}critical/i)
})

it("ST-3 — specification tests still precede implementation and the order stays non-negotiable", () => {
  const ordering = prose(read(ORDERING))
  assert.match(ordering, /spec tests?.{0,80}before.{0,40}implementation/i)
  assert.match(ordering, /never negotiable/i)
})

it("ST-4 — plan templates carry the tier and review lines and an acceptance-criteria coverage rule", () => {
  const templates = read(TEMPLATES)
  assertTokens(templates, ["> **Verification tier**:", "> **Review**:"], TEMPLATES)
  const testing = testingTemplate()
  assert.doesNotMatch(testing, /\|\s*\d{1,3}\s*%\s*\|/, "the 07 template must have no percentage target row")
  assert.match(prose(testing), /acceptance criterion.{0,80}(≥\s*1|at least one) test/i)
  const ordering = prose(section(templates, "## Specification-First Task Ordering (NON-NEGOTIABLE)"))
  assert.match(ordering, /red[- ]phase.{0,160}critical/i)
})

it("ST-5 — make-plan derives the tier from real-risk signals and honors the config override", () => {
  const skill = prose(read(MAKE_PLAN))
  assertTokens(skill, ["quality.verificationTier", "financial", "security"], MAKE_PLAN)
  assert.match(skill, /distributed[- ]and[- ]concurrent/i)
  assert.match(skill, /(migration|backfill).{0,60}persisted data|persisted data.{0,60}(migration|backfill)/i)
  assert.match(skill, /provisional.{0,80}tier|tier.{0,80}provisional/i)
  assert.match(skill, /final.{0,40}tier/i)
})

it("ST-6 — the config schema accepts the verification tier setting", () => {
  const schema = JSON.parse(read(SCHEMA))
  assert.deepEqual(schema.properties.quality.properties.verificationTier.enum, [
    "derived",
    "standard",
    "critical",
  ])
})

it("ST-7 — the quality profile states the standard review trigger and that tiers change timing only", () => {
  const profile = prose(read(PROFILE))
  assert.match(profile, /150.{0,40}product lines/i)
  assert.match(profile, /risk[- ]tag/i)
  assertTokens(profile, ["carried forward", "completion review"], PROFILE)
  assert.match(profile, /\bwhen\b.{0,100}\b(not|never)\s+whether/i)
})

it("ST-8 — exec-plan records review status, runs the completion review, and defaults to critical", () => {
  const protocol = read(PROTOCOL)
  assertTokens(protocol, ["> **Review**:", "reviewed", "carried forward", "completion review"], PROTOCOL)
  const text = prose(protocol)
  assert.match(text, /completion review\.?.{0,250}(final push|release)/i)
  assert.match(text, /\b(no|missing)\b.{0,60}\b(tier|line)\b.{0,100}critical/i)
  assert.match(text, /\bunknown\b.{0,80}critical/i)
  assertTokens(section(read(EXEC_SKILL), "## Quality loop (profile-gated)"), ["tier"], EXEC_SKILL)
})

it("ST-9 — upgrade-plan never derives a tier for an existing plan", () => {
  assertTokens(read(UPGRADE_CHECKLISTS), ["critical — pre-tier plan"], UPGRADE_CHECKLISTS)
})

// --- Review calibration and refuter -----------------------------------------

it("ST-10 — the quality profile defines finding calibration and delivers it in reviewer packets", () => {
  const profile = read(PROFILE)
  const calibration = section(profile, "## Finding calibration")
  assertTokens(
    calibration,
    ["MINOR", "MAJOR", "acceptance criterion", "changed lines", "linter", "hypothetical", "re-prove", "style", "quote", "complexity escalation"],
    "the calibration section",
  )
  const packets = section(profile, "## Dispatch packets & header")
  assertTokens(packets, ["Finding calibration"], "the packet table")
  assert.match(packets, /^\|[^|\n]*refute/im, "the packet table must have a refute row")
})

it("ST-11 — the reviewer template defines the refute mode and references calibration", () => {
  assertTokens(
    read(REVIEWER_TEMPLATE),
    ["Mode: refute", "Confirmed", "Downgraded", "Refuted", "Finding calibration"],
    REVIEWER_TEMPLATE,
  )
})

it("ST-12 — the packaged correctness reviewer carries the refute mode", () => {
  assertTokens(read(REVIEWER_AGENT), ["Mode: refute"], REVIEWER_AGENT)
})

it("ST-13 — exec-plan calibrates, refutes once per phase, and never dismisses a finding silently", () => {
  const protocol = read(PROTOCOL)
  const stepRaw = section(protocol, "### Post-phase quality step (profile-gated)")
  assertTokens(stepRaw, ["Finding calibration", "Confirmed", "`refuted`"], "the post-phase step")
  const step = prose(stepRaw)
  assert.match(step, /one refute.{0,40}per phase/i)
  assert.match(step, /downgrad.{0,100}(🟠|major).{0,100}(stop|paus)/i)
  assert.match(step, /reinstat/i)
  assert.match(step, /\b(fails?|failure)\b.{0,100}confirmed/i)
  assertTokens(protocol, ["dismissed silently"], PROTOCOL)
  assert.doesNotMatch(flat(protocol), /dismissed automatically/i)
})

it("ST-14 — the finding gate and both commit-mode pause rules apply to Confirmed findings", () => {
  assert.match(prose(read(EXEC_SKILL)), /Finding gate.{0,400}Confirmed/i)
  const confirmed = flat(read(COMMIT_MODES)).match(/confirmed\W{0,3}(🔴|🟠|critical|major)/gi) ?? []
  assert.ok(confirmed.length >= 2, "both commit-mode pause rules must name Confirmed findings")
})

// --- Verification balance ----------------------------------------------------

it("ST-15 — exec-plan reports a report-only verification balance with a defined classification", () => {
  const step = section(read(PROTOCOL), "### Post-phase quality step (profile-gated)")
  assertTokens(
    step,
    ["Verification balance", "`*.test.*`", "`*_test.*`", "`test_*", "`fixtures/`", "`plans/`", "`requirements/`", "`codeops/`", "lockfile", "`dist/`", "above 1.5:1", "unavailable"],
    "the post-phase step",
  )
  const text = prose(step)
  assert.match(text, /markdown.{0,80}product|product.{0,80}markdown/i)
  assert.match(text, /never block/i)
})

it("ST-16 — the phase header template carries the verification balance line", () => {
  assertTokens(read(TEMPLATES), ["> **Verification balance**:"], TEMPLATES)
})

// --- Skill descriptions ------------------------------------------------------

it("ST-23 — every skill description is a trigger that starts with 'Use when'", () => {
  for (const skill of SKILLS) {
    const { value, shape } = description(skill)
    assert.ok(shape === "inline" || shape === "folded", `${skill}: description must be inline or >- (got ${shape})`)
    if (shape === "inline") {
      assert.ok(!value.includes(": ") && !value.includes(" #"), `${skill}: inline description must not contain ": " or " #"`)
    }
    assert.ok(value.startsWith("Use when"), `${skill}: description must start with "Use when"`)
  }
})

it("ST-24 — every skill description is at most 500 characters", () => {
  for (const skill of SKILLS) {
    const { value } = description(skill)
    assert.ok(value.length <= 500, `${skill}: description is ${value.length} characters`)
  }
})
