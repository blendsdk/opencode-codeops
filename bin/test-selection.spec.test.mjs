/**
 * Specification tests for the selector core.
 *
 * The selector is the correctness centre of the feature: a missed group hides a
 * failing test. These cases pin direct and downstream selection, fail-closed
 * fallbacks, gate tiers, budget reporting, and command construction.
 *
 * @module test-selection.spec.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { normalizePolicy } from "./lib/test-map.mjs"
import { parseNameStatusZ, resolveBaseline, SelectionError } from "./lib/test-selection-changes.mjs"
import { selectTests } from "./lib/test-selection.mjs"

/** Build the standard policy used by the cases. */
function policy(extra = {}) {
  return normalizePolicy({
    schema: 1,
    full: ["npm", "run", "verify"],
    fullOnPaths: ["package-lock.json", "Cargo.lock", ".github/workflows/**", "test/setup/**"],
    ignorePaths: [{ glob: "**/*.md", reason: "documentation" }],
    prSmoke: ["ui.shell.unit"],
    ...extra,
  })
}

/** A file-based group with sensible defaults. */
function group(id, slice, tier, sources, tests, extra = {}) {
  return {
    id,
    slice,
    tier,
    sources,
    tests,
    run: { command: ["node", "--test", "{tests}"] },
    ...extra,
  }
}

/** The standard multi-slice fixture map. */
function fixtureMap() {
  return {
    schema: 1,
    policy: policy(),
    groups: [
      group("billing.invoice-dialog.unit", "billing.invoice-dialog", "task", ["web/billing/invoice-dialog/**", "api/billing/invoice/**"], ["web/billing/invoice-dialog/**/*.test.tsx", "api/billing/invoice/**/*.test.ts"], { durationSec: 45 }),
      group("billing.invoice-dialog.e2e", "billing.invoice-dialog", "release", ["web/billing/invoice-dialog/**"], ["tests/e2e/billing/**/*.spec.ts"], { dependsOn: ["billing.invoice-dialog.unit"], durationSec: 240 }),
      group("inventory.stock-dialog.unit", "inventory.stock-dialog", "task", ["web/inventory/**"], ["web/inventory/**/*.test.ts"], { durationSec: 30 }),
      group("shared.auth.contract", "shared.auth", "task", ["shared/auth/**"], ["shared/auth/**/*.test.ts"], { alwaysRun: true, durationSec: 8 }),
      group("codegen.x86.unit", "codegen.x86", "task", ["crates/codegen-x86/src/**"], ["crates/codegen-x86/tests/**/*.rs"], { dependsOn: ["parser.unit"], durationSec: 100 }),
      group("assembler.unit", "assembler", "task", ["crates/assembler/src/**"], ["crates/assembler/tests/**/*.rs"], { dependsOn: ["codegen.x86.unit"], durationSec: 42 }),
      group("parser.unit", "parser", "task", ["crates/parser/src/**"], ["crates/parser/tests/**/*.rs"], { durationSec: 25 }),
      group("compiler.e2e", "compiler.e2e", "release", ["crates/**", "tests/corpus/**"], ["tests/e2e/**/*.rs"], { dependsOn: ["assembler.unit"], durationSec: 300 }),
      group("ui.shell.unit", "ui.shell", "task", ["web/shell/**"], ["web/shell/**/*.test.ts"], { durationSec: 12 }),
    ],
  }
}

/** Tracked files for the fixture map. */
const FILES = [
  "web/billing/invoice-dialog/Dialog.tsx",
  "web/billing/invoice-dialog/Dialog.test.tsx",
  "api/billing/invoice/handler.ts",
  "api/billing/invoice/handler.test.ts",
  "tests/e2e/billing/flow.spec.ts",
  "web/inventory/stock.ts",
  "web/inventory/stock.test.ts",
  "shared/auth/auth.ts",
  "shared/auth/auth.test.ts",
  "crates/codegen-x86/src/instruction.rs",
  "crates/codegen-x86/tests/codegen.rs",
  "crates/assembler/src/lib.rs",
  "crates/assembler/tests/assembler.rs",
  "crates/parser/src/lib.rs",
  "crates/parser/tests/parser.rs",
  "tests/e2e/compiler/corpus.rs",
  "web/shell/app.ts",
  "web/shell/app.test.ts",
  "README.md",
  "package-lock.json",
  "test/setup/db.ts",
]

/** Run selection with the fixture map and file inventory. */
function select(changed, options = {}) {
  const map = options.map ?? fixtureMap()
  return selectTests({
    map,
    mapHash: "hash",
    changed,
    files: options.files ?? FILES,
    gate: options.gate ?? "task",
    include: options.include ?? [],
    explicitFull: options.explicitFull ?? false,
    env: options.env ?? {},
  })
}

/** Selected group IDs. */
function selectedIds(result) {
  return result.selected.map((entry) => entry.id)
}

describe("ST-11 direct source selection", () => {
  it("selects the billing group and not inventory", () => {
    const result = select(["web/billing/invoice-dialog/Dialog.tsx"])
    assert.equal(result.mode, "groups")
    assert.ok(selectedIds(result).includes("billing.invoice-dialog.unit"))
    assert.ok(!selectedIds(result).includes("inventory.stock-dialog.unit"))
    const billing = result.selected.find((entry) => entry.id === "billing.invoice-dialog.unit")
    assert.ok(billing.reasons.includes("direct-source"))
  })
})

describe("ST-12 direct test selection", () => {
  it("selects the owning group for a changed test", () => {
    const result = select(["api/billing/invoice/handler.test.ts"])
    const billing = result.selected.find((entry) => entry.id === "billing.invoice-dialog.unit")
    assert.ok(billing.reasons.includes("direct-test"))
  })
})

describe("ST-13 downstream closure direction", () => {
  it("selects codegen and downstream assembler/compiler, not lexer/parser", () => {
    const result = select(["crates/codegen-x86/src/instruction.rs"])
    const ids = selectedIds(result)
    assert.ok(ids.includes("codegen.x86.unit"))
    assert.ok(ids.includes("assembler.unit"))
    assert.ok(result.deferred.some((entry) => entry.id === "compiler.e2e"))
    assert.ok(!ids.includes("parser.unit"))
  })
})

describe("ST-14 parser change", () => {
  it("selects parser and downstream codegen/assembler/e2e", () => {
    const result = select(["crates/parser/src/lib.rs"])
    const ids = selectedIds(result)
    assert.ok(ids.includes("parser.unit"))
    assert.ok(ids.includes("assembler.unit"))
    assert.ok(result.deferred.some((entry) => entry.id === "compiler.e2e"))
    assert.ok(!ids.includes("ui.shell.unit"))
  })
})

describe("ST-15 full-on paths", () => {
  for (const changed of ["package-lock.json", "Cargo.lock", ".github/workflows/ci.yml", "test/setup/db.ts"]) {
    it(`forces full for ${changed}`, () => {
      const result = select([changed])
      assert.equal(result.mode, "full")
      assert.equal(result.reason, "full-on-path")
      assert.deepEqual(result.changed, [changed])
    })
  }
})

describe("ST-16 docs only", () => {
  it("returns mode none", () => {
    const result = select(["README.md"])
    assert.equal(result.mode, "none")
    assert.deepEqual(result.commands, [])
  })
})

describe("ST-17 and ST-25 unknown path", () => {
  it("returns full with unknown-path and the offending path", () => {
    const result = select(["src/unmapped/new-module.ts"])
    assert.equal(result.mode, "full")
    assert.equal(result.reason, "unknown-path")
    assert.deepEqual(result.unknownPaths, ["src/unmapped/new-module.ts"])
  })
})

describe("ST-19 rename and delete", () => {
  it("parses both sides of a rename and a deletion", () => {
    const parsed = parseNameStatusZ("R100\0src/a.ts\0src/b.ts\0D\0src/old.ts\0M\0src/c.ts\0")
    assert.deepEqual(parsed.changed, ["src/a.ts", "src/b.ts", "src/old.ts", "src/c.ts"])
    assert.equal(parsed.renames.length, 1)
    assert.deepEqual(parsed.deleted, ["src/old.ts"])
  })
})

describe("ST-20 gate tiers", () => {
  it("filters by tier and records deferred groups", () => {
    const task = select(["web/billing/invoice-dialog/Dialog.tsx"], { gate: "task" })
    assert.ok(!selectedIds(task).includes("billing.invoice-dialog.e2e"))
    assert.ok(task.deferred.some((entry) => entry.id === "billing.invoice-dialog.e2e"))

    const release = select(["web/billing/invoice-dialog/Dialog.tsx"], { gate: "release" })
    assert.ok(selectedIds(release).includes("billing.invoice-dialog.e2e"))
    assert.equal(release.deferred.length, 0)
  })
})

describe("ST-21 threshold", () => {
  it("returns full when the selected fraction reaches the threshold", () => {
    const map = {
      schema: 1,
      policy: policy({ fullThreshold: 0.5 }),
      groups: [
        group("a.unit", "a", "task", ["src/a/**"], ["src/a/**/*.test.js"]),
        group("b.unit", "b", "task", ["src/b/**"], ["src/b/**/*.test.js"]),
      ],
    }
    const result = select(["src/a/x.js", "src/b/y.js"], { map })
    assert.equal(result.mode, "full")
    assert.equal(result.reason, "threshold")
  })
})

describe("ST-22 budget", () => {
  it("reports acceptable and over-budget without dropping groups", () => {
    const acceptable = select(["crates/codegen-x86/src/instruction.rs"])
    assert.equal(acceptable.budget.status, "acceptable")
    assert.ok(selectedIds(acceptable).includes("codegen.x86.unit"))

    const map = {
      schema: 1,
      policy: policy(),
      groups: [
        group("slow.unit", "slow", "task", ["src/slow/**"], ["src/slow/**/*.test.js"], { durationSec: 200 }),
        group("other.unit", "other", "task", ["src/other/**"], ["src/other/**/*.test.js"]),
      ],
    }
    const over = select(["src/slow/x.js"], {
      map,
      files: ["src/slow/one.test.js", "src/other/one.test.js"],
    })
    assert.equal(over.budget.status, "over-budget")
    assert.deepEqual(selectedIds(over), ["slow.unit"])
    assert.ok(over.warnings.some((warning) => warning.code === "budget.over-budget"))
  })
})

describe("ST-23 forced full", () => {
  it("forces full with --full or CODEOPS_FULL_TESTS=1", () => {
    assert.equal(select(["web/billing/invoice-dialog/Dialog.tsx"], { explicitFull: true }).reason, "forced")
    assert.equal(
      select(["web/billing/invoice-dialog/Dialog.tsx"], { env: { CODEOPS_FULL_TESTS: "1" } }).reason,
      "forced",
    )
  })
})

describe("ST-24 empty command construction", () => {
  it("falls back to full when a group resolves no tests", () => {
    const map = {
      schema: 1,
      policy: policy(),
      groups: [
        group("a.unit", "a", "task", ["src/a/**"], ["src/a/**/*.test.js"]),
        group("other.unit", "other", "task", ["src/other/**"], ["src/other/**/*.test.js"]),
      ],
    }
    const result = select(["src/a/x.js"], { map })
    assert.equal(result.mode, "full")
    assert.equal(result.reason, "map.empty-group")
  })
})

describe("ST-55 last-full marker", () => {
  it("rejects a missing integration marker", () => {
    assert.throws(
      () =>
        resolveBaseline({
          branch: "main",
          lastFullSha: null,
          runGit: () => ({ status: 0, stdout: "" }),
        }),
      (error) => error instanceof SelectionError && error.reason === "marker-missing",
    )
  })

  it("rejects a non-ancestor marker", () => {
    assert.throws(
      () =>
        resolveBaseline({
          branch: "main",
          lastFullSha: "a".repeat(40),
          runGit: (args) => (args[0] === "merge-base" ? { status: 1, stdout: "" } : { status: 0, stdout: "" }),
        }),
      (error) => error instanceof SelectionError && error.reason === "marker-missing",
    )
  })
})

describe("ST-56 no map", () => {
  it("returns full with a null full command", () => {
    const result = selectTests({
      map: null,
      mapHash: null,
      changed: ["src/a.ts"],
      files: [],
      gate: "task",
    })
    assert.equal(result.mode, "full")
    assert.equal(result.reason, "no-map")
    assert.equal(result.fullCommand, null)
  })
})

describe("ST-59 include paths", () => {
  it("selects the owner of an included spec file and falls back for an unowned one", () => {
    const owned = select(["web/billing/invoice-dialog/Dialog.tsx"], {
      include: ["api/billing/invoice/handler.test.ts"],
    })
    assert.ok(selectedIds(owned).includes("billing.invoice-dialog.unit"))

    const unowned = select(["web/billing/invoice-dialog/Dialog.tsx"], {
      include: ["tests/specs/unowned.test.ts"],
    })
    assert.equal(unowned.mode, "full")
    assert.equal(unowned.reason, "unknown-path")
  })
})

describe("ST-60 source-only change expands the full test set", () => {
  it("passes every group test file, not only changed tests", () => {
    const result = select(["web/billing/invoice-dialog/Dialog.tsx"])
    const command = result.commands.find((entry) => entry.id === "billing.invoice-dialog.unit")
    assert.ok(command.argv.includes("web/billing/invoice-dialog/Dialog.test.tsx"))
    assert.ok(command.argv.includes("api/billing/invoice/handler.test.ts"))
  })
})

describe("ST-61 PR smoke", () => {
  it("adds the configured smoke group at pr only", () => {
    const pr = select(["web/billing/invoice-dialog/Dialog.tsx"], { gate: "pr" })
    const smoke = pr.selected.find((entry) => entry.id === "ui.shell.unit")
    assert.ok(smoke.reasons.includes("smoke"))

    const task = select(["web/billing/invoice-dialog/Dialog.tsx"], { gate: "task" })
    assert.ok(!selectedIds(task).includes("ui.shell.unit"))
    assert.ok(selectedIds(task).includes("shared.auth.contract"))
  })
})
