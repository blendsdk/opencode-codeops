/**
 * Specification tests for the test-map model and validation.
 *
 * These cases define the map contract before the loader exists: no map means
 * full verification, a single file and a directory layout load the same logical
 * map, and malformed or unsafe maps fail closed with stable error codes.
 *
 * The expectations come from the map specification; when they fail, fix the
 * implementation, never the expectations.
 *
 * @module test-map.spec.test
 */

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"

import { hashMap, loadMap } from "./lib/test-map.mjs"
import { validateMap } from "./lib/test-map-validate.mjs"

const roots = []

/** Create an isolated temporary repository root. */
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "codeops-map-spec-"))
  roots.push(root)
  return root
}

/** Write a JSON file, creating parent directories. */
function writeJson(root, relativePath, value) {
  const absolute = join(root, relativePath)
  mkdirSync(join(absolute, ".."), { recursive: true })
  writeFileSync(absolute, JSON.stringify(value, null, 2))
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true })
})

/** A minimal valid policy for tests. */
function policy(extra = {}) {
  return {
    schema: 1,
    full: ["npm", "run", "verify"],
    ...extra,
  }
}

/** A minimal valid file-based group. */
function group(extra = {}) {
  return {
    id: "billing.invoice-dialog.unit",
    slice: "billing.invoice-dialog",
    tier: "task",
    sources: ["web/billing/invoice-dialog/**"],
    tests: ["web/billing/invoice-dialog/**/*.test.ts"],
    run: { command: ["node", "--test", "{tests}"] },
    ...extra,
  }
}

/** Assert a report contains one code. */
function hasCode(report, code) {
  return [...report.errors, ...report.warnings].some((item) => item.code === code)
}

describe("ST-1 no map", () => {
  it("returns the no-map sentinel", () => {
    const root = makeRoot()
    assert.deepEqual(loadMap({ root }), { mode: "no-map" })
  })
})

describe("ST-2 single-file map", () => {
  it("loads a map with one valid group", () => {
    const root = makeRoot()
    writeJson(root, "codeops/test-map.json", {
      schema: 1,
      policy: policy(),
      groups: [group()],
    })
    const loaded = loadMap({ root })
    assert.equal(loaded.mode, "map")
    assert.equal(loaded.map.groups.length, 1)
    assert.equal(loaded.map.policy.full.join(" "), "npm run verify")
    assert.equal(loaded.map.layout, "single")
    const report = validateMap(loaded.map)
    assert.equal(report.errors.length, 0)
  })
})

describe("ST-3 directory fragments", () => {
  it("merges policy and every fragment, including cross-fragment edges", () => {
    const root = makeRoot()
    writeJson(root, "codeops/test-map/policy.json", policy())
    writeJson(root, "codeops/test-map/shared.json", {
      schema: 1,
      domain: "shared",
      groups: [
        group({
          id: "shared.auth.contract",
          slice: "shared.auth",
          tier: "task",
          sources: ["shared/auth/**"],
          tests: ["shared/auth/**/*.test.ts"],
        }),
      ],
    })
    writeJson(root, "codeops/test-map/billing.json", {
      schema: 1,
      domain: "billing",
      groups: [
        group({ dependsOn: ["shared.auth.contract"] }),
        group({
          id: "billing.invoice-dialog.e2e",
          tier: "release",
          tests: ["tests/e2e/billing/**/*.spec.ts"],
          run: { command: ["node", "--test", "{tests}"] },
        }),
      ],
    })
    const loaded = loadMap({ root })
    assert.equal(loaded.mode, "map")
    assert.equal(loaded.map.groups.length, 3)
    assert.deepEqual(loaded.map.fragments, ["shared.json", "billing.json"])
    assert.equal(validateMap(loaded.map).errors.length, 0)
  })
})

describe("ST-4 duplicate group ID", () => {
  it("reports map.duplicate-id", () => {
    const root = makeRoot()
    writeJson(root, "codeops/test-map/policy.json", policy())
    writeJson(root, "codeops/test-map/a.json", { schema: 1, groups: [group()] })
    writeJson(root, "codeops/test-map/b.json", { schema: 1, groups: [group()] })
    const loaded = loadMap({ root })
    assert.equal(loaded.mode, "map")
    const report = validateMap(loaded.map)
    assert.ok(hasCode(report, "map.duplicate-id"))
  })
})

describe("ST-5 dependency cycle", () => {
  it("reports map.cycle", () => {
    const map = {
      schema: 1,
      policy: policy(),
      groups: [
        group({ id: "a.unit", slice: "a", dependsOn: ["b.unit"] }),
        group({ id: "b.unit", slice: "b", dependsOn: ["a.unit"] }),
      ],
    }
    assert.ok(hasCode(validateMap(map), "map.cycle"))
  })
})

describe("ST-6 unsafe paths", () => {
  for (const unsafe of ["../outside/**", "/absolute/**", "bad\0path"]) {
    it(`reports map.path for ${JSON.stringify(unsafe)}`, () => {
      const map = {
        schema: 1,
        policy: policy(),
        groups: [group({ sources: [unsafe] })],
      }
      assert.ok(hasCode(validateMap(map), "map.path"))
    })
  }
})

describe("ST-7 empty, overlapping, and ignored ownership", () => {
  it("errors on a file-based empty group but exempts a target-based group", () => {
    const empty = {
      schema: 1,
      policy: policy(),
      groups: [group()],
    }
    assert.ok(hasCode(validateMap(empty, { files: [] }), "map.empty-group"))

    const target = {
      schema: 1,
      policy: policy(),
      groups: [
        {
          id: "codegen.unit",
          slice: "codegen",
          tier: "task",
          sources: ["crates/codegen/**"],
          run: { command: ["cargo", "test", "-p", "codegen", "--lib"] },
        },
      ],
    }
    assert.ok(!hasCode(validateMap(target, { files: [] }), "map.empty-group"))
  })

  it("warns on a shared test owner and fails under strict", () => {
    const map = {
      schema: 1,
      policy: policy(),
      groups: [
        group({ id: "a.unit", slice: "a", tests: ["tests/shared.test.ts"] }),
        group({ id: "b.unit", slice: "b", tests: ["tests/shared.test.ts"] }),
      ],
    }
    const report = validateMap(map, { files: ["tests/shared.test.ts"] })
    assert.ok(hasCode(report, "map.overlap"))
    assert.equal(report.warnings.some((w) => w.code === "map.overlap"), true)
    assert.equal(report.errors.some((e) => e.code === "map.overlap"), false)
  })

  it("requires a reason for ignores and rejects an ignore overlapping a source", () => {
    const noReason = {
      schema: 1,
      policy: policy({ ignorePaths: [{ glob: "docs/**" }] }),
      groups: [group()],
    }
    assert.ok(hasCode(validateMap(noReason), "map.ignore-reason"))

    const overlap = {
      schema: 1,
      policy: policy({ ignorePaths: [{ glob: "web/**", reason: "wrong" }] }),
      groups: [group()],
    }
    assert.ok(hasCode(validateMap(overlap), "map.ignore-overlap"))
  })
})

describe("ST-8 slice contract", () => {
  it("warns for a slice without task tier and without release", () => {
    const map = {
      schema: 1,
      policy: policy(),
      groups: [
        group({
          id: "billing.e2e",
          tier: "release",
          tests: ["tests/e2e/billing/**/*.spec.ts"],
        }),
      ],
    }
    const report = validateMap(map, { files: ["tests/e2e/billing/dialog.spec.ts"] })
    assert.ok(hasCode(report, "map.slice-no-task"))
  })

  it("accepts a per-slice manual acceptance record", () => {
    const map = {
      schema: 1,
      policy: policy(),
      groups: [
        group({
          id: "billing.manual",
          tier: "task",
          acceptance: { mode: "manual", reason: "approved by billing" },
        }),
      ],
    }
    const report = validateMap(map, { files: ["web/billing/invoice-dialog/dialog.test.ts"] })
    assert.ok(!hasCode(report, "map.slice-no-release"))
  })

  it("rejects an invalid acceptance record", () => {
    const map = {
      schema: 1,
      policy: policy(),
      groups: [group({ acceptance: { mode: "sometimes", reason: "" } })],
    }
    assert.ok(hasCode(validateMap(map), "map.acceptance"))
  })
})

describe("ST-9 always-run tier", () => {
  it("rejects a non-task alwaysRun group", () => {
    const map = {
      schema: 1,
      policy: policy(),
      groups: [group({ tier: "release", alwaysRun: true })],
    }
    assert.ok(hasCode(validateMap(map), "map.always-run-tier"))
  })
})

describe("ST-10 canonical hash", () => {
  it("is identical for the same content in different fragment order", () => {
    const root = makeRoot()
    writeJson(root, "codeops/test-map/policy.json", policy())
    writeJson(root, "codeops/test-map/b.json", { schema: 1, groups: [group({ id: "b.unit", slice: "b" })] })
    writeJson(root, "codeops/test-map/a.json", { schema: 1, groups: [group({ id: "a.unit", slice: "a" })] })
    const first = loadMap({ root })
    const second = loadMap({ root })
    assert.equal(hashMap(first.map), hashMap(second.map))
  })
})

describe("ST-57 full command shape", () => {
  it("rejects a string and a one-element argv with spaces", () => {
    for (const full of ["npm run verify", ["npm run verify"]]) {
      const map = { schema: 1, policy: policy({ full }), groups: [group()] }
      assert.ok(hasCode(validateMap(map), "map.full"), JSON.stringify(full))
    }
  })

  it("accepts a nested multi-command argv", () => {
    const map = {
      schema: 1,
      policy: policy({ full: [["npm", "run", "build"], ["npm", "run", "test"]] }),
      groups: [group()],
    }
    assert.ok(!hasCode(validateMap(map), "map.full"))
  })
})

describe("ST-63 per-slice acceptance", () => {
  it("accepts manual, external, and na modes with a reason", () => {
    for (const mode of ["manual", "external", "na"]) {
      const map = {
        schema: 1,
        policy: policy(),
        groups: [group({ acceptance: { mode, reason: "recorded" } })],
      }
      assert.ok(!hasCode(validateMap(map), "map.acceptance"), mode)
    }
  })
})

describe("ST-64 requirement probes", () => {
  it("accepts a declared probe and rejects an undeclared requirement", () => {
    const declared = {
      schema: 1,
      policy: policy({ requirements: { db: { check: ["pg_isready"] } } }),
      groups: [group({ requires: ["db"] })],
    }
    assert.ok(!hasCode(validateMap(declared), "map.requires"))

    const undeclared = {
      schema: 1,
      policy: policy(),
      groups: [group({ requires: ["db"] })],
    }
    assert.ok(hasCode(validateMap(undeclared), "map.requires"))
  })
})

describe("ST-65 case sensitivity", () => {
  it("accepts the policy override and rejects a non-boolean", () => {
    const valid = { schema: 1, policy: policy({ caseSensitive: false }), groups: [group()] }
    assert.ok(!hasCode(validateMap(valid), "map.schema"))

    const invalid = { schema: 1, policy: policy({ caseSensitive: "no" }), groups: [group()] }
    assert.ok(hasCode(validateMap(invalid), "map.schema"))
  })
})
