/**
 * Implementation tests for map loading, validation, and health checks.
 *
 * These cover edge cases and internals that the specification tests do not
 * need to pin: fixture loading, layout ambiguity, unreadable maps, severity to
 * exit-code mapping, and the tracked-file classification rules.
 *
 * @module test-map.impl.test
 */

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"

import {
  MapLoadError,
  canonicalMap,
  hashMap,
  loadMap,
  normalizePolicy,
} from "./lib/test-map.mjs"
import { exitCodeFor, validateMap } from "./lib/test-map-validate.mjs"

const FIXTURES = new URL("./fixtures/test-selection/", import.meta.url).pathname
const roots = []

/** Create an isolated temporary repository root. */
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "codeops-map-impl-"))
  roots.push(root)
  return root
}

/** Write a JSON file, creating parent directories. */
function writeJson(root, relativePath, value) {
  const absolute = join(root, relativePath)
  mkdirSync(join(absolute, ".."), { recursive: true })
  writeFileSync(absolute, JSON.stringify(value, null, 2))
}

/** Read a fixture as parsed JSON. */
function fixture(relativePath) {
  return JSON.parse(readFileSync(join(FIXTURES, relativePath), "utf8"))
}

/** Build a minimal valid map around one group. */
function mapWith(group, extraPolicy = {}) {
  return {
    schema: 1,
    policy: normalizePolicy({ schema: 1, full: ["npm", "run", "verify"], ...extraPolicy }),
    groups: [group],
  }
}

/** A minimal file-based group. */
function group(extra = {}) {
  return {
    id: "billing.unit",
    slice: "billing",
    tier: "task",
    sources: ["web/billing/**"],
    tests: ["web/billing/**/*.test.ts"],
    run: { command: ["node", "--test", "{tests}"] },
    ...extra,
  }
}

/** Return all diagnostic codes in a report. */
function codes(report) {
  return [...report.errors, ...report.warnings].map((item) => item.code)
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true })
})

describe("fixtures", () => {
  it("loads and validates the Node single-file fixture", () => {
    const data = fixture("node/single-map.json")
    const map = { schema: data.schema, policy: normalizePolicy(data.policy), groups: data.groups }
    const report = validateMap(map, {
      files: [
        "web/billing/invoice-dialog/dialog.test.ts",
        "api/billing/invoice/handler.test.ts",
        "tests/e2e/billing/invoice-dialog/flow.spec.ts",
        "shared/auth/auth.test.ts",
      ],
    })
    assert.deepEqual(report.errors, [])
  })

  it("exempts the Rust target-based fixture from file ownership", () => {
    const data = fixture("rust/target-map.json")
    const map = { schema: data.schema, policy: normalizePolicy(data.policy), groups: data.groups }
    const report = validateMap(map, { files: [] })
    assert.ok(!codes(report).includes("map.empty-group"))
    assert.ok(!codes(report).includes("map.group"))
  })

  it("loads the custom-command fixture", () => {
    const data = fixture("custom/custom-map.json")
    const map = { schema: data.schema, policy: normalizePolicy(data.policy), groups: data.groups }
    const report = validateMap(map, { files: ["pipelines/build/step.check", "pipelines/build/accept.accept"] })
    assert.deepEqual(report.errors, [])
  })

  it("loads the polyglot directory with shared first", () => {
    const root = makeRoot()
    for (const name of ["policy.json", "shared.json", "node.json", "rust.json"]) {
      writeJson(root, `codeops/test-map/${name}`, fixture(`polyglot/${name}`))
    }
    const loaded = loadMap({ root })
    assert.equal(loaded.mode, "map")
    assert.deepEqual(loaded.map.fragments, ["shared.json", "node.json", "rust.json"])
    assert.ok(loaded.map.groups.some((entry) => entry.id === "codegen.unit"))
    assert.equal(
      validateMap(loaded.map, {
        files: [
          "shared/auth/auth.test.ts",
          "web/billing/dialog.test.ts",
          "tests/e2e/billing/flow.spec.ts",
          "tests/corpus/sample.rs",
        ],
      }).errors.length,
      0,
    )
  })
})

describe("loader errors", () => {
  it("warns when both layouts exist and picks the single file", () => {
    const root = makeRoot()
    writeJson(root, "codeops/test-map.json", fixture("node/single-map.json"))
    writeJson(root, "codeops/test-map/policy.json", fixture("polyglot/policy.json"))
    const loaded = loadMap({ root })
    assert.equal(loaded.mode, "map")
    assert.equal(loaded.map.layout, "single")
    assert.equal(loaded.warnings.length, 1)
  })

  it("reports a missing directory policy with map.policy", () => {
    const root = makeRoot()
    mkdirSync(join(root, "codeops", "test-map"), { recursive: true })
    assert.throws(() => loadMap({ root }), (error) => error instanceof MapLoadError && error.code === "map.policy")
  })

  it("reports invalid JSON with map.parse", () => {
    const root = makeRoot()
    mkdirSync(join(root, "codeops"), { recursive: true })
    writeFileSync(join(root, "codeops", "test-map.json"), "{ nope")
    assert.throws(() => loadMap({ root }), (error) => error instanceof MapLoadError && error.code === "map.parse")
  })

  it("reports a missing explicit map path as no map", () => {
    const root = makeRoot()
    assert.deepEqual(loadMap({ root, mapPath: "missing/map.json" }), { mode: "no-map" })
  })
})

describe("invalid fixtures", () => {
  for (const [name, code] of [
    ["invalid/duplicate-id.json", "map.duplicate-id"],
    ["invalid/cycle.json", "map.cycle"],
    ["invalid/unsafe-path.json", "map.path"],
    ["invalid/full-string.json", "map.full"],
  ]) {
    it(`${name} reports ${code}`, () => {
      const data = fixture(name)
      const map = {
        schema: data.schema,
        policy: normalizePolicy(data.policy),
        groups: data.groups,
      }
      assert.ok(codes(validateMap(map)).includes(code))
    })
  }
})

describe("health classification", () => {
  it("reports an orphan test under a tracked test root", () => {
    const report = validateMap(mapWith(group()), { files: ["tests/legacy/old.test.ts"] })
    assert.ok(codes(report).includes("map.orphan-test"))
  })

  it("reports an unknown source", () => {
    const report = validateMap(mapWith(group()), {
      files: ["web/billing/dialog.test.ts", "src/unmapped/module.ts"],
    })
    assert.ok(codes(report).includes("map.unknown-source"))
  })

  it("accepts a full-on path and an ignored path", () => {
    const report = validateMap(
      mapWith(group(), {
        fullOnPaths: ["package.json"],
        ignorePaths: [{ glob: "docs/**", reason: "documentation" }],
      }),
      { files: ["web/billing/dialog.test.ts", "package.json", "docs/guide.md"] },
    )
    assert.ok(!codes(report).includes("map.unknown-source"))
  })

  it("derives test roots from the tests glob when no conventional root matches", () => {
    const report = validateMap(
      mapWith(group({ tests: ["checks/**/*.check"] }), { testRoots: null }),
      { files: ["checks/a.check", "checks/b.check"] },
    )
    assert.ok(!codes(report).includes("map.empty-group"))
    assert.ok(!codes(report).includes("map.orphan-test"))
  })
})

describe("severity and exit codes", () => {
  it("maps structural errors to 3 and warnings to 0 or 4", () => {
    const structural = validateMap(
      { schema: 1, policy: normalizePolicy({ schema: 1 }), groups: [] },
      {},
    )
    assert.equal(exitCodeFor(structural), 3)

    const warning = validateMap(mapWith(group({ tier: "release" })), { files: ["web/billing/x.test.ts"] })
    assert.ok(warning.warnings.length > 0)
    assert.equal(exitCodeFor(warning), 0)
    assert.equal(exitCodeFor(warning, { strict: true }), 4)
  })

  it("keeps malformed-map rules fatal in both modes", () => {
    const report = validateMap(mapWith(group({ acceptance: { mode: "bad", reason: "" } })))
    assert.equal(exitCodeFor(report), 3)
    assert.equal(exitCodeFor(report, { strict: true }), 3)
  })
})

describe("canonical hash", () => {
  it("does not depend on group order or equivalent key order", () => {
    const first = mapWith(group())
    const second = {
      ...mapWith(group()),
      groups: [{ ...group() }],
    }
    second.policy = { ...second.policy }
    assert.equal(hashMap(first), hashMap(second))
    assert.equal(canonicalMap(first), canonicalMap(second))
  })

  it("changes when a group changes", () => {
    const first = mapWith(group())
    const second = mapWith(group({ durationSec: 10 }))
    assert.notEqual(hashMap(first), hashMap(second))
  })
})

describe("policy reference validation", () => {
  it("rejects unknown prSmoke and acceptance group IDs", () => {
    const report = validateMap(
      mapWith(group(), {
        prSmoke: ["missing.smoke"],
        acceptance: { mode: "automated", groups: ["missing.acceptance"], checklist: null },
      }),
    )
    assert.ok(codes(report).includes("map.dependency"))
  })
})

describe("schema document", () => {
  it("parses and declares the policy, group, and fragment shapes", () => {
    const schema = JSON.parse(readFileSync(join(FIXTURES, "../../../schemas/test-map.schema.json"), "utf8"))
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema")
    for (const name of ["policy", "group", "fragment", "singleMap"]) {
      assert.ok(schema.$defs[name], `schema is missing ${name}`)
    }
  })
})
