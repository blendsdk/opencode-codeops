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
 * Extract the YAML-style frontmatter block from a generated agent file.
 * The block starts after the first `---` line and ends at the next one.
 * @param {string} content - Generated agent file content.
 * @returns {string} The frontmatter block (without the `---` delimiters).
 */
function frontmatterBlock(content) {
  const start = content.indexOf("\n---\n")
  assert.notEqual(start, -1, "generated file must contain a frontmatter block")
  const end = content.indexOf("\n---", start + 5)
  assert.notEqual(end, -1, "generated file frontmatter must be closed")
  return content.slice(start + 5, end)
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
 * Assert that a generated file carries the CodeOps ownership marker first.
 * @param {string} project - Fixture project root.
 * @param {string} role - Generated role.
 */
function assertMarkerFirst(project, role) {
  const content = readFixtureFile(project, join(".opencode", "agents", `${role}.md`))
  assert.equal(content.split("\n", 1)[0], "# Generated by CodeOps install_agents.py")
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
    assertMarkerFirst(project, role)
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
      /^model: provider\/model-x$/m,
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
  it("regenerates the executor catalog role byte-identically to the pre-refactor golden", () => {
    const project = makeProject()

    const result = runInstaller(project, "--roles", "executor")

    assert.equal(result.status, 0, `installer failed: ${result.stderr || result.stdout}`)
    const generated = readFixtureFile(project, join(".opencode", "agents", "executor.md"))
    const golden = readFileSync(join(ROOT, "scripts", "fixtures", "catalog-executor.golden.md"), "utf8")
    assert.equal(generated, golden)
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
