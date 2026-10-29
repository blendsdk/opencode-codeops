/**
 * Implementation tests for the redesigned Discovery navigation.
 *
 * These cases cover encoding boundaries, empty-segment normalization, and the
 * reconciliation edges behind the selection helpers. They may change with the
 * implementation; the specification tests may not.
 *
 * @module discovery-ui-redesign-navigation.impl.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { formatRoute, parseRoute } from "../discovery-ui/src/route.ts"
import { planView } from "../discovery-ui/src/view-models.ts"
import { nextWorkspace, selectWorkspace } from "../discovery-ui/src/workspace-model.ts"

/** Build one stored question with the documented defaults. */
function question(key, group, status = "open") {
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
      status,
      changed: false,
      recordedAs: null,
    },
  }
}

/** Build a plan with the supplied groups and questions. */
function planRecord(groups, questions) {
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

describe("route encoding boundaries", () => {
  it("should encode each segment once and round-trip legal keys", () => {
    for (const key of ["DQ-1", "DQ_1", "DQ.1.2", "Summary2", "A".repeat(40)]) {
      const route = { view: "plan", project: "my-repo", plan: "billing", target: { kind: "group", key } }
      const formatted = formatRoute(route)
      assert.deepEqual(parseRoute(formatted), route)
      assert.equal(formatted.includes("%2F"), false)
    }
  })

  it("should reject an over-long key, an encoded space, and a non-ASCII key", () => {
    assert.deepEqual(parseRoute(`#/p/repo/plan/groups/${"A".repeat(41)}`), { view: "not-found" })
    assert.deepEqual(parseRoute("#/p/repo/plan/groups/A%20B"), { view: "not-found" })
    assert.deepEqual(parseRoute("#/p/repo/plan/groups/%C3%84"), { view: "not-found" })
  })

  it("should keep empty segments normalized around a destination", () => {
    assert.deepEqual(parseRoute("//p//repo//plan//summary//"), {
      view: "plan",
      project: "repo",
      plan: "plan",
      target: { kind: "summary" },
    })
  })
})

describe("selection reconciliation edges", () => {
  it("should treat a group named summary as a group destination", () => {
    const plan = planView(
      planRecord(
        [{ key: "summary", title: "Summary", dependsOn: [], submittedAt: null }],
        [question("q1", "summary")],
      ),
    )
    assert.deepEqual(selectWorkspace(plan, { kind: "group", key: "summary" }), {
      target: { kind: "group", key: "summary" },
      replace: false,
      notice: null,
    })
  })

  it("should select the first actionable group when the current one is no longer eligible", () => {
    const plan = planView(
      planRecord(
        [
          { key: "A", title: "A", dependsOn: [], submittedAt: "2026-01-01" },
          { key: "B", title: "B", dependsOn: [], submittedAt: null },
          { key: "C", title: "C", dependsOn: ["B"], submittedAt: null },
        ],
        [
          question("qa", "A", "submitted"),
          question("qb", "B"),
          question("qc", "C"),
        ],
      ),
    )
    assert.equal(plan.groups.find((group) => group.key === "C").locked, true)
    assert.deepEqual(nextWorkspace(plan, "A"), { kind: "group", key: "B" })
    assert.deepEqual(nextWorkspace(plan, "C"), { kind: "group", key: "B" })
  })

  it("should return the summary when there is no actionable group at all", () => {
    const plan = planView(
      planRecord(
        [{ key: "A", title: "A", dependsOn: [], submittedAt: "2026-01-01" }],
        [question("qa", "A", "recorded")],
      ),
    )
    assert.deepEqual(nextWorkspace(plan, "A"), { kind: "summary" })
  })

  it("should be idempotent for the same selection input", () => {
    const plan = planView(
      planRecord(
        [{ key: "A", title: "A", dependsOn: [], submittedAt: null }],
        [question("qa", "A")],
      ),
    )
    assert.deepEqual(selectWorkspace(plan), selectWorkspace(plan))
    assert.deepEqual(nextWorkspace(plan, "A"), nextWorkspace(plan, "A"))
  })
})
