/**
 * Implementation tests for the live progress core.
 *
 * These tests cover the guard matrices, normalization edges, merge ties,
 * runtime isolation, emission containment, and the full display-label surface.
 * Unlike the spec suite, they may derive from the implementation's internals
 * and evolve with them.
 *
 * @module progress-core.impl.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  createCodeOpsProgress,
  describeRun,
  isCodeOpsProgressReport,
  isCodeOpsRunState,
  mergeRunState,
  normalizeProgressReport,
} from "../bin/lib/codeops-progress.mjs"

/** A fixed local timestamp used across the display tests. */
const UPDATED_AT = new Date(2026, 0, 2, 18, 37).getTime()

/**
 * Build a complete run snapshot for the merge and display tests.
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

describe("report guard matrices", () => {
  it("should accept counts at zero and above the clamp bound", () => {
    assert.equal(isCodeOpsProgressReport({ plan: "p", activity: "done", verified: 0 }), true)
    assert.equal(
      isCodeOpsProgressReport({ plan: "p", activity: "done", verified: 1_000_000, total: 4 }),
      true
    )
  })

  it("should reject every optional field carrying a wrong type", () => {
    const wrong = [
      { phase: null },
      { phase: 3 },
      { task: ["T"] },
      { detail: {} },
      { verified: null },
      { verified: "3" },
      { verified: -1 },
      { total: 1.5 },
      { total: false },
    ]
    for (const fields of wrong) {
      assert.equal(
        isCodeOpsProgressReport({ plan: "p", activity: "done", ...fields }),
        false,
        `must reject ${JSON.stringify(fields)}`
      )
    }
  })

  it("should reject arrays and report-shaped objects with a wrong core field", () => {
    assert.equal(isCodeOpsProgressReport([]), false)
    assert.equal(isCodeOpsProgressReport({ plan: "p", activity: null }), false)
    assert.equal(isCodeOpsProgressReport({ plan: null, activity: "done" }), false)
  })
})

describe("run-state guard boundaries", () => {
  it("should accept zero counts, zero timestamps, and a zero total", () => {
    assert.equal(
      isCodeOpsRunState(snapshot({ startedAt: 0, updatedAt: 0, verified: 0, total: 0 })),
      true
    )
  })

  it("should reject fractional counts and a fractional total", () => {
    assert.equal(isCodeOpsRunState(snapshot({ verified: 1.5 })), false)
    assert.equal(isCodeOpsRunState(snapshot({ total: 2.5 })), false)
    assert.equal(isCodeOpsRunState(snapshot({ updatedAt: 0.5 })), false)
  })
})

describe("normalization edges", () => {
  it("should keep exactly-cap strings and truncate one character more", () => {
    const atCap = normalizeProgressReport({
      plan: "x".repeat(200),
      activity: "done",
      task: "y".repeat(200),
    })
    assert.equal(atCap.plan.length, 200)
    assert.equal(atCap.task.length, 200)

    const overCap = normalizeProgressReport({
      plan: "x".repeat(201),
      activity: "done",
      task: "y".repeat(250),
    })
    assert.equal(overCap.plan, "x".repeat(200))
    assert.equal(overCap.task, "y".repeat(200))
  })

  it("should convert every whitespace-only optional string to null", () => {
    const normalized = normalizeProgressReport({
      plan: "p",
      activity: "done",
      phase: "\t",
      task: " \n ",
      detail: "   ",
    })
    assert.equal(normalized.phase, null)
    assert.equal(normalized.task, null)
    assert.equal(normalized.detail, null)
  })

  it("should clamp counts below zero and above the contract maximum", () => {
    const normalized = normalizeProgressReport({
      plan: "p",
      activity: "done",
      verified: -3,
      total: 1_000_001,
    })
    assert.equal(normalized.verified, 0)
    assert.equal(normalized.total, 1_000_000)
  })

  it("should omit absent optional fields so merges can carry current values", () => {
    const normalized = normalizeProgressReport({ plan: "p", activity: "done" })
    for (const key of ["phase", "task", "detail", "verified", "total"]) {
      assert.equal(Object.hasOwn(normalized, key), false, `must omit ${key}`)
    }
  })

  it("should reject unknown keys, non-finite counts, and wrong optional types", () => {
    assert.equal(
      normalizeProgressReport({ plan: "p", activity: "done", extra: true }),
      null
    )
    assert.equal(normalizeProgressReport({ plan: "p", activity: "done", verified: NaN }), null)
    assert.equal(normalizeProgressReport({ plan: "p", activity: "done", total: Infinity }), null)
    assert.equal(normalizeProgressReport({ plan: "p", activity: "done", phase: 5 }), null)
    assert.equal(normalizeProgressReport({ plan: "p", activity: "unknown" }), null)
  })
})

describe("merge selection edges", () => {
  it("should let the incoming snapshot win a tie even when its payload differs", () => {
    const current = snapshot({ updatedAt: 2000, task: "old" })
    const incoming = snapshot({ updatedAt: 2000, task: "new" })
    assert.equal(mergeRunState(current, incoming), incoming)
  })

  it("should accept the incoming snapshot when no current state exists", () => {
    const incoming = snapshot()
    assert.equal(mergeRunState(null, incoming), incoming)
  })
})

describe("runtime isolation and containment", () => {
  it("should keep two runtimes' state independent", () => {
    const first = createCodeOpsProgress()
    const second = createCodeOpsProgress()

    first.report({ plan: "p", activity: "implementing" }, "s1", 1000)
    assert.equal(second.snapshot(), null)
    assert.equal(first.snapshot().plan, "p")
  })

  it("should leave state and emission untouched when a report is rejected", () => {
    const emits = []
    const runtime = createCodeOpsProgress()
    runtime.bindEmit((name, payload) => emits.push([name, payload]))

    assert.equal(runtime.report({ plan: "p", activity: "bogus" }, "s1", 1000), null)
    assert.deepEqual(emits, [])
    assert.equal(runtime.snapshot(), null)

    const accepted = runtime.report({ plan: "p", activity: "done" }, "s1", 2000)
    assert.equal(emits.length, 1)
    assert.equal(runtime.report({ plan: "" }, "s1", 3000), null)
    assert.equal(emits.length, 1)
    assert.deepEqual(runtime.snapshot(), accepted)
  })

  it("should swallow a synchronously throwing emitter", () => {
    const runtime = createCodeOpsProgress()
    runtime.bindEmit(() => {
      throw new Error("boom")
    })

    const reported = runtime.report({ plan: "p", activity: "implementing" }, "s1", 1000)
    assert.ok(reported)
    assert.equal(runtime.clearSession("s1").plan, "p")
  })

  it("should swallow a rejecting emitter without an unhandled rejection", async () => {
    const runtime = createCodeOpsProgress()
    runtime.bindEmit(async () => {
      throw new Error("async boom")
    })

    const reported = runtime.report({ plan: "p", activity: "implementing" }, "s1", 1000)
    assert.ok(reported)
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(runtime.clearSession("s1").plan, "p")
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it("should ignore a non-function emit binding and a non-matching clear", () => {
    const runtime = createCodeOpsProgress()
    runtime.bindEmit(null)

    const reported = runtime.report({ plan: "p", activity: "implementing" }, "s1", 1000)
    assert.ok(reported)
    assert.equal(runtime.clearSession("other"), null)
    assert.deepEqual(runtime.snapshot(), reported)
  })
})

describe("display coverage for every activity", () => {
  it("should label each self-naming activity with its own word", () => {
    for (const activity of ["starting", "implementing", "verifying", "reviewing"]) {
      const result = describeRun(snapshot({ activity }), UPDATED_AT + 1000)
      assert.equal(result.lines[1], `Ph · ${activity}`)
    }
  })

  it("should render delegating, waiting, and blocked without detail as bare words", () => {
    assert.equal(describeRun(snapshot({ activity: "delegating" }), UPDATED_AT).lines[1], "Ph · delegating")
    assert.equal(describeRun(snapshot({ activity: "waiting" }), UPDATED_AT).lines[1], "Ph · waiting")
    assert.equal(describeRun(snapshot({ activity: "blocked" }), UPDATED_AT).lines[1], "Ph · blocked")
  })

  it("should render waiting with its detail in parentheses", () => {
    const result = describeRun(snapshot({ activity: "waiting", detail: "user input" }), UPDATED_AT)
    assert.equal(result.lines[1], "Ph · waiting (user input)")
  })

  it("should omit the phase segment when phase is null", () => {
    const result = describeRun(snapshot({ phase: null, activity: "done" }), UPDATED_AT)
    assert.equal(result.lines[1], "done")
  })

  it("should render a fresh run just below the stale threshold without the suffix", () => {
    const result = describeRun(snapshot({ task: "T", updatedAt: 0 }), 599_999)
    const epoch = new Date(0)
    const hh = String(epoch.getHours()).padStart(2, "0")
    const mm = String(epoch.getMinutes()).padStart(2, "0")

    assert.equal(result.stale, false)
    assert.equal(result.lines[2], `T · as of ${hh}:${mm}`)
  })
})
