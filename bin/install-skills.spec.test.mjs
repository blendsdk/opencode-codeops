/**
 * Specification tests for the CodeOps skills installer.
 *
 * These tests describe the installer's contract, not its internals: it installs
 * every packaged skill, records ownership in a marker, replaces managed skills
 * on upgrade, never touches skills it does not own, and removes only what it
 * owns. All filesystem work happens in throwaway temporary directories.
 *
 * @module install-skills.spec.test
 */

import assert from "node:assert/strict"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"

import {
  MARKER_FILE,
  installSkills,
  listSkills,
  main,
  parseArgs,
  readMarker,
  uninstallSkills,
  writeMarker,
} from "./install-skills.mjs"

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

/** Creates a minimal skill directory with a SKILL.md and one reference file. */
function makeSkill(root, name, body = `# ${name}\n`) {
  const dir = join(root, name)
  mkdirSync(join(dir, "references"), { recursive: true })
  writeFileSync(join(dir, "SKILL.md"), body, "utf-8")
  writeFileSync(join(dir, "references", "index.md"), "index\n", "utf-8")
  return dir
}

/** Creates a packaged-skills tree containing the given skill names. */
function makeSource(names = ["make-plan", "exec-plan"]) {
  const dir = tempDir("codeops-source-")
  for (const name of names) makeSkill(dir, name)
  return dir
}

/** Runs a function while suppressing console output. */
function silence(fn) {
  const original = console.log
  console.log = () => {}
  try {
    return fn()
  } finally {
    console.log = original
  }
}

describe("listSkills", () => {
  it("lists only directories that contain SKILL.md", () => {
    const source = makeSource(["make-plan"])
    mkdirSync(join(source, "not-a-skill"))

    assert.deepEqual(listSkills(source), ["make-plan"])
  })

  it("ignores symlinked skill directories", () => {
    const source = makeSource(["make-plan"])
    symlinkSync(source, join(source, "linked-skill"), "dir")

    assert.deepEqual(listSkills(source), ["make-plan"])
  })
})

describe("installSkills", () => {
  it("installs every packaged skill and writes a marker", () => {
    const source = makeSource()
    const target = tempDir("codeops-target-")

    const counts = silence(() =>
      installSkills({ sourceDir: source, targetDir: target, version: "9.9.9" })
    )

    assert.equal(counts.installed, 2)
    assert.ok(existsSync(join(target, "make-plan", "SKILL.md")))
    assert.ok(existsSync(join(target, "exec-plan", "references", "index.md")))

    const marker = readMarker(target)
    assert.equal(marker.version, "9.9.9")
    assert.deepEqual(marker.skills, ["exec-plan", "make-plan"])
  })

  it("replaces a managed skill on upgrade", () => {
    const source = makeSource(["make-plan"])
    const target = tempDir("codeops-target-")
    silence(() => installSkills({ sourceDir: source, targetDir: target, version: "1.0.0" }))

    writeFileSync(join(source, "make-plan", "SKILL.md"), "# version two\n", "utf-8")
    const counts = silence(() =>
      installSkills({ sourceDir: source, targetDir: target, version: "2.0.0" })
    )

    assert.equal(counts.replaced, 1)
    assert.equal(readMarker(target).version, "2.0.0")
  })

  it("preserves skills it does not own", () => {
    const source = makeSource()
    const target = tempDir("codeops-target-")
    makeSkill(target, "user-skill")

    silence(() => installSkills({ sourceDir: source, targetDir: target, version: "1.0.0" }))

    assert.ok(existsSync(join(target, "user-skill", "SKILL.md")))
  })

  it("skips a same-named unmanaged directory unless forced", () => {
    const source = makeSource()
    const target = tempDir("codeops-target-")
    makeSkill(target, "make-plan", "# hand written\n")
    writeMarker(target, { version: "1.0.0", skills: ["exec-plan"] })

    const skipped = silence(() =>
      installSkills({ sourceDir: source, targetDir: target, version: "2.0.0" })
    )
    assert.equal(skipped.skipped, 1)

    const forced = silence(() =>
      installSkills({ sourceDir: source, targetDir: target, version: "2.0.0", force: true })
    )
    assert.equal(forced.skipped, 0)
  })

  it("writes nothing during a dry run", () => {
    const source = makeSource()
    const target = tempDir("codeops-target-")

    const counts = silence(() =>
      installSkills({ sourceDir: source, targetDir: target, version: "1.0.0", dryRun: true })
    )

    assert.equal(counts.installed, 2)
    assert.ok(!existsSync(join(target, "make-plan")))
    assert.ok(!existsSync(join(target, MARKER_FILE)))
  })
})

describe("uninstallSkills", () => {
  it("removes only managed skills and the marker", () => {
    const source = makeSource()
    const target = tempDir("codeops-target-")
    silence(() => installSkills({ sourceDir: source, targetDir: target, version: "1.0.0" }))
    makeSkill(target, "user-skill")

    const result = silence(() => uninstallSkills({ targetDir: target }))

    assert.deepEqual(result.removed, ["exec-plan", "make-plan"])
    assert.ok(!existsSync(join(target, "make-plan")))
    assert.ok(existsSync(join(target, "user-skill", "SKILL.md")))
    assert.ok(!existsSync(join(target, MARKER_FILE)))
  })

  it("refuses to guess when no marker is present", () => {
    const target = tempDir("codeops-target-")
    makeSkill(target, "make-plan")

    const result = uninstallSkills({ targetDir: target })

    assert.equal(result.error, "no opencode-codeops marker found")
    assert.ok(existsSync(join(target, "make-plan", "SKILL.md")))
  })
})

describe("parseArgs", () => {
  it("defaults to install and accepts the documented forms", () => {
    const alias = parseArgs(["install-skills", "--project", "--force"])
    assert.equal(alias.command, "install")
    assert.equal(alias.options.project, true)
    assert.equal(alias.options.force, true)

    assert.equal(parseArgs(["status"]).command, "status")
    assert.equal(parseArgs(["uninstall", "--dry-run"]).command, "uninstall")
    assert.equal(parseArgs(["--help"]).options.help, true)
    assert.equal(parseArgs(["bogus"]).error, "unknown command 'bogus'")
  })
})

describe("main", () => {
  it("installs into an explicit target and reports success", () => {
    const source = makeSource()
    const target = tempDir("codeops-target-")

    const code = silence(() => main(["install", "--target", target], { source, version: "1.2.3" }))

    assert.equal(code, 0)
    assert.equal(readMarker(target).version, "1.2.3")
  })
})
