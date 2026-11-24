/**
 * Implementation tests for verified provider resolution.
 *
 * These cover the edge cases behind the specification: the removed raw
 * passthrough, the distance rule, malformed entries next to valid ones, and
 * resolver purity. They are not the specification oracle; a failure here means
 * an internal rule regressed.
 *
 * @module effort-provider.impl.test
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

describe("no raw passthrough (ST-16)", () => {
  it("leaves options unchanged for a reasoning-capable model without variants", () => {
    const options = { topP: 0.8 }

    assert.equal(
      applyEffort(options, "xhigh", { capabilities: { reasoning: true } }),
      options,
      "a capability flag alone must not send reasoningEffort"
    )
    assert.equal(selectEffortVariant("xhigh", { capabilities: { reasoning: true } }), undefined)
  })

  it("leaves options unchanged for null, missing, and malformed model values", () => {
    const options = { topP: 0.8 }
    for (const model of [null, undefined, {}, { variants: "high" }, { variants: [] }]) {
      assert.equal(applyEffort(options, "high", model), options)
    }
  })
})

describe("distance rule", () => {
  it("uses the nearest exposed level when the step is one", () => {
    const fixture = { providerID: "openai", variants: variants("low", "max") }

    assert.deepEqual(resolveEffortVariant("medium", fixture), {
      variant: "low",
      mapping: "nearest",
    })
  })

  it("fails open when both sides are more than one step away", () => {
    const fixture = { providerID: "openai", variants: variants("low", "max") }

    assert.deepEqual(resolveEffortVariant("high", fixture), {
      variant: undefined,
      mapping: "fail-open",
    })
  })

  it("resolves equal distances to the higher level", () => {
    const fixture = { providerID: "openai", variants: variants("low", "high") }

    assert.deepEqual(resolveEffortVariant("medium", fixture), {
      variant: "high",
      mapping: "nearest",
    })
  })

  it("keeps an explicit max request exact", () => {
    const fixture = { providerID: "openai", variants: variants("max") }

    assert.deepEqual(resolveEffortVariant("max", fixture), {
      variant: "max",
      mapping: "exact",
    })
  })
})

describe("malformed siblings", () => {
  it("ignores an unusable exact entry and falls to the nearest valid one", () => {
    const fixture = {
      providerID: "openai",
      variants: { high: "invalid", medium: { reasoningEffort: "medium" } },
    }

    assert.deepEqual(resolveEffortVariant("high", fixture), {
      variant: "medium",
      mapping: "nearest",
    })
  })
})

describe("requested values", () => {
  it("fails open for routing-only and unknown values", () => {
    const fixture = { providerID: "openai", variants: variants("low", "high") }

    for (const level of ["default", "extreme", "HIGH", "", null]) {
      assert.deepEqual(resolveEffortVariant(level, fixture), {
        variant: undefined,
        mapping: "fail-open",
      })
    }
  })

  it("applies an exact none variant when the model exposes one", () => {
    const fixture = { providerID: "openai", variants: variants("none", "high") }

    assert.deepEqual(resolveEffortVariant("none", fixture), {
      variant: "none",
      mapping: "exact",
    })
    assert.deepEqual(applyEffort({ topP: 0.8 }, "none", fixture), {
      topP: 0.8,
      reasoningEffort: "none",
    })
  })
})

describe("purity", () => {
  it("does not mutate the input options or merge into a shared object", () => {
    const options = { topP: 0.8, nested: { a: 1 } }
    const fixture = { providerID: "openai", variants: { high: { nested: { b: 2 } } } }

    const applied = applyEffort(options, "high", fixture)

    assert.notEqual(applied, options)
    assert.deepEqual(options, { topP: 0.8, nested: { a: 1 } })
    assert.deepEqual(applied, { topP: 0.8, nested: { a: 1, b: 2 } })
  })
})
