/**
 * Specification tests for verified provider resolution.
 *
 * These cases are the oracle for the small verified provider table and the
 * resolution rules: runtime variants are authoritative, an exact canonical
 * match wins, the table supplies only aliases, and anything unverifiable
 * fails open instead of over-powering the request. A failure here means the
 * implementation does not satisfy the contract — never that the test is
 * wrong.
 *
 * @module effort-provider.spec.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  applyEffort,
  resolveEffortVariant,
  selectEffortVariant,
} from "./lib/reasoning-effort.mjs"

/**
 * Build a variant record whose entries carry a provider-style option.
 *
 * @param ids - Variant ids exposed by the fixture model
 * @returns A record mapping each id to an option object
 */
function variants(...ids) {
  const record = {}
  for (const id of ids) record[id] = { reasoningEffort: id }
  return record
}

/**
 * Build a fixture model.
 *
 * @param providerID - Provider that owns the model
 * @param ids - Variant ids the model exposes
 * @returns A model object shaped like the resolver input
 */
function model(providerID, ...ids) {
  return { providerID, variants: variants(...ids) }
}

describe("OpenAI identity (ST-7)", () => {
  it("applies each canonical level unchanged when the model exposes it", () => {
    const fixture = model("openai", "low", "medium", "high", "xhigh", "max")

    for (const level of ["low", "medium", "high", "xhigh", "max"]) {
      assert.deepEqual(
        resolveEffortVariant(level, fixture),
        { variant: level, mapping: "exact" },
        `${level} must resolve exactly`
      )
      assert.deepEqual(applyEffort({ topP: 0.8 }, level, fixture), {
        topP: 0.8,
        reasoningEffort: level,
      })
    }
  })
})

describe("Anthropic identity (ST-8)", () => {
  it("applies each canonical level unchanged when the model exposes it", () => {
    const fixture = model("anthropic", "low", "medium", "high", "xhigh", "max")

    for (const level of ["low", "medium", "high", "xhigh", "max"]) {
      assert.deepEqual(resolveEffortVariant(level, fixture), {
        variant: level,
        mapping: "exact",
      })
    }
  })
})

describe("DeepSeek aliases (ST-9)", () => {
  it("maps medium to high, xhigh to max, and none only exactly", () => {
    const fixture = model("deepseek", "low", "high", "max")

    assert.deepEqual(resolveEffortVariant("medium", fixture), {
      variant: "high",
      mapping: "alias",
    })
    assert.deepEqual(resolveEffortVariant("xhigh", fixture), {
      variant: "max",
      mapping: "alias",
    })
    assert.deepEqual(resolveEffortVariant("none", fixture), {
      variant: undefined,
      mapping: "fail-open",
    })
    assert.deepEqual(applyEffort({ topP: 0.8 }, "none", fixture), { topP: 0.8 })
  })
})

describe("DeepSeek exact match wins (ST-10)", () => {
  it("keeps medium exact and still maps xhigh to max", () => {
    const fixture = model("deepseek", "low", "medium", "high", "max")

    assert.deepEqual(resolveEffortVariant("medium", fixture), {
      variant: "medium",
      mapping: "exact",
    })
    assert.deepEqual(resolveEffortVariant("xhigh", fixture), {
      variant: "max",
      mapping: "alias",
    })
  })
})

describe("partial-set max guard (ST-11)", () => {
  it("fails open when the only nearest step up is max", () => {
    const fixture = model("openai", "low", "high", "max")
    const options = { topP: 0.8 }

    assert.deepEqual(resolveEffortVariant("xhigh", fixture), {
      variant: undefined,
      mapping: "fail-open",
    })
    assert.equal(applyEffort(options, "xhigh", fixture), options)
  })
})

describe("only-max guard (ST-12)", () => {
  it("never turns a low request into max", () => {
    const fixture = model("openai", "max")
    const options = { topP: 0.8 }

    assert.deepEqual(resolveEffortVariant("low", fixture), {
      variant: undefined,
      mapping: "fail-open",
    })
    assert.equal(applyEffort(options, "low", fixture), options)
  })
})

describe("unknown provider names (ST-13)", () => {
  it("fails open when no canonical variant is exposed", () => {
    const fixture = model("gateway", "fast", "balanced", "deep")

    assert.deepEqual(resolveEffortVariant("high", fixture), {
      variant: undefined,
      mapping: "fail-open",
    })
  })
})

describe("malformed variants (ST-14)", () => {
  it("ignores a variant whose settings are not an object", () => {
    const fixture = { providerID: "openai", variants: { high: "invalid" } }

    assert.deepEqual(resolveEffortVariant("high", fixture), {
      variant: undefined,
      mapping: "fail-open",
    })
    assert.deepEqual(applyEffort({ topP: 0.8 }, "high", fixture), { topP: 0.8 })
  })
})

describe("none unavailable (ST-15)", () => {
  it("leaves the request unchanged and never invents a reasoning level", () => {
    const fixture = model("openai", "low", "medium", "high", "xhigh", "max")
    const options = { topP: 0.8 }

    assert.deepEqual(resolveEffortVariant("none", fixture), {
      variant: undefined,
      mapping: "fail-open",
    })
    assert.equal(applyEffort(options, "none", fixture), options)
  })
})

describe("variant key compatibility", () => {
  it("keeps selectEffortVariant as the variant-key view of the resolver", () => {
    const fixture = model("deepseek", "low", "high", "max")

    assert.equal(selectEffortVariant("medium", fixture), "high")
    assert.equal(selectEffortVariant("low", fixture), "low")
    assert.equal(selectEffortVariant("none", fixture), undefined)
  })
})
