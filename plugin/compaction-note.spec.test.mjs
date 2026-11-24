/**
 * Specification tests for the compaction note.
 *
 * When the session that owns an unfinished CodeOps run is compacted, the
 * compaction request carries a short note naming the plan, phase, and task and
 * telling the agent to re-read the execution plan and findings ledger. These
 * tests pin when the note exists and what it says. Each test is named
 * `ST-<n> — …` so a phase can run its own cases with `--test-name-pattern`.
 *
 * This is the specification oracle: a failing test means the implementation is
 * wrong, never the test.
 *
 * @module compaction-note.spec.test
 */

import assert from "node:assert/strict"
import { it } from "node:test"

/**
 * Import the note builder under test.
 *
 * The import resolves per call so this file loads — and reports per-test
 * failures — before the function exists.
 *
 * @returns {Promise<Function>} The `buildCompactionNote` export.
 */
async function buildCompactionNote() {
  const module = await import("../bin/lib/codeops-progress.mjs")
  assert.equal(typeof module.buildCompactionNote, "function", "buildCompactionNote must be exported")
  return module.buildCompactionNote
}

/**
 * Build a complete run snapshot owned by session `s1`.
 *
 * @param {object} [overrides] - Fields replacing the defaults.
 * @returns {object} A snapshot satisfying the run-state schema.
 */
function run(overrides = {}) {
  return {
    plan: "p",
    phase: "2",
    task: "2.1.3",
    activity: "implementing",
    detail: null,
    verified: 0,
    total: null,
    startedAt: 1,
    updatedAt: 1,
    sessionID: "s1",
    ...overrides,
  }
}

it("ST-17 — no run yields no note", async () => {
  const build = await buildCompactionNote()
  assert.equal(build(null, "s1"), null)
})

it("ST-18 — another session's run yields no note", async () => {
  const build = await buildCompactionNote()
  assert.equal(build(run({ sessionID: "s2" }), "s1"), null)
})

it("ST-19 — a finished run yields no note", async () => {
  const build = await buildCompactionNote()
  assert.equal(build(run({ activity: "done" }), "s1"), null)
})

it("ST-20 — an owned unfinished run yields a labelled note within 400 characters", async () => {
  const build = await buildCompactionNote()
  const note = build(run(), "s1")
  assert.equal(typeof note, "string")
  for (const part of ['plan "p"', 'phase "2"', 'task "2.1.3"', "99-execution-plan.md", "05-findings.md"]) {
    assert.ok(note.includes(part), `the note must contain ${part}`)
  }
  assert.ok(note.length <= 400, `the note is ${note.length} characters`)
})

it("ST-21 — oversized values with line breaks and quotes still yield one line within 400 characters", async () => {
  const build = await buildCompactionNote()
  const long = `a"b\nc\r\t${"x".repeat(1000)}`
  const note = build(run({ plan: long, phase: long, task: long }), "s1")
  assert.equal(typeof note, "string")
  assert.ok(note.length <= 400, `the note is ${note.length} characters`)
  assert.doesNotMatch(note, /[\r\n]/)
})

it("ST-22 — a missing phase or task renders as a dash", async () => {
  const build = await buildCompactionNote()
  const note = build(run({ phase: null, task: null }), "s1")
  assert.ok(note.includes('phase "—"'), "a null phase renders as a dash")
  assert.ok(note.includes('task "—"'), "a null task renders as a dash")
})
