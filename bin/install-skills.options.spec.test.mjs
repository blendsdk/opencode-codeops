/**
 * Specification tests for the skills installer's newer options.
 *
 * These cover the development link mode, the source override, and the version
 * report that surfaces a plugin/skills version mismatch. The base install,
 * ownership, and uninstall contract lives in `install-skills.spec.test.mjs`.
 *
 * @module install-skills.options.spec.test
 */

import assert from "node:assert/strict"
import { existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"

import { readMarker, main } from "./install-skills.mjs"

/** Temporary directories created by a test, removed after each test. */
const created = []

/** Creates a throwaway directory that is cleaned up after the test. */
function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  created.push(dir)
  return dir
}

afterEach(() => {
  while (created.length > 0) {
    rmSync(created.pop(), { recursive: true, force: true })
  }
})

/** Creates a minimal packaged-skills tree. */
function makeSource(names = ["make-plan"]) {
  const dir = tempDir("codeops-source-")
  for (const name of names) {
    mkdirSync(join(dir, name), { recursive: true })
    writeFileSync(join(dir, name, "SKILL.md"), `# ${name}\n`, "utf-8")
  }
  return dir
}

/** Runs a function, returning its captured console output. */
function capture(fn) {
  const lines = []
  const log = console.log
  const error = console.error
  console.log = (...args) => lines.push(args.join(" "))
  console.error = (...args) => lines.push(args.join(" "))
  try {
    fn()
  } finally {
    console.log = log
    console.error = error
  }
  return lines.join("\n")
}

describe("link mode", () => {
  it("symlinks skill directories to the source instead of copying", () => {
    const source = makeSource()
    const target = tempDir("codeops-target-")

    capture(() => main(["install", "--target", target, "--link"], { source, version: "1.0.0" }))

    const linked = join(target, "make-plan")
    assert.ok(lstatSync(linked).isSymbolicLink())
    assert.ok(existsSync(join(linked, "SKILL.md")))
    assert.equal(readMarker(target).version, "1.0.0")
  })
})

describe("source override", () => {
  it("installs from the directory given to --source", () => {
    const source = makeSource(["grill-me"])
    const target = tempDir("codeops-target-")

    capture(() => main(["install", "--target", target, "--source", source], { version: "1.0.0" }))

    assert.ok(existsSync(join(target, "grill-me", "SKILL.md")))
  })
})

describe("version report", () => {
  it("flags an update when the packaged version is newer than the install", () => {
    const source = makeSource()
    const target = tempDir("codeops-target-")
    capture(() => main(["install", "--target", target], { source, version: "1.0.0" }))

    const output = capture(() => main(["status", "--target", target], { source, version: "2.0.0" }))

    assert.match(output, /installed: v1\.0\.0/)
    assert.match(output, /update available: v2\.0\.0/)
  })

  it("does not flag an update when the versions match", () => {
    const source = makeSource()
    const target = tempDir("codeops-target-")
    capture(() => main(["install", "--target", target], { source, version: "1.0.0" }))

    const output = capture(() => main(["status", "--target", target], { source, version: "1.0.0" }))

    assert.doesNotMatch(output, /update available/)
  })
})
