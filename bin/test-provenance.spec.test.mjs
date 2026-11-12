/**
 * Specification tests for release provenance.
 *
 * Provenance is the anti-bypass record: it proves which commit, map, and
 * artifact the full gate covered. A verifier must fail on any mismatch rather
 * than accepting a plausible-looking file.
 *
 * @module test-provenance.spec.test
 */

import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"

import {
  createProvenanceRecord,
  sha256File,
  verifyProvenance,
} from "./lib/test-provenance.mjs"

const roots = []

/** Create a temporary artifact directory. */
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "codeops-provenance-"))
  roots.push(root)
  return root
}

/** Build a release record around a temporary artifact. */
function releaseRecord(root, extra = {}) {
  const artifactPath = join(root, "app.tgz")
  writeFileSync(artifactPath, "artifact-v1")
  return createProvenanceRecord({
    commit: "a".repeat(40),
    ref: "refs/heads/release/2026.11",
    gate: "release",
    mapHash: "b".repeat(64),
    groups: ["a.unit", "a.e2e"],
    fullRunId: "run-1",
    artifactPath,
    sourceCommit: "a".repeat(40),
    reproducible: true,
    coverage: { lines: 87.2 },
    acceptance: { mode: "manual", result: "approved" },
    ...extra,
  })
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true })
})

describe("ST-41 provenance verification", () => {
  it("accepts a matching record", () => {
    const root = makeRoot()
    const record = releaseRecord(root)
    const result = verifyProvenance(record, {
      commit: "a".repeat(40),
      mapHash: "b".repeat(64),
      artifactDigest: record.artifact.digest,
    })
    assert.deepEqual(result.errors, [])
  })

  it("names each mismatched field", () => {
    const root = makeRoot()
    const record = releaseRecord(root)
    for (const [expected, field] of [
      [{ commit: "c".repeat(40) }, "commit"],
      [{ mapHash: "d".repeat(64) }, "mapHash"],
      [{ artifactDigest: "sha256:" + "0".repeat(64) }, "artifact.digest"],
    ]) {
      const result = verifyProvenance(record, expected)
      assert.ok(result.errors.some((error) => error.field === field), field)
    }
  })

  it("rejects a non-full, non-passing, or source-commit-mismatched release", () => {
    const root = makeRoot()
    const base = releaseRecord(root)
    assert.ok(verifyProvenance({ ...base, full: false }).errors.some((error) => error.field === "full"))
    assert.ok(verifyProvenance({ ...base, result: "failed" }).errors.some((error) => error.field === "result"))
    assert.ok(
      verifyProvenance({ ...base, artifact: { ...base.artifact, sourceCommit: "e".repeat(40) } }).errors.some(
        (error) => error.field === "artifact.sourceCommit",
      ),
    )
  })

  it("requires a reproducible rebuild when the gate ran on source", () => {
    const root = makeRoot()
    const record = releaseRecord(root, { reproducible: false })
    assert.ok(verifyProvenance(record).errors.some((error) => error.field === "artifact.reproducible"))
  })

  it("accepts a no-map record without a map hash", () => {
    const record = createProvenanceRecord({
      commit: "a".repeat(40),
      gate: "release",
      mapHash: null,
      groups: [],
      fullRunId: "run-1",
      result: "passed",
    })
    assert.equal(record.selection, "no-map")
    assert.deepEqual(verifyProvenance(record).errors, [])
  })
})

describe("ST-42 artifact promotion", () => {
  it("reuses evidence for the same digest and rejects a rebuilt artifact", () => {
    const root = makeRoot()
    const record = releaseRecord(root)
    assert.deepEqual(verifyProvenance(record, { artifactPath: record.artifact.path }).errors, [])

    writeFileSync(record.artifact.path, "artifact-v2")
    const rebuilt = verifyProvenance(record, { artifactPath: record.artifact.path })
    assert.ok(rebuilt.errors.some((error) => error.field === "artifact.digest"))
  })
})

describe("ST-67 source-tested artifacts", () => {
  it("hashes bytes deterministically and records the tested source commit", () => {
    const root = makeRoot()
    const path = join(root, "file.bin")
    writeFileSync(path, "abc")
    assert.equal(sha256File(path), "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    const record = releaseRecord(root)
    assert.equal(record.artifact.sourceCommit, record.commit)
    assert.equal(record.artifact.reproducible, true)
  })
})
