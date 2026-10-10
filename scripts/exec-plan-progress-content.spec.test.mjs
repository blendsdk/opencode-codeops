/**
 * Specification tests for the exec-plan progress reporting protocol and docs.
 *
 * These content guards pin the shipped text: the Progress Reporting section
 * with its tool name and ten transition points, the fail-soft wording and the
 * source-of-truth statement in both exec-plan files, and the README/CHANGELOG
 * documentation of the live sidebar feature. A failure here means the content
 * does not satisfy the contract — never that the test is wrong.
 *
 * @module exec-plan-progress-content.spec.test
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

/**
 * Extract one top-level section from a Markdown document.
 *
 * @param {string} content - The document text.
 * @param {string} heading - The heading line that starts the section.
 * @returns {string} The section text, or an empty string when absent.
 */
function section(content, heading) {
  const start = content.indexOf(heading)
  if (start === -1) return ""
  const rest = content.slice(start)
  const end = rest.indexOf("\n## ", 1)
  return end === -1 ? rest : rest.slice(0, end)
}

describe("exec-plan reporting protocol (ST-19)", () => {
  const protocol = () => section(read("skills/exec-plan/execution-protocol.md"), "## Progress Reporting")

  it("should carry a Progress Reporting section that names the tool", () => {
    const text = protocol()
    assert.notEqual(text, "", "execution-protocol.md must contain the section")
    assert.match(text, /codeops_progress/)
  })

  it("should list all ten transition points", () => {
    const text = protocol()
    for (const moment of [
      "Run start",
      "Phase start",
      "Task implemented",
      "Verification",
      "Task verified",
      "Blocker",
      "Delegation",
      "Review step",
      "Waiting",
      "Run done",
    ]) {
      assert.match(text, new RegExp(moment), `must list the ${moment} moment`)
    }
    assert.match(text, /no other calls/, "the protocol caps reporting at the listed moments")
  })

  it("should reference the section from the SKILL per-task loop", () => {
    const skill = read("skills/exec-plan/SKILL.md")
    assert.match(skill, /codeops_progress/)
    assert.match(skill, /Progress Reporting/)
    assert.match(skill, /execution-protocol\.md/)
  })
})

describe("fail-soft reporting wording (ST-20)", () => {
  it("should state fail-soft reporting and the source-of-truth authority in the protocol", () => {
    const text = section(read("skills/exec-plan/execution-protocol.md"), "## Progress Reporting")
    assert.match(text, /fail-soft/i)
    assert.match(text, /never blocks/)
    assert.match(text, /verify/i)
    assert.match(text, /commit/i)
    assert.match(text, /plan\s+update/)
    assert.match(text, /Markdown\s+execution\s+plan[\s\S]{0,80}source of truth/)
  })

  it("should state that a failed or missing report never blocks a step in the SKILL", () => {
    const skill = read("skills/exec-plan/SKILL.md")
    assert.match(skill, /failed or\s+missing\s+report\s+never\s+blocks/)
  })
})

describe("README and CHANGELOG content (ST-21)", () => {
  it("should document the live sidebar section with the honesty rules", () => {
    const readme = read("README.md")
    assert.match(readme, /## Live task progress in the sidebar/)
    assert.match(readme, /codeops_progress/)
    assert.match(readme, /as[- ]of/i)
    assert.match(readme, /stale/)
    assert.match(readme, /10 minutes/)
    assert.match(readme, /nothing\s+renders\s+when\s+no\s+run\s+is\s+active/)
    assert.match(readme, /source of truth/)
  })

  it("should keep the feature documented in the changelog and drop the strip wording", () => {
    const changelog = read("CHANGELOG.md")
    const heading = /^## (?:Unreleased|[0-9]+\.[0-9]+\.[0-9]+[^\n]*)$/m.exec(changelog)
    assert.ok(heading, "the changelog must open with the unreleased or newest version section")

    const rest = changelog.slice(heading.index)
    const end = rest.indexOf("\n## ", 1)
    const top = end === -1 ? rest : rest.slice(0, end)

    if (/^## Unreleased/.test(top)) {
      // Development state: the hand-written entry carries the feature prose.
      assert.match(top, /### Added/)
      assert.match(top, /codeops_progress/)
      assert.match(top, /sidebar/i)
      assert.match(top, /`\.\/tui`/, "the tui entry fact is kept")
      assert.match(top, /v2\.0\.26/, "the verified build fact is kept")
    } else {
      // Released state: the release tool regenerates the newest section from
      // commits since the previous tag, so the feature is pinned by its
      // historical release section instead.
      assert.match(changelog, /### Features/)
      assert.match(changelog, /progress/i)
    }

    assert.doesNotMatch(
      changelog,
      /minimal\s+sidebar\s+status\s+line/,
      "the replaced strip must no longer be described"
    )
    assert.doesNotMatch(changelog, /strip behaves/, "the strip wording is superseded")
  })
})
