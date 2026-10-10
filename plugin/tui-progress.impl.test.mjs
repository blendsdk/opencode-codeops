/**
 * Implementation tests for the live sidebar view.
 *
 * These tests cover content-level edges of `plugin/tui.tsx`: the removal of
 * every strip-era literal, the directory derivation and filter expressions,
 * the exact clear guards on both merge paths, and the cleanup registration.
 * Unlike the spec suite, they may derive from the implementation's internals
 * and evolve with them; the behavioral oracle for the filter and merge logic
 * itself remains the progress-core test suite.
 *
 * @module tui-progress.impl.test
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Read a repository file as UTF-8 text.
 *
 * @param {string} relativePath - Path relative to the repository root.
 * @returns {string} The file contents.
 */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("strip removal and stray literals", () => {
  it("should not retain any strip-era or timer content", () => {
    const tsx = read("plugin/tui.tsx")

    assert.doesNotMatch(tsx, /CodeOps v/)
    assert.doesNotMatch(tsx, /isCodeOpsStatus|requestStatus/)
    assert.doesNotMatch(tsx, /setInterval|setTimeout/)
  })
})

describe("handler filter and merge expressions", () => {
  it("should derive the directory from the session location", () => {
    const tsx = read("plugin/tui.tsx")

    assert.match(tsx, /context\.location \?\? context\.data\.location\.default\(\)/)
    assert.match(tsx, /location\?\.directory \?\? ""/)
  })

  it("should filter both handlers by the directory and match the run identity on clear", () => {
    const tsx = read("plugin/tui.tsx")

    assert.match(tsx, /acceptRunUpdate\(\s*event,\s*directory\s*\)/)
    assert.match(tsx, /acceptRunCleared\(\s*event,\s*directory\s*\)/)
    assert.match(tsx, /cleared\.plan\s*===\s*current\.plan/)
    assert.match(tsx, /cleared\.sessionID\s*===\s*current\.sessionID/)
  })

  it("should guard exactly both merge paths with the clear timestamp", () => {
    const tsx = read("plugin/tui.tsx")

    const guards = tsx.match(/updatedAt > clearedAt\(\)/g) ?? []
    assert.equal(guards.length, 2)
  })

  it("should arm the clear time before the identity gate", () => {
    const tsx = read("plugin/tui.tsx")

    const arm = tsx.indexOf("setClearedAt(cleared.clearedAt)")
    const identity = tsx.indexOf("cleared.plan === current.plan")
    assert.ok(arm !== -1, "the clear time is recorded")
    assert.ok(identity !== -1, "the identity gate exists")
    assert.ok(arm < identity, "the clear time arms for every accepted clear, before the gate")
  })
})

describe("subscription cleanup", () => {
  it("should register cleanup that invokes every collected unsubscribe", () => {
    const tsx = read("plugin/tui.tsx")

    assert.match(tsx, /const stops: \(\(\) => void\)\[\] = \[\]/)
    assert.match(tsx, /onCleanup\(\(\) => stops\.forEach\(\(stop\) => stop\(\)\)\)/)
  })
})
