/**
 * Discovery listener and HTTP API.
 *
 * One `node:http` listener per OpenCode process is shared by every opted-in
 * project. It serves the browser app, the JSON API, live events, and the
 * delivery hook. The runtime lives in a `globalThis` slot so every plugin
 * instance in the process reaches the same listener.
 *
 * Security is enforced before routing: only a loopback `Host` is accepted,
 * writes must be JSON and same-origin, route slugs are validated before any
 * store call, bodies are capped, and every response carries `nosniff`,
 * `no-referrer`, and a nonce-based CSP. Error bodies never contain paths,
 * stack traces, or stored content.
 *
 * @module discovery-server
 */

import { randomBytes, randomUUID } from "node:crypto"
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, resolve, sep } from "node:path"

import { KEY_PATTERN, SLUG_PATTERN } from "./discovery-rules.mjs"
import { DiscoveryDataError } from "./discovery-store.mjs"

/** The process-wide runtime slot. */
const RUNTIME_KEY = Symbol.for("opencode-codeops.discovery")

/** Request body cap in bytes. */
const BODY_LIMIT = 256 * 1024

/** The default port when the environment names none. */
const DEFAULT_PORT = 4747

/** The service name reported by the health endpoint. */
const SERVICE_NAME = "codeops-discovery"

/** MIME types served from the asset directory. */
const MIME_TYPES = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
}

/** The static page shown when the UI bundle has not been built yet. */
const NOT_BUILT_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Discovery</title></head>
<body><h1>Discovery UI is not built</h1>
<p>Run <code>npm run build:discovery</code> in the CodeOps checkout.</p></body></html>`

/**
 * Resolve the listener port from the environment.
 *
 * `CODEOPS_DISCOVERY_PORT` must be a plain integer in 1–65535; anything else
 * falls back to 4747.
 *
 * @param {Record<string, string | undefined>} [env] - Environment variables.
 * @returns {number} The configured port, or 4747.
 */
export function resolvePort(env = process.env) {
  const raw = String(env?.CODEOPS_DISCOVERY_PORT ?? "").trim()
  if (!/^\d+$/.test(raw)) return DEFAULT_PORT
  const port = Number(raw)
  return port >= 1 && port <= 65535 ? port : DEFAULT_PORT
}

/** Canonicalize a checkout directory so registration and lookup agree. */
function canonicalDirectory(directory) {
  const resolved = resolve(String(directory))
  try {
    return realpathSync(resolved)
  } catch {
    return resolved
  }
}

/** A fresh base64 CSP nonce. */
function newNonce() {
  return randomBytes(16).toString("base64")
}

/** The CSP header for one nonce. */
function csp(nonce) {
  return (
    "default-src 'none'; script-src 'self'; " +
    `style-src 'self' 'nonce-${nonce}'; ` +
    "connect-src 'self'; img-src 'self' data:; base-uri 'none'; " +
    "form-action 'none'; frame-ancestors 'none'"
  )
}

/** Base security headers shared by every response. */
function securityHeaders(nonce) {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": csp(nonce),
  }
}

/** Build the runtime object for one process. */
function buildRuntime(options) {
  const store = options.store
  const assetsDir = options.assetsDir
  const version = String(options.version ?? "0.0.0")
  const log = typeof options.log === "function" ? options.log : () => {}
  const requestedPort = options.port === undefined ? resolvePort(process.env) : options.port

  /** Registered projects, keyed by checkout directory. */
  const projects = new Map()
  /** Open event streams, keyed by "<project>/<plan>". */
  const viewers = new Map()
  /** Live sockets, used for a prompt shutdown. */
  const sockets = new Set()

  let server = null
  let listening = null
  let boundPort = 0
  let fallback = false
  let instanceId = null
  let indexTemplate = null
  let assets = new Map()

  /** Send one JSON response with the shared security headers. */
  function sendJson(response, status, payload) {
    if (response.writableEnded) return
    const nonce = newNonce()
    response.writeHead(status, {
      ...securityHeaders(nonce),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    })
    response.end(JSON.stringify(payload))
  }

  /** Send one error envelope. */
  function sendError(response, status, code, message = "") {
    sendJson(response, status, { error: code, message })
  }

  /** Send one HTML response whose CSP nonce matches its body. */
  function sendHtml(response, status, template) {
    if (response.writableEnded) return
    const nonce = newNonce()
    response.writeHead(status, {
      ...securityHeaders(nonce),
      "Content-Type": "text/html; charset=utf-8",
    })
    response.end(template.split("__CSP_NONCE__").join(nonce))
  }

  /** Read the index template and the asset allow-list from disk. */
  function refreshAssets() {
    if (!existsSync(assetsDir)) return false
    const indexPath = join(assetsDir, "index.html")
    if (!existsSync(indexPath)) return false
    try {
      indexTemplate = readFileSync(indexPath, "utf8")
      assets = new Map()
      const directory = join(assetsDir, "assets")
      if (existsSync(directory)) {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          if (!entry.isFile()) continue
          const file = join(directory, entry.name)
          if (!file.startsWith(directory + sep)) continue
          assets.set(entry.name, file)
        }
      }
      return true
    } catch {
      return false
    }
  }

  /** Decode and validate a project or plan slug. */
  function slugParameter(value) {
    try {
      const decoded = decodeURIComponent(value)
      return SLUG_PATTERN.test(decoded) ? decoded : null
    } catch {
      return null
    }
  }

  /** Decode and validate a question key. */
  function keyParameter(value) {
    try {
      const decoded = decodeURIComponent(value)
      return KEY_PATTERN.test(decoded) ? decoded : null
    } catch {
      return null
    }
  }

  /** Read a JSON body within the cap, or send the matching error. */
  async function readBody(request, response) {
    const chunks = []
    let size = 0
    let tooLarge = false
    for await (const chunk of request) {
      size += chunk.length
      if (size > BODY_LIMIT) {
        tooLarge = true
        continue
      }
      chunks.push(chunk)
    }
    if (tooLarge) {
      sendError(response, 413, "too-large")
      return undefined
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"))
    } catch {
      sendError(response, 400, "bad-request")
      return undefined
    }
  }

  /** True when the Host header names this listener. */
  function hostAllowed(host) {
    return host === `127.0.0.1:${boundPort}` || host === `localhost:${boundPort}`
  }

  /** True when the Origin header, when present, is this listener. */
  function originAllowed(origin) {
    if (origin === undefined) return true
    return origin === `http://127.0.0.1:${boundPort}` || origin === `http://localhost:${boundPort}`
  }

  /** Serve the single-page app or the not-built page. */
  function serveIndex(response) {
    if (indexTemplate === null || assets.size === 0) refreshAssets()
    if (indexTemplate === null) {
      sendHtml(response, 200, NOT_BUILT_HTML)
      return
    }
    sendHtml(response, 200, indexTemplate)
  }

  /** Serve one allow-listed asset. */
  function serveAsset(response, name) {
    if (indexTemplate === null) refreshAssets()
    const file = assets.get(name)
    if (!file) {
      sendError(response, 404, "not-found")
      return
    }
    const extension = extname(name)
    const type = MIME_TYPES[extension]
    if (!type) {
      sendError(response, 404, "not-found")
      return
    }
    try {
      const content = readFileSync(file)
      const nonce = newNonce()
      response.writeHead(200, {
        ...securityHeaders(nonce),
        "Content-Type": type,
      })
      response.end(content)
    } catch {
      sendError(response, 404, "not-found")
    }
  }

  /** Summarize a plan's submissions for the read endpoint. */
  function summarize(plan) {
    return {
      ...plan,
      submissions: (plan.submissions ?? []).map((submission) => ({
        id: submission.id,
        at: submission.at,
        groups: submission.groups,
        deliveredAt: submission.deliveredAt,
        deliveredTo: submission.deliveredTo,
      })),
    }
  }

  /** Map a store refusal to an HTTP response. */
  function storeFailure(response, reason, detail) {
    if (reason === "not-found") {
      sendError(response, 404, "not-found")
      return
    }
    if (reason === "invalid") {
      sendError(response, 400, "invalid", detail?.message ?? "")
      return
    }
    sendError(response, 409, reason, detail?.message ?? "")
  }

  /** Broadcast one live event to the streams of a plan. */
  function notify(projectSlug, planSlug, event, data) {
    const streams = viewers.get(`${projectSlug}/${planSlug}`)
    if (!streams) return
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    for (const response of streams) {
      if (response.writableEnded) continue
      try {
        response.write(payload)
      } catch {
        // A broken stream is removed by its own close handler.
      }
    }
  }

  /** The request handler. */
  async function handle(request, response) {
    const host = request.headers.host ?? ""
    if (!hostAllowed(host)) {
      sendError(response, 421, "forbidden-host")
      return
    }
    const method = request.method ?? "GET"
    const path = new URL(request.url ?? "/", `http://${host}`).pathname

    if (method === "GET" && path.startsWith("/assets/")) {
      let name = ""
      try {
        name = decodeURIComponent(path.slice("/assets/".length))
      } catch {
        sendError(response, 404, "not-found")
        return
      }
      if (name.length === 0 || name.includes("/") || name.includes("\\") || name.includes("..")) {
        sendError(response, 404, "not-found")
        return
      }
      serveAsset(response, name)
      return
    }
    if (method === "GET" && path === "/") {
      serveIndex(response)
      return
    }

    // Route parameters are validated before the write checks and before any
    // store call, so a malformed slug can never reach a file path.
    const segments = path.split("/")
    if (segments[1] === "api" && segments[2] === "projects") {
      if (segments[3] !== undefined && slugParameter(segments[3]) === null) {
        sendError(response, 404, "not-found")
        return
      }
      if (segments[5] !== undefined && slugParameter(segments[5]) === null) {
        sendError(response, 404, "not-found")
        return
      }
      if (segments[7] !== undefined && keyParameter(segments[7]) === null) {
        sendError(response, 404, "not-found")
        return
      }
    }

    const isWrite = method === "PUT" || method === "POST" || method === "DELETE"
    let writeBody
    if (isWrite) {
      if (!String(request.headers["content-type"] ?? "").startsWith("application/json")) {
        sendError(response, 415, "unsupported-media-type")
        return
      }
      if (!originAllowed(request.headers.origin)) {
        sendError(response, 403, "forbidden-origin")
        return
      }
      // The body is validated before routing, so an oversized or malformed
      // body never reaches a store call.
      writeBody = await readBody(request, response)
      if (writeBody === undefined) return
    }

    if (method === "GET" && path === "/api/health") {
      sendJson(response, 200, { name: SERVICE_NAME, instanceId, version })
      return
    }
    if (method === "GET" && path === "/api/projects") {
      const summaries = await store.listProjects()
      const repositories = new Map()
      for (const project of summaries) {
        const canonical = project.repository?.canonical ?? project.directory
        if (!repositories.has(canonical)) {
          repositories.set(canonical, {
            name: project.repository?.name ?? canonical,
            canonical,
            projects: [],
          })
        }
        repositories.get(canonical).projects.push({
          slug: project.slug,
          name: project.name,
          branch: project.branch,
          directory: project.directory,
          counts: project.counts,
          live: projects.has(project.directory),
        })
      }
      sendJson(response, 200, { repositories: [...repositories.values()] })
      return
    }

    let match = /^\/api\/projects\/([^/]+)$/.exec(path)
    if (method === "GET" && match) {
      const projectSlug = slugParameter(match[1])
      if (!projectSlug) {
        sendError(response, 404, "not-found")
        return
      }
      const project = await store.getProject(projectSlug)
      if (!project) {
        sendError(response, 404, "not-found")
        return
      }
      const plans = await store.listPlans(projectSlug)
      sendJson(response, 200, { project, plans })
      return
    }

    match = /^\/api\/projects\/([^/]+)\/plans\/([^/]+)\/questions\/([^/]+)$/.exec(path)
    if (method === "PUT" && match) {
      const projectSlug = slugParameter(match[1])
      const planSlug = slugParameter(match[2])
      const key = keyParameter(match[3])
      if (!projectSlug || !planSlug || !key) {
        sendError(response, 404, "not-found")
        return
      }
      const body = writeBody
      if (!body || typeof body.baseRevision !== "number" || typeof body.patch !== "object") {
        sendError(response, 400, "invalid", "expected baseRevision and patch")
        return
      }
      const result = await store.saveAnswer(projectSlug, planSlug, key, body.patch, body.baseRevision)
      if (!result.ok) {
        storeFailure(response, result.reason, result)
        return
      }
      notify(projectSlug, planSlug, "changed", { revision: result.plan.revision })
      sendJson(response, 200, { plan: summarize(result.plan) })
      return
    }

    match = /^\/api\/projects\/([^/]+)\/plans\/([^/]+)\/submit$/.exec(path)
    if (method === "POST" && match) {
      const projectSlug = slugParameter(match[1])
      const planSlug = slugParameter(match[2])
      if (!projectSlug || !planSlug) {
        sendError(response, 404, "not-found")
        return
      }
      const project = await store.getProject(projectSlug)
      if (!project) {
        sendError(response, 404, "not-found")
        return
      }
      const body = writeBody
      const group = body?.group ?? null
      const baseRevision = body?.baseRevision ?? null
      if (group !== null && typeof group !== "string") {
        sendError(response, 400, "invalid", "group must be a key or null")
        return
      }
      if (baseRevision !== null && typeof baseRevision !== "number") {
        sendError(response, 400, "invalid", "baseRevision must be a number or null")
        return
      }
      const result = await store.submit(projectSlug, planSlug, group, baseRevision)
      if (!result.ok) {
        sendJson(response, result.reason === "not-found" ? 404 : 409, {
          error: result.reason,
          message: "",
          ...(result.missing === undefined ? {} : { missing: result.missing }),
        })
        return
      }
      const updated = await store.getPlan(projectSlug, planSlug)
      notify(projectSlug, planSlug, "changed", { revision: updated?.revision ?? 0 })
      let delivery = "pending"
      const registered = projects.get(project.directory)
      if (registered) {
        try {
          const outcome = await registered.deliver(planSlug)
          if (outcome === "woken" || outcome === "pending" || outcome === "failed") {
            delivery = outcome === "failed" ? "pending" : outcome
          }
        } catch {
          delivery = "pending"
        }
      }
      if (delivery === "woken") {
        notify(projectSlug, planSlug, "delivered", { submissionId: result.submission.id })
      }
      sendJson(response, 200, {
        submission: {
          id: result.submission.id,
          groups: result.submission.groups,
          count: result.submission.questions.length,
        },
        skipped: result.skipped,
        delivery,
      })
      return
    }

    match = /^\/api\/projects\/([^/]+)\/plans\/([^/]+)\/archive$/.exec(path)
    if (method === "POST" && match) {
      const projectSlug = slugParameter(match[1])
      const planSlug = slugParameter(match[2])
      if (!projectSlug || !planSlug) {
        sendError(response, 404, "not-found")
        return
      }
      const body = writeBody
      if (typeof body?.archived !== "boolean") {
        sendError(response, 400, "invalid", "archived must be a boolean")
        return
      }
      const changed = await store.setArchived(projectSlug, planSlug, body.archived)
      if (!changed) {
        sendError(response, 404, "not-found")
        return
      }
      const updated = await store.getPlan(projectSlug, planSlug)
      notify(projectSlug, planSlug, "changed", { revision: updated?.revision ?? 0 })
      sendJson(response, 200, { archived: body.archived })
      return
    }

    match = /^\/api\/projects\/([^/]+)\/plans\/([^/]+)$/.exec(path)
    if (method === "GET" && match) {
      const projectSlug = slugParameter(match[1])
      const planSlug = slugParameter(match[2])
      if (!projectSlug || !planSlug) {
        sendError(response, 404, "not-found")
        return
      }
      const project = await store.getProject(projectSlug)
      if (!project) {
        sendError(response, 404, "not-found")
        return
      }
      const plan = await store.getPlan(projectSlug, planSlug)
      if (!plan) {
        sendError(response, 404, "not-found")
        return
      }
      sendJson(response, 200, { project, plan: summarize(plan) })
      return
    }

    match = /^\/api\/projects\/([^/]+)\/plans\/([^/]+)\/events$/.exec(path)
    if (method === "GET" && match) {
      const projectSlug = slugParameter(match[1])
      const planSlug = slugParameter(match[2])
      if (!projectSlug || !planSlug) {
        sendError(response, 404, "not-found")
        return
      }
      const plan = await store.getPlan(projectSlug, planSlug)
      if (!plan) {
        sendError(response, 404, "not-found")
        return
      }
      const nonce = newNonce()
      response.writeHead(200, {
        ...securityHeaders(nonce),
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      })
      response.write(
        `event: hello\ndata: ${JSON.stringify({ instanceId, revision: plan.revision })}\n\n`,
      )
      const key = `${projectSlug}/${planSlug}`
      const streams = viewers.get(key) ?? new Set()
      streams.add(response)
      viewers.set(key, streams)
      response.on("close", () => {
        streams.delete(response)
        if (streams.size === 0) viewers.delete(key)
      })
      return
    }

    if (method === "DELETE" && /^\/api\/projects\/[^/]+\/plans\/[^/]+$/.test(path)) {
      const parts = path.split("/")
      const projectSlug = slugParameter(parts[3])
      const planSlug = slugParameter(parts[5])
      if (!projectSlug || !planSlug) {
        sendError(response, 404, "not-found")
        return
      }
      const body = writeBody
      if (body?.confirm !== true) {
        sendError(response, 400, "bad-request", "confirm is required")
        return
      }
      const deleted = await store.deletePlan(projectSlug, planSlug)
      if (!deleted) {
        sendError(response, 404, "not-found")
        return
      }
      notify(projectSlug, planSlug, "changed", { revision: 0 })
      sendJson(response, 200, { deleted: true })
      return
    }

    sendError(response, 404, "not-found")
  }

  const runtime = {
    /** See the module contract: start the listener on demand. */
    ensureListening() {
      if (server) return Promise.resolve({ url: `http://127.0.0.1:${boundPort}`, fallback })
      if (listening) return listening
      listening = new Promise((resolve) => {
        const attempt = (port, isFallback) => {
          const candidate = createServer((request, response) => {
            handle(request, response).catch((error) => {
              if (error instanceof DiscoveryDataError) {
                sendJson(response, 409, { error: error.code, message: error.message })
                return
              }
              log("Discovery request failed")
              sendError(response, 500, "internal")
            })
          })
          candidate.on("connection", (socket) => {
            sockets.add(socket)
            socket.on("close", () => sockets.delete(socket))
          })
          candidate.once("error", (error) => {
            if (!isFallback && error?.code === "EADDRINUSE") {
              attempt(0, true)
              return
            }
            log("Discovery listener could not start")
            resolve(null)
          })
          candidate.listen(port, "127.0.0.1", () => {
            server = candidate
            boundPort = candidate.address().port
            fallback = isFallback
            instanceId = randomUUID()
            resolve({ url: `http://127.0.0.1:${boundPort}`, fallback })
          })
        }
        attempt(Number.isInteger(requestedPort) ? requestedPort : DEFAULT_PORT, false)
      })
      return listening
    },

    /** Register one project's delivery callback. */
    registerProject(directory, slug, deliver) {
      const token = Symbol("discovery-project")
      const key = canonicalDirectory(directory)
      projects.set(key, { slug, deliver, token })
      return () => {
        const current = projects.get(key)
        if (current && current.token === token) projects.delete(key)
      }
    },

    /** True when an open page shows this plan. */
    hasViewer(projectSlug, planSlug) {
      return (viewers.get(`${projectSlug}/${planSlug}`)?.size ?? 0) > 0
    },

    /** Broadcast one event to the plan's open pages. */
    notify,

    /** End event streams, close connections, and stop when idle. */
    async closeIfIdle() {
      if (listening && server === null) {
        // A start is in flight; let it finish, then re-check idleness.
        try {
          await listening
        } catch {
          // A failed start leaves nothing to close.
        }
      }
      if (projects.size > 0 || server === null) return
      for (const streams of viewers.values()) {
        for (const response of streams) {
          try {
            response.end()
          } catch {
            // Already closed.
          }
        }
      }
      viewers.clear()
      for (const socket of sockets) {
        try {
          socket.destroy()
        } catch {
          // Already closed.
        }
      }
      sockets.clear()
      const closing = server
      server = null
      listening = null
      boundPort = 0
      fallback = false
      instanceId = null
      indexTemplate = null
      assets = new Map()
      await new Promise((resolve) => closing.close(() => resolve()))
    },

    /** The absolute URL of a plan page, or null before the listener starts. */
    planUrl(projectSlug, planSlug) {
      if (boundPort === 0) return null
      return `http://127.0.0.1:${boundPort}/#/p/${projectSlug}/${planSlug}`
    },

    /** The one store every handler uses. */
    store,
  }

  return runtime
}

/**
 * Create a runtime with its own store, assets, and listener.
 *
 * When the process-wide slot is empty, the new runtime is installed there, so
 * a later {@link getDiscoveryRuntime} call returns the same instance. Tests
 * use this directly to start a listener on port 0.
 *
 * @param {{ store: object, assetsDir: string, version: string, port?: number,
 *   log?: (message: string) => void }} options - Runtime dependencies.
 * @returns {object} The runtime.
 */
export function createDiscoveryRuntime(options) {
  const runtime = buildRuntime(options)
  if (globalThis[RUNTIME_KEY] === undefined) globalThis[RUNTIME_KEY] = runtime
  return runtime
}

/**
 * The process-wide runtime, created on first use and returned unchanged
 * afterwards.
 *
 * @param {{ store: object, assetsDir: string, version: string, port?: number,
 *   log?: (message: string) => void }} options - Runtime dependencies, used only
 *   when the slot is empty.
 * @returns {object} The runtime.
 */
export function getDiscoveryRuntime(options) {
  return globalThis[RUNTIME_KEY] ?? createDiscoveryRuntime(options)
}
