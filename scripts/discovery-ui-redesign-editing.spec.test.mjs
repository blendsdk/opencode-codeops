/**
 * Specification tests for Discovery editing and guarded navigation.
 *
 * These cases drive the plan-local editor and the pure navigation gate with
 * controlled API promises. They are written from the documented observable
 * behaviour: pending drafts stay visible, saves are acknowledged in order,
 * navigation waits for a successful save, and terminal drafts remain
 * recoverable.
 *
 * @module discovery-ui-redesign-editing.spec.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createPlanEditor } from "../discovery-ui/src/plan-editor.ts"
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

/** Deep-clone a value used by a test. */
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

/** A stored plan with two text questions and one choice question. */
function planFixture(overrides = {}) {
  return {
    slug: "billing",
    title: "Billing",
    kind: "plan",
    artifact: "plans/billing",
    revision: 1,
    orphaned: false,
    archived: false,
    unarchivedAt: null,
    groups: [
      { key: "G", title: "Group", dependsOn: [], submittedAt: null },
      { key: "H", title: "Other", dependsOn: [], submittedAt: null },
    ],
    questions: [
      question("q1", "G"),
      question("q2", "G"),
      question("q3", "G", {
        type: "single",
        options: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
      }),
      question("q4", "H"),
    ],
    ...overrides,
  }
}

/** A stored plan whose first group is ready to submit. */
function readyPlanFixture() {
  const plan = planFixture()
  plan.questions[0].state.answer = { text: "one" }
  plan.questions[1].state.answer = { text: "two" }
  plan.questions[2].state.answer = { choice: "a" }
  return plan
}

/** A plan response wrapper. */
function response(plan) {
  return {
    project: { slug: "repo", name: "Repo", branch: "main", directory: "/work/repo" },
    plan,
  }
}

/** Replace one question state and advance the revision. */
function withQuestionState(plan, key, update) {
  const next = clone(plan)
  const target = next.questions.find((item) => item.key === key)
  target.state = { ...target.state, ...update }
  next.revision += 1
  return next
}

/** A scripted API whose calls stay pending until the test settles them. */
function scriptedApi(initialPlan) {
  const saves = []
  const submits = []
  const gets = []
  let current = response(initialPlan)
  return {
    api: {
      listProjects: async () => ({ ok: true, data: { repositories: [] } }),
      getProject: async () => ({ ok: true, data: current }),
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
      submit: (project, plan, group, baseRevision) => {
        const call = deferred()
        submits.push({ project, plan, group, baseRevision, ...call })
        return call.promise
      },
      archive: async () => ({ ok: true, data: { archived: true } }),
      deletePlan: async () => ({ ok: true, data: { deleted: true } }),
    },
    saves,
    submits,
    gets,
    current: () => current,
    setCurrent: (next) => {
      current = next
    },
  }
}

/** Create an editor over the fixture and scripted API. */
function createEditor(harness, options = {}) {
  const changes = []
  const editor = createPlanEditor({
    project: "repo",
    plan: "billing",
    api: harness.api,
    initial: response(options.plan ?? planFixture()),
    onChange: (snapshot) => changes.push(snapshot),
  })
  return { editor, changes }
}

/** Let queued microtasks run. */
async function settleMicrotasks() {
  for (let turn = 0; turn < 12; turn += 1) await Promise.resolve()
}

/** Resolve one save with a cloned plan whose question state changed. */
function acknowledgeSave(harness, index, plan, key, update) {
  harness.saves[index].resolve({
    ok: true,
    data: { plan: withQuestionState(plan, key, update) },
  })
}

describe("editing and debounce (ST-10)", () => {
  it("should merge distinct fields and questions, waiting for text or blur", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)

    editor.edit("q1", { answer: { text: "a" } })
    editor.edit("q1", { answer: { text: "ab" } })
    editor.edit("q1", { notes: "note" })
    editor.edit("q2", { answer: { text: "other" } })

    assert.deepEqual(editor.snapshot().drafts.q1, {
      answer: { text: "ab" },
      notes: "note",
    })
    assert.deepEqual(editor.snapshot().drafts.q2, { answer: { text: "other" } })
    assert.equal(harness.saves.length, 0, "text edits wait for the debounce or blur")
    assert.equal(editor.snapshot().status, "dirty")

    const flushed = editor.flush()
    assert.equal(harness.saves.length, 1)
    assert.deepEqual(harness.saves[0].patch, { answer: { text: "ab" }, notes: "note" })
    acknowledgeSave(harness, 0, planFixture(), "q1", {
      answer: { text: "ab" },
      notes: "note",
    })
    await settleMicrotasks()
    assert.equal(harness.saves.length, 2, "the second question is written after the first")
    acknowledgeSave(harness, 1, planFixture(), "q2", { answer: { text: "other" } })
    assert.equal(await flushed, true)
    assert.deepEqual(editor.snapshot().drafts, {})
    assert.equal(editor.snapshot().status, "saved")
  })

  it("should save a choice immediately", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    editor.edit("q3", { answer: { choice: "a" } })
    assert.equal(harness.saves.length, 1)
    assert.deepEqual(harness.saves[0].patch, { answer: { choice: "a" } })
    acknowledgeSave(harness, 0, planFixture(), "q3", { answer: { choice: "a" } })
    await settleMicrotasks()
  })
})

describe("acknowledgement ordering (ST-11)", () => {
  it("should keep a newer draft when an older save acknowledges", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    const base = planFixture()

    editor.edit("q1", { answer: { text: "A" } })
    const first = editor.flush()
    assert.equal(harness.saves.length, 1)

    editor.edit("q1", { answer: { text: "B" } })
    acknowledgeSave(harness, 0, base, "q1", { answer: { text: "A" } })
    await settleMicrotasks()

    assert.equal(editor.snapshot().drafts.q1.answer.text, "B")
    assert.notEqual(editor.snapshot().status, "saved")
    assert.equal(harness.saves.length, 2, "the newer draft is written next")
    assert.deepEqual(harness.saves[1].patch, { answer: { text: "B" } })

    acknowledgeSave(harness, 1, base, "q1", { answer: { text: "B" } })
    assert.equal(await first, true)
    assert.deepEqual(editor.snapshot().drafts, {})
    assert.equal(editor.snapshot().status, "saved")
  })
})

describe("shared flush (ST-12)", () => {
  it("should share one drain across callers without duplicate patches", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    const base = planFixture()

    editor.edit("q1", { answer: { text: "A" } })
    const first = editor.flush()
    const second = editor.flush()
    assert.equal(harness.saves.length, 1)

    editor.edit("q1", { notes: "later note" })
    acknowledgeSave(harness, 0, base, "q1", { answer: { text: "A" } })
    await settleMicrotasks()

    assert.equal(harness.saves.length, 2)
    assert.deepEqual(harness.saves[1].patch, { answer: { text: "A" }, notes: "later note" })
    acknowledgeSave(harness, 1, base, "q1", { answer: { text: "A" }, notes: "later note" })

    assert.deepEqual(await Promise.all([first, second]), [true, true])
    assert.deepEqual(editor.snapshot().drafts, {})
  })
})

describe("navigation gate (ST-13)", () => {
  it("should flush before committing and keep only the latest request", async () => {
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

    gate.request("#/p/repo/plan/groups/A", { replace: false })
    const first = gate.settle()
    gate.request("#/p/repo/plan/groups/B", { replace: false })
    const second = gate.settle()
    assert.equal(flushes.length, 1, "the gate joins one drain")

    flushes[0].resolve(true)
    assert.equal(await first, true)
    assert.equal(await second, true)
    assert.deepEqual(writes, [
      { hash: "#/p/repo/plan/groups/B", options: { replace: false } },
    ])
  })

  it("should restore the displayed route when the save fails", async () => {
    const writes = []
    const gate = createNavigationGate({
      flush: async () => false,
      write: (hash, options) => writes.push({ hash, options }),
      current: () => "#/p/repo/plan/groups/A",
    })
    gate.request("#/p/repo/plan/summary", { replace: false })
    assert.equal(await gate.settle(), false)
    assert.deepEqual(writes, [
      { hash: "#/p/repo/plan/groups/A", options: { replace: true } },
    ])
  })

  it("should cancel a pending request and restore the displayed route", async () => {
    const writes = []
    const gate = createNavigationGate({
      flush: async () => true,
      write: (hash, options) => writes.push({ hash, options }),
      current: () => "#/p/repo/plan/groups/A",
    })
    gate.request("#/p/repo/plan/summary", { replace: false })
    gate.cancel()
    assert.equal(await gate.settle(), false)
    assert.deepEqual(writes, [
      { hash: "#/p/repo/plan/groups/A", options: { replace: true } },
    ])
  })
})

describe("gate disposal (ST-14)", () => {
  it("should drop a late flush result after disposal", async () => {
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
    gate.request("#/p/repo/plan/summary", { replace: false })
    const settled = gate.settle()
    gate.dispose()
    flushes[0].resolve(true)
    assert.equal(await settled, false)
    assert.deepEqual(writes, [])
  })

  it("should ignore a late save acknowledgement after editor disposal", async () => {
    const harness = scriptedApi(planFixture())
    const changes = []
    const editor = createPlanEditor({
      project: "repo",
      plan: "billing",
      api: harness.api,
      initial: response(planFixture()),
      onChange: (snapshot) => changes.push(snapshot),
    })
    editor.edit("q1", { answer: { text: "A" } })
    const flushed = editor.flush()
    const before = changes.length
    editor.dispose()
    acknowledgeSave(harness, 0, planFixture(), "q1", { answer: { text: "A" } })
    assert.equal(await flushed, false)
    assert.equal(changes.length, before, "no callback runs after disposal")
  })
})

describe("save failures and retry (ST-15)", () => {
  it("should retain the draft and clear the error after a successful retry", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    const base = planFixture()

    editor.edit("q1", { answer: { text: "A" } })
    const failed = editor.flush()
    harness.saves[0].resolve({ ok: false, kind: "network", message: "offline" })
    assert.equal(await failed, false)
    assert.equal(editor.snapshot().status, "error")
    assert.equal(editor.snapshot().errors.q1, "offline")
    assert.equal(editor.snapshot().drafts.q1.answer.text, "A")

    editor.edit("q1", { answer: { text: "fixed" } })
    assert.equal(editor.snapshot().status, "dirty")
    const retried = editor.flush()
    acknowledgeSave(harness, 1, base, "q1", { answer: { text: "fixed" } })
    assert.equal(await retried, true)
    assert.equal(editor.snapshot().errors.q1, undefined)
    assert.deepEqual(editor.snapshot().drafts, {})
  })

  it("should associate an invalid input failure with its question", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    editor.edit("q2", { answer: { text: "bad" } })
    const failed = editor.flush()
    harness.saves[0].resolve({ ok: false, kind: "invalid", message: "text is invalid" })
    assert.equal(await failed, false)
    assert.equal(editor.snapshot().errors.q2, "text is invalid")
    assert.equal(editor.snapshot().drafts.q2.answer.text, "bad")
  })
})

describe("live refresh and stale reads (ST-16)", () => {
  it("should not let an older read replace a newer local acknowledgement", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    const base = planFixture()

    const refresh = editor.refresh()
    assert.equal(harness.gets.length, 1)
    editor.edit("q1", { answer: { text: "A" } })
    const flushed = editor.flush()
    acknowledgeSave(harness, 0, base, "q1", { answer: { text: "A" } })
    await settleMicrotasks()

    harness.gets[0].resolve({ ok: true, data: response(base) })
    await settleMicrotasks()
    assert.equal(harness.gets.length, 2, "a fresh read follows the stale one")
    harness.gets[1].resolve({
      ok: true,
      data: response(withQuestionState(base, "q1", { answer: { text: "A" } })),
    })
    await refresh
    assert.equal(editor.snapshot().server.plan.questions[0].state.answer.text, "A")
    assert.equal(await flushed, true)
  })

  it("should send the revision visible when the draft started", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    const base = planFixture()

    editor.edit("q1", { answer: { text: "A" } })
    const refresh = editor.refresh()
    const republished = withQuestionState(base, "q2", { notes: "new publish" })
    harness.gets[0].resolve({ ok: true, data: response(republished) })
    await refresh

    const flushed = editor.flush()
    assert.equal(harness.saves[0].baseRevision, 1, "the draft keeps its original revision")
    harness.saves[0].resolve({ ok: false, kind: "stale", message: "republished" })
    await settleMicrotasks()
    assert.equal(await flushed, false)
    assert.equal(editor.snapshot().recheckRequired, true)

    editor.edit("q1", { answer: { text: "reviewed" } })
    const reviewed = editor.flush()
    assert.equal(harness.saves[1].baseRevision, 2, "a reviewed draft starts from the refreshed revision")
    acknowledgeSave(harness, 1, republished, "q1", { answer: { text: "reviewed" } })
    assert.equal(await reviewed, true)
    assert.equal(editor.snapshot().recheckRequired, false)
  })

  it("should confirm a save 404 with a plan read before marking the plan deleted", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    const base = planFixture()

    editor.edit("q1", { answer: { text: "A" } })
    const flushed = editor.flush()
    harness.saves[0].resolve({ ok: false, kind: "not-found", message: "question missing" })
    await settleMicrotasks()
    assert.equal(harness.gets.length, 1)
    harness.gets[0].resolve({ ok: true, data: response(base) })
    await settleMicrotasks()
    assert.equal(editor.snapshot().deleted, false)
    assert.equal(editor.snapshot().drafts.q1.answer.text, "A")
    assert.equal(await flushed, false)
    editor.discard("q1")
  })

  it("should keep a deleted plan terminal but allow leaving after discard", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    editor.edit("q1", { answer: { text: "A" } })
    const flushed = editor.flush()
    harness.saves[0].resolve({ ok: false, kind: "not-found", message: "plan gone" })
    await settleMicrotasks()
    harness.gets[0].resolve({ ok: false, kind: "not-found", message: "plan gone" })
    await settleMicrotasks()
    assert.equal(await flushed, false)
    assert.equal(editor.snapshot().deleted, true)
    assert.equal(await editor.flush(), false, "a retained draft still blocks leaving")
    editor.discardAll()
    assert.equal(await editor.flush(), true, "the terminal plan can be left after discarding")
  })

  it("should coalesce a refresh while local writes drain", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    const base = planFixture()

    editor.edit("q1", { answer: { text: "A" } })
    const flushed = editor.flush()
    const refresh = editor.refresh()
    assert.equal(harness.gets.length, 0, "the read waits for the write to drain")

    acknowledgeSave(harness, 0, base, "q1", { answer: { text: "A" } })
    await settleMicrotasks()
    assert.equal(harness.gets.length, 1)
    harness.gets[0].resolve({
      ok: true,
      data: response(withQuestionState(base, "q1", { answer: { text: "A" } })),
    })
    await Promise.all([flushed, refresh])
    assert.equal(editor.snapshot().server.plan.questions[0].state.answer.text, "A")
  })
})

describe("terminal drafts (ST-17)", () => {
  it("should retain a draft after a stale response and allow an explicit discard", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    const base = planFixture()

    editor.edit("q1", { answer: { text: "attempt" } })
    const flushed = editor.flush()
    harness.saves[0].resolve({ ok: false, kind: "stale", message: "changed elsewhere" })
    await settleMicrotasks()
    assert.equal(harness.gets.length, 1)
    harness.gets[0].resolve({
      ok: true,
      data: response(withQuestionState(base, "q1", { status: "submitted" })),
    })
    assert.equal(await flushed, false)

    const snapshot = editor.snapshot()
    assert.equal(snapshot.recheckRequired, true)
    assert.equal(snapshot.status, "recheck")
    assert.equal(snapshot.drafts.q1.answer.text, "attempt")
    assert.equal(snapshot.unsaved, true)

    editor.discard("q1")
    assert.deepEqual(editor.snapshot().drafts, {})
    assert.equal(editor.snapshot().unsaved, false)
    assert.equal(await editor.flush(), true, "navigation can proceed after the discard")
  })

  it("should clear recheck after the reviewed draft saves", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    const base = planFixture()

    editor.edit("q1", { answer: { text: "attempt" } })
    const stale = editor.flush()
    harness.saves[0].resolve({ ok: false, kind: "stale", message: "changed elsewhere" })
    await settleMicrotasks()
    harness.gets[0].resolve({
      ok: true,
      data: response(withQuestionState(base, "q1", { status: "open" })),
    })
    assert.equal(await stale, false)
    assert.equal(editor.snapshot().recheckRequired, true)
    assert.equal(await editor.flush(), false, "the old draft is not replayed automatically")

    editor.edit("q1", { answer: { text: "reviewed" } })
    assert.equal(editor.snapshot().recheckRequired, false)
    const reviewed = editor.flush()
    acknowledgeSave(harness, 1, base, "q1", { answer: { text: "reviewed" } })
    assert.equal(await reviewed, true)
    assert.equal(editor.snapshot().status, "saved")
    assert.deepEqual(editor.snapshot().drafts, {})
  })

  it("should keep a hidden draft in the draft map and discard it explicitly", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    const base = planFixture()

    editor.edit("q1", { answer: { text: "hidden draft" } })
    const refresh = editor.refresh()
    const hidden = clone(base)
    hidden.questions[0].showIf = [{ question: "q4", anyOf: ["yes"] }]
    harness.gets[0].resolve({ ok: true, data: response(hidden) })
    await refresh

    assert.equal(editor.snapshot().drafts.q1.answer.text, "hidden draft")
    editor.discard("q1")
    assert.deepEqual(editor.snapshot().drafts, {})
  })

  it("should mark a deleted plan as terminal after a successful load", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    const refresh = editor.refresh()
    harness.gets[0].resolve({ ok: false, kind: "not-found", message: "plan deleted" })
    await refresh
    assert.equal(editor.snapshot().deleted, true)
    assert.equal(editor.snapshot().lastError, "plan deleted")
  })
})

describe("submission (ST-18, ST-19)", () => {
  it("should flush before submitting and use the accepted revision", async () => {
    const harness = scriptedApi(readyPlanFixture())
    const { editor } = createEditor(harness, { plan: readyPlanFixture() })
    const base = readyPlanFixture()

    editor.edit("q1", { answer: { text: "A" } })
    const submitting = editor.submit("G")
    await settleMicrotasks()
    assert.equal(harness.saves.length, 1)
    assert.equal(harness.submits.length, 0)

    acknowledgeSave(harness, 0, base, "q1", { answer: { text: "A" } })
    await settleMicrotasks()
    assert.equal(harness.submits.length, 1)
    assert.equal(harness.submits[0].baseRevision, 2)

    harness.submits[0].resolve({
      ok: true,
      data: {
        submission: { id: 1, groups: ["G"], count: 1 },
        skipped: [],
        delivery: "woken",
      },
    })
    const outcome = await submitting
    assert.deepEqual(outcome, { ok: true, delivery: "woken", message: null, missing: [] })
    assert.equal(editor.snapshot().delivery, "woken")
    assert.equal(editor.snapshot().submitting, false)
  })

  it("should not submit when the flush fails or the group is not ready", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)

    editor.edit("q1", { answer: { text: "A" } })
    const failed = editor.submit("G")
    harness.saves[0].resolve({ ok: false, kind: "network", message: "offline" })
    const outcome = await failed
    assert.equal(outcome.ok, false)
    assert.equal(harness.submits.length, 0)

    editor.discardAll()
    const notReady = await editor.submit("G")
    assert.equal(notReady.ok, false)
    assert.equal(harness.submits.length, 0)
    assert.match(notReady.message, /unanswered|nothing to submit/i)
  })

  it("should prevent a duplicate submit while one is in flight", async () => {
    const harness = scriptedApi(readyPlanFixture())
    const { editor } = createEditor(harness, { plan: readyPlanFixture() })
    const base = planFixture()
    const first = editor.submit("G")
    const second = editor.submit("G")
    await settleMicrotasks()
    assert.equal(harness.submits.length, 1)
    harness.submits[0].resolve({
      ok: true,
      data: {
        submission: { id: 1, groups: ["G"], count: 1 },
        skipped: [],
        delivery: "pending",
      },
    })
    assert.equal((await first).ok, true)
    assert.equal((await second).ok, false)
    assert.equal(editor.snapshot().delivery, "pending")
  })

  it("should keep skipped groups and refresh before retrying an uncertain outcome", async () => {
    const harness = scriptedApi(readyPlanFixture())
    const { editor } = createEditor(harness, { plan: readyPlanFixture() })

    const first = editor.submit(null)
    await settleMicrotasks()
    harness.submits[0].resolve({
      ok: false,
      kind: "network",
      message: "connection lost",
    })
    const outcome = await first
    assert.equal(outcome.ok, false)
    assert.equal(outcome.delivery, null)
    assert.equal(editor.snapshot().lastError, "connection lost")

    const retried = editor.submit(null)
    assert.equal(harness.gets.length, 1, "the retry reconciles the server state first")
    harness.gets[0].resolve({ ok: true, data: response(readyPlanFixture()) })
    await settleMicrotasks()
    assert.equal(harness.submits.length, 2)
    harness.submits[1].resolve({
      ok: true,
      data: {
        submission: { id: 2, groups: [], count: 0 },
        skipped: [{ group: "G", missing: [{ key: "q1", reason: "unanswered" }] }],
        delivery: "pending",
      },
    })
    const retryOutcome = await retried
    assert.equal(retryOutcome.ok, true)
    assert.equal(retryOutcome.delivery, "pending")
    assert.deepEqual(retryOutcome.missing, [{ group: "G", missing: [{ key: "q1", reason: "unanswered" }] }])
    assert.deepEqual(editor.snapshot().missing, retryOutcome.missing)
  })
})

describe("incomplete work and discard (ST-20)", () => {
  it("should block flushing and navigation while an incomplete deferral exists", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)

    editor.setIncomplete("q2", true, "defer")
    assert.deepEqual(editor.snapshot().incomplete.q2, { reason: "defer" })
    assert.equal(editor.snapshot().unsaved, true)
    assert.equal(await editor.flush(), false)
    assert.equal(harness.saves.length, 0)

    editor.setIncomplete("q2", false)
    assert.deepEqual(editor.snapshot().incomplete, {})
    assert.equal(editor.snapshot().unsaved, false)
    assert.equal(await editor.flush(), true)
  })

  it("should keep incomplete work through a live refresh and clear it on discard", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    const refresh = editor.refresh()
    harness.gets[0].resolve({ ok: true, data: response(planFixture()) })
    await refresh

    editor.setIncomplete("q2", true, "defer")
    const another = editor.refresh()
    harness.gets[1].resolve({ ok: true, data: response(planFixture()) })
    await another
    assert.deepEqual(editor.snapshot().incomplete.q2, { reason: "defer" })

    editor.discardAll()
    assert.deepEqual(editor.snapshot().incomplete, {})
    assert.equal(editor.snapshot().unsaved, false)
  })

  it("should clear an in-flight acknowledgement after a discard", async () => {
    const harness = scriptedApi(planFixture())
    const { editor } = createEditor(harness)
    const base = planFixture()
    editor.edit("q1", { answer: { text: "discarded" } })
    const flushed = editor.flush()
    editor.discard("q1")
    acknowledgeSave(harness, 0, base, "q1", { answer: { text: "discarded" } })
    assert.equal(await flushed, true)
    assert.deepEqual(editor.snapshot().drafts, {})
    assert.equal(editor.snapshot().unsaved, false)
  })
})
