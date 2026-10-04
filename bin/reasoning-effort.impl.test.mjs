/**
 * Implementation tests for the adaptive reasoning-effort helper.
 *
 * These cases exercise internal edges that the specification tests do not
 * cover: merge safety, hostile shapes, line-ending handling, prototype
 * pollution resistance, and the exact state-file rejection rules. They are
 * derived from the implementation and run against a throwaway base directory,
 * never the real system temp directory.
 *
 * @module reasoning-effort.impl.test
 */

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, describe, it } from "node:test"

import {
  applyEffort,
  deepMergePlain,
  extractModelVariants,
  findEffortMarker,
  modelSupportsReasoning,
  parseStateFile,
  readSessionEffort,
  sessionEffortPath,
} from "./lib/reasoning-effort.mjs"

/** Throwaway base directories created by the tests, removed afterward. */
const created = []

/**
 * Create a throwaway base directory that stands in for the system temp root.
 *
 * @returns Absolute path to the new directory
 */
function makeBase() {
  const dir = mkdtempSync(join(tmpdir(), "codeops-effort-impl-"))
  created.push(dir)
  return dir
}

/**
 * Create the session directory for a state-file fixture.
 *
 * @param {string} base - Throwaway temp root
 * @param {string} sessionID - Session identifier
 * @returns Absolute path to the state-file location
 */
function statePath(base, sessionID) {
  const path = sessionEffortPath(sessionID, base)
  mkdirSync(dirname(path), { recursive: true })
  return path
}

after(() => {
  while (created.length > 0) {
    rmSync(created.pop(), { recursive: true, force: true })
  }
})

describe("deepMergePlain", () => {
  it("replaces arrays instead of merging them element by element", () => {
    assert.deepEqual(deepMergePlain({ list: [1, 2] }, { list: [3] }), { list: [3] })
  })

  it("keeps an own undefined value instead of dropping the key", () => {
    const result = deepMergePlain({ a: 1 }, { b: undefined })
    assert.equal(Object.prototype.hasOwnProperty.call(result, "b"), true)
    assert.equal(result.b, undefined)
    assert.equal(result.a, 1)
  })

  it("merges three nested levels without losing sibling keys", () => {
    const result = deepMergePlain(
      { a: { b: { c: 1, d: 2 } } },
      { a: { b: { c: 9 } } }
    )
    assert.deepEqual(result, { a: { b: { c: 9, d: 2 } } })
  })

  it("handles empty objects on either side", () => {
    assert.deepEqual(deepMergePlain({}, {}), {})
    assert.deepEqual(deepMergePlain({ a: 1 }, {}), { a: 1 })
    assert.deepEqual(deepMergePlain({}, { a: 1 }), { a: 1 })
  })

  it("lets a colliding source value win", () => {
    assert.deepEqual(deepMergePlain({ a: 1, b: 1 }, { b: 2 }), { a: 1, b: 2 })
  })

  it("does not mutate either input", () => {
    const target = { a: { b: 1 }, list: [1] }
    const source = { a: { c: 2 }, list: [2] }
    deepMergePlain(target, source)
    assert.deepEqual(target, { a: { b: 1 }, list: [1] })
    assert.deepEqual(source, { a: { c: 2 }, list: [2] })
  })

  it("never pollutes Object.prototype through a __proto__ key", () => {
    const hostile = JSON.parse('{"__proto__":{"polluted":true}}')
    const result = deepMergePlain({ safe: 1 }, hostile)
    assert.equal({}.polluted, undefined, "the global prototype must stay clean")
    assert.equal(Object.getPrototypeOf(result), Object.prototype)
    assert.equal(result.safe, 1)
  })

  it("returns a copy of the target when the source is not a plain object", () => {
    assert.deepEqual(deepMergePlain({ a: 1 }, [1, 2]), { a: 1 })
    assert.deepEqual(deepMergePlain({ a: 1 }, null), { a: 1 })
  })
})

describe("findEffortMarker line handling", () => {
  it("accepts LF, CRLF, and CR line endings", () => {
    assert.equal(findEffortMarker(["a\n[codeops-effort: high]\nb"]), "high")
    assert.equal(findEffortMarker(["a\r\n[codeops-effort: high]\r\nb"]), "high")
    assert.equal(findEffortMarker(["a\r[codeops-effort: low]\rb"]), "low")
  })

  it("finds a marker after very long text", () => {
    const long = `${"x".repeat(200_000)}\n[codeops-effort: max]`
    assert.equal(findEffortMarker([long]), "max")
  })

  it("returns the first match across multiple text parts", () => {
    assert.equal(
      findEffortMarker(["[codeops-effort: low]", "[codeops-effort: max]"]),
      "low"
    )
  })

  it("returns undefined for empty and whitespace-only input", () => {
    assert.equal(findEffortMarker([""]), undefined)
    assert.equal(findEffortMarker(["   \n\t "]), undefined)
    assert.equal(findEffortMarker([]), undefined)
    assert.equal(findEffortMarker(undefined), undefined)
    assert.equal(findEffortMarker("not-a-list"), undefined)
  })
})

describe("hostile model shapes", () => {
  it("returns undefined or false for non-object models without throwing", () => {
    for (const model of [null, undefined, 42, "model", [], () => {}]) {
      assert.equal(extractModelVariants(model), undefined)
      assert.equal(modelSupportsReasoning(model), false)
    }
    assert.equal(extractModelVariants({ variants: null }), undefined)
    assert.equal(extractModelVariants({ variants: [] }), undefined)
    assert.equal(modelSupportsReasoning({ capabilities: null }), false)
    assert.equal(modelSupportsReasoning({ capabilities: { reasoning: "true" } }), false)
    assert.equal(modelSupportsReasoning({ capabilities: { reasoning: true } }), true)
  })

  it("tolerates hostile prototype-shaped keys in the model", () => {
    const model = JSON.parse(
      '{"capabilities":{"reasoning":true},"variants":{"__proto__":{"polluted":true}}}'
    )
    const variants = extractModelVariants(model)
    assert.equal(typeof variants, "object")
    assert.equal({}.polluted, undefined, "the global prototype must stay clean")
    assert.equal(modelSupportsReasoning(model), true)
  })
})

describe("readSessionEffort rejection rules", () => {
  it("returns undefined when the state path is a directory", () => {
    const base = makeBase()
    mkdirSync(statePath(base, "ses_dir"), { recursive: true })
    assert.equal(readSessionEffort("ses_dir", base), undefined)
  })

  it("returns undefined for a file larger than the size cap", () => {
    const base = makeBase()
    const path = statePath(base, "ses_big")
    writeFileSync(
      path,
      JSON.stringify({ schema: 1, reasoning: "high", pad: "x".repeat(5000) }),
      "utf-8"
    )
    assert.equal(readSessionEffort("ses_big", base), undefined)
  })

  it("never follows a symlinked state file", () => {
    const base = makeBase()
    const outside = makeBase()
    const target = join(outside, "real.json")
    writeFileSync(target, JSON.stringify({ schema: 1, reasoning: "max" }), "utf-8")
    symlinkSync(target, statePath(base, "ses_link"))
    assert.equal(readSessionEffort("ses_link", base), undefined)
    assert.equal(
      JSON.parse(readFileSync(target, "utf-8")).reasoning,
      "max",
      "the symlink target must stay untouched"
    )
  })
})

describe("parseStateFile shape checks", () => {
  it("rejects non-object, wrong-schema, and non-string level payloads", () => {
    assert.equal(parseStateFile("null"), undefined)
    assert.equal(parseStateFile("[]"), undefined)
    assert.equal(parseStateFile('"high"'), undefined)
    assert.equal(parseStateFile('{"schema":"1","reasoning":"high"}'), undefined)
    assert.equal(parseStateFile('{"schema":1,"reasoning":42}'), undefined)
    assert.equal(parseStateFile('{"schema":1,"reasoning":"max"}'), "max")
  })
})

describe("applyEffort reference behavior", () => {
  it("returns the identical options object whenever nothing applies", () => {
    const options = { topP: 0.5 }
    assert.equal(applyEffort(options, "extreme", { capabilities: { reasoning: true } }), options)
    assert.equal(applyEffort(options, "high", { capabilities: { reasoning: false } }), options)
    assert.equal(
      applyEffort(options, "high", {
        capabilities: { reasoning: true },
        variants: { low: { reasoningEffort: "low" } },
      }),
      options
    )
  })

  it("returns a new object when a variant applies", () => {
    const options = { topP: 0.5 }
    const model = {
      capabilities: { reasoning: true },
      variants: { high: { reasoningEffort: "high" } },
    }
    const applied = applyEffort(options, "high", model)
    assert.notEqual(applied, options)
    assert.deepEqual(applied, { topP: 0.5, reasoningEffort: "high" })
  })
})
