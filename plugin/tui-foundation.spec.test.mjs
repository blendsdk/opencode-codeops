/**
 * Specification tests for the TUI foundation spike.
 *
 * These tests pin the spike's observable contract: the published package
 * exposes a `./tui` entry point and excludes its test files, the TUI entry
 * claims the sidebar content slot and renders only a validated payload, the
 * server plugin registers the `codeops` RPC through a helper that never
 * throws, and the existing server plugin setup completes unchanged with and
 * without the RPC API.
 *
 * This is the specification oracle: a failing test means the implementation is
 * wrong, never the test.
 *
 * @module tui-foundation.spec.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** Fixture temp bases created by this suite; removed on exit. */
const fixtures = []

after(() => {
  while (fixtures.length > 0) {
    rmSync(fixtures.pop(), { recursive: true, force: true })
  }
})

/**
 * Read a repository file as UTF-8 text.
 *
 * @param {string} relativePath - Path relative to the repository root.
 * @returns {string} The file contents.
 */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

/**
 * Create a throwaway root directory for one fixture.
 *
 * @returns {string} Absolute path to the new directory.
 */
function makeBase() {
  const dir = mkdtempSync(join(tmpdir(), "codeops-tui-foundation-"))
  fixtures.push(dir)
  return dir
}

/**
 * Build a fake server plugin context that captures hook registrations.
 *
 * The fake mirrors only the surface `setup` uses: location, app, an event
 * stream that ends immediately, the three hook domains, and the model list.
 *
 * @param {string} directory - Project directory reported by the context.
 * @param {{register?: Function}} [rpc] - Optional RPC domain implementation.
 * @returns {{ctx: object, hooks: {session: string[], shell: string[], tool: string[]}}} Fake context and captured hook names.
 */
function makeFakeContext(directory, rpc) {
  const hooks = { session: [], shell: [], tool: [] }
  const ctx = {
    location: { directory },
    app: { version: "2.0.24" },
    event: { subscribe: () => (async function* () {})() },
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
  if (rpc) ctx.rpc = rpc
  return { ctx, hooks }
}

describe("published packaging (ST-8)", () => {
  it("should expose the ./tui entry and keep plugin test files out of the package", () => {
    const manifest = JSON.parse(read("package.json"))

    assert.equal(manifest.exports["./tui"], "./plugin/tui.tsx")
    assert.equal(existsSync(join(ROOT, "plugin", "tui.tsx")), true, "plugin/tui.tsx must exist")
    assert.ok(manifest.files.includes("plugin/"), "files must include plugin/")
    assert.ok(
      manifest.files.includes("!plugin/*.test.mjs"),
      "files must exclude plugin *.test.mjs files"
    )
    assert.ok(
      manifest.files.includes("!plugin/*.spec.test.mjs"),
      "files must exclude plugin *.spec.test.mjs files"
    )

    const packed = spawnSync("npm", ["pack", "--dry-run", "--json"], { cwd: ROOT, encoding: "utf8" })
    assert.equal(packed.status, 0, packed.stderr)
    const entries = JSON.parse(packed.stdout)[0].files.map((file) => file.path)
    assert.ok(entries.includes("plugin/tui.tsx"), "the tui entry must ship in the tarball")
    assert.ok(
      !entries.some((path) => /^plugin\/.*\.test\.mjs$/.test(path)),
      `plugin test files must not ship: ${entries.filter((path) => /\.test\.mjs$/.test(path)).join(", ")}`
    )
  })
})

describe("content contracts (ST-9)", () => {
  it("should keep the sidebar slot claim, the helper import, and the no-timer rule", () => {
    const tsx = read("plugin/tui.tsx")

    assert.match(tsx, /append:\s*"sidebar\.content"/)
    assert.match(tsx, /codeops-rpc\.mjs/)
    assert.doesNotMatch(tsx, /setInterval|setTimeout/)
  })

  it("should register through the shared helper inside a guard", () => {
    const index = read("plugin/index.ts")

    assert.match(index, /registerCodeOpsRpc/)
    assert.doesNotMatch(index, /\.rpc\.register/, "index.ts must not call rpc.register directly")
    assert.match(index, /try\s*\{[\s\S]*?registerCodeOpsRpc[\s\S]*?\}\s*catch/)
    assert.match(index, /warnContentFree\(/)
  })
})

describe("RPC helper contract (ST-10)", () => {
  it("should return false without throwing when the rpc API is missing (a)", async () => {
    const { registerCodeOpsRpc } = await import("../bin/lib/codeops-rpc.mjs")

    assert.equal(await registerCodeOpsRpc({}, { pluginVersion: "2.1.1" }), false)
  })

  it("should return false without throwing when registration fails (b)", async () => {
    const { registerCodeOpsRpc } = await import("../bin/lib/codeops-rpc.mjs")
    const failing = {
      rpc: {
        register: async () => {
          throw new Error("rpc unavailable")
        },
      },
    }

    assert.equal(await registerCodeOpsRpc(failing, { pluginVersion: "2.1.1" }), false)
  })

  it("should register the codeops definition and return the exact status payload (c)", async () => {
    const { registerCodeOpsRpc } = await import("../bin/lib/codeops-rpc.mjs")
    const captured = {}
    const fakeCtx = {
      app: { version: "9.9.9" },
      location: { directory: "/fixture/project" },
      rpc: {
        register: async (definition, handlers) => {
          captured.definition = definition
          captured.handlers = handlers
          return {}
        },
      },
    }

    const registered = await registerCodeOpsRpc(fakeCtx, { pluginVersion: "2.1.1" })

    assert.equal(registered, true)
    assert.equal(captured.definition.id, "codeops")
    const payload = await captured.handlers.status({}, { signal: undefined })
    assert.deepEqual(payload, {
      pluginVersion: "2.1.1",
      openCodeVersion: "9.9.9",
      directory: "/fixture/project",
    })
    for (const value of Object.values(payload)) {
      assert.equal(typeof value, "string")
    }
  })

  it("should return false without throwing for empty rpc objects or non-function register (d)", async () => {
    const { registerCodeOpsRpc } = await import("../bin/lib/codeops-rpc.mjs")

    assert.equal(await registerCodeOpsRpc({ rpc: {} }, { pluginVersion: "2.1.1" }), false)
    assert.equal(
      await registerCodeOpsRpc({ rpc: { register: 42 } }, { pluginVersion: "2.1.1" }),
      false
    )
  })
})

describe("server setup containment (ST-11)", () => {
  it("should complete setup with and without the RPC API and register codeops when present", async () => {
    const base = makeBase()
    const previousTmpdir = process.env.TMPDIR
    const previousHome = process.env.HOME
    process.env.TMPDIR = base
    process.env.HOME = base
    try {
      const plugin = (await import("../plugin/index.ts")).default

      const without = makeFakeContext(base)
      const cleanupWithout = await plugin.setup(without.ctx)
      assert.equal(typeof cleanupWithout, "function")
      assert.ok(without.hooks.session.includes("context"))
      assert.ok(without.hooks.session.includes("compaction"))
      assert.ok(without.hooks.session.includes("prompt"))
      assert.ok(without.hooks.shell.includes("create.before"))
      assert.ok(without.hooks.tool.includes("execute.before"))

      const captured = {}
      const withRpc = makeFakeContext(base, {
        register: async (definition) => {
          captured.definition = definition
          return {}
        },
      })
      const cleanupWith = await plugin.setup(withRpc.ctx)
      assert.equal(typeof cleanupWith, "function")
      assert.equal(captured.definition?.id, "codeops", "codeops must register when rpc exists")
      assert.ok(withRpc.hooks.session.includes("context"))
      assert.ok(withRpc.hooks.shell.includes("create.before"))
      assert.ok(withRpc.hooks.tool.includes("execute.before"))

      await cleanupWithout()
      await cleanupWith()
    } finally {
      if (previousTmpdir === undefined) delete process.env.TMPDIR
      else process.env.TMPDIR = previousTmpdir
      if (previousHome === undefined) delete process.env.HOME
      else process.env.HOME = previousHome
    }
  })
})
