#!/usr/bin/env node
/**
 * Git change detection and baseline resolution for the selector.
 *
 * The selector never guesses where a change began. This module resolves one
 * base from an explicit value, an environment hint, the last successful full-run
 * marker, or the branch policy, and then collects every changed path — committed,
 * staged, unstaged, renamed, deleted, and untracked.
 *
 * All shell work goes through `spawnSync` with an argv array. No path is ever
 * interpolated into a shell string, and the Git calls are read-only.
 *
 * @module lib/test-selection-changes
 */

import { spawnSync } from "node:child_process"

/**
 * Error raised when a baseline cannot be resolved or Git cannot answer.
 *
 * The `reason` value is stable and becomes the selection result's fallback
 * reason (`marker-missing`, `unresolved-base`, `git-error`).
 */
export class SelectionError extends Error {
  /**
   * @param {string} reason Stable reason code.
   * @param {string} message Human-readable explanation.
   */
  constructor(reason, message) {
    super(message)
    this.name = "SelectionError"
    this.reason = reason
  }
}

/**
 * Run one read-only Git command.
 *
 * @param {string[]} args Git arguments after the program name.
 * @param {object} [options] Execution options.
 * @param {string} [options.cwd] Repository root.
 * @returns {{status: number, stdout: string, stderr: string}} Process result.
 */
export function defaultRunGit(args, { cwd } = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}

/**
 * Parse `git diff --name-status -z` output.
 *
 * A rename or copy entry carries two paths after its status token; every other
 * entry carries one. Both sides of a rename count as changed so a source move
 * never hides its old or new owner.
 *
 * @param {string} output NUL-separated Git output.
 * @returns {{changed: string[], renames: Array<{from: string, to: string, score: string}>, deleted: string[]}}
 * @example
 * parseNameStatusZ("R100\0a.ts\0b.ts\0D\0old.ts\0")
 */
export function parseNameStatusZ(output) {
  const parts = String(output ?? "").split("\0")
  const changed = []
  const renames = []
  const deleted = []
  const seen = new Set()

  const push = (path) => {
    if (!path || seen.has(path)) return
    seen.add(path)
    changed.push(path)
  }

  for (let index = 0; index < parts.length; index += 1) {
    const status = parts[index]
    if (!status) continue
    const letter = status[0]
    if (letter === "R" || letter === "C") {
      const from = parts[index + 1]
      const to = parts[index + 2]
      index += 2
      if (from && to) {
        push(from)
        push(to)
        renames.push({ from, to, score: status.slice(1) })
      }
      continue
    }
    const path = parts[index + 1]
    index += 1
    if (!path) continue
    push(path)
    if (letter === "D") deleted.push(path)
  }
  return { changed, renames, deleted }
}

/**
 * Parse NUL-separated `git ls-files -z` output into paths.
 *
 * @param {string} output NUL-separated output.
 * @returns {string[]} Non-empty paths.
 */
export function parseNullList(output) {
  return String(output ?? "")
    .split("\0")
    .filter((value) => value.length > 0)
}

/**
 * Check whether a value looks like a Git object hash.
 *
 * @param {string} value Candidate value.
 * @returns {boolean} `true` for a 40- or 64-character hexadecimal string.
 */
function isObjectHash(value) {
  return /^[0-9a-f]{40}$|^[0-9a-f]{64}$/i.test(value)
}

/**
 * Normalize a branch name for classification.
 *
 * @param {string} branch Raw branch or ref.
 * @returns {string} Branch name without `refs/heads/` or `refs/remotes/`.
 */
function branchName(branch) {
  return String(branch ?? "")
    .replace(/^refs\/heads\//, "")
    .replace(/^refs\/remotes\/[^/]+\//, "")
}

/**
 * Resolve the base for change detection.
 *
 * Priority is explicit `--baseline`/`--since`, `CODEOPS_TEST_BASE`, the
 * last-full marker, then the branch policy. An integration branch with no valid
 * marker fails closed; it never falls back to `HEAD`, because an empty diff
 * would silently skip every test.
 *
 * @param {object} input Resolution input.
 * @param {string} [input.baseline] Explicit tree or ref.
 * @param {string} [input.lastFullSha] Last successful full-run SHA.
 * @param {string} [input.branch] Current branch or ref.
 * @param {boolean} [input.isTag=false] Whether the ref is a release tag.
 * @param {Record<string, string>} [input.env] Environment values.
 * @param {(args: string[], options?: object) => {status: number, stdout: string}} [input.runGit] Git runner.
 * @returns {{kind: "tree"|"ref", value: string}} Resolved base.
 * @throws {SelectionError} When no safe base exists.
 * @example
 * resolveBaseline({ branch: "feature/x", runGit: defaultRunGit })
 */
export function resolveBaseline({
  baseline,
  lastFullSha,
  branch,
  isTag = false,
  env = {},
  runGit = defaultRunGit,
} = {}) {
  const explicit = baseline ?? env.CODEOPS_TEST_BASE
  if (explicit) {
    const check = runGit(["rev-parse", "--verify", `${explicit}^{object}`])
    if (check.status !== 0) throw new SelectionError("unresolved-base", `cannot resolve base ${explicit}`)
    return { kind: isObjectHash(explicit) ? "tree" : "ref", value: explicit }
  }

  const name = branchName(branch)
  const marker = lastFullSha ?? env.CODEOPS_LAST_FULL_SHA ?? null

  if (name === "main" || name === "master") {
    if (!marker) throw new SelectionError("marker-missing", `${name} needs a last successful full-run marker`)
    const ancestor = runGit(["merge-base", "--is-ancestor", marker, "HEAD"])
    if (ancestor.status !== 0) {
      throw new SelectionError("marker-missing", `marker ${marker} is not an ancestor of HEAD`)
    }
    return { kind: "ref", value: marker }
  }

  if (isTag || /^v\d/.test(name)) {
    const previous = runGit(["describe", "--tags", "--abbrev=0", "--match", "v*", `${name}^`])
    if (previous.status === 0 && previous.stdout.trim()) {
      return { kind: "ref", value: previous.stdout.trim() }
    }
    throw new SelectionError("unresolved-base", `no previous release tag before ${name}`)
  }

  if (name.startsWith("release/") || name.startsWith("release-") || name.startsWith("hotfix/") || name.startsWith("hotfix-")) {
    const previous = runGit(["describe", "--tags", "--abbrev=0", "--match", "v*", "HEAD^"])
    if (previous.status === 0 && previous.stdout.trim()) {
      return { kind: "ref", value: previous.stdout.trim() }
    }
    return mergeBaseWithIntegration({ runGit, branch: name })
  }

  return mergeBaseWithIntegration({ runGit, branch: name })
}

/**
 * Find the merge base with the first available integration branch.
 *
 * @param {object} input Resolution input.
 * @param {(args: string[], options?: object) => {status: number, stdout: string}} input.runGit Git runner.
 * @param {string} input.branch Branch being resolved (for the error message).
 * @returns {{kind: "ref", value: string}} Merge-base commit.
 * @throws {SelectionError} When neither integration branch exists.
 */
function mergeBaseWithIntegration({ runGit, branch }) {
  for (const integration of ["main", "master"]) {
    const result = runGit(["merge-base", "HEAD", integration])
    const value = result.stdout.trim()
    if (result.status === 0 && value) return { kind: "ref", value }
  }
  throw new SelectionError("unresolved-base", `cannot find an integration base for ${branch}`)
}

/**
 * Collect every changed path for a selection run.
 *
 * @param {object} input Collection input.
 * @param {string} input.root Repository root.
 * @param {string} [input.baseline] Explicit base.
 * @param {string} [input.lastFullSha] Last successful full-run SHA.
 * @param {string} [input.branch] Current branch.
 * @param {boolean} [input.isTag=false] Whether the ref is a tag.
 * @param {string[]} [input.include=[]] Extra paths that must be considered changed.
 * @param {Record<string, string>} [input.env] Environment values.
 * @param {(args: string[], options?: object) => {status: number, stdout: string, stderr: string}} [input.runGit] Git runner.
 * @returns {{base: {kind: string, value: string}, changed: string[], renames: Array<object>, deleted: string[], warnings: object[]}}
 * @throws {SelectionError} When Git cannot answer.
 * @example
 * const changes = collectChanges({ root: process.cwd(), baseline: treeSha, include: ["spec.test.ts"] })
 */
export function collectChanges({
  root,
  baseline,
  lastFullSha,
  branch,
  isTag = false,
  include = [],
  env = {},
  runGit = defaultRunGit,
} = {}) {
  const base = resolveBaseline({ baseline, lastFullSha, branch, isTag, env, runGit })

  const diff = runGit(["diff", "--name-status", "-z", base.value], { cwd: root })
  if (diff.status !== 0) {
    throw new SelectionError("git-error", `git diff against ${base.value} failed`)
  }
  const parsed = parseNameStatusZ(diff.stdout)

  const untracked = runGit(["ls-files", "--others", "--exclude-standard", "-z"], { cwd: root })
  if (untracked.status !== 0) {
    throw new SelectionError("git-error", "git ls-files failed")
  }

  const changed = [...new Set([...parsed.changed, ...parseNullList(untracked.stdout), ...include])].sort()
  return {
    base,
    changed,
    renames: parsed.renames,
    deleted: parsed.deleted,
    warnings: [],
  }
}
