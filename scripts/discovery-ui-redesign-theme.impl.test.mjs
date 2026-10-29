/**
 * Implementation tests for the Discovery theme preference.
 *
 * These cases cover malformed values, blocked storage, and the exact storage
 * key. They may change with the implementation; the specification tests may
 * not.
 *
 * @module discovery-ui-redesign-theme.impl.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  THEME_STORAGE_KEY,
  parseThemePreference,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
} from "../discovery-ui/src/theme.ts"

/** A storage double that records its calls. */
function recordingStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  const calls = []
  return {
    values,
    calls,
    getItem(key) {
      calls.push(["get", key])
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      calls.push(["set", key, value])
      values.set(key, value)
    },
  }
}

describe("theme parsing edges", () => {
  it("should be case-sensitive and reject legacy values", () => {
    assert.equal(parseThemePreference("Dark"), "system")
    assert.equal(parseThemePreference("DARK"), "system")
    assert.equal(parseThemePreference("auto"), "system")
    assert.equal(parseThemePreference(42), "system")
    assert.equal(parseThemePreference({ theme: "dark" }), "system")
  })

  it("should keep the documented storage key stable", () => {
    assert.equal(THEME_STORAGE_KEY, "codeops.discovery.theme")
  })
})

describe("storage seam edges", () => {
  it("should read exactly once and never touch an unavailable storage", () => {
    const storage = recordingStorage({ "codeops.discovery.theme": "light" })
    assert.equal(readThemePreference(storage), "light")
    assert.deepEqual(storage.calls, [["get", "codeops.discovery.theme"]])
    assert.equal(readThemePreference(null), "system")
    assert.equal(readThemePreference(undefined), "system")
  })

  it("should write one normalized value and report unavailable storage", () => {
    const storage = recordingStorage()
    assert.equal(writeThemePreference(storage, "DARK"), true)
    assert.deepEqual(storage.calls, [["set", "codeops.discovery.theme", "system"]])
    assert.equal(writeThemePreference(null, "dark"), false)
    assert.equal(writeThemePreference(undefined, "dark"), false)
  })

  it("should keep working when setItem throws after a successful read", () => {
    const storage = {
      getItem() {
        return "dark"
      },
      setItem() {
        throw new Error("blocked")
      },
    }
    assert.equal(readThemePreference(storage), "dark")
    assert.equal(writeThemePreference(storage, "light"), false)
  })
})

describe("resolution edges", () => {
  it("should fall back to the OS theme for an unknown runtime preference", () => {
    assert.equal(resolveTheme("auto", "dark"), "dark")
    assert.equal(resolveTheme("auto", "light"), "light")
  })
})
