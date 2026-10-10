/**
 * Specification tests for the live sidebar view.
 *
 * These tests pin the content contract of `plugin/tui.tsx`: the slot claim
 * and helper imports, the live subscriptions and the location-scoped snapshot
 * call, the render source and empty states, the cleared guard on both merge
 * paths, the no-timer rule, and the subscription cleanup — plus the
 * supersession bookkeeping in the foundation spec file, which keeps its
 * slot/import/no-timer invariants and drops the strip-specific assertions.
 *
 * This is the specification oracle: a failing test means the implementation is
 * wrong, never the test. The one recorded supersession — the foundation
 * strip's content assertions — is a user-approved requirement change.
 *
 * @module tui-progress.spec.test
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

describe("sidebar view content (ST-16)", () => {
  it("should claim the sidebar slot and import the shared helpers", () => {
    const tsx = read("plugin/tui.tsx")

    assert.match(tsx, /append:\s*"sidebar\.content"/)
    assert.match(tsx, /codeops-progress\.mjs/, "the view imports the shared display helpers")
    assert.match(tsx, /codeops-rpc\.mjs/, "the view imports the RPC definition and request helper")
  })

  it("should subscribe to both live events and request the snapshot with the location", () => {
    const tsx = read("plugin/tui.tsx")

    assert.match(tsx, /events\.on\(\s*"updated"/)
    assert.match(tsx, /events\.on\(\s*"cleared"/)
    assert.match(tsx, /requestProgress\(context\.client,\s*\{\s*location\s*\}\)/)
  })

  it("should use no timers and import no filesystem module", () => {
    const tsx = read("plugin/tui.tsx")

    assert.doesNotMatch(tsx, /setInterval|setTimeout/)
    assert.doesNotMatch(tsx, /node:fs|["']fs["']|readFileSync/)
  })
})

describe("render and merge contract (ST-17)", () => {
  it("should render only the describeRun lines and nothing without a run", () => {
    const tsx = read("plugin/tui.tsx")

    const displaySites = tsx.match(/describeRun\(/g) ?? []
    assert.equal(displaySites.length, 1, "the display text has exactly one owner")
    assert.doesNotMatch(tsx, /CodeOps v/)
    assert.doesNotMatch(tsx, /CodeOps ·/)
    assert.match(tsx, /Show\s+when=\{run\(\)\}/, "the view renders nothing without a run")
  })

  it("should merge both event paths and the snapshot through mergeRunState", () => {
    const tsx = read("plugin/tui.tsx")

    const mergeSites = tsx.match(/mergeRunState\(/g) ?? []
    assert.ok(mergeSites.length >= 2, "the events and the snapshot both merge monotonically")
    assert.match(tsx, /acceptRunUpdate\(\s*event,\s*directory\s*\)/)
    assert.match(tsx, /acceptRunCleared\(\s*event,\s*directory\s*\)/)
  })

  it("should record clearedAt and guard both merge paths against stale deliveries", () => {
    const tsx = read("plugin/tui.tsx")

    assert.match(tsx, /setClearedAt\(/)
    const guards = tsx.match(/updatedAt\s*>\s*clearedAt\(\)/g) ?? []
    assert.ok(guards.length >= 2, "both merge paths ignore deliveries at or before the clear")
  })

  it("should supersede the strip assertions in the foundation spec file", () => {
    const foundation = read("plugin/tui-foundation.spec.test.mjs")

    assert.match(
      foundation,
      /append:\\s\*"sidebar\\\.content"/,
      "the slot claim stays asserted"
    )
    assert.match(
      foundation,
      /codeops-rpc\\\.mjs/,
      "the helper import stays asserted"
    )
    assert.match(foundation, /setInterval\|setTimeout/, "the no-timer rule stays asserted")
    assert.doesNotMatch(foundation, /CodeOps v/, "the strip literal is superseded")
    assert.doesNotMatch(foundation, /isCodeOpsStatus/, "the strip guard assertion is superseded")
  })
})

describe("subscription lifecycle (ST-18)", () => {
  it("should dispose both subscriptions on cleanup", () => {
    const tsx = read("plugin/tui.tsx")

    const subscriptions = tsx.match(/events\.on\(/g) ?? []
    assert.equal(subscriptions.length, 2)
    assert.match(tsx, /onCleanup\(/)
    assert.match(tsx, /stops\.push\(/)
    assert.match(tsx, /forEach\(\(stop\)\s*=>\s*stop\(\)\)/)
  })
})
