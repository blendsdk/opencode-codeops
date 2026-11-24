/**
 * Specification tests for the effort capability line.
 *
 * These cases pin the user-visible disclosure through the real plugin setup:
 * one line per changed resolution tuple, the requested/applied/mapping fields,
 * the fail-open form, silence when no level is active, and clearing on session
 * deletion. A failure here means the plugin does not satisfy RD-03 FR-9 —
 * never that the test is wrong.
 *
 * @module effort-capability.spec.test
 */

import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"

/** Fixture temp directories created by this suite; removed on exit. */
const fixtures = []

after(() => {
  while (fixtures.length > 0) {
    rmSync(fixtures.pop(), { recursive: true, force: true })
  }
})

/**
 * Create a throwaway project directory for one fixture.
 *
 * @returns {string} Absolute path to the new directory
 */
function makeBase() {
  const dir = mkdtempSync(join(tmpdir(), "codeops-effort-capability-"))
  fixtures.push(dir)
  return dir
}

/**
 * Build a fake plugin context that captures session hooks.
 *
 * Only the surface `setup` uses is provided. The session hook list keeps the
 * callback so the test can invoke the real context hook.
 *
 * @param {object[]} models - Model registry entries
 * @param {AsyncIterable<object>} [stream] - Event stream for session deletion
 * @returns {{ ctx: object, hooks: { session: Array<[string, Function]> } }} The fake context
 */
function makeContext(models, stream) {
  const hooks = { session: [], shell: [], tool: [] }
  const ctx = {
    location: { directory: makeBase() },
    app: { version: "2.0.26" },
    event: { subscribe: () => stream ?? (async function* () {})() },
    session: {
      hook: async (name, callback) => {
        hooks.session.push([name, callback])
      },
    },
    shell: {
      hook: async (name, callback) => {
        hooks.shell.push([name, callback])
      },
    },
    tool: {
      hook: async (name, callback) => {
        hooks.tool.push([name, callback])
      },
    },
    model: { list: async () => ({ data: models }) },
  }
  return { ctx, hooks }
}

/**
 * Start the real plugin against a fake context.
 *
 * @param {object[]} models - Model registry entries
 * @param {AsyncIterable<object>} [stream] - Event stream for session deletion
 * @returns {Promise<{ hooks: object, cleanup: Function }>} Captured hooks and cleanup
 */
async function setup(models, stream) {
  const { ctx, hooks } = makeContext(models, stream)
  const plugin = (await import("../plugin/index.ts")).default
  const cleanup = await plugin.setup(ctx)
  return { hooks, cleanup }
}

/**
 * Send one dispatch marker through the prompt hook.
 *
 * @param {object} hooks - Captured plugin hooks
 * @param {string} sessionID - Session identifier
 * @param {string} level - Marker level
 * @returns {Promise<void>} Resolves after the hook runs
 */
async function dispatch(hooks, sessionID, level) {
  const entry = hooks.session.find(([name]) => name === "prompt")
  assert.ok(entry, "the plugin must register a prompt hook")
  await entry[1]({
    sessionID,
    messageID: "msg_1",
    prompt: { text: `work\n[codeops-effort: ${level}]` },
  })
}

/**
 * Run every registered context hook for one request.
 *
 * @param {object} hooks - Captured plugin hooks
 * @param {object} event - Request event (system and options are mutated)
 * @returns {Promise<object>} The same event after the hooks run
 */
async function request(hooks, event) {
  for (const [name, callback] of hooks.session) {
    if (name === "context") await callback(event)
  }
  return event
}

/**
 * Build a request event for a model.
 *
 * @param {string} sessionID - Session identifier
 * @param {string} providerID - Model provider
 * @param {string} id - Model id
 * @returns {object} A mutable request event
 */
function requestEvent(sessionID, providerID, id) {
  return {
    sessionID,
    agent: "build",
    model: { providerID, id },
    options: {},
    system: [],
  }
}

/**
 * Collect the capability lines from a request's system entries.
 *
 * @param {object} event - Request event
 * @returns {string[]} Matching line texts
 */
function effortLines(event) {
  return event.system
    .filter((entry) => entry.type === "text" && entry.text.startsWith("CodeOps effort:"))
    .map((entry) => entry.text)
}

/**
 * Build a host variant entry.
 *
 * @param {string} id - Variant id
 * @returns {object} A host-shaped variant entry
 */
function variant(id) {
  return { id, settings: { reasoningEffort: id } }
}

describe("capability line content (ST-17)", () => {
  it("discloses model, variants, context, requested, applied, and mapping", async () => {
    const models = [
      {
        providerID: "anthropic",
        id: "claude-x",
        variants: [variant("low"), variant("xhigh")],
        limit: { context: 200000 },
      },
    ]
    const { hooks, cleanup } = await setup(models)
    try {
      const sessionID = "ses_capability"
      await dispatch(hooks, sessionID, "high")
      const event = await request(hooks, requestEvent(sessionID, "anthropic", "claude-x"))

      assert.equal(event.options.reasoningEffort, "xhigh")
      assert.deepEqual(effortLines(event), [
        "CodeOps effort: model=anthropic/claude-x; variants=low,xhigh; context=200000; requested=high; applied=xhigh; mapping=nearest",
      ])
      assert.doesNotMatch(effortLines(event)[0], /work|msg_1|\/tmp\//)
    } finally {
      await cleanup()
    }
  })

  it("discloses fail-open without changing the request", async () => {
    const models = [{ providerID: "openai", id: "o1" }]
    const { hooks, cleanup } = await setup(models)
    try {
      const sessionID = "ses_fail_open"
      await dispatch(hooks, sessionID, "high")
      const event = await request(hooks, requestEvent(sessionID, "openai", "o1"))

      assert.deepEqual(event.options, {})
      assert.deepEqual(effortLines(event), [
        "CodeOps effort: model=openai/o1; variants=none; context=unknown; requested=high; applied=unavailable; mapping=fail-open",
      ])
    } finally {
      await cleanup()
    }
  })

  it("stays silent when no level is active", async () => {
    const models = [{ providerID: "openai", id: "o1", variants: [variant("high")] }]
    const { hooks, cleanup } = await setup(models)
    try {
      const event = await request(hooks, requestEvent("ses_none", "openai", "o1"))

      assert.deepEqual(effortLines(event), [])
      assert.deepEqual(event.options, {})
    } finally {
      await cleanup()
    }
  })
})

describe("capability-line dedupe (ST-18)", () => {
  it("emits once per tuple and again after a change or session deletion", async () => {
    const models = [
      {
        providerID: "anthropic",
        id: "claude-x",
        variants: ["low", "medium", "high", "xhigh", "max"].map(variant),
        limit: { context: 200000 },
      },
    ]
    let release
    const gate = new Promise((resolve) => {
      release = resolve
    })
    const stream = (async function* () {
      await gate
      yield { type: "session.deleted", data: { sessionID: "ses_dedupe" } }
    })()
    const { hooks, cleanup } = await setup(models, stream)
    try {
      const sessionID = "ses_dedupe"
      await dispatch(hooks, sessionID, "high")
      const first = await request(hooks, requestEvent(sessionID, "anthropic", "claude-x"))
      assert.equal(effortLines(first).length, 1)

      const second = await request(hooks, requestEvent(sessionID, "anthropic", "claude-x"))
      assert.equal(effortLines(second).length, 0, "the same tuple must not repeat")

      await dispatch(hooks, sessionID, "max")
      const changed = await request(hooks, requestEvent(sessionID, "anthropic", "claude-x"))
      assert.equal(effortLines(changed).length, 1)
      assert.match(effortLines(changed)[0], /requested=max/)

      release()
      let reappeared = false
      for (let attempt = 0; attempt < 100 && !reappeared; attempt += 1) {
        await dispatch(hooks, sessionID, "max")
        const afterDelete = await request(
          hooks,
          requestEvent(sessionID, "anthropic", "claude-x")
        )
        reappeared = effortLines(afterDelete).length === 1
        if (!reappeared) await new Promise((resolve) => setTimeout(resolve, 5))
      }
      assert.equal(reappeared, true, "session deletion must clear the dedupe state")
    } finally {
      await cleanup()
    }
  })
})
