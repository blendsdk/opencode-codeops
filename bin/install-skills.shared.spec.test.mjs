/**
 * Specification tests for installing the package-root shared directories.
 *
 * The skills link to `_shared/` and `references/` with paths relative to their
 * own directory (`../../_shared/...`, `../../references/...`). After install
 * those links only resolve when the two directories sit beside the installed
 * `skills/` directory. These tests describe that contract: the installer places
 * both directories next to the skills, records them for ownership, removes them
 * on uninstall, respects `--link` and `--dry-run`, and never clobbers an
 * unowned directory unless `--force` is given.
 *
 * The central regression test installs the real packaged skills and then walks
 * every installed Markdown file, resolving each `../../_shared/...` and
 * `../../references/...` link to prove the target exists on disk.
 *
 * @module install-skills.shared.spec.test
 */

import assert from "node:assert/strict"
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, it } from "node:test"

import { installSkills, main, readMarker, uninstallSkills } from "./install-skills.mjs"

/** Repository root, derived from this file's location in `<root>/bin/`. */
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/** Temporary directories created by a test, removed after each test. */
const created = []

/**
 * Creates a throwaway directory that is cleaned up after the test.
 *
 * @param prefix - Prefix for the temporary directory name
 * @returns Absolute path to the new directory
 */
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

/**
 * Builds a source tree shaped like the package: a `skills/` dir beside a
 * `_shared/` dir and a `references/` dir.
 *
 * @param names - Skill directory names to create
 * @returns The skills directory and its parent (the sibling root)
 */
function makeSourceWithSiblings(names = ["make-plan"]) {
  const root = tempDir("codeops-src-")
  const skills = join(root, "skills")

  for (const name of names) {
    mkdirSync(join(skills, name), { recursive: true })
    writeFileSync(
      join(skills, name, "SKILL.md"),
      `# ${name}\n\n[shared doc](../../_shared/doc.md)\n`,
      "utf-8"
    )
  }

  mkdirSync(join(root, "_shared"), { recursive: true })
  writeFileSync(join(root, "_shared", "doc.md"), "shared doc v1\n", "utf-8")
  mkdirSync(join(root, "references", "domains"), { recursive: true })
  writeFileSync(join(root, "references", "domains", "lens.md"), "lens\n", "utf-8")

  return { root, skills }
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

/**
 * Recursively collects every Markdown file under a directory.
 *
 * @param dir - Directory to walk
 * @returns Absolute paths of all `.md` files
 */
function walkMarkdown(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walkMarkdown(full))
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(full)
  }
  return files
}

/**
 * Extracts the targets of inline Markdown links from text.
 *
 * @param text - Markdown source
 * @returns Link targets in source order
 */
function extractLinkTargets(text) {
  const targets = []
  const pattern = /\]\(([^)]+)\)/g
  let match
  while ((match = pattern.exec(text)) !== null) targets.push(match[1].trim())
  return targets
}

describe("shared-directory install", () => {
  it("installs _shared and references beside the skills and records them", () => {
    const { skills } = makeSourceWithSiblings(["make-plan"])
    const target = join(tempDir("codeops-target-"), "skills")

    silence(() => installSkills({ sourceDir: skills, targetDir: target, version: "1.0.0" }))

    const installRoot = dirname(target)
    assert.ok(existsSync(join(installRoot, "_shared", "doc.md")))
    assert.ok(existsSync(join(installRoot, "references", "domains", "lens.md")))
    assert.deepEqual(readMarker(target).shared.sort(), ["_shared", "references"])
  })

  it("resolves every packaged shared link after installing the real skills", () => {
    const source = join(PACKAGE_ROOT, "skills")
    const target = join(tempDir("codeops-real-"), "skills")

    silence(() => installSkills({ sourceDir: source, targetDir: target, version: "1.0.0" }))

    const installRoot = resolve(dirname(target))
    const checked = { _shared: 0, references: 0 }

    for (const file of walkMarkdown(target)) {
      for (const link of extractLinkTargets(readFileSync(file, "utf-8"))) {
        const sibling = /^\.\.\/\.\.\/(_shared|references)\//.exec(link)
        if (!sibling) continue

        const resolved = resolve(dirname(file), link)
        assert.ok(resolved.startsWith(installRoot + sep), `${link} must stay in the install tree`)
        assert.ok(existsSync(resolved), `${link} referenced from ${file} must exist`)
        checked[sibling[1]] += 1
      }
    }

    assert.ok(checked._shared > 0, "the sweep must exercise _shared links")
    assert.ok(checked.references > 0, "the sweep must exercise references links")
  })

  it("replaces a managed shared directory on upgrade", () => {
    const { root, skills } = makeSourceWithSiblings(["make-plan"])
    const target = join(tempDir("codeops-target-"), "skills")
    silence(() => installSkills({ sourceDir: skills, targetDir: target, version: "1.0.0" }))

    writeFileSync(join(root, "_shared", "doc.md"), "shared doc v2\n", "utf-8")
    silence(() => installSkills({ sourceDir: skills, targetDir: target, version: "2.0.0" }))

    assert.equal(
      readFileSync(join(dirname(target), "_shared", "doc.md"), "utf-8"),
      "shared doc v2\n"
    )
    assert.equal(readMarker(target).version, "2.0.0")
  })

  it("skips an unowned shared directory unless forced", () => {
    const { skills } = makeSourceWithSiblings(["make-plan"])
    const installRoot = tempDir("codeops-target-")
    const target = join(installRoot, "skills")
    mkdirSync(join(installRoot, "_shared"), { recursive: true })
    writeFileSync(join(installRoot, "_shared", "user.md"), "mine\n", "utf-8")

    silence(() => installSkills({ sourceDir: skills, targetDir: target, version: "1.0.0" }))
    assert.ok(existsSync(join(installRoot, "_shared", "user.md")))
    assert.ok(!existsSync(join(installRoot, "_shared", "doc.md")))

    silence(() =>
      installSkills({ sourceDir: skills, targetDir: target, version: "1.0.0", force: true })
    )
    assert.ok(existsSync(join(installRoot, "_shared", "doc.md")))
  })

  it("symlinks the shared directories in link mode", () => {
    const { root, skills } = makeSourceWithSiblings(["make-plan"])
    const target = join(tempDir("codeops-target-"), "skills")

    silence(() =>
      main(["install", "--target", target, "--link"], { source: skills, version: "1.0.0" })
    )

    const installRoot = dirname(target)
    assert.ok(lstatSync(join(installRoot, "_shared")).isSymbolicLink())
    assert.equal(realpathSync(join(installRoot, "_shared")), join(root, "_shared"))
    assert.ok(lstatSync(join(installRoot, "references")).isSymbolicLink())
  })

  it("writes no shared directories during a dry run", () => {
    const { skills } = makeSourceWithSiblings(["make-plan"])
    const installRoot = tempDir("codeops-target-")
    const target = join(installRoot, "skills")

    silence(() =>
      installSkills({ sourceDir: skills, targetDir: target, version: "1.0.0", dryRun: true })
    )

    assert.ok(!existsSync(join(installRoot, "_shared")))
    assert.ok(!existsSync(join(installRoot, "references")))
  })

  it("keeps ownership when a later source no longer ships a shared directory", () => {
    const { root, skills } = makeSourceWithSiblings(["make-plan"])
    const installRoot = tempDir("codeops-target-")
    const target = join(installRoot, "skills")
    silence(() => installSkills({ sourceDir: skills, targetDir: target, version: "1.0.0" }))

    rmSync(join(root, "_shared"), { recursive: true, force: true })
    rmSync(join(root, "references"), { recursive: true, force: true })
    silence(() => installSkills({ sourceDir: skills, targetDir: target, version: "2.0.0" }))

    assert.deepEqual(readMarker(target).shared.sort(), ["_shared", "references"])

    const result = silence(() => uninstallSkills({ targetDir: target }))
    assert.deepEqual(result.shared.sort(), ["_shared", "references"])
    assert.ok(!existsSync(join(installRoot, "_shared")))
    assert.ok(!existsSync(join(installRoot, "references")))
  })

  it("skips shared directories when the install target is a symlink", () => {
    const { skills } = makeSourceWithSiblings(["make-plan"])
    const real = tempDir("codeops-real-")
    const linkParent = tempDir("codeops-link-")
    const target = join(linkParent, "skills")
    symlinkSync(real, target, "dir")

    const code = silence(() =>
      main(["install", "--target", target, "--force"], { source: skills, version: "1.0.0" })
    )

    assert.equal(code, 0)
    assert.ok(existsSync(join(real, "make-plan", "SKILL.md")))
    assert.ok(!existsSync(join(linkParent, "_shared")))
    assert.ok(!existsSync(join(real, "_shared")))
    assert.deepEqual(readMarker(real).shared, [])
  })

  it("warns and skips shared directories a custom source does not have", () => {
    const source = tempDir("codeops-bare-")
    mkdirSync(join(source, "make-plan"), { recursive: true })
    writeFileSync(join(source, "make-plan", "SKILL.md"), "# make-plan\n", "utf-8")
    const target = join(tempDir("codeops-target-"), "skills")

    const counts = silence(() =>
      installSkills({ sourceDir: source, targetDir: target, version: "1.0.0" })
    )

    assert.equal(counts.installed, 1)
    assert.ok(existsSync(join(target, "make-plan", "SKILL.md")))
    assert.ok(!existsSync(join(dirname(target), "_shared")))
  })
})

describe("shared-directory uninstall", () => {
  it("removes managed shared directories and leaves unowned ones", () => {
    const { skills } = makeSourceWithSiblings(["make-plan"])
    const installRoot = tempDir("codeops-target-")
    const target = join(installRoot, "skills")
    silence(() => installSkills({ sourceDir: skills, targetDir: target, version: "1.0.0" }))

    mkdirSync(join(installRoot, "user-dir"), { recursive: true })
    writeFileSync(join(installRoot, "user-dir", "keep.md"), "keep\n", "utf-8")

    const result = silence(() => uninstallSkills({ targetDir: target }))

    assert.ok(!existsSync(join(installRoot, "_shared")))
    assert.ok(!existsSync(join(installRoot, "references")))
    assert.ok(existsSync(join(installRoot, "user-dir", "keep.md")))
    assert.deepEqual(result.shared, ["_shared", "references"])
  })
})
