/**
 * Specification tests for the CodeOps agent installer.
 *
 * These tests describe the installer's contract, not its internals: it installs
 * every packaged agent file, records ownership in a marker, replaces managed
 * files on upgrade, never touches files it does not own, and removes only what
 * it owns. All filesystem work happens in throwaway temporary directories.
 *
 * @module install-agents.spec.test
 */

import assert from "node:assert/strict"
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"

import {
  MARKER_FILE,
  installAgents,
  listAgents,
  main,
  parseArgs,
  readMarker,
  uninstallAgents,
  writeMarker,
} from "./install-agents.mjs"

/** Temporary directories created by a test, removed after each test. */
const created = []

/** Creates a throwaway directory that is cleaned up after the test. */
function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  created.push(dir)
  return dir
}

afterEach(() => {
  while (created.length > 0) {
    rmSync(created.pop(), { recursive: true, force: true })
  }
})

/** Creates a packaged-agents tree containing the given agent file names. */
function makeSource(names = ["executor.md", "explorer.md"]) {
  const dir = tempDir("codeops-agents-source-")
  for (const name of names) writeFileSync(join(dir, name), `# ${name}\n`, "utf-8")
  return dir
}

/** Runs a function while suppressing console output. */
function silence(fn) {
  const log = console.log
  const error = console.error
  console.log = () => {}
  console.error = () => {}
  try {
    return fn()
  } finally {
    console.log = log
    console.error = error
  }
}

describe("listAgents", () => {
  it("lists only Markdown files", () => {
    const source = makeSource(["executor.md"])
    writeFileSync(join(source, "notes.txt"), "x\n", "utf-8")
    mkdirSync(join(source, "nested"))

    assert.deepEqual(listAgents(source), ["executor.md"])
  })
})

describe("installAgents", () => {
  it("installs every packaged agent and writes a marker", () => {
    const source = makeSource()
    const target = tempDir("codeops-agents-target-")

    const counts = silence(() =>
      installAgents({ sourceDir: source, targetDir: target, version: "9.9.9" })
    )

    assert.equal(counts.installed, 2)
    assert.ok(existsSync(join(target, "executor.md")))
    assert.ok(existsSync(join(target, "explorer.md")))

    const marker = readMarker(target)
    assert.equal(marker.version, "9.9.9")
    assert.deepEqual(marker.agents, ["executor.md", "explorer.md"])
  })

  it("replaces a managed file on upgrade", () => {
    const source = makeSource(["executor.md"])
    const target = tempDir("codeops-agents-target-")
    silence(() => installAgents({ sourceDir: source, targetDir: target, version: "1.0.0" }))

    writeFileSync(join(source, "executor.md"), "# version two\n", "utf-8")
    const counts = silence(() =>
      installAgents({ sourceDir: source, targetDir: target, version: "2.0.0" })
    )

    assert.equal(counts.replaced, 1)
    assert.equal(readMarker(target).version, "2.0.0")
  })

  it("skips a same-named unmanaged file unless forced", () => {
    const source = makeSource(["executor.md"])
    const target = tempDir("codeops-agents-target-")
    writeFileSync(join(target, "executor.md"), "# hand written\n", "utf-8")
    writeMarker(target, { version: "1.0.0", agents: ["other.md"] })

    const skipped = silence(() =>
      installAgents({ sourceDir: source, targetDir: target, version: "2.0.0" })
    )
    assert.equal(skipped.skipped, 1)
    assert.equal(readFileSync(join(target, "executor.md"), "utf-8"), "# hand written\n")

    const forced = silence(() =>
      installAgents({ sourceDir: source, targetDir: target, version: "2.0.0", force: true })
    )
    assert.equal(forced.skipped, 0)
  })

  it("writes nothing during a dry run", () => {
    const source = makeSource()
    const target = tempDir("codeops-agents-target-")

    const counts = silence(() =>
      installAgents({ sourceDir: source, targetDir: target, version: "1.0.0", dryRun: true })
    )

    assert.equal(counts.installed, 2)
    assert.ok(!existsSync(join(target, "executor.md")))
    assert.ok(!existsSync(join(target, MARKER_FILE)))
  })

  it("links to the source when requested", () => {
    const source = makeSource(["executor.md"])
    const target = tempDir("codeops-agents-target-")

    silence(() =>
      installAgents({ sourceDir: source, targetDir: target, version: "1.0.0", link: true })
    )

    assert.ok(lstatSync(join(target, "executor.md")).isSymbolicLink())
  })
})

describe("uninstallAgents", () => {
  it("removes only managed files and the marker", () => {
    const source = makeSource()
    const target = tempDir("codeops-agents-target-")
    silence(() => installAgents({ sourceDir: source, targetDir: target, version: "1.0.0" }))
    writeFileSync(join(target, "user.md"), "# user\n", "utf-8")

    const result = silence(() => uninstallAgents({ targetDir: target }))

    assert.deepEqual(result.removed, ["executor.md", "explorer.md"])
    assert.ok(!existsSync(join(target, "executor.md")))
    assert.ok(existsSync(join(target, "user.md")))
    assert.ok(!existsSync(join(target, MARKER_FILE)))
  })

  it("refuses to guess when no marker is present", () => {
    const target = tempDir("codeops-agents-target-")
    writeFileSync(join(target, "executor.md"), "# x\n", "utf-8")

    const result = uninstallAgents({ targetDir: target })

    assert.equal(result.error, "no opencode-codeops marker found")
    assert.ok(existsSync(join(target, "executor.md")))
  })
})

describe("parseArgs", () => {
  it("defaults to install and accepts the documented forms", () => {
    const alias = parseArgs(["install-agents", "--project", "--force"])
    assert.equal(alias.command, "install")
    assert.equal(alias.options.project, true)
    assert.equal(alias.options.force, true)

    assert.equal(parseArgs(["agents-status"]).command, "status")
    assert.equal(parseArgs(["agents-uninstall", "--dry-run"]).command, "uninstall")
    assert.equal(parseArgs(["--help"]).options.help, true)
    assert.equal(parseArgs(["bogus"]).error, "unknown command 'bogus'")
  })
})

describe("main", () => {
  it("installs into an explicit target and reports success", () => {
    const source = makeSource()
    const target = tempDir("codeops-agents-target-")

    const code = silence(() => main(["install", "--target", target], { source, version: "1.2.3" }))

    assert.equal(code, 0)
    assert.equal(readMarker(target).version, "1.2.3")
  })
})

describe("symlinked target guard", () => {
  it("refuses install through a symlinked target unless forced", () => {
    const source = makeSource(["executor.md"])
    const real = tempDir("codeops-agents-real-")
    const link = join(tempDir("codeops-agents-link-"), "agents")
    symlinkSync(real, link, "dir")

    const refused = silence(() =>
      main(["install", "--target", link], { source, version: "1.0.0" })
    )
    assert.equal(refused, 2)
    assert.ok(!existsSync(join(real, MARKER_FILE)))

    const forced = silence(() =>
      main(["install", "--target", link, "--force"], { source, version: "1.0.0" })
    )
    assert.equal(forced, 0)
    assert.ok(existsSync(join(real, MARKER_FILE)))
  })
})
