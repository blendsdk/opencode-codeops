#!/usr/bin/env node
/**
 * Branch classification and CI plan shaping.
 *
 * A branch name is not a security boundary, but it decides which gate runs.
 * The policy therefore uses the same narrow glob matcher as selection, applies
 * a fixed precedence, and fails toward the stricter gate: acceptance beats
 * release, and an unknown branch uses the integration policy with a visible
 * warning.
 *
 * @module lib/test-branch-policy
 */

import { DEFAULT_BRANCHES } from "./test-map.mjs"
import { matchesAnyGlob } from "./test-selection-glob.mjs"

/** Branch classes a ref can resolve to. */
export const BRANCH_CLASSES = Object.freeze(["integration", "feature", "release", "acceptance", "unknown"])

/**
 * Choose the gate for a branch class.
 *
 * `ci` selects the CI context, where a feature branch runs the PR gate. Local
 * feature work uses the smaller task gate.
 *
 * @param {string} branchClass Branch class.
 * @param {object} [options] Gate options.
 * @param {boolean} [options.ci=false] Whether this is a CI run.
 * @returns {string} Gate name accepted by the CLI.
 * @example
 * gateForClass("feature", { ci: true }) // "pr"
 */
export function gateForClass(branchClass, { ci = false } = {}) {
  switch (branchClass) {
    case "release":
      return "release"
    case "acceptance":
      return "acceptance"
    case "integration":
      return "pr"
    case "feature":
      return ci ? "pr" : "task"
    default:
      return "pr"
  }
}

/**
 * Check whether a ref is a release tag.
 *
 * @param {string} ref Ref name.
 * @param {object} [branches] Branch policy.
 * @returns {boolean} `true` when the ref matches `releaseTags`.
 */
function isReleaseTag(ref, branches) {
  return matchesAnyGlob(ref, branches.releaseTags ?? DEFAULT_BRANCHES.releaseTags)
}

/**
 * Match a ref against one policy list.
 *
 * @param {string} ref Ref name.
 * @param {string[]} patterns Branch patterns.
 * @returns {boolean} `true` when any pattern matches.
 */
function matchesBranch(ref, patterns) {
  return matchesAnyGlob(ref, patterns ?? [])
}

/**
 * Classify a branch or tag.
 *
 * Precedence is tag, acceptance, release, integration, feature. A ref that
 * matches no list is `unknown` and uses the integration gate with a warning.
 *
 * @param {string} ref Branch or tag name.
 * @param {object} [options] Classification options.
 * @param {object} [options.branches] Branch policy override.
 * @param {boolean} [options.isTag=false] Whether the ref is a tag.
 * @param {boolean} [options.ci=false] Whether this is a CI run.
 * @returns {{class: string, gate: string, full: boolean, warning: {code: string, message: string}|null}}
 * @example
 * classifyRef("release/2026.11") // { class: "release", gate: "release", full: true, ... }
 */
export function classifyRef(ref, { branches = DEFAULT_BRANCHES, isTag = false, ci = false } = {}) {
  const name = String(ref ?? "")

  if ((isTag || isReleaseTag(name, branches)) && matchesBranch(name, branches.releaseTags ?? DEFAULT_BRANCHES.releaseTags)) {
    return { class: "release", gate: "release", full: true, warning: null }
  }
  if (matchesBranch(name, branches.acceptance)) {
    return { class: "acceptance", gate: "acceptance", full: true, warning: null }
  }
  if (matchesBranch(name, branches.release)) {
    return { class: "release", gate: "release", full: true, warning: null }
  }
  if (matchesBranch(name, branches.integration)) {
    return { class: "integration", gate: gateForClass("integration", { ci }), full: false, warning: null }
  }
  if (matchesBranch(name, branches.feature)) {
    return { class: "feature", gate: gateForClass("feature", { ci }), full: false, warning: null }
  }
  return {
    class: "unknown",
    gate: gateForClass("integration", { ci }),
    full: false,
    warning: { code: "branch.unknown", message: `branch ${name} matches no policy class; using integration` },
  }
}

/**
 * Decide whether a nightly run must execute or can skip.
 *
 * A missing marker always runs full. A path counts as relevant when it is owned
 * by the map, matches `fullOnPaths`, or is a toolchain/config path. A path that
 * is both ignored and full-on remains relevant: safety wins.
 *
 * @param {object} input Decision input.
 * @param {string[]} [input.changed=[]] Changed paths.
 * @param {object|null} [input.map=null] Loaded map.
 * @param {string|null} [input.marker=null] Last successful full-run SHA.
 * @returns {{mode: "full"|"skip"|"groups", reason: string|null, relevant: string[]}}
 * @example
 * nightlyDecision({ changed: ["docs/a.md"], map, marker: "abc" }).mode // "skip"
 */
export function nightlyDecision({ changed = [], map = null, marker = null } = {}) {
  if (!marker) return { mode: "full", reason: "nightly.no-marker", relevant: changed }

  const policy = map?.policy ?? {}
  const ignore = (policy.ignorePaths ?? []).map((entry) => entry.glob)
  const fullOn = policy.fullOnPaths ?? []
  const owned = (map?.groups ?? []).flatMap((group) => [...(group.sources ?? []), ...(group.tests ?? [])])

  const relevant = changed.filter((path) => {
    if (matchesAnyGlob(path, fullOn)) return true
    if (matchesAnyGlob(path, owned)) return true
    // An unowned path is still a real change. Running the full suite is the
    // safe response; skipping it would hide a new source file from every group.
    return !matchesAnyGlob(path, ignore)
  })

  if (relevant.length === 0) return { mode: "skip", reason: "no-relevant-change", relevant }
  return { mode: "groups", reason: null, relevant }
}

/**
 * Build the CI plan JSON from a selection.
 *
 * The matrix key is always present, even for a full or docs-only result, so the
 * workflow never has to special-case a missing value. Full is a mode, never a
 * fake group ID.
 *
 * @param {object} input Plan input.
 * @param {object} input.selection Selection result.
 * @param {string} input.gate Gate name.
 * @param {number} input.total Total group count.
 * @returns {object} Plan JSON.
 * @example
 * buildPlan({ selection, gate: "pr", total: 8 })
 */
export function buildPlan({ selection, gate, total }) {
  const matrix =
    selection.mode === "groups"
      ? {
          include: (selection.commands ?? []).map((command) => ({
            group: command.id,
            command: command.argv,
            cwd: command.cwd,
          })),
        }
      : { include: [] }

  return {
    schema: 1,
    gate,
    mode: selection.mode,
    full: selection.mode === "full" || gate === "release" || gate === "acceptance",
    selected: (selection.selected ?? []).length,
    total,
    mapHash: selection.mapHash ?? null,
    matrix,
    fullCommand: selection.fullCommand ?? null,
    reason: selection.reason ?? null,
  }
}
