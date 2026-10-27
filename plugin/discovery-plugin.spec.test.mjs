/**
 * Specification tests for the Discovery plugin integration.
 *
 * These cases pin the opt-in check, the config schema, the controller
 * lifecycle, the three agent tools, delivery and waking, orphaning, and the
 * degradation paths. They drive the integration module directly with a fake
 * plugin context, as the plan specifies.
 *
 * @module discovery-plugin.spec.test
 */

import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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
  const directory = mkdtempSync(join(BASE, `discovery-plugin-${prefix}-`))
  created.push(directory)
  return directory
}

/** Writes a project config with the given Discovery settings. */
function writeConfig(directory, discovery) {
  mkdirSync(join(directory, "codeops"), { recursive: true })
  writeFileSync(
    join(directory, "codeops", "codeops.json"),
    JSON.stringify({
      schema: 1,
      mode: "strict",
      artifacts: { layout: "flat", root: "." },
      ...(discovery === undefined ? {} : { discovery }),
    }),
  )
}

/** Builds one choice question. */
function single(key, group = "A", options = ["a", "b"]) {
  return {
    key,
    group,
    type: "single",
    title: `${key} title`,
    options: options.map((id) => ({ id, label: id.toUpperCase() })),
  }
}

/** Builds a publish payload. */
function payload(overrides = {}) {
  return {
    artifact: "plans/billing",
    kind: "plan",
    title: "Billing plan",
    groups: [{ key: "Scope", title: "Scope" }],
    questions: [single("q1", "Scope"), single("q2", "Scope")],
    ...overrides,
  }
}

/** A fake plugin context with a re-runnable tool transform and sessions. */
function fakeContext(directory) {
  const state = {
    tools: new Map(),
    transforms: [],
    contextHooks: [],
    promptCalls: [],
    sessions: new Map(),
    promptError: null,
  }
  const editor = {
    add(tool) {
      state.tools.set(tool.name, tool)
    },
    list() {
      return [...state.tools.values()]
    },
    get(name) {
      return state.tools.get(name)
    },
    update() {},
    remove(name) {
      state.tools.delete(name)
    },
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
      async hook(name, callback) {
        if (name === "context") state.contextHooks.push(callback)
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
  return {
    ctx,
    state,
    apply,
    toolNames: () => [...state.tools.keys()],
    async call(name, input, sessionID = "s1") {
      const tool = state.tools.get(name)
      if (!tool) throw new Error(`tool ${name} is not registered`)
      return tool.execute(input, { sessionID, signal: new AbortController().signal })
    },
  }
}

/** Installs a fresh runtime in the process-wide slot and prepares a project. */
function prepare(t, { config = { enabled: true }, port = 0, directoryName = "my-repo" } = {}) {
  const root = scratch("project")
  const directory = join(root, directoryName)
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  if (config !== undefined) writeConfig(directory, config)

  const dataDir = join(scratch("data"), "discovery")
  const assetsDir = scratch("assets")
  const key = Symbol.for("opencode-codeops.discovery")
  delete globalThis[key]
  const store = createDiscoveryStore({ dataDir })
  const runtime = createDiscoveryRuntime({ store, assetsDir, version: "9.9.9", port })
  const opened = []
  const fake = fakeContext(directory)
  const controller = createDiscoveryController(fake.ctx, {
    directory,
    dataDir,
    assetsDir,
    version: "9.9.9",
    openBrowser: (url) => {
      opened.push(url)
      return true
    },
    branchOf: () => null,
  })
  t.after(async () => {
    await controller.dispose()
    await runtime.closeIfIdle()
    delete globalThis[key]
  })
  return { root, directory, dataDir, assetsDir, runtime, store, controller, fake, opened, key }
}

/** Seeds a plan through the store and returns its record. */
async function seedPlan(runtime, directory, input = payload(), sessionID = "s1") {
  const project = await runtime.store.findProjectByDirectory(directory)
  assert.ok(project, "the controller must register the project")
  const result = await runtime.store.publish(project.slug, input, sessionID)
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result))
  return { project, plan: result.plan }
}

/** Reads server-sent events from a fetch response. */
function sseReader(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  const pending = []
  return {
    async next(timeoutMs = 3000) {
      const deadline = Date.now() + timeoutMs
      while (pending.length === 0) {
        const remaining = deadline - Date.now()
        if (remaining <= 0) throw new Error("timed out")
        let timer
        const chunk = await Promise.race([
          reader.read(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("timed out")), remaining)
          }),
        ]).finally(() => clearTimeout(timer))
        if (chunk.done) throw new Error("stream ended")
        buffer += decoder.decode(chunk.value, { stream: true })
        let index = buffer.indexOf("\n\n")
        while (index >= 0) {
          const block = buffer.slice(0, index)
          buffer = buffer.slice(index + 2)
          const event = { event: "message", data: "" }
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) event.event = line.slice(6).trim()
            else if (line.startsWith("data:")) event.data += line.slice(5).trim()
          }
          pending.push(event)
          index = buffer.indexOf("\n\n")
        }
      }
      return pending.shift()
    },
    async close() {
      try {
        await reader.cancel()
      } catch {
        // Already closed.
      }
    },
  }
}

/** Polls until a URL refuses the connection. */
async function waitForRejected(url, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await fetch(url)
    } catch {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return false
}

// ---------------------------------------------------------------------------
// Schema and config
// ---------------------------------------------------------------------------

describe("config schema", () => {
  it("should add the discovery settings without changing existing keys", () => {
    const schema = JSON.parse(
      readFileSync(new URL("../schemas/codeops-config.schema.json", import.meta.url), "utf8"),
    )
    const discovery = schema.properties.discovery
    assert.equal(discovery.type, "object")
    assert.equal(discovery.additionalProperties, false)
    assert.equal(discovery.properties.enabled.type, "boolean")
    assert.equal(discovery.properties.chatMaxQuestions.type, "integer")
    assert.equal(discovery.properties.chatMaxQuestions.minimum, 0)
    for (const key of ["schema", "mode", "artifacts", "quality", "routing", "metrics"]) {
      assert.ok(schema.properties[key], `existing key ${key} must stay`)
    }
    assert.deepEqual(schema.required, ["schema", "mode", "artifacts"])
  })
})

describe("opt-in config", () => {
  it("should default to disabled and tolerate an invalid question limit", () => {
    const root = scratch("config")
    const directory = join(root, "project")
    mkdirSync(directory, { recursive: true })
    assert.deepEqual(readDiscoveryConfig(directory), { enabled: false, chatMaxQuestions: 3 })

    writeConfig(directory, { enabled: true })
    assert.deepEqual(readDiscoveryConfig(directory), { enabled: true, chatMaxQuestions: 3 })

    writeConfig(directory, { enabled: true, chatMaxQuestions: 5 })
    assert.deepEqual(readDiscoveryConfig(directory), { enabled: true, chatMaxQuestions: 5 })

    writeFileSync(join(directory, "codeops", "codeops.json"), "{bad")
    assert.deepEqual(readDiscoveryConfig(directory), { enabled: false, chatMaxQuestions: 3 })

    writeConfig(directory, { enabled: "yes" })
    assert.equal(readDiscoveryConfig(directory).enabled, false)

    writeConfig(directory, { enabled: true, chatMaxQuestions: -1 })
    assert.deepEqual(readDiscoveryConfig(directory), { enabled: true, chatMaxQuestions: 3 })
  })
})

// ---------------------------------------------------------------------------
// Disabled and lifecycle
// ---------------------------------------------------------------------------

describe("disabled project", () => {
  it("should register no tool and create no data directory", async () => {
    const root = scratch("disabled")
    const directory = join(root, "project")
    mkdirSync(directory, { recursive: true })
    const dataDir = join(scratch("disabled-data"), "discovery")
    const key = Symbol.for("opencode-codeops.discovery")
    delete globalThis[key]
    const fake = fakeContext(directory)
    const controller = createDiscoveryController(fake.ctx, {
      directory,
      dataDir,
      assetsDir: scratch("assets"),
      version: "9.9.9",
    })
    await controller.sync()
    const registered = await registerDiscoveryTools(fake.ctx, controller)
    assert.equal(registered, true)
    assert.deepEqual(fake.toolNames(), [])
    assert.equal(controller.isEnabled(), false)
    assert.equal(controller.runtime, null)
    assert.equal(readDiscoveryConfig(directory).enabled, false)
    // The disabled path never constructs the store, so the directory is absent.
    assert.equal(existsSync(dataDir), false)
  })
})

describe("enable and disable", () => {
  it("should add and remove the tools, close the listener, and re-register after dispose", async (t) => {
    const prepared = prepare(t, { config: { enabled: true } })
    const { controller, fake, runtime } = prepared
    await controller.sync()
    await fake.ctx.session.hook("context", async () => {
      await controller.sync()
    })
    await registerDiscoveryTools(fake.ctx, controller)
    assert.deepEqual(fake.toolNames().sort(), [
      "codeops_discovery_answers",
      "codeops_discovery_publish",
      "codeops_discovery_resolve",
    ])
    const started = await runtime.ensureListening()
    assert.ok(started)
    const project = await runtime.store.findProjectByDirectory(prepared.directory)
    assert.ok(project)

    writeConfig(prepared.directory, { enabled: false })
    await fake.state.contextHooks[0]()
    assert.deepEqual(fake.toolNames(), [])
    assert.equal(await waitForRejected(`${started.url}/api/health`), true)

    writeConfig(prepared.directory, { enabled: true })
    await fake.state.contextHooks[0]()
    assert.equal(fake.toolNames().length, 3)

    await controller.dispose()
    const second = createDiscoveryController(fake.ctx, {
      directory: prepared.directory,
      dataDir: prepared.dataDir,
      assetsDir: prepared.assetsDir,
      version: "9.9.9",
    })
    await second.sync()
    await registerDiscoveryTools(fake.ctx, second)
    assert.equal(fake.toolNames().length, 3)
    const registered = await runtime.store.findProjectByDirectory(prepared.directory)
    assert.ok(registered, "the re-setup controller must register the project again")
    await second.dispose()
  })
})

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

describe("publish tool", () => {
  it("should publish, open the browser once, and respect an open viewer", async (t) => {
    const prepared = prepare(t)
    const { controller, fake, runtime, opened } = prepared
    await controller.sync()
    await registerDiscoveryTools(fake.ctx, controller)

    const first = (await fake.call("codeops_discovery_publish", payload())).output
    assert.equal(first.ok, true)
    assert.match(first.url, /^http:\/\/127\.0\.0\.1:\d+\/#\/p\/[a-z0-9-]+\/[a-z0-9-]+$/)
    assert.equal(first.revision, 1)
    assert.equal(first.opened, true)
    assert.equal(first.fallbackPort, null)
    assert.deepEqual(opened, [first.url])

    const project = await runtime.store.findProjectByDirectory(prepared.directory)
    const viewer = await fetch(
      `${new URL(first.url).origin}/api/projects/${project.slug}/plans/${first.plan.slug}/events`,
    )
    const events = sseReader(viewer)
    await events.next()

    const second = (await fake.call("codeops_discovery_publish", payload())).output
    assert.equal(second.ok, true)
    assert.equal(second.revision, 2)
    assert.equal(second.opened, false)
    assert.deepEqual(opened, [first.url])
    await events.close()
  })

  it("should report invalid payloads and foreign ownership", async (t) => {
    const prepared = prepare(t)
    const { controller, fake, runtime } = prepared
    await controller.sync()
    await registerDiscoveryTools(fake.ctx, controller)

    const invalid = (await fake.call("codeops_discovery_publish", { artifact: "" })).output
    assert.equal(invalid.ok, false)
    assert.equal(invalid.reason, "invalid")
    assert.ok(invalid.errors.length > 0)

    const project = await runtime.store.findProjectByDirectory(prepared.directory)
    await runtime.store.publish(project.slug, payload(), "s2")
    const owned = (await fake.call("codeops_discovery_publish", payload(), "s1")).output
    assert.equal(owned.ok, false)
    assert.equal(owned.reason, "owned")
    assert.equal(owned.owner, "s2")
  })

  it("should report unavailable when the listener cannot start", async (t) => {
    const directory = join(scratch("unavailable"), "project")
    mkdirSync(directory, { recursive: true })
    writeConfig(directory, { enabled: true })
    const key = Symbol.for("opencode-codeops.discovery")
    delete globalThis[key]
    const store = createDiscoveryStore({ dataDir: join(scratch("unavailable-data"), "discovery") })
    const fakeRuntime = {
      store,
      ensureListening: async () => null,
      registerProject: () => () => {},
      hasViewer: () => false,
      notify: () => {},
      closeIfIdle: async () => {},
      planUrl: () => null,
    }
    globalThis[key] = fakeRuntime
    const fake = fakeContext(directory)
    const controller = createDiscoveryController(fake.ctx, {
      directory,
      dataDir: join(scratch("unavailable-data2"), "discovery"),
      assetsDir: scratch("assets"),
      version: "9.9.9",
    })
    t.after(async () => {
      await controller.dispose()
      delete globalThis[key]
    })
    await controller.sync()
    await registerDiscoveryTools(fake.ctx, controller)
    const result = (await fake.call("codeops_discovery_publish", payload())).output
    assert.equal(result.ok, false)
    assert.equal(result.reason, "unavailable")
  })

  it("should report the fallback port when the default port is held", async (t) => {
    const holder = prepare(t)
    await holder.controller.sync()
    const held = await holder.runtime.ensureListening()
    const heldPort = Number(new URL(held.url).port)

    const root = scratch("fallback")
    const directory = join(root, "my-repo")
    mkdirSync(directory, { recursive: true })
    writeConfig(directory, { enabled: true })
    const dataDir = join(scratch("fallback-data"), "discovery")
    const assetsDir = scratch("assets")
    const key = Symbol.for("opencode-codeops.discovery")
    delete globalThis[key]
    const runtime = createDiscoveryRuntime({
      store: createDiscoveryStore({ dataDir }),
      assetsDir,
      version: "9.9.9",
      port: heldPort,
    })
    t.after(async () => {
      await runtime.closeIfIdle()
      delete globalThis[key]
    })
    const fake = fakeContext(directory)
    const controller = createDiscoveryController(fake.ctx, {
      directory,
      dataDir,
      assetsDir,
      version: "9.9.9",
      // Keep the test hermetic: a real browser tab would hold an event stream
      // open and delay the listener shutdown.
      openBrowser: () => true,
    })
    t.after(async () => {
      await controller.dispose()
    })
    await controller.sync()
    await registerDiscoveryTools(fake.ctx, controller)
    const result = (await fake.call("codeops_discovery_publish", payload())).output
    assert.equal(result.ok, true)
    const bound = Number(new URL(result.url).port)
    assert.equal(result.fallbackPort, bound)
    assert.notEqual(bound, heldPort)
  })
})

// ---------------------------------------------------------------------------
// Answers and resolve
// ---------------------------------------------------------------------------

describe("answers and resolve", () => {
  it("should read a submission, record a key, and notify the page", async (t) => {
    const prepared = prepare(t)
    const { controller, fake, runtime } = prepared
    await controller.sync()
    await registerDiscoveryTools(fake.ctx, controller)
    const { project, plan } = await seedPlan(runtime, prepared.directory)
    await runtime.store.saveAnswer(project.slug, plan.slug, "q1", { answer: { choice: "a" } }, 1)
    await runtime.store.saveAnswer(project.slug, plan.slug, "q2", { answer: { choice: "b" } }, 1)
    await runtime.store.submit(project.slug, plan.slug, "Scope", 1)

    const started = await runtime.ensureListening()
    const viewer = await fetch(
      `${started.url}/api/projects/${project.slug}/plans/${plan.slug}/events`,
    )
    const events = sseReader(viewer)
    await events.next()

    const answers = (await fake.call("codeops_discovery_answers", {
      artifact: "plans/billing",
      kind: "plan",
    })).output
    assert.equal(answers.ok, true)
    assert.equal(answers.submissions.length, 1)
    assert.equal(answers.submissions[0].questions[0].source, "user")
    const changedAfterAnswers = await events.next()
    assert.equal(changedAfterAnswers.event, "changed")

    const resolved = (await fake.call("codeops_discovery_resolve", {
      artifact: "plans/billing",
      kind: "plan",
      recorded: [{ key: "q1", as: "AR-7" }],
    })).output
    assert.equal(resolved.ok, true)
    assert.equal(resolved.recorded, 1)
    assert.equal(resolved.retired, 0)
    const changedAfterResolve = await events.next()
    assert.equal(changedAfterResolve.event, "changed")

    const impliedPlan = await seedPlan(runtime, prepared.directory, {
      artifact: "plans/implied",
      kind: "plan",
      title: "Implied plan",
      groups: [{ key: "Scope", title: "Scope" }],
      questions: [
        {
          key: "i1",
          group: "Scope",
          type: "single",
          title: "i1",
          options: [
            { id: "a", label: "A", implies: [{ question: "i2", answer: "yes", reason: "rule" }] },
            { id: "b", label: "B" },
          ],
        },
        { key: "i2", group: "Scope", type: "text", title: "i2" },
      ],
    })
    await runtime.store.saveAnswer(
      impliedPlan.project.slug,
      impliedPlan.plan.slug,
      "i1",
      { answer: { choice: "a" } },
      1,
    )
    await runtime.store.submit(impliedPlan.project.slug, impliedPlan.plan.slug, "Scope", 1)
    const impliedAnswers = (await fake.call("codeops_discovery_answers", {
      artifact: "plans/implied",
      kind: "plan",
    })).output
    assert.equal(impliedAnswers.ok, true)
    const impliedEntry = impliedAnswers.submissions[0].questions.find((entry) => entry.key === "i2")
    assert.equal(impliedEntry.source, "implied")
    assert.deepEqual(impliedEntry.impliedBy, ["i1"])

    const missing = (await fake.call("codeops_discovery_answers", {
      artifact: "nope",
      kind: "plan",
    })).output
    assert.equal(missing.ok, false)
    assert.equal(missing.reason, "not-found")
    await events.close()
  })
})

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

describe("delivery", () => {
  it("should send one wake per plan with the documented text", async (t) => {
    const prepared = prepare(t)
    const { controller, fake, runtime } = prepared
    await controller.sync()
    await registerDiscoveryTools(fake.ctx, controller)
    const { project, plan } = await seedPlan(runtime, prepared.directory)
    await runtime.store.saveAnswer(project.slug, plan.slug, "q1", { answer: { choice: "a" } }, 1)
    await runtime.store.saveAnswer(project.slug, plan.slug, "q2", { answer: { choice: "b" } }, 1)
    const submitted = await runtime.store.submit(project.slug, plan.slug, "Scope", 1)
    assert.equal(submitted.ok, true)

    fake.state.sessions.set("s1", { id: "s1", location: { directory: prepared.directory } })
    const started = await runtime.ensureListening()
    const viewer = await fetch(
      `${started.url}/api/projects/${project.slug}/plans/${plan.slug}/events`,
    )
    const events = sseReader(viewer)
    await events.next()

    await fake.call("codeops_discovery_publish", payload())
    assert.equal(fake.state.promptCalls.length, 1)
    assert.equal(
      fake.state.promptCalls[0].text,
      "Discovery: 2 answers submitted for my-repo › Billing plan (Scope). Read them with codeops_discovery_answers.",
    )
    assert.equal(fake.state.promptCalls[0].delivery, "queue")
    const current = await runtime.store.getPlan(project.slug, plan.slug)
    assert.ok(current.submissions[0].deliveredAt)
    const changed = await events.next()
    assert.equal(changed.event, "changed")
    const delivered = await events.next()
    assert.equal(delivered.event, "delivered")
    assert.equal(JSON.parse(delivered.data).submissionId, 1)

    await fake.call("codeops_discovery_publish", payload())
    assert.equal(fake.state.promptCalls.length, 1)

    const dead = await seedPlan(runtime, prepared.directory, {
      artifact: "plans/dead",
      kind: "plan",
      title: "Dead plan",
      groups: [{ key: "Scope", title: "Scope" }],
      questions: [single("d1", "Scope")],
    })
    await runtime.store.saveAnswer(dead.project.slug, dead.plan.slug, "d1", { answer: { choice: "a" } }, 1)
    await runtime.store.submit(dead.project.slug, dead.plan.slug, "Scope", 1)
    const file = join(
      prepared.dataDir,
      "projects",
      dead.project.slug,
      "plans",
      `${dead.plan.slug}.json`,
    )
    const stored = JSON.parse(readFileSync(file, "utf8"))
    stored.submissions[0].claimedBy = { pid: 2147483646, at: new Date().toISOString() }
    writeFileSync(file, JSON.stringify(stored))

    await fake.call("codeops_discovery_publish", {
      artifact: "plans/dead",
      kind: "plan",
      title: "Dead plan",
      groups: [{ key: "Scope", title: "Scope" }],
      questions: [single("d1", "Scope")],
    })
    assert.equal(fake.state.promptCalls.length, 2)
    await events.close()
  })

  it("should wake on a real page submission through the registered deliver callback", async (t) => {
    const prepared = prepare(t)
    const { controller, fake, runtime } = prepared
    await controller.sync()
    await registerDiscoveryTools(fake.ctx, controller)
    fake.state.sessions.set("s1", { id: "s1", location: { directory: prepared.directory } })
    const { project, plan } = await seedPlan(runtime, prepared.directory)
    await runtime.store.saveAnswer(project.slug, plan.slug, "q1", { answer: { choice: "a" } }, 1)
    await runtime.store.saveAnswer(project.slug, plan.slug, "q2", { answer: { choice: "b" } }, 1)

    const started = await runtime.ensureListening()
    const response = await fetch(
      `${started.url}/api/projects/${project.slug}/plans/${plan.slug}/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group: "Scope", baseRevision: 1 }),
      },
    )
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.delivery, "woken")
    assert.equal(fake.state.promptCalls.length, 1)
    assert.match(
      fake.state.promptCalls[0].text,
      /^Discovery: 2 answers submitted for my-repo › Billing plan \(Scope\)\./,
    )
    const current = await runtime.store.getPlan(project.slug, plan.slug)
    assert.ok(current.submissions[0].deliveredAt)
  })

  it("should stay pending when the owner is unreachable and retry after a failed prompt", async (t) => {
    const prepared = prepare(t)
    const { controller, fake, runtime } = prepared
    await controller.sync()
    await registerDiscoveryTools(fake.ctx, controller)
    const { project, plan } = await seedPlan(runtime, prepared.directory)
    await runtime.store.saveAnswer(project.slug, plan.slug, "q1", { answer: { choice: "a" } }, 1)
    await runtime.store.saveAnswer(project.slug, plan.slug, "q2", { answer: { choice: "b" } }, 1)
    await runtime.store.submit(project.slug, plan.slug, "Scope", 1)

    await fake.call("codeops_discovery_publish", payload())
    assert.equal(fake.state.promptCalls.length, 0)
    let current = await runtime.store.getPlan(project.slug, plan.slug)
    assert.equal(current.submissions[0].deliveredAt, null)

    fake.state.sessions.set("s1", { id: "s1", location: { directory: prepared.directory } })
    fake.state.promptError = new Error("busy")
    await fake.call("codeops_discovery_publish", payload())
    current = await runtime.store.getPlan(project.slug, plan.slug)
    assert.equal(current.submissions[0].claimedBy, null)
    assert.equal(current.submissions[0].deliveredAt, null)

    fake.state.promptError = null
    await fake.call("codeops_discovery_publish", payload())
    assert.equal(fake.state.promptCalls.length, 2)
    current = await runtime.store.getPlan(project.slug, plan.slug)
    assert.ok(current.submissions[0].deliveredAt)
  })

  it("should prompt at setup for a pending submission", async (t) => {
    const prepared = prepare(t)
    const { controller, fake, runtime } = prepared
    fake.state.sessions.set("s1", { id: "s1", location: { directory: prepared.directory } })

    // Create the project and a pending submission before the controller syncs.
    await runtime.store.registerProject({
      directory: prepared.directory,
      branch: null,
      repository: { id: "proj", canonical: prepared.directory },
    })
    const { project, plan } = await seedPlan(runtime, prepared.directory)
    await runtime.store.saveAnswer(project.slug, plan.slug, "q1", { answer: { choice: "a" } }, 1)
    await runtime.store.saveAnswer(project.slug, plan.slug, "q2", { answer: { choice: "b" } }, 1)
    await runtime.store.submit(project.slug, plan.slug, "Scope", 1)
    await runtime.store.markOrphaned(project.slug, "s1")

    await controller.sync()
    await registerDiscoveryTools(fake.ctx, controller)
    assert.equal(fake.state.promptCalls.length, 1)
  })
})

// ---------------------------------------------------------------------------
// Orphaning and degradation
// ---------------------------------------------------------------------------

describe("orphaning and degradation", () => {
  it("should orphan owned plans when the session is deleted", async (t) => {
    const prepared = prepare(t)
    const { controller, runtime } = prepared
    await controller.sync()
    const { project, plan } = await seedPlan(runtime, prepared.directory)
    await controller.onSessionDeleted("s1")
    const current = await runtime.store.getPlan(project.slug, plan.slug)
    assert.equal(current.orphaned, true)
  })

  it("should degrade without throwing when the host lacks tool or prompt APIs", async (t) => {
    const prepared = prepare(t)
    const { controller, runtime } = prepared
    await controller.sync()
    const noTransform = { location: prepared.fake.ctx.location, session: {} }
    assert.equal(await registerDiscoveryTools(noTransform, controller), false)

    const throwing = {
      location: prepared.fake.ctx.location,
      tool: {
        async transform() {
          throw new Error("no transform")
        },
      },
      session: {},
    }
    assert.equal(await registerDiscoveryTools(throwing, controller), false)

    const pending = await seedPlan(runtime, prepared.directory)
    await runtime.store.saveAnswer(
      pending.project.slug,
      pending.plan.slug,
      "q1",
      { answer: { choice: "a" } },
      1,
    )
    await runtime.store.saveAnswer(
      pending.project.slug,
      pending.plan.slug,
      "q2",
      { answer: { choice: "b" } },
      1,
    )
    await runtime.store.submit(pending.project.slug, pending.plan.slug, "Scope", 1)

    const noPrompt = fakeContext(prepared.directory)
    noPrompt.state.sessions.set("s1", { id: "s1", location: { directory: prepared.directory } })
    const second = createDiscoveryController(noPrompt.ctx, {
      directory: prepared.directory,
      dataDir: prepared.dataDir,
      assetsDir: prepared.assetsDir,
      version: "9.9.9",
    })
    delete noPrompt.ctx.session.prompt
    await second.sync()
    await registerDiscoveryTools(noPrompt.ctx, second)
    const stillPending = await prepared.runtime.store.pendingDeliveries(pending.project.slug)
    assert.equal(stillPending.length, 1)
    await second.dispose()
  })

  it("should return an error result when the store throws inside a handler", async (t) => {
    const prepared = prepare(t)
    const { controller, fake, runtime } = prepared
    await controller.sync()
    await registerDiscoveryTools(fake.ctx, controller)
    runtime.store.publish = async () => {
      throw new Error("disk failure")
    }
    const result = (await fake.call("codeops_discovery_publish", payload())).output
    assert.equal(result.ok, false)
    assert.equal(result.reason, "error")
  })
})
