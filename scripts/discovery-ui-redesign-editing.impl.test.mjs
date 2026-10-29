/**
 * Implementation tests for the Discovery plan editor and navigation gate.
 *
 * These cases cover timer disposal, queue ordering, discard/reset edges, and
 * gate interleavings that are easy to break without changing the observable
 * specification.
 *
 * @module discovery-ui-redesign-editing.impl.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createPlanEditor, shouldWarnBeforeUnload } from "../discovery-ui/src/plan-editor.ts"
import { createNavigationGate } from "../discovery-ui/src/navigation.ts"

/** A promise plus its settlement functions. */
function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Deep-clone a test value. */
function clone(value) {
  return structuredClone(value)
}

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

/** A small plan. */
function planFixture() {
  return {
    slug: "billing",
    title: "Billing",
    kind: "plan",
    artifact: "plans/billing",
    revision: 1,
    orphaned: false,
    archived: false,
    unarchivedAt: null,
    groups: [{ key: "G", title: "Group", dependsOn: [], submittedAt: null }],
    questions: [question("q1", "G"), question("q2", "G")],
  }
}

/** Wrap a plan for the initial editor response. */
function response(plan) {
  return {
    project: { slug: "repo", name: "Repo", branch: "main", directory: "/work/repo" },
    plan,
  }
}

/** A scripted API whose calls stay pending. */
function scriptedApi(initial) {
  const saves = []
  const gets = []
  return {
    api: {
      listProjects: async () => ({ ok: true, data: { repositories: [] } }),
      getProject: async () => ({ ok: true, data: response(initial) }),
      getPlan: () => {
        const call = deferred()
        gets.push(call)
        return call.promise
      },
      saveAnswer: (project, plan, key, baseRevision, patch) => {
        const call = deferred()
        saves.push({ project, plan, key, baseRevision, patch, ...call })
        return call.promise
      },
      submit: async () => ({ ok: true, data: { submission: {}, skipped: [], delivery: "pending" } }),
      archive: async () => ({ ok: true, data: { archived: true } }),
      deletePlan: async () => ({ ok: true, data: { deleted: true } }),
    },
    saves,
    gets,
  }
}

/** Create an editor over the fixture. */
function createEditor(harness) {
  const changes = []
  const editor = createPlanEditor({
    project: "repo",
    plan: "billing",
    api: harness.api,
    initial: response(planFixture()),
    onChange: (snapshot) => changes.push(snapshot),
  })
  return { editor, changes }
}

/** Let queued microtasks run. */
async function drainMicrotasks() {
  for (let turn = 0; turn < 12; turn += 1) await Promise.resolve()
}

describe("debounce and disposal", () => {
  it("should wait 500ms, then start one save", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    editor.edit("q1", { answer: { text: "A" } })
    assert.equal(harness.saves.length, 0)
    t.mock.timers.tick(499)
    assert.equal(harness.saves.length, 0)
    t.mock.timers.tick(1)
    assert.equal(harness.saves.length, 1)
    editor.dispose()
  })

  it("should clear the debounce timer and reject a post-dispose flush", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    editor.edit("q1", { answer: { text: "A" } })
    editor.dispose()
    t.mock.timers.tick(500)
    assert.equal(harness.saves.length, 0)
    assert.equal(await editor.flush(), false)
  })
})

describe("serialized queue", () => {
  it("should write different questions one at a time in insertion order", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    const base = planFixture()
    editor.edit("q2", { answer: { choice: "a" } })
    editor.edit("q1", { answer: { choice: "b" } })
    assert.equal(harness.saves.length, 1)
    assert.equal(harness.saves[0].key, "q2")

    harness.saves[0].resolve({ ok: true, data: { plan: base } })
    await drainMicrotasks()
    assert.equal(harness.saves.length, 2)
    assert.equal(harness.saves[1].key, "q1")
    editor.dispose()
  })

  it("should keep one question's error while another question saves", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    const base = planFixture()

    editor.edit("q1", { answer: { text: "A" } })
    const failed = editor.flush()
    harness.saves[0].resolve({ ok: false, kind: "network", message: "offline" })
    assert.equal(await failed, false)
    assert.equal(editor.snapshot().errors.q1, "offline")

    editor.edit("q2", { answer: { choice: "a" } })
    assert.equal(harness.saves.length, 2)
    assert.equal(harness.saves[1].key, "q2")
    harness.saves[1].resolve({ ok: true, data: { plan: base } })
    await drainMicrotasks()
    assert.equal(editor.snapshot().errors.q1, "offline")
    assert.equal(editor.snapshot().drafts.q1.answer.text, "A")
    assert.equal(editor.snapshot().drafts.q2, undefined)
    editor.dispose()
  })

  it("should keep a blocked retry disabled until retry is called", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    editor.edit("q1", { answer: { text: "A" } })
    const first = editor.flush()
    harness.saves[0].resolve({ ok: false, kind: "network", message: "offline" })
    assert.equal(await first, false)
    assert.equal(editor.snapshot().status, "error")

    const blocked = editor.flush()
    assert.equal(await blocked, false)
    assert.equal(harness.saves.length, 1, "flush does not silently retry a blocked save")

    const retried = editor.retry()
    assert.equal(harness.saves.length, 2)
    harness.saves[1].resolve({ ok: true, data: { plan: planFixture() } })
    assert.equal(await retried, true)
  })
})

describe("discard and terminal reset", () => {
  it("should keep recheck active until discard", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    editor.edit("q1", { answer: { text: "A" } })
    const failed = editor.flush()
    harness.saves[0].resolve({ ok: false, kind: "read-only", message: "frozen" })
    await drainMicrotasks()
    harness.gets[0].resolve({ ok: true, data: response(planFixture()) })
    assert.equal(await failed, false)
    assert.equal(editor.snapshot().recheckRequired, true)
    assert.equal(await editor.retry(), false, "retry is disabled while recheck is required")

    const before = editor.snapshot().discardAllVersion
    editor.discardAll()
    assert.equal(editor.snapshot().recheckRequired, false)
    assert.equal(editor.snapshot().discardAllVersion, before + 1)
  })

  it("should keep drafts through a refresh failure and expose the error", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    editor.edit("q1", { answer: { text: "A" } })
    const refresh = editor.refresh()
    harness.gets[0].resolve({ ok: false, kind: "network", message: "offline" })
    await refresh
    assert.equal(editor.snapshot().lastError, "offline")
    assert.equal(editor.snapshot().drafts.q1.answer.text, "A")
  })

  it("should warn before unload only while work is unfinished", () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    assert.equal(shouldWarnBeforeUnload(editor.snapshot()), false)
    editor.edit("q1", { answer: { text: "A" } })
    assert.equal(shouldWarnBeforeUnload(editor.snapshot()), true)
    editor.discard("q1")
    assert.equal(shouldWarnBeforeUnload(editor.snapshot()), false)
    editor.dispose()
  })

  it("should queue one refresh until the in-flight write drains", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    editor.edit("q1", { answer: { choice: "a" } })
    const refresh = editor.refresh()
    assert.equal(harness.gets.length, 0)
    harness.saves[0].resolve({ ok: true, data: { plan: planFixture() } })
    await drainMicrotasks()
    assert.equal(harness.gets.length, 1)
    harness.gets[0].resolve({ ok: true, data: response(planFixture()) })
    await refresh
    editor.dispose()
  })
})

describe("navigation gate interleavings", () => {
  it("should replace the displayed route when flush fails and keep the draft", async () => {
    const writes = []
    const gate = createNavigationGate({
      flush: async () => false,
      write: (hash, options) => writes.push({ hash, options }),
      current: () => "#/p/repo/plan",
    })
    gate.request("#/p/repo/plan/summary", { replace: true })
    assert.equal(await gate.settle(), false)
    assert.deepEqual(writes, [{ hash: "#/p/repo/plan", options: { replace: true } }])
  })

  it("should cancel a flush that is already running", async () => {
    const flushes = []
    const writes = []
    const gate = createNavigationGate({
      flush: () => {
        const call = deferred()
        flushes.push(call)
        return call.promise
      },
      write: (hash, options) => writes.push({ hash, options }),
      current: () => "#/p/repo/plan",
    })
    gate.request("#/p/repo/plan/summary")
    const settled = gate.settle()
    gate.cancel()
    flushes[0].resolve(true)
    assert.equal(await settled, false)
    assert.deepEqual(writes, [{ hash: "#/p/repo/plan", options: { replace: true } }])
  })

  it("should commit a replacement request with the replacement flag", async () => {
    const writes = []
    const gate = createNavigationGate({
      flush: async () => true,
      write: (hash, options) => writes.push({ hash, options }),
      current: () => "#/p/repo/plan",
    })
    gate.request("#/p/repo/plan/summary", { replace: true })
    assert.equal(await gate.settle(), true)
    assert.deepEqual(writes, [{ hash: "#/p/repo/plan/summary", options: { replace: true } }])
  })
})
