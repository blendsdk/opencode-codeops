/**
 * Specification tests for the Discovery toggle.
 *
 * The toggle must preserve unrelated policy, add or remove the managed
 * AGENTS.md line, refine symlinks, and support a dry run.
 *
 * @module discovery-toggle.spec.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { after, describe, it } from "node:test"

import { DISCOVERY_LINE, toggleDiscovery } from "./discovery-toggle.mjs"

/** Base directory for temporary projects. */
const BASE = process.env.CODEOPS_TMPDIR ?? tmpdir()

/** The script under test. */
const SCRIPT = fileURLToPath(new URL("./discovery-toggle.mjs", import.meta.url))

/** Temporary roots created by the suite. */
const created = []

after(() => {
  for (const directory of created) rmSync(directory, { recursive: true, force: true })
})

/** Create a throwaway project. */
function project({ config, agents } = {}) {
  const root = mkdtempSync(join(BASE, "discovery-toggle-"))
  created.push(root)
  mkdirSync(join(root, "codeops"), { recursive: true })
  writeFileSync(
    join(root, "codeops", "codeops.json"),
    JSON.stringify(
      config ?? {
        schema: 1,
        mode: "strict",
        artifacts: { layout: "nested", root: "codeops" },
        quality: { independentReview: true },
        routing: { roles: { executor: { reasoning: "medium" } } },
        metrics: { enabled: false },
      },
      null,
      2,
    ) + "\n",
  )
  if (agents !== undefined) {
    writeFileSync(join(root, "AGENTS.md"), agents)
  }
  return root
}

/** The default managed AGENTS.md content. */
const AGENTS = `<!-- CODEOPS-PROJECT:START -->
# Project guidance

- Specialist coverage: up to date (2026-10-29)
<!-- CODEOPS-PROJECT:END -->
`

/** Read and parse the project config. */
function readConfig(root) {
  return JSON.parse(readFileSync(join(root, "codeops", "codeops.json"), "utf8"))
}

describe("Discovery toggle", () => {
  it("should enable Discovery, preserve every other key, and add the managed line", () => {
    const root = project({ agents: AGENTS })
    const result = toggleDiscovery({ root, enable: true })
    const config = readConfig(root)
    assert.deepEqual(config.discovery, { enabled: true, chatMaxQuestions: 3 })
    assert.deepEqual(config.quality, { independentReview: true })
    assert.deepEqual(config.routing, { roles: { executor: { reasoning: "medium" } } })
    assert.equal(result.agents, "enabled")
    const agents = readFileSync(join(root, "AGENTS.md"), "utf8")
    assert.ok(agents.includes(DISCOVERY_LINE))
    assert.ok(agents.indexOf(DISCOVERY_LINE) > agents.indexOf("- Specialist coverage:"))
  })

  it("should disable Discovery while keeping chatMaxQuestions and removing the line", () => {
    const root = project({
      config: {
        schema: 1,
        mode: "strict",
        artifacts: { layout: "nested", root: "codeops" },
        discovery: { enabled: true, chatMaxQuestions: 7 },
        quality: { independentReview: true },
      },
      agents: `${AGENTS.replace(
        "- Specialist coverage: up to date (2026-10-29)\n",
        `- Specialist coverage: up to date (2026-10-29)\n${DISCOVERY_LINE}\n`,
      )}`,
    })
    const result = toggleDiscovery({ root, enable: false })
    assert.deepEqual(readConfig(root).discovery, { enabled: false, chatMaxQuestions: 7 })
    assert.equal(result.agents, "disabled")
    assert.equal(readFileSync(join(root, "AGENTS.md"), "utf8").includes(DISCOVERY_LINE), false)
  })

  it("should preview without writing on a dry run", () => {
    const root = project({ agents: AGENTS })
    const before = readFileSync(join(root, "codeops", "codeops.json"), "utf8")
    const result = toggleDiscovery({ root, enable: true, dryRun: true })
    assert.equal(result.dryRun, true)
    assert.equal(result.changed, true)
    assert.equal(result.discovery.enabled, true)
    assert.equal(readFileSync(join(root, "codeops", "codeops.json"), "utf8"), before)
    assert.equal(readFileSync(join(root, "AGENTS.md"), "utf8"), AGENTS)
  })

  it("should update the config when AGENTS.md is missing or has no managed block", () => {
    const missing = project()
    const missingResult = toggleDiscovery({ root: missing, enable: true })
    assert.equal(missingResult.agents, "missing")
    assert.equal(readConfig(missing).discovery.enabled, true)

    const noBlock = project({ agents: "# Notes\n" })
    const noBlockResult = toggleDiscovery({ root: noBlock, enable: true })
    assert.equal(noBlockResult.agents, "block-missing")
    assert.equal(readConfig(noBlock).discovery.enabled, true)
  })

  it("should refuse a symlinked config or malformed policy", () => {
    const root = project()
    const real = join(root, "real.json")
    writeFileSync(real, readFileSync(join(root, "codeops", "codeops.json")))
    rmSync(join(root, "codeops", "codeops.json"))
    symlinkSync(real, join(root, "codeops", "codeops.json"))
    assert.throws(() => toggleDiscovery({ root, enable: true }), /symlink/i)

    const malformed = project()
    writeFileSync(join(malformed, "codeops", "codeops.json"), "{\n")
    assert.throws(() => toggleDiscovery({ root: malformed, enable: true }), /valid JSON/i)

    const badDiscovery = project({
      config: { schema: 1, mode: "strict", discovery: [] },
    })
    assert.throws(() => toggleDiscovery({ root: badDiscovery, enable: true }), /malformed discovery/i)
  })

  it("should reject both CLI flags", () => {
    const root = project()
    const run = spawnSync(
      process.execPath,
      [SCRIPT, "--root", root, "--enable-discovery", "--disable-discovery"],
      { encoding: "utf8" },
    )
    assert.equal(run.status, 1)
    assert.match(run.stderr, /exactly one/i)
  })
})
