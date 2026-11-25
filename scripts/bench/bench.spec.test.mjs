/**
 * Specification tests for the dev-only session measurement kit.
 *
 * The kit reads OpenCode's local database read-only and reports content-free
 * numbers for one session tree: token totals, steps, context per step, edit
 * classes, and bookkeeping calls. These tests build a tiny synthetic database
 * with the same tables and JSON shapes, then pin the arithmetic and the
 * guarantee that no message, prompt, command, or file text is ever printed.
 *
 * @module bench.spec.test
 */

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { after, before, describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const BENCH = join(ROOT, "scripts", "bench", "bench.py")

/** Strings planted in content fields; none may reach the kit's output. */
const SECRETS = [
  "SECRET-TEXT-ALPHA",
  "SECRET-CONTENT-BETA",
  "SECRET-REASONING-GAMMA",
  "SECRET-CMD-DELTA",
  "SECRET-PROMPT-EPSILON",
  "SECRET-OLD-ZETA",
]

let dir
let db

/**
 * Build an assistant message payload with the given token counts.
 *
 * @param {number} input - Uncached input tokens.
 * @param {number} output - Output tokens.
 * @param {number} reasoning - Reasoning tokens.
 * @param {number} read - Cache-read tokens.
 * @param {number} write - Cache-write tokens.
 * @returns {string} The JSON `data` column.
 */
function assistant(input, output, reasoning, read, write, content = []) {
  return JSON.stringify({
    agent: "build",
    model: { id: "model-x", providerID: "prov", variant: "high" },
    content,
    cost: 0.01,
    finish: "tool-calls",
    tokens: { input, output, reasoning, cache: { read, write } },
  })
}

/**
 * Build a completed tool call item.
 *
 * @param {string} name - Tool name.
 * @param {object} input - Tool input.
 * @returns {object} The tool item, as stored in a part or a message `content` list.
 */
function toolItem(name, input) {
  return { type: "tool", id: `call-${name}-${Math.random()}`, name, state: { status: "completed", input } }
}

/**
 * Build a completed tool part payload.
 *
 * @param {string} name - Tool name.
 * @param {object} input - Tool input.
 * @returns {string} The JSON `data` column.
 */
function tool(name, input) {
  return JSON.stringify(toolItem(name, input))
}

/**
 * Create the fixture database: root R → child C1 → grandchild G1.
 *
 * @param {string} path - Database file path.
 */
function buildFixture(path) {
  const sql = new DatabaseSync(path)
  sql.exec(`
    CREATE TABLE session_v2 (id text PRIMARY KEY, parent_id text, directory text NOT NULL,
      title text, time_created integer NOT NULL);
    CREATE TABLE session_message (id text PRIMARY KEY, session_id text NOT NULL, type text NOT NULL,
      seq integer NOT NULL, time_created integer NOT NULL, data text NOT NULL);
    CREATE TABLE session_part (message_id text NOT NULL, session_id text NOT NULL,
      ordinal integer NOT NULL, type text NOT NULL, time_created integer NOT NULL,
      data text NOT NULL, PRIMARY KEY (message_id, ordinal));
  `)
  const session = sql.prepare("INSERT INTO session_v2 VALUES (?, ?, ?, ?, ?)")
  session.run("R", null, "/w/repo", "SECRET-TEXT-ALPHA title", 1)
  session.run("C1", "R", "/w/repo", "child", 2)
  session.run("G1", "C1", "/w/repo", "grandchild", 3)
  session.run("X", null, "/w/repo", "unrelated", 4)

  const message = sql.prepare("INSERT INTO session_message VALUES (?, ?, ?, ?, ?, ?)")
  message.run("u0", "R", "user", 0, 10, JSON.stringify({ text: "SECRET-TEXT-ALPHA" }))
  message.run("m1", "R", "assistant", 1, 11, assistant(100, 10, 5, 1000, 50))
  message.run("m2", "R", "assistant", 2, 12, assistant(200, 20, 0, 3000, 0))
  // m3 keeps its tool calls in the message `content` list, the store most
  // real messages use; m1 and m2 use `session_part` rows.
  message.run("m3", "R", "assistant", 3, 13, assistant(300, 0, 0, 2000, 100, [
    { type: "text", text: "SECRET-TEXT-ALPHA" },
    toolItem("shell", { command: "python3 /p/scripts/codeops_plan.py mark plans/f 1.1.1 x" }),
    toolItem("shell", { command: "npm test # SECRET-CMD-DELTA" }),
    toolItem("subagent", {
      agent: "correctness-reviewer", description: "Phase 1 review", prompt: "SECRET-PROMPT-EPSILON",
    }),
  ]))
  message.run("c1", "C1", "assistant", 1, 14, assistant(10, 1, 0, 100, 0))
  message.run("g1", "G1", "assistant", 1, 15, assistant(20, 2, 0, 200, 3))
  message.run("x1", "X", "assistant", 1, 16, assistant(9999, 9999, 0, 9999, 9999))

  const part = sql.prepare("INSERT INTO session_part VALUES (?, ?, ?, ?, ?, ?)")
  part.run("m1", "R", 0, "text", 11, JSON.stringify({ type: "text", text: "SECRET-TEXT-ALPHA" }))
  part.run("m1", "R", 1, "tool", 11, tool("edit", {
    path: "/w/repo/plans/f/99-execution-plan.md", oldString: "SECRET-OLD-ZETA", newString: "x",
  }))
  part.run("m1", "R", 2, "tool", 11, tool("edit", {
    path: "/w/repo/src/app.ts", oldString: "a", newString: "b",
  }))
  part.run("m1", "R", 3, "tool", 11, tool("shell", { command: "date '+%Y-%m-%d %H:%M'" }))
  part.run("m2", "R", 0, "reasoning", 12, JSON.stringify({ type: "reasoning", text: "SECRET-REASONING-GAMMA" }))
  part.run("m2", "R", 1, "tool", 12, tool("write", {
    path: "/w/repo/src/app.test.ts", content: "SECRET-CONTENT-BETA",
  }))
  part.run("m2", "R", 2, "tool", 12, tool("shell", {
    command: "cd /w/repo && python3 /p/scripts/codeops_plan.py plans/f --progress-bar",
  }))
  sql.close()
}

/**
 * Run the kit and return its stdout.
 *
 * @param {string[]} args - Arguments after `bench.py`.
 * @returns {string} Standard output.
 */
function bench(args) {
  return execFileSync("python3", ["-I", BENCH, ...args], { encoding: "utf8" })
}

/**
 * Run `sessions --root R --json` against the fixture.
 *
 * @returns {object} The parsed report.
 */
function report() {
  return JSON.parse(bench(["sessions", "--db", db, "--root", "R", "--json"]))
}

before(() => {
  dir = mkdtempSync(join(process.env.CODEOPS_TMPDIR || tmpdir(), "bench-spec-"))
  db = join(dir, "opencode.db")
  buildFixture(db)
})

after(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe("bench sessions", () => {
  it("ST-B1 — splits tree tokens into fresh and cached and counts assistant messages", () => {
    const { tree } = report()
    // fresh = input + output + reasoning + cache.write; cached = cache.read
    assert.equal(tree.fresh, 165 + 220 + 400 + 11 + 25)
    assert.equal(tree.cached, 1000 + 3000 + 2000 + 100 + 200)
    assert.equal(tree.messages, 5)
  })

  it("ST-B2 — walks the session tree recursively and excludes unrelated sessions", () => {
    const { tree } = report()
    assert.equal(tree.sessions, 3)
    assert.equal(tree.subagent_sessions, 2)
    assert.equal(tree.subagent_fresh, 11 + 25)
    assert.equal(tree.subagent_cached, 100 + 200)
  })

  it("ST-B3 — counts steps and context per step on the primary session only", () => {
    const { primary } = report()
    assert.equal(primary.steps, 3)
    // context per step = input + cache.read + cache.write → 1150, 3200, 2400
    assert.equal(primary.ctx_median, 2400)
    assert.equal(primary.ctx_p90, 3200)
  })

  it("ST-B4 — classifies primary edits by path as CodeOps artifacts, tests, or product", () => {
    const { primary } = report()
    assert.deepEqual(primary.edits, { artifacts: 1, tests: 1, product: 1 })
  })

  it("ST-B5 — counts bookkeeping calls: artifact edits, date, progress bar, and mark", () => {
    const { primary } = report()
    assert.equal(primary.tool_calls, 8)
    assert.equal(primary.bookkeeping_calls, 4)
  })

  it("ST-B6 — never prints message, prompt, command, or file text", () => {
    const outputs = [
      bench(["sessions", "--db", db, "--root", "R", "--json"]),
      bench(["sessions", "--db", db, "--root", "R"]),
      bench(["sessions", "--db", db, "--ids", "R,C1"]),
    ]
    for (const out of outputs) {
      for (const secret of SECRETS) {
        assert.equal(out.includes(secret), false, `output leaked ${secret}`)
      }
    }
  })
})
