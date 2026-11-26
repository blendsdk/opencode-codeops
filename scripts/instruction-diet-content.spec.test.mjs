/**
 * Specification tests for the standard-path reading lists.
 *
 * make-plan and exec-plan each name what a `standard` run reads and what it
 * skips, so a standard run does not load the coverage-hunt protocol, the
 * full-plan templates, or option policies whose flag is absent.
 *
 * @module instruction-diet-content.spec.test
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Read a repository file.
 *
 * @param {string} path - Path relative to the repository root.
 * @returns {string} The file text.
 */
function read(path) {
  return readFileSync(join(ROOT, path), "utf8")
}

/**
 * Return the text between a heading and the next heading of the same or higher level.
 *
 * @param {string} text - Document text.
 * @param {string} heading - The exact heading line.
 * @returns {string} The section, or "" when missing.
 */
function section(text, heading) {
  const start = text.indexOf(`${heading}\n`)
  if (start === -1) return ""
  const rest = text.slice(start + heading.length + 1)
  const next = rest.search(/^## /m)
  return next === -1 ? rest : rest.slice(0, next)
}

describe("standard-path reading lists", () => {
  it("ID-1 — make-plan lists what a standard run reads and skips", () => {
    const list = section(read("skills/make-plan/SKILL.md"), "## What a standard run reads")
    assert.notEqual(list, "", "make-plan must carry the standard reading list")
    assert.match(list, /templates\.md.{0,80}Standard single-document plan/)
    for (const skipped of ["coverage-hunt.md", "quality-checklist.md", "auto-design.md", "scope-expansion-control.md"]) {
      assert.match(list, new RegExp(`(?:skip|not|only when)[^\\n]*${skipped.replace(".", "\\.")}|${skipped.replace(".", "\\.")}[^\\n]*(?:only when|skip)`, "i"), `the list names ${skipped} as skipped or conditional`)
    }
  })

  it("ID-2 — exec-plan lists what a run reads and which option policies stay unread without their flag", () => {
    const list = section(read("skills/exec-plan/SKILL.md"), "## What a run reads")
    assert.notEqual(list, "", "exec-plan must carry the reading list")
    assert.match(list, /execution-protocol\.md/)
    for (const optional of ["auto-design.md", "scope-expansion-control.md", "reasoning-effort.md"]) {
      assert.match(list, new RegExp(`${optional.replace(".", "\\.")}[^\\n]*only when`, "i"), `${optional} is read only with its flag`)
    }
  })
})
