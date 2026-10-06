/**
 * Specification tests for CodeOps plugin registration.
 *
 * The installer delegates plugin config changes to OpenCode's own
 * `opencode plugin` command. These tests pin the OpenCode 2 requirement, the
 * argument shape for both CLI dialects, the pinned version with a bare-name
 * fallback, the config-read normalization, and the "never throw" contract. No
 * real `opencode` process is started; the command runner is injected.
 *
 * @module opencode-plugin.spec.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildPluginArgs,
  detectPluginDialect,
  parseOpenCodeMajor,
  readConfiguredPlugin,
  registerPlugin,
} from "./lib/opencode-plugin.mjs"

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

/** Standard responses describing an OpenCode 2 CLI with the `add` subcommand. */
function opencode2Add(overrides = {}) {
  return {
    "--version": { status: 0, stdout: "2.0.24" },
    "plugin add --help": { status: 0, stdout: "opencode plugin add <module> [--global]" },
    ...overrides,
  }
}

describe("parseOpenCodeMajor", () => {
  it("reads the major from plain and decorated version strings", () => {
    assert.equal(parseOpenCodeMajor("2.0.24"), 2)
    assert.equal(parseOpenCodeMajor("opencode 1.18.34\n"), 1)
  })

  it("returns undefined when no semver is present", () => {
    assert.equal(parseOpenCodeMajor("not a version"), undefined)
    assert.equal(parseOpenCodeMajor(undefined), undefined)
  })
})

describe("buildPluginArgs", () => {
  it("uses the add subcommand with --global when supported", () => {
    assert.deepEqual(
      buildPluginArgs({ scope: "global", version: "2.0.0", dialect: "add", supportsGlobal: true }),
      ["plugin", "add", "opencode-codeops@2.0.0", "--global"]
    )
  })

  it("omits --global for project scope in the add dialect", () => {
    assert.deepEqual(
      buildPluginArgs({ scope: "project", version: "2.0.0", dialect: "add", supportsGlobal: true }),
      ["plugin", "add", "opencode-codeops@2.0.0"]
    )
  })

  it("omits --global when the add subcommand does not accept it", () => {
    assert.deepEqual(
      buildPluginArgs({ scope: "global", version: null, dialect: "add", supportsGlobal: false }),
      ["plugin", "add", "opencode-codeops"]
    )
  })

  it("keeps the positional form for older CLI builds", () => {
    assert.deepEqual(
      buildPluginArgs({ scope: "global", version: "2.0.0", dialect: "positional" }),
      ["plugin", "opencode-codeops@2.0.0", "--global", "--force"]
    )
    assert.deepEqual(
      buildPluginArgs({ scope: "project", version: null, dialect: "positional" }),
      ["plugin", "opencode-codeops", "--force"]
    )
  })
})

describe("detectPluginDialect", () => {
  it("selects the add dialect and reads --global support from help", () => {
    const { run } = makeRun({
      "plugin add --help": { status: 0, stdout: "usage: opencode plugin add <module> [--global]" },
    })
    assert.deepEqual(detectPluginDialect({ run }), { dialect: "add", supportsGlobal: true })
  })

  it("falls back to the positional dialect when add is not a subcommand", () => {
    const { run } = makeRun({})
    assert.deepEqual(detectPluginDialect({ run }), { dialect: "positional", supportsGlobal: true })
  })
})

describe("registerPlugin", () => {
  it("reports failure when the opencode CLI is missing", () => {
    const { run } = makeRun({ "--version": { status: 1, error: new Error("ENOENT") } })

    const result = registerPlugin({ scope: "global", version: "2.0.0", run })

    assert.equal(result.ok, false)
    assert.match(result.reason, /not found/)
  })

  it("refuses OpenCode 1 with a pointer to the 1.x line", () => {
    const { run } = makeRun({ "--version": { status: 0, stdout: "1.18.34" } })

    const result = registerPlugin({ scope: "global", version: "2.0.0", run })

    assert.equal(result.ok, false)
    assert.match(result.reason, /OpenCode 2 is required/)
    assert.match(result.reason, /opencode-codeops@1/)
  })

  it("registers the pinned version through the add subcommand", () => {
    const { run, calls } = makeRun(
      opencode2Add({
        "plugin add opencode-codeops@2.0.0 --global": { status: 0 },
      })
    )

    const result = registerPlugin({ scope: "global", version: "2.0.0", run })

    assert.equal(result.ok, true)
    assert.equal(result.spec, "opencode-codeops@2.0.0")
    assert.equal(result.dialect, "add")
    assert.deepEqual(calls, [
      "--version",
      "plugin add --help",
      "plugin add opencode-codeops@2.0.0 --global",
    ])
  })

  it("falls back to the bare name when the versioned spec is rejected", () => {
    const { run } = makeRun(
      opencode2Add({
        "plugin add opencode-codeops@2.0.0 --global": { status: 1, stderr: "bad version" },
        "plugin add opencode-codeops --global": { status: 0 },
      })
    )

    const result = registerPlugin({ scope: "global", version: "2.0.0", run })

    assert.equal(result.ok, true)
    assert.equal(result.spec, "opencode-codeops")
  })

  it("falls back to the positional form on older CLI builds", () => {
    const { run } = makeRun({
      "--version": { status: 0, stdout: "2.0.24" },
      "plugin opencode-codeops@2.0.0 --global --force": { status: 0 },
    })

    const result = registerPlugin({ scope: "global", version: "2.0.0", run })

    assert.equal(result.ok, true)
    assert.equal(result.dialect, "positional")
  })

  it("reports the last error when all attempts fail", () => {
    const { run } = makeRun(
      opencode2Add({
        "plugin add opencode-codeops@2.0.0 --global": { status: 1, stderr: "first" },
        "plugin add opencode-codeops --global": { status: 1, stderr: "final failure" },
      })
    )

    const result = registerPlugin({ scope: "global", version: "2.0.0", run })

    assert.equal(result.ok, false)
    assert.match(result.reason, /final failure/)
  })

  it("never throws when the runner itself fails", () => {
    const run = () => {
      throw new Error("spawn blew up")
    }

    const result = registerPlugin({ scope: "global", version: "2.0.0", run })

    assert.equal(result.ok, false)
    assert.match(result.reason, /spawn blew up/)
  })
})

describe("readConfiguredPlugin", () => {
  it("normalizes string, object, and tuple entries from the plugins array", () => {
    const { run } = makeRun({
      "debug config": {
        status: 0,
        stdout: JSON.stringify({
          plugins: [
            "opencode-codeops@2.0.0",
            { package: "@acme/opencode-plugin", options: {} },
            ["opencode-other@1.0.0", { enabled: true }],
            { options: {} },
          ],
        }),
      },
    })

    assert.deepEqual(readConfiguredPlugin({ run }), [
      "opencode-codeops@2.0.0",
      "@acme/opencode-plugin",
      "opencode-other@1.0.0",
    ])
  })

  it("reads the legacy singular plugin key", () => {
    const { run } = makeRun({
      "debug config": { status: 0, stdout: JSON.stringify({ plugin: ["opencode-codeops@1.0.0"] }) },
    })

    assert.deepEqual(readConfiguredPlugin({ run }), ["opencode-codeops@1.0.0"])
  })

  it("returns undefined when the command fails or output is not JSON", () => {
    assert.equal(readConfiguredPlugin({ run: makeRun({ "debug config": { status: 1 } }).run }), undefined)
    assert.equal(
      readConfiguredPlugin({ run: makeRun({ "debug config": { status: 0, stdout: "not json" } }).run }),
      undefined
    )
  })
})
