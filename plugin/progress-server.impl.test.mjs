/**
 * Implementation tests for the progress server wiring.
 *
 * These tests cover the registration-failure matrix, per-failure warning
 * behavior across repeated setups, double-registration tolerance, emission
 * failure swallowing at the binding, and session-deletion identity matching.
 * Unlike the spec suite, they may derive from the implementation's internals
 * and evolve with them.
 *
 * @module progress-server.impl.test
 */

import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"

import {
  createCodeOpsProgress,
  registerCodeOpsProgressTool,
} from "../bin/lib/codeops-progress.mjs"
import { registerCodeOpsRpc } from "../bin/lib/codeops-rpc.mjs"

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
  const dir = mkdtempSync(join(tmpdir(), "codeops-progress-impl-"))
  fixtures.push(dir)
  return dir
}

/**
 * Poll a synchronous predicate until it holds or the attempt budget runs out.
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
 * Wait one generous settle period for the plugin's event loop to process a
 * dispatched event with no observable residue.
 *
 * @returns {Promise<void>} Resolves after the settle period.
 */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 50))
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
 * Build an event stream that yields one `session.deleted` event per session
 * ID, each gated by its own release trigger, so ordering is deterministic.
 *
 * @param {string[]} sessionIDs - The session IDs to delete, in order.
 * @returns {{ stream: AsyncIterable<object>, release: (index: number) => void }}
 *   The stream and its per-event release triggers.
 */
function gatedDeletionStream(sessionIDs) {
  const gates = sessionIDs.map(() => {
    let release
    const promise = new Promise((resolve) => {
      release = resolve
    })
    return { promise, release }
  })
  const stream = (async function* () {
    for (let index = 0; index < sessionIDs.length; index += 1) {
      await gates[index].promise
      yield { type: "session.deleted", data: { sessionID: sessionIDs[index] } }
    }
  })()
  return { stream, release: (index) => gates[index].release() }
}

/**
 * Build a fake server plugin context mirroring only the surface `setup` uses.
 *
 * @param {string} directory - Project directory reported by the context.
 * @param {object} [options] - `rpc` enables the capturing RPC domain;
 *   `transform` supplies the tool transform; `stream` supplies the event
 *   stream (defaults to an empty one).
 * @returns {object} The fake context and captured registration state.
 */
function makeFakeContext(directory, options = {}) {
  const adds = []
  const emits = []
  const captured = { adds, emits, definition: null, handlers: null }
  const ctx = {
    location: { directory },
    app: { version: "2.0.26" },
    event: { subscribe: () => options.stream ?? (async function* () {})() },
    session: { hook: async () => {} },
    shell: { hook: async () => {} },
    tool: { hook: async () => {} },
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
  return { ctx, captured }
}

/**
 * Run a function with TMPDIR and HOME pointed at a fixture base, restoring
 * the previous values afterwards.
 *
 * @param {string} base - The fixture base directory.
 * @param {() => Promise<void>} run - The work to run under the overrides.
 * @returns {Promise<void>} Resolves when the work completes.
 */
async function withFixtureEnv(base, run) {
  const previousTmpdir = process.env.TMPDIR
  const previousHome = process.env.HOME
  process.env.TMPDIR = base
  process.env.HOME = base
  try {
    await run()
  } finally {
    if (previousTmpdir === undefined) delete process.env.TMPDIR
    else process.env.TMPDIR = previousTmpdir
    if (previousHome === undefined) delete process.env.HOME
    else process.env.HOME = previousHome
  }
}

describe("tool registration failure matrix", () => {
  it("should report false for every missing or non-function tool API", async () => {
    const runtime = createCodeOpsProgress()

    assert.equal(await registerCodeOpsProgressTool(undefined, runtime), false)
    assert.equal(await registerCodeOpsProgressTool({}, runtime), false)
    assert.equal(await registerCodeOpsProgressTool({ tool: {} }, runtime), false)
    assert.equal(await registerCodeOpsProgressTool({ tool: { transform: {} } }, runtime), false)
  })

  it("should report false when the transform rejects and stay usable afterwards", async () => {
    const runtime = createCodeOpsProgress()
    const failing = {
      tool: {
        transform: async () => {
          throw new Error("transform down")
        },
      },
    }
    assert.equal(await registerCodeOpsProgressTool(failing, runtime), false)

    const adds = []
    assert.equal(await registerCodeOpsProgressTool({ tool: toolDomain(adds) }, runtime), true)
    assert.equal(adds.length, 1)
  })

  it("should tolerate double registration against the same runtime", async () => {
    const runtime = createCodeOpsProgress()
    const first = []
    const second = []

    assert.equal(await registerCodeOpsProgressTool({ tool: toolDomain(first) }, runtime), true)
    assert.equal(await registerCodeOpsProgressTool({ tool: toolDomain(second) }, runtime), true)

    const result = await second[0].execute({ plan: "p", activity: "done" }, { sessionID: "s1" })
    assert.deepEqual(result, { output: { ok: true } })
    assert.equal(runtime.snapshot().plan, "p")
  })
})

describe("warning behavior across repeated setups", () => {
  it("should warn once per failed tool registration without deduplication", async () => {
    const base = makeBase()
    const warnings = []
    const originalWarn = console.warn
    console.warn = (message) => warnings.push(String(message))
    try {
      await withFixtureEnv(base, async () => {
        const plugin = (await import("../plugin/index.ts")).default
        const failing = async () => {
          throw new Error("transform down")
        }
        for (let round = 0; round < 2; round += 1) {
          const { ctx } = makeFakeContext(base, { rpc: true, transform: failing })
          const cleanup = await plugin.setup(ctx)
          await cleanup()
        }
      })
    } finally {
      console.warn = originalWarn
    }

    const toolWarnings = warnings.filter((message) => message.includes("progress tool"))
    assert.equal(toolWarnings.length, 2, "each failed setup warns exactly once")
    assert.ok(toolWarnings.every((message) => message.includes("unavailable")))
  })

  it("should stay silent about the progress tool when registration succeeds", async () => {
    const base = makeBase()
    const warnings = []
    const originalWarn = console.warn
    console.warn = (message) => warnings.push(String(message))
    try {
      await withFixtureEnv(base, async () => {
        const plugin = (await import("../plugin/index.ts")).default
        const { ctx } = makeFakeContext(base, {
          rpc: true,
          transform: async (callback) => {
            await callback({ add: () => {} })
          },
        })
        const cleanup = await plugin.setup(ctx)
        await cleanup()
      })
    } finally {
      console.warn = originalWarn
    }

    assert.equal(warnings.filter((message) => message.includes("progress tool")).length, 0)
  })
})

describe("emission failure swallowing at the binding", () => {
  it("should keep the tool result ok when the bound emitter throws or rejects", async () => {
    const emitters = [
      () => {
        throw new Error("synchronous emitter failure")
      },
      async () => {
        throw new Error("asynchronous emitter failure")
      },
    ]

    for (const emit of emitters) {
      const runtime = createCodeOpsProgress()
      const rpcCtx = { rpc: { register: async () => ({ events: { emit } }) } }
      assert.equal(await registerCodeOpsRpc(rpcCtx, { pluginVersion: "2.1.1", runtime }), true)

      const adds = []
      await registerCodeOpsProgressTool({ tool: toolDomain(adds) }, runtime)
      const result = await adds[0].execute(
        { plan: "p", activity: "implementing" },
        { sessionID: "s1" }
      )

      assert.deepEqual(result, { output: { ok: true } })
      assert.equal(runtime.snapshot().plan, "p")
    }
    await settle()
  })
})

describe("session-deletion identity matching", () => {
  it("should leave the run intact when a different session is deleted, then clear its own", async () => {
    const base = makeBase()
    await withFixtureEnv(base, async () => {
      const { stream, release } = gatedDeletionStream(["other", "s1"])
      const { ctx, captured } = makeFakeContext(base, {
        rpc: true,
        transform: async (callback) => {
          await callback({ add: (entry) => captured.adds.push(entry) })
        },
        stream,
      })

      const plugin = (await import("../plugin/index.ts")).default
      const cleanup = await plugin.setup(ctx)

      const result = await captured.adds[0].execute(
        { plan: "p", activity: "implementing" },
        { sessionID: "s1" }
      )
      assert.deepEqual(result, { output: { ok: true } })
      assert.equal((await captured.handlers.progress()).plan, "p")

      release(0)
      await settle()
      assert.equal(
        (await captured.handlers.progress())?.plan,
        "p",
        "a foreign session's deletion must not clear the run"
      )
      assert.equal(captured.emits.filter(([name]) => name === "cleared").length, 0)

      release(1)
      const sawCleared = await waitFor(() =>
        captured.emits.some(([name]) => name === "cleared")
      )
      assert.equal(sawCleared, true)
      const cleared = captured.emits.find(([name]) => name === "cleared")[1]
      assert.equal(cleared.sessionID, "s1")
      assert.equal(await captured.handlers.progress(), null)

      await cleanup()
    })
  })

  it("should complete two setup calls against fresh contexts", async () => {
    const base = makeBase()
    await withFixtureEnv(base, async () => {
      const plugin = (await import("../plugin/index.ts")).default

      for (let round = 0; round < 2; round += 1) {
        const { ctx } = makeFakeContext(base, {
          rpc: true,
          transform: async (callback) => {
            await callback({ add: () => {} })
          },
        })
        const cleanup = await plugin.setup(ctx)
        assert.equal(typeof cleanup, "function")
        await cleanup()
      }
    })
  })
})
