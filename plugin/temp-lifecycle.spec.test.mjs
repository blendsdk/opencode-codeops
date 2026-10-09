/**
 * Specification tests for the scratch-directory lifecycle.
 *
 * The plugin exports one scratch directory (`$CODEOPS_TMPDIR`) per plugin
 * runtime, and every session served by that runtime shares it. Deleting the
 * directory when a plugin instance unloads destroys in-flight scratch files of
 * sessions that are still running, so the contract is: the plugin never
 * deletes the shared directory; the age-based sweep reclaims abandoned
 * directories instead.
 *
 * This is the regression oracle for that contract: a failure here means the
 * repository reintroduced early deletion, never that the test is wrong.
 *
 * @module temp-lifecycle.spec.test
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Read a repository file as UTF-8 text.
 * @param {string} relativePath - Path relative to the repository root.
 * @returns {string} The file contents.
 */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("scratch-directory lifecycle", () => {
  it("keeps the plugin free of scratch-directory deletion", () => {
    const plugin = read("plugin/index.ts")
    assert.doesNotMatch(plugin, /removeSessionTmpDir/)
    assert.match(plugin, /cleanStaleTmpDirs\(\)/)
    assert.match(plugin, /controller\.abort\(\)/)
  })

  it("keeps the temp hygiene module free of exact-directory deletion", () => {
    assert.doesNotMatch(read("bin/lib/tmp-hygiene.mjs"), /removeSessionTmpDir/)
    assert.doesNotMatch(read("bin/lib/tmp-hygiene.d.mts"), /removeSessionTmpDir/)
  })

  it("documents the age-based sweep as the automatic cleanup", () => {
    const hygiene = read("_shared/workspace-hygiene.md")
    assert.doesNotMatch(hygiene, /removes that runtime's\s+directory when the plugin unloads/i)
    assert.match(hygiene, /seven days/i)
    const readme = read("README.md")
    assert.doesNotMatch(readme, /removes the\s+directory when it unloads/i)
    assert.match(readme, /sweeps\s+directories abandoned/i)
  })
})
