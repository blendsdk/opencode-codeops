/**
 * Implementation tests for the CodeOps temporary-directory lifecycle helper.
 *
 * These cases exercise the safety net behind the workspace-hygiene protocol:
 * per-session directories under a CodeOps-owned temp root, an age-gated sweep
 * of abandoned directories, and exact removal of one session's directory.
 * Every case runs against a throwaway base directory, never the real system
 * temp directory.
 *
 * @module tmp-hygiene.impl.test
 */

import assert from "node:assert/strict"
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"

import {
  DEFAULT_MAX_AGE_MS,
  cleanStaleTmpDirs,
  codeopsTmpRoot,
  ensureSessionTmpDir,
  removeSessionTmpDir,
  sanitizeSessionId,
  sessionTmpDir,
} from "./lib/tmp-hygiene.mjs"

/** Throwaway base directories created by the tests, removed afterward. */
const created = []

/**
 * Create a throwaway base directory that stands in for the system temp root.
 *
 * @returns Absolute path to the new directory
 */
function makeBase() {
  const dir = mkdtempSync(join(tmpdir(), "codeops-tmp-hygiene-"))
  created.push(dir)
  return dir
}

/**
 * Create a session directory with content and optionally backdate its mtime.
 *
 * @param {string} base - Throwaway temp root
 * @param {string} sessionID - Session identifier
 * @param {number} [ageMs] - How old the directory should appear
 * @returns Absolute path to the created directory
 */
function makeSessionDir(base, sessionID, ageMs = 0) {
  const dir = join(codeopsTmpRoot(base), sanitizeSessionId(sessionID))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "scratch.log"), "temporary\n", "utf-8")
  if (ageMs > 0) {
    const past = new Date(Date.now() - ageMs)
    utimesSync(dir, past, past)
  }
  return dir
}

after(() => {
  while (created.length > 0) {
    rmSync(created.pop(), { recursive: true, force: true })
  }
})

describe("temp-root path helpers", () => {
  it("places the CodeOps root inside the given temp base", () => {
    const base = makeBase()
    assert.equal(codeopsTmpRoot(base), join(base, "opencode", "codeops"))
  })

  it("sanitizes hostile or empty session identifiers", () => {
    assert.equal(sanitizeSessionId("ses_abc-123"), "ses_abc-123")
    assert.equal(sanitizeSessionId("../../etc/passwd"), "etcpasswd")
    assert.equal(sanitizeSessionId("a/b"), "ab")
    assert.equal(sanitizeSessionId(""), "shared")
    assert.equal(sanitizeSessionId(undefined), "shared")
    assert.equal(sanitizeSessionId(".."), "shared")
  })

  it("derives a session directory under the CodeOps root", () => {
    const base = makeBase()
    assert.equal(sessionTmpDir("ses_abc", base), join(base, "opencode", "codeops", "ses_abc"))
    assert.equal(sessionTmpDir("../../evil", base), join(base, "opencode", "codeops", "evil"))
  })

  it("creates the session directory lazily and returns its path", () => {
    const base = makeBase()
    const dir = ensureSessionTmpDir("ses_create", base)
    assert.equal(dir, sessionTmpDir("ses_create", base))
    assert.ok(lstatSync(dir).isDirectory())
  })
})

describe("stale-directory sweep", () => {
  it("returns nothing when the CodeOps root does not exist yet", () => {
    const base = makeBase()
    assert.deepEqual(cleanStaleTmpDirs({ sessionID: "ses_new", base }), [])
  })

  it("keeps fresh directories and removes directories older than the cap", () => {
    const base = makeBase()
    const fresh = makeSessionDir(base, "ses_fresh", 0)
    const stale = makeSessionDir(base, "ses_stale", DEFAULT_MAX_AGE_MS + 60_000)

    const removed = cleanStaleTmpDirs({ sessionID: "ses_other", base })

    assert.deepEqual(removed, [stale])
    assert.ok(existsSync(fresh), "fresh directory must survive")
    assert.ok(!existsSync(stale), "stale directory must be removed")
  })

  it("never removes the current session's directory, however old", () => {
    const base = makeBase()
    const current = makeSessionDir(base, "ses_current", DEFAULT_MAX_AGE_MS * 10)

    const removed = cleanStaleTmpDirs({ sessionID: "ses_current", base })

    assert.deepEqual(removed, [])
    assert.ok(existsSync(current))
  })

  it("leaves symlinked entries alone and never follows them", () => {
    const base = makeBase()
    const outside = makeBase()
    const target = join(outside, "real-dir")
    mkdirSync(target, { recursive: true })
    writeFileSync(join(target, "keep.txt"), "keep\n", "utf-8")

    const root = codeopsTmpRoot(base)
    mkdirSync(root, { recursive: true })
    const link = join(root, "ses_link")
    symlinkSync(target, link, "dir")
    const past = new Date(Date.now() - DEFAULT_MAX_AGE_MS * 2)
    utimesSync(link, past, past)

    const removed = cleanStaleTmpDirs({ sessionID: "ses_other", base })

    assert.deepEqual(removed, [])
    assert.ok(lstatSync(link).isSymbolicLink(), "symlink itself must survive")
    assert.ok(existsSync(join(target, "keep.txt")), "symlink target must survive")
  })

  it("leaves plain files at the root alone", () => {
    const base = makeBase()
    const root = codeopsTmpRoot(base)
    mkdirSync(root, { recursive: true })
    const file = join(root, "not-a-dir.txt")
    writeFileSync(file, "keep\n", "utf-8")

    assert.deepEqual(cleanStaleTmpDirs({ sessionID: "ses_other", base }), [])
    assert.ok(existsSync(file))
  })

  it("sweeps every stale directory in one pass", () => {
    const base = makeBase()
    const first = makeSessionDir(base, "ses_one", DEFAULT_MAX_AGE_MS + 1)
    const second = makeSessionDir(base, "ses_two", DEFAULT_MAX_AGE_MS + 1)

    const removed = cleanStaleTmpDirs({ sessionID: "ses_current", base }).sort()

    assert.deepEqual(removed, [first, second].sort())
    assert.deepEqual(readdirSync(codeopsTmpRoot(base)), [])
  })
})

describe("exact session-directory removal", () => {
  it("removes one session directory and leaves the rest", () => {
    const base = makeBase()
    const target = makeSessionDir(base, "ses_done")
    const other = makeSessionDir(base, "ses_live")

    assert.equal(removeSessionTmpDir("ses_done", base), true)
    assert.ok(!existsSync(target))
    assert.ok(existsSync(other))
  })

  it("reports false for a missing directory", () => {
    const base = makeBase()
    assert.equal(removeSessionTmpDir("ses_missing", base), false)
  })

  it("refuses to remove a symlink planted at the session path", () => {
    const base = makeBase()
    const outside = makeBase()
    const target = join(outside, "real-dir")
    mkdirSync(target, { recursive: true })

    const root = codeopsTmpRoot(base)
    mkdirSync(root, { recursive: true })
    symlinkSync(target, join(root, "ses_link"), "dir")

    assert.equal(removeSessionTmpDir("ses_link", base), false)
    assert.ok(existsSync(target), "symlink target must survive")
  })
})
