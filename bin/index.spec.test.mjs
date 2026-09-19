/**
 * Specification tests for the CodeOps CLI dispatcher.
 *
 * The dispatcher exposes one binary for both installers. These tests pin the
 * routing contract and the no-argument help behavior.
 *
 * @module index.spec.test
 */

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

import { route } from "./index.mjs"

describe("route", () => {
  it("sends agent commands to the agent installer", () => {
    assert.equal(route(["install-agents", "--project"]), "agents")
    assert.equal(route(["agents-status"]), "agents")
    assert.equal(route(["agents-uninstall"]), "agents")
  })

  it("sends every other command to the skills installer", () => {
    assert.equal(route(["install-skills"]), "skills")
    assert.equal(route(["status"]), "skills")
    assert.equal(route(["uninstall"]), "skills")
    assert.equal(route([]), "skills")
  })
})

describe("CLI", () => {
  it("prints usage when run with no arguments", () => {
    const cli = fileURLToPath(new URL("./index.mjs", import.meta.url))
    const output = execFileSync(process.execPath, [cli], { encoding: "utf-8" })

    assert.match(output, /CodeOps installer for OpenCode/)
    assert.match(output, /install-agents/)
  })
})
