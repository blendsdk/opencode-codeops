/**
 * Specification tests for the redesigned Discovery navigation.
 *
 * These cases pin the documented route shapes, legacy-link compatibility, the
 * initial workspace selection, and the explicit Continue destination. They are
 * written from the plan documents only; a failure means the implementation
 * does not satisfy the specification.
 *
 * @module discovery-ui-redesign-navigation.spec.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { formatRoute, parseRoute } from "../discovery-ui/src/route.ts"
import { planView } from "../discovery-ui/src/view-models.ts"
import { nextWorkspace, selectWorkspace } from "../discovery-ui/src/workspace-model.ts"

/** Build one stored question with the documented defaults. */
function question(key, group, extra = {}) {
  const { state, ...rest } = extra
  return {
    key,
    group,
    type: "text",
    title: key,
    fingerprint: `f-${key}`,
    revisedAt: 1,
    state: {
      answer: null,
      notes: "",
      defer: null,
      needsDiscussion: false,
      proposalDismissed: false,
      status: "open",
      changed: false,
      recordedAs: null,
      ...state,
    },
    ...rest,
  }
}

/** Build a stored plan from groups and questions. */
function planRecord({ groups, questions }) {
  return {
    slug: "billing",
    title: "Billing",
    kind: "plan",
    artifact: "plans/billing",
    revision: 1,
    orphaned: false,
    archived: false,
    unarchivedAt: null,
    groups,
    questions,
  }
}

/** A plan with one actionable group, one locked group, and one completed group. */
function selectionFixture() {
  return planView(
    planRecord({
      groups: [
        { key: "Done", title: "Done", dependsOn: [], submittedAt: "2026-01-01" },
        { key: "Locked", title: "Locked", dependsOn: ["Later"], submittedAt: null },
        { key: "Later", title: "Later", dependsOn: [], submittedAt: null },
      ],
      questions: [
        question("done-1", "Done", { state: { status: "submitted" } }),
        question("locked-1", "Locked"),
        question("later-1", "Later"),
      ],
    }),
  )
}

describe("routes (ST-1)", () => {
  it("should keep the existing route shapes and omit a legacy plan target", () => {
    assert.deepEqual(parseRoute(""), { view: "projects" })
    assert.deepEqual(parseRoute("#/"), { view: "projects" })
    assert.deepEqual(parseRoute("#/p/my-repo"), { view: "project", project: "my-repo" })
    assert.deepEqual(parseRoute("#/p/my-repo/billing"), {
      view: "plan",
      project: "my-repo",
      plan: "billing",
    })
    assert.equal("target" in parseRoute("#/p/my-repo/billing"), false)
  })

  it("should round-trip every legacy route exactly", () => {
    for (const hash of ["#/", "#/p/my-repo", "#/p/my-repo/billing"]) {
      assert.equal(formatRoute(parseRoute(hash)), hash)
    }
  })
})

describe("workspace destinations (ST-2)", () => {
  it("should parse and format group and summary destinations", () => {
    assert.deepEqual(parseRoute("#/p/repo/plan/groups/Scope"), {
      view: "plan",
      project: "repo",
      plan: "plan",
      target: { kind: "group", key: "Scope" },
    })
    assert.deepEqual(parseRoute("#/p/repo/plan/summary"), {
      view: "plan",
      project: "repo",
      plan: "plan",
      target: { kind: "summary" },
    })
    assert.equal(formatRoute(parseRoute("#/p/repo/plan/groups/Scope")), "#/p/repo/plan/groups/Scope")
    assert.equal(formatRoute(parseRoute("#/p/repo/plan/summary")), "#/p/repo/plan/summary")
  })

  it("should keep a group named summary distinct from the summary destination", () => {
    assert.deepEqual(parseRoute("#/p/repo/plan/groups/summary"), {
      view: "plan",
      project: "repo",
      plan: "plan",
      target: { kind: "group", key: "summary" },
    })
    assert.deepEqual(parseRoute("#/p/repo/plan/summary"), {
      view: "plan",
      project: "repo",
      plan: "plan",
      target: { kind: "summary" },
    })
  })
})

describe("route rejection (ST-3)", () => {
  it("should reject malformed escapes, encoded separators, and traversal", () => {
    assert.deepEqual(parseRoute("#/p/%E0%A4%A/billing"), { view: "not-found" })
    assert.deepEqual(parseRoute("#/p/repo/plan/groups/a%2Fb"), { view: "not-found" })
    assert.deepEqual(parseRoute("#/p/repo/plan/groups/.."), { view: "not-found" })
    assert.deepEqual(parseRoute("#/p/repo/plan/groups/%2E%2E"), { view: "not-found" })
  })

  it("should reject invalid slugs, invalid keys, unknown suffixes, and extra segments", () => {
    assert.deepEqual(parseRoute("#/p/Repo/billing"), { view: "not-found" })
    assert.deepEqual(parseRoute("#/p/repo/plan/groups/-bad"), { view: "not-found" })
    assert.deepEqual(parseRoute("#/p/repo/plan/groups/Scope/extra"), { view: "not-found" })
    assert.deepEqual(parseRoute("#/p/repo/plan/groups"), { view: "not-found" })
    assert.deepEqual(parseRoute("#/p/repo/plan/summary/extra"), { view: "not-found" })
    assert.deepEqual(parseRoute("#/p/repo/plan/focus"), { view: "not-found" })
  })

  it("should keep the existing empty-segment normalization", () => {
    assert.deepEqual(parseRoute("#/p//repo//plan/"), {
      view: "plan",
      project: "repo",
      plan: "plan",
    })
    assert.deepEqual(parseRoute("#/p/repo/plan/groups//Scope"), {
      view: "plan",
      project: "repo",
      plan: "plan",
      target: { kind: "group", key: "Scope" },
    })
  })
})

describe("initial workspace selection (ST-4)", () => {
  it("should select the first unlocked group with a pending visible question", () => {
    const selection = selectWorkspace(selectionFixture())
    assert.deepEqual(selection, {
      target: { kind: "group", key: "Later" },
      replace: true,
      notice: null,
    })
  })

  it("should fall back to the summary when no unlocked group is pending", () => {
    const plan = planView(
      planRecord({
        groups: [
          { key: "Hidden", title: "Hidden", dependsOn: [], submittedAt: null },
          { key: "Locked", title: "Locked", dependsOn: ["Hidden"], submittedAt: null },
        ],
        questions: [
          {
            ...question("hidden-1", "Hidden"),
            showIf: [{ question: "locked-1", anyOf: ["yes"] }],
          },
          {
            ...question("locked-1", "Locked"),
            type: "single",
            options: [
              { id: "yes", label: "Yes" },
              { id: "no", label: "No" },
            ],
          },
        ],
      }),
    )
    assert.deepEqual(selectWorkspace(plan), {
      target: { kind: "summary" },
      replace: true,
      notice: null,
    })
  })
})

describe("explicit workspace selection (ST-5)", () => {
  it("should keep an explicit group even when it becomes locked or complete", () => {
    const plan = selectionFixture()
    assert.deepEqual(selectWorkspace(plan, { kind: "group", key: "Locked" }), {
      target: { kind: "group", key: "Locked" },
      replace: false,
      notice: null,
    })
    assert.deepEqual(selectWorkspace(plan, { kind: "group", key: "Done" }), {
      target: { kind: "group", key: "Done" },
      replace: false,
      notice: null,
    })
  })

  it("should resolve a removed group to the summary with a notice", () => {
    assert.deepEqual(selectWorkspace(selectionFixture(), { kind: "group", key: "Removed" }), {
      target: { kind: "summary" },
      replace: true,
      notice: "This group is no longer available.",
    })
  })
})

describe("history intent and Continue (ST-6)", () => {
  it("should replace on initial normalization and add an entry for explicit destinations", () => {
    const plan = selectionFixture()
    assert.equal(selectWorkspace(plan).replace, true)
    assert.equal(selectWorkspace(plan, { kind: "group", key: "Later" }).replace, false)
    assert.equal(selectWorkspace(plan, { kind: "summary" }).replace, false)
    assert.equal(selectWorkspace(plan, { kind: "group", key: "Missing" }).replace, true)
  })

  it("should choose the next eligible group, wrap, and never return the current group", () => {
    const plan = planView(
      planRecord({
        groups: [
          { key: "A", title: "A", dependsOn: [], submittedAt: null },
          { key: "B", title: "B", dependsOn: [], submittedAt: null },
          { key: "C", title: "C", dependsOn: [], submittedAt: null },
        ],
        questions: [question("qa", "A"), question("qb", "B"), question("qc", "C")],
      }),
    )
    assert.deepEqual(nextWorkspace(plan, "A"), { kind: "group", key: "B" })
    assert.deepEqual(nextWorkspace(plan, "B"), { kind: "group", key: "C" })
    assert.deepEqual(nextWorkspace(plan, "C"), { kind: "group", key: "A" })
    assert.deepEqual(nextWorkspace(plan, "A"), { kind: "group", key: "B" })
  })

  it("should not turn Continue into a no-op when only a discussion question remains", () => {
    const plan = planView(
      planRecord({
        groups: [
          { key: "A", title: "A", dependsOn: [], submittedAt: null },
          { key: "B", title: "B", dependsOn: [], submittedAt: null },
        ],
        questions: [
          question("qa", "A", { state: { needsDiscussion: true } }),
          question("qb", "B"),
        ],
      }),
    )
    assert.deepEqual(nextWorkspace(plan, "A"), { kind: "group", key: "B" })
  })

  it("should skip a locked group when choosing Continue", () => {
    const plan = planView(
      planRecord({
        groups: [
          { key: "Start", title: "Start", dependsOn: [], submittedAt: null },
          { key: "Locked", title: "Locked", dependsOn: ["Start"], submittedAt: null },
          { key: "Ready", title: "Ready", dependsOn: [], submittedAt: null },
        ],
        questions: [
          {
            ...question("start-1", "Start"),
            showIf: [{ question: "locked-1", anyOf: ["yes"] }],
          },
          {
            ...question("locked-1", "Locked"),
            type: "single",
            options: [
              { id: "yes", label: "Yes" },
              { id: "no", label: "No" },
            ],
          },
          question("ready-1", "Ready"),
        ],
      }),
    )
    assert.deepEqual(nextWorkspace(plan, "Start"), { kind: "group", key: "Ready" })
  })

  it("should fall back to the summary when no other group qualifies", () => {
    const plan = planView(
      planRecord({
        groups: [{ key: "Only", title: "Only", dependsOn: [], submittedAt: null }],
        questions: [question("q1", "Only")],
      }),
    )
    assert.deepEqual(nextWorkspace(plan, "Only"), { kind: "summary" })
  })
})
