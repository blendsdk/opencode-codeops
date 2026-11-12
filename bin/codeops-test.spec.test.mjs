/**
 * Specification tests for the `codeops-test` CLI and runner.
 *
 * The CLI is the boundary between agent guidance and real commands. These
 * cases pin the observable contract: JSON shape, exit codes, argv safety,
 * failure reporting, log hygiene, and shadow evidence.
 *
 * Each case builds a throwaway Git repository so the selector sees real
 * tracked and untracked changes.
 *
 * @module codeops-test.spec.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"

const CLI = new URL("./codeops-test.mjs", import.meta.url).pathname
const roots = []

/** Run one Git command in a fixture repository. */
function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout
}

/** Create an isolated Git repository with the standard fixture map. */
function makeRepo({ map = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "codeops-cli-spec-"))
  roots.push(root)
  git(root, ["init", "-q"])
  git(root, ["config", "user.email", "test@example.com"])
  git(root, ["config", "user.name", "Test"])

  writeFileSync(
    join(root, "runner.mjs"),
    `import { writeFileSync } from "node:fs"\n` +
      `const argv = process.argv.slice(2)\n` +
      `if (process.env.CODEOPS_RUN_RECORD) writeFileSync(process.env.CODEOPS_RUN_RECORD, JSON.stringify({ argv, group: process.env.CODEOPS_TEST_GROUP ?? null, gate: process.env.CODEOPS_TEST_GATE ?? null, cwd: process.cwd() }))\n` +
      `if (argv.includes("--fail")) { console.error("boom"); process.exit(1) }\n` +
      `if (argv.includes("--hang")) { setTimeout(() => {}, 60000) }\n` +
      `console.log("ok", argv.join(" "))\n`,
  )
  writeFileSync(join(root, "package-lock.json"), "{}\n")
  mkdirSync(join(root, "src", "a"), { recursive: true })
  mkdirSync(join(root, "src", "b"), { recursive: true })
  mkdirSync(join(root, "tests", "a"), { recursive: true })
  mkdirSync(join(root, "tests", "b"), { recursive: true })
  mkdirSync(join(root, "tests", "e2e"), { recursive: true })
  writeFileSync(join(root, "src", "a", "base.js"), "export const a = 1\n")
  writeFileSync(join(root, "src", "b", "base.js"), "export const b = 1\n")
  writeFileSync(join(root, "tests", "a", "case.test.js"), "// a\n")
  writeFileSync(join(root, "tests", "b", "case.test.js"), "// b\n")
  writeFileSync(join(root, "tests", "e2e", "flow.spec.js"), "// e2e\n")

  if (map) {
    mkdirSync(join(root, "codeops"), { recursive: true })
    writeFileSync(
      join(root, "codeops", "test-map.json"),
      JSON.stringify(
        {
          schema: 1,
          policy: {
            schema: 1,
            full: ["node", "runner.mjs"],
            ignorePaths: [{ glob: "docs/**", reason: "documentation" }],
            fullOnPaths: ["package-lock.json"],
            fullThreshold: 1,
          },
          groups: [
            {
              id: "a.unit",
              slice: "a",
              tier: "task",
              sources: ["src/a/**"],
              tests: ["tests/a/**/*.test.js"],
              run: { command: ["node", "runner.mjs", "{tests}"] },
            },
            {
              id: "b.unit",
              slice: "b",
              tier: "task",
              sources: ["src/b/**"],
              tests: ["tests/b/**/*.test.js"],
              run: { command: ["node", "runner.mjs", "{tests}"] },
            },
            {
              id: "a.e2e",
              slice: "a",
              tier: "release",
              sources: ["src/a/**"],
              tests: ["tests/e2e/**/*.spec.js"],
              run: { command: ["node", "runner.mjs", "{tests}"] },
            },
          ],
        },
        null,
        2,
      ),
    )
  }

  git(root, ["add", "-A"])
  git(root, ["commit", "-qm", "fixture"])
  return root
}

/** Create an uncommitted change plus its test file. */
function dirtyA(root) {
  writeFileSync(join(root, "src", "a", "change.js"), "export const changed = true\n")
}

/** Update the map and commit it so the map itself is not part of the diff. */
function updateMap(root, mutate) {
  const mapPath = join(root, "codeops", "test-map.json")
  const map = JSON.parse(readFileSync(mapPath, "utf8"))
  mutate(map)
  writeFileSync(mapPath, JSON.stringify(map, null, 2))
  git(root, ["add", "codeops/test-map.json"])
  git(root, ["commit", "-qm", "map fixture"])
}

/** Run the CLI in a fixture repository. */
function runCli(root, args, { env = {} } = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env },
  })
}

/** Parse JSON output, failing with the raw output on error. */
function parseJson(result) {
  try {
    return JSON.parse(result.stdout)
  } catch (error) {
    throw new Error(`expected JSON, got:\n${result.stdout}\n${result.stderr}`)
  }
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true })
})

describe("ST-26 select JSON and shard execution", () => {
  it("emits the selection contract and runs one selected group", () => {
    const root = makeRepo()
    dirtyA(root)
    const selected = runCli(root, ["select", "--gate", "task", "--baseline", "HEAD", "--json"])
    assert.equal(selected.status, 0, selected.stderr)
    const result = parseJson(selected)
    assert.equal(result.mode, "groups")
    assert.equal(result.gate, "task")
    assert.ok(result.changed.includes("src/a/change.js"))
    assert.ok(result.selected.some((entry) => entry.id === "a.unit"))
    assert.ok(Array.isArray(result.commands))
    assert.equal(typeof result.mapHash, "string")

    writeFileSync(join(root, "plan.json"), selected.stdout)
    const ran = runCli(root, ["run", "--selection", "plan.json", "--group", "a.unit"])
    assert.equal(ran.status, 0, ran.stderr)
    assert.match(ran.stdout, /a\.unit/)

    const tampered = JSON.parse(selected.stdout)
    tampered.mapHash = "0".repeat(64)
    writeFileSync(join(root, "tampered.json"), JSON.stringify(tampered))
    const rejected = runCli(root, ["run", "--selection", "tampered.json", "--group", "a.unit"])
    assert.equal(rejected.status, 2)
  })
})

describe("ST-27 explain output", () => {
  it("names a reason for each selected group", () => {
    const root = makeRepo()
    dirtyA(root)
    const result = runCli(root, ["select", "--gate", "task", "--baseline", "HEAD", "--explain"])
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /a\.unit\s+direct-source/)
  })
})

describe("ST-28 argv safety", () => {
  it("passes a hostile-looking path as one argv entry without shell execution", () => {
    const root = makeRepo()
    const hostile = "tests/a/space ; $(touch pwned) name.test.js"
    writeFileSync(join(root, hostile), "// hostile\n")
    writeFileSync(join(root, "src", "a", "change.js"), "export const changed = true\n")
    const record = join(root, "record.json")
    const result = runCli(root, ["run", "--gate", "task", "--baseline", "HEAD"], {
      env: { CODEOPS_RUN_RECORD: record },
    })
    assert.equal(result.status, 0, result.stderr)
    const recorded = JSON.parse(readFileSync(record, "utf8"))
    assert.ok(recorded.argv.includes(hostile))
    assert.equal(existsSync(join(root, "pwned")), false)
  })
})

describe("ST-29 cwd containment", () => {
  it("refuses a group cwd outside the repository", () => {
    const root = makeRepo()
    updateMap(root, (map) => {
      map.groups[0].run.cwd = "../outside"
    })
    dirtyA(root)
    const result = runCli(root, ["run", "--gate", "task", "--baseline", "HEAD"])
    assert.equal(result.status, 3)
    assert.match(result.stdout + result.stderr, /cwd/)
  })
})

describe("ST-30 failures and timeouts", () => {
  it("exits 1 on a failing command and reports a retained log", () => {
    const root = makeRepo()
    updateMap(root, (map) => {
      map.groups[0].run.command = ["node", "runner.mjs", "--fail"]
    })
    dirtyA(root)
    const result = runCli(root, ["run", "--gate", "task", "--baseline", "HEAD"])
    assert.equal(result.status, 1)
    assert.match(result.stdout + result.stderr, /boom/)
    const match = (result.stdout + result.stderr).match(/log:\s*(\S+)/)
    assert.ok(match, "failure output must name the retained log")
    assert.ok(existsSync(match[1]))
  })

  it("treats a timeout as a failure", () => {
    const root = makeRepo()
    updateMap(root, (map) => {
      map.groups[0].run.command = ["node", "runner.mjs", "--hang"]
    })
    dirtyA(root)
    const result = runCli(root, ["run", "--gate", "task", "--baseline", "HEAD", "--timeout", "1"])
    assert.equal(result.status, 1)
    assert.match(result.stdout + result.stderr, /timeout/i)
  })
})

describe("ST-31 concurrency", () => {
  it("runs two parallel-safe groups with --concurrency 2", () => {
    const root = makeRepo()
    updateMap(root, (map) => {
      map.groups[0].parallelSafe = true
      map.groups[1].parallelSafe = true
    })
    writeFileSync(join(root, "src", "a", "change.js"), "export const changed = true\n")
    writeFileSync(join(root, "src", "b", "change.js"), "export const changed = true\n")
    const result = runCli(root, ["run", "--gate", "task", "--baseline", "HEAD", "--concurrency", "2"])
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /a\.unit/)
    assert.match(result.stdout, /b\.unit/)
  })
})

describe("ST-32 strict check", () => {
  it("exits 4 for an orphan test and an unclassified source", () => {
    const root = makeRepo()
    writeFileSync(join(root, "tests", "legacy.test.js"), "// orphan\n")
    writeFileSync(join(root, "src", "unmapped.js"), "export const x = 1\n")
    const result = runCli(root, ["check", "--strict"])
    assert.equal(result.status, 4)
    assert.match(result.stdout, /map\.orphan-test/)
    assert.match(result.stdout, /map\.unknown-source/)
  })
})

describe("ST-33 and ST-34 shadow", () => {
  it("reports zero-missed when selected and full both pass", () => {
    const root = makeRepo()
    dirtyA(root)
    const result = runCli(root, ["shadow", "--baseline", "HEAD", "--record", "shadow.json", "--json"])
    assert.equal(result.status, 0, result.stderr)
    const record = JSON.parse(readFileSync(join(root, "shadow.json"), "utf8"))
    assert.equal(record.verdict, "zero-missed")
    assert.equal(record.enabled, false)
  })

  it("reports escaped when the full suite fails", () => {
    const root = makeRepo()
    dirtyA(root)
    const result = runCli(root, [
      "shadow",
      "--baseline",
      "HEAD",
      "--full-command",
      "node",
      "runner.mjs",
      "--fail",
      "--record",
      "shadow.json",
      "--json",
    ])
    assert.equal(result.status, 1)
    const record = JSON.parse(readFileSync(join(root, "shadow.json"), "utf8"))
    assert.equal(record.verdict, "escaped")
  })
})

describe("ST-35 log hygiene", () => {
  it("deletes success logs and keeps failure logs", () => {
    const root = makeRepo()
    const tmp = join(root, "..", `${root.split("/").pop()}-tmp`)
    mkdirSync(tmp, { recursive: true })
    dirtyA(root)
    const success = runCli(root, ["run", "--gate", "task", "--baseline", "HEAD"], {
      env: { CODEOPS_TMPDIR: tmp },
    })
    assert.equal(success.status, 0, success.stderr)
    assert.deepEqual(
      spawnSync("find", [tmp, "-type", "f"], { encoding: "utf8" }).stdout.trim(),
      "",
    )
    rmSync(tmp, { recursive: true, force: true })
  })
})

describe("ST-56 no map", () => {
  it("refuses a full run without a command and runs an explicit one", () => {
    const root = makeRepo({ map: false })
    const missing = runCli(root, ["run", "--gate", "task", "--baseline", "HEAD"])
    assert.equal(missing.status, 5)
    const explicit = runCli(root, [
      "run",
      "--gate",
      "task",
      "--baseline",
      "HEAD",
      "--full-command",
      "node",
      "runner.mjs",
    ])
    assert.equal(explicit.status, 0, explicit.stderr)
  })
})

describe("ST-58 plan modes", () => {
  it("always emits a matrix and keeps no-map honest", () => {
    const root = makeRepo()
    dirtyA(root)
    const release = runCli(root, ["plan", "--gate", "release", "--baseline", "HEAD", "--json"])
    assert.equal(release.status, 0, release.stderr)
    const releasePlan = parseJson(release)
    assert.equal(releasePlan.mode, "groups")
    assert.equal(releasePlan.full, true)
    assert.equal(releasePlan.matrix.include.length, 3)

    const none = makeRepo({ map: false })
    const noMap = runCli(none, ["plan", "--gate", "pr", "--baseline", "HEAD", "--json"])
    const noMapPlan = parseJson(noMap)
    assert.equal(noMapPlan.mode, "full")
    assert.equal(noMapPlan.fullCommand, null)
    assert.deepEqual(noMapPlan.matrix, { include: [] })
  })
})
