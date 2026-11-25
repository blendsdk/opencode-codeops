/**
 * Implementation tests for the compaction-note wiring in the plugin.
 *
 * These tests load the real plugin against a fake server context, report a run
 * through the registered progress tool, and invoke the captured `compaction`
 * hook. They pin the hook's ordering (the standards first, the note second)
 * and that no note is pushed when the compacting session owns no run. Unlike
 * the spec suite, they may derive from the implementation and evolve with it.
 *
 * @module compaction-note.impl.test
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
  const dir = mkdtempSync(join(tmpdir(), "codeops-compaction-impl-"))
  fixtures.push(dir)
  return dir
}

/**
 * Run work with TMPDIR and HOME pointed at a fixture base, restoring both afterwards.
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

/**
 * Build a fake server plugin context that captures session hooks and tool registrations.
 *
 * @param {string} directory - Project directory reported by the context.
 * @returns {{ ctx: object, hooks: Map<string, Function[]>, tools: object[] }} The context
 *   and the captured hook callbacks (by hook name) and tool entries.
 */
function makeFakeContext(directory) {
  const hooks = new Map()
  const tools = []
  const ctx = {
    location: { directory },
    app: { version: "2.0.26" },
    event: { subscribe: () => (async function* () {})() },
    session: {
      hook: async (name, callback) => {
        hooks.set(name, [...(hooks.get(name) ?? []), callback])
      },
    },
    shell: { hook: async () => {} },
    tool: {
      hook: async () => {},
      transform: async (callback) => {
        await callback({ add: (entry) => tools.push(entry) })
      },
    },
    model: { list: async () => ({ data: [] }) },
  }
  return { ctx, hooks, tools }
}

/**
 * Load the plugin against a fresh fake context.
 *
 * @param {string} base - The fixture base directory used as the project directory.
 * @returns {Promise<{ hooks: Map<string, Function[]>, tools: object[], cleanup: Function }>}
 */
async function setupPlugin(base) {
  const { ctx, hooks, tools } = makeFakeContext(base)
  const plugin = (await import("../plugin/index.ts")).default
  const cleanup = await plugin.setup(ctx)
  return { hooks, tools, cleanup }
}

/**
 * Invoke every captured `compaction` hook for one session.
 *
 * @param {Map<string, Function[]>} hooks - Captured hooks by name.
 * @param {string} sessionID - The session being compacted.
 * @returns {Promise<string[]>} The texts the hooks pushed into the system parts, in order.
 */
async function compact(hooks, sessionID) {
  const event = { sessionID, system: [] }
  for (const callback of hooks.get("compaction") ?? []) await callback(event)
  return event.system.map((part) => part.text)
}

describe("compaction hook wiring", () => {
  it("should push the standards first and the note second for the session that owns the run", async () => {
    const base = makeBase()
    await withFixtureEnv(base, async () => {
      const { hooks, tools, cleanup } = await setupPlugin(base)
      await tools[0].execute(
        { plan: "my-plan", phase: "2", task: "2.1.3", activity: "implementing" },
        { sessionID: "s1" }
      )

      const texts = await compact(hooks, "s1")
      assert.equal(texts.length, 2)
      assert.match(texts[0], /^## CodeOps Standards \(always active\)/)
      assert.match(texts[1], /^CodeOps run in progress — plan "my-plan", phase "2", task "2\.1\.3"\./)

      if (typeof cleanup === "function") await cleanup()
    })
  })

  it("should push only the standards when no run is active or another session owns it", async () => {
    const base = makeBase()
    await withFixtureEnv(base, async () => {
      const { hooks, tools, cleanup } = await setupPlugin(base)
      assert.equal((await compact(hooks, "s1")).length, 1)

      await tools[0].execute({ plan: "my-plan", activity: "implementing" }, { sessionID: "s2" })
      assert.equal((await compact(hooks, "s1")).length, 1)

      if (typeof cleanup === "function") await cleanup()
    })
  })
})
