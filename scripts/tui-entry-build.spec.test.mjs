/**
 * Specification tests for the packaged TUI entry build.
 *
 * npm-installed plugins load `./tui` from inside `node_modules`, where the
 * host skips its OpenTUI JSX transpilation; the entry therefore ships as
 * precompiled JavaScript. These guards pin the export target, the committed
 * artifact, its freshness against `plugin/tui.tsx`, and the absence of a
 * React JSX fallback.
 *
 * @module tui-entry-build.spec.test
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

import { buildTuiSource } from "./build-tui.mjs"

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

describe("packaged TUI entry build", () => {
  it("should export the compiled entry", () => {
    const manifest = JSON.parse(read("package.json"))

    assert.equal(manifest.exports["./tui"], "./plugin/tui.js")
  })

  it("should keep plugin/tui.js in sync with plugin/tui.tsx", async () => {
    const committed = read("plugin/tui.js")
    const rebuilt = await buildTuiSource()

    assert.equal(committed, rebuilt, "plugin/tui.js is stale; run `npm run build:tui`")
  })

  it("should carry the OpenTUI runtime and no React JSX fallback", () => {
    const entry = read("plugin/tui.js")

    assert.match(entry, /from "@opentui\/solid"/)
    assert.doesNotMatch(entry, /from "react/)
  })
})
