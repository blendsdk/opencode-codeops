/**
 * Specification tests for the CodeOps CLI dispatcher.
 *
 * There is one installation path: `install` (and its alias `update`) installs
 * the skills and the subagents together, `status` reports both, and `uninstall`
 * removes both. The scope is auto-detected or forced with `--project`/
 * `--global`. All filesystem work happens in throwaway temporary directories.
 *
 * @module index.spec.test
 */

import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"

import { dispatch, resolveScope } from "./index.mjs"

/** Temporary directories created by a test, removed after each test. */
const created = []

/** Creates a throwaway directory that is cleaned up after the test. */
function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  created.push(dir)
  return dir
}

afterEach(() => {
  while (created.length > 0) {
    rmSync(created.pop(), { recursive: true, force: true })
  }
  delete process.env.CODEOPS_PLUGIN_ROOT
})

/** Runs a function while capturing console output and the returned exit code. */
async function capture(fn) {
  const lines = []
  const log = console.log
  const error = console.error
  console.log = (...args) => lines.push(args.join(" "))
  console.error = (...args) => lines.push(args.join(" "))
  try {
    return { code: await fn(), output: lines.join("\n") }
  } finally {
    console.log = log
    console.error = error
  }
}

describe("resolveScope", () => {
  it("honours explicit scope flags", () => {
    const cwd = tempDir("codeops-scope-")
    assert.equal(resolveScope({ project: true, global: false }, cwd), "project")
    assert.equal(resolveScope({ project: false, global: true }, cwd), "global")
  })

  it("detects a project when .opencode exists", () => {
    const cwd = tempDir("codeops-scope-")
    mkdirSync(join(cwd, ".opencode"))
    assert.equal(resolveScope({ project: false, global: false }, cwd), "project")
  })

  it("detects a project when codeops/.codeops.yml exists", () => {
    const cwd = tempDir("codeops-scope-")
    mkdirSync(join(cwd, "codeops"))
    writeFileSync(join(cwd, "codeops", ".codeops.yml"), "codeopsLayout: nested\n", "utf-8")
    assert.equal(resolveScope({ project: false, global: false }, cwd), "project")
  })

  it("falls back to global outside a project", () => {
    const cwd = tempDir("codeops-scope-")
    assert.equal(resolveScope({ project: false, global: false }, cwd), "global")
  })
})

describe("dispatch install", () => {
  it("installs skills and agents together in the project scope", async () => {
    const cwd = tempDir("codeops-project-")
    mkdirSync(join(cwd, ".opencode"))

    const { code } = await capture(() => dispatch(["install"], { cwd }))

    assert.equal(code, 0)
    assert.ok(existsSync(join(cwd, ".opencode", "skills", "make-plan", "SKILL.md")))
    assert.ok(existsSync(join(cwd, ".opencode", "agents", "executor.md")))
    assert.ok(existsSync(join(cwd, ".opencode", "skills", ".opencode-codeops.json")))
    assert.ok(existsSync(join(cwd, ".opencode", "agents", ".opencode-codeops.json")))
  })

  it("installs into the global scope when forced, using the injected home", async () => {
    const cwd = tempDir("codeops-cwd-")
    const home = tempDir("codeops-home-")

    const { code } = await capture(() => dispatch(["install", "--global"], { cwd, home }))

    assert.equal(code, 0)
    assert.ok(existsSync(join(home, ".config", "opencode", "skills", "make-plan", "SKILL.md")))
    assert.ok(existsSync(join(home, ".config", "opencode", "agents", "executor.md")))
  })

  it("treats update as an install and replaces managed files", async () => {
    const cwd = tempDir("codeops-project-")
    mkdirSync(join(cwd, ".opencode"))

    await capture(() => dispatch(["install"], { cwd }))
    const { code, output } = await capture(() => dispatch(["update"], { cwd }))

    assert.equal(code, 0)
    assert.match(output, /replace/)
  })

  it("ignores a CODEOPS_PLUGIN_ROOT decoy and uses the package's own skills", async () => {
    const cwd = tempDir("codeops-project-")
    mkdirSync(join(cwd, ".opencode"))

    const decoy = tempDir("codeops-decoy-")
    mkdirSync(join(decoy, "skills", "decoy-skill"), { recursive: true })
    writeFileSync(join(decoy, "skills", "decoy-skill", "SKILL.md"), "# decoy\n", "utf-8")
    mkdirSync(join(decoy, "agents"), { recursive: true })
    writeFileSync(join(decoy, "agents", "decoy.md"), "# decoy\n", "utf-8")
    process.env.CODEOPS_PLUGIN_ROOT = decoy

    await capture(() => dispatch(["install"], { cwd }))

    assert.ok(existsSync(join(cwd, ".opencode", "skills", "make-plan", "SKILL.md")))
    assert.ok(!existsSync(join(cwd, ".opencode", "skills", "decoy-skill")))
    assert.ok(!existsSync(join(cwd, ".opencode", "agents", "decoy.md")))
  })
})

describe("dispatch lifecycle", () => {
  it("reports status and then removes both installs", async () => {
    const cwd = tempDir("codeops-project-")
    mkdirSync(join(cwd, ".opencode"))
    await capture(() => dispatch(["install"], { cwd }))

    const status = await capture(() => dispatch(["status"], { cwd }))
    assert.equal(status.code, 0)
    assert.match(status.output, /installed/)

    const removed = await capture(() => dispatch(["uninstall"], { cwd }))
    assert.equal(removed.code, 0)
    assert.ok(!existsSync(join(cwd, ".opencode", "skills", "make-plan")))
    assert.ok(!existsSync(join(cwd, ".opencode", "agents", "executor.md")))
  })

  it("treats uninstall of a missing install as success", async () => {
    const cwd = tempDir("codeops-project-")
    const { code } = await capture(() => dispatch(["uninstall", "--project"], { cwd }))
    assert.equal(code, 0)
  })
})

describe("dispatch errors", () => {
  it("rejects an unknown command", async () => {
    const { code, output } = await capture(() => dispatch(["frobnicate"]))
    assert.equal(code, 2)
    assert.match(output, /unknown command/)
  })

  it("prints usage for help and no arguments", async () => {
    const help = await capture(() => dispatch(["help"]))
    assert.equal(help.code, 0)
    assert.match(help.output, /CodeOps installer for OpenCode/)
  })

  it("keeps the unified help for a subcommand --help", async () => {
    const help = await capture(() => dispatch(["install", "--help"]))
    assert.equal(help.code, 0)
    assert.match(help.output, /Alias of install/)
    assert.doesNotMatch(help.output, /install-skills/)
  })
})
