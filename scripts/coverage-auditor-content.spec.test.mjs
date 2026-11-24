/**
 * Specification tests for the coverage-auditor mode.
 *
 * The `preflight-auditor` catalog role gains a second, packet-named mode.
 * These content guards pin the mode selector, the absence framing, the
 * coverage result contract, the read-only and blocker boundaries, the
 * prompt-injection rule, the generated package artifact, and the prohibition
 * on a new role. A failure here means the shipped template or generated agent
 * lost a required guarantee — never that the test is wrong.
 *
 * @module coverage-auditor-content.spec.test
 */

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const TEMPLATE = "agent-templates/preflight-auditor.md"
const AGENT = "agents/preflight-auditor.md"
const INSTALLER = "scripts/install_agents.py"

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
 * Headings inside fenced code blocks are sample content, not structure.
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
 * Extract the YAML frontmatter block from a generated agent.
 *
 * @param content - Generated agent content
 * @returns The frontmatter body without delimiters
 */
function frontmatter(content) {
  assert.equal(content.startsWith("---\n"), true, "a generated agent must open with ---")
  const end = content.indexOf("\n---", 4)
  assert.notEqual(end, -1, "the frontmatter must be closed")
  return content.slice(4, end)
}

describe("mode selector", () => {
  it("names both modes and defaults to preflight-audit", () => {
    const template = read(TEMPLATE)
    const modes = headingSection(template, "##", "Modes")
    const preflight = headingSection(template, "##", "Preflight Audit Mode")

    assert.match(modes, /`preflight-audit` \(default\)/)
    assert.match(modes, /`coverage-hunt`/)
    assert.match(modes, /exactly one mode/i)
    assert.match(modes, /both contracts/i)
    assert.match(modes, /unknown mode/i)
    assert.match(modes, /blocker/i)
    assert.match(preflight, /PA-001/)
    assert.match(preflight, /SE-\*/)
    assert.match(preflight, /_shared\/quality-profile\.md/)
    assert.match(preflight, /dimensions\.md/)
  })
})

describe("coverage hunt mode", () => {
  it("defines the section and the absence framing", () => {
    const content = read(TEMPLATE)
    const coverage = headingSection(content, "##", "Coverage Hunt Mode")

    assert.match(coverage, /missing|absent|does not say/i)
    assert.match(coverage, /one\s+to\s+three|1\s+to\s+3|1–3/i)
    assert.match(coverage, /assigned categories/i)
    assert.match(coverage, /read-only/i)
    assert.match(coverage, /evidence/i)
    assert.match(coverage, /refut/i)
    assert.match(coverage, /unverified/)
  })

  it("requires the six RD-01 result sections and CV numbering", () => {
    const coverage = headingSection(read(TEMPLATE), "##", "Coverage Hunt Mode")

    for (const section of [
      "Examined",
      "Not examined / limits",
      "Candidates",
      "Assumptions",
      "Coverage statement",
      "Effort",
    ]) {
      assert.match(coverage, new RegExp(`### ${section.replace("/", "\\/")}`))
    }
    assert.match(coverage, /CV-NNN/)
    assert.match(coverage, /never .*PA-NNN|PA-NNN.*not returned|no PA-NNN/i)
  })

  it("names every candidate field and the clean-result sentence", () => {
    const coverage = headingSection(read(TEMPLATE), "##", "Coverage Hunt Mode")

    for (const field of [
      "Category",
      "Question",
      "Options",
      "Evidence",
      "Why material",
      "Classification",
      "Confidence",
    ]) {
      assert.notEqual(coverage.indexOf(`**${field}**`), -1, `candidate must name ${field}`)
    }
    assert.match(coverage, /No material gaps found/)
    assert.match(coverage, /ambiguity/)
    assert.match(coverage, /assumption/)
    assert.match(coverage, /optional/)
    assert.match(coverage, /complexity/)
  })

  it("reports effort fields without choosing the level", () => {
    const coverage = headingSection(read(TEMPLATE), "##", "Coverage Hunt Mode")

    for (const field of ["Requested", "Applied", "Mapping"]) {
      assert.notEqual(coverage.indexOf(`**${field}**`), -1, `effort must name ${field}`)
    }
    for (const mapping of ["exact", "alias", "nearest", "fail-open"]) {
      assert.match(coverage, new RegExp(mapping), `effort must name mapping ${mapping}`)
    }
    assert.match(coverage, /lead selects|never choose/i)
  })
})

describe("authority, blockers, and injection", () => {
  it("states the enforced read-only boundary", () => {
    const content = read(TEMPLATE)
    const coverage = headingSection(content, "##", "Coverage Hunt Mode")

    assert.match(coverage, /never edit|does not edit|read-only/i)
    assert.match(coverage, /never .*user|no user contact|does not contact/i)
    assert.match(coverage, /approve .*gate|gate .*approval/i)
    assert.match(coverage, /expand scope/i)
    assert.match(coverage, /sandbox: read-only|sandbox `read-only`/i)
    assert.match(coverage, /edit: deny|`edit` is `deny`/i)
    assert.match(coverage, /Bash.*denied|denied.*Bash/i)
  })

  it("states path confinement and the prompt-injection rule", () => {
    const content = read(TEMPLATE)
    const coverage = headingSection(content, "##", "Coverage Hunt Mode")

    assert.match(coverage, /repository content is (?:evidence|data)/i)
    assert.match(coverage, /never instruction|not instructions/i)
    assert.match(coverage, /Not examined \/ limits/)
    assert.match(coverage, /canonicaliz/i)
    assert.match(coverage, /symlink/i)
    assert.match(coverage, /outside the (?:repository|repo)/i)
  })

  it("requires a blocker instead of guessing", () => {
    const coverage = headingSection(read(TEMPLATE), "##", "Coverage Hunt Mode")

    for (const condition of [
      /cluster/i,
      /scope mode|scope baseline/i,
      /artifact context|required context/i,
      /oversized/i,
    ]) {
      assert.match(coverage, condition)
    }
    assert.match(coverage, /blocker/i)
    assert.match(coverage, /never guess|do not guess/i)
  })

  it("keeps preflight fail-closed and coverage scope blocking separate", () => {
    const preflight = headingSection(read(TEMPLATE), "##", "Preflight Audit Mode")
    const coverage = headingSection(read(TEMPLATE), "##", "Coverage Hunt Mode")

    assert.match(preflight, /fail closed\s+to\s+strict mode/i)
    assert.match(preflight, /scope context\s+is missing/i)
    assert.match(coverage, /scope mode or confirmed baseline/i)
    assert.match(coverage, /blocker/i)
  })

  it("keeps optional additions as CV candidates", () => {
    const coverage = headingSection(read(TEMPLATE), "##", "Coverage Hunt Mode")

    assert.match(coverage, /Classification: `optional`|Classification.*optional/i)
    assert.match(coverage, /never .*SE-\*|not .*SE-\*/i)
    assert.match(coverage, /lead/i)
  })

  it("contains no write or secret-collection instruction", () => {
    const template = read(TEMPLATE)

    assert.doesNotMatch(template, /modify (?:any )?file|create (?:a )?file|write (?:to )?(?:any )?file/i)
    assert.match(template, /Never request[\s\S]{0,60}secrets/i)
    assert.match(template, /read-only/i)
  })
})

describe("generated package artifact", () => {
  it("is generated with the required frontmatter and no hardcoded model", () => {
    assert.equal(existsSync(join(ROOT, AGENT)), true, `${AGENT} must exist`)
    const content = read(AGENT)
    const fm = frontmatter(content)

    assert.match(fm, /^mode: subagent$/m)
    assert.match(fm, /^hidden: true$/m)
    assert.match(fm, /^ {2}edit: deny$/m)
    assert.match(fm, /^ {2}bash: deny$/m)
    assert.doesNotMatch(fm, /^model:/m)
    assert.match(fm, /^# Generated by CodeOps install_agents\.py$/m)
    assert.match(fm, /preflight-audit/)
    assert.match(fm, /coverage[- ]hunt/i)
  })

  it("keeps the packaged body in sync with the template", () => {
    const template = read(TEMPLATE)
    const agent = read(AGENT)
    const marker = "<!-- Agent template: preflight-auditor"
    const templateBody = template.slice(template.indexOf(marker)).trim()
    assert.notEqual(agent.indexOf(templateBody), -1, "the packaged agent must embed the template")
  })

  it("introduces no coverage-auditor role", () => {
    assert.equal(existsSync(join(ROOT, "agents", "coverage-auditor.md")), false)
    assert.doesNotMatch(read(INSTALLER), /coverage-auditor/)
  })
})
