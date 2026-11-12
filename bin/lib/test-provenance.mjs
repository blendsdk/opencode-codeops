#!/usr/bin/env node
/**
 * Release provenance records and artifact verification.
 *
 * A provenance record is the evidence that lets production promote one artifact
 * without repeating the full suite. It is deliberately strict: a missing full
 * flag, a different commit, a different map, or a rebuilt artifact must fail the
 * verifier rather than pass on a plausible-looking file.
 *
 * The record contains no test output, environment values, or secrets.
 *
 * @module lib/test-provenance
 */

import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"

/** Gates whose evidence covers a release artifact. */
const FULL_GATES = Object.freeze(["release", "acceptance"])

/**
 * Compute the SHA-256 digest of a file.
 *
 * @param {string} path File path.
 * @returns {string} Digest in the form `sha256:<hex>`.
 * @throws {Error} When the file cannot be read.
 * @example
 * sha256File("dist/app.tar.gz") // "sha256:..."
 */
export function sha256File(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`
}

/**
 * Check whether a value is a Git object hash.
 *
 * @param {unknown} value Candidate value.
 * @returns {boolean} `true` for a 40- or 64-character hexadecimal string.
 */
function isCommit(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$|^[0-9a-f]{64}$/i.test(value)
}

/**
 * Build one provenance record.
 *
 * @param {object} input Record input.
 * @param {string} input.commit Tested commit.
 * @param {string} [input.ref] Tested ref.
 * @param {string} input.gate Gate name.
 * @param {string|null} input.mapHash Map hash, or null for a no-map project.
 * @param {string[]} [input.groups=[]] Groups covered by the full gate.
 * @param {string|null} [input.fullRunId=null] CI full-run identifier.
 * @param {string|null} [input.artifactPath=null] Artifact path.
 * @param {string|null} [input.artifactDigest=null] Artifact digest override.
 * @param {string|null} [input.sourceCommit=null] Commit the gate tested.
 * @param {"source"|"artifact"} [input.artifactTested="source"] What the gate tested.
 * @param {boolean} [input.reproducible=false] Whether a rebuild reproduced the digest.
 * @param {object|null} [input.coverage=null] Coverage evidence.
 * @param {object|null} [input.acceptance=null] Acceptance evidence.
 * @param {string} [input.result="passed"] Gate result.
 * @param {string} [input.startedAt] ISO start time.
 * @param {string} [input.finishedAt] ISO finish time.
 * @returns {object} Provenance record.
 * @throws {Error} When the commit is not a Git hash or the gate is unknown.
 * @example
 * const record = createProvenanceRecord({ commit, gate: "release", mapHash, artifactPath: "dist/app.tgz" })
 */
export function createProvenanceRecord({
  commit,
  ref = null,
  gate,
  mapHash,
  groups = [],
  fullRunId = null,
  artifactPath = null,
  artifactDigest = null,
  sourceCommit = null,
  artifactTested = "source",
  reproducible = false,
  coverage = null,
  acceptance = null,
  result = "passed",
  startedAt = new Date().toISOString(),
  finishedAt = new Date().toISOString(),
}) {
  if (!isCommit(commit)) throw new Error("provenance commit must be a 40- or 64-character Git hash")
  if (!FULL_GATES.includes(gate)) throw new Error(`provenance gate must be release or acceptance, got ${String(gate)}`)

  let artifact = null
  if (artifactPath || artifactDigest) {
    if (!artifactPath && !artifactDigest) throw new Error("artifact verification needs a path or digest")
    if (artifactPath && !existsSync(artifactPath) && !artifactDigest) {
      throw new Error(`artifact not found: ${artifactPath}`)
    }
    artifact = {
      path: artifactPath,
      digest: artifactDigest ?? sha256File(artifactPath),
      sourceCommit: sourceCommit ?? commit,
      tested: artifactTested === "artifact" ? "artifact" : "source",
      reproducible: reproducible === true,
    }
  }

  return {
    schema: 1,
    commit,
    ref,
    gate,
    mapHash: mapHash ?? null,
    selection: mapHash ? "map" : "no-map",
    full: true,
    groups: [...groups].sort(),
    fullRunId,
    artifact,
    coverage,
    coverageStatus: coverage ? "provided" : "not-provided",
    acceptance,
    acceptanceStatus: acceptance ? "provided" : "not-provided",
    startedAt,
    finishedAt,
    result,
  }
}

/**
 * Compare a record against expected release facts.
 *
 * @param {object} record Provenance record.
 * @param {object} [expected] Expected facts.
 * @param {string} [expected.commit] Expected tested commit.
 * @param {string} [expected.mapHash] Expected map hash.
 * @param {string} [expected.artifactPath] Artifact to re-hash.
 * @param {string} [expected.artifactDigest] Expected artifact digest.
 * @returns {{ok: boolean, errors: Array<{field: string, message: string}>}} Verification result.
 * @example
 * const result = verifyProvenance(record, { artifactPath: "dist/app.tar.gz" })
 * if (!result.ok) process.exitCode = 1
 */
export function verifyProvenance(record, expected = {}) {
  const errors = []
  const fail = (field, message) => errors.push({ field, message })

  if (!record || typeof record !== "object" || record.schema !== 1) {
    fail("schema", "record must use schema 1")
    return { ok: false, errors }
  }
  if (!isCommit(record.commit)) fail("commit", "record commit is not a Git hash")
  if (expected.commit && record.commit !== expected.commit) {
    fail("commit", `expected ${expected.commit}, got ${record.commit}`)
  }

  if (record.mapHash === null) {
    if (record.selection !== "no-map") fail("selection", "a null map hash requires selection no-map")
  } else {
    if (record.selection !== "map") fail("selection", "a map hash requires selection map")
    if (expected.mapHash && record.mapHash !== expected.mapHash) {
      fail("mapHash", `expected ${expected.mapHash}, got ${record.mapHash}`)
    }
  }

  if (FULL_GATES.includes(record.gate) && record.full !== true) {
    fail("full", "release and acceptance records must have full: true")
  }
  if (record.result !== "passed") fail("result", `gate result is ${String(record.result)}, not passed`)

  if (record.artifact) {
    if (!record.artifact.digest) fail("artifact.digest", "artifact evidence needs a digest")
    if (record.artifact.sourceCommit !== record.commit) {
      fail("artifact.sourceCommit", "artifact source commit must match the tested commit")
    }
    if (record.artifact.tested !== "artifact" && record.artifact.reproducible !== true) {
      fail("artifact.reproducible", "a source-tested artifact needs a reproducible rebuild")
    }
  }

  const expectedDigest =
    expected.artifactDigest ??
    (expected.artifactPath && existsSync(expected.artifactPath) ? sha256File(expected.artifactPath) : null)
  if (expectedDigest) {
    if (!record.artifact?.digest) fail("artifact.digest", "record has no artifact digest")
    else if (record.artifact.digest !== expectedDigest) {
      fail("artifact.digest", `expected ${expectedDigest}, got ${record.artifact.digest}`)
    }
  }

  return { ok: errors.length === 0, errors }
}
