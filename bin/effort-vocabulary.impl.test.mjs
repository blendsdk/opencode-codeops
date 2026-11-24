/**
 * Implementation tests for the five-level effort vocabulary.
 *
 * These cover internals and edge cases that are not part of the
 * specification oracle: frozen exports, malformed input, state-file parsing,
 * and source precedence.
 *
 * @module effort-vocabulary.impl.test
 */

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, describe, it } from "node:test"

import {
  EFFORT_LEVELS,
  findEffortMarker,
  isEffortLevel,
  parseStateFile,
  readSessionEffort,
  resolveEffort,
  sessionEffortPath,
} from "./lib/reasoning-effort.mjs"

const fixtures = []

after(() => {
  while (fixtures.length > 0) {
    rmSync(fixtures.pop(), { recursive: true, force: true })
  }
})

/**
 * Create a throwaway temp root.
 *
 * @returns {string} Absolute fixture base
 */
function makeBase() {
  const base = mkdtempSync(join(tmpdir(), "codeops-effort-impl-"))
  fixtures.push(base)
  return base
}

/**
 * Write a session state file.
 *
 * @param {string} base - Fixture temp root
 * @param {string} sessionID - Session identifier
 * @param {string} text - Raw file contents
 */
function writeState(base, sessionID, text) {
  const path = sessionEffortPath(sessionID, base)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text, "utf-8")
}

describe("vocabulary internals", () => {
  it("should freeze the exported level array", () => {
    assert.equal(Object.isFrozen(EFFORT_LEVELS), true)
    assert.deepEqual([...EFFORT_LEVELS], ["low", "medium", "high", "xhigh", "max"])
  })

  it("should reject non-string and unknown values", () => {
    for (const value of [null, undefined, 1, {}, [], "HIGH", "default"]) {
      assert.equal(isEffortLevel(value), false)
    }
  })

  it("should accept xhigh and keep the four original values", () => {
    for (const level of ["low", "medium", "high", "xhigh", "max"]) {
      assert.equal(isEffortLevel(level), true)
    }
  })
})

describe("marker internals", () => {
  it("should return the first valid marker and ignore later ones", () => {
    assert.equal(
      findEffortMarker(["prefix\n[codeops-effort: xhigh]\n[codeops-effort: low]"]),
      "xhigh"
    )
  })

  it("should ignore non-string entries and malformed lines", () => {
    assert.equal(findEffortMarker([null, 1, {}, "[codeops-effort: xhigh] extra"]), undefined)
  })
})

describe("state-file parsing", () => {
  it("should accept an xhigh state file", () => {
    assert.equal(parseStateFile('{"schema":1,"reasoning":"xhigh"}'), "xhigh")
  })

  it("should reject default and malformed state files", () => {
    assert.equal(parseStateFile('{"schema":1,"reasoning":"default"}'), undefined)
    assert.equal(parseStateFile('{"schema":2,"reasoning":"xhigh"}'), undefined)
    assert.equal(parseStateFile("not json"), undefined)
  })

  it("should read xhigh from a session directory", () => {
    const base = makeBase()
    writeState(base, "ses_xhigh", '{"schema":1,"reasoning":"xhigh"}')
    assert.equal(readSessionEffort("ses_xhigh", base), "xhigh")
  })
})

describe("resolution precedence", () => {
  it("should prefer marker over session and routing", () => {
    assert.equal(resolveEffort({ marker: "xhigh", session: "high", routing: "low" }), "xhigh")
  })

  it("should fall through to session and routing", () => {
    assert.equal(resolveEffort({ session: "xhigh", routing: "low" }), "xhigh")
    assert.equal(resolveEffort({ routing: "xhigh" }), "xhigh")
    assert.equal(resolveEffort({}), undefined)
  })
})
