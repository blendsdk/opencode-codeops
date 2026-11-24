/**
 * Specification tests for effort and independence disclosure.
 *
 * These content guards pin the single dispatch-header contract, the preflight
 * report disclosure, the exec-plan summary disclosure, the plan template, the
 * setup-routing policy text, and the omission rule when no level is active. A
 * failure here means a shipped guidance document lost the contract — never
 * that the test is wrong.
 *
 * @module effort-disclosure-content.spec.test
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Read one repository document.
 *
 * @param relativePath - Path relative to the repository root
 * @returns The document text
 */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("single dispatch header (ST-20)", () => {
  it("defines the canonical header once with every field", () => {
    const content = read("_shared/quality-profile.md")

    assert.equal(
      content.match(/\[codeops-dispatch /g)?.length,
      1,
      "the header must be defined exactly once"
    )
    assert.match(
      content,
      /\[codeops-dispatch agent=<name> feature=<slug> phase=<id> unit=<id> model=<pin\|inherited> effort=<requested> independence=<mixed-model\|mixed-effort\|uniform-effort>\]/
    )
  })

  it("documents the independence values and the effort omission rule", () => {
    const content = read("_shared/quality-profile.md")

    for (const value of ["mixed-model", "mixed-effort", "uniform-effort"]) {
      assert.match(content, new RegExp(value), `must define ${value}`)
    }
    assert.match(content, /omit[^\n]*`effort=`/i)
    assert.match(content, /inherit/i)
  })
})

describe("preflight disclosure (ST-21, ST-28)", () => {
  it("adds independence and effort to the report header", () => {
    const content = read("skills/preflight/report-format.md")

    assert.match(content, /> \*\*Independence\*\*:/)
    for (const value of ["mixed-model", "mixed-effort", "uniform-effort"]) {
      assert.match(content, new RegExp(value), `must accept ${value}`)
    }
    assert.match(content, /Effort: <requested>→<applied> \(<mapping>\)/)
  })

  it("recommends xhigh, never max, for a thorough scan", () => {
    const content = read("skills/preflight/SKILL.md")
    const contract = read("_shared/reasoning-effort.md")

    assert.match(content, /`xhigh`[^\n]*`--thorough`|`--thorough`[^\n]*`xhigh`/)
    assert.doesNotMatch(content, /`max`[^\n]*`--thorough`|`--thorough`[^\n]*`max`/)
    assert.match(contract, /\| `preflight` \| `high`; `xhigh` with `--thorough` \|/)
  })

  it("omits the effort field rather than inventing a default", () => {
    const content = read("skills/preflight/report-format.md")

    assert.match(content, /omit[^\n]*effort/i)
    assert.match(content, /no (?:active )?level|inherit/i)
    assert.match(content, /do not (?:invent|write) [`']?default/i)
  })
})

describe("exec-plan disclosure (ST-22, ST-28)", () => {
  it("adds independence and effort to the session summary", () => {
    const content = read("skills/exec-plan/execution-protocol.md")

    assert.match(content, /\*\*Review Independence:\*\*/)
    for (const value of ["mixed-model", "mixed-effort", "uniform-effort"]) {
      assert.match(content, new RegExp(value), `must accept ${value}`)
    }
    assert.match(content, /\*\*Effort:\*\* <requested>→<applied> \(<mapping>\)/)
    assert.match(content, /omit[^\n]*effort/i)
    assert.match(content, /no (?:active )?level|inherit/i)
  })
})

describe("disclosure edge cases", () => {
  it("never emits a default effort value", () => {
    const documents = [
      "_shared/quality-profile.md",
      "_shared/reasoning-effort.md",
      "skills/preflight/report-format.md",
      "skills/exec-plan/execution-protocol.md",
    ]
    for (const document of documents) {
      const content = read(document)
      assert.doesNotMatch(content, /Effort:\s*default|effort=default/i, document)
    }
  })
})

describe("plan and routing guidance", () => {
  it("lists five levels in the plan template and marks max explicit-only", () => {
    const content = read("skills/make-plan/templates.md")

    for (const level of ["low", "medium", "high", "xhigh", "max"]) {
      assert.match(content, new RegExp("`" + level + "`"), `must list ${level}`)
    }
    assert.match(content, /explicit[- ]only/i)
    assert.match(content, /DeepSeek/)
    assert.match(content, /xhigh→max/)
    assert.doesNotMatch(content, /`low`, `medium`, `high`, or `max`/)
  })

  it("adds the effort-disclosure checklist item", () => {
    const content = read("skills/make-plan/quality-checklist.md")

    assert.match(content, /record the requested level/i)
    assert.match(content, /runtime artifacts/i)
    assert.match(content, /requested→applied|requested → applied/i)
  })

  it("documents the xhigh ceiling, max guard, and optional diversity", () => {
    const skill = read("skills/setup-routing/SKILL.md")
    const routing = read("skills/setup-routing/routing.md")

    for (const content of [skill, routing]) {
      assert.match(content, /`xhigh`/, "must name the xhigh ceiling")
      assert.match(content, /max guard|never (?:select|default to) `max`/i)
      assert.match(content, /DeepSeek/)
      assert.match(content, /xhigh→max/)
      assert.match(content, /optional/i)
      assert.doesNotMatch(content, /suggestion vocabulary is `low`, `medium`, `high`, and `max`/)
    }
    assert.match(routing, /specialists default to `xhigh`/i)
    assert.match(routing, /legacy[^\n]*`max`|`max`[^\n]*legacy/i)
    assert.match(routing, /model pin[^\n]*optional|optional[^\n]*model pin/i)
  })
})
