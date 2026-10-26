/**
 * Implementation tests for the Discovery listener.
 *
 * These cases cover edges the specification tests do not pin: trimmed port
 * input, plan URLs, registration identity, asset re-listing, MIME rejection,
 * multiple viewers, the delivered event, refusal mapping, and idle shutdown
 * with a live registration. They may change with the implementation; the
 * specification tests may not.
 *
 * @module discovery-server.impl.test
 */

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"

import { createDiscoveryRuntime, resolvePort } from "./lib/discovery-server.mjs"
import { createDiscoveryStore } from "./lib/discovery-store.mjs"

/** Throwaway roots created by the tests, removed afterward. */
const created = []

/** Base directory for temporary roots. */
const BASE = process.env.CODEOPS_TMPDIR ?? tmpdir()

after(() => {
  for (const directory of created) rmSync(directory, { recursive: true, force: true })
})

/** Creates a throwaway directory. */
function scratch(prefix) {
  const directory = mkdtempSync(join(BASE, `discovery-server-impl-${prefix}-`))
  created.push(directory)
  return directory
}

/** Builds a store over a fresh data directory. */
function newStore() {
  const root = scratch("data")
  return createDiscoveryStore({ dataDir: join(root, "discovery") })
}

/** Registers a project. */
async function registerProject(store, name = "project") {
  const directory = scratch(name)
  return store.registerProject({
    directory,
    branch: null,
    repository: { id: `repo-${name}`, canonical: directory },
  })
}

/** Builds one choice question. */
function single(key) {
  return {
    key,
    group: "A",
    type: "single",
    title: `${key} title`,
    options: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
  }
}

/** Builds a publish payload. */
function payload() {
  return {
    artifact: "plans/billing",
    kind: "plan",
    title: "Billing",
    groups: [{ key: "A", title: "A" }],
    questions: [single("q1")],
  }
}

/** Publishes and returns the record. */
async function published(store, project) {
  const result = await store.publish(project.slug, payload(), "s1")
  assert.equal(result.ok, true)
  return result.plan
}

/** Writes a minimal built asset directory. */
function writeDist(directory) {
  mkdirSync(join(directory, "assets"), { recursive: true })
  writeFileSync(
    join(directory, "index.html"),
    '<html><head><meta name="csp-nonce" content="__CSP_NONCE__"></head><body>app</body></html>',
  )
  writeFileSync(join(directory, "assets", "app.js"), "console.log('app')")
  writeFileSync(join(directory, "assets", "notes.txt"), "extra")
}

/** Creates a runtime with cleanup. */
function makeRuntime(t, store, options = {}) {
  const runtime = createDiscoveryRuntime({
    store,
    assetsDir: options.assetsDir ?? scratch("assets"),
    version: "9.9.9",
    port: 0,
    log: options.log,
  })
  t.after(async () => {
    for (const unregister of runtime.__unregisters ?? []) unregister()
    await runtime.closeIfIdle()
  })
  runtime.__unregisters = []
  return runtime
}

/** Registers a project and tracks the unregister for cleanup. */
function useProject(runtime, directory, slug, deliver = async () => "pending") {
  const unregister = runtime.registerProject(directory, slug, deliver)
  runtime.__unregisters.push(unregister)
  return unregister
}

/** Starts the listener. */
async function listen(runtime) {
  const started = await runtime.ensureListening()
  assert.ok(started)
  const url = new URL(started.url)
  return { origin: url.origin, port: Number(url.port) }
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

/** Sends a JSON request with fetch. */
async function jsonFetch(origin, method, path, body) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, body: await response.json().catch(() => null) }
}

/** Waits for a predicate. */
async function waitFor(predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return true
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return predicate()
}

describe("port parsing", () => {
  it("should trim surrounding space and stay strict about integers", () => {
    assert.equal(resolvePort({ CODEOPS_DISCOVERY_PORT: " 5000 " }), 5000)
    assert.equal(resolvePort({ CODEOPS_DISCOVERY_PORT: "5000abc" }), 4747)
    assert.equal(resolvePort({ CODEOPS_DISCOVERY_PORT: "0" }), 4747)
  })
})

describe("plan urls", () => {
  it("should be null before listening and absolute afterwards", async (t) => {
    const store = newStore()
    const runtime = makeRuntime(t, store)
    assert.equal(runtime.planUrl("p", "plan"), null)
    const { port } = await listen(runtime)
    assert.equal(runtime.planUrl("p", "plan"), `http://127.0.0.1:${port}/#/p/p/plan`)
  })
})

describe("registration identity", () => {
  it("should ignore a stale unregister after a newer registration", async (t) => {
    const store = newStore()
    const project = await registerProject(store)
    await published(store, project)
    const runtime = makeRuntime(t, store)
    const { port } = await listen(runtime)

    const stale = runtime.registerProject(project.directory, project.slug, async () => "pending")
    useProject(runtime, project.directory, project.slug)
    stale()

    const response = await fetch(`http://127.0.0.1:${port}/api/projects`)
    const body = await response.json()
    assert.equal(body.repositories[0].projects[0].live, true)
  })
})

describe("registration and shutdown edges", () => {
  it("should match a symlinked registration to the stored realpath", async (t) => {
    const store = newStore()
    const real = scratch("real")
    const link = join(scratch("linkroot"), "linked")
    symlinkSync(real, link)
    const project = await store.registerProject({
      directory: link,
      branch: null,
      repository: { id: "r", canonical: real },
    })
    await published(store, project)
    const runtime = makeRuntime(t, store)
    useProject(runtime, link, project.slug)
    const { port } = await listen(runtime)

    const body = await (await fetch(`http://127.0.0.1:${port}/api/projects`)).json()
    assert.equal(body.repositories[0].projects[0].live, true)
  })

  it("should reject an invalid route slug before the write checks", async (t) => {
    const store = newStore()
    const runtime = makeRuntime(t, store)
    const { port } = await listen(runtime)

    const response = await fetch(
      `http://127.0.0.1:${port}/api/projects/BAD%20SLUG/plans/x/questions/q1`,
      {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: "{}",
      },
    )
    assert.equal(response.status, 404)
  })

  it("should close a listener that starts after closeIfIdle is called", async (t) => {
    const store = newStore()
    const runtime = makeRuntime(t, store)
    const pending = runtime.ensureListening()
    const closing = runtime.closeIfIdle()
    const started = await pending
    await closing
    assert.ok(started)
    await assert.rejects(fetch(`${started.url}/api/health`))
  })

  it("should end an open event stream on idle shutdown", async (t) => {
    const store = newStore()
    const project = await registerProject(store)
    const record = await published(store, project)
    const runtime = makeRuntime(t, store)
    const { origin } = await listen(runtime)

    const response = await fetch(
      `${origin}/api/projects/${project.slug}/plans/${record.slug}/events`,
    )
    const events = sseReader(response)
    await events.next()
    await runtime.closeIfIdle()
    await assert.rejects(events.next())
    await assert.rejects(fetch(`${origin}/api/health`))
  })
})

describe("assets", () => {
  it("should serve the app after a build appears without a restart", async (t) => {
    const store = newStore()
    const directory = scratch("late-dist")
    const runtime = makeRuntime(t, store, { assetsDir: directory })
    const { port } = await listen(runtime)

    const before = await fetch(`http://127.0.0.1:${port}/`).then((response) => response.text())
    assert.ok(before.includes("npm run build:discovery"))

    writeDist(directory)
    const after = await fetch(`http://127.0.0.1:${port}/`)
    const html = await after.text()
    assert.equal(after.status, 200)
    assert.ok(html.includes("app"))
    assert.equal((await fetch(`http://127.0.0.1:${port}/assets/app.js`)).status, 200)
  })

  it("should refuse an asset type outside the MIME map", async (t) => {
    const store = newStore()
    const directory = scratch("mime")
    writeDist(directory)
    const runtime = makeRuntime(t, store, { assetsDir: directory })
    const { port } = await listen(runtime)
    assert.equal((await fetch(`http://127.0.0.1:${port}/assets/notes.txt`)).status, 404)
  })
})

describe("viewers", () => {
  it("should count several streams until each closes", async (t) => {
    const store = newStore()
    const project = await registerProject(store)
    const record = await published(store, project)
    const runtime = makeRuntime(t, store)
    useProject(runtime, project.directory, project.slug)
    const { origin } = await listen(runtime)

    const first = await fetch(`${origin}/api/projects/${project.slug}/plans/${record.slug}/events`)
    const second = await fetch(`${origin}/api/projects/${project.slug}/plans/${record.slug}/events`)
    t.after(() => {
      first.body?.cancel().catch(() => {})
      second.body?.cancel().catch(() => {})
    })
    const firstReader = first.body.getReader()
    const secondReader = second.body.getReader()
    assert.equal(await waitFor(() => runtime.hasViewer(project.slug, record.slug)), true)

    await firstReader.cancel()
    assert.equal(await waitFor(() => runtime.hasViewer(project.slug, record.slug) === true), true)
    await secondReader.cancel()
    assert.equal(await waitFor(() => runtime.hasViewer(project.slug, record.slug) === false), true)
    assert.equal(runtime.hasViewer("nope", "nope"), false)
  })
})

describe("delivery events", () => {
  it("should emit delivered after a woken submit", async (t) => {
    const store = newStore()
    const project = await registerProject(store)
    const record = await published(store, project)
    await store.saveAnswer(project.slug, record.slug, "q1", { answer: { choice: "a" } }, 1)
    const runtime = makeRuntime(t, store)
    useProject(runtime, project.directory, project.slug, async () => "woken")
    const { origin } = await listen(runtime)

    const response = await fetch(
      `${origin}/api/projects/${project.slug}/plans/${record.slug}/events`,
    )
    const events = sseReader(response)
    await events.next()
    const submitted = await jsonFetch(
      origin,
      "POST",
      `/api/projects/${project.slug}/plans/${record.slug}/submit`,
      { group: "A", baseRevision: 1 },
    )
    assert.equal(submitted.status, 200)
    assert.equal(submitted.body.delivery, "woken")

    const changed = await events.next()
    assert.equal(changed.event, "changed")
    const delivered = await events.next()
    assert.equal(delivered.event, "delivered")
    assert.equal(JSON.parse(delivered.data).submissionId, 1)
    await events.close()
  })
})

describe("refusals", () => {
  it("should map a newer plan file to 409", async (t) => {
    const store = newStore()
    const project = await registerProject(store)
    const record = await published(store, project)
    const dataDir = join(scratch("refusal"), "discovery")
    const secondStore = createDiscoveryStore({ dataDir })
    const secondProject = await secondStore.registerProject({
      directory: project.directory,
      branch: null,
      repository: { id: "r", canonical: project.directory },
    })
    const secondRecord = await secondStore.publish(secondProject.slug, payload(), "s1")
    writeFileSync(
      join(dataDir, "projects", secondProject.slug, "plans", `${secondRecord.plan.slug}.json`),
      JSON.stringify({ schemaVersion: 2 }),
      { mode: 0o600 },
    )
    const runtime = makeRuntime(t, secondStore)
    const { origin } = await listen(runtime)

    const response = await fetch(
      `${origin}/api/projects/${secondProject.slug}/plans/${secondRecord.plan.slug}`,
    )
    assert.equal(response.status, 409)
    assert.equal((await response.json()).error, "newer-version")
    assert.ok(record.slug)
  })
})

describe("idle shutdown", () => {
  it("should stay open while a project is registered", async (t) => {
    const store = newStore()
    const runtime = makeRuntime(t, store)
    const { port } = await listen(runtime)
    useProject(runtime, scratch("stay"), "stay")
    await runtime.closeIfIdle()
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status, 200)
  })
})
