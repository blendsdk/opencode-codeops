/**
 * Implementation tests for the Discovery plugin integration.
 *
 * These cases cover edges the specification tests do not pin: config parsing
 * details, transform guard paths, reload behaviour, owned plans on the read
 * tools, idempotent disposal, and per-plan delivery. They may change with the
 * implementation; the specification tests may not.
 *
 * @module discovery-plugin.impl.test
 */

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"

import {
  createDiscoveryController,
  readDiscoveryConfig,
  registerDiscoveryTools,
} from "../bin/lib/discovery-tools.mjs"
import { createDiscoveryRuntime } from "../bin/lib/discovery-server.mjs"
import { createDiscoveryStore } from "../bin/lib/discovery-store.mjs"

/** Throwaway roots created by the tests, removed afterward. */
const created = []

/** Base directory for temporary roots. */
const BASE = process.env.CODEOPS_TMPDIR ?? tmpdir()

after(() => {
  for (const directory of created) rmSync(directory, { recursive: true, force: true })
})

/** Creates a throwaway directory. */
function scratch(prefix) {
  const directory = mkdtempSync(join(BASE, `discovery-plugin-impl-${prefix}-`))
  created.push(directory)
  return directory
}

/** Writes a config file. */
function writeConfig(directory, discovery) {
  mkdirSync(join(directory, "codeops"), { recursive: true })
  writeFileSync(
    join(directory, "codeops", "codeops.json"),
    JSON.stringify({ discovery }),
  )
}

/** A choice question. */
function single(key, group = "Scope") {
  return {
    key,
    group,
    type: "single",
    title: key,
    options: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
  }
}

/** A publish payload. */
function payload(questions = [single("q1")]) {
  return {
    artifact: "plans/billing",
    kind: "plan",
    title: "Billing plan",
    groups: [{ key: "Scope", title: "Scope" }],
    questions,
  }
}

/** A minimal fake plugin context. */
function fakeContext(directory) {
  const state = {
    tools: new Map(),
    transforms: [],
    promptCalls: [],
    sessions: new Map(),
    promptError: null,
  }
  const editor = {
    add(tool) {
      state.tools.set(tool.name, tool)
    },
    list: () => [...state.tools.values()],
    get: (name) => state.tools.get(name),
    update() {},
    remove: (name) => state.tools.delete(name),
    namespace() {},
  }
  const apply = () => {
    state.tools.clear()
    for (const transform of state.transforms) transform(editor)
  }
  const ctx = {
    location: { directory, project: { id: "proj", directory, canonical: directory } },
    tool: {
      async transform(callback) {
        state.transforms.push(callback)
        apply()
        return { dispose: async () => {} }
      },
      async reload() {
        apply()
      },
      async list() {
        return [...state.tools.values()]
      },
    },
    session: {
      async hook() {
        return { dispose: async () => {} }
      },
      async get({ sessionID }) {
        const session = state.sessions.get(sessionID)
        if (!session) throw new Error("session not found")
        return session
      },
      async prompt(input) {
        state.promptCalls.push(input)
        if (state.promptError) throw state.promptError
        if (!state.sessions.has(input.sessionID)) throw new Error("session not found")
      },
    },
  }
  return { ctx, state, apply, toolNames: () => [...state.tools.keys()] }
}

/** Prepares an enabled project with a port-0 runtime. */
async function prepared(t, { enabled = true, directoryName = "my-repo" } = {}) {
  const directory = join(scratch("project"), directoryName)
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  if (enabled !== undefined) writeConfig(directory, { enabled })
  const dataDir = join(scratch("data"), "discovery")
  const assetsDir = scratch("assets")
  const key = Symbol.for("opencode-codeops.discovery")
  delete globalThis[key]
  const store = createDiscoveryStore({ dataDir })
  const runtime = createDiscoveryRuntime({ store, assetsDir, version: "9.9.9", port: 0 })
  const fake = fakeContext(directory)
  const controller = createDiscoveryController(fake.ctx, {
    directory,
    dataDir,
    assetsDir,
    version: "9.9.9",
    openBrowser: () => true,
  })
  t.after(async () => {
    await controller.dispose()
    await runtime.closeIfIdle()
    delete globalThis[key]
  })
  return { directory, dataDir, assetsDir, store, runtime, fake, controller }
}

describe("config parsing", () => {
  it("should treat a missing discovery object and non-integer limits as defaults", () => {
    const directory = scratch("config")
    mkdirSync(join(directory, "codeops"), { recursive: true })
    writeFileSync(join(directory, "codeops", "codeops.json"), JSON.stringify({}))
    assert.deepEqual(readDiscoveryConfig(directory), { enabled: false, chatMaxQuestions: 3 })

    writeConfig(directory, { enabled: false, chatMaxQuestions: 9 })
    assert.deepEqual(readDiscoveryConfig(directory), { enabled: false, chatMaxQuestions: 3 })

    writeConfig(directory, { enabled: true, chatMaxQuestions: 0 })
    assert.deepEqual(readDiscoveryConfig(directory), { enabled: true, chatMaxQuestions: 0 })

    writeConfig(directory, { enabled: true, chatMaxQuestions: "5" })
    assert.deepEqual(readDiscoveryConfig(directory), { enabled: true, chatMaxQuestions: 3 })
  })
})

describe("transform guards", () => {
  it("should register nothing while disabled and add the tools after a reload", async (t) => {
    const context = await prepared(t, { enabled: false })
    const registered = await registerDiscoveryTools(context.fake.ctx, context.controller)
    assert.equal(registered, true)
    assert.deepEqual(context.fake.toolNames(), [])

    writeConfig(context.directory, { enabled: true })
    await context.controller.sync()
    await context.fake.ctx.tool.reload()
    assert.equal(context.fake.toolNames().length, 3)
  })

  it("should return false without a transform and when the transform throws", async (t) => {
    const context = await prepared(t)
    await context.controller.sync()
    assert.equal(await registerDiscoveryTools({}, context.controller), false)
    assert.equal(
      await registerDiscoveryTools(
        {
          tool: {
            async transform() {
              throw new Error("host rejected the transform")
            },
          },
          session: {},
        },
        context.controller,
      ),
      false,
    )
  })
})

describe("read tools", () => {
  it("should report owned plans and unknown artifacts", async (t) => {
    const context = await prepared(t)
    await context.controller.sync()
    await registerDiscoveryTools(context.fake.ctx, context.controller)
    const project = await context.runtime.store.findProjectByDirectory(context.directory)
    await context.runtime.store.publish(project.slug, payload(), "s2")

    const answers = await context.controller.answers(
      { artifact: "plans/billing", kind: "plan" },
      "s1",
    )
    assert.equal(answers.ok, false)
    assert.equal(answers.reason, "owned")
    assert.equal(answers.owner, "s2")

    const missing = await context.controller.resolve(
      { artifact: "nope", kind: "plan" },
      "s1",
    )
    assert.equal(missing.ok, false)
    assert.equal(missing.reason, "not-found")
  })

  it("should report disabled before a controller is enabled", async (t) => {
    const context = await prepared(t, { enabled: false })
    const result = await context.controller.publish(payload(), "s1")
    assert.equal(result.ok, false)
    assert.equal(result.reason, "disabled")
  })
})

describe("delivery and lifecycle edges", () => {
  it("should deliver each plan once and mark the submissions", async (t) => {
    const context = await prepared(t)
    await context.controller.sync()
    await registerDiscoveryTools(context.fake.ctx, context.controller)
    context.fake.state.sessions.set("s1", {
      id: "s1",
      location: { directory: context.directory },
    })
    const project = await context.runtime.store.findProjectByDirectory(context.directory)

    for (const [index, artifact] of ["plans/one", "plans/two"].entries()) {
      const record = await context.runtime.store.publish(
        project.slug,
        { ...payload([single(index === 0 ? "q1" : "q2")]), artifact },
        "s1",
      )
      assert.equal(record.ok, true)
      const plan = record.plan
      await context.runtime.store.saveAnswer(
        project.slug,
        plan.slug,
        index === 0 ? "q1" : "q2",
        { answer: { choice: "a" } },
        1,
      )
      await context.runtime.store.submit(project.slug, plan.slug, "Scope", 1)
    }

    await context.controller.publish(
      { ...payload([single("q1")]), artifact: "plans/one" },
      "s1",
    )
    assert.equal(context.fake.state.promptCalls.length, 1)
    await context.controller.publish(
      { ...payload([single("q2")]), artifact: "plans/two" },
      "s1",
    )
    assert.equal(context.fake.state.promptCalls.length, 2)
    const pending = await context.runtime.store.pendingDeliveries(project.slug)
    assert.deepEqual(pending, [])
  })

  it("should dispose idempotently and tolerate a missing runtime on session deletion", async (t) => {
    const context = await prepared(t, { enabled: false })
    await context.controller.onSessionDeleted("s1")
    await context.controller.dispose()
    await context.controller.dispose()
    assert.equal(context.controller.isEnabled(), false)
  })
})
