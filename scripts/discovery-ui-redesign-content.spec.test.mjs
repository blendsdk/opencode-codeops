/**
 * Specification test for the Discovery redesign documentation.
 *
 * The shipped README must describe the group-focused workspace, the decision
 * summary, honest save feedback, and the three theme choices. The changelog
 * carries the redesign under Unreleased (or the newest release after a
 * release).
 *
 * @module discovery-ui-redesign-content.spec.test
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

/** The repository root. */
const ROOT = fileURLToPath(new URL("..", import.meta.url))

/** Read one repository file. */
function read(relative) {
  return readFileSync(join(ROOT, relative), "utf8")
}

/** The section of a file between two headings (the end is exclusive). */
function section(text, start, end) {
  const from = text.indexOf(start)
  assert.ok(from >= 0, `missing section ${start}`)
  const to = end === undefined ? text.length : text.indexOf(end, from + start.length)
  return text.slice(from, to === -1 ? text.length : to)
}

describe("Discovery redesign documentation (ST-28)", () => {
  it("should describe the group workspace, summary, save feedback, and theme choices", () => {
    const discovery = section(read("README.md"), "## Discovery", "\n## ")
    for (const needle of [
      "group navigation",
      "Decision summary",
      "Submit all ready groups",
      "Saved",
      "Unsaved changes",
      "System",
      "Light",
      "Dark",
    ]) {
      assert.ok(discovery.includes(needle), `the Discovery section must mention ${needle}`)
    }
    assert.match(
      discovery,
      /server (?:is the|remains the) (?:saved )?authority|server-backed|after the server acknowledg/i,
      "save feedback must be described as server-backed",
    )
    assert.match(
      discovery,
      /discard|leave without saving/i,
      "retained or unsendable drafts must have an explicit exit",
    )
    for (const needle of ["CODEOPS_DISCOVERY_PORT", "npm run build:discovery", "--no-discovery"]) {
      assert.ok(discovery.includes(needle), `the Discovery section must keep ${needle}`)
    }
    assert.match(discovery, /single[- ]user (?:machine|assumption)/i)
    assert.match(discovery, /any\s+local user can (?:read|open|access)/i)
  })

  it("should record the redesign in the newest changelog section", () => {
    const changelog = read("CHANGELOG.md")
    const entries = changelog
      .split("\n")
      .filter((line) => line.startsWith("- discovery:"))
    const entry = entries.find((line) => /redesign|group navigation|decision summary|theme/i.test(line))
    assert.ok(entry, "the changelog must carry a discovery redesign entry")
  })
})
