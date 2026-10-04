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
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, describe, it } from "node:test"

import {
  appendEffortTrace,
  applyEffort,
  findEffortMarker,
  isEffortTraceEnabled,
  readRoutingReasoning,
  readSessionEffort,
  resolveEffort,
  selectEffortVariant,
  sessionEffortPath,
  sessionEffortTracePath,
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

describe("variant selection", () => {
  it("should choose the exact variant when exposed and the nearest otherwise", () => {
    const model = { variants: { low: {}, high: {}, max: {} } }
    assert.equal(selectEffortVariant("low", model), "low")
    assert.equal(selectEffortVariant("medium", model), "high")
    assert.equal(selectEffortVariant("xhigh", model), "max")
    assert.equal(selectEffortVariant("none", model), undefined)
    assert.equal(selectEffortVariant("extreme", model), undefined)
    assert.equal(selectEffortVariant("medium", null), undefined)
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

  it("should apply a matching variant even when the model does not flag reasoning support", () => {
    const options = { topP: 0.4 }
    const model = {
      capabilities: { reasoning: false },
      variants: { medium: { reasoningEffort: "medium" } },
    }
    assert.deepEqual(applyEffort(options, "medium", model), {
      topP: 0.4,
      reasoningEffort: "medium",
    })
  })

  it("should apply the nearest exposed variant when the requested level is missing", () => {
    const options = { topP: 0.8 }
    const model = {
      capabilities: { reasoning: true },
      variants: {
        low: { reasoningEffort: "low" },
        high: { reasoningEffort: "high" },
        max: { reasoningEffort: "max" },
      },
    }
    assert.deepEqual(applyEffort(options, "medium", model), {
      topP: 0.8,
      reasoningEffort: "high",
    })
  })

  it("should fall back by rank distance and round ties upward", () => {
    const options = { topP: 0.3 }
    const lowHighMax = {
      capabilities: { reasoning: true },
      variants: {
        low: { reasoningEffort: "low" },
        high: { reasoningEffort: "high" },
        max: { reasoningEffort: "max" },
      },
    }
    assert.deepEqual(applyEffort(options, "xhigh", lowHighMax), {
      topP: 0.3,
      reasoningEffort: "max",
    })
    assert.deepEqual(applyEffort(options, "minimal", lowHighMax), {
      topP: 0.3,
      reasoningEffort: "low",
    })

    const lowHigh = {
      capabilities: { reasoning: true },
      variants: {
        low: { reasoningEffort: "low" },
        high: { reasoningEffort: "high" },
      },
    }
    assert.deepEqual(applyEffort(options, "medium", lowHigh), {
      topP: 0.3,
      reasoningEffort: "high",
    })
  })

  it("should keep none exact-match only and ignore unusable variants", () => {
    const options = { topP: 0.2 }
    const lowHighMax = {
      capabilities: { reasoning: true },
      variants: {
        low: { reasoningEffort: "low" },
        high: { reasoningEffort: "high" },
        max: { reasoningEffort: "max" },
      },
    }
    assert.equal(applyEffort(options, "none", lowHighMax), options)

    const withNone = {
      capabilities: { reasoning: true },
      variants: {
        none: { reasoningEffort: "none" },
        high: { reasoningEffort: "high" },
      },
    }
    assert.deepEqual(applyEffort(options, "none", withNone), {
      topP: 0.2,
      reasoningEffort: "none",
    })

    const unusable = {
      capabilities: { reasoning: true },
      variants: { medium: "invalid" },
    }
    assert.equal(applyEffort(options, "high", unusable), options)
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
    const nearestOnly = { capabilities: { reasoning: true }, variants: { medium: {} } }
    const mapped = applyEffort(options, "xhigh", nearestOnly)
    assert.deepEqual(mapped, options)
    assert.notEqual(mapped, options)
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

describe("effort trace", () => {
  it("should enable tracing only for the documented environment values", () => {
    assert.equal(isEffortTraceEnabled("1"), true)
    assert.equal(isEffortTraceEnabled("true"), true)
    assert.equal(isEffortTraceEnabled("TRUE"), true)
    assert.equal(isEffortTraceEnabled("0"), false)
    assert.equal(isEffortTraceEnabled("false"), false)
    assert.equal(isEffortTraceEnabled(""), false)
    assert.equal(isEffortTraceEnabled(undefined), false)
    assert.equal(isEffortTraceEnabled(1), false)
  })

  it("should append one JSON line per entry inside the session trace file", () => {
    const base = makeBase()
    assert.equal(
      appendEffortTrace("ses_trace", { event: "capture", level: "low" }, base),
      true
    )
    assert.equal(
      appendEffortTrace("ses_trace", { event: "apply", level: "medium", applied: true }, base),
      true
    )

    const path = sessionEffortTracePath("ses_trace", base)
    assert.ok(path.endsWith(join("ses_trace", "reasoning-effort-trace.jsonl")))
    const lines = readFileSync(path, "utf-8").trim().split("\n")
    assert.equal(lines.length, 2)
    assert.equal(JSON.parse(lines[0]).event, "capture")
    assert.equal(JSON.parse(lines[0]).level, "low")
    assert.equal(JSON.parse(lines[1]).event, "apply")
    assert.equal(JSON.parse(lines[1]).applied, true)
  })

  it("should return false without throwing when the trace path cannot be written", () => {
    const base = makeBase()
    const blocked = dirname(sessionEffortTracePath("ses_blocked", base))
    mkdirSync(dirname(blocked), { recursive: true })
    writeFileSync(blocked, "not a directory", "utf-8")
    assert.equal(appendEffortTrace("ses_blocked", { event: "apply" }, base), false)
  })
})
