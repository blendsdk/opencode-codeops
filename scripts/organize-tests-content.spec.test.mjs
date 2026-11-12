/**
 * Specification tests for the `organize-tests` adoption skill.
 *
 * The skill edits a project's test map, AGENTS.md, and CI additively. These
 * tests pin the safety contract and the reference structure before the skill
 * text exists.
 *
 * @module organize-tests-content.spec.test
 */

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"

const ROOT = new URL("..", import.meta.url).pathname
const SKILL = "skills/organize-tests/SKILL.md"

/** Read a repository file. */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

/** Collapse Markdown wrapping for phrase checks. */
function flat(text) {
  return text.replace(/\s+/g, " ")
}

/** Assert every phrase is present. */
function containsAll(text, phrases, label) {
  const value = flat(text)
  for (const phrase of phrases) {
    assert.ok(value.includes(flat(phrase)), `${label} must contain: ${phrase}`)
  }
}

/** Extract relative Markdown links from a document. */
function relativeLinks(text) {
  return [...text.matchAll(/\]\(([^)]+)\)/g)]
    .map((match) => match[1])
    .filter((link) => !link.startsWith("http") && !link.startsWith("#"))
}

describe("ST-43 skill entry point", () => {
  it("exists with the required frontmatter", () => {
    assert.ok(existsSync(join(ROOT, SKILL)))
    const text = read(SKILL)
    assert.match(text, /^---\nname: organize-tests\n/m)
    assert.match(text, /description: .*test-impact map/)
  })

  it("documents every mode", () => {
    containsAll(
      read(SKILL),
      ["--dry-run", "--check", "--refresh", "--shadow", "--audit", "--no-ci", "--custom"],
      SKILL,
    )
  })

  it("documents the protocol from inventory through audit", () => {
    containsAll(
      read(SKILL),
      [
        "Preflight",
        "Inventory tests",
        "Propose slices",
        "Derive dependencies",
        "Assign tiers",
        "Synthesize commands",
        "Preview",
        "Shadow",
        "Apply with staging",
        "Verify",
        "Refresh/audit",
      ],
      SKILL,
    )
  })
})

describe("ST-44 and ST-45 language adapters", () => {
  it("covers Node, Rust, Python, Go, JVM, .NET, C/C++, and custom runners", () => {
    containsAll(
      read("skills/organize-tests/references/language-adapters.md"),
      ["node --test", "cargo test", "pytest", "go test", "gradlew", "dotnet test", "ctest", "Custom"],
      "language adapters",
    )
  })

  it("explains target-based groups and omitted tests", () => {
    containsAll(
      read("skills/organize-tests/references/language-adapters.md"),
      ["target-based", "may omit", "`tests`", "sources"],
      "language adapters",
    )
  })
})

describe("ST-46 shadow adoption", () => {
  it("refuses adoption on a missed failure", () => {
    containsAll(
      read("skills/organize-tests/references/shadow-mode.md"),
      ["zero missed failures", "escaped", "refuse", "never enable"],
      "shadow mode",
    )
  })
})

describe("ST-47 map health", () => {
  it("covers orphans, overlaps, missing task tiers, and slow groups", () => {
    containsAll(
      read("skills/organize-tests/references/map-health.md"),
      ["orphan", "overlap", "task tier", "slow", "`check --strict`"],
      "map health",
    )
  })
})

describe("ST-48 testing block ownership", () => {
  it("makes organize-tests the sole writer and analyze-project a preserver", () => {
    containsAll(
      read("skills/organize-tests/references/agents-testing-block.md"),
      ["CODEOPS-TESTING", "sole writer", "preserves", "byte-for-byte", "never render"],
      "testing block reference",
    )
  })

  it("documents the optional Test slices table", () => {
    containsAll(
      read("skills/organize-tests/references/agents-testing-block.md"),
      ["Test slices", "slice", "tier", "sources", "gate"],
      "testing block reference",
    )
  })
})

describe("ST-66 metrics", () => {
  it("limits metrics to content-free fields", () => {
    containsAll(
      read(SKILL),
      ["--metrics", "gate", "selected/total", "budget", "fallback", "map hash"],
      SKILL,
    )
  })
})

describe("ST-68 safety and containment", () => {
  it("states the non-destructive rules", () => {
    containsAll(
      read(SKILL),
      [
        "Never edit",
        "Never remove",
        "No adoption on shadow misses",
        "restore",
        "Refuse malformed",
        "_shared/workspace-hygiene.md",
      ],
      SKILL,
    )
  })

  it("documents per-slice acceptance and CODEOWNERS guidance", () => {
    containsAll(
      read(SKILL),
      ["acceptance", "manual", "external", "na", "CODEOWNERS", "codeops/test-map/**"],
      SKILL,
    )
  })

  it("links every reference file and every link resolves", () => {
    const text = read(SKILL)
    for (const link of relativeLinks(text)) {
      const target = resolve(dirname(join(ROOT, SKILL)), link)
      assert.ok(existsSync(target), `missing reference: ${link}`)
    }
    for (const reference of [
      "references/analysis-protocol.md",
      "references/language-adapters.md",
      "references/shadow-mode.md",
      "references/map-health.md",
      "references/agents-testing-block.md",
      "references/ci-github-actions.md",
      "references/project-wrapper.md",
    ]) {
      assert.ok(text.includes(reference), `skill must link ${reference}`)
    }
  })

  it("contains no plugin-root or legacy host path leaks", () => {
    const files = [SKILL]
    for (const name of ["analysis-protocol", "language-adapters", "shadow-mode", "map-health", "agents-testing-block"]) {
      files.push(`skills/organize-tests/references/${name}.md`)
    }
    for (const file of files) {
      const text = read(file)
      assert.ok(!text.includes("${PLUGIN_ROOT}"), `${file} leaks \${PLUGIN_ROOT}`)
      assert.ok(!text.includes(".codex/"), `${file} leaks .codex/`)
    }
  })
})
