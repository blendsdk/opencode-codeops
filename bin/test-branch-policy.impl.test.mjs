/**
 * Implementation tests for branch classification and nightly decisions.
 *
 * @module test-branch-policy.impl.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildPlan, classifyRef, nightlyDecision } from "./lib/test-branch-policy.mjs"
import { normalizePolicy } from "./lib/test-map.mjs"

/** Minimal map with one source and one test group. */
function map() {
  return {
    schema: 1,
    policy: normalizePolicy({
      schema: 1,
      full: ["npm", "run", "verify"],
      ignorePaths: [{ glob: "docs/**", reason: "documentation" }],
      fullOnPaths: ["package.json"],
    }),
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

describe("classification edge cases", () => {
  it("treats a tag that matches releaseTags as release without an explicit isTag", () => {
    assert.equal(classifyRef("v9.1.0").class, "release")
  })

  it("uses an unknown-class warning with a custom policy", () => {
    const result = classifyRef("topic/x", {
      branches: {
        integration: ["main"],
        feature: ["feat/**"],
        release: ["rel/**"],
        acceptance: ["acc/**"],
        releaseTags: ["v*"],
        unknown: "integration",
      },
    })
    assert.equal(result.class, "unknown")
    assert.equal(result.warning.code, "branch.unknown")
  })

  it("classifies a CI feature branch at pr and a local one at task", () => {
    assert.equal(classifyRef("feature/x", { ci: false }).gate, "task")
    assert.equal(classifyRef("feature/x", { ci: true }).gate, "pr")
  })
})

describe("nightly relevance", () => {
  it("treats unowned non-ignored paths as relevant", () => {
    const decision = nightlyDecision({ changed: ["new-module/index.ts"], map: map(), marker: "a".repeat(40) })
    assert.equal(decision.mode, "groups")
  })

  it("skips only ignored paths", () => {
    const decision = nightlyDecision({ changed: ["docs/readme.md"], map: map(), marker: "a".repeat(40) })
    assert.equal(decision.mode, "skip")
  })

  it("treats a changed test file as relevant", () => {
    const decision = nightlyDecision({ changed: ["tests/a/case.test.js"], map: map(), marker: "a".repeat(40) })
    assert.equal(decision.mode, "groups")
  })
})

describe("plan shaping", () => {
  it("includes fullCommand only from the selection", () => {
    const plan = buildPlan({
      selection: {
        mode: "full",
        gate: "release",
        selected: [],
        commands: [],
        fullCommand: [["npm", "run", "build"], ["npm", "run", "test"]],
        reason: "forced",
      },
      gate: "release",
      total: 3,
    })
    assert.equal(plan.full, true)
    assert.deepEqual(plan.fullCommand, [["npm", "run", "build"], ["npm", "run", "test"]])
    assert.deepEqual(plan.matrix, { include: [] })
  })

  it("carries null fullCommand for a no-map plan", () => {
    const plan = buildPlan({
      selection: { mode: "full", gate: "pr", selected: [], commands: [], fullCommand: null, reason: "no-map" },
      gate: "pr",
      total: 0,
    })
    assert.equal(plan.fullCommand, null)
  })
})
