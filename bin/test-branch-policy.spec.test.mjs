/**
 * Specification tests for branch classification and CI plan generation.
 *
 * The branch policy decides when the full suite is mandatory. A mistake here is
 * a release-safety defect, so every class, precedence rule, and nightly skip is
 * pinned before the implementation exists.
 *
 * @module test-branch-policy.spec.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildPlan,
  classifyRef,
  gateForClass,
  nightlyDecision,
} from "./lib/test-branch-policy.mjs"
import { normalizePolicy } from "./lib/test-map.mjs"
import { resolveBaseline } from "./lib/test-selection-changes.mjs"

/** A minimal map policy for nightly decisions. */
function policy(extra = {}) {
  return normalizePolicy({
    schema: 1,
    full: ["npm", "run", "verify"],
    ignorePaths: [{ glob: "**/*.md", reason: "documentation" }],
    fullOnPaths: ["package.json", "package-lock.json"],
    ...extra,
  })
}

/** A one-group map for nightly relevance. */
function map() {
  return {
    schema: 1,
    policy: policy(),
    groups: [
      {
        id: "a.unit",
        slice: "a",
        tier: "task",
        sources: ["src/a/**"],
        tests: ["tests/a/**/*.test.js"],
        run: { command: ["node", "--test", "{tests}"] },
      },
    ],
  }
}

describe("ST-36 branch classification", () => {
  const cases = [
    ["main", "integration", "pr", false],
    ["master", "integration", "pr", false],
    ["feature/x", "feature", "task", false],
    ["release/1.2", "release", "release", true],
    ["release-2026", "release", "release", true],
    ["hotfix/x", "release", "release", true],
    ["acceptance/rc", "acceptance", "acceptance", true],
  ]

  for (const [ref, branchClass, gate, full] of cases) {
    it(`classifies ${ref} as ${branchClass}`, () => {
      const result = classifyRef(ref)
      assert.equal(result.class, branchClass)
      assert.equal(result.gate, gate)
      assert.equal(result.full, full)
    })
  }

  it("classifies a release tag as release", () => {
    const result = classifyRef("v1.2.3", { isTag: true })
    assert.equal(result.class, "release")
    assert.equal(result.full, true)
  })

  it("uses the integration policy and a warning for an unknown branch", () => {
    const result = classifyRef("topic/xyz")
    assert.equal(result.class, "unknown")
    assert.equal(result.gate, "pr")
    assert.equal(result.warning.code, "branch.unknown")
  })

  it("uses pr for a feature branch in CI", () => {
    assert.equal(gateForClass("feature", { ci: true }), "pr")
    assert.equal(gateForClass("feature", { ci: false }), "task")
  })
})

describe("ST-37 precedence", () => {
  it("prefers acceptance over release when both patterns match", () => {
    const branches = {
      integration: ["main"],
      feature: ["feature/**"],
      release: ["shared/**"],
      acceptance: ["shared/**"],
      releaseTags: ["v*"],
      unknown: "integration",
    }
    const result = classifyRef("shared/rc", { branches })
    assert.equal(result.class, "acceptance")
  })
})

describe("ST-38 nightly change detection", () => {
  it("runs full when the marker is missing", () => {
    const decision = nightlyDecision({ changed: [], map: map(), marker: null })
    assert.equal(decision.mode, "full")
    assert.equal(decision.reason, "nightly.no-marker")
  })

  it("skips a docs-only change", () => {
    const decision = nightlyDecision({ changed: ["docs/guide.md"], map: map(), marker: "a".repeat(40) })
    assert.equal(decision.mode, "skip")
  })

  it("runs when a source or full-on path changed", () => {
    assert.equal(nightlyDecision({ changed: ["src/a/x.js"], map: map(), marker: "a".repeat(40) }).mode, "groups")
    assert.equal(nightlyDecision({ changed: ["package.json"], map: map(), marker: "a".repeat(40) }).mode, "groups")
  })

  it("counts a path that is both ignored and full-on as relevant", () => {
    const decision = nightlyDecision({
      changed: ["package.json"],
      map: {
        ...map(),
        policy: policy({ ignorePaths: [{ glob: "package.json", reason: "metadata" }] }),
      },
      marker: "a".repeat(40),
    })
    assert.equal(decision.mode, "groups")
  })
})

describe("ST-39 plan shapes", () => {
  it("emits a matrix for selected groups and marks release full", () => {
    const selection = {
      mode: "groups",
      gate: "release",
      selected: [{ id: "a.unit" }, { id: "b.unit" }],
      commands: [
        { id: "a.unit", argv: ["node", "--test", "a.test.js"], cwd: "." },
        { id: "b.unit", argv: ["node", "--test", "b.test.js"], cwd: "." },
      ],
      fullCommand: ["npm", "run", "verify"],
      reason: null,
    }
    const plan = buildPlan({ selection, gate: "release", total: 2 })
    assert.equal(plan.mode, "groups")
    assert.equal(plan.full, true)
    assert.equal(plan.matrix.include.length, 2)
  })

  it("always emits a matrix for full and none", () => {
    const full = buildPlan({
      selection: { mode: "full", gate: "task", selected: [], commands: [], fullCommand: null, reason: "no-map" },
      gate: "task",
      total: 0,
    })
    assert.deepEqual(full.matrix, { include: [] })
    assert.equal(full.fullCommand, null)

    const none = buildPlan({
      selection: { mode: "none", gate: "pr", selected: [], commands: [], fullCommand: ["npm", "run", "verify"], reason: "docs-only" },
      gate: "pr",
      total: 2,
    })
    assert.equal(none.mode, "none")
    assert.deepEqual(none.matrix, { include: [] })
  })
})

describe("ST-69 feature branch and explicit baseline", () => {
  it("uses task locally, pr in CI, and honors an explicit baseline", () => {
    assert.equal(classifyRef("feature/x").gate, "task")
    assert.equal(classifyRef("feature/x", { ci: true }).gate, "pr")

    const base = resolveBaseline({
      baseline: "f".repeat(40),
      branch: "feature/x",
      runGit: () => ({ status: 0, stdout: "" }),
    })
    assert.equal(base.value, "f".repeat(40))
  })
})
