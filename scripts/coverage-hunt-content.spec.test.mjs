/**
 * Specification tests for the Coverage Hunt protocol.
 *
 * These content guards are the acceptance oracle for `_shared/coverage-hunt.md`:
 * the exact cluster partition, the bounded dispatch packet, the result
 * contract, the materiality filter, the persisted coverage map, the budget,
 * the fallback table, authority boundaries, content-free metrics, the
 * freshness rule, and the per-cluster effort assignment. A failure here means
 * the shipped protocol lost a required guarantee — never that the test is
 * wrong.
 *
 * @module coverage-hunt-content.spec.test
 */

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const PROTOCOL = "_shared/coverage-hunt.md"
const GATE = "_shared/zero-ambiguity-gate.md"

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
 * Headings inside fenced code blocks are sample content, not document
 * structure, so the scan ignores them. This keeps the result contract and the
 * coverage-map template intact.
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
 * Return one level-2 section, without its heading.
 *
 * @param content - Full document
 * @param title - Exact level-2 heading text
 * @returns The section body
 */
function section(content, title) {
  return headingSection(content, "##", title)
}

/**
 * Return one level-3 section, without its heading.
 *
 * @param content - Full document
 * @param title - Exact level-3 heading text
 * @returns The section body
 */
function subsection(content, title) {
  return headingSection(content, "###", title)
}

/**
 * Parse Markdown table rows into cell arrays.
 *
 * @param text - Text containing one or more tables
 * @returns Arrays of trimmed cells, separator rows removed
 */
function tableRows(text) {
  return text
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim())
    )
    .filter((cells) => cells.every((cell) => !/^:?-{3,}:?$/.test(cell)))
}

/**
 * Strip emphasis and code markers from a table cell.
 *
 * @param value - Raw cell text
 * @returns Plain text
 */
function plain(value) {
  return value.replace(/\*\*/g, "").replace(/`/g, "").trim()
}

/**
 * Read the twelve canonical ambiguity categories.
 *
 * @returns The category names in source order
 */
function canonicalCategories() {
  const content = read(GATE)
  const start = content.indexOf("| Category | What to look for |")
  assert.notEqual(start, -1, "the gate must list the twelve categories")
  const parallel = content.indexOf("\n\n", start)
  const rows = tableRows(content.slice(start, parallel === -1 ? undefined : parallel))
  return rows
    .slice(1)
    .map((cells) => plain(cells[0]))
    .filter((name) => name.length > 0)
}

describe("protocol document", () => {
  it("exists and contains every required section", () => {
    assert.equal(existsSync(join(ROOT, PROTOCOL)), true, `${PROTOCOL} must exist`)
    const content = read(PROTOCOL)
    for (const title of [
      "When It Runs",
      "Cluster Partition",
      "Dispatch Packet",
      "Result Contract",
      "Materiality Filter",
      "Coverage Map",
      "Budget and Scheduling",
      "Fallback",
      "Authority Boundaries",
      "Observability",
      "Compatibility",
    ]) {
      assert.notEqual(content.indexOf(`## ${title}`), -1, `missing section: ${title}`)
    }
  })
})

describe("cluster partition", () => {
  it("covers every canonical category exactly once in default mode", () => {
    const partition = section(read(PROTOCOL), "Cluster Partition")
    const defaultRows = tableRows(subsection(partition, "Default mode"))
    assert.equal(defaultRows.length, 5, "default mode must define four data rows plus a header")
    defaultRows.shift()
    const assigned = defaultRows.flatMap((cells) =>
      cells[2].split("·").map((category) => plain(category))
    )
    assert.equal(assigned.length, 12)
    assert.deepEqual([...assigned].sort(), [...canonicalCategories()].sort())
    assert.equal(new Set(assigned).size, 12, "no category may appear twice")
  })

  it("covers every canonical category exactly once in thorough mode", () => {
    const partition = section(read(PROTOCOL), "Cluster Partition")
    const thoroughRows = tableRows(subsection(partition, "Thorough mode"))
    assert.equal(thoroughRows.length, 13, "thorough mode must define twelve data rows plus a header")
    thoroughRows.shift()
    const assigned = thoroughRows.map((cells) => plain(cells[2]))
    assert.deepEqual([...assigned].sort(), [...canonicalCategories()].sort())
    assert.match(partition, /one to three|1 to 3|1–3/i)
    assert.match(partition, /exactly once/i)
  })
})

describe("dispatch packet", () => {
  it("defines every bounded packet field and links the single header", () => {
    const content = section(read(PROTOCOL), "Dispatch Packet")
    for (const field of [
      "Line 1 header",
      "Effort marker",
      "Mode",
      "Goal and baseline",
      "Scope context",
      "Artifact context",
      "Code context",
      "Prior decisions",
      "Questions",
      "Output contract",
      "Forbidden actions",
      "Hygiene",
    ]) {
      assert.notEqual(content.indexOf(`**${field}**`), -1, `packet must define ${field}`)
    }
    assert.match(content, /_shared\/quality-profile\.md/)
    assert.doesNotMatch(content, /\[codeops-dispatch agent=/)
    assert.match(content, /\[codeops-effort: <level>\]/)
    assert.match(content, /_shared\/reasoning-effort\.md/)
  })
})

describe("result contract", () => {
  it("defines the required sections and candidate fields", () => {
    const content = section(read(PROTOCOL), "Result Contract")
    for (const heading of [
      "Coverage Result",
      "Examined",
      "Not examined / limits",
      "Candidates",
      "Assumptions",
      "Coverage statement",
      "Effort",
    ]) {
      assert.match(content, new RegExp(`#{2,3} ${heading.replace("/", "\\/")}`))
    }
    assert.match(content, /CV-NNN/)
    for (const field of [
      "Category",
      "Question",
      "Options",
      "Evidence",
      "Why material",
      "Classification",
      "Confidence",
    ]) {
      assert.notEqual(content.indexOf(`**${field}**`), -1, `candidate must define ${field}`)
    }
    assert.doesNotMatch(content, /\*\*Affected area\*\*/)
    assert.match(content, /Requested/)
    assert.match(content, /Applied/)
    assert.match(content, /Mapping/)
  })
})

describe("materiality filter", () => {
  it("lists the material and non-material conditions with the cap", () => {
    const content = section(read(PROTOCOL), "Materiality Filter")
    const materialStart = content.indexOf("**Material**")
    const nonMaterialStart = content.indexOf("**Non-material**")
    assert.notEqual(materialStart, -1)
    assert.notEqual(nonMaterialStart, -1)
    const material = content.slice(materialStart, nonMaterialStart)
    const nonMaterial = content.slice(nonMaterialStart, content.indexOf("**Filter procedure**"))
    const materialCount = material.split("\n").filter((line) => /^- /.test(line)).length
    const nonMaterialCount = nonMaterial.split("\n").filter((line) => /^- /.test(line)).length
    assert.ok(materialCount >= 7, `need at least seven material conditions, got ${materialCount}`)
    assert.ok(
      nonMaterialCount >= 3,
      `need at least three non-material conditions, got ${nonMaterialCount}`
    )
    assert.match(nonMaterial, /any is true/i)
    assert.match(content, /\b12\b/)
    assert.match(content, /every material candidate\s+enters\s+the register/i)
  })
})

describe("coverage map", () => {
  it("defines the exact columns, summary, freshness, and source note", () => {
    const content = section(read(PROTOCOL), "Coverage Map")
    const columns = tableRows(content)[0].map((cell) => plain(cell))
    assert.deepEqual(columns, [
      "Cluster",
      "Area",
      "Examined",
      "Not examined / limit",
      "Candidates",
      "Notes / limit",
      "Confidence",
    ])
    assert.match(
      content,
      /\*\*Coverage\*\*: <completed>\/<total> clusters · <examined>\/12 categories · <N> candidates · <M> residual limits · Effort: <requested→applied> · Independence: <mixed-model\|mixed-effort\|uniform-effort>/
    )
    assert.match(content, /\*\*Freshness\*\*: Coverage as of <date>; artifacts <list>/)
    assert.match(content, /CV-\*/)
    assert.match(content, /DQ-\*/)
    assert.match(content, /incomplete/i)
    assert.match(content, /never\s+reported\s+as\s+complete/i)
  })

  it("places the map in the requirements and plan artifacts", () => {
    const content = section(read(PROTOCOL), "Coverage Map")
    assert.match(content, /00-ambiguity-register\.md/)
    assert.match(content, /00-index\.md/)
    assert.match(content, /Phase 1C/)
    assert.match(content, /requirements/i)
  })
})

describe("budget and fallback", () => {
  it("states every budget control", () => {
    const content = section(read(PROTOCOL), "Budget and Scheduling")
    assert.match(content, /12 single-category clusters/)
    assert.match(content, /≤3/)
    assert.match(content, /maxConcurrentAgents/)
    assert.match(content, /\b4\b/)
    assert.match(content, /one consolidated|1 consolidated/i)
  })

  it("covers every fallback condition", () => {
    const content = section(read(PROTOCOL), "Fallback")
    for (const condition of [
      /subagents unavailable/i,
      /cluster .*fail|dispatch .*fail/i,
      /model pin is unavailable/i,
      /no usable effort variants|no usable .* variant/i,
      /only one model\/provider/i,
      /scope mode or scope baseline is missing|missing scope/i,
      /cannot be verified/i,
      /artifact is too large/i,
    ]) {
      assert.match(content, condition)
    }
    assert.match(content, /inline fallback/i)
    assert.match(content, /incomplete/i)
    assert.match(content, /effort unavailable/i)
    assert.match(content, /raw `reasoningEffort`|raw reasoningEffort/i)
    assert.match(content, /fail closed/i)
  })
})

describe("authority and security", () => {
  it("states the auditor and lead boundaries", () => {
    const content = section(read(PROTOCOL), "Authority Boundaries")
    for (const rule of [
      /never.*ask the user|never.*contact the user|no user contact/i,
      /never edit|edit any file/i,
      /approve or waive a gate|approve a gate/i,
      /expand scope/i,
      /instructions embedded in repository content|file content is evidence/i,
      /secrets|credentials/i,
    ]) {
      assert.match(content, rule)
    }
    assert.match(content, /lead/i)
  })

  it("states the packet security controls", () => {
    const content = read(PROTOCOL)
    assert.match(content, /prompt[- ]injection/i)
    assert.match(content, /canonicaliz|canonical path/i)
    assert.match(content, /symlink/i)
    assert.match(content, /no shell interpolation|never .*interpolat/i)
    assert.match(content, /secrets|credentials/i)
  })
})

describe("observability", () => {
  it("names exactly the five content-free events", () => {
    const content = section(read(PROTOCOL), "Observability")
    for (const event of ["completed", "fallback", "independence", "effort", "accepted"]) {
      assert.match(content, new RegExp(`coverage_hunt\\.${event}`))
    }
    assert.match(content, /stage=requirements/)
    assert.match(content, /stage=planning/)
    assert.doesNotMatch(content, /stage=plan\b/)
    assert.match(content, /no prompts|never prompts|prompt.*not/i)
    assert.match(content, /paths?/i)
    assert.match(content, /user text/i)
  })
})

describe("compatibility and effort", () => {
  it("keeps the change additive with the freshness rule", () => {
    const content = section(read(PROTOCOL), "Compatibility")
    assert.match(content, /existing requirements sets and plans remain valid/i)
    assert.match(content, /no new artifact/i)
    assert.match(content, /schema stamp/i)
    assert.match(content, /add_requirement/)
    assert.match(content, /upgrade-plan/)
    assert.match(content, /stale/i)
  })

  it("assigns canonical effort per cluster and thorough risk categories", () => {
    const content = read(PROTOCOL)
    assert.match(content, /C1[^\n]*`?high`?/i)
    assert.match(content, /C2[^\n]*`?high`?/i)
    assert.match(content, /C3[^\n]*`?high`?/i)
    assert.match(content, /C4[^\n]*`?xhigh`?/i)
    assert.match(content, /synthesis[^\n]*`?high`?/i)
    assert.match(content, /three risk categories/i)
    assert.match(content, /xhigh/)
    assert.match(content, /`max`[^\n]*explicit-only|explicit-only[^\n]*`max`/i)
    assert.match(content, /recon[^\n]*`?low`?[^\n]*`?medium`?|`low`\/`medium`/i)
  })
})

describe("worked example and anti-patterns", () => {
  it("includes one packet and one candidate example", () => {
    const content = read(PROTOCOL)
    assert.match(content, /## Worked Example/)
    assert.match(content, /\[codeops-dispatch /)
    assert.match(content, /CV-001/)
  })

  it("names the anti-patterns", () => {
    const content = read(PROTOCOL)
    assert.match(content, /## Anti-Patterns/)
    for (const pattern of [
      /flood/i,
      /guess/i,
      /re-litigat|relitigat/i,
      /optional enhancement/i,
      /complete(?:ness)?/i,
    ]) {
      assert.match(content, pattern)
    }
  })
})
