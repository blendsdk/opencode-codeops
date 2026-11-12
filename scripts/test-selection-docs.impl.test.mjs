/**
 * Implementation tests for the pilot map and documentation.
 *
 * These exercise the repository's own map through the selector: a scripts
 * change stays local, a plugin change widens to its dependent UI, and a release
 * gate covers every group.
 *
 * @module test-selection-docs.impl.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

import { loadMap } from "../bin/lib/test-map.mjs"
import { selectTests } from "../bin/lib/test-selection.mjs"

const ROOT = new URL("..", import.meta.url).pathname

/** Read a repository file. */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

/** Load the pilot map. */
function pilot() {
  const loaded = loadMap({ root: ROOT })
  assert.equal(loaded.mode, "map")
  return loaded
}

/** List tracked and untracked non-ignored files for command expansion. */
function trackedFiles() {
  const result = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: ROOT,
    encoding: "utf8",
  })
  return result.stdout.split("\0").filter(Boolean)
}

/** Select using the pilot map. */
function select(changed, gate = "task") {
  const loaded = pilot()
  return selectTests({
    map: loaded.map,
    mapHash: loaded.mapHash,
    changed,
    files: trackedFiles(),
    gate,
  })
}

describe("pilot map layout", () => {
  it("ships policy, shared, and domain fragments", () => {
    for (const name of ["policy.json", "shared.json", "bin.json", "plugin.json", "scripts.json", "discovery-ui.json", "content.json"]) {
      assert.ok(existsSync(join(ROOT, "codeops/test-map", name)), name)
    }
    assert.deepEqual(pilot().map.fragments, [
      "shared.json",
      "bin.json",
      "content.json",
      "discovery-ui.json",
      "plugin.json",
      "scripts.json",
    ])
  })

  it("gives every group a task tier and an acceptance record", () => {
    for (const group of pilot().map.groups) {
      assert.equal(group.tier, "task", group.id)
      assert.ok(group.acceptance?.reason, `${group.id} acceptance reason`)
    }
  })

  it("keeps ignore reasons and a valid full command", () => {
    const policy = pilot().map.policy
    for (const entry of policy.ignorePaths) assert.ok(entry.reason)
    assert.ok(Array.isArray(policy.full))
    assert.ok(policy.full.every((token) => typeof token === "string"))
  })
})

describe("pilot selection", () => {
  it("keeps a scripts change local", () => {
    const result = select(["scripts/codeops_plan.py"])
    assert.equal(result.mode, "groups")
    assert.deepEqual(result.selected.map((entry) => entry.id), ["scripts.tooling"])
  })

  it("widens a plugin change to the dependent UI", () => {
    const result = select(["plugin/index.ts"])
    const ids = result.selected.map((entry) => entry.id)
    assert.ok(ids.includes("plugin.runtime"))
    assert.ok(ids.includes("discovery.ui"))
    assert.ok(!ids.includes("scripts.tooling"))
  })

  it("selects every group at the release gate", () => {
    const result = select(["scripts/codeops_plan.py"], "release")
    assert.equal(result.selected.length, 6)
    assert.equal(result.deferred.length, 0)
  })

  it("forces full for the map itself", () => {
    const result = select(["codeops/test-map/policy.json"])
    assert.equal(result.mode, "full")
    assert.equal(result.reason, "full-on-path")
  })
})

describe("documentation consistency", () => {
  it("has exactly one testing block in the managed section", () => {
    const agents = read("AGENTS.md")
    assert.equal((agents.match(/CODEOPS-TESTING:START/g) ?? []).length, 1)
    assert.equal((agents.match(/CODEOPS-TESTING:END/g) ?? []).length, 1)
  })

  it("keeps CODEOWNERS additive and scoped to the map", () => {
    const owners = read(".github/CODEOWNERS")
    assert.match(owners, /codeops\/test-map\//)
    assert.ok(!owners.includes("*"))
  })
})
