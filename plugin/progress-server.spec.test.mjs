/**
 * Specification tests for the progress server wiring.
 *
 * These tests pin the observable contract of the tool registration guard and
 * the always-on plugin wiring: containment without the new host APIs,
 * defensive handler behavior through a captured transform, the full setup
 * path with a captured RPC registration and a scripted session deletion, and
 * setup tolerance when the tool API is missing or throwing.
 *
 * This is the specification oracle: a failing test means the implementation is
 * wrong, never the test.
 *
 * @module progress-server.spec.test
 */

import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"

/** Fixture temp bases created by this suite; removed on exit. */
const fixtures = []

after(() => {
  while (fixtures.length > 0) {
    rmSync(fixtures.pop(), { recursive: true, force: true })
  }
})

/**
 * Create a throwaway root directory for one fixture.
 *
 * @returns {string} Absolute path to the new directory.
 */
function makeBase() {
  const dir = mkdtempSync(join(tmpdir(), "codeops-progress-server-"))
  fixtures.push(dir)
  return dir
}

/**
 * Import the progress core module under test.
 *
 * The import resolves per call so this file loads — and reports per-test
 * failures — before the module's tool guard exists, the red-phase state of a
 * specification-first suite.
 *
 * @returns {Promise<object>} The module namespace.
 */
async function core() {
  return import("../bin/lib/codeops-progress.mjs")
}

/**
 * Poll a synchronous predicate until it holds or the attempt budget runs out.
 *
 * Used only to observe the plugin's asynchronous event loop; the predicate
 * itself is deterministic.
 *
 * @param {() => boolean} predicate - Condition to observe.
 * @param {number} [attempts] - Maximum polling rounds.
 * @returns {Promise<boolean>} Whether the predicate held.
 */
async function waitFor(predicate, attempts = 100) {
  for (let round = 0; round < attempts; round += 1) {
    if (predicate()) return true
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  return predicate()
}

/**
 * Build a capturing tool domain: the host's `transform` invokes the plugin's
 * callback with an editor whose `add` records each entry.
 *
 * @param {object[]} adds - Array receiving the captured tool entries.
 * @returns {object} A fake `ctx.tool` domain.
 */
function toolDomain(adds) {
  return {
    transform: async (callback) => {
      await callback({ add: (entry) => adds.push(entry) })
    },
  }
}

/**
 * Build an event stream that yields one `session.deleted` event only after
 * the test releases it, so report-before-deletion ordering is deterministic.
 *
 * @param {string} sessionID - Session the deletion event carries.
 * @returns {{ stream: AsyncIterable<object>, release: () => void }} The stream
 *   and its release trigger.
 */
function gatedDeletionStream(sessionID) {
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const stream = (async function* () {
    await gate
    yield { type: "session.deleted", data: { sessionID } }
  })()
  return { stream, release }
}

/**
 * Build a fake server plugin context mirroring only the surface `setup` uses.
 *
 * @param {string} directory - Project directory reported by the context.
 * @param {object} [options] - `rpc` enables the capturing RPC domain;
 *   `transform` supplies the tool transform; `stream` supplies the event
 *   stream (defaults to an empty one).
 * @returns {object} The fake context, captured registration state, and hook lists.
 */
function makeFakeContext(directory, options = {}) {
  const hooks = { session: [], shell: [], tool: [] }
  const adds = []
  const emits = []
  const captured = { adds, emits, definition: null, handlers: null }
  const ctx = {
    location: { directory },
    app: { version: "2.0.26" },
    event: { subscribe: () => options.stream ?? (async function* () {})() },
    session: {
      hook: async (name) => {
        hooks.session.push(name)
      },
    },
    shell: {
      hook: async (name) => {
        hooks.shell.push(name)
      },
    },
    tool: {
      hook: async (name) => {
        hooks.tool.push(name)
      },
    },
    model: { list: async () => ({ data: [] }) },
  }
  if (options.rpc) {
    ctx.rpc = {
      register: async (definition, handlers) => {
        captured.definition = definition
        captured.handlers = handlers
        return { events: { emit: (...args) => emits.push(args) } }
      },
    }
  }
  if (options.transform !== undefined) {
    ctx.tool.transform = options.transform
  }
  return { ctx, captured, hooks }
}

describe("progress tool registration guard (ST-12)", () => {
  it("should return false without throwing when the tool domain or transform is missing", async () => {
    const { createCodeOpsProgress, registerCodeOpsProgressTool } = await core()
    const runtime = createCodeOpsProgress()

    assert.equal(await registerCodeOpsProgressTool({}, runtime), false)
    assert.equal(await registerCodeOpsProgressTool({ tool: {} }, runtime), false)
    assert.equal(await registerCodeOpsProgressTool({ tool: { transform: 42 } }, runtime), false)
  })

  it("should return false without throwing when the transform throws", async () => {
    const { createCodeOpsProgress, registerCodeOpsProgressTool } = await core()
    const ctx = {
      tool: {
        transform: async () => {
          throw new Error("no editor")
        },
      },
    }

    assert.equal(await registerCodeOpsProgressTool(ctx, createCodeOpsProgress()), false)
  })

  it("should add the tool with its schemas through a capturing transform", async () => {
    const {
      CODE_OPS_TOOL_DESCRIPTION,
      ProgressOutputSchema,
      ProgressReportSchema,
      createCodeOpsProgress,
      registerCodeOpsProgressTool,
    } = await core()
    const adds = []

    assert.equal(
      await registerCodeOpsProgressTool({ tool: toolDomain(adds) }, createCodeOpsProgress()),
      true
    )
    assert.equal(adds.length, 1)
    assert.equal(adds[0].name, "codeops_progress")
    assert.equal(adds[0].description, CODE_OPS_TOOL_DESCRIPTION)
    assert.deepEqual(adds[0].input, ProgressReportSchema)
    assert.deepEqual(adds[0].output, ProgressOutputSchema)
    assert.equal(typeof adds[0].execute, "function")
  })
})

describe("tool handler behavior (ST-13)", () => {
  it("should report accepted input, emit once, and answer ok for a rejected report", async () => {
    const progressCore = await core()
    const { registerCodeOpsRpc } = await import("../bin/lib/codeops-rpc.mjs")

    const runtime = progressCore.createCodeOpsProgress()
    const emits = []
    const rpcCtx = {
      rpc: {
        register: async () => ({ events: { emit: (...args) => emits.push(args) } }),
      },
    }
    assert.equal(await registerCodeOpsRpc(rpcCtx, { pluginVersion: "2.1.1", runtime }), true)

    const adds = []
    assert.equal(
      await progressCore.registerCodeOpsProgressTool({ tool: toolDomain(adds) }, runtime),
      true
    )
    const execute = adds[0].execute

    const first = await execute({ plan: "p", activity: "implementing" }, { sessionID: "s1" })
    assert.deepEqual(first, { output: { ok: true } })
    assert.equal(emits.length, 1)
    assert.equal(emits[0][0], "updated")
    assert.equal(emits[0][1].plan, "p")

    const second = await execute({}, { sessionID: "s1" })
    assert.deepEqual(second, { output: { ok: false } })
    assert.equal(emits.length, 1, "a rejected report must not emit")
  })
})

describe("plugin setup wiring (ST-14)", () => {
  it("should report through the captured tool, then clear on session deletion", async () => {
    const base = makeBase()
    const previousTmpdir = process.env.TMPDIR
    const previousHome = process.env.HOME
    process.env.TMPDIR = base
    process.env.HOME = base
    try {
      const { stream, release } = gatedDeletionStream("s1")
      const { ctx, captured } = makeFakeContext(base, {
        rpc: true,
        transform: async (callback) => {
          await callback({ add: (entry) => captured.adds.push(entry) })
        },
        stream,
      })

      const plugin = (await import("../plugin/index.ts")).default
      const cleanup = await plugin.setup(ctx)
      assert.equal(typeof cleanup, "function")

      assert.equal(captured.definition?.id, "codeops", "the RPC definition must register")
      assert.equal(captured.adds.length, 1, "the progress tool must register")
      assert.equal(captured.adds[0].name, "codeops_progress")

      const result = await captured.adds[0].execute(
        { plan: "p", activity: "implementing" },
        { sessionID: "s1" }
      )
      assert.deepEqual(result, { output: { ok: true } })
      assert.ok(
        captured.emits.some(([name]) => name === "updated"),
        "an accepted report must emit updated"
      )

      release()
      const sawCleared = await waitFor(() =>
        captured.emits.some(([name]) => name === "cleared")
      )
      assert.equal(sawCleared, true, "the session deletion must clear the run and emit cleared")
      assert.equal(await captured.handlers.progress(), null)

      await cleanup()
    } finally {
      if (previousTmpdir === undefined) delete process.env.TMPDIR
      else process.env.TMPDIR = previousTmpdir
      if (previousHome === undefined) delete process.env.HOME
      else process.env.HOME = previousHome
    }
  })
})

describe("setup containment without the new APIs (ST-15)", () => {
  it("should complete setup with no tool transform and no rpc register", async () => {
    const base = makeBase()
    const previousTmpdir = process.env.TMPDIR
    const previousHome = process.env.HOME
    process.env.TMPDIR = base
    process.env.HOME = base
    try {
      const { ctx, hooks } = makeFakeContext(base)
      const plugin = (await import("../plugin/index.ts")).default

      const cleanup = await plugin.setup(ctx)

      assert.equal(typeof cleanup, "function")
      assert.ok(hooks.session.includes("context"))
      assert.ok(hooks.session.includes("compaction"))
      assert.ok(hooks.session.includes("prompt"))
      assert.ok(hooks.shell.includes("create.before"))
      assert.ok(hooks.tool.includes("execute.before"))
      await cleanup()
    } finally {
      if (previousTmpdir === undefined) delete process.env.TMPDIR
      else process.env.TMPDIR = previousTmpdir
      if (previousHome === undefined) delete process.env.HOME
      else process.env.HOME = previousHome
    }
  })

  it("should complete setup when the tool transform throws", async () => {
    const base = makeBase()
    const previousTmpdir = process.env.TMPDIR
    const previousHome = process.env.HOME
    process.env.TMPDIR = base
    process.env.HOME = base
    try {
      const { ctx } = makeFakeContext(base, {
        rpc: true,
        transform: async () => {
          throw new Error("transform unavailable")
        },
      })
      const plugin = (await import("../plugin/index.ts")).default

      const cleanup = await plugin.setup(ctx)

      assert.equal(typeof cleanup, "function")
      await cleanup()
    } finally {
      if (previousTmpdir === undefined) delete process.env.TMPDIR
      else process.env.TMPDIR = previousTmpdir
      if (previousHome === undefined) delete process.env.HOME
      else process.env.HOME = previousHome
    }
  })
})
