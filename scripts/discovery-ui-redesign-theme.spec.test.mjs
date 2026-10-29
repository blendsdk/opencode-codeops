/**
 * Specification tests for the Discovery theme preference.
 *
 * These cases pin the pure preference parser, the System/Light/Dark
 * resolution, and the browser-storage seam. Browser rendering and focus are
 * checked by the workspace suite and the live checklist.
 *
 * @module discovery-ui-redesign-theme.spec.test
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

/** A small in-memory storage double with configurable failures. */
function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    values,
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

describe("theme resolution (ST-7)", () => {
  it("should accept only the three documented preferences", () => {
    assert.equal(parseThemePreference("system"), "system")
    assert.equal(parseThemePreference("light"), "light")
    assert.equal(parseThemePreference("dark"), "dark")
    assert.equal(parseThemePreference("solarized"), "system")
    assert.equal(parseThemePreference(""), "system")
    assert.equal(parseThemePreference(null), "system")
    assert.equal(parseThemePreference(undefined), "system")
  })

  it("should follow the OS only in System mode", () => {
    assert.equal(resolveTheme("system", "light"), "light")
    assert.equal(resolveTheme("system", "dark"), "dark")
    assert.equal(resolveTheme("light", "dark"), "light")
    assert.equal(resolveTheme("dark", "light"), "dark")
  })
})

describe("theme storage (ST-8)", () => {
  it("should read the documented key and fall back safely", () => {
    const storage = fakeStorage({ "codeops.discovery.theme": "dark" })
    assert.equal(readThemePreference(storage), "dark")
    assert.equal(readThemePreference(fakeStorage({ "codeops.discovery.theme": "invalid" })), "system")
    assert.equal(readThemePreference(fakeStorage()), "system")
    assert.equal(readThemePreference(null), "system")
    assert.equal(
      readThemePreference({
        getItem() {
          throw new Error("blocked")
        },
      }),
      "system",
    )
  })

  it("should write only an allowed preference and report failure", () => {
    const storage = fakeStorage()
    assert.equal(writeThemePreference(storage, "dark"), true)
    assert.equal(storage.values.get(THEME_STORAGE_KEY), "dark")
    assert.equal(writeThemePreference(storage, "invalid"), true)
    assert.equal(storage.values.get(THEME_STORAGE_KEY), "system")

    const failing = {
      setItem() {
        throw new Error("blocked")
      },
    }
    assert.equal(writeThemePreference(failing, "light"), false)
  })
})

describe("theme reload (ST-9)", () => {
  it("should restore an explicit override after a reload", () => {
    const storage = fakeStorage()
    writeThemePreference(storage, "light")
    assert.equal(readThemePreference(storage), "light")
    assert.equal(resolveTheme(readThemePreference(storage), "dark"), "light")
  })

  it("should resume OS tracking when System is stored", () => {
    const storage = fakeStorage()
    writeThemePreference(storage, "system")
    assert.equal(resolveTheme(readThemePreference(storage), "dark"), "dark")
    assert.equal(resolveTheme(readThemePreference(storage), "light"), "light")
  })
})
