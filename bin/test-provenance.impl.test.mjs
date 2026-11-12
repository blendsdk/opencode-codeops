/**
 * Implementation tests for provenance and the CLI release path.
 *
 * @module test-provenance.impl.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"

import { createProvenanceRecord, sha256File, verifyProvenance } from "./lib/test-provenance.mjs"

const CLI = new URL("./codeops-test.mjs", import.meta.url).pathname
const roots = []

/** Create a temporary directory. */
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "codeops-prov-impl-"))
  roots.push(root)
  return root
}

/** Run Git in a fixture repository. */
function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

/** Run the CLI. */
function runCli(root, args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: "utf8" })
}

/** Build a Git repository with a map, artifact, and one commit. */
function makeRepo() {
  const root = makeRoot()
  git(root, ["init", "-q"])
  git(root, ["config", "user.email", "test@example.com"])
  git(root, ["config", "user.name", "Test"])
  mkdirSync(join(root, "codeops"), { recursive: true })
  mkdirSync(join(root, "dist"), { recursive: true })
  writeFileSync(join(root, "dist", "app.tgz"), "release artifact")
  writeFileSync(
    join(root, "codeops", "test-map.json"),
    JSON.stringify({
      schema: 1,
      policy: {
        schema: 1,
        full: ["npm", "run", "verify"],
        ignorePaths: [{ glob: "docs/**", reason: "documentation" }],
      },
      groups: [
        {
          id: "a.unit",
          slice: "a",
          tier: "task",
          sources: ["src/a/**"],
          tests: ["src/a/**/*.test.js"],
          run: { command: ["node", "--test", "{tests}"] },
        },
        {
          id: "a.e2e",
          slice: "a",
          tier: "release",
          sources: ["src/a/**"],
          tests: ["tests/a/**/*.spec.js"],
          run: { command: ["node", "--test", "{tests}"] },
        },
      ],
    }),
  )
  mkdirSync(join(root, "src", "a"), { recursive: true })
  mkdirSync(join(root, "tests", "a"), { recursive: true })
  writeFileSync(join(root, "src", "a", "base.js"), "x")
  writeFileSync(join(root, "src", "a", "case.test.js"), "// unit")
  writeFileSync(join(root, "tests", "a", "flow.spec.js"), "// e2e")
  git(root, ["add", "-A"])
  git(root, ["commit", "-qm", "fixture"])
  return root
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true })
})

describe("record creation", () => {
  it("rejects a non-Git commit and a non-release gate", () => {
    assert.throws(() => createProvenanceRecord({ commit: "nope", gate: "release", mapHash: "x" }))
    assert.throws(() =>
      createProvenanceRecord({ commit: "a".repeat(40), gate: "task", mapHash: "x" }),
    )
  })

  it("rejects a missing artifact when no digest is given", () => {
    assert.throws(() =>
      createProvenanceRecord({
        commit: "a".repeat(40),
        gate: "release",
        mapHash: "x",
        artifactPath: "/definitely/missing/file.tgz",
      }),
    )
  })

  it("marks coverage and acceptance as not provided when absent", () => {
    const record = createProvenanceRecord({ commit: "a".repeat(40), gate: "release", mapHash: "x" })
    assert.equal(record.coverage, null)
    assert.equal(record.coverageStatus, "not-provided")
    assert.equal(record.acceptanceStatus, "not-provided")
  })
})

describe("verification edge cases", () => {
  it("rejects a record with an invalid schema", () => {
    assert.ok(verifyProvenance({ schema: 2 }).errors.some((error) => error.field === "schema"))
  })

  it("rejects a map record with a null selection marker", () => {
    const record = createProvenanceRecord({ commit: "a".repeat(40), gate: "release", mapHash: "x" })
    const result = verifyProvenance({ ...record, selection: "no-map" })
    assert.ok(result.errors.some((error) => error.field === "selection"))
  })

  it("does not require reproducibility when the gate tested the artifact", () => {
    const root = makeRoot()
    const artifactPath = join(root, "artifact.tgz")
    writeFileSync(artifactPath, "bytes")
    const record = createProvenanceRecord({
      commit: "a".repeat(40),
      gate: "release",
      mapHash: "x",
      artifactPath,
      artifactTested: "artifact",
      reproducible: false,
    })
    assert.deepEqual(verifyProvenance(record).errors, [])
  })
})

describe("CLI release evidence", () => {
  it("writes and verifies a record for the current commit", () => {
    const root = makeRepo()
    const written = runCli(root, [
      "provenance",
      "write",
      "--gate",
      "release",
      "--artifact",
      "dist/app.tgz",
      "--record",
      "release.json",
      "--json",
    ])
    assert.equal(written.status, 0, written.stderr)
    const record = JSON.parse(readFileSync(join(root, "release.json"), "utf8"))
    assert.equal(record.artifact.digest, sha256File(join(root, "dist", "app.tgz")))
    assert.equal(record.mapHash.length, 64)

    const verified = runCli(root, [
      "provenance",
      "verify",
      "--record",
      "release.json",
      "--artifact",
      "dist/app.tgz",
    ])
    assert.equal(verified.status, 0, verified.stderr)

    writeFileSync(join(root, "dist", "app.tgz"), "rebuilt artifact")
    const rebuilt = runCli(root, [
      "provenance",
      "verify",
      "--record",
      "release.json",
      "--artifact",
      "dist/app.tgz",
    ])
    assert.equal(rebuilt.status, 1)
    assert.match(rebuilt.stdout, /artifact\.digest/)
  })

  it("fails verification for a wrong commit", () => {
    const root = makeRepo()
    runCli(root, ["provenance", "write", "--gate", "release", "--artifact", "dist/app.tgz", "--record", "release.json"])
    const result = runCli(root, [
      "provenance",
      "verify",
      "--record",
      "release.json",
      "--commit",
      "f".repeat(40),
    ])
    assert.equal(result.status, 1)
    assert.match(result.stdout, /commit/)
  })
})

describe("CLI nightly plan", () => {
  it("skips docs-only changes with a marker and runs full without one", () => {
    const root = makeRepo()
    const head = git(root, ["rev-parse", "HEAD"])
    mkdirSync(join(root, "docs"), { recursive: true })
    writeFileSync(join(root, "docs", "guide.md"), "# guide\n")
    const skipped = runCli(root, [
      "plan",
      "--gate",
      "nightly",
      "--baseline",
      "HEAD",
      "--last-full-sha",
      head,
      "--json",
    ])
    assert.equal(skipped.status, 0, skipped.stderr)
    const plan = JSON.parse(skipped.stdout)
    assert.equal(plan.mode, "skip")
    assert.deepEqual(plan.matrix, { include: [] })

    const full = runCli(root, ["plan", "--gate", "nightly", "--baseline", "HEAD", "--json"])
    assert.equal(JSON.parse(full.stdout).mode, "full")
  })
})
