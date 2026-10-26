/**
 * Implementation tests for the Discovery web UI.
 *
 * These cases cover encoding edges, empty lists, text answers, the plan flags,
 * and the API client's URL and body construction. They may change with the
 * implementation; the specification tests may not.
 *
 * @module discovery-ui.impl.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createApi } from "../discovery-ui/src/api.ts"
import { formatRoute, parseRoute } from "../discovery-ui/src/route.ts"
import { planView, projectsView } from "../discovery-ui/src/view-models.ts"

/** A minimal stored plan. */
function planRecord(extra = {}) {
  return {
    slug: "billing",
    title: "Billing",
    kind: "plan",
    artifact: "plans/billing",
    revision: 1,
    orphaned: false,
    archived: false,
    unarchivedAt: null,
    groups: [{ key: "A", title: "A", dependsOn: [], submittedAt: null }],
    questions: [],
    ...extra,
  }
}

/** A stored question with the documented state. */
function question(extra = {}) {
  return {
    key: "q1",
    group: "A",
    type: "text",
    title: "Question",
    fingerprint: "f",
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
    },
    ...extra,
  }
}

describe("route edges", () => {
  it("should decode percent-encoded slugs and send not-found routes home", () => {
    assert.deepEqual(parseRoute("#/p/my%2Drepo"), { view: "project", project: "my-repo" })
    assert.equal(formatRoute({ view: "not-found" }), "#/")
    assert.equal(formatRoute({ view: "projects" }), "#/")
  })
})

describe("view-model edges", () => {
  it("should expose archive and orphan flags", () => {
    const view = planView(planRecord({ archived: true, orphaned: true, unarchivedAt: "2026-01-01" }))
    assert.equal(view.archived, true)
    assert.equal(view.orphaned, true)
    assert.equal(view.unarchivedAt, "2026-01-01")
  })

  it("should show a text answer and an empty group summary", () => {
    const view = planView(
      planRecord({
        questions: [
          question({
            key: "q1",
            state: {
              answer: { text: "hello" },
              notes: "note",
              defer: null,
              needsDiscussion: false,
              proposalDismissed: false,
              status: "open",
              changed: false,
              recordedAs: null,
            },
          }),
        ],
        groups: [
          { key: "A", title: "A", dependsOn: [], submittedAt: null },
          { key: "B", title: "B", dependsOn: [], submittedAt: null },
        ],
      }),
    )
    assert.equal(view.groups.find((group) => group.key === "A").questions[0].text, "hello")
    assert.equal(view.groups.find((group) => group.key === "B").summary, "0 of 0 ready")
  })

  it("should accept an empty repository list", () => {
    assert.deepEqual(projectsView([]), { repositories: [] })
  })
})

describe("api construction", () => {
  it("should build the submit path and body", async () => {
    const calls = []
    const api = createApi("http://x/", async (url, init) => {
      calls.push({ url, init })
      return { ok: true, status: 200, json: async () => ({ submission: {} }) }
    })
    await api.submit("my repo", "billing", null, 4)
    assert.equal(calls[0].url, "http://x/api/projects/my%20repo/plans/billing/submit")
    assert.deepEqual(JSON.parse(calls[0].init.body), { group: null, baseRevision: 4 })
    assert.equal(calls[0].init.headers["Content-Type"], "application/json")
  })

  it("should map a read-only conflict and a generic server error", async () => {
    const readOnly = await createApi("http://x", async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: "read-only", message: "frozen" }),
    })).saveAnswer("p", "pl", "q1", 1, {})
    assert.equal(readOnly.ok, false)
    assert.equal(readOnly.kind, "read-only")

    const internal = await createApi("http://x", async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "internal" }),
    })).getPlan("p", "pl")
    assert.equal(internal.ok, false)
    assert.equal(internal.kind, "http")
    assert.equal(internal.status, 500)
  })
})
