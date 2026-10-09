/**
 * Specification tests for custom specialist-agent generation.
 *
 * These tests pin the observable contract of `scripts/install_agents.py` for
 * project specialists: brief validation, deterministic generation from the two
 * generic templates, routing overrides, YAML-safe prompt text, dry-run
 * behavior, and the catalog-role regression guard. Every case spawns the real
 * `python3` installer against a temporary fixture project with
 * `CODEOPS_PLUGIN_ROOT` pointed at this checkout, so the plugin root the tests
 * exercise is always the working tree under test.
 *
 * This is the specification oracle: a failing test means the installer is
 * wrong, never the test.
 *
 * @module install_agents.spec.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const INSTALLER = join(ROOT, "scripts", "install_agents.py")
const REVIEWER_TEMPLATE = "domain-specialist-reviewer"
const EXECUTOR_TEMPLATE = "domain-specialist-executor"
const START_MARKER = "<!-- CODEOPS-SPECIALISTS:START -->"
const END_MARKER = "<!-- CODEOPS-SPECIALISTS:END -->"
const ALL_CATALOG_ROLES = 12

/** Temporary fixture projects created by this suite; removed on exit. */
const fixtures = []

after(() => {
  for (const dir of fixtures) {
    rmSync(dir, { recursive: true, force: true })
  }
})

/**
 * Create an empty temporary fixture project.
 * @returns {string} Absolute path of the fixture project root.
 */
function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), "codeops-installer-spec-"))
  fixtures.push(dir)
  return dir
}

/**
 * Write a UTF-8 file inside a fixture project, creating parent directories.
 * @param {string} project - Fixture project root.
 * @param {string} relativePath - Path relative to the project root.
 * @param {string} content - File contents.
 * @returns {string} Absolute path of the written file.
 */
function writeFixtureFile(project, relativePath, content) {
  const path = join(project, relativePath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, "utf8")
  return path
}

/**
 * Read a UTF-8 file from a fixture project.
 * @param {string} project - Fixture project root.
 * @param {string} relativePath - Path relative to the project root.
 * @returns {string} The file contents.
 */
function readFixtureFile(project, relativePath) {
  return readFileSync(join(project, relativePath), "utf8")
}

/**
 * Run the installer against a fixture project with the checkout as plugin root.
 * @param {string} project - Fixture project root.
 * @param {...string} args - Additional installer arguments.
 * @returns {{status: number, stdout: string, stderr: string}} Spawn result.
 */
function runInstaller(project, ...args) {
  return spawnSync("python3", [INSTALLER, "--project", project, ...args], {
    encoding: "utf8",
    env: { ...process.env, CODEOPS_PLUGIN_ROOT: ROOT },
  })
}

/**
 * Build a brief document from a frontmatter field map plus a Markdown body.
 * A `null` value omits the field, which lets a test model a missing key.
 * @param {Record<string, string|null>} fields - Frontmatter fields.
 * @param {string} [body] - Markdown body.
 * @returns {string} The complete brief file content.
 */
function brief(fields, body = "## Domain checklist\n\n- Verify every migration is forward-only and idempotent.\n") {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}: ${value}`)
  return `---\n${lines.join("\n")}\n---\n\n${body}`
}

/**
 * A valid reviewer brief with overridable fields.
 * @param {Record<string, string|null>} [overrides] - Fields to override or omit (`null`).
 * @param {string} [body] - Optional replacement body.
 * @returns {string} The brief content.
 */
function reviewerBrief(overrides = {}, body) {
  return brief(
    {
      schema: "1",
      role: "pg-migration-reviewer",
      kind: "reviewer",
      description:
        "Reviews PostgreSQL schema and backfill diffs for mixed-version safety. Use for any migration phase.",
      capability: "PostgreSQL migration ordering, backfill batching, and rollback safety",
      scope: "schema changes, backfills, cutover, and compatibility windows",
      evidence: "db/migrations/0042_backfill.sql:1 requires batched backfill",
      effort: "high",
      reasoning: "max",
      hidden: "false",
      "required-for": "any phase changing db/migrations/**",
      ...overrides,
    },
    body,
  )
}

/**
 * A valid executor brief with overridable fields.
 * @param {Record<string, string|null>} [overrides] - Fields to override or omit (`null`).
 * @param {string} [body] - Optional replacement body.
 * @returns {string} The brief content.
 */
function executorBrief(overrides = {}, body) {
  return brief(
    {
      schema: "1",
      role: "pg-migration-executor",
      kind: "executor",
      description: "Applies PostgreSQL schema and backfill migrations under the project migration rules.",
      capability: "PostgreSQL migration ordering and backfill batching",
      scope: "schema changes and backfills",
      evidence: "db/migrations/0042_backfill.sql:1 requires batched backfill",
      effort: "high",
      reasoning: "max",
      hidden: "false",
      "required-for": "any phase changing db/migrations/**",
      ...overrides,
    },
    body,
  )
}

/**
 * Write a brief into the fixture project's specialists directory.
 * @param {string} project - Fixture project root.
 * @param {string} role - Brief role (filename without extension).
 * @param {string} content - Brief content.
 * @returns {string} Absolute path of the written brief.
 */
function writeBrief(project, role, content) {
  return writeFixtureFile(project, join("codeops", "specialists", `${role}.md`), content)
}

/**
 * Extract the frontmatter block from a generated agent file.
 * Handles both the frontmatter-first layout and the legacy layout whose
 * provenance banner precedes the block.
 * @param {string} content - Generated agent file content.
 * @returns {string} The frontmatter block (without the `---` delimiters).
 */
function frontmatterBlock(content) {
  const start = content.startsWith("---\n") ? 4 : content.indexOf("\n---\n") + 5
  assert.ok(content.startsWith("---\n") || start >= 5, "generated file must contain a frontmatter block")
  const end = content.indexOf("\n---", start)
  assert.notEqual(end, -1, "generated file frontmatter must be closed")
  return content.slice(start, end)
}

/**
 * Load an agent template body (frontmatter stripped) from the checkout.
 * @param {string} name - Template name without extension.
 * @returns {string} The template body.
 */
function templateBody(name) {
  const content = readFileSync(join(ROOT, "agent-templates", `${name}.md`), "utf8")
  if (content.startsWith("---")) {
    const end = content.indexOf("\n---", 3)
    if (end !== -1) return content.slice(end + 4)
  }
  return content
}

/**
 * Assert that a generated file opens with frontmatter and carries the CodeOps
 * ownership marker inside the leading block.
 * @param {string} project - Fixture project root.
 * @param {string} role - Generated role.
 */
function assertFrontmatterFirst(project, role) {
  const content = readFixtureFile(project, join(".opencode", "agents", `${role}.md`))
  assert.equal(content.split("\n", 1)[0], "---", "generated files must open with ---")
  assert.match(frontmatterBlock(content), /^# Generated by CodeOps install_agents\.py$/m)
}

/**
 * Pre-generate all twelve catalog agents so check exit codes are attributable
 * to the custom states under test.
 * @param {string} project - Fixture project root.
 */
function generateCatalogAgents(project) {
  const result = runInstaller(project)
  assert.equal(result.status, 0, `catalog generation failed: ${result.stderr || result.stdout}`)
}

/**
 * Build the on-disk shape of a marker-owned generated specialist agent.
 * @param {string} role - Role name recorded in the ownership header.
 * @returns {string} Generated-agent content.
 */
function markerAgent(role) {
  return [
    "---",
    "# Generated by CodeOps install_agents.py",
    `# Role: ${role} | Template: domain-specialist-reviewer`,
    "# Do not edit this file manually — regenerate with: install_agents.py",
    'description: "x"',
    "mode: subagent",
    "---",
    "",
    "body",
    "",
  ].join("\n")
}

/**
 * Generate one custom specialist and sync the AGENTS.md index.
 * @param {string} project - Fixture project root.
 * @param {string} role - Specialist role.
 * @param {string} [content] - Brief content (defaults to a valid reviewer brief).
 */
function generateSpecialist(project, role, content = reviewerBrief({ role })) {
  writeBrief(project, role, content)
  const generated = runInstaller(project, "--custom", role)
  assert.equal(generated.status, 0, `custom generation failed: ${generated.stderr || generated.stdout}`)
  const synced = runInstaller(project, "--sync-agents-md")
  assert.equal(synced.status, 0, `sync failed: ${synced.stderr || synced.stdout}`)
}

describe("custom agent generation (ST-1, ST-2)", () => {
  it("generates a reviewer agent with the reviewer contract followed by the brief body", () => {
    const project = makeProject()
    const role = "pg-migration-reviewer"
    const content = reviewerBrief()
    writeBrief(project, role, content)

    const result = runInstaller(project, "--custom", role)

    assert.equal(result.status, 0, `installer failed: ${result.stderr || result.stdout}`)
    const generated = readFixtureFile(project, join(".opencode", "agents", `${role}.md`))
    assertFrontmatterFirst(project, role)
    const frontmatter = frontmatterBlock(generated)
    assert.match(frontmatter, /^description: ".*"$/m, "description must be a quoted YAML scalar")
    assert.match(frontmatter, /^mode: subagent$/m)
    assert.match(frontmatter, /^hidden: false$/m)
    assert.match(frontmatter, /^reasoningEffort: max$/m)
    assert.match(frontmatter, /^ {2}edit: deny$/m)
    assert.match(frontmatter, /^ {2}bash: allow$/m)

    const contract = templateBody(REVIEWER_TEMPLATE).trim()
    const body = content.split("\n---\n")[1].trim()
    assert.notEqual(generated.indexOf(contract), -1, "reviewer contract text must be present")
    assert.ok(
      generated.indexOf(contract) < generated.indexOf(body),
      "the reviewer contract must precede the brief body",
    )
  })

  it("generates an executor agent with writable permissions and the executor contract", () => {
    const project = makeProject()
    const role = "pg-migration-executor"
    writeBrief(project, role, executorBrief())

    const result = runInstaller(project, "--custom", role)

    assert.equal(result.status, 0, `installer failed: ${result.stderr || result.stdout}`)
    const frontmatter = frontmatterBlock(readFixtureFile(project, join(".opencode", "agents", `${role}.md`)))
    assert.match(frontmatter, /^ {2}edit: allow$/m)
    const contract = templateBody(EXECUTOR_TEMPLATE).trim()
    assert.notEqual(
      readFixtureFile(project, join(".opencode", "agents", `${role}.md`)).indexOf(contract),
      -1,
      "executor contract text must be present",
    )
  })

  it("maps brief effort, reasoning, and hidden values into the frontmatter", () => {
    const project = makeProject()
    const role = "pg-migration-reviewer"
    writeBrief(project, role, reviewerBrief({ effort: "low", reasoning: "high", hidden: "true" }))

    const result = runInstaller(project, "--custom", role)

    assert.equal(result.status, 0, `installer failed: ${result.stderr || result.stdout}`)
    const frontmatter = frontmatterBlock(readFixtureFile(project, join(".opencode", "agents", `${role}.md`)))
    assert.match(frontmatter, /^temperature: 0\.3$/m)
    assert.match(frontmatter, /^reasoningEffort: high$/m)
    assert.match(frontmatter, /^hidden: true$/m)
  })
})

describe("brief validation (ST-3, ST-4, ST-12, ST-13)", () => {
  it("rejects a brief without a description and names the field", () => {
    const project = makeProject()
    const role = "pg-migration-reviewer"
    writeBrief(project, role, reviewerBrief({ description: null }))

    const result = runInstaller(project, "--custom", role)

    assert.notEqual(result.status, 0)
    assert.match(result.stderr + result.stdout, /description/)
    assert.equal(existsSync(join(project, ".opencode", "agents", `${role}.md`)), false)
  })

  it("rejects a brief missing role or kind and a description that sanitizes to empty", () => {
    const cases = [
      { brief: reviewerBrief({ role: null }), role: "pg-migration-reviewer" },
      { brief: reviewerBrief({ kind: null }), role: "pg-migration-reviewer" },
      { brief: reviewerBrief({ description: "<!-- -->" }), role: "pg-migration-reviewer" },
    ]
    for (const { brief: content, role } of cases) {
      const project = makeProject()
      writeBrief(project, role, content)
      const result = runInstaller(project, "--custom", role)
      assert.notEqual(result.status, 0, `brief must be rejected: ${content.split("\n")[3]}`)
      assert.equal(existsSync(join(project, ".opencode", "agents", `${role}.md`)), false)
    }
  })

  it("rejects combining --check with --custom", () => {
    const project = makeProject()
    const role = "pg-migration-reviewer"
    writeBrief(project, role, reviewerBrief())

    const result = runInstaller(project, "--check", "--custom", role)

    assert.notEqual(result.status, 0)
    assert.equal(existsSync(join(project, ".opencode", "agents", `${role}.md`)), false)
  })

  it("rejects an unknown kind and lists the supported kinds", () => {
    const project = makeProject()
    const role = "pg-migration-reviewer"
    writeBrief(project, role, reviewerBrief({ kind: "auditor" }))

    const result = runInstaller(project, "--custom", role)

    assert.notEqual(result.status, 0)
    assert.match(result.stderr + result.stdout, /reviewer/)
    assert.match(result.stderr + result.stdout, /executor/)
    assert.equal(existsSync(join(project, ".opencode", "agents", `${role}.md`)), false)
  })

  it("rejects an unknown frontmatter key and names it", () => {
    const project = makeProject()
    const role = "pg-migration-reviewer"
    writeBrief(project, role, reviewerBrief({ briefSchema: "1" }))

    const result = runInstaller(project, "--custom", role)

    assert.notEqual(result.status, 0)
    assert.match(result.stderr + result.stdout, /briefSchema/)
    assert.equal(existsSync(join(project, ".opencode", "agents", `${role}.md`)), false)
  })

  it("rejects a body over 16384 bytes and accepts the exact boundary", () => {
    const project = makeProject()
    const role = "pg-migration-reviewer"
    writeBrief(project, role, reviewerBrief({}, "a".repeat(16385)))

    const over = runInstaller(project, "--custom", role)

    assert.notEqual(over.status, 0)
    assert.match(over.stderr + over.stdout, /16384/)
    assert.equal(existsSync(join(project, ".opencode", "agents", `${role}.md`)), false)

    writeBrief(project, role, reviewerBrief({}, "a".repeat(16384)))
    const exact = runInstaller(project, "--custom", role)
    assert.equal(exact.status, 0, `boundary body must be accepted: ${exact.stderr || exact.stdout}`)
  })
})

describe("role-name allowlist (ST-5, ST-6, ST-7, ST-8)", () => {
  it("rejects malformed names and accepts a 41-character slug boundary", () => {
    const role41 = `a${"b".repeat(40)}`
    const cases = [
      { role: "UPPER_case", brief: reviewerBrief({ role: "UPPER_case" }) },
      { role: `a${"b".repeat(41)}`, brief: reviewerBrief({ role: `a${"b".repeat(41)}` }) },
      { role: "con", brief: reviewerBrief({ role: "con" }) },
      { role: "name.", brief: reviewerBrief({ role: "name." }) },
    ]

    for (const { role, brief: content } of cases) {
      const project = makeProject()
      writeBrief(project, role, content)
      const result = runInstaller(project, "--custom", role)
      assert.notEqual(result.status, 0, `role "${role}" must be rejected`)
      assert.equal(existsSync(join(project, ".opencode", "agents", `${role}.md`)), false)
    }

    const project = makeProject()
    writeBrief(project, role41, reviewerBrief({ role: role41 }))
    const accepted = runInstaller(project, "--custom", role41)
    assert.equal(accepted.status, 0, `41-character slug must be accepted: ${accepted.stderr || accepted.stdout}`)
  })

  it("rejects path-like role arguments", () => {
    for (const role of ["../evil", "a/b"]) {
      const project = makeProject()
      const result = runInstaller(project, "--custom", role)
      assert.notEqual(result.status, 0, `role "${role}" must be rejected`)
    }
  })

  it("refuses symlinked brief files, specialists directories, and agents directories", () => {
    const outside = makeProject()
    const project = makeProject()
    const role = "pg-migration-reviewer"

    const realBrief = join(outside, `${role}.md`)
    writeFileSync(realBrief, reviewerBrief(), "utf8")
    mkdirSync(join(project, "codeops", "specialists"), { recursive: true })
    symlinkSync(realBrief, join(project, "codeops", "specialists", `${role}.md`))
    const linkedBrief = runInstaller(project, "--custom", role)
    assert.notEqual(linkedBrief.status, 0, "symlinked brief file must be refused")
    assert.equal(existsSync(join(project, ".opencode", "agents", `${role}.md`)), false)

    const specialistsProject = makeProject()
    const realSpecialists = join(outside, "specialists")
    mkdirSync(realSpecialists, { recursive: true })
    writeFileSync(join(realSpecialists, `${role}.md`), reviewerBrief(), "utf8")
    mkdirSync(join(specialistsProject, "codeops"), { recursive: true })
    symlinkSync(realSpecialists, join(specialistsProject, "codeops", "specialists"))
    const linkedDir = runInstaller(specialistsProject, "--custom", role)
    assert.notEqual(linkedDir.status, 0, "symlinked specialists directory must be refused")

    const agentsProject = makeProject()
    writeBrief(agentsProject, role, reviewerBrief())
    const realAgents = join(outside, "agents")
    mkdirSync(realAgents, { recursive: true })
    mkdirSync(join(agentsProject, ".opencode"), { recursive: true })
    symlinkSync(realAgents, join(agentsProject, ".opencode", "agents"))
    const linkedAgents = runInstaller(agentsProject, "--custom", role)
    assert.notEqual(linkedAgents.status, 0, "symlinked agents directory must be refused")
    assert.equal(existsSync(join(realAgents, `${role}.md`)), false, "link target must stay empty")

    const parentProject = makeProject()
    writeBrief(parentProject, role, reviewerBrief())
    const realOpenCode = join(outside, "opencode-parent")
    mkdirSync(join(realOpenCode, "agents"), { recursive: true })
    symlinkSync(realOpenCode, join(parentProject, ".opencode"))
    const linkedParent = runInstaller(parentProject, "--custom", role)
    assert.notEqual(linkedParent.status, 0, "symlinked .opencode parent must be refused")
    assert.equal(existsSync(join(realOpenCode, "agents", `${role}.md`)), false)

    const targetProject = makeProject()
    writeBrief(targetProject, role, reviewerBrief())
    mkdirSync(join(targetProject, ".opencode", "agents"), { recursive: true })
    const sentinel = join(outside, "target-sentinel.md")
    writeFileSync(sentinel, "# sentinel\n", "utf8")
    symlinkSync(sentinel, join(targetProject, ".opencode", "agents", `${role}.md`))
    const linkedTarget = runInstaller(targetProject, "--custom", role)
    assert.notEqual(linkedTarget.status, 0, "symlinked target agent file must be refused")
    assert.equal(readFileSync(sentinel, "utf8"), "# sentinel\n")
  })

  it("rejects catalog, built-in, and hidden system role names without touching their files", () => {
    const project = makeProject()
    const catalog = runInstaller(project, "--roles", "executor")
    assert.equal(catalog.status, 0, `catalog generation failed: ${catalog.stderr || catalog.stdout}`)
    const catalogBefore = readFixtureFile(project, join(".opencode", "agents", "executor.md"))

    for (const role of ["executor", "plan", "title"]) {
      writeBrief(project, role, reviewerBrief({ role }))
      const result = runInstaller(project, "--custom", role)
      assert.notEqual(result.status, 0, `reserved role "${role}" must be rejected`)
    }

    assert.equal(readFixtureFile(project, join(".opencode", "agents", "executor.md")), catalogBefore)
  })

  it("refuses to overwrite a hand-authored agent file", () => {
    const project = makeProject()
    const role = "pg-migration-reviewer"
    writeBrief(project, role, reviewerBrief())
    const handAuthored = writeFixtureFile(project, join(".opencode", "agents", `${role}.md`), "# mine\n")

    const result = runInstaller(project, "--custom", role)

    assert.notEqual(result.status, 0)
    assert.equal(readFileSync(handAuthored, "utf8"), "# mine\n")
  })
})

describe("routing overrides (ST-9, ST-10, ST-11)", () => {
  it("lets routing policy override the brief reasoning", () => {
    const project = makeProject()
    const role = "pg-migration-reviewer"
    writeBrief(project, role, reviewerBrief({ reasoning: "high" }))
    writeFixtureFile(
      project,
      join("codeops", "codeops.json"),
      JSON.stringify({ routing: { roles: { [role]: { reasoning: "medium" } } } }),
    )

    const result = runInstaller(project, "--custom", role)

    assert.equal(result.status, 0, `installer failed: ${result.stderr || result.stdout}`)
    assert.match(frontmatterBlock(readFixtureFile(project, join(".opencode", "agents", `${role}.md`))), /^reasoningEffort: medium$/m)
  })

  it("clamps permissions: read-only executor, reviewer stays read-only under workspace-write", () => {
    const executorProject = makeProject()
    const executorRole = "pg-migration-executor"
    writeBrief(executorProject, executorRole, executorBrief())
    writeFixtureFile(
      executorProject,
      join("codeops", "codeops.json"),
      JSON.stringify({ routing: { roles: { [executorRole]: { sandbox: "read-only" } } } }),
    )
    const executorResult = runInstaller(executorProject, "--custom", executorRole)
    assert.equal(executorResult.status, 0, `installer failed: ${executorResult.stderr || executorResult.stdout}`)
    const executorFrontmatter = frontmatterBlock(
      readFixtureFile(executorProject, join(".opencode", "agents", `${executorRole}.md`)),
    )
    assert.match(executorFrontmatter, /^ {2}edit: deny$/m)
    assert.match(executorFrontmatter, /^ {2}bash: deny$/m)

    const reviewerProject = makeProject()
    const reviewerRole = "pg-migration-reviewer"
    writeBrief(reviewerProject, reviewerRole, reviewerBrief())
    writeFixtureFile(
      reviewerProject,
      join("codeops", "codeops.json"),
      JSON.stringify({ routing: { roles: { [reviewerRole]: { sandbox: "workspace-write" } } } }),
    )
    const reviewerResult = runInstaller(reviewerProject, "--custom", reviewerRole)
    assert.equal(reviewerResult.status, 0, `installer failed: ${reviewerResult.stderr || reviewerResult.stdout}`)
    const reviewerFrontmatter = frontmatterBlock(
      readFixtureFile(reviewerProject, join(".opencode", "agents", `${reviewerRole}.md`)),
    )
    assert.match(reviewerFrontmatter, /^ {2}edit: deny$/m, "reviewer edit permission must be clamped to deny")
  })

  it("emits a model line only when routing policy pins one", () => {
    const pinnedProject = makeProject()
    const role = "pg-migration-reviewer"
    writeBrief(pinnedProject, role, reviewerBrief())
    writeFixtureFile(
      pinnedProject,
      join("codeops", "codeops.json"),
      JSON.stringify({ routing: { roles: { [role]: { model: "provider/model-x" } } } }),
    )
    const pinned = runInstaller(pinnedProject, "--custom", role)
    assert.equal(pinned.status, 0, `installer failed: ${pinned.stderr || pinned.stdout}`)
    assert.match(
      frontmatterBlock(readFixtureFile(pinnedProject, join(".opencode", "agents", `${role}.md`))),
      /^model: "provider\/model-x"$/m,
    )

    const unpinnedProject = makeProject()
    writeBrief(unpinnedProject, role, reviewerBrief())
    const unpinned = runInstaller(unpinnedProject, "--custom", role)
    assert.equal(unpinned.status, 0, `installer failed: ${unpinned.stderr || unpinned.stdout}`)
    assert.doesNotMatch(
      frontmatterBlock(readFixtureFile(unpinnedProject, join(".opencode", "agents", `${role}.md`))),
      /^model:/m,
    )
  })

  it("rejects routing reasoning, effort, or sandbox values outside their enums", () => {
    const role = "pg-migration-reviewer"
    for (const [key, value] of [
      ["reasoning", "max\ninjected: true"],
      ["effort", "high\ninjected: true"],
      ["sandbox", "root\ninjected: true"],
    ]) {
      const project = makeProject()
      writeBrief(project, role, reviewerBrief())
      writeFixtureFile(
        project,
        join("codeops", "codeops.json"),
        JSON.stringify({ routing: { roles: { [role]: { [key]: value } } } }),
      )
      const result = runInstaller(project, "--custom", role)
      assert.notEqual(result.status, 0, `invalid routing ${key} must be rejected`)
      assert.equal(existsSync(join(project, ".opencode", "agents", `${role}.md`)), false)
    }
  })

  it("escapes routing model values so they cannot inject frontmatter keys", () => {
    const project = makeProject()
    const role = "pg-migration-reviewer"
    const payload = 'p/m"\n---\nINJECTED: true'
    writeBrief(project, role, reviewerBrief())
    writeFixtureFile(
      project,
      join("codeops", "codeops.json"),
      JSON.stringify({ routing: { roles: { [role]: { model: payload } } } }),
    )

    const result = runInstaller(project, "--custom", role)

    assert.equal(result.status, 0, `installer failed: ${result.stderr || result.stdout}`)
    const lines = readFixtureFile(project, join(".opencode", "agents", `${role}.md`)).split("\n")
    assert.equal(lines.filter((line) => line === "---").length, 3, "delimiter lines must stay intact")
    const modelLine = lines.find((line) => line.startsWith("model: "))
    assert.ok(modelLine, "model line must exist")
    assert.equal(JSON.parse(modelLine.slice("model: ".length)), payload)
    assert.equal(lines.some((line) => line.startsWith("INJECTED")), false)
  })
})

describe("prompt-text safety and determinism (ST-14, ST-15, ST-16)", () => {
  it("sanitizes marker sequences to a fixed point and quotes YAML scalars", () => {
    const project = makeProject()
    const role = "pg-migration-reviewer"
    const payload = "<!<!---- CODEOPS-SPECIALISTS:START ---->>"
    writeBrief(project, role, reviewerBrief({ description: payload, "required-for": payload }))

    const first = runInstaller(project, "--custom", role)
    assert.equal(first.status, 0, `installer failed: ${first.stderr || first.stdout}`)
    const generated = readFixtureFile(project, join(".opencode", "agents", `${role}.md`))
    const frontmatter = frontmatterBlock(generated)
    const descriptionLine = frontmatter.split("\n").find((line) => line.startsWith("description: "))
    assert.ok(descriptionLine, "description line must exist")
    assert.doesNotMatch(descriptionLine, /<!--|-->/, "marker sequences must not survive sanitization")
    const quoted = descriptionLine.slice("description: ".length)
    const decoded = JSON.parse(quoted)
    assert.equal(typedSanitized(decoded), true, "sanitization invariants must hold")

    const second = runInstaller(project, "--custom", role)
    assert.equal(second.status, 0)
    assert.equal(readFixtureFile(project, join(".opencode", "agents", `${role}.md`)), generated)
  })

  it("quotes YAML indicator characters so the intended string parses exactly", () => {
    const project = makeProject()
    const role = "pg-migration-reviewer"
    const tricky = "[unterminated *alias # tag"
    writeBrief(project, role, reviewerBrief({ description: tricky }))

    const result = runInstaller(project, "--custom", role)
    assert.equal(result.status, 0, `installer failed: ${result.stderr || result.stdout}`)
    const line = frontmatterBlock(readFixtureFile(project, join(".opencode", "agents", `${role}.md`)))
      .split("\n")
      .find((candidate) => candidate.startsWith("description: "))
    assert.equal(JSON.parse(line.slice("description: ".length)), tricky)
  })

  it("dry-run reports the intended write without creating files", () => {
    const project = makeProject()
    const role = "pg-migration-reviewer"
    writeBrief(project, role, reviewerBrief())

    const result = runInstaller(project, "--dry-run", "--custom", role)

    assert.equal(result.status, 0, `installer failed: ${result.stderr || result.stdout}`)
    assert.match(result.stdout, new RegExp(role))
    assert.equal(existsSync(join(project, ".opencode", "agents", `${role}.md`)), false)
  })

  it("is idempotent: a second run leaves the generated file byte-identical", () => {
    const project = makeProject()
    const role = "pg-migration-reviewer"
    writeBrief(project, role, reviewerBrief())

    const first = runInstaller(project, "--custom", role)
    assert.equal(first.status, 0, `installer failed: ${first.stderr || first.stdout}`)
    const firstBytes = readFixtureFile(project, join(".opencode", "agents", `${role}.md`))
    const second = runInstaller(project, "--custom", role)
    assert.equal(second.status, 0, `installer failed: ${second.stderr || second.stdout}`)
    assert.equal(readFixtureFile(project, join(".opencode", "agents", `${role}.md`)), firstBytes)
  })
})

describe("catalog regression guard (ST-42)", () => {
  it("regenerates the executor catalog role byte-identically to the committed golden", () => {
    const project = makeProject()

    const result = runInstaller(project, "--roles", "executor")

    assert.equal(result.status, 0, `installer failed: ${result.stderr || result.stdout}`)
    const generated = readFixtureFile(project, join(".opencode", "agents", "executor.md"))
    const golden = readFileSync(join(ROOT, "scripts", "fixtures", "catalog-executor.golden.md"), "utf8")
    assert.equal(generated, golden)
  })
})

describe("--check states (ST-17 … ST-21)", () => {
  it("reports missing custom agents and orphans while catalog agents stay clean", () => {
    const project = makeProject()
    generateCatalogAgents(project)
    writeBrief(project, "missing-role", reviewerBrief({ role: "missing-role" }))
    generateSpecialist(project, "orphan-role")
    rmSync(join(project, "codeops", "specialists", "orphan-role.md"))

    const result = runInstaller(project, "--check")

    assert.notEqual(result.status, 0)
    assert.match(result.stdout, /MISSING: missing-role/)
    assert.match(result.stdout, /ORPHAN: orphan-role/)
    assert.doesNotMatch(result.stdout, /MISSING:.*executor/)
  })

  it("reports a stale agent when the brief changed after generation", () => {
    const project = makeProject()
    generateCatalogAgents(project)
    generateSpecialist(project, "pg-migration-reviewer")
    writeBrief(
      project,
      "pg-migration-reviewer",
      reviewerBrief({ role: "pg-migration-reviewer", description: "Changed after generation." }),
    )

    const result = runInstaller(project, "--check")

    assert.notEqual(result.status, 0)
    assert.match(result.stdout, /STALE: pg-migration-reviewer/)
  })

  it("reports an invalid brief with its reason", () => {
    const project = makeProject()
    generateCatalogAgents(project)
    writeBrief(project, "bad-role", reviewerBrief({ role: "bad-role", kind: "auditor" }))

    const result = runInstaller(project, "--check")

    assert.notEqual(result.status, 0)
    assert.match(result.stdout, /INVALID: bad-role/)
  })

  it("reports hand-authored collisions for a brief without a generated agent", () => {
    const project = makeProject()
    generateCatalogAgents(project)
    writeBrief(project, "pg-migration-reviewer", reviewerBrief())
    writeFixtureFile(project, join(".opencode", "agents", "pg-migration-reviewer.md"), "# mine\n")

    const result = runInstaller(project, "--check")

    assert.notEqual(result.status, 0)
    assert.match(result.stdout, /HAND-AUTHORED: pg-migration-reviewer/)
  })

  it("reports clean with default and custom counts", () => {
    const project = makeProject()
    generateCatalogAgents(project)
    generateSpecialist(project, "pg-migration-reviewer")

    const result = runInstaller(project, "--check")

    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.match(result.stdout, new RegExp(`OK: ${ALL_CATALOG_ROLES} default, 1 custom`))
  })

  it("reports AGENTS.md absent, block missing, and block stale", () => {
    const missingFileProject = makeProject()
    generateCatalogAgents(missingFileProject)
    generateSpecialist(missingFileProject, "pg-migration-reviewer")
    rmSync(join(missingFileProject, "AGENTS.md"))

    const missingFile = runInstaller(missingFileProject, "--check")
    assert.notEqual(missingFile.status, 0)
    assert.match(missingFile.stdout, /AGENTS\.md MISSING \(file\)/)

    const missingBlockProject = makeProject()
    generateCatalogAgents(missingBlockProject)
    generateSpecialist(missingBlockProject, "pg-migration-reviewer")
    writeFixtureFile(missingBlockProject, "AGENTS.md", "# Project\n")

    const missingBlock = runInstaller(missingBlockProject, "--check")
    assert.notEqual(missingBlock.status, 0)
    assert.match(missingBlock.stdout, /AGENTS\.md MISSING \(block\)/)

    const staleBlockProject = makeProject()
    generateCatalogAgents(staleBlockProject)
    generateSpecialist(staleBlockProject, "pg-migration-reviewer")
    writeBrief(
      staleBlockProject,
      "pg-migration-reviewer",
      reviewerBrief({ role: "pg-migration-reviewer", description: "Changed." }),
    )
    const refreshed = runInstaller(staleBlockProject, "--custom", "pg-migration-reviewer")
    assert.equal(refreshed.status, 0, refreshed.stderr)

    const staleBlock = runInstaller(staleBlockProject, "--check")
    assert.notEqual(staleBlock.status, 0)
    assert.match(staleBlock.stdout, /AGENTS\.md STALE/)
    assert.doesNotMatch(staleBlock.stdout, /STALE: pg-migration-reviewer/)
  })

  it("reports invalid-brief agents as INVALID, never as orphans", () => {
    const project = makeProject()
    generateCatalogAgents(project)
    generateSpecialist(project, "pg-migration-reviewer")
    writeBrief(project, "pg-migration-reviewer", reviewerBrief({ role: "pg-migration-reviewer", kind: "auditor" }))

    const result = runInstaller(project, "--check")

    assert.notEqual(result.status, 0)
    assert.match(result.stdout, /INVALID: pg-migration-reviewer/)
    assert.doesNotMatch(result.stdout, /ORPHAN: pg-migration-reviewer/)
  })

  it("reports unreadable and symlinked targets as states instead of crashing", () => {
    const binaryProject = makeProject()
    generateCatalogAgents(binaryProject)
    writeBrief(binaryProject, "pg-migration-reviewer", reviewerBrief())
    writeFixtureFile(
      binaryProject,
      join(".opencode", "agents", "pg-migration-reviewer.md"),
      Buffer.from([0xff, 0xfe, 0x00, 0x01]),
    )

    const binary = runInstaller(binaryProject, "--check")
    assert.notEqual(binary.status, 0)
    assert.doesNotMatch(binary.stderr, /Traceback/)
    assert.match(binary.stdout, /HAND-AUTHORED: pg-migration-reviewer|STALE: pg-migration-reviewer/)

    const symlinkProject = makeProject()
    const outside = makeProject()
    generateCatalogAgents(symlinkProject)
    generateSpecialist(symlinkProject, "pg-migration-reviewer")
    const outsideAgents = writeFixtureFile(outside, "AGENTS.md", "# outside\n")
    rmSync(join(symlinkProject, "AGENTS.md"))
    symlinkSync(outsideAgents, join(symlinkProject, "AGENTS.md"))

    const symlinked = runInstaller(symlinkProject, "--check")
    assert.notEqual(symlinked.status, 0)
    assert.match(symlinked.stdout, /AGENTS\.md STALE/)
    assert.equal(readFileSync(outsideAgents, "utf8"), "# outside\n")
  })
})

describe("removal (ST-22 … ST-24, ST-40)", () => {
  it("prints the exact files without deleting them when --yes is absent", () => {
    const project = makeProject()
    generateSpecialist(project, "pg-migration-reviewer")

    const result = runInstaller(project, "--remove-custom", "pg-migration-reviewer")

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /pg-migration-reviewer\.md/)
    assert.match(result.stdout, /codeops\/specialists\/pg-migration-reviewer\.md/)
    assert.equal(existsSync(join(project, ".opencode", "agents", "pg-migration-reviewer.md")), true)
    assert.equal(existsSync(join(project, "codeops", "specialists", "pg-migration-reviewer.md")), true)
  })

  it("deletes agent and brief with --yes and removes the index entry", () => {
    const project = makeProject()
    generateSpecialist(project, "pg-migration-reviewer")

    const result = runInstaller(project, "--remove-custom", "pg-migration-reviewer", "--yes")

    assert.equal(result.status, 0, result.stderr)
    assert.equal(existsSync(join(project, ".opencode", "agents", "pg-migration-reviewer.md")), false)
    assert.equal(existsSync(join(project, "codeops", "specialists", "pg-migration-reviewer.md")), false)
    assert.doesNotMatch(readFixtureFile(project, "AGENTS.md"), /pg-migration-reviewer/)
  })

  it("refuses catalog, built-in, hand-authored, and non-specialist-template targets", () => {
    const project = makeProject()
    generateCatalogAgents(project)
    const catalogBefore = readFixtureFile(project, join(".opencode", "agents", "executor.md"))

    const catalog = runInstaller(project, "--remove-custom", "executor", "--yes")
    assert.notEqual(catalog.status, 0)
    assert.equal(readFixtureFile(project, join(".opencode", "agents", "executor.md")), catalogBefore)

    const builtin = runInstaller(project, "--remove-custom", "plan", "--yes")
    assert.notEqual(builtin.status, 0)

    writeBrief(project, "hand-role", reviewerBrief({ role: "hand-role" }))
    const handFile = writeFixtureFile(project, join(".opencode", "agents", "hand-role.md"), "# mine\n")
    const hand = runInstaller(project, "--remove-custom", "hand-role", "--yes")
    assert.notEqual(hand.status, 0)
    assert.equal(readFileSync(handFile, "utf8"), "# mine\n")

    writeBrief(project, "foreign-role", reviewerBrief({ role: "foreign-role" }))
    writeFixtureFile(
      project,
      join(".opencode", "agents", "foreign-role.md"),
      "# Generated by CodeOps install_agents.py\n# Role: foreign-role | Template: plan-task-executor\n---\ndescription: foreign\nmode: subagent\n---\n",
    )
    const foreign = runInstaller(project, "--remove-custom", "foreign-role", "--yes")
    assert.notEqual(foreign.status, 0)
    assert.equal(existsSync(join(project, ".opencode", "agents", "foreign-role.md")), true)
  })

  it("dry-run wins over --yes and deletes nothing", () => {
    const project = makeProject()
    generateSpecialist(project, "pg-migration-reviewer")

    const result = runInstaller(project, "--dry-run", "--remove-custom", "pg-migration-reviewer", "--yes")

    assert.equal(result.status, 0, result.stderr)
    assert.equal(existsSync(join(project, ".opencode", "agents", "pg-migration-reviewer.md")), true)
    assert.equal(existsSync(join(project, "codeops", "specialists", "pg-migration-reviewer.md")), true)
  })

  it("aborts before deleting when the index is malformed", () => {
    const project = makeProject()
    generateSpecialist(project, "pg-migration-reviewer")
    const agentsMd = readFixtureFile(project, "AGENTS.md")
    writeFixtureFile(project, "AGENTS.md", `${agentsMd}${START_MARKER}\n`)

    const result = runInstaller(project, "--remove-custom", "pg-migration-reviewer", "--yes")

    assert.notEqual(result.status, 0)
    assert.equal(existsSync(join(project, ".opencode", "agents", "pg-migration-reviewer.md")), true)
    assert.equal(existsSync(join(project, "codeops", "specialists", "pg-migration-reviewer.md")), true)
  })

  it("refuses to delete through symlinked parent directories", () => {
    const role = "pg-migration-reviewer"

    const agentsLinkProject = makeProject()
    const agentsOutside = makeProject()
    writeBrief(agentsLinkProject, role, reviewerBrief())
    mkdirSync(join(agentsOutside, "agents"), { recursive: true })
    const outsideAgent = writeFixtureFile(agentsOutside, join("agents", `${role}.md`), markerAgent(role))
    mkdirSync(join(agentsLinkProject, ".opencode"), { recursive: true })
    symlinkSync(join(agentsOutside, "agents"), join(agentsLinkProject, ".opencode", "agents"))

    const agentsLinked = runInstaller(agentsLinkProject, "--remove-custom", role, "--yes")
    assert.notEqual(agentsLinked.status, 0, "symlinked agents directory must be refused")
    assert.equal(readFileSync(outsideAgent, "utf8"), markerAgent(role))
    assert.equal(existsSync(join(agentsLinkProject, "codeops", "specialists", `${role}.md`)), true)

    const specialistsLinkProject = makeProject()
    const specialistsOutside = makeProject()
    writeFixtureFile(specialistsLinkProject, join(".opencode", "agents", `${role}.md`), markerAgent(role))
    const outsideBrief = writeFixtureFile(specialistsOutside, join("specialists", `${role}.md`), reviewerBrief())
    mkdirSync(join(specialistsLinkProject, "codeops"), { recursive: true })
    symlinkSync(join(specialistsOutside, "specialists"), join(specialistsLinkProject, "codeops", "specialists"))

    const specialistsLinked = runInstaller(specialistsLinkProject, "--remove-custom", role, "--yes")
    assert.notEqual(specialistsLinked.status, 0, "symlinked specialists directory must be refused")
    assert.equal(existsSync(outsideBrief), true)
    assert.equal(existsSync(join(specialistsLinkProject, ".opencode", "agents", `${role}.md`)), true)

    const codeopsLinkProject = makeProject()
    const codeopsOutside = makeProject()
    writeFixtureFile(codeopsLinkProject, join(".opencode", "agents", `${role}.md`), markerAgent(role))
    const outsideCodeopsBrief = writeFixtureFile(codeopsOutside, join("specialists", `${role}.md`), reviewerBrief())
    symlinkSync(codeopsOutside, join(codeopsLinkProject, "codeops"))

    const codeopsLinked = runInstaller(codeopsLinkProject, "--remove-custom", role, "--yes")
    assert.notEqual(codeopsLinked.status, 0, "symlinked codeops directory must be refused")
    assert.equal(existsSync(outsideCodeopsBrief), true)
    assert.equal(existsSync(join(codeopsLinkProject, ".opencode", "agents", `${role}.md`)), true)
  })
})

describe("AGENTS.md synchronization (ST-25 … ST-29, ST-36 … ST-41)", () => {
  it("appends the block at the end without touching existing text", () => {
    const project = makeProject()
    writeFixtureFile(project, "AGENTS.md", "# Project rules\n")
    writeBrief(project, "pg-migration-reviewer", reviewerBrief())

    const result = runInstaller(project, "--sync-agents-md")

    assert.equal(result.status, 0, result.stderr)
    const content = readFixtureFile(project, "AGENTS.md")
    assert.ok(content.startsWith("# Project rules\n\n"), "existing text stays first")
    assert.match(content, /<!-- CODEOPS-SPECIALISTS:START -->/)
    assert.match(content, /`pg-migration-reviewer`/)
    assert.match(content, /Required for: any phase changing db\/migrations\/\*\*/)
    assert.match(content, /<!-- CODEOPS-SPECIALISTS:END -->\n$/)
  })

  it("replaces only the block content when briefs change", () => {
    const project = makeProject()
    writeFixtureFile(project, "AGENTS.md", "# Project rules\n")
    writeBrief(project, "pg-migration-reviewer", reviewerBrief())
    runInstaller(project, "--sync-agents-md")
    const before = readFixtureFile(project, "AGENTS.md")
    const beforePrefix = before.slice(0, before.indexOf(START_MARKER))
    const beforeSuffix = before.slice(before.indexOf(END_MARKER) + END_MARKER.length)

    writeBrief(
      project,
      "pg-migration-reviewer",
      reviewerBrief({ role: "pg-migration-reviewer", description: "Updated description." }),
    )
    const result = runInstaller(project, "--sync-agents-md")

    assert.equal(result.status, 0, result.stderr)
    const after = readFixtureFile(project, "AGENTS.md")
    assert.ok(after.startsWith(beforePrefix), "text before START must be byte-identical")
    assert.ok(after.endsWith(beforeSuffix), "text after END must be byte-identical")
    assert.match(after, /Updated description\./)
  })

  it("removes the block and one adjacent blank line when no briefs remain", () => {
    const project = makeProject()
    writeFixtureFile(project, "AGENTS.md", "# Project rules\n")
    generateSpecialist(project, "pg-migration-reviewer")
    rmSync(join(project, "codeops", "specialists", "pg-migration-reviewer.md"))
    rmSync(join(project, ".opencode", "agents", "pg-migration-reviewer.md"))

    const result = runInstaller(project, "--sync-agents-md")

    assert.equal(result.status, 0, result.stderr)
    assert.equal(readFixtureFile(project, "AGENTS.md"), "# Project rules\n")
  })

  it("refuses malformed marker layouts without touching the file", () => {
    const cases = [
      `# T\n${START_MARKER}\n- one\n`,
      `# T\n${START_MARKER}\n${START_MARKER}\n${END_MARKER}\n`,
      `# T\n${END_MARKER}\n${START_MARKER}\n`,
    ]
    for (const content of cases) {
      const project = makeProject()
      writeFixtureFile(project, "AGENTS.md", content)
      writeBrief(project, "pg-migration-reviewer", reviewerBrief())

      const result = runInstaller(project, "--sync-agents-md")

      assert.notEqual(result.status, 0, `malformed layout must be refused: ${content}`)
      assert.equal(readFixtureFile(project, "AGENTS.md"), content)
    }
  })

  it("is idempotent across repeated syncs", () => {
    const project = makeProject()
    writeFixtureFile(project, "AGENTS.md", "# Project rules\n")
    writeBrief(project, "pg-migration-reviewer", reviewerBrief())

    const first = runInstaller(project, "--sync-agents-md")
    assert.equal(first.status, 0, first.stderr)
    const afterFirst = readFixtureFile(project, "AGENTS.md")
    const second = runInstaller(project, "--sync-agents-md")
    assert.equal(second.status, 0, second.stderr)
    assert.equal(readFixtureFile(project, "AGENTS.md"), afterFirst)
  })

  it("creates AGENTS.md when absent and writes the block into an empty file", () => {
    const absentProject = makeProject()
    writeBrief(absentProject, "pg-migration-reviewer", reviewerBrief())

    const absent = runInstaller(absentProject, "--sync-agents-md")

    assert.equal(absent.status, 0, absent.stderr)
    const created = readFixtureFile(absentProject, "AGENTS.md")
    assert.ok(created.startsWith(START_MARKER))
    assert.ok(created.endsWith(`${END_MARKER}\n`))

    const emptyProject = makeProject()
    writeFixtureFile(emptyProject, "AGENTS.md", "")
    writeBrief(emptyProject, "pg-migration-reviewer", reviewerBrief())

    const empty = runInstaller(emptyProject, "--sync-agents-md")

    assert.equal(empty.status, 0, empty.stderr)
    assert.ok(readFixtureFile(emptyProject, "AGENTS.md").startsWith(START_MARKER))
  })

  it("handles a missing trailing newline and CRLF files", () => {
    const noNewlineProject = makeProject()
    writeFixtureFile(noNewlineProject, "AGENTS.md", "# Project rules")
    writeBrief(noNewlineProject, "pg-migration-reviewer", reviewerBrief())

    const noNewline = runInstaller(noNewlineProject, "--sync-agents-md")

    assert.equal(noNewline.status, 0, noNewline.stderr)
    const appended = readFixtureFile(noNewlineProject, "AGENTS.md")
    assert.ok(appended.startsWith("# Project rules\n\n"), "separator blank line after content")

    const crlfProject = makeProject()
    writeFixtureFile(crlfProject, "AGENTS.md", "# Project rules\r\n")
    writeBrief(crlfProject, "pg-migration-reviewer", reviewerBrief())

    const crlf = runInstaller(crlfProject, "--sync-agents-md")

    assert.equal(crlf.status, 0, crlf.stderr)
    const crlfContent = readFixtureFile(crlfProject, "AGENTS.md")
    assert.match(crlfContent, /# Project rules\r\n\r\n<!-- CODEOPS-SPECIALISTS:START -->/)
    assert.match(crlfContent, /<!-- CODEOPS-SPECIALISTS:END -->\r\n$/)

    const mixedProject = makeProject()
    writeFixtureFile(mixedProject, "AGENTS.md", "# A\r\n# B\r\n# C\n")
    writeBrief(mixedProject, "pg-migration-reviewer", reviewerBrief())

    const mixed = runInstaller(mixedProject, "--sync-agents-md")

    assert.equal(mixed.status, 0, mixed.stderr)
    assert.match(
      readFixtureFile(mixedProject, "AGENTS.md"),
      /<!-- CODEOPS-SPECIALISTS:START -->\r\n/,
      "dominant line ending (2 CRLF vs 1 LF) must win",
    )
  })

  it("does not double the blank-line separator when the file already ends with one", () => {
    const project = makeProject()
    writeFixtureFile(project, "AGENTS.md", "# Project rules\n\n")
    writeBrief(project, "pg-migration-reviewer", reviewerBrief())

    const result = runInstaller(project, "--sync-agents-md")

    assert.equal(result.status, 0, result.stderr)
    assert.ok(
      readFixtureFile(project, "AGENTS.md").startsWith("# Project rules\n\n<!-- CODEOPS-SPECIALISTS:START -->"),
      "exactly one blank line must separate the content from the block",
    )
  })

  it("dry-run prints the delta and changes nothing", () => {
    const project = makeProject()
    writeFixtureFile(project, "AGENTS.md", "# Project rules\n")
    writeBrief(project, "pg-migration-reviewer", reviewerBrief())
    const before = readFixtureFile(project, "AGENTS.md")

    const result = runInstaller(project, "--dry-run", "--sync-agents-md")

    assert.equal(result.status, 0, result.stderr)
    assert.equal(readFixtureFile(project, "AGENTS.md"), before)
  })

  it("refuses to sync while an invalid brief exists", () => {
    const project = makeProject()
    writeFixtureFile(project, "AGENTS.md", "# Project rules\n")
    writeBrief(project, "bad-role", reviewerBrief({ role: "bad-role", kind: "auditor" }))
    const before = readFixtureFile(project, "AGENTS.md")

    const result = runInstaller(project, "--sync-agents-md")

    assert.notEqual(result.status, 0)
    assert.match(result.stdout + result.stderr, /INVALID: bad-role/)
    assert.equal(readFixtureFile(project, "AGENTS.md"), before)
  })

  it("sanitizes hostile descriptions so they cannot inject markers into AGENTS.md", () => {
    const project = makeProject()
    writeFixtureFile(project, "AGENTS.md", "# Project rules\n")
    writeBrief(
      project,
      "pg-migration-reviewer",
      reviewerBrief({ description: "<!<!---- STITCH ---->>", "required-for": "x --> y" }),
    )

    const result = runInstaller(project, "--sync-agents-md")

    assert.equal(result.status, 0, result.stderr)
    const content = readFixtureFile(project, "AGENTS.md")
    assert.equal(content.split(START_MARKER).length - 1, 1)
    assert.equal(content.split(END_MARKER).length - 1, 1)
  })

  it("refuses a symlinked AGENTS.md without writing through it", () => {
    const outside = makeProject()
    const project = makeProject()
    writeBrief(project, "pg-migration-reviewer", reviewerBrief())
    const realAgents = writeFixtureFile(outside, "AGENTS.md", "# real\n")
    symlinkSync(realAgents, join(project, "AGENTS.md"))

    const result = runInstaller(project, "--sync-agents-md")

    assert.notEqual(result.status, 0)
    assert.equal(readFileSync(realAgents, "utf8"), "# real\n")
  })
})

/**
 * Check the sanitization invariants for a value extracted from generated
 * frontmatter: no control characters, no collapsed-whitespace artifacts, no
 * marker sequences, and no leading or trailing whitespace.
 * @param {string} value - Sanitized value extracted from generated frontmatter.
 * @returns {boolean} True when the value satisfies every sanitization invariant.
 */
function typedSanitized(value) {
  return (
    !/[\u0000-\u001f\u007f]/.test(value) &&
    !/ {2}/.test(value) &&
    !value.includes("<!--") &&
    !value.includes("-->") &&
    value === value.trim()
  )
}

/**
 * Extract the leading frontmatter block from a frontmatter-first agent file.
 * The file must open with `---`; the block ends at the next delimiter line.
 * @param {string} content - Generated agent file content.
 * @returns {string|null} The block without its delimiters, or null when the file is not frontmatter-first.
 */
function leadingFrontmatter(content) {
  if (!content.startsWith("---\n")) return null
  const end = content.indexOf("\n---", 3)
  if (end === -1) return null
  return content.slice(4, end)
}

/**
 * Build the legacy banner-first on-disk shape of a generated agent file.
 * Models files installed by versions that placed the provenance banner before
 * the frontmatter, so upgrade recognition can be tested independently.
 * @param {string} role - Role name recorded in the ownership header.
 * @param {string} template - Template name recorded in the header.
 * @returns {string} Legacy-layout generated-agent content.
 */
function legacyBannerAgent(role, template) {
  return [
    "# Generated by CodeOps install_agents.py",
    `# Role: ${role} | Template: ${template}`,
    "# Do not edit this file manually — regenerate with: install_agents.py",
    "---",
    'description: "stale description"',
    "mode: subagent",
    "hidden: true",
    "---",
    "",
    "body",
    "",
  ].join("\n")
}

describe("generated agent file layout", () => {
  it("starts catalog and specialist files with the frontmatter delimiter", () => {
    const project = makeProject()
    const catalog = runInstaller(project, "--roles", "executor")
    assert.equal(catalog.status, 0, `installer failed: ${catalog.stderr || catalog.stdout}`)

    const catalogContent = readFixtureFile(project, join(".opencode", "agents", "executor.md"))
    assert.equal(catalogContent.split("\n", 1)[0], "---", "catalog agent files must open with ---")

    generateSpecialist(project, "pg-migration-reviewer")
    const specialistContent = readFixtureFile(project, join(".opencode", "agents", "pg-migration-reviewer.md"))
    assert.equal(specialistContent.split("\n", 1)[0], "---", "specialist agent files must open with ---")
  })

  it("keeps the ownership marker, mode, and hidden inside the leading frontmatter block", () => {
    const project = makeProject()
    const catalog = runInstaller(project, "--roles", "explorer")
    assert.equal(catalog.status, 0, `installer failed: ${catalog.stderr || catalog.stdout}`)

    const catalogBlock = leadingFrontmatter(
      readFixtureFile(project, join(".opencode", "agents", "explorer.md")),
    )
    assert.ok(catalogBlock, "catalog agent files must start with a frontmatter block")
    assert.match(catalogBlock, /^# Generated by CodeOps install_agents\.py$/m)
    assert.match(catalogBlock, /^mode: subagent$/m)
    assert.match(catalogBlock, /^hidden: true$/m)

    generateSpecialist(project, "pg-migration-reviewer")
    const specialistBlock = leadingFrontmatter(
      readFixtureFile(project, join(".opencode", "agents", "pg-migration-reviewer.md")),
    )
    assert.ok(specialistBlock, "specialist agent files must start with a frontmatter block")
    assert.match(specialistBlock, /^# Generated by CodeOps install_agents\.py$/m)
    assert.match(specialistBlock, /^mode: subagent$/m)
    assert.match(specialistBlock, /^hidden: false$/m, "the brief's hidden value must be honored")
  })

  it("treats a legacy banner-first catalog file as owned and replaces it on regeneration", () => {
    const project = makeProject()
    writeFixtureFile(
      project,
      join(".opencode", "agents", "executor.md"),
      legacyBannerAgent("executor", "plan-task-executor"),
    )

    const result = runInstaller(project, "--roles", "executor")

    assert.equal(result.status, 0, `installer failed: ${result.stderr || result.stdout}`)
    assert.doesNotMatch(result.stdout, /SKIP \(hand-authored\)/i, "legacy generated files must not be skipped as hand-authored")
    assert.equal(
      readFixtureFile(project, join(".opencode", "agents", "executor.md")).split("\n", 1)[0],
      "---",
      "a legacy catalog file must be replaced with the frontmatter-first layout",
    )
  })

  it("treats a legacy banner-first specialist file as owned and replaces it on --custom", () => {
    const project = makeProject()
    const role = "pg-migration-reviewer"
    writeBrief(project, role, reviewerBrief())
    writeFixtureFile(
      project,
      join(".opencode", "agents", `${role}.md`),
      legacyBannerAgent(role, "domain-specialist-reviewer"),
    )

    const result = runInstaller(project, "--custom", role)

    assert.equal(result.status, 0, `installer failed: ${result.stderr || result.stdout}`)
    assert.equal(
      readFixtureFile(project, join(".opencode", "agents", `${role}.md`)).split("\n", 1)[0],
      "---",
      "a legacy specialist file must be replaced with the frontmatter-first layout",
    )
  })

  it("reports a stale catalog agent when the file does not match the generator output", () => {
    const project = makeProject()
    const generated = runInstaller(project, "--roles", "executor")
    assert.equal(generated.status, 0, `installer failed: ${generated.stderr || generated.stdout}`)
    const current = readFixtureFile(project, join(".opencode", "agents", "executor.md"))
    writeFixtureFile(project, join(".opencode", "agents", "executor.md"), `${current}\n<!-- drift -->\n`)

    const result = runInstaller(project, "--check", "--roles", "executor")

    assert.notEqual(result.status, 0, "check must fail when a catalog agent drifts from the generated output")
    assert.match(result.stdout, /STALE: executor/)
  })
})
