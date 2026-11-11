#!/usr/bin/env node
/**
 * Pure test-selection algorithm.
 *
 * Given a loaded map, a change set, and a gate, decide which groups must run.
 * The function is pure: it never reads Git, executes a command, or scans the
 * repository. That keeps the most failure-sensitive logic easy to test and
 * makes the CLI's job a thin I/O wrapper.
 *
 * The safety rule is simple: any uncertainty returns `mode: "full"` with a
 * visible reason. A partial selection is never produced from an incomplete or
 * malformed map.
 *
 * @module lib/test-selection
 */

import { isTargetBasedGroup, normalizeRepoPath } from "./test-map.mjs"
import { matchesAnyGlob } from "./test-selection-glob.mjs"

/** Gates that may narrow the run to less than every group. */
export const PARTIAL_GATES = Object.freeze(["task", "phase", "pr"])

/** Every gate the selector accepts. */
export const ALL_GATES = Object.freeze(["task", "phase", "pr", "release", "acceptance", "nightly"])

/** Tiers allowed at each gate; `null` means every tier. */
const GATE_TIERS = Object.freeze({
  task: Object.freeze(["task"]),
  phase: Object.freeze(["task", "phase"]),
  pr: Object.freeze(["task", "phase"]),
  release: null,
  acceptance: null,
  nightly: null,
})

/** Stable reason order used in output and explanations. */
const REASON_ORDER = Object.freeze([
  "direct-source",
  "direct-test",
  "included",
  "dependent",
  "always-run",
  "smoke",
  "gate-all",
])

/**
 * Add one reason to a group's reason set.
 *
 * @param {Map<string, Set<string>>} reasons Reason sets by group ID.
 * @param {string} id Group ID.
 * @param {string} reason Stable reason token.
 */
function addReason(reasons, id, reason) {
  if (!reasons.has(id)) reasons.set(id, new Set())
  reasons.get(id).add(reason)
}

/**
 * Sort reasons into the documented order.
 *
 * @param {Set<string>} values Reason set.
 * @returns {string[]} Ordered reasons.
 */
function orderedReasons(values) {
  return [...values].sort((left, right) => REASON_ORDER.indexOf(left) - REASON_ORDER.indexOf(right))
}

/**
 * Build the full-suite result.
 *
 * @param {object} input Result input.
 * @param {string} input.reason Stable fallback reason.
 * @param {object|null} input.policy Policy, when a map exists.
 * @param {string|null} input.mapHash Map hash.
 * @param {string} input.gate Gate.
 * @param {object|null} input.base Resolved base.
 * @param {string[]} input.changed Changed paths.
 * @param {string[]} input.skipped Group IDs that did not run.
 * @param {object[]} input.warnings Accumulated warnings.
 * @param {string[]} [input.unknownPaths] Paths with no owner.
 * @returns {object} Full selection result.
 */
function fullResult({ reason, policy, mapHash, gate, base, changed, skipped, warnings, unknownPaths = [] }) {
  const commands = expandFullCommands(policy)
  return {
    schema: 1,
    mode: "full",
    gate,
    base: base ?? null,
    mapHash: mapHash ?? null,
    changed,
    selected: [],
    deferred: [],
    skipped,
    commands,
    budget: { estimatedSec: 0, status: "not-applicable" },
    warnings,
    reason,
    fullCommand: policy?.full ?? null,
    unknownPaths,
  }
}

/**
 * Expand a policy's full command into runner-shaped commands.
 *
 * @param {object|null} policy Map policy.
 * @returns {Array<{id: string, argv: string[], cwd: string}>} Commands to run.
 */
function expandFullCommands(policy) {
  const full = policy?.full
  if (!Array.isArray(full) || full.length === 0) return []
  if (full.every((token) => typeof token === "string")) {
    return [{ id: "full", argv: [...full], cwd: "." }]
  }
  return full.map((argv, index) => ({ id: `full.${index + 1}`, argv: [...argv], cwd: "." }))
}

/**
 * Compute the task-budget status without ever dropping a group.
 *
 * @param {object[]} selected Selected groups.
 * @param {object} policy Map policy.
 * @returns {{estimatedSec: number, status: string, breakdown?: object[]}} Budget summary.
 */
function budgetFor(selected, policy) {
  const taskGroups = selected.filter((group) => group.tier === "task")
  const estimatedSec = taskGroups.reduce((total, group) => total + (group.durationSec ?? 0), 0)
  const target = policy.budgets?.taskTargetSeconds ?? 120
  const acceptable = policy.budgets?.taskAcceptableSeconds ?? 180
  const status = estimatedSec <= target ? "within-target" : estimatedSec <= acceptable ? "acceptable" : "over-budget"
  if (status !== "over-budget") return { estimatedSec, status }
  return {
    estimatedSec,
    status,
    breakdown: taskGroups.map((group) => ({ id: group.id, durationSec: group.durationSec ?? 0 })),
  }
}

/**
 * Resolve a group's full test set and expand its argv command.
 *
 * `{tests}` always expands to every file the group owns, not only the files in
 * the current change set. A source-only change therefore still runs the whole
 * group, which is what makes a green task result meaningful.
 *
 * @param {object} group Selected group.
 * @param {string[]|null} files Tracked repository files.
 * @param {boolean} caseSensitive Match case sensitivity.
 * @returns {{argv: string[], cwd: string}|null} Expanded command, or null when the test set is empty.
 */
function expandGroupCommand(group, files, caseSensitive) {
  const tests = Array.isArray(group.tests) ? group.tests : []
  const needsTests = group.run.command.some((token) => token === "{tests}")
  const resolved = needsTests
    ? (files ?? [])
        .map(normalizeRepoPath)
        .filter((file) => matchesAnyGlob(file, tests, { caseSensitive }))
        .sort()
    : []
  if (needsTests && resolved.length === 0) return null

  const argv = []
  for (const token of group.run.command) {
    if (token === "{tests}") argv.push(...resolved)
    else argv.push(token)
  }
  return { argv, cwd: group.run.cwd ?? "." }
}

/**
 * Select test groups for one gate.
 *
 * @param {object} input Selection input.
 * @param {object|null} input.map Loaded map, or null for the no-map case.
 * @param {string|null} [input.mapHash] Map hash for evidence.
 * @param {string[]} [input.changed=[]] Changed repository paths.
 * @param {string[]|null} [input.files=null] Tracked repository files for command expansion.
 * @param {string} [input.gate="task"] Gate name.
 * @param {string[]} [input.include=[]] Extra paths that must be considered changed.
 * @param {boolean} [input.explicitFull=false] Force the full suite.
 * @param {Record<string, string>} [input.env={}] Environment values.
 * @param {object|null} [input.base=null] Resolved base evidence.
 * @returns {object} Deterministic selection result.
 * @throws {Error} When the gate is unknown.
 * @example
 * const result = selectTests({ map: loaded.map, changed: ["web/billing/Dialog.tsx"], gate: "task" })
 */
export function selectTests({
  map,
  mapHash = null,
  changed = [],
  files = null,
  gate = "task",
  include = [],
  explicitFull = false,
  env = {},
  base = null,
}) {
  if (!ALL_GATES.includes(gate)) throw new Error(`unknown gate: ${gate}`)
  const warnings = []
  const policy = map?.policy ?? null
  const groups = map?.groups ?? []
  const allIds = groups.map((group) => group.id).sort()
  const changedPaths = [...new Set([...changed, ...include].map(normalizeRepoPath))].sort()

  if (!map) {
    return fullResult({ reason: "no-map", policy: null, mapHash: null, gate, base, changed: changedPaths, skipped: [], warnings })
  }

  if (explicitFull || env.CODEOPS_FULL_TESTS === "1") {
    return fullResult({ reason: "forced", policy, mapHash, gate, base, changed: changedPaths, skipped: allIds, warnings })
  }

  const caseSensitive = policy.caseSensitive !== false
  if (!caseSensitive) {
    warnings.push({ code: "case-insensitive", message: "path matching is case-insensitive by policy override" })
  }
  const matchOptions = { caseSensitive }

  const fullOnPaths = (policy.fullOnPaths ?? []).filter((pattern) =>
    changedPaths.some((path) => matchesAnyGlob(path, [pattern], matchOptions)),
  )
  if (fullOnPaths.length > 0) {
    const matching = changedPaths.filter((path) => matchesAnyGlob(path, fullOnPaths, matchOptions))
    return fullResult({
      reason: "full-on-path",
      policy,
      mapHash,
      gate,
      base,
      changed: matching,
      skipped: allIds,
      warnings,
    })
  }

  const ignoreGlobs = (policy.ignorePaths ?? []).map((entry) => entry.glob)
  const relevant = changedPaths.filter((path) => !matchesAnyGlob(path, ignoreGlobs, matchOptions))
  if (changedPaths.length > 0 && relevant.length === 0) {
    return {
      schema: 1,
      mode: "none",
      gate,
      base: base ?? null,
      mapHash,
      changed: changedPaths,
      selected: [],
      deferred: [],
      skipped: allIds,
      commands: [],
      budget: { estimatedSec: 0, status: "not-applicable" },
      warnings,
      reason: "docs-only",
      fullCommand: policy.full ?? null,
      unknownPaths: [],
    }
  }

  const includeSet = new Set(include.map(normalizeRepoPath))
  const reasons = new Map()
  const unknownPaths = []

  for (const path of relevant) {
    let matched = false
    for (const group of groups) {
      const sourceMatch = matchesAnyGlob(path, group.sources ?? [], matchOptions)
      const testMatch = Array.isArray(group.tests) && matchesAnyGlob(path, group.tests, matchOptions)
      if (sourceMatch) addReason(reasons, group.id, "direct-source")
      if (testMatch) addReason(reasons, group.id, "direct-test")
      if (sourceMatch || testMatch) {
        matched = true
        if (includeSet.has(path)) addReason(reasons, group.id, "included")
      }
    }
    if (!matched) unknownPaths.push(path)
  }

  if (unknownPaths.length > 0) {
    return fullResult({
      reason: "unknown-path",
      policy,
      mapHash,
      gate,
      base,
      changed: changedPaths,
      skipped: allIds,
      warnings,
      unknownPaths,
    })
  }

  const byId = new Map(groups.map((group) => [group.id, group]))
  const dependents = new Map()
  for (const group of groups) {
    for (const dependency of group.dependsOn ?? []) {
      if (!dependents.has(dependency)) dependents.set(dependency, [])
      dependents.get(dependency).push(group.id)
    }
  }

  const queue = [...reasons.keys()]
  while (queue.length > 0) {
    const current = queue.shift()
    for (const dependent of dependents.get(current) ?? []) {
      if (!reasons.has(dependent)) {
        addReason(reasons, dependent, "dependent")
        queue.push(dependent)
      }
    }
  }

  for (const group of groups) {
    if (group.alwaysRun === true) addReason(reasons, group.id, "always-run")
  }

  const allowedTiers = GATE_TIERS[gate]
  if (allowedTiers === null) {
    for (const group of groups) {
      if (!reasons.has(group.id)) addReason(reasons, group.id, "gate-all")
    }
  }

  const deferred = []
  for (const id of [...reasons.keys()]) {
    const group = byId.get(id)
    if (!group) continue
    if (allowedTiers !== null && !allowedTiers.includes(group.tier)) {
      reasons.delete(id)
      deferred.push({ id: group.id, reason: "deferred-tier" })
    }
  }

  if (gate === "pr") {
    for (const id of policy.prSmoke ?? []) {
      if (byId.has(id)) addReason(reasons, id, "smoke")
    }
  }

  if (allowedTiers !== null) {
    const selectedCount = reasons.size
    const threshold = policy.fullThreshold ?? 0.6
    if (groups.length > 0 && selectedCount / groups.length >= threshold) {
      return fullResult({ reason: "threshold", policy, mapHash, gate, base, changed: changedPaths, skipped: allIds, warnings })
    }
  }

  const selectedGroups = [...reasons.keys()]
    .map((id) => byId.get(id))
    .filter(Boolean)
    .sort((left, right) => left.slice.localeCompare(right.slice) || left.id.localeCompare(right.id))

  const commands = []
  for (const group of selectedGroups) {
    const command = expandGroupCommand(group, files, caseSensitive)
    if (!command) {
      return fullResult({
        reason: "map.empty-group",
        policy,
        mapHash,
        gate,
        base,
        changed: changedPaths,
        skipped: allIds,
        warnings,
      })
    }
    commands.push({ id: group.id, argv: command.argv, cwd: command.cwd })
  }

  const budget = budgetFor(selectedGroups, policy)
  if (budget.status === "over-budget") {
    warnings.push({
      code: "budget.over-budget",
      message: `selected task groups estimate ${budget.estimatedSec}s; all groups are retained`,
      breakdown: budget.breakdown,
    })
  }

  const selectedIds = new Set(selectedGroups.map((group) => group.id))
  const deferredIds = new Set(deferred.map((entry) => entry.id))
  const skipped = allIds.filter((id) => !selectedIds.has(id) && !deferredIds.has(id))

  return {
    schema: 1,
    mode: "groups",
    gate,
    base: base ?? null,
    mapHash,
    changed: changedPaths,
    selected: selectedGroups.map((group) => ({
      id: group.id,
      slice: group.slice,
      reasons: orderedReasons(reasons.get(group.id)),
    })),
    deferred: deferred.sort((left, right) => left.id.localeCompare(right.id)),
    skipped,
    commands,
    budget: { estimatedSec: budget.estimatedSec, status: budget.status },
    warnings,
    reason: null,
    fullCommand: policy.full ?? null,
    unknownPaths: [],
  }
}

/**
 * Check whether a group is target-based and therefore exempt from `{tests}`.
 *
 * Re-exported so the CLI and templates do not need a second import path.
 *
 * @param {object} group Map group.
 * @returns {boolean} `true` when the command has no `{tests}` placeholder.
 */
export function groupUsesTargetDiscovery(group) {
  return isTargetBasedGroup(group)
}
