/**
 * Specification tests for the live progress core.
 *
 * These tests pin the observable contract before any implementation exists:
 * the progress report and run-state schemas, the defensive normalization and
 * guard rules, the in-memory run state, the monotonic merge, the staleness
 * check, the honesty display, and the extended CodeOps RPC (definition,
 * registration binding, and the snapshot request helper).
 *
 * This is the specification oracle: a failing test means the implementation is
 * wrong, never the test.
 *
 * @module progress-core.spec.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

/** A fixed local timestamp used across the display tests (18:37 local time). */
const UPDATED_AT = new Date(2026, 0, 2, 18, 37).getTime()

/**
 * Import the progress core module under test.
 *
 * The import resolves per call so this file loads — and reports per-test
 * failures — before the module exists, the red-phase state of a
 * specification-first suite.
 *
 * @returns {Promise<object>} The module namespace.
 */
async function core() {
  return import("../bin/lib/codeops-progress.mjs")
}

/**
 * Import the RPC helper module under test.
 *
 * @returns {Promise<object>} The module namespace.
 */
async function rpc() {
  return import("../bin/lib/codeops-rpc.mjs")
}

/**
 * Format a timestamp as the local `HH:MM` clock text the display shows.
 *
 * @param {number} ms - Epoch milliseconds.
 * @returns {string} The local time as `HH:MM`.
 */
function localTime(ms) {
  const date = new Date(ms)
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

/**
 * Build a complete run snapshot for the display and merge tests.
 *
 * @param {object} [overrides] - Fields replacing the defaults.
 * @returns {object} A snapshot satisfying the run-state schema.
 */
function snapshot(overrides = {}) {
  return {
    plan: "p",
    phase: "Ph",
    task: "T",
    activity: "implementing",
    detail: null,
    verified: 0,
    total: null,
    startedAt: UPDATED_AT,
    updatedAt: UPDATED_AT,
    sessionID: "s1",
    ...overrides,
  }
}

describe("progress report schema (ST-1)", () => {
  it("should require plan and activity with the exact activity enum", async () => {
    const { ProgressReportSchema } = await core()

    assert.equal(ProgressReportSchema.type, "object")
    assert.equal(ProgressReportSchema.additionalProperties, false)
    assert.deepEqual(ProgressReportSchema.required, ["plan", "activity"])
    assert.deepEqual(ProgressReportSchema.properties.activity.enum, [
      "starting",
      "implementing",
      "verifying",
      "reviewing",
      "delegating",
      "waiting",
      "blocked",
      "done",
    ])
  })

  it("should declare the optional field types with non-negative integer counts", async () => {
    const { ProgressReportSchema } = await core()

    assert.deepEqual(ProgressReportSchema.properties.plan, { type: "string" })
    assert.deepEqual(ProgressReportSchema.properties.phase, { type: "string" })
    assert.deepEqual(ProgressReportSchema.properties.task, { type: "string" })
    assert.deepEqual(ProgressReportSchema.properties.detail, { type: "string" })
    assert.deepEqual(ProgressReportSchema.properties.verified, { type: "integer", minimum: 0 })
    assert.deepEqual(ProgressReportSchema.properties.total, { type: "integer", minimum: 0 })
    assert.deepEqual(Object.keys(ProgressReportSchema.properties).sort(), [
      "activity",
      "detail",
      "phase",
      "plan",
      "task",
      "total",
      "verified",
    ])
  })
})

describe("report normalization (ST-2)", () => {
  it("should trim a plan and truncate it at 200 characters", async () => {
    const { normalizeProgressReport } = await core()

    assert.equal(normalizeProgressReport({ plan: " p ", activity: "implementing" }).plan, "p")

    const normalized = normalizeProgressReport({
      plan: "x".repeat(500),
      activity: "implementing",
    })
    assert.equal(normalized.plan, "x".repeat(200))
  })

  it("should floor verified and clamp total", async () => {
    const { normalizeProgressReport } = await core()

    const normalized = normalizeProgressReport({
      plan: "p",
      activity: "implementing",
      verified: 7.9,
      total: 2000000,
    })
    assert.equal(normalized.verified, 7)
    assert.equal(normalized.total, 1000000)
  })

  it("should normalize a whitespace-only optional string to absent", async () => {
    const { normalizeProgressReport } = await core()

    const normalized = normalizeProgressReport({
      plan: "p",
      activity: "implementing",
      task: "   ",
    })
    assert.equal(normalized.task, null)
  })

  it("should reject a report without activity and a whitespace-only plan", async () => {
    const { normalizeProgressReport } = await core()

    assert.equal(normalizeProgressReport({ plan: "p" }), null)
    assert.equal(normalizeProgressReport({ plan: "   ", activity: "done" }), null)
  })
})

describe("progress report guard (ST-3)", () => {
  it("should accept a valid report with and without the optional fields", async () => {
    const { isCodeOpsProgressReport } = await core()

    assert.equal(isCodeOpsProgressReport({ plan: "p", activity: "implementing" }), true)
    assert.equal(
      isCodeOpsProgressReport({
        plan: "p",
        phase: "Ph",
        task: "T",
        activity: "done",
        detail: "d",
        verified: 3,
        total: 14,
      }),
      true
    )
  })

  it("should reject reports missing a required field", async () => {
    const { isCodeOpsProgressReport } = await core()

    assert.equal(isCodeOpsProgressReport({ activity: "implementing" }), false)
    assert.equal(isCodeOpsProgressReport({ plan: "p" }), false)
  })

  it("should reject an unknown activity", async () => {
    const { isCodeOpsProgressReport } = await core()

    assert.equal(isCodeOpsProgressReport({ plan: "p", activity: "bogus" }), false)
  })

  it("should reject wrong field types and out-of-range counts", async () => {
    const { isCodeOpsProgressReport } = await core()

    assert.equal(isCodeOpsProgressReport({ plan: 42, activity: "implementing" }), false)
    assert.equal(isCodeOpsProgressReport({ plan: "p", activity: "implementing", phase: 7 }), false)
    assert.equal(
      isCodeOpsProgressReport({ plan: "p", activity: "implementing", verified: "3" }),
      false
    )
    assert.equal(
      isCodeOpsProgressReport({ plan: "p", activity: "implementing", verified: 7.9 }),
      false
    )
    assert.equal(
      isCodeOpsProgressReport({ plan: "p", activity: "implementing", verified: -1 }),
      false
    )
  })

  it("should reject extra properties and non-object values", async () => {
    const { isCodeOpsProgressReport } = await core()

    assert.equal(isCodeOpsProgressReport({ plan: "p", activity: "done", extra: true }), false)

    for (const value of [undefined, null, "p", 42, true, ["p"]]) {
      assert.equal(isCodeOpsProgressReport(value), false, `must reject ${JSON.stringify(value)}`)
    }
  })
})

describe("run-state guard (ST-4)", () => {
  it("should accept a complete snapshot, including null optional fields", async () => {
    const { isCodeOpsRunState } = await core()

    assert.equal(isCodeOpsRunState(snapshot()), true)
    assert.equal(isCodeOpsRunState(snapshot({ phase: null, task: null, detail: null })), true)
  })

  it("should reject a snapshot missing any required field", async () => {
    const { isCodeOpsRunState } = await core()

    const { detail, ...withoutDetail } = snapshot()
    assert.equal(isCodeOpsRunState(withoutDetail), false)
    const { total, ...withoutTotal } = snapshot()
    assert.equal(isCodeOpsRunState(withoutTotal), false)
  })

  it("should reject wrong types, an unknown activity, and negative timestamps", async () => {
    const { isCodeOpsRunState } = await core()

    assert.equal(isCodeOpsRunState(snapshot({ phase: 7 })), false)
    assert.equal(isCodeOpsRunState(snapshot({ verified: "3" })), false)
    assert.equal(isCodeOpsRunState(snapshot({ startedAt: 1.5 })), false)
    assert.equal(isCodeOpsRunState(snapshot({ activity: "bogus" })), false)
    assert.equal(isCodeOpsRunState(snapshot({ startedAt: -1 })), false)
    assert.equal(isCodeOpsRunState(snapshot({ updatedAt: -1 })), false)
  })

  it("should reject extra keys and non-object values", async () => {
    const { isCodeOpsRunState } = await core()

    assert.equal(isCodeOpsRunState(snapshot({ extra: true })), false)
    assert.equal(isCodeOpsRunState(null), false)
    assert.equal(isCodeOpsRunState("run"), false)
  })
})

describe("run-state runtime (ST-5)", () => {
  it("should create and merge partial reports along the recorded trace", async () => {
    const { createCodeOpsProgress } = await core()
    const runtime = createCodeOpsProgress()

    const first = runtime.report({ plan: "p", activity: "implementing" }, "s1", 1000)
    assert.deepEqual(first, {
      plan: "p",
      phase: null,
      task: null,
      detail: null,
      activity: "implementing",
      verified: 0,
      total: null,
      startedAt: 1000,
      updatedAt: 1000,
      sessionID: "s1",
    })

    const second = runtime.report({ plan: "p", activity: "verifying", task: "T" }, "s1", 2000)
    assert.deepEqual(second, { ...first, activity: "verifying", task: "T", updatedAt: 2000 })

    const third = runtime.report(
      { plan: "p", phase: "Ph", verified: 2, total: 5, activity: "implementing" },
      "s1",
      3000
    )
    assert.deepEqual(third, {
      plan: "p",
      phase: "Ph",
      task: "T",
      detail: null,
      activity: "implementing",
      verified: 2,
      total: 5,
      startedAt: 1000,
      updatedAt: 3000,
      sessionID: "s1",
    })
    assert.deepEqual(runtime.snapshot(), third)
  })
})

describe("monotonic merge (ST-6)", () => {
  it("should keep the current state for older and take the incoming for equal or newer", async () => {
    const { mergeRunState } = await core()

    const current = snapshot({ updatedAt: 2000, task: "current" })
    const older = snapshot({ updatedAt: 1000, task: "older" })
    const equal = snapshot({ updatedAt: 2000, task: "equal" })
    const newer = snapshot({ updatedAt: 3000, task: "newer" })

    assert.equal(mergeRunState(current, older), current)
    assert.equal(mergeRunState(current, equal), equal)
    assert.equal(mergeRunState(current, newer), newer)
  })
})

describe("staleness (ST-7)", () => {
  it("should be false just below ten minutes and true at the threshold", async () => {
    const { isRunStale } = await core()

    assert.equal(isRunStale({ updatedAt: 0 }, 599999), false)
    assert.equal(isRunStale({ updatedAt: 0 }, 600000), true)
  })
})

describe("display lines (ST-8)", () => {
  it("should render the three lines for an implementing run with counts", async () => {
    const { describeRun } = await core()

    const result = describeRun(
      snapshot({
        plan: "p",
        phase: "Phase 2: Server wiring",
        task: "1.1.2 X",
        activity: "implementing",
        verified: 3,
        total: 14,
      }),
      UPDATED_AT + 1000
    )

    assert.deepEqual(result.lines, [
      "CodeOps · p",
      "Phase 2: Server wiring · implementing",
      `1.1.2 X · 3/14 verified · as of ${localTime(UPDATED_AT)}`,
    ])
    assert.equal(result.stale, false)
  })

  it("should render delegating with its detail target", async () => {
    const { describeRun } = await core()

    const result = describeRun(
      snapshot({ activity: "delegating", detail: "executor" }),
      UPDATED_AT + 1000
    )
    assert.equal(result.lines[1], "Ph · delegating to executor")
  })

  it("should render blocked with its reason", async () => {
    const { describeRun } = await core()

    const result = describeRun(
      snapshot({ activity: "blocked", detail: "tests fail" }),
      UPDATED_AT + 1000
    )
    assert.equal(result.lines[1], "Ph · blocked: tests fail")
  })

  it("should render waiting without a detail", async () => {
    const { describeRun } = await core()

    const result = describeRun(snapshot({ activity: "waiting" }), UPDATED_AT + 1000)
    assert.equal(result.lines[1], "Ph · waiting")
  })

  it("should render done", async () => {
    const { describeRun } = await core()

    const result = describeRun(snapshot({ activity: "done" }), UPDATED_AT + 1000)
    assert.equal(result.lines[1], "Ph · done")
  })

  it("should omit the count segment when total is null", async () => {
    const { describeRun } = await core()

    const result = describeRun(
      snapshot({ task: "1.1.2 X", verified: 3, total: null }),
      UPDATED_AT + 1000
    )
    assert.equal(result.lines[2], `1.1.2 X · as of ${localTime(UPDATED_AT)}`)
  })

  it("should mark stale at the threshold and end the line with the stale suffix", async () => {
    const { describeRun } = await core()

    const result = describeRun(
      snapshot({ task: "T", verified: 3, total: 14 }),
      UPDATED_AT + 600000
    )
    assert.equal(result.stale, true)
    assert.equal(result.lines[2], `T · 3/14 verified · as of ${localTime(UPDATED_AT)} (stale)`)
  })
})

describe("codeops RPC definition (ST-9)", () => {
  it("should carry the status and progress methods with empty-object inputs", async () => {
    const { CodeOpsRpc } = await rpc()

    assert.equal(CodeOpsRpc.id, "codeops")
    assert.deepEqual(Object.keys(CodeOpsRpc.methods).sort(), ["progress", "status"])
    assert.deepEqual(CodeOpsRpc.methods.progress.input, {
      type: "object",
      additionalProperties: false,
    })
    assert.deepEqual(CodeOpsRpc.methods.status.input, {
      type: "object",
      additionalProperties: false,
    })
  })

  it("should keep the status output schema unchanged", async () => {
    const { CodeOpsRpc } = await rpc()

    assert.deepEqual(CodeOpsRpc.methods.status.output, {
      type: "object",
      additionalProperties: false,
      required: ["pluginVersion", "openCodeVersion", "directory"],
      properties: {
        pluginVersion: { type: "string" },
        openCodeVersion: { type: "string" },
        directory: { type: "string" },
      },
    })
  })

  it("should define the progress output as a snapshot or null", async () => {
    const { CodeOpsRpc } = await rpc()
    const { RunStateSchema } = await core()

    assert.deepEqual(CodeOpsRpc.methods.progress.output, {
      anyOf: [RunStateSchema, { type: "null" }],
    })
  })

  it("should define the updated and cleared events with their required fields", async () => {
    const { CodeOpsRpc } = await rpc()
    const { RunClearedSchema, RunStateSchema } = await core()

    assert.deepEqual(CodeOpsRpc.events.updated, { schema: RunStateSchema })
    assert.deepEqual(CodeOpsRpc.events.cleared, { schema: RunClearedSchema })

    const updated = CodeOpsRpc.events.updated.schema
    assert.equal(updated.additionalProperties, false)
    assert.deepEqual([...updated.required].sort(), [
      "activity",
      "detail",
      "phase",
      "plan",
      "sessionID",
      "startedAt",
      "task",
      "total",
      "updatedAt",
      "verified",
    ])

    const cleared = CodeOpsRpc.events.cleared.schema
    assert.deepEqual(cleared.required, ["plan", "sessionID", "clearedAt"])
    assert.equal(cleared.additionalProperties, false)
    assert.deepEqual(Object.keys(cleared.properties).sort(), ["clearedAt", "plan", "sessionID"])
  })
})

describe("RPC registration binding (ST-10)", () => {
  it("should serve progress from the runtime and emit updated and cleared", async () => {
    const { createCodeOpsProgress } = await core()
    const { CodeOpsRpc, registerCodeOpsRpc } = await rpc()

    const runtime = createCodeOpsProgress()
    const emits = []
    const captured = {}
    const ctx = {
      rpc: {
        register: async (definition, handlers) => {
          captured.definition = definition
          captured.handlers = handlers
          return { events: { emit: (...args) => emits.push(args) } }
        },
      },
    }

    assert.equal(await registerCodeOpsRpc(ctx, { pluginVersion: "2.1.1", runtime }), true)
    assert.equal(captured.definition, CodeOpsRpc)

    assert.equal(await captured.handlers.progress(), null)

    const reported = runtime.report({ plan: "p", activity: "implementing" }, "s1", 1000)
    assert.deepEqual(await captured.handlers.progress(), reported)
    assert.deepEqual(emits, [["updated", reported]])

    assert.equal(runtime.clearSession("other"), null)
    assert.deepEqual(emits, [["updated", reported]])

    const cleared = runtime.clearSession("s1")
    assert.equal(cleared.plan, "p")
    assert.equal(cleared.sessionID, "s1")
    assert.ok(Number.isFinite(cleared.clearedAt), "the clear time must be a finite number")
    assert.deepEqual(emits[1], ["cleared", cleared])
    assert.equal(await captured.handlers.progress(), null)
  })

  it("should keep reports working when the registration has no events surface", async () => {
    const { createCodeOpsProgress } = await core()
    const { registerCodeOpsRpc } = await rpc()

    const runtime = createCodeOpsProgress()
    const captured = {}
    const ctx = {
      rpc: {
        register: async (definition, handlers) => {
          captured.handlers = handlers
          return {}
        },
      },
    }

    assert.equal(await registerCodeOpsRpc(ctx, { pluginVersion: "2.1.1", runtime }), true)

    const reported = runtime.report({ plan: "p", activity: "implementing" }, "s1", 1000)
    assert.ok(reported, "the report must succeed without an emit binding")
    assert.deepEqual(await captured.handlers.progress(), reported)
    assert.equal(runtime.clearSession("s1").plan, "p")
  })
})

describe("progress request helper (ST-11)", () => {
  it("should return a validated snapshot and forward the location options", async () => {
    const { requestProgress } = await rpc()

    const payload = snapshot({ updatedAt: 1000 })
    const captured = {}
    const client = {
      rpc: () => ({
        progress: async (input, options) => {
          captured.input = input
          captured.options = options
          return payload
        },
      }),
    }

    const options = { location: { directory: "/project" } }
    assert.deepEqual(await requestProgress(client, options), payload)
    assert.deepEqual(captured.input, {})
    assert.deepEqual(captured.options, options)
  })

  it("should return null for no run, an invalid payload, a rejection, and a throwing accessor", async () => {
    const { requestProgress } = await rpc()

    const noRunClient = { rpc: () => ({ progress: async () => null }) }
    assert.equal(await requestProgress(noRunClient), null)

    const garbageClient = { rpc: () => ({ progress: async () => ({ plan: "p" }) }) }
    assert.equal(await requestProgress(garbageClient), null)

    const rejectingClient = {
      rpc: () => ({
        progress: async () => {
          throw new Error("transport down")
        },
      }),
    }
    assert.equal(await requestProgress(rejectingClient), null)

    const throwingClient = {
      rpc: () => {
        throw new Error("no rpc api")
      },
    }
    assert.equal(await requestProgress(throwingClient), null)
  })
})
