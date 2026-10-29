/**
 * Implementation tests for the Discovery workspace models.
 *
 * These cases cover empty groups, follow-up publishes, long labels, count
 * edges, retired and removed-group context, and the display-only draft
 * overlay. They may change with the implementation; the specification tests
 * may not.
 *
 * @module discovery-ui-redesign-workspace.impl.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { planView } from "../discovery-ui/src/view-models.ts"
import {
  answeredLabel,
  applyDrafts,
  groupsLabel,
  nextWorkspace,
  selectWorkspace,
  workspaceView,
} from "../discovery-ui/src/workspace-model.ts"

/** The default stored question state. */
function state(extra = {}) {
  return {
    answer: null,
    notes: "",
    defer: null,
    needsDiscussion: false,
    proposalDismissed: false,
    status: "open",
    changed: false,
    recordedAs: null,
    ...extra,
  }
}

/** One stored question. */
function question(key, group, extra = {}) {
  const { state: questionState, ...rest } = extra
  return {
    key,
    group,
    type: "text",
    title: key,
    fingerprint: `f-${key}`,
    revisedAt: 1,
    state: state(questionState),
    ...rest,
  }
}

/** A minimal plan. */
function planRecord({ groups = [], questions = [], ...rest } = {}) {
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
    ...rest,
  }
}

describe("workspace edges", () => {
  it("should exclude empty groups from the progress denominator", () => {
    const plan = planView(
      planRecord({
        groups: [
          { key: "A", title: "A", dependsOn: [], submittedAt: null },
          { key: "Empty", title: "Empty", dependsOn: [], submittedAt: null },
        ],
        questions: [question("qa", "A")],
      }),
    )
    const progress = workspaceView(plan)
    assert.equal(progress.totalGroups, 1)
    assert.equal(progress.groups.find((group) => group.key === "Empty").empty, true)
    assert.equal(progress.groups.find((group) => group.key === "Empty").pendingCount, 0)
    assert.match(groupsLabel(progress), /0 of 1 groups complete/)
    assert.match(answeredLabel(progress), /0 of 1 answered/)
  })

  it("should label a completely empty plan without a zero denominator", () => {
    const progress = workspaceView(
      planView(planRecord({ groups: [{ key: "Empty", title: "Empty", dependsOn: [], submittedAt: null }] })),
    )
    assert.equal(groupsLabel(progress), "No groups with visible questions")
    assert.equal(answeredLabel(progress), "No visible questions")
  })

  it("should keep a locked group out of the ready count", () => {
    const plan = planView(
      planRecord({
        groups: [
          { key: "A", title: "A", dependsOn: [], submittedAt: null },
          { key: "B", title: "B", dependsOn: ["A"], submittedAt: null },
        ],
        questions: [question("qa", "A"), question("qb", "B")],
      }),
    )
    const progress = workspaceView(plan)
    const locked = progress.groups.find((group) => group.key === "B")
    assert.equal(locked.locked, true)
    assert.equal(locked.ready, false)
    assert.equal(locked.pendingCount, 1)
    assert.equal(locked.readyCount, 0)
  })

  it("should count a submitted implied answer as answered", () => {
    const plan = planView(
      planRecord({
        groups: [{ key: "A", title: "A", dependsOn: [], submittedAt: null }],
        questions: [
          question("source", "A", {
            type: "single",
            options: [
              { id: "yes", label: "Yes", implies: [{ question: "target", answer: "x", reason: "implied" }] },
              { id: "no", label: "No" },
            ],
            state: { answer: { choice: "yes" } },
          }),
          question("target", "A", {
            type: "single",
            options: [
              { id: "x", label: "X" },
              { id: "y", label: "Y" },
            ],
            state: { status: "submitted" },
          }),
        ],
      }),
    )
    const target = plan.groups[0].questions.find((item) => item.key === "target")
    assert.equal(target.implied !== null, true)
    assert.equal(workspaceView(plan).answeredQuestions, 2)
  })

  it("should make a followed-up group pending again and complete it later", () => {
    const base = planRecord({
      groups: [{ key: "A", title: "A", dependsOn: [], submittedAt: "2026-01-01" }],
      questions: [
        question("q1", "A", { state: { status: "recorded", recordedAs: "AR-1", answer: { text: "done" } } }),
        question("q2", "A"),
      ],
    })
    const extended = workspaceView(planView(base))
    assert.equal(extended.groups[0].complete, false)
    assert.equal(extended.groups[0].pendingCount, 1)

    const finished = planRecord({
      groups: [{ key: "A", title: "A", dependsOn: [], submittedAt: "2026-01-01" }],
      questions: [
        question("q1", "A", { state: { status: "recorded", recordedAs: "AR-1", answer: { text: "done" } } }),
        question("q2", "A", { state: { status: "recorded", recordedAs: "AR-2", answer: { text: "later" } } }),
      ],
    })
    assert.equal(workspaceView(planView(finished)).groups[0].complete, true)
  })

  it("should preserve long labels through the model", () => {
    const title = "A".repeat(200)
    const plan = planView(
      planRecord({
        groups: [{ key: "A", title, dependsOn: [], submittedAt: null }],
        questions: [question("q1", "A")],
      }),
    )
    assert.equal(plan.groups[0].title, title)
    assert.equal(workspaceView(plan).groups[0].title, title)
  })

  it("should keep retired and removed-group context inspectable", () => {
    const plan = planView(
      planRecord({
        groups: [{ key: "A", title: "A", dependsOn: [], submittedAt: null }],
        questions: [
          question("retired", "A", {
            state: { status: "retired", answer: { text: "old answer" } },
          }),
          question("removed", "Gone", {
            state: { answer: { text: "removed answer" } },
          }),
        ],
      }),
    )
    assert.equal(plan.retired.find((item) => item.key === "retired").storedAnswer.text, "old answer")
    assert.equal(plan.retired.find((item) => item.key === "removed").removedGroup, true)
    assert.equal(plan.retired.find((item) => item.key === "removed").storedAnswer.text, "removed answer")
  })

  it("should overlay drafts without changing readiness", () => {
    const plan = planView(
      planRecord({
        groups: [{ key: "A", title: "A", dependsOn: [], submittedAt: null }],
        questions: [
          question("q1", "A", {
            type: "single",
            options: [
              { id: "a", label: "A" },
              { id: "b", label: "B" },
            ],
          }),
        ],
      }),
    )
    const overlaid = applyDrafts(
      plan,
      {
        q1: { answer: { choice: "b" }, notes: "draft note" },
      },
      { q1: "offline" },
    )
    const overlaidQuestion = overlaid.groups[0].questions[0]
    assert.equal(overlaidQuestion.options.find((option) => option.id === "b").selected, true)
    assert.equal(overlaidQuestion.notes, "draft note")
    assert.equal(overlaidQuestion.hasDraft, true)
    assert.equal(overlaidQuestion.error, "offline")
    assert.equal(overlaid.groups[0].ready, plan.groups[0].ready)
    assert.deepEqual(overlaid.submitAll, plan.submitAll)
  })

  it("should route empty and complete selections safely", () => {
    const plan = planView(
      planRecord({
        groups: [
          { key: "A", title: "A", dependsOn: [], submittedAt: null },
          { key: "Empty", title: "Empty", dependsOn: [], submittedAt: null },
        ],
        questions: [
          question("q1", "A", { state: { status: "recorded", answer: { text: "done" } } }),
        ],
      }),
    )
    assert.deepEqual(selectWorkspace(plan).target, { kind: "summary" })
    assert.deepEqual(nextWorkspace(plan, "A"), { kind: "summary" })
    assert.deepEqual(selectWorkspace(plan, { kind: "group", key: "Empty" }).target, {
      kind: "group",
      key: "Empty",
    })
  })
})
