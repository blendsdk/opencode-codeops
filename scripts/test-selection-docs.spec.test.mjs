/**
 * Specification tests for documentation and the pilot map.
 *
 * The feature is not delivered until a real project can adopt it safely. These
 * checks pin the user-facing documentation, the repository's own pilot map, and
 * the governance file that protects it.
 *
 * @module test-selection-docs.spec.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

import { loadMap } from "../bin/lib/test-map.mjs"
import { validateMap } from "../bin/lib/test-map-validate.mjs"

const ROOT = new URL("..", import.meta.url).pathname

/** Read a repository file. */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

/** Collapse whitespace for phrase checks. */
function flat(text) {
  return text.replace(/\s+/g, " ")
}

describe("ST-52 user documentation", () => {
  it("documents opt-in adoption, commands, the full gate, and rollback", () => {
    const readme = flat(read("README.md"))
    for (const phrase of [
      "Test-impact selection",
      "codeops/test-map",
      "codeops-test",
      "CODEOPS_FULL_TESTS=1",
      "full verify",
      "delete the map",
    ]) {
      assert.ok(readme.includes(phrase), `README must contain: ${phrase}`)
    }
  })

  it("records the feature in a changelog section without editing the version", () => {
    const changelog = read("CHANGELOG.md")
    const entry = /^\s*-\s+test-selection:/m
    assert.match(changelog, entry)
    const entryAt = changelog.search(entry)
    const headings = [...changelog.matchAll(/^## (?:Unreleased|[0-9]+\.[0-9]+\.[0-9]+[^\n]*)$/gm)]
    const owner = headings.filter((heading) => heading.index < entryAt).at(-1)
    assert.ok(owner, "the feature entry must live under a changelog section")
  })

  it("adds the managed testing block to AGENTS.md", () => {
    const agents = flat(read("AGENTS.md"))
    assert.ok(agents.includes("CODEOPS-TESTING:START"))
    assert.ok(agents.includes("Test map: `codeops/test-map/`"))
    assert.ok(agents.includes("check --strict"))
  })
})

describe("ST-54 pilot map", () => {
  it("loads and validates the repository map without findings", () => {
    const loaded = loadMap({ root: ROOT })
    assert.equal(loaded.mode, "map")
    assert.ok(loaded.map.groups.length >= 5)
    const files = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      cwd: ROOT,
      encoding: "utf8",
    })
      .stdout.split("\0")
      .filter(Boolean)
    const report = validateMap(loaded.map, { files })
    assert.deepEqual(report.errors, [])
    assert.deepEqual(report.warnings, [])
  })

  it("gives every slice a task tier and an acceptance record", () => {
    const loaded = loadMap({ root: ROOT })
    const slices = new Map()
    for (const group of loaded.map.groups) {
      if (!slices.has(group.slice)) slices.set(group.slice, [])
      slices.get(group.slice).push(group)
    }
    for (const [slice, groups] of slices) {
      assert.ok(groups.some((group) => group.tier === "task"), `${slice} needs a task tier`)
      assert.ok(groups.some((group) => group.acceptance), `${slice} needs an acceptance record`)
    }
  })

  it("passes check --strict", () => {
    const result = spawnSync(process.execPath, ["bin/codeops-test.mjs", "check", "--strict"], {
      cwd: ROOT,
      encoding: "utf8",
    })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  })
})

describe("ST-68 map governance", () => {
  it("protects the map with a CODEOWNERS entry", () => {
    assert.ok(existsSync(join(ROOT, ".github/CODEOWNERS")))
    assert.match(read(".github/CODEOWNERS"), /codeops\/test-map\//)
  })
})
