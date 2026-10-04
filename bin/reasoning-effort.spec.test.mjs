/**
 * Specification tests for adaptive reasoning effort.
 *
 * These cases pin the observable behavior of the reasoning-effort helper
 * module before it exists: marker scanning, source precedence, routing config
 * lookup, provider-option application, and session state-file reading. They
 * are written from the contract documents only, so a failure here means the
 * implementation does not satisfy the specification — never that the test is
 * wrong.
 *
 * Every case runs against a throwaway base directory, never the real system
 * temp directory.
 *
 * @module reasoning-effort.spec.test
 */

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, describe, it } from "node:test"

import {
  applyEffort,
  findEffortMarker,
  readRoutingReasoning,
  readSessionEffort,
  resolveEffort,
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
  const dir = mkdtempSync(join(tmpdir(), "codeops-effort-spec-"))
  created.push(dir)
  return dir
}

/**
 * Write a session state file for a session identifier.
 *
 * @param {string} base - Throwaway temp root
 * @param {string} sessionID - Session identifier
 * @param {object|string} payload - JSON payload object or raw text
 * @returns Absolute path to the written file
 */
function writeState(base, sessionID, payload) {
  const path = sessionEffortPath(sessionID, base)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, typeof payload === "string" ? payload : JSON.stringify(payload), "utf-8")
  return path
}

after(() => {
  while (created.length > 0) {
    rmSync(created.pop(), { recursive: true, force: true })
  }
})

describe("marker parsing", () => {
  it("should return the level for a single standalone marker line", () => {
    assert.equal(findEffortMarker(["[codeops-effort: medium]"]), "medium")
  })

  it("should accept surrounding spaces and tabs around the marker", () => {
    assert.equal(findEffortMarker(["\t  [codeops-effort:   high]  "]), "high")
  })

  it("should return the first valid marker when several are present", () => {
    assert.equal(
      findEffortMarker(["first\n[codeops-effort: low]\n[codeops-effort: max]"]),
      "low"
    )
  })

  it("should ignore malformed or unknown markers", () => {
    const malformed = [
      "[codeops-effort: HIGH]",
      "[codeops-effort: none]",
      "[codeops-effort: max] extra",
      "x [codeops-effort: low]",
    ]
    for (const text of malformed) {
      assert.equal(findEffortMarker([text]), undefined, `must ignore: ${text}`)
    }
  })

  it("should scan text parts and skip non-string entries without throwing", () => {
    assert.equal(
      findEffortMarker([null, 42, { type: "tool" }, "[codeops-effort: medium]"]),
      "medium"
    )
    assert.equal(findEffortMarker([]), undefined)
    assert.equal(findEffortMarker([null, 42]), undefined)
  })
})

describe("effort resolution and precedence", () => {
  it("should prefer a dispatch marker over session and routing sources", () => {
    assert.equal(
      resolveEffort({ marker: "medium", session: "high", routing: "low" }),
      "medium"
    )
  })

  it("should use the session level when no marker exists", () => {
    assert.equal(resolveEffort({ session: "high", routing: "low" }), "high")
  })

  it("should use the routing level when no marker or session level exists", () => {
    assert.equal(resolveEffort({ routing: "low" }), "low")
  })

  it("should return undefined when every source is missing or invalid", () => {
    assert.equal(resolveEffort({}), undefined)
    assert.equal(resolveEffort({ marker: "extreme" }), undefined)
    assert.equal(resolveEffort({ session: 42 }), undefined)
    assert.equal(resolveEffort({ routing: "bogus" }), undefined)
  })

  it("should pass provider-native routing levels through for runtime validation", () => {
    assert.equal(resolveEffort({ routing: "xhigh" }), "xhigh")
  })
})

describe("routing config lookup", () => {
  it("should read an explicit role reasoning entry", () => {
    const config = { routing: { roles: { executor: { reasoning: "high" } } } }
    assert.equal(readRoutingReasoning(config, "executor"), "high")
  })

  it("should return undefined for unknown agents and malformed configs", () => {
    assert.equal(readRoutingReasoning({}, "executor"), undefined)
    assert.equal(readRoutingReasoning(null, "executor"), undefined)
    assert.equal(readRoutingReasoning([], "executor"), undefined)
    assert.equal(readRoutingReasoning("nope", "executor"), undefined)
    const other = { routing: { roles: { other: { reasoning: "high" } } } }
    assert.equal(readRoutingReasoning(other, "executor"), undefined)
    const bogus = { routing: { roles: { executor: { reasoning: "bogus" } } } }
    assert.equal(readRoutingReasoning(bogus, "executor"), undefined)
  })
})

describe("provider option application", () => {
  it("should merge the model variant options for the requested level", () => {
    const model = {
      capabilities: { reasoning: true },
      variants: { medium: { reasoningEffort: "medium" } },
    }
    assert.deepEqual(applyEffort({ topP: 0.8 }, "medium", model), {
      topP: 0.8,
      reasoningEffort: "medium",
    })
  })

  it("should return the original options when the model lacks the requested variant", () => {
    const options = { topP: 0.8 }
    const model = {
      capabilities: { reasoning: true },
      variants: { medium: { reasoningEffort: "medium" } },
    }
    assert.equal(applyEffort(options, "high", model), options)
  })

  it("should return the original options when the model does not support reasoning", () => {
    const options = { topP: 0.8 }
    assert.equal(applyEffort(options, "low", { capabilities: { reasoning: false } }), options)
  })

  it("should ignore a level outside the known set before touching provider options", () => {
    const options = { topP: 0.8 }
    const model = {
      capabilities: { reasoning: true },
      variants: { extreme: { reasoningEffort: "extreme" } },
    }
    assert.equal(applyEffort(options, "extreme", model), options)
  })

  it("should add the documented passthrough key when no variants record exists", () => {
    const options = { topP: 0.8 }
    const applied = applyEffort(options, "low", { capabilities: { reasoning: true } })
    assert.notEqual(applied, options)
    assert.equal(applied.reasoningEffort, "low")
    assert.equal(applied.topP, 0.8)
    assert.deepEqual(options, { topP: 0.8 })
  })

  it("should merge nested variant options without losing sibling keys", () => {
    const options = { reasoning: { effort: "high" }, topP: 0.9 }
    const model = {
      capabilities: { reasoning: true },
      variants: { max: { reasoning: { effort: "max" } } },
    }
    assert.deepEqual(applyEffort(options, "max", model), {
      reasoning: { effort: "max" },
      topP: 0.9,
    })
    assert.deepEqual(options, { reasoning: { effort: "high" }, topP: 0.9 })
  })

  it("should apply a provider-native routing level when the model exposes that variant", () => {
    const options = { topP: 0.5 }
    const model = {
      capabilities: { reasoning: true },
      variants: { xhigh: { reasoningEffort: "xhigh" } },
    }
    assert.deepEqual(applyEffort(options, "xhigh", model), {
      topP: 0.5,
      reasoningEffort: "xhigh",
    })
    const withoutVariant = { capabilities: { reasoning: true }, variants: { medium: {} } }
    assert.equal(applyEffort(options, "xhigh", withoutVariant), options)
  })
})

describe("session state file", () => {
  it("should read a valid session effort file", () => {
    const base = makeBase()
    writeState(base, "ses_valid", {
      schema: 1,
      reasoning: "high",
      setAt: "2026-10-04T12:30:00Z",
    })
    assert.equal(readSessionEffort("ses_valid", base), "high")
  })

  it("should derive the state path inside the session directory", () => {
    const base = makeBase()
    assert.ok(
      sessionEffortPath("ses_path", base).endsWith(
        join("opencode", "codeops", "ses_path", "reasoning-effort.json")
      )
    )
  })

  it("should return undefined for missing or malformed state files", () => {
    const base = makeBase()
    assert.equal(readSessionEffort("ses_missing", base), undefined)

    writeState(base, "ses_bad_json", "{this is not json")
    assert.equal(readSessionEffort("ses_bad_json", base), undefined)

    writeState(base, "ses_bad_schema", { schema: 2, reasoning: "high" })
    assert.equal(readSessionEffort("ses_bad_schema", base), undefined)

    writeState(base, "ses_bad_level", { schema: 1, reasoning: "extreme" })
    assert.equal(readSessionEffort("ses_bad_level", base), undefined)
  })
})
