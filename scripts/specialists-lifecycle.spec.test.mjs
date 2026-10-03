/**
 * End-to-end lifecycle integration test for project specialists.
 *
 * Walks the full documented lifecycle in one temporary fixture: catalog setup,
 * routing policy, brief, `--custom` generation, `--sync-agents-md`, a clean
 * `--check`, then `--remove-custom --yes` back to the starting state. It proves
 * the modes compose — each step's artifacts are the next step's inputs — which
 * the per-mode specification tests do not cover.
 *
 * @module specialists-lifecycle.spec.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const INSTALLER = join(ROOT, "scripts", "install_agents.py")
const ROLE = "pg-migration-reviewer"

/** Temporary fixtures created by this suite; removed on exit. */
const fixtures = []

after(() => {
  for (const dir of fixtures) {
    rmSync(dir, { recursive: true, force: true })
  }
})

/**
 * Create an empty temporary fixture project.
 * @returns {string} Absolute path of the fixture root.
 */
function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), "codeops-lifecycle-spec-"))
  fixtures.push(dir)
  return dir
}

/**
 * Write a UTF-8 file inside a fixture, creating parent directories.
 * @param {string} project - Fixture root.
 * @param {string} relativePath - Path relative to the fixture root.
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
 * Run the installer against a fixture with the checkout as plugin root.
 * @param {string} project - Fixture root.
 * @param {...string} args - Installer arguments.
 * @returns {import("node:child_process").SpawnSyncReturns<string>} Spawn result.
 */
function runInstaller(project, ...args) {
  return spawnSync("python3", [INSTALLER, "--project", project, ...args], {
    encoding: "utf8",
    env: { ...process.env, CODEOPS_PLUGIN_ROOT: ROOT },
  })
}

describe("specialist lifecycle (brief → generate → sync → check → remove)", () => {
  it("composes every installer mode and returns the project to its starting state", () => {
    const project = makeProject()
    const agentPath = join(project, ".opencode", "agents", `${ROLE}.md`)
    const briefPath = join(project, "codeops", "specialists", `${ROLE}.md`)
    writeFixtureFile(project, "AGENTS.md", "# Project rules\n")
    writeFixtureFile(
      project,
      join("codeops", "specialists", `${ROLE}.md`),
      [
        "---",
        `role: ${ROLE}`,
        "kind: reviewer",
        "description: Reviews PostgreSQL migrations.",
        "required-for: any phase changing db/migrations/**",
        "---",
        "",
        "## Domain checklist",
        "",
        "- Forward-only migrations.",
        "",
      ].join("\n"),
    )
    writeFixtureFile(
      project,
      join("codeops", "codeops.json"),
      JSON.stringify({
        schema: 1,
        routing: { roles: { [ROLE]: { reasoning: "high" } } },
      }),
    )

    const catalog = runInstaller(project)
    assert.equal(catalog.status, 0, catalog.stderr)

    const generated = runInstaller(project, "--custom", ROLE)
    assert.equal(generated.status, 0, generated.stderr || generated.stdout)
    assert.equal(existsSync(agentPath), true)
    assert.match(readFileSync(agentPath, "utf8"), /^reasoningEffort: high$/m)

    const synced = runInstaller(project, "--sync-agents-md")
    assert.equal(synced.status, 0, synced.stderr || synced.stdout)
    const withBlock = readFileSync(join(project, "AGENTS.md"), "utf8")
    assert.ok(withBlock.startsWith("# Project rules\n\n<!-- CODEOPS-SPECIALISTS:START -->"))
    assert.match(withBlock, new RegExp(`\`${ROLE}\``))

    const clean = runInstaller(project, "--check")
    assert.equal(clean.status, 0, clean.stdout + clean.stderr)
    assert.match(clean.stdout, /OK: 12 default, 1 custom/)

    const removed = runInstaller(project, "--remove-custom", ROLE, "--yes")
    assert.equal(removed.status, 0, removed.stderr || removed.stdout)
    assert.equal(existsSync(agentPath), false)
    assert.equal(existsSync(briefPath), false)
    assert.equal(readFileSync(join(project, "AGENTS.md"), "utf8"), "# Project rules\n")
    assert.equal(existsSync(join(project, ".opencode", "agents", "executor.md")), true)

    const finalCheck = runInstaller(project, "--check")
    assert.equal(finalCheck.status, 0, finalCheck.stdout + finalCheck.stderr)
    assert.match(finalCheck.stdout, /OK: 12 default, 0 custom/)
  })
})
