/**
 * Specification tests for the flat-to-nested migration's specialist support.
 *
 * The migration moves `requirements/` and `plans/` into `codeops/features/`,
 * but `codeops/specialists/` is project-level and must stay exactly where it
 * is. An existing `codeops/codeops.json` must never be overwritten: a valid
 * one is preserved byte-for-byte (with a preview warning) and a malformed one
 * refuses the migration before anything moves.
 *
 * Each case builds a real temporary git repository, commits the fixture (the
 * engine refuses a dirty tree), and runs the migration script inside it.
 *
 * @module specialists-migration.spec.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const MIGRATE = join(ROOT, "scripts", "codeops-migrate.sh")

/** Temporary fixture repositories created by this suite; removed on exit. */
const fixtures = []

after(() => {
  for (const dir of fixtures) {
    rmSync(dir, { recursive: true, force: true })
  }
})

/**
 * Write a UTF-8 file inside a fixture, creating parent directories.
 * @param {string} root - Fixture root.
 * @param {string} relativePath - Path relative to the fixture root.
 * @param {string} content - File contents.
 * @returns {string} Absolute path of the written file.
 */
function writeFixtureFile(root, relativePath, content) {
  const path = join(root, relativePath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, "utf8")
  return path
}

/**
 * Run a command and require success.
 * @param {string} command - Executable.
 * @param {string[]} args - Arguments.
 * @param {string} cwd - Working directory.
 * @returns {import("node:child_process").SpawnSyncReturns<string>} Spawn result.
 */
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" })
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed: ${result.stderr}`)
  return result
}

/**
 * Build a committed flat-layout fixture repository with a specialist brief.
 * @param {string} configContent - Content for `codeops/codeops.json`.
 * @returns {string} Absolute path of the fixture repository.
 */
function makeFixture(configContent) {
  const fixture = mkdtempSync(join(tmpdir(), "codeops-migration-spec-"))
  fixtures.push(fixture)
  writeFixtureFile(fixture, "requirements/RD-01.md", "# RD-01\n")
  writeFixtureFile(fixture, "plans/00-roadmap.md", "# Roadmap: demo\n\n> **Feature-Set**: demo\n")
  writeFixtureFile(fixture, "plans/demo-plan/99-execution-plan.md", "# Plan\n")
  writeFixtureFile(
    fixture,
    "codeops/specialists/pg-migration-reviewer.md",
    "---\nrole: pg-migration-reviewer\nkind: reviewer\ndescription: Reviews migrations.\n---\n\nBody\n",
  )
  writeFixtureFile(fixture, "codeops/codeops.json", configContent)
  run("git", ["init", "-q"], fixture)
  run("git", ["add", "-A"], fixture)
  run(
    "git",
    ["-c", "user.email=codeops@example.invalid", "-c", "user.name=CodeOps", "commit", "-qm", "init"],
    fixture,
  )
  return fixture
}

/**
 * Run the migration engine inside a fixture repository.
 * @param {string} fixture - Fixture repository root.
 * @param {...string} args - Migration arguments.
 * @returns {import("node:child_process").SpawnSyncReturns<string>} Spawn result.
 */
function migrate(fixture, ...args) {
  return spawnSync("bash", [MIGRATE, ...args], { cwd: fixture, encoding: "utf8" })
}

describe("ST-33 migration preserves project-level specialists and existing config", () => {
  it("previews preservation in dry-run and moves only requirements and plans on apply", () => {
    const originalConfig = '{\n  "schema": 1,\n  "notes": "keep-me"\n}\n'
    const fixture = makeFixture(originalConfig)

    const dryRun = migrate(fixture, "--dry-run")

    assert.equal(dryRun.status, 0, dryRun.stderr)
    assert.match(dryRun.stdout, /PRESERVE codeops\/codeops\.json/)
    assert.equal(readFileSync(join(fixture, "codeops", "codeops.json"), "utf8"), originalConfig)
    assert.equal(existsSync(join(fixture, "requirements", "RD-01.md")), true)
    assert.equal(existsSync(join(fixture, "codeops", ".codeops.yml")), false)

    const apply = migrate(fixture, "--yes")

    assert.equal(apply.status, 0, apply.stderr)
    assert.equal(
      readFileSync(join(fixture, "codeops", "codeops.json"), "utf8"),
      originalConfig,
      "existing config must be preserved byte-for-byte",
    )
    assert.equal(
      existsSync(join(fixture, "codeops", "features", "demo", "requirements", "RD-01.md")),
      true,
      "requirements moved into the feature",
    )
    assert.equal(
      existsSync(join(fixture, "codeops", "features", "demo", "plans", "demo-plan", "99-execution-plan.md")),
      true,
      "plans moved into the feature",
    )
    assert.equal(
      existsSync(join(fixture, "codeops", "specialists", "pg-migration-reviewer.md")),
      true,
      "project-level specialists stay in place",
    )
    assert.equal(existsSync(join(fixture, "codeops", ".codeops.yml")), true, "marker written")
    assert.match(apply.stdout, /config-preserved/)
  })

  it("refuses a malformed existing config before any move", () => {
    const fixture = makeFixture("{ this is not json\n")

    const dryRun = migrate(fixture, "--dry-run")
    assert.equal(dryRun.status, 1)
    assert.match(dryRun.stderr + dryRun.stdout, /codeops\.json/)

    const apply = migrate(fixture, "--yes")
    assert.equal(apply.status, 1)
    assert.match(apply.stderr + apply.stdout, /codeops\.json/)
    assert.equal(existsSync(join(fixture, "codeops", ".codeops.yml")), false)
    assert.equal(existsSync(join(fixture, "requirements", "RD-01.md")), true, "nothing moved")
  })

  it("refuses a symlinked existing config before any move", () => {
    const fixture = makeFixture('{"schema": 1}\n')
    rmSync(join(fixture, "codeops", "codeops.json"))
    symlinkSync(
      "/tmp/opencode/does-not-exist-config.json",
      join(fixture, "codeops", "codeops.json"),
    )
    run("git", ["add", "-A"], fixture)
    run(
      "git",
      ["-c", "user.email=codeops@example.invalid", "-c", "user.name=CodeOps", "commit", "-qm", "symlink"],
      fixture,
    )

    const apply = migrate(fixture, "--yes")

    assert.equal(apply.status, 1)
    assert.match(apply.stderr + apply.stdout, /codeops\.json/)
    assert.equal(existsSync(join(fixture, "codeops", ".codeops.yml")), false)
    assert.equal(existsSync(join(fixture, "requirements", "RD-01.md")), true, "nothing moved")
  })
})
