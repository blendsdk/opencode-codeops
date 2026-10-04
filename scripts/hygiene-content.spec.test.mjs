/**
 * Specification tests for CodeOps workspace hygiene.
 *
 * These tests pin the cleanup contract: the canonical hygiene protocol exists
 * with its schema stamp, the always-injected standards carry the rule, every
 * skill points at the protocol, every agent template carries the rule, and the
 * packaged catalog agent bodies stay in sync with their templates.
 *
 * This is the specification oracle for the hygiene directive: a failure here
 * means the repository content is wrong, never the test.
 *
 * @module hygiene-content.spec.test
 */

import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** Canonical hygiene protocol document. */
const HYGIENE_DOC = "_shared/workspace-hygiene.md"

/** Catalog role -> agent-template name, mirroring `scripts/install_agents.py`. */
const CATALOG_ROLES = {
  explorer: "codebase-scout",
  "design-challenger": "design-challenger",
  "performance-auditor": "perf-auditor",
  "correctness-reviewer": "phase-reviewer",
  "executor": "plan-task-executor",
  "demanding-executor": "plan-task-executor-opus",
  "preflight-auditor": "preflight-auditor",
  "security-auditor": "security-auditor",
  "spec-test-author": "spec-test-author",
  "financial-integrity-auditor": "financial-integrity-auditor",
  "concurrency-auditor": "concurrency-auditor",
  "semantics-reviewer": "semantics-reviewer",
}

/**
 * Read a repository file as UTF-8 text.
 *
 * @param {string} relativePath - Path relative to the repository root.
 * @returns {string} The file contents.
 */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

/**
 * Extract an agent file's contract body, without its frontmatter or provenance
 * comment, so a catalog agent and its template can be compared.
 *
 * @param {string} content - Raw agent or template Markdown.
 * @returns {string} The trimmed body text.
 */
function agentBody(content) {
  const frontmatter = content.match(/^[\s\S]*?\n---\n[\s\S]*?\n---\n/)
  const rest = frontmatter ? content.slice(frontmatter[0].length) : content
  return rest.replace(/<!-- Agent template:[\s\S]*?-->/, "").trim()
}

describe("hygiene protocol document", () => {
  it("exists with the CodeOps artifact schema stamp", () => {
    assert.equal(existsSync(join(ROOT, HYGIENE_DOC)), true, `${HYGIENE_DOC} must exist`)
    assert.match(read(HYGIENE_DOC), /^> \*\*CodeOps Artifact Schema\*\*: 1$/m)
  })

  it("defines the sanctioned temp root and the completion cleanup pass", () => {
    const content = read(HYGIENE_DOC)
    assert.match(content, /\$CODEOPS_TMPDIR/)
    assert.match(content, /temporary artifact/i)
    assert.match(content, /delete/i)
  })

  it("forbids deleting user, versioned, and other-session files", () => {
    const content = read(HYGIENE_DOC)
    assert.match(content, /user files/i)
    assert.match(content, /versioned/i)
    assert.match(content, /another session/i)
  })
})

describe("hygiene in the always-injected standards", () => {
  it("carries the non-negotiable cleanup rule in the compact core", () => {
    const content = read("standards/coding-standards.md")
    assert.match(content, /Cleanup after yourself/)
    assert.match(content, /\$CODEOPS_TMPDIR/)
    assert.match(content, /workspace-hygiene\.md/)
  })

  it("carries the full workspace-hygiene section in the reference", () => {
    const content = read("standards/coding-standards-full.md")
    assert.match(content, /^# Workspace hygiene \(NON-NEGOTIABLE\)$/m)
    assert.match(content, /\$CODEOPS_TMPDIR/)
    assert.match(content, /workspace-hygiene\.md/)
  })
})

describe("hygiene in the skills", () => {
  it("links the protocol from every skill", () => {
    const missing = []
    for (const entry of readdirSync(join(ROOT, "skills"), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const skillPath = join("skills", entry.name, "SKILL.md")
      if (!existsSync(join(ROOT, skillPath))) continue
      if (!read(skillPath).includes(HYGIENE_DOC)) missing.push(skillPath)
    }
    assert.deepEqual(missing, [], `skills missing the hygiene link: ${missing.join(", ")}`)
  })

  it("ends the exec-plan verify-log rule at wrap-up cleanup", () => {
    const content = read("skills/exec-plan/execution-protocol.md")
    assert.match(content, /\$CODEOPS_TMPDIR/)
    assert.doesNotMatch(content, /full log always remains on disk for the session/)
  })
})

describe("hygiene in the agents", () => {
  it("carries the hygiene rule in every agent template", () => {
    const missing = []
    for (const entry of readdirSync(join(ROOT, "agent-templates"), { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue
      const templatePath = join("agent-templates", entry.name)
      if (!/Workspace hygiene/.test(read(templatePath))) missing.push(templatePath)
    }
    assert.deepEqual(missing, [], `templates missing the hygiene rule: ${missing.join(", ")}`)
  })

  it("keeps every packaged catalog agent body in sync with its template", () => {
    for (const [role, template] of Object.entries(CATALOG_ROLES)) {
      const agent = agentBody(read(join("agents", `${role}.md`)))
      const source = agentBody(read(join("agent-templates", `${template}.md`)))
      assert.equal(agent, source, `agents/${role}.md must match agent-templates/${template}.md`)
    }
  })
})
