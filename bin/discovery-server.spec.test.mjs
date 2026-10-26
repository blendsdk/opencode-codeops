/**
 * Specification tests for the Discovery listener and HTTP API.
 *
 * These cases pin the observable behaviour of the shared runtime: port
 * resolution and fallback, the request pipeline, static assets and CSP, the
 * JSON endpoints, live events, and listener shutdown. They are written from
 * the contract documents only, so a failure here means the implementation
 * does not satisfy the specification — never that the test is wrong.
 *
 * Every case uses a throwaway data directory and asset directory under the
 * session temp root and removes them afterward.
 *
 * @module discovery-server.spec.test
 */

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { request as httpRequest } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"

import {
  createDiscoveryRuntime,
  getDiscoveryRuntime,
  resolvePort,
} from "./lib/discovery-server.mjs"
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
  const directory = mkdtempSync(join(BASE, `discovery-server-${prefix}-`))
  created.push(directory)
  return directory
}

/** Creates a store over a fresh data directory. */
function newStore() {
  const root = scratch("data")
  return createDiscoveryStore({ dataDir: join(root, "discovery") })
}

/** Registers a fresh project. */
async function registerProject(store, name = "project") {
  const directory = scratch(name)
  return store.registerProject({
    directory,
    branch: null,
    repository: { id: `repo-${name}`, canonical: directory },
  })
}

/** Builds a choice question. */
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
function payload(questions, extra = {}) {
  return {
    artifact: "plans/billing",
    kind: "plan",
    title: "Billing plan",
    groups: [{ key: "A", title: "A" }],
    questions,
    ...extra,
  }
}

/** Publishes and asserts success. */
async function published(store, project, input = payload([single("q1")])) {
  const result = await store.publish(project.slug, input, "s1")
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result))
  return result.plan
}

/** Builds a dist directory with an index page and three assets. */
function assetsDir({ built = true } = {}) {
  const root = scratch("assets")
  if (built) {
    mkdirSync(join(root, "assets"), { recursive: true })
    writeFileSync(
      join(root, "index.html"),
      '<!doctype html><html><head><meta name="csp-nonce" content="__CSP_NONCE__">' +
        '<script nonce="__CSP_NONCE__" src="/assets/app.js"></script></head><body>app</body></html>',
    )
    writeFileSync(join(root, "assets", "app.js"), "console.log('app')")
    writeFileSync(join(root, "assets", "app.css"), "body{}")
    writeFileSync(join(root, "assets", "icon.svg"), "<svg></svg>")
  }
  return root
}

/** Creates a runtime and registers its cleanup on the test. */
function makeRuntime(t, store, options = {}) {
  const runtime = createDiscoveryRuntime({
    store,
    assetsDir: options.assetsDir ?? assetsDir(),
    version: options.version ?? "9.9.9",
    port: options.port,
    log: options.log,
  })
  const unregisters = []
  t.after(async () => {
    for (const unregister of unregisters) unregister()
    await runtime.closeIfIdle()
  })
  return {
    runtime,
    register(directory, slug, deliver) {
      const unregister = runtime.registerProject(directory, slug, deliver)
      unregisters.push(unregister)
      return unregister
    },
  }
}

/** Starts the runtime and returns its origin and port. */
async function listen(runtime) {
  const result = await runtime.ensureListening()
  assert.ok(result, "the listener must start")
  const url = new URL(result.url)
  return { result, origin: url.origin, port: Number(url.port) }
}

/** Sends one HTTP request and returns status, headers, and text. */
function request(port, { method = "GET", path = "/", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: "127.0.0.1", port, method, path, headers },
      (response) => {
        const chunks = []
        response.on("data", (chunk) => chunks.push(chunk))
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            text: Buffer.concat(chunks).toString("utf8"),
          }),
        )
      },
    )
    req.on("error", reject)
    if (body !== undefined) req.write(body)
    req.end()
  })
}

/** Sends a JSON request. */
function jsonRequest(port, method, path, { body, origin, contentType = "application/json", headers = {} } = {}) {
  const merged = { ...headers }
  if (contentType !== null) merged["Content-Type"] = contentType
  if (origin) merged.Origin = origin
  return request(port, {
    method,
    path,
    headers: merged,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/** Reads `count` server-sent events from a fetch response. */
function sseReader(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  const pending = []
  return {
    async next(timeoutMs = 4000) {
      const deadline = Date.now() + timeoutMs
      while (pending.length === 0) {
        const remaining = deadline - Date.now()
        if (remaining <= 0) throw new Error("timed out waiting for an event")
        let timer
        const chunk = await Promise.race([
          reader.read(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("timed out waiting for an event")), remaining)
          }),
        ]).finally(() => clearTimeout(timer))
        if (chunk.done) throw new Error("event stream ended")
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
        // The stream may already be closed.
      }
    },
  }
}

/** Waits until a predicate holds or the deadline passes. */
async function waitFor(predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return true
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return predicate()
}

// ---------------------------------------------------------------------------
// Runtime and port
// ---------------------------------------------------------------------------

describe("port resolution", () => {
  it("should accept a valid environment port and fall back to 4747", () => {
    assert.equal(resolvePort({}), 4747)
    assert.equal(resolvePort({ CODEOPS_DISCOVERY_PORT: "5000" }), 5000)
    assert.equal(resolvePort({ CODEOPS_DISCOVERY_PORT: "abc" }), 4747)
    assert.equal(resolvePort({ CODEOPS_DISCOVERY_PORT: "70000" }), 4747)
  })
})

describe("listener", () => {
  it("should bind port 0 and fall back when the requested port is taken", async (t) => {
    const store = newStore()
    const first = makeRuntime(t, store, { port: 0 })
    const started = await listen(first.runtime)
    assert.equal(started.result.fallback, false)

    const second = makeRuntime(t, store, { port: started.port })
    const fallback = await second.runtime.ensureListening()
    assert.ok(fallback)
    assert.equal(fallback.fallback, true)
    assert.notEqual(Number(new URL(fallback.url).port), started.port)
  })

  it("should listen on 127.0.0.1 only", async (t) => {
    const store = newStore()
    const { runtime } = makeRuntime(t, store, { port: 0 })
    const { origin } = await listen(runtime)
    assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/)
  })
})

// ---------------------------------------------------------------------------
// Request pipeline
// ---------------------------------------------------------------------------

describe("request pipeline", () => {
  it("should reject a foreign Host header and accept localhost", async (t) => {
    const store = newStore()
    const { runtime } = makeRuntime(t, store, { port: 0 })
    const { port } = await listen(runtime)

    const foreign = await request(port, {
      path: "/api/health",
      headers: { Host: `evil.example:${port}` },
    })
    assert.equal(foreign.status, 421)
    assert.equal(JSON.parse(foreign.text).error, "forbidden-host")

    const local = await request(port, {
      path: "/api/health",
      headers: { Host: `localhost:${port}` },
    })
    assert.equal(local.status, 200)
    const health = JSON.parse(local.text)
    assert.equal(health.name, "codeops-discovery")
    assert.equal(health.version, "9.9.9")
    assert.ok(health.instanceId)
  })

  it("should reject a wrong content type and a foreign origin", async (t) => {
    const store = newStore()
    const project = await registerProject(store)
    const record = await published(store, project)
    const { runtime } = makeRuntime(t, store, { port: 0 })
    const { port, origin } = await listen(runtime)
    const path = `/api/projects/${project.slug}/plans/${record.slug}/questions/q1`
    const body = { baseRevision: 1, patch: { answer: { choice: "a" } } }

    const media = await jsonRequest(port, "PUT", path, { body, contentType: "text/plain" })
    assert.equal(media.status, 415)
    assert.equal(JSON.parse(media.text).error, "unsupported-media-type")

    const foreign = await jsonRequest(port, "PUT", path, {
      body,
      origin: "http://evil.example",
    })
    assert.equal(foreign.status, 403)
    assert.equal(JSON.parse(foreign.text).error, "forbidden-origin")

    const own = await jsonRequest(port, "PUT", path, { body, origin })
    assert.equal(own.status, 200)

    const none = await jsonRequest(port, "PUT", path, { body })
    assert.equal(none.status, 200)
    assert.equal(none.headers["access-control-allow-origin"], undefined)
    assert.equal(own.headers["access-control-allow-origin"], undefined)
  })

  it("should cap the body and contain an unexpected exception", async (t) => {
    const store = newStore()
    const { runtime } = makeRuntime(t, store, { port: 0 })
    const { port } = await listen(runtime)

    const tooLarge = await request(port, {
      method: "POST",
      path: `/api/projects/x/plans/y/submit`,
      headers: { "Content-Type": "application/json" },
      body: "x".repeat(256 * 1024 + 1),
    })
    assert.equal(tooLarge.status, 413)

    const malformed = await request(port, {
      method: "POST",
      path: `/api/projects/x/plans/y/submit`,
      headers: { "Content-Type": "application/json" },
      body: "{bad",
    })
    assert.equal(malformed.status, 400)

    const logged = []
    const brokenStore = {
      async listProjects() {
        throw new Error("/secret/path must not leak")
      },
    }
    const broken = makeRuntime(t, brokenStore, { port: 0, log: (line) => logged.push(line) })
    const started = await listen(broken.runtime)
    const response = await request(started.port, { path: "/api/projects" })
    assert.equal(response.status, 500)
    assert.equal(JSON.parse(response.text).error, "internal")
    assert.ok(!response.text.includes("/secret/path"))
    assert.equal(logged.length, 1)
    assert.ok(!logged[0].includes("/secret/path"))
  })
})

// ---------------------------------------------------------------------------
// Static assets and CSP
// ---------------------------------------------------------------------------

describe("static assets", () => {
  it("should serve index.html with a fresh nonce on every request", async (t) => {
    const store = newStore()
    const { runtime } = makeRuntime(t, store, { port: 0 })
    const { port } = await listen(runtime)

    const first = await request(port, { path: "/" })
    const second = await request(port, { path: "/" })
    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
    assert.equal(first.headers["x-content-type-options"], "nosniff")
    assert.equal(first.headers["referrer-policy"], "no-referrer")
    assert.equal(second.headers["x-content-type-options"], "nosniff")

    const health = await request(port, { path: "/api/health" })
    assert.equal(health.headers["cache-control"], "no-store")
    assert.equal(health.headers["x-content-type-options"], "nosniff")
    assert.equal(health.headers["referrer-policy"], "no-referrer")
    const missing = await request(port, { path: "/api/nope" })
    assert.equal(missing.status, 404)
    assert.equal(missing.headers["cache-control"], "no-store")
    assert.equal(missing.headers["x-content-type-options"], "nosniff")
    assert.equal(missing.headers["referrer-policy"], "no-referrer")

    const nonceOf = (response) => /nonce-([^']+)'/.exec(response.headers["content-security-policy"])?.[1]
    const firstNonce = nonceOf(first)
    const secondNonce = nonceOf(second)
    assert.ok(firstNonce)
    assert.ok(secondNonce)
    assert.notEqual(firstNonce, secondNonce)
    assert.ok(first.text.includes(`content="${firstNonce}"`))
    assert.ok(second.text.includes(`content="${secondNonce}"`))
    assert.equal(
      first.headers["content-security-policy"],
      `default-src 'none'; script-src 'self'; style-src 'self' 'nonce-${firstNonce}'; ` +
        `connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    )
  })

  it("should serve only known assets with the right MIME types", async (t) => {
    const store = newStore()
    const { runtime } = makeRuntime(t, store, { port: 0 })
    const { port } = await listen(runtime)

    const script = await request(port, { path: "/assets/app.js" })
    assert.equal(script.status, 200)
    assert.match(script.headers["content-type"], /^text\/javascript/)
    assert.equal(script.headers["x-content-type-options"], "nosniff")
    assert.equal(script.headers["referrer-policy"], "no-referrer")

    assert.equal((await request(port, { path: "/assets/app.css" })).status, 200)
    assert.equal((await request(port, { path: "/assets/icon.svg" })).status, 200)
    assert.equal((await request(port, { path: "/assets/unknown.js" })).status, 404)
    assert.equal(
      (await request(port, { path: "/assets/%2e%2e%2fpackage.json" })).status,
      404,
    )
  })

  it("should serve a not-built page when dist is missing", async (t) => {
    const store = newStore()
    const missing = join(scratch("nodist"), "dist")
    const { runtime } = makeRuntime(t, store, { port: 0, assetsDir: missing })
    const { port } = await listen(runtime)

    const page = await request(port, { path: "/" })
    assert.equal(page.status, 200)
    assert.ok(page.text.includes("npm run build:discovery"))
    assert.ok(!page.text.includes("<script"))
  })
})

// ---------------------------------------------------------------------------
// Read endpoints
// ---------------------------------------------------------------------------

describe("read endpoints", () => {
  it("should group projects by repository and report live state", async (t) => {
    const store = newStore()
    const project = await registerProject(store)
    const record = await published(store, project)
    const { runtime, register } = makeRuntime(t, store, { port: 0 })
    const { port } = await listen(runtime)

    let list = await request(port, { path: "/api/projects" })
    assert.equal(list.status, 200)
    let body = JSON.parse(list.text)
    assert.equal(body.repositories.length, 1)
    assert.equal(body.repositories[0].canonical, project.repository.canonical)
    assert.equal(body.repositories[0].projects[0].slug, project.slug)
    assert.equal(body.repositories[0].projects[0].live, false)
    assert.equal(body.repositories[0].projects[0].counts.plans, 1)

    register(project.directory, project.slug, async () => "pending")
    list = await request(port, { path: "/api/projects" })
    body = JSON.parse(list.text)
    assert.equal(body.repositories[0].projects[0].live, true)

    const one = await request(port, { path: `/api/projects/${project.slug}` })
    assert.equal(one.status, 200)
    const summary = JSON.parse(one.text)
    assert.equal(summary.project.slug, project.slug)
    assert.equal(summary.plans[0].slug, record.slug)

    const plan = await request(port, {
      path: `/api/projects/${project.slug}/plans/${record.slug}`,
    })
    assert.equal(plan.status, 200)
    assert.equal(JSON.parse(plan.text).plan.slug, record.slug)

    assert.equal((await request(port, { path: "/api/projects/nope" })).status, 404)
    assert.equal(
      (await request(port, { path: `/api/projects/${project.slug}/plans/nope` })).status,
      404,
    )
    assert.equal(
      (await request(port, { path: "/api/projects/..%2F..%2Fpackage/plans/x" })).status,
      404,
    )
  })
})

// ---------------------------------------------------------------------------
// Write endpoints
// ---------------------------------------------------------------------------

describe("write endpoints", () => {
  it("should save, submit, deliver, archive, and delete", async (t) => {
    const store = newStore()
    const project = await registerProject(store)
    const record = await published(
      store,
      project,
      payload([single("q1", "A"), single("q2", "B"), single("q3", "C"), single("q4", "D")], {
        groups: [
          { key: "A", title: "A" },
          { key: "B", title: "B" },
          { key: "C", title: "C" },
          { key: "D", title: "D" },
        ],
      }),
    )
    const { runtime, register } = makeRuntime(t, store, { port: 0 })
    register(project.directory, project.slug, async () => "woken")
    const { port, origin } = await listen(runtime)
    const base = `/api/projects/${project.slug}/plans/${record.slug}`

    const saved = await jsonRequest(port, "PUT", `${base}/questions/q1`, {
      body: { baseRevision: 1, patch: { answer: { choice: "a" } } },
    })
    assert.equal(saved.status, 200)

    const staleSave = await jsonRequest(port, "PUT", `${base}/questions/q2`, {
      body: { baseRevision: 0, patch: { answer: { choice: "a" } } },
    })
    assert.equal(staleSave.status, 409)
    assert.equal(JSON.parse(staleSave.text).error, "stale")

    for (const [key, group] of [
      ["q2", "B"],
      ["q3", "C"],
    ]) {
      const response = await jsonRequest(port, "PUT", `${base}/questions/${key}`, {
        body: { baseRevision: 1, patch: { answer: { choice: "a" } } },
      })
      assert.equal(response.status, 200)
    }

    const submitted = await jsonRequest(port, "POST", `${base}/submit`, {
      body: { group: "A", baseRevision: 1 },
    })
    assert.equal(submitted.status, 200)
    const submission = JSON.parse(submitted.text)
    assert.equal(submission.delivery, "woken")
    assert.equal(submission.submission.id, 1)

    const staleSubmit = await jsonRequest(port, "POST", `${base}/submit`, {
      body: { group: "C", baseRevision: 0 },
    })
    assert.equal(staleSubmit.status, 409)
    assert.equal(JSON.parse(staleSubmit.text).error, "stale")

    const submitAll = await jsonRequest(port, "POST", `${base}/submit`, {
      body: { group: null, baseRevision: 1 },
    })
    assert.equal(submitAll.status, 200)
    assert.deepEqual(JSON.parse(submitAll.text).submission.groups, ["B", "C"])

    const notReady = await jsonRequest(port, "POST", `${base}/submit`, {
      body: { group: "D", baseRevision: 1 },
    })
    assert.equal(notReady.status, 409)
    assert.equal(JSON.parse(notReady.text).error, "not-ready")
    assert.ok(JSON.parse(notReady.text).missing.length > 0)

    const archived = await jsonRequest(port, "POST", `${base}/archive`, {
      body: { archived: true },
    })
    assert.equal(archived.status, 200)
    assert.equal(JSON.parse(archived.text).archived, true)

    const noConfirm = await fetch(`${origin}${base}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
    assert.equal(noConfirm.status, 400)
    const deleted = await fetch(`${origin}${base}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    })
    assert.equal(deleted.status, 200)
    assert.equal((await deleted.json()).deleted, true)
    assert.equal((await request(port, { path: base })).status, 404)
  })

  it("should leave a submission pending when no project is registered", async (t) => {
    const store = newStore()
    const project = await registerProject(store)
    const record = await published(store, project)
    await store.saveAnswer(project.slug, record.slug, "q1", { answer: { choice: "a" } }, 1)
    const { runtime } = makeRuntime(t, store, { port: 0 })
    const { port } = await listen(runtime)

    const submitted = await jsonRequest(
      port,
      "POST",
      `/api/projects/${project.slug}/plans/${record.slug}/submit`,
      { body: { group: "A", baseRevision: 1 } },
    )
    assert.equal(submitted.status, 200)
    assert.equal(JSON.parse(submitted.text).delivery, "pending")
  })
})

// ---------------------------------------------------------------------------
// Live events
// ---------------------------------------------------------------------------

describe("live events", () => {
  it("should stream hello and changed and count the viewer while open", async (t) => {
    const store = newStore()
    const project = await registerProject(store)
    const record = await published(store, project)
    const { runtime, register } = makeRuntime(t, store, { port: 0 })
    register(project.directory, project.slug, async () => "pending")
    const { origin, port } = await listen(runtime)

    const controller = new AbortController()
    const response = await fetch(
      `${origin}/api/projects/${project.slug}/plans/${record.slug}/events`,
      { signal: controller.signal, headers: { Accept: "text/event-stream" } },
    )
    t.after(() => controller.abort())
    assert.equal(response.status, 200)
    assert.match(response.headers.get("content-type"), /^text\/event-stream/)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.equal(response.headers.get("x-content-type-options"), "nosniff")
    assert.equal(response.headers.get("referrer-policy"), "no-referrer")
    const events = sseReader(response)

    const helloEvent = await events.next()
    assert.equal(helloEvent.event, "hello")
    const hello = JSON.parse(helloEvent.data)
    assert.ok(hello.instanceId)
    assert.equal(hello.revision, 1)
    assert.equal(runtime.hasViewer(project.slug, record.slug), true)

    await jsonRequest(port, "PUT", `/api/projects/${project.slug}/plans/${record.slug}/questions/q1`, {
      body: { baseRevision: 1, patch: { answer: { choice: "a" } } },
    })
    const changed = await events.next()
    assert.equal(changed.event, "changed")
    assert.equal(JSON.parse(changed.data).revision, 1)

    await events.close()
    controller.abort()
    assert.equal(await waitFor(() => runtime.hasViewer(project.slug, record.slug) === false), true)
  })
})

// ---------------------------------------------------------------------------
// Runtime identity and shutdown
// ---------------------------------------------------------------------------

describe("runtime identity", () => {
  it("should return the same process-wide runtime and share one listener", async (t) => {
    const key = Symbol.for("opencode-codeops.discovery")
    const previous = globalThis[key]
    delete globalThis[key]
    t.after(() => {
      if (previous === undefined) delete globalThis[key]
      else globalThis[key] = previous
    })

    const store = newStore()
    const options = { store, assetsDir: assetsDir(), version: "9.9.9", port: 0 }
    const first = getDiscoveryRuntime(options)
    const second = getDiscoveryRuntime(options)
    assert.equal(first, second)

    const [a, b] = await Promise.all([first.ensureListening(), first.ensureListening()])
    assert.ok(a)
    assert.equal(a.url, b.url)
    assert.equal(a.fallback, false)
    assert.equal(b.fallback, false)
    t.after(async () => {
      await first.closeIfIdle()
    })
  })

  it("should keep listening until the last project unregisters", async (t) => {
    const store = newStore()
    const { runtime } = makeRuntime(t, store, { port: 0 })
    const { port } = await listen(runtime)
    const removeOne = runtime.registerProject(scratch("p1"), "p1", async () => "pending")
    const removeTwo = runtime.registerProject(scratch("p2"), "p2", async () => "pending")

    assert.equal((await request(port, { path: "/api/health" })).status, 200)
    removeOne()
    assert.equal((await request(port, { path: "/api/health" })).status, 200)
    removeTwo()
    await runtime.closeIfIdle()
    await assert.rejects(request(port, { path: "/api/health" }))
  })
})
