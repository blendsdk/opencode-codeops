/**
 * Implementation tests for CI workflows, plan modes, and the package payload.
 *
 * @module ci-workflows-content.impl.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"

const ROOT = new URL("..", import.meta.url).pathname
const CLI = join(ROOT, "bin/codeops-test.mjs")
const roots = []

/** Read a repository file. */
function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

/** Create a temporary directory. */
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "codeops-ci-impl-"))
  roots.push(root)
  return root
}

/** Run Git in a fixture repository. */
function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
}

/** Run the CLI. */
function runCli(root, args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: "utf8" })
}

/** Build a small map repository for plan-mode tests. */
function makeRepo() {
  const root = makeRoot()
  git(root, ["init", "-q"])
  git(root, ["config", "user.email", "test@example.com"])
  git(root, ["config", "user.name", "Test"])
  mkdirSync(join(root, "codeops"), { recursive: true })
  mkdirSync(join(root, "src", "a"), { recursive: true })
  mkdirSync(join(root, "src", "b"), { recursive: true })
  mkdirSync(join(root, "tests", "a"), { recursive: true })
  mkdirSync(join(root, "tests", "b"), { recursive: true })
  writeFileSync(join(root, "src", "a", "base.js"), "x")
  writeFileSync(join(root, "src", "b", "base.js"), "y")
  writeFileSync(join(root, "tests", "a", "case.test.js"), "// a")
  writeFileSync(join(root, "tests", "b", "case.test.js"), "// b")
  writeFileSync(
    join(root, "codeops", "test-map.json"),
    JSON.stringify({
      schema: 1,
      policy: {
        schema: 1,
        full: ["npm", "run", "verify"],
        fullThreshold: 1,
        ignorePaths: [{ glob: "**/*.md", reason: "documentation" }],
      },
      groups: [
        {
          id: "a.unit",
          slice: "a",
          tier: "task",
          sources: ["src/a/**"],
          tests: ["tests/a/**/*.test.js"],
          run: { command: ["node", "--test", "{tests}"] },
        },
        {
          id: "b.unit",
          slice: "b",
          tier: "task",
          sources: ["src/b/**"],
          tests: ["tests/b/**/*.test.js"],
          run: { command: ["node", "--test", "{tests}"] },
        },
      ],
    }),
  )
  git(root, ["add", "-A"])
  git(root, ["commit", "-qm", "fixture"])
  return root
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true })
})

describe("workflow structure", () => {
  it("keeps the reusable full gate free of pull_request_target", () => {
    for (const name of ["verify-full.yml", "ci.yml", "release.yml"]) {
      assert.ok(!read(`.github/workflows/${name}`).includes("pull_request_target"), name)
    }
  })

  it("keeps the release publish path and permissions intact", () => {
    const release = read(".github/workflows/release.yml")
    assert.match(release, /id-token: write/)
    assert.match(release, /scripts\/release\.mjs release/)
    assert.match(release, /needs: \[validate, verify\]/)
  })

  it("passes actionlint when it is installed", (t) => {
    const probe = spawnSync("actionlint", ["--version"], { encoding: "utf8" })
    if (probe.status !== 0) {
      t.diagnostic("actionlint is not installed; structural checks cover the workflows")
      return
    }
    const lint = spawnSync("actionlint", [".github/workflows/verify-full.yml", ".github/workflows/ci.yml", ".github/workflows/release.yml"], {
      cwd: ROOT,
      encoding: "utf8",
    })
    assert.equal(lint.status, 0, lint.stdout + lint.stderr)
  })
})

describe("plan modes through the CLI", () => {
  it("emits groups for an affected change and none for docs only", () => {
    const root = makeRepo()
    writeFileSync(join(root, "src", "a", "change.js"), "changed")
    const groups = runCli(root, ["plan", "--gate", "pr", "--baseline", "HEAD", "--json"])
    assert.equal(groups.status, 0, groups.stderr)
    const groupsPlan = JSON.parse(groups.stdout)
    assert.equal(groupsPlan.mode, "groups")
    assert.equal(groupsPlan.matrix.include.length, 1)
    assert.equal(groupsPlan.matrix.include[0].group, "a.unit")

    rmSync(join(root, "src", "a", "change.js"))
    writeFileSync(join(root, "docs.md"), "# docs")
    const none = runCli(root, ["plan", "--gate", "pr", "--baseline", "HEAD", "--json"])
    assert.equal(none.status, 0, none.stderr)
    const nonePlan = JSON.parse(none.stdout)
    assert.equal(nonePlan.mode, "none")
    assert.deepEqual(nonePlan.matrix, { include: [] })
  })

  it("rejects --group full for a groups selection", () => {
    const root = makeRepo()
    writeFileSync(join(root, "src", "a", "change.js"), "changed")
    const result = runCli(root, ["run", "--gate", "pr", "--baseline", "HEAD", "--group", "full"])
    assert.equal(result.status, 2)
  })
})

describe("package payload", () => {
  it("includes product files and excludes tests and fixtures", () => {
    const packed = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 120000,
    })
    assert.equal(packed.status, 0, packed.stderr)
    const files = JSON.parse(packed.stdout)[0].files.map((entry) => entry.path)
    for (const included of [
      "skills/organize-tests/SKILL.md",
      "skills/organize-tests/references/ci-github-actions.md",
      "skills/organize-tests/references/project-wrapper.md",
      "schemas/test-map.schema.json",
      "bin/codeops-test.mjs",
      "_shared/test-selection.md",
    ]) {
      assert.ok(files.includes(included), `payload is missing ${included}`)
    }
    for (const excluded of [
      "bin/codeops-test.spec.test.mjs",
      "bin/codeops-test.impl.test.mjs",
      "bin/fixtures/test-selection/node/single-map.json",
      "scripts/organize-tests-content.spec.test.mjs",
    ]) {
      assert.ok(!files.includes(excluded), `payload must exclude ${excluded}`)
    }
  })
})
