/**
 * Implementation tests for glob matching, change collection, and determinism.
 *
 * These cover the internals the specification tests intentionally leave out:
 * Git output parsing, branch resolution with a fake Git runner, matcher edge
 * cases, formatted output, and a bounded performance fixture.
 *
 * @module test-selection.impl.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { normalizePolicy, normalizeRepoPath } from "./lib/test-map.mjs"
import { formatSelection } from "./lib/test-selection-explain.mjs"
import { collectChanges, parseNullList, resolveBaseline, SelectionError } from "./lib/test-selection-changes.mjs"
import { selectTests } from "./lib/test-selection.mjs"
import {
  globToRegExp,
  globsIntersect,
  matchesAnyGlob,
  matchesGlob,
  validateGlobPattern,
} from "./lib/test-selection-glob.mjs"

/** A valid one-group map for command construction. */
function oneGroupMap(extra = {}) {
  return {
    schema: 1,
    policy: normalizePolicy({ schema: 1, full: ["npm", "run", "verify"], ...extra }),
    groups: [
      {
        id: "a.unit",
        slice: "a",
        tier: "task",
        sources: ["src/a/**"],
        tests: ["src/a/**/*.test.js"],
        run: { command: ["node", "--test", "{tests}"] },
      },
      {
        id: "b.unit",
        slice: "b",
        tier: "task",
        sources: ["src/b/**"],
        tests: ["src/b/**/*.test.js"],
        run: { command: ["node", "--test", "{tests}"] },
      },
    ],
  }
}

describe("glob matcher", () => {
  it("supports star, double star, question mark, classes, and escapes", () => {
    assert.ok(matchesGlob("src/a.ts", "src/*.ts"))
    assert.ok(!matchesGlob("src/deep/a.ts", "src/*.ts"))
    assert.ok(matchesGlob("src/deep/a.ts", "src/**/*.ts"))
    assert.ok(matchesGlob("src/a.ts", "src/**/*.ts"))
    assert.ok(matchesGlob("src/a1.ts", "src/a?.ts"))
    assert.ok(matchesGlob("src/a.ts", "src/[ab].ts"))
    assert.ok(matchesGlob("src/c.ts", "src/[!ab].ts"))
    assert.ok(matchesGlob("src/a+b.ts", "src/a\\+b.ts"))
  })

  it("matches case-sensitively by default and honors the override", () => {
    assert.ok(!matchesGlob("SRC/A.ts", "src/**/*.ts"))
    assert.ok(matchesGlob("SRC/A.ts", "src/**/*.ts", { caseSensitive: false }))
  })

  it("rejects brace expansion, extglobs, and negation groups", () => {
    for (const pattern of ["src/{a,b}.ts", "src/@(a|b).ts", "!src/a.ts", "src/[abc"]) {
      assert.equal(validateGlobPattern(pattern).ok, false, pattern)
    }
  })

  it("normalizes Windows separators before matching", () => {
    assert.equal(normalizeRepoPath("src\\a\\b.ts"), "src/a/b.ts")
    assert.ok(matchesGlob(normalizeRepoPath("src\\a\\b.ts"), "src/**/*.ts"))
    assert.ok(globToRegExp("src/**/*.ts").test("src/a/b.ts"))
  })

  it("compares glob prefixes conservatively", () => {
    assert.ok(globsIntersect("web/**", "web/billing/**"))
    assert.ok(!globsIntersect("docs/**", "web/**"))
    assert.ok(!globsIntersect("**/*.md", "web/billing/**"))
  })
})

describe("Git output parsing", () => {
  it("parses NUL-separated lists", () => {
    assert.deepEqual(parseNullList("a.ts\0b.ts\0\0"), ["a.ts", "b.ts"])
  })

  it("collects changed, renamed, deleted, and untracked paths", () => {
    const runGit = (args) => {
      if (args[0] === "rev-parse") return { status: 0, stdout: "" }
      if (args[0] === "diff") return { status: 0, stdout: "R100\0src/a.ts\0src/b.ts\0D\0src/old.ts\0M\0src/c.ts\0" }
      if (args[0] === "ls-files") return { status: 0, stdout: "src/new.ts\0" }
      return { status: 1, stdout: "", stderr: "" }
    }
    const result = collectChanges({
      root: "/repo",
      baseline: "a".repeat(40),
      include: ["spec/a.test.ts"],
      runGit,
    })
    assert.deepEqual(result.changed, ["spec/a.test.ts", "src/a.ts", "src/b.ts", "src/c.ts", "src/new.ts", "src/old.ts"])
    assert.equal(result.deleted[0], "src/old.ts")
    assert.equal(result.base.kind, "tree")
  })

  it("fails closed when git diff fails", () => {
    const runGit = (args) => {
      if (args[0] === "rev-parse") return { status: 0, stdout: "" }
      if (args[0] === "diff") return { status: 1, stdout: "", stderr: "boom" }
      return { status: 1, stdout: "", stderr: "" }
    }
    assert.throws(
      () => collectChanges({ root: "/repo", baseline: "a".repeat(40), runGit }),
      (error) => error instanceof SelectionError && error.reason === "git-error",
    )
  })
})

describe("baseline resolution", () => {
  it("prefers an explicit baseline over the environment", () => {
    const base = resolveBaseline({
      baseline: "b".repeat(40),
      env: { CODEOPS_TEST_BASE: "main" },
      runGit: () => ({ status: 0, stdout: "" }),
    })
    assert.equal(base.value, "b".repeat(40))
    assert.equal(base.kind, "tree")
  })

  it("uses a valid integration marker", () => {
    const base = resolveBaseline({
      branch: "main",
      lastFullSha: "c".repeat(40),
      runGit: () => ({ status: 0, stdout: "" }),
    })
    assert.equal(base.value, "c".repeat(40))
  })

  it("uses the merge base for a feature branch", () => {
    const base = resolveBaseline({
      branch: "feature/x",
      runGit: (args) => {
        if (args[0] === "merge-base" && args[2] === "main") return { status: 0, stdout: "d".repeat(40) }
        return { status: 1, stdout: "" }
      },
    })
    assert.equal(base.value, "d".repeat(40))
  })

  it("uses a previous release tag for a release branch", () => {
    const base = resolveBaseline({
      branch: "release/1.2",
      runGit: (args) => {
        if (args[0] === "describe") return { status: 0, stdout: "v1.1.0\n" }
        return { status: 1, stdout: "" }
      },
    })
    assert.equal(base.value, "v1.1.0")
  })
})

describe("selection determinism and safety", () => {
  it("returns the same result for the same input", () => {
    const map = oneGroupMap()
    const options = {
      map,
      changed: ["src/a/x.js"],
      files: ["src/a/x.test.js", "src/b/y.test.js"],
      gate: "task",
    }
    assert.deepEqual(selectTests(options), selectTests(options))
  })

  it("sorts selected groups by slice then id", () => {
    const map = oneGroupMap({ fullThreshold: 1 })
    map.groups.push({
      id: "c.unit",
      slice: "c",
      tier: "task",
      sources: ["src/c/**"],
      tests: ["src/c/**/*.test.js"],
      run: { command: ["node", "--test", "{tests}"] },
    })
    const result = selectTests({
      map,
      changed: ["src/b/y.js", "src/a/x.js"],
      files: ["src/a/x.test.js", "src/b/y.test.js"],
      gate: "task",
    })
    assert.deepEqual(result.selected.map((entry) => entry.id), ["a.unit", "b.unit"])
  })

  it("keeps every selected group when the budget is over", () => {
    const map = oneGroupMap()
    map.policy.fullThreshold = 0.9
    map.groups[0].durationSec = 200
    const result = selectTests({
      map,
      changed: ["src/a/x.js"],
      files: ["src/a/x.test.js", "src/b/y.test.js"],
      gate: "task",
    })
    assert.deepEqual(result.selected.map((entry) => entry.id), ["a.unit"])
    assert.equal(result.budget.status, "over-budget")
  })

  it("handles a 1,000-path change set quickly", () => {
    const groups = []
    const files = []
    const changed = []
    for (let index = 0; index < 100; index += 1) {
      groups.push({
        id: `g${index}.unit`,
        slice: `g${index}`,
        tier: "task",
        sources: [`src/g${index}/**`],
        tests: [`src/g${index}/**/*.test.js`],
        run: { command: ["node", "--test", "{tests}"] },
      })
      files.push(`src/g${index}/a.test.js`)
      if (index < 50) {
        for (let pathIndex = 0; pathIndex < 20; pathIndex += 1) changed.push(`src/g${index}/file${pathIndex}.js`)
      }
    }
    const map = {
      schema: 1,
      policy: normalizePolicy({ schema: 1, full: ["npm", "run", "verify"], fullThreshold: 1 }),
      groups,
    }
    const start = Date.now()
    const result = selectTests({ map, changed, files, gate: "task" })
    const elapsed = Date.now() - start
    assert.equal(result.mode, "groups")
    assert.equal(result.selected.length, 50)
    assert.ok(elapsed < 2000, `selection took ${elapsed}ms`)
  })
})

describe("formatted output", () => {
  it("renders selected reasons and full fallbacks", () => {
    const map = oneGroupMap()
    const groups = selectTests({
      map,
      changed: ["src/a/x.js"],
      files: ["src/a/x.test.js", "src/b/y.test.js"],
      gate: "task",
    })
    const text = formatSelection(groups)
    assert.match(text, /mode: groups/)
    assert.match(text, /a\.unit/)

    const full = selectTests({
      map,
      changed: ["src/unknown.ts"],
      files: [],
      gate: "task",
    })
    assert.match(formatSelection(full), /mode: full/)
    assert.match(formatSelection(full), /reason: unknown-path/)
  })
})
