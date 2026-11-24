/**
 * Implementation tests for capability-line sanitization.
 *
 * Provider, model, and variant identifiers are untrusted host strings that
 * reach a prompt-bound system line. These cases pin the allowlist, the length
 * cap, and the one-line guarantee behind RD-03 FR-9 and ST-19.
 *
 * @module effort-capability.impl.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildEffortCapabilityLine,
  sanitizeEffortIdentifier,
} from "../bin/lib/reasoning-effort.mjs"

describe("identifier sanitization (ST-19)", () => {
  it("keeps the documented allowlist and strips everything else", () => {
    assert.equal(sanitizeEffortIdentifier("A-z0_9.:/-"), "A-z0_9.:/-")
    assert.equal(sanitizeEffortIdentifier("bad\nmodel]"), "badmodel")
    assert.equal(sanitizeEffortIdentifier("a b\tc;d"), "abcd")
  })

  it("caps overlong values and turns non-strings into an empty string", () => {
    assert.equal(sanitizeEffortIdentifier("x".repeat(100)).length, 64)
    for (const value of [null, undefined, 42, {}, []]) {
      assert.equal(sanitizeEffortIdentifier(value), "")
    }
  })
})

describe("capability line", () => {
  it("stays on one line and orders variants canonically", () => {
    const line = buildEffortCapabilityLine({
      providerID: "open\nai",
      modelID: "bad\nmodel]",
      variants: ["max", "bad\nkey", "low", "leading", "low"],
      contextLimit: 200000,
      requested: "high",
      applied: "xhigh",
      mapping: "alias",
    })

    assert.equal(
      line,
      "CodeOps effort: model=openai/badmodel; variants=low,max,badkey,leading; context=200000; requested=high; applied=xhigh; mapping=alias"
    )
    assert.equal(line.includes("\n"), false)
  })

  it("uses unavailable and fail-open for missing applied values", () => {
    const line = buildEffortCapabilityLine({
      providerID: "openai",
      modelID: "o1",
      variants: [],
      contextLimit: undefined,
      requested: "high",
      applied: undefined,
      mapping: "not-a-mapping",
    })

    assert.equal(
      line,
      "CodeOps effort: model=openai/o1; variants=none; context=unknown; requested=high; applied=unavailable; mapping=fail-open"
    )
  })

  it("falls back to unknown when an identifier sanitizes to nothing", () => {
    const line = buildEffortCapabilityLine({
      providerID: "\n\t",
      modelID: "]",
      variants: [" ", "]]"],
      contextLimit: 1.5,
      requested: "high",
      applied: "high",
      mapping: "exact",
    })

    assert.equal(
      line,
      "CodeOps effort: model=unknown/unknown; variants=none; context=unknown; requested=high; applied=high; mapping=exact"
    )
  })

  it("caps every identifier and keeps the line bounded", () => {
    const line = buildEffortCapabilityLine({
      providerID: "p".repeat(100),
      modelID: "m".repeat(100),
      variants: ["v".repeat(100)],
      contextLimit: -1,
      requested: "x".repeat(100),
      applied: "a".repeat(100),
      mapping: "exact",
    })

    assert.equal(line.includes("\n"), false)
    assert.match(line, /context=unknown/)
    assert.equal(line.includes("p".repeat(64)), true)
    assert.equal(line.includes("p".repeat(65)), false)
    assert.equal(line.includes("m".repeat(65)), false)
    assert.equal(line.includes("v".repeat(65)), false)
    assert.ok(line.length < 500, "the line must stay bounded")
  })
})
