/**
 * Specification tests for the specialist-agent protocol content.
 *
 * These tests pin the repository-visible contract of the specialist-agent
 * capability: the canonical protocol document must exist with its schema stamp
 * and required sections (detection criteria, candidate packet, authority and
 * budget clauses, outcome recording, and lifecycle), and the shared layout and
 * skill documents must stay consistent (the specialists path is documented,
 * no script-root placeholder leaks, and skill frontmatter survives edits).
 *
 * This is the specification oracle for the content side of the feature: a
 * failure here means the repository content is wrong, never the test.
 *
 * @module specialist-content.spec.test
 */

import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Read a repository file as UTF-8 text.
 * @param {string} relativePath - Path relative to the repository root.
 * @returns {string} The file contents.
 */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

/**
 * Recursively collect every regular file under a repository directory.
 * @param {string} relativeDir - Directory relative to the repository root.
 * @returns {string[]} Absolute paths of the files found.
 */
function filesUnder(relativeDir) {
  const base = join(ROOT, relativeDir)
  const found = []
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    const path = join(base, entry.name)
    if (entry.isDirectory()) {
      found.push(...filesUnder(join(relativeDir, entry.name)))
    } else if (entry.isFile()) {
      found.push(path)
    }
  }
  return found
}

describe("ST-30 specialist protocol document", () => {
  const protocolPath = "_shared/specialist-agents.md"

  it("exists with the CodeOps artifact schema stamp", () => {
    assert.equal(existsSync(join(ROOT, protocolPath)), true, `${protocolPath} must exist`)
    assert.match(read(protocolPath), /^> \*\*CodeOps Artifact Schema\*\*: 1$/m)
  })

  it("defines evidence-based detection criteria with disqualifiers", () => {
    const content = read(protocolPath)
    assert.match(content, /strong signal/i)
    assert.match(content, /disqualifier/i)
    assert.match(content, /smallest alternative/i)
  })

  it("defines the candidate packet that is presented before approval", () => {
    const content = read(protocolPath)
    assert.match(content, /candidate packet/i)
    const fields = [
      "Role",
      "Kind",
      "Capability",
      "Evidence",
      "Why existing options fail",
      "Smallest alternative",
      "Use map",
      "Permissions",
      "Effort",
      "Maintenance cost",
      "Independent verdict",
      "Direct user decision",
    ]
    for (const field of fields) {
      assert.match(content, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `candidate packet field "${field}"`)
    }
  })

  it("carries the reserved-authority and two-candidate budget clauses", () => {
    const content = read(protocolPath)
    assert.match(content, /--auto-design/)
    assert.match(content, /(?:may never|can never|cannot|must not)\s+approve/i)
    assert.match(content, /at most\s+\*{0,2}two\*{0,2}\s+candidates/i)
  })

  it("states that a rejected candidate may not reappear without new evidence", () => {
    assert.match(read(protocolPath), /may not reappear/i)
  })

  it("requires recording the detection outcome, including a negative outcome", () => {
    const content = read(protocolPath)
    assert.match(content, /negative outcome/i)
    assert.match(content, /always/i)
  })

  it("documents the detect-to-retire lifecycle", () => {
    const content = read(protocolPath)
    for (const stage of ["Detect", "Propose", "Create", "Use", "Retire"]) {
      assert.match(content, new RegExp(`\\|\\s*${stage}\\b`), `lifecycle stage "${stage}"`)
    }
  })
})

describe("ST-32 specialist wiring and routing content", () => {
  it("links the protocol from every participating skill and the quality profile", () => {
    for (const file of [
      "skills/make-requirements/SKILL.md",
      "skills/make-plan/SKILL.md",
      "skills/analyze-project/SKILL.md",
      "skills/setup-routing/SKILL.md",
      "_shared/quality-profile.md",
    ]) {
      assert.match(read(file), /specialist-agents\.md/, `${file} must link the protocol`)
    }
  })

  it("contains the make-plan Specialist Agents section", () => {
    assert.match(read("skills/make-plan/templates.md"), /^## Specialist Agents$/m)
  })

  it("documents the SR prefix, specialist resolution, and fallback in the quality profile", () => {
    const content = read("_shared/quality-profile.md")
    assert.match(content, /SR \(domain-specialist/)
    assert.match(content, /specialist/i)
    assert.match(content, /fallback/i)
  })

  it("points exec-plan at the specialist routing rules", () => {
    assert.match(read("skills/exec-plan/SKILL.md"), /[Ss]pecialist/)
    assert.match(read("skills/exec-plan/execution-protocol.md"), /[Ss]pecialist/)
    assert.match(read("skills/exec-plan/execution-protocol.md"), /SR/)
  })

  it("updates the setup-routing AGENTS.md stance and documents the managed block", () => {
    const content = read("skills/setup-routing/SKILL.md")
    assert.doesNotMatch(content, /AGENTS\.md receives only a concise instruction/)
    assert.match(content, /CODEOPS-SPECIALISTS:START/)
    assert.match(content, /--remove-custom/)
  })

  it("declares the reasoning enum in the config schema", () => {
    const schema = JSON.parse(read("schemas/codeops-config.schema.json"))
    const reasoning = schema.properties.routing.properties.roles.additionalProperties.properties.reasoning
    assert.deepEqual(reasoning.enum, ["none", "minimal", "low", "medium", "high", "xhigh", "max"])
  })
})

describe("ST-31 layout and content hygiene", () => {
  it("documents codeops/specialists/ as a project-level path", () => {
    const content = read("_shared/layout-convention.md")
    assert.match(content, /codeops\/specialists\//)
    assert.match(content, /project-level/i)
  })

  it("contains no ${PLUGIN_ROOT} placeholder leak in shared docs, skills, or standards", () => {
    const leak = /\$\{PLUGIN_ROOT\}/
    const offenders = []
    for (const dir of ["skills", "_shared", "standards"]) {
      for (const file of filesUnder(dir)) {
        if (leak.test(readFileSync(file, "utf8"))) {
          offenders.push(file.slice(ROOT.length + 1))
        }
      }
    }
    assert.deepEqual(offenders, [], `files reference \${PLUGIN_ROOT}: ${offenders.join(", ")}`)
  })

  it("keeps a name frontmatter field on every skill", () => {
    const missing = []
    for (const entry of readdirSync(join(ROOT, "skills"), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const skillPath = join(ROOT, "skills", entry.name, "SKILL.md")
      if (!existsSync(skillPath)) continue
      if (!/^name:\s*\S+/m.test(readFileSync(skillPath, "utf8"))) {
        missing.push(`skills/${entry.name}/SKILL.md`)
      }
    }
    assert.deepEqual(missing, [], `skills missing a name: field: ${missing.join(", ")}`)
  })
})
