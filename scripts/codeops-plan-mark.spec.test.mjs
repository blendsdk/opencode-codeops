/**
 * Specification tests for `codeops_plan.py mark`, the one-call task transition.
 *
 * `mark` replaces exec-plan's per-task bookkeeping steps (hand-editing the
 * checkbox, fetching a timestamp, recounting the Progress header, refreshing
 * Last Updated, and printing the progress bar) with a single command. These
 * cases pin its observable contract on a temporary plan, plus the protocol
 * wording that tells exec-plan to use it.
 *
 * @module codeops-plan-mark.spec.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const PLAN_SCRIPT = join(ROOT, "scripts", "codeops_plan.py")

/** Throwaway directories created by the tests, removed afterward. */
const bases = []

after(() => {
  for (const base of bases) rmSync(base, { recursive: true, force: true })
})

/**
 * Write a plan with three tasks, a fenced example, and a quoted example.
 *
 * @returns {{ base: string, plan: string, file: string }} Paths of the fixture.
 */
function makePlan() {
  const base = mkdtempSync(join(process.env.CODEOPS_TMPDIR || tmpdir(), "plan-mark-spec-"))
  bases.push(base)
  const plan = join(base, "plans", "demo")
  mkdirSync(plan, { recursive: true })
  const file = join(plan, "99-execution-plan.md")
  writeFileSync(
    file,
    [
      "# Plan",
      "",
      "> **Progress**: 0/3 tasks (0%)",
      "> **Last Updated**: 2000-01-01 00:00",
      "",
      "> Example: `- [~] 1.1.1 Task description ⏳ (implemented: YYYY-MM-DD HH:MM)`",
      ">    - [ ] 1.1.1 Quoted example line",
      "",
      "```markdown",
      "- [ ] 1.1.1 Fenced example line",
      "```",
      "",
      "- [ ] 1.1.1 First task",
      "- [ ] 1.1.2 Second task",
      "- [ ] 1.1.3 Third task",
      "- [ ] 1.1.1 Duplicate of the first task",
      "",
    ].join("\n")
  )
  return { base, plan, file }
}

/**
 * Run `codeops_plan.py mark` on the fixture.
 *
 * @param {{ base: string, plan: string }} fixture - The fixture paths.
 * @param {string[]} args - Arguments after `--plan <dir>`.
 * @returns {import("node:child_process").SpawnSyncReturns<string>} The result.
 */
function mark(fixture, args) {
  return spawnSync("python3", [PLAN_SCRIPT, "mark", "--root", fixture.base, "--plan", "plans/demo", ...args], {
    encoding: "utf8",
  })
}

/**
 * Format a local time as the plan timestamp format.
 *
 * @param {Date} date - The time.
 * @returns {string} `YYYY-MM-DD HH:MM`.
 */
function stamp(date) {
  const pad = (n) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Return the task line for an id (first occurrence outside the examples).
 *
 * @param {string} text - Plan text.
 * @param {string} id - Task id.
 * @returns {string} The line.
 */
function taskLine(text, id) {
  return text.split("\n").find((line) => line.startsWith("- [") && line.includes(` ${id} `) && !line.includes("example"))
}

describe("codeops_plan.py mark", () => {
  it("ST-K1 — marks a task implemented with the system time and refreshes Last Updated", () => {
    const fixture = makePlan()
    const before = stamp(new Date())
    const result = mark(fixture, ["--task", "1.1.2", "--state", "implemented"])
    const after = stamp(new Date())
    assert.equal(result.status, 0, result.stderr)
    const text = readFileSync(fixture.file, "utf8")
    const line = taskLine(text, "1.1.2")
    const match = /^- \[~\] 1\.1\.2 Second task ⏳ \(implemented: (\d{4}-\d{2}-\d{2} \d{2}:\d{2})\)$/.exec(line)
    assert.ok(match, `unexpected line: ${line}`)
    assert.ok([before, after].includes(match[1]), "the timestamp comes from the system clock")
    assert.match(text, new RegExp(`^> \\*\\*Last Updated\\*\\*: (${before}|${after})$`, "m"))
  })

  it("ST-K2 — marks a task done, replaces its status suffix, updates Progress, and prints the bar", () => {
    const fixture = makePlan()
    mark(fixture, ["--task", "1.1.1", "--state", "implemented"])
    const result = mark(fixture, ["--task", "1.1.1", "--state", "done"])
    assert.equal(result.status, 0, result.stderr)
    const text = readFileSync(fixture.file, "utf8")
    assert.match(taskLine(text, "1.1.1"), /^- \[x\] 1\.1\.1 First task ✅ \(completed: \d{4}-\d{2}-\d{2} \d{2}:\d{2}\)$/)
    assert.match(text, /^> \*\*Progress\*\*: 1\/3 tasks \(33%\)$/m)
    assert.equal(result.stdout.trim(), "Progress: [███░░░░░░░] 1/3 tasks (33%)")
  })

  it("ST-K3 — carries a note inside the status suffix", () => {
    const fixture = makePlan()
    const result = mark(fixture, ["--task", "1.1.3", "--state", "done", "--note", "red: 6/6 fail"])
    assert.equal(result.status, 0, result.stderr)
    assert.match(taskLine(readFileSync(fixture.file, "utf8"), "1.1.3"), /✅ \(completed: [^;)]+; red: 6\/6 fail\)$/)
  })

  it("ST-K4 — blocks a task only with a visible reason the parser accepts", () => {
    const fixture = makePlan()
    const original = readFileSync(fixture.file, "utf8")
    const refused = mark(fixture, ["--task", "1.1.2", "--state", "blocked"])
    assert.notEqual(refused.status, 0)
    assert.equal(readFileSync(fixture.file, "utf8"), original, "a refused mark changes nothing")

    const blocked = mark(fixture, ["--task", "1.1.2", "--state", "blocked", "--note", "waiting on the API key"])
    assert.equal(blocked.status, 0, blocked.stderr)
    assert.match(taskLine(readFileSync(fixture.file, "utf8"), "1.1.2"), /^- \[!\] 1\.1\.2 Second task .*Blocked: waiting on the API key/)
    const status = spawnSync("python3", [PLAN_SCRIPT, "--root", fixture.base, "--plan", "plans/demo", "--json"], { encoding: "utf8" })
    const problems = JSON.parse(status.stdout).plans[0].problems
    assert.equal(problems.some((p) => /blocked task lacks/.test(p)), false, "the reason satisfies the parser")
  })

  it("ST-K5 — touches only the counted task line, never examples or later duplicates", () => {
    const fixture = makePlan()
    mark(fixture, ["--task", "1.1.1", "--state", "done"])
    const lines = readFileSync(fixture.file, "utf8").split("\n")
    assert.ok(lines.includes(">    - [ ] 1.1.1 Quoted example line"))
    assert.ok(lines.includes("- [ ] 1.1.1 Fenced example line"))
    assert.ok(lines.includes("- [ ] 1.1.1 Duplicate of the first task"))
    assert.equal(lines.filter((line) => line.startsWith("- [x] 1.1.1")).length, 1)
  })

  it("ST-K6 — is idempotent: repeating a mark leaves the plan unchanged", () => {
    const fixture = makePlan()
    mark(fixture, ["--task", "1.1.2", "--state", "done"])
    const once = readFileSync(fixture.file, "utf8")
    const again = mark(fixture, ["--task", "1.1.2", "--state", "done"])
    assert.equal(again.status, 0, again.stderr)
    assert.equal(readFileSync(fixture.file, "utf8"), once)
  })

  it("ST-K7 — rejects an unknown task id without changing the plan", () => {
    const fixture = makePlan()
    const original = readFileSync(fixture.file, "utf8")
    const result = mark(fixture, ["--task", "9.9.9", "--state", "done"])
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /9\.9\.9/)
    assert.equal(readFileSync(fixture.file, "utf8"), original)
  })
})

describe("codeops_plan.py mark keeps the rest of the file intact", () => {
  it("ST-K9 — preserves CRLF endings, task text that quotes the suffix format, and line positions", () => {
    const fixture = makePlan()
    const text = [
      "> **Progress**: 0/2 tasks (0%)",
      "> **Last Updated**: 2000-01-01 00:00",
      "Intro with a form feed \f inside.",
      "- [ ] 1.1.1 Document the ✅ (completed: <time>) suffix format",
      "- [ ] 1.1.2 Second task",
      "",
    ].join("\r\n")
    writeFileSync(fixture.file, text)
    const result = mark(fixture, ["--task", "1.1.1", "--state", "done"])
    assert.equal(result.status, 0, result.stderr)
    const after = readFileSync(fixture.file, "utf8")
    assert.equal(after.split("\r\n").length, text.split("\r\n").length, "every line keeps its CRLF ending")
    assert.equal(after.replace(/\r\n/g, "").includes("\n"), false, "no bare LF is introduced")
    const lines = after.split("\r\n")
    assert.match(lines[3], /^- \[x\] 1\.1\.1 Document the ✅ \(completed: <time>\) suffix format ✅ \(completed: \d{4}-/)
    assert.equal(lines[4], "- [ ] 1.1.2 Second task", "the next task is untouched")
  })
})

describe("exec-plan uses mark for task transitions", () => {
  it("ST-K8 — the per-task loop and update procedure call mark with the progress report in the same step", () => {
    const skill = readFileSync(join(ROOT, "skills", "exec-plan", "SKILL.md"), "utf8")
    const protocol = readFileSync(join(ROOT, "skills", "exec-plan", "execution-protocol.md"), "utf8")
    const procedure = protocol.slice(protocol.indexOf("### Update procedure"), protocol.indexOf("### Native progress mirror"))
    for (const text of [skill, procedure]) {
      assert.match(text, /codeops_plan\.py"? mark/)
      assert.match(text, /same step/i)
    }
    assert.doesNotMatch(procedure, /date '\+%Y-%m-%d %H:%M'/, "mark takes the timestamp; no separate date step")
  })
})
