/**
 * Specification tests for CodeOps plugin registration.
 *
 * The installer delegates plugin config changes to OpenCode's own
 * `opencode plugin` command. These tests pin the argument shape, the pinned
 * version with a bare-name fallback, and the "never throw" contract. No real
 * `opencode` process is started; the command runner is injected.
 *
 * @module opencode-plugin.spec.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildPluginArgs, readConfiguredPlugin, registerPlugin } from "./lib/opencode-plugin.mjs"

/**
 * Builds an injected runner that answers by joined argument line.
 *
 * @param responses - Map of joined args to a result, or to a function returning one
 * @returns The runner and the list of calls it received
 */
function makeRun(responses) {
  const calls = []
  const run = (_command, args) => {
    const key = args.join(" ")
    calls.push(key)
    const response = responses[key]
    if (typeof response === "function") return response()
    return response ?? { status: 1 }
  }
  return { run, calls }
}

describe("buildPluginArgs", () => {
  it("pins the version and adds --global and --force for the global scope", () => {
    assert.deepEqual(buildPluginArgs({ scope: "global", version: "1.5.0" }), [
      "plugin",
      "opencode-codeops@1.5.0",
      "--global",
      "--force",
    ])
  })

  it("omits --global for the project scope", () => {
    assert.deepEqual(buildPluginArgs({ scope: "project", version: "1.5.0" }), [
      "plugin",
      "opencode-codeops@1.5.0",
      "--force",
    ])
  })

  it("uses the bare package name without a version", () => {
    assert.deepEqual(buildPluginArgs({ scope: "project", version: null }), [
      "plugin",
      "opencode-codeops",
      "--force",
    ])
  })
})

describe("registerPlugin", () => {
  it("reports failure when the opencode CLI is missing", () => {
    const { run } = makeRun({ "--version": { status: 1, error: new Error("ENOENT") } })

    const result = registerPlugin({ scope: "global", version: "1.5.0", run })

    assert.equal(result.ok, false)
    assert.match(result.reason, /not found/)
  })

  it("registers the pinned version when accepted", () => {
    const { run, calls } = makeRun({
      "--version": { status: 0 },
      "plugin opencode-codeops@1.5.0 --global --force": { status: 0 },
    })

    const result = registerPlugin({ scope: "global", version: "1.5.0", run })

    assert.equal(result.ok, true)
    assert.equal(result.spec, "opencode-codeops@1.5.0")
    assert.deepEqual(calls, ["--version", "plugin opencode-codeops@1.5.0 --global --force"])
  })

  it("falls back to the bare name when the versioned spec is rejected", () => {
    const { run } = makeRun({
      "--version": { status: 0 },
      "plugin opencode-codeops@1.5.0 --global --force": { status: 1, stderr: "bad version" },
      "plugin opencode-codeops --global --force": { status: 0 },
    })

    const result = registerPlugin({ scope: "global", version: "1.5.0", run })

    assert.equal(result.ok, true)
    assert.equal(result.spec, "opencode-codeops")
  })

  it("reports the last error when both attempts fail", () => {
    const { run } = makeRun({
      "--version": { status: 0 },
      "plugin opencode-codeops@1.5.0 --global --force": { status: 1, stderr: "first" },
      "plugin opencode-codeops --global --force": { status: 1, stderr: "final failure" },
    })

    const result = registerPlugin({ scope: "global", version: "1.5.0", run })

    assert.equal(result.ok, false)
    assert.match(result.reason, /final failure/)
  })

  it("never throws when the runner itself fails", () => {
    const run = () => {
      throw new Error("spawn blew up")
    }

    const result = registerPlugin({ scope: "global", version: "1.5.0", run })

    assert.equal(result.ok, false)
    assert.match(result.reason, /spawn blew up/)
  })
})

describe("readConfiguredPlugin", () => {
  it("returns the plugin array from the resolved config", () => {
    const { run } = makeRun({
      "debug config": { status: 0, stdout: JSON.stringify({ plugin: ["opencode-codeops@1.5.0"] }) },
    })

    assert.deepEqual(readConfiguredPlugin({ run }), ["opencode-codeops@1.5.0"])
  })

  it("returns undefined when the command fails or output is not JSON", () => {
    assert.equal(readConfiguredPlugin({ run: makeRun({ "debug config": { status: 1 } }).run }), undefined)
    assert.equal(
      readConfiguredPlugin({ run: makeRun({ "debug config": { status: 0, stdout: "not json" } }).run }),
      undefined
    )
  })
})
