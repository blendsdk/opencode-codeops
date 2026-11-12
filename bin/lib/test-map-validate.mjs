#!/usr/bin/env node
/**
 * Test-map validation and health checks.
 *
 * Validation answers two different questions:
 *
 * 1. Is the map structurally usable? Bad schemas, commands, paths, and
 *    dependency cycles are errors because selection cannot proceed safely.
 * 2. Is the map healthy? Unclassified files, shared test ownership, and slices
 *    without a fast or release tier are warnings that become errors under
 *    `--strict`.
 *
 * The split matters: a recoverable selection problem must fall back to the full
 * suite rather than blocking a developer, while release CI can demand a clean
 * map. `exitCodeFor` is the single place that turns the report into the stable
 * exit codes.
 *
 * @module lib/test-map-validate
 */

import { basename } from "node:path"

import { isSafeRepoPath, normalizePolicy, normalizeRepoPath } from "./test-map.mjs"
import {
  globsIntersect,
  matchesAnyGlob,
  validateGlobPattern,
} from "./test-selection-glob.mjs"

/** Group tiers understood by the selector. */
export const GROUP_TIERS = Object.freeze(["task", "phase", "release", "acceptance"])

/** Branch classes understood by the classifier. */
export const BRANCH_CLASSES = Object.freeze(["integration", "feature", "release", "acceptance"])

/** Acceptance modes understood by the provenance and plan layers. */
export const ACCEPTANCE_MODES = Object.freeze(["automated", "manual", "external"])

/** Per-slice acceptance exception modes. */
export const SLICE_ACCEPTANCE_MODES = Object.freeze(["manual", "external", "na"])

/**
 * Rules that are warnings in normal mode and errors under `--strict`.
 *
 * Every other rule is a malformed-map error. Keeping this list explicit makes
 * the severity contract auditable and prevents a new rule from silently
 * becoming fatal.
 */
export const WARNING_CODES = Object.freeze([
  "map.overlap",
  "map.orphan-test",
  "map.unknown-source",
  "map.slice-no-task",
  "map.slice-no-release",
  "map.group.slow",
])

/** Conventional test roots used when the policy does not override them. */
const CONVENTIONAL_TEST_ROOTS = ["test/", "tests/", "spec/", "__tests__/"]

/**
 * File-name shapes that identify a test even when no group claims it.
 *
 * A test root is a directory, so every file below it looks like a candidate.
 * Requiring a test-like name keeps ordinary sources and fixtures from being
 * reported as orphan tests.
 */
const TEST_FILE_NAME = /(\.test\.|\.spec\.|_test\.|^test_.*\.(py|js|ts|tsx|jsx)$|Tests?\.(java|kt|cs|php)$|\.rs$)/

/**
 * Build one diagnostic entry.
 *
 * @param {string} code Stable machine code.
 * @param {string} message Human-readable explanation.
 * @param {string} [path] Related repository path.
 * @returns {{code: string, message: string, path?: string}} Diagnostic.
 */
function diagnostic(code, message, path) {
  return path ? { code, message, path } : { code, message }
}

/**
 * Check that a value is a flat argv array of non-empty strings.
 *
 * @param {unknown} value Candidate argv.
 * @returns {boolean} `true` for a command that can be spawned directly.
 */
function isArgv(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((token) => typeof token === "string" && token.length > 0)
  )
}

/**
 * Check that a full command is a flat argv or an array of flat argv arrays.
 *
 * A single string, or a one-element array containing spaces, would need shell
 * parsing and is therefore rejected. Shell metacharacters are also rejected so
 * the runner never has to decide whether a token is safe.
 *
 * @param {unknown} value Candidate full command.
 * @returns {boolean} `true` when the value is argv-safe.
 */
function isFullCommand(value) {
  if (!Array.isArray(value) || value.length === 0) return false
  if (value.every((token) => typeof token === "string")) return isArgv(value) && !value.some(hasShellSyntax)
  if (value.every((item) => Array.isArray(item))) return value.every((item) => isArgv(item) && !item.some(hasShellSyntax))
  return false
}

/**
 * Detect whitespace or shell metacharacters inside one argv token.
 *
 * @param {string} token Command token.
 * @returns {boolean} `true` when the token would require shell interpretation.
 */
function hasShellSyntax(token) {
  return /[\s;&|`$<>]/.test(token)
}

/**
 * Validate an acceptance record attached to a slice group.
 *
 * @param {unknown} value Candidate record.
 * @returns {boolean} `true` when mode and reason are valid.
 */
function isSliceAcceptance(value) {
  return (
    value &&
    typeof value === "object" &&
    SLICE_ACCEPTANCE_MODES.includes(value.mode) &&
    typeof value.reason === "string" &&
    value.reason.trim().length > 0
  )
}

/**
 * Validate the map structure and, when a tracked-file list is supplied, its
 * ownership and slice health.
 *
 * @param {object} map Loaded map with `schema`, `policy`, and `groups`.
 * @param {object} [options] Validation options.
 * @param {string[]|null} [options.files=null] Tracked repository files for health checks.
 * @returns {{errors: Array<{code: string, message: string, path?: string}>, warnings: Array<{code: string, message: string, path?: string}>}}
 * @example
 * const report = validateMap(loaded.map, { files: trackedFiles })
 */
export function validateMap(map, { files = null } = {}) {
  const errors = []
  const warnings = []
  const add = (code, message, path) => {
    const entry = diagnostic(code, message, path)
    if (WARNING_CODES.includes(code)) warnings.push(entry)
    else errors.push(entry)
  }

  if (!map || typeof map !== "object" || Array.isArray(map)) {
    add("map.schema", "the map must be an object")
    return { errors, warnings }
  }
  if (map.schema !== 1) add("map.schema", `unsupported map schema: ${String(map.schema)}`)

  const policy = map.policy && typeof map.policy === "object" ? normalizePolicy(map.policy) : null
  if (!policy) {
    add("map.schema", "the map must contain a policy object")
    return { errors, warnings }
  }

  validatePolicy(policy, add)
  const groups = validateGroups(map, policy, add)
  validatePolicyReferences(policy, groups, add)
  validateDependencies(groups, add)
  validateIgnores(policy, groups, add)
  validateSlices(groups, add)

  if (Array.isArray(files)) validateHealth(groups, policy, files, add)

  return { errors, warnings }
}

/**
 * Validate policy fields shared by both map layouts.
 *
 * @param {object} policy Normalized policy.
 * @param {(code: string, message: string, path?: string) => void} add Diagnostic sink.
 */
function validatePolicy(policy, add) {
  if (!isFullCommand(policy.full)) {
    add("map.full", "policy.full must be a non-empty argv array or an array of argv arrays without shell syntax")
  }

  const budgets = policy.budgets
  if (
    !budgets ||
    typeof budgets.taskTargetSeconds !== "number" ||
    typeof budgets.taskAcceptableSeconds !== "number" ||
    budgets.taskTargetSeconds < 0 ||
    budgets.taskAcceptableSeconds < budgets.taskTargetSeconds
  ) {
    add("map.schema", "policy.budgets must contain non-negative target and acceptable seconds")
  }

  if (typeof policy.fullThreshold !== "number" || policy.fullThreshold < 0 || policy.fullThreshold > 1) {
    add("map.threshold", "policy.fullThreshold must be a number between 0 and 1")
  }
  if (typeof policy.caseSensitive !== "boolean") {
    add("map.schema", "policy.caseSensitive must be a boolean")
  }

  validateBranchPolicy(policy.branches, add)

  if (!Array.isArray(policy.ignorePaths)) {
    add("map.schema", "policy.ignorePaths must be an array")
  } else {
    for (const entry of policy.ignorePaths) {
      if (!entry || typeof entry !== "object" || !isSafeRepoPath(entry.glob)) {
        add("map.path", "ignorePaths entries must contain a safe glob", entry?.glob)
        continue
      }
      if (typeof entry.reason !== "string" || entry.reason.trim().length === 0) {
        add("map.ignore-reason", `ignore path ${entry.glob} needs a reason`, entry.glob)
      }
    }
  }

  if (!Array.isArray(policy.fullOnPaths) || !policy.fullOnPaths.every((path) => isSafeRepoPath(path))) {
    add("map.path", "policy.fullOnPaths must contain safe repository paths")
  }

  if (!Array.isArray(policy.prSmoke) || !policy.prSmoke.every((id) => typeof id === "string")) {
    add("map.schema", "policy.prSmoke must be an array of group IDs")
  }

  if (policy.testRoots !== null) {
    if (!Array.isArray(policy.testRoots) || !policy.testRoots.every((root) => isSafeRepoPath(root))) {
      add("map.path", "policy.testRoots must contain safe test-root paths")
    }
  }

  const acceptance = policy.acceptance
  if (
    !acceptance ||
    typeof acceptance !== "object" ||
    !ACCEPTANCE_MODES.includes(acceptance.mode) ||
    !Array.isArray(acceptance.groups ?? [])
  ) {
    add("map.schema", "policy.acceptance must declare a valid mode and a groups array")
  } else if ((acceptance.groups ?? []).some((id) => typeof id !== "string")) {
    add("map.schema", "policy.acceptance.groups must contain group IDs")
  }

  if (!policy.requirements || typeof policy.requirements !== "object" || Array.isArray(policy.requirements)) {
    add("map.requires", "policy.requirements must be an object")
  } else {
    for (const [name, probe] of Object.entries(policy.requirements)) {
      if (!probe || typeof probe !== "object" || !isArgv(probe.check)) {
        add("map.requires", `requirement ${name} needs an argv check`, name)
      }
    }
  }
}

/**
 * Validate branch pattern lists and the unknown-class fallback.
 *
 * @param {object} branches Branch policy.
 * @param {(code: string, message: string, path?: string) => void} add Diagnostic sink.
 */
function validateBranchPolicy(branches, add) {
  if (!branches || typeof branches !== "object") {
    add("map.branch", "policy.branches must be an object")
    return
  }
  for (const key of ["integration", "feature", "release", "acceptance", "releaseTags"]) {
    const patterns = branches[key]
    if (!Array.isArray(patterns)) {
      add("map.branch", `policy.branches.${key} must be an array`)
      continue
    }
    for (const pattern of patterns) {
      const result = validateGlobPattern(pattern)
      if (!result.ok) add("map.branch", `invalid branch pattern ${JSON.stringify(pattern)}: ${result.message}`)
    }
  }
  if (!BRANCH_CLASSES.includes(branches.unknown)) {
    add("map.branch", `policy.branches.unknown must be one of ${BRANCH_CLASSES.join(", ")}`)
  }
}

/**
 * Validate each group's fields and return the usable group list.
 *
 * Groups with structural defects are skipped by later dependency and health
 * checks so one bad entry does not produce a cascade of confusing errors.
 *
 * @param {object} map Map under validation.
 * @param {object} policy Normalized policy.
 * @param {(code: string, message: string, path?: string) => void} add Diagnostic sink.
 * @returns {object[]} Structurally usable groups.
 */
function validateGroups(map, policy, add) {
  if (!Array.isArray(map.groups)) {
    add("map.group", "the map must contain a groups array")
    return []
  }

  const seen = new Set()
  const usable = []

  for (const group of map.groups) {
    if (!group || typeof group !== "object") {
      add("map.group", "each group must be an object")
      continue
    }
    const label = typeof group.id === "string" ? group.id : "(unnamed group)"
    let valid = true

    if (typeof group.id !== "string" || group.id.trim() === "") {
      add("map.group", "group.id must be a non-empty string")
      valid = false
    } else if (seen.has(group.id)) {
      add("map.duplicate-id", `duplicate group id: ${group.id}`, group.id)
      valid = false
    } else {
      seen.add(group.id)
    }

    if (typeof group.slice !== "string" || group.slice.trim() === "") {
      add("map.group", `group ${label} needs a slice`)
      valid = false
    }
    if (!GROUP_TIERS.includes(group.tier)) {
      add("map.group", `group ${label} has invalid tier ${String(group.tier)}`)
      valid = false
    }
    if (!isArgv(group.run?.command)) {
      add("map.command", `group ${label} needs a non-empty argv command`)
      valid = false
    }
    if (group.run?.cwd !== undefined && !isSafeRepoPath(group.run.cwd)) {
      add("map.cwd", `group ${label} cwd must stay inside the repository`, group.run.cwd)
      valid = false
    }

    const sources = group.sources
    if (!Array.isArray(sources) || !sources.every((path) => typeof path === "string")) {
      add("map.group", `group ${label} needs a sources array`)
      valid = false
    } else if (sources.length === 0 && group.alwaysRun !== true && !group.id?.startsWith("shared.")) {
      add("map.group", `group ${label} has no sources and is not always-run or shared`)
    }
    for (const path of Array.isArray(sources) ? sources : []) {
      if (!isSafeRepoPath(path)) add("map.path", `group ${label} has unsafe source ${JSON.stringify(path)}`, path)
    }

    const tests = group.tests
    const targetBased = !isArgv(group.run?.command) || !group.run.command.some((token) => token.includes("{tests}"))
    if (tests !== undefined && (!Array.isArray(tests) || !tests.every((path) => typeof path === "string"))) {
      add("map.group", `group ${label} tests must be an array of paths`)
      valid = false
    } else if (tests === undefined && !targetBased) {
      add("map.group", `group ${label} is file-based but has no tests`)
      valid = false
    }
    for (const path of Array.isArray(tests) ? tests : []) {
      if (!isSafeRepoPath(path)) add("map.path", `group ${label} has unsafe test ${JSON.stringify(path)}`, path)
    }

    if (group.dependsOn !== undefined && (!Array.isArray(group.dependsOn) || !group.dependsOn.every((id) => typeof id === "string"))) {
      add("map.group", `group ${label} dependsOn must be an array of IDs`)
      valid = false
    }
    if (group.alwaysRun !== undefined && typeof group.alwaysRun !== "boolean") {
      add("map.group", `group ${label} alwaysRun must be a boolean`)
    }
    if (group.alwaysRun === true && group.tier !== "task") {
      add("map.always-run-tier", `group ${label} is alwaysRun but not task tier`)
      valid = false
    }
    if (group.durationSec !== undefined && (typeof group.durationSec !== "number" || group.durationSec < 0)) {
      add("map.group", `group ${label} durationSec must be a non-negative number`)
    }
    if (group.parallelSafe !== undefined && typeof group.parallelSafe !== "boolean") {
      add("map.group", `group ${label} parallelSafe must be a boolean`)
    }
    if (group.acceptance !== undefined && !isSliceAcceptance(group.acceptance)) {
      add("map.acceptance", `group ${label} has an invalid acceptance record`)
    }

    const requires = group.requires
    if (requires !== undefined) {
      if (!Array.isArray(requires) || !requires.every((name) => typeof name === "string")) {
        add("map.requires", `group ${label} requires must be an array of names`)
      } else {
        for (const name of requires) {
          if (!policy.requirements?.[name]?.check) {
            add("map.requires", `group ${label} requires ${name} but policy.requirements has no probe`, name)
          }
        }
      }
    }

    if (valid) usable.push(group)
  }
  return usable
}

/**
 * Validate policy references to group IDs.
 *
 * Smoke groups and acceptance groups are optional, but a typo in either list
 * silently changes what the gate runs. Report it as a dependency error instead.
 *
 * @param {object} policy Normalized policy.
 * @param {object[]} groups Usable groups.
 * @param {(code: string, message: string, path?: string) => void} add Diagnostic sink.
 */
function validatePolicyReferences(policy, groups, add) {
  const ids = new Set(groups.map((group) => group.id))
  for (const id of policy.prSmoke ?? []) {
    if (!ids.has(id)) add("map.dependency", `prSmoke references unknown group ${id}`, id)
  }
  for (const id of policy.acceptance?.groups ?? []) {
    if (!ids.has(id)) add("map.dependency", `acceptance.groups references unknown group ${id}`, id)
  }
}

/**
 * Validate dependency references and detect cycles.
 *
 * @param {object[]} groups Usable groups.
 * @param {(code: string, message: string, path?: string) => void} add Diagnostic sink.
 */
function validateDependencies(groups, add) {
  const ids = new Set(groups.map((group) => group.id))
  for (const group of groups) {
    for (const dependency of group.dependsOn ?? []) {
      if (!ids.has(dependency)) {
        add("map.dependency", `group ${group.id} depends on unknown group ${dependency}`, dependency)
      }
    }
  }

  const visiting = new Set()
  const visited = new Set()
  const visit = (id, trail) => {
    if (visiting.has(id)) {
      add("map.cycle", `dependency cycle: ${[...trail, id].join(" -> ")}`)
      return true
    }
    if (visited.has(id)) return false
    visiting.add(id)
    const group = groups.find((candidate) => candidate.id === id)
    for (const dependency of group?.dependsOn ?? []) {
      if (visit(dependency, [...trail, id])) return true
    }
    visiting.delete(id)
    visited.add(id)
    return false
  }
  for (const group of groups) {
    if (visit(group.id, [])) break
  }
}

/**
 * Reject ignore rules that swallow an owned source, test, or full-on path.
 *
 * @param {object} policy Normalized policy.
 * @param {object[]} groups Usable groups.
 * @param {(code: string, message: string, path?: string) => void} add Diagnostic sink.
 */
function validateIgnores(policy, groups, add) {
  const ignores = Array.isArray(policy.ignorePaths) ? policy.ignorePaths.filter((entry) => entry?.glob) : []
  if (ignores.length === 0) return

  const protectedGlobs = [
    ...groups.flatMap((group) => [...(group.sources ?? []), ...(group.tests ?? [])]),
    ...(Array.isArray(policy.fullOnPaths) ? policy.fullOnPaths : []),
  ]
  for (const entry of ignores) {
    for (const protectedGlob of protectedGlobs) {
      if (globsIntersect(entry.glob, protectedGlob)) {
        add("map.ignore-overlap", `ignore ${entry.glob} overlaps owned path ${protectedGlob}`, entry.glob)
        break
      }
    }
  }
}

/**
 * Check the slice contract: a fast task tier and a release/acceptance path.
 *
 * @param {object[]} groups Usable groups.
 * @param {(code: string, message: string, path?: string) => void} add Diagnostic sink.
 */
function validateSlices(groups, add) {
  const slices = new Map()
  for (const group of groups) {
    if (!slices.has(group.slice)) slices.set(group.slice, [])
    slices.get(group.slice).push(group)
  }

  for (const [slice, members] of slices) {
    if (!members.some((group) => group.tier === "task")) {
      add("map.slice-no-task", `slice ${slice} has no task-tier group`, slice)
    }
    const hasRelease = members.some((group) => group.tier === "release" || group.tier === "acceptance")
    const hasAcceptanceRecord = members.some((group) => isSliceAcceptance(group.acceptance))
    if (!hasRelease && !hasAcceptanceRecord) {
      add("map.slice-no-release", `slice ${slice} has no release/acceptance group or acceptance record`, slice)
    }
  }
}

/**
 * Compute the test roots used for orphan and ownership checks.
 *
 * @param {object[]} groups Usable groups.
 * @param {object} policy Normalized policy.
 * @returns {string[]} Repo-relative directory prefixes with trailing slashes.
 */
function deriveTestRoots(groups, policy) {
  if (Array.isArray(policy.testRoots)) {
    return policy.testRoots.map((root) => (root.endsWith("/") ? root : `${root}/`))
  }
  const roots = new Set(CONVENTIONAL_TEST_ROOTS)
  for (const group of groups) {
    for (const pattern of group.tests ?? []) {
      const wildcard = pattern.search(/[*?[]/)
      const prefix = wildcard === -1 ? pattern : pattern.slice(0, wildcard)
      const slash = prefix.lastIndexOf("/")
      if (slash > 0) roots.add(prefix.slice(0, slash + 1))
    }
  }
  return [...roots]
}

/**
 * Check file ownership, empty groups, orphans, and unclassified sources.
 *
 * This runs only when the caller supplies the tracked-file list, because the
 * selector must never scan the whole repository during normal selection.
 *
 * @param {object[]} groups Usable groups.
 * @param {object} policy Normalized policy.
 * @param {string[]} files Tracked repository files.
 * @param {(code: string, message: string, path?: string) => void} add Diagnostic sink.
 */
function validateHealth(groups, policy, files, add) {
  const normalized = files.map(normalizeRepoPath)
  const options = { caseSensitive: policy.caseSensitive !== false }
  const testRoots = deriveTestRoots(groups, policy)
  const inTestArea = (file) => testRoots.some((root) => file.startsWith(root))
  const looksLikeTest = (file) => TEST_FILE_NAME.test(basename(file))
  const isTestFile = (file) =>
    groups.some((group) => Array.isArray(group.tests) && matchesAnyGlob(file, group.tests, options)) ||
    (inTestArea(file) && looksLikeTest(file))

  for (const group of groups) {
    if (Array.isArray(group.tests) && group.tests.length > 0) {
      const matched = normalized.some((file) => matchesAnyGlob(file, group.tests, options))
      if (!matched) add("map.empty-group", `group ${group.id} matches no tracked test file`, group.id)
    }
    if (typeof group.durationSec === "number" && group.durationSec > 180) {
      add("map.group.slow", `group ${group.id} estimates ${group.durationSec}s, above the acceptable budget`, group.id)
    }
  }

  const owners = new Map()
  for (const file of normalized.filter(isTestFile)) {
    const matching = groups.filter((group) =>
      Array.isArray(group.tests) && matchesAnyGlob(file, group.tests, options),
    )
    for (const group of matching) {
      if (!owners.has(file)) owners.set(file, new Set())
      owners.get(file).add(group.id)
    }
  }
  for (const [file, ids] of owners) {
    if (ids.size > 1) add("map.overlap", `test ${file} is owned by ${[...ids].sort().join(", ")}`, file)
  }
  for (const file of normalized.filter(isTestFile)) {
    if (!owners.has(file)) add("map.orphan-test", `test ${file} has no owning group`, file)
  }

  const fullOn = Array.isArray(policy.fullOnPaths) ? policy.fullOnPaths : []
  const ignores = Array.isArray(policy.ignorePaths) ? policy.ignorePaths.map((entry) => entry.glob) : []
  for (const file of normalized) {
    if (inTestArea(file) || isTestFile(file)) continue
    const owned = groups.some((group) => matchesAnyGlob(file, group.sources ?? [], options))
    if (owned) continue
    if (matchesAnyGlob(file, fullOn, options)) continue
    if (matchesAnyGlob(file, ignores, options)) continue
    add("map.unknown-source", `source ${file} is not owned, full-on, or ignored`, file)
  }
}

/**
 * Turn a validation report into the documented exit code.
 *
 * Structural errors always exit 3. Drift warnings exit 4 only when the caller
 * asked for strict mode; otherwise they are advisory and exit 0.
 *
 * @param {{errors: unknown[], warnings: unknown[]}} report Validation report.
 * @param {object} [options] Exit options.
 * @param {boolean} [options.strict=false] Whether warnings are fatal.
 * @returns {number} 3 for errors, 4 for strict-only failure, 0 otherwise.
 * @example
 * process.exitCode = exitCodeFor(report, { strict: true })
 */
export function exitCodeFor(report, { strict = false } = {}) {
  if (report.errors.length > 0) return 3
  if (strict && report.warnings.length > 0) return 4
  return 0
}
