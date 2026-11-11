#!/usr/bin/env node
/**
 * Test-map loading, policy normalization, and canonical hashing.
 *
 * A test map is plain data: a policy plus a list of feature-slice groups. This
 * module owns only the file-level concerns — finding the map, merging fragments,
 * applying defaults, and producing a stable hash. Validation and selection live
 * in separate modules so each can be read and tested on its own.
 *
 * The loader is deliberately strict about layout and lenient about optional
 * policy fields. A missing `full` command is left for the validator to report;
 * inventing one here would hide a project configuration error.
 *
 * @module lib/test-map
 */

import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { isAbsolute, join, relative, resolve } from "node:path"

/** Layout marker used when one file holds the whole map. */
export const SINGLE_LAYOUT = "single"

/** Layout marker used when `codeops/test-map/` holds policy and fragments. */
export const DIRECTORY_LAYOUT = "directory"

/** The only map schema this version understands. */
export const MAP_SCHEMA = 1

/** Default branch classification, applied when policy does not override it. */
export const DEFAULT_BRANCHES = Object.freeze({
  integration: Object.freeze(["main", "master"]),
  feature: Object.freeze(["feature/**"]),
  release: Object.freeze(["release/**", "release*", "hotfix/**", "hotfix*"]),
  acceptance: Object.freeze(["acceptance/**", "acceptance*"]),
  releaseTags: Object.freeze(["v*"]),
  unknown: "integration",
})

/** Default soft task budget in seconds. */
export const DEFAULT_BUDGETS = Object.freeze({
  taskTargetSeconds: 120,
  taskAcceptableSeconds: 180,
})

/**
 * Error raised when a map cannot be read or addressed safely.
 *
 * The stable `code` lets the CLI map the failure to an exit code without
 * parsing an error message.
 */
export class MapLoadError extends Error {
  /**
   * @param {string} code Stable machine code such as `map.policy`.
   * @param {string} message Human-readable explanation.
   * @param {string} [path] File or directory involved.
   */
  constructor(code, message, path) {
    super(message)
    this.name = "MapLoadError"
    this.code = code
    this.path = path
  }
}

/**
 * Create one independent copy of a JSON-compatible value.
 *
 * @template T
 * @param {T} value Value to copy.
 * @returns {T} A deep copy that shares no mutable structure with the input.
 */
export function cloneValue(value) {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item))
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]))
  }
  return value
}

/**
 * Check whether a repository-relative path is safe to match or execute.
 *
 * Rejects absolute paths, Windows drive paths, NUL bytes, empty values, and any
 * parent-directory segment. Backslashes are treated as separators so a Windows
 * style traversal cannot slip through.
 *
 * @param {unknown} value Candidate path or glob.
 * @returns {boolean} `true` when the value stays inside the repository.
 * @example
 * isSafeRepoPath("web/billing/**") // true
 * isSafeRepoPath("../outside/**")  // false
 */
export function isSafeRepoPath(value) {
  if (typeof value !== "string" || value.length === 0) return false
  if (value.includes("\0")) return false
  if (value.startsWith("/") || value.startsWith("\\")) return false
  if (/^[A-Za-z]:[\\/]/.test(value)) return false
  const normalized = value.replace(/\\/g, "/")
  return !normalized.split("/").includes("..")
}

/**
 * Normalize a path or glob to POSIX separators without changing its meaning.
 *
 * @param {string} value Path from a map or a Git change set.
 * @returns {string} The same path with forward slashes.
 */
export function normalizeRepoPath(value) {
  return value.replace(/\\/g, "/")
}

/**
 * Resolve which map layout a project uses.
 *
 * A single file wins when both shapes exist; the caller receives a warning so
 * `check --strict` can surface the ambiguity without guessing.
 *
 * @param {object} input Resolution input.
 * @param {string} input.root Repository root.
 * @param {string} [input.mapPath] Explicit file or directory override.
 * @returns {{kind: "none"|"file"|"directory", path: string|null, warning: string|null}}
 */
export function resolveMapPath({ root, mapPath }) {
  if (mapPath) {
    const absolute = resolve(root, mapPath)
    if (!existsSync(absolute)) return { kind: "none", path: absolute, warning: null }
    const info = statSync(absolute)
    return {
      kind: info.isDirectory() ? "directory" : "file",
      path: absolute,
      warning: null,
    }
  }

  const single = join(root, "codeops", "test-map.json")
  const directory = join(root, "codeops", "test-map")
  const hasSingle = existsSync(single)
  const hasDirectory = existsSync(directory)

  if (hasSingle && hasDirectory) {
    return {
      kind: "file",
      path: single,
      warning: "both codeops/test-map.json and codeops/test-map/ exist; the single file wins",
    }
  }
  if (hasSingle) return { kind: "file", path: single, warning: null }
  if (hasDirectory) return { kind: "directory", path: directory, warning: null }
  return { kind: "none", path: null, warning: null }
}

/**
 * Read and parse one JSON file with a stable error code.
 *
 * @param {string} absolutePath File to read.
 * @returns {unknown} Parsed JSON.
 * @throws {MapLoadError} When the file is missing or is not valid JSON.
 */
function readJson(absolutePath) {
  let text
  try {
    text = readFileSync(absolutePath, "utf8")
  } catch (error) {
    throw new MapLoadError("map.policy", `cannot read ${absolutePath}: ${error.message}`, absolutePath)
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new MapLoadError("map.parse", `invalid JSON in ${absolutePath}: ${error.message}`, absolutePath)
  }
}

/**
 * Apply defaults and copy the known policy fields into one normalized object.
 *
 * Unknown fields are preserved so a future schema can report them rather than
 * silently dropping project intent.
 *
 * @param {object} raw Policy object from the map.
 * @returns {object} Normalized policy with defaults applied.
 */
export function normalizePolicy(raw) {
  const source = raw && typeof raw === "object" ? raw : {}
  const branches = source.branches && typeof source.branches === "object" ? source.branches : {}
  const budgets = source.budgets && typeof source.budgets === "object" ? source.budgets : {}
  return {
    ...cloneValue(source),
    schema: source.schema ?? MAP_SCHEMA,
    full: source.full === undefined ? null : cloneValue(source.full),
    budgets: {
      taskTargetSeconds: budgets.taskTargetSeconds ?? DEFAULT_BUDGETS.taskTargetSeconds,
      taskAcceptableSeconds: budgets.taskAcceptableSeconds ?? DEFAULT_BUDGETS.taskAcceptableSeconds,
    },
    branches: {
      ...cloneValue(DEFAULT_BRANCHES),
      ...cloneValue(branches),
    },
    ignorePaths: cloneValue(source.ignorePaths ?? []),
    fullOnPaths: cloneValue(source.fullOnPaths ?? []),
    acceptance: cloneValue(source.acceptance ?? { mode: "automated", groups: [], checklist: null }),
    testRoots: source.testRoots === undefined ? null : cloneValue(source.testRoots),
    fullThreshold: source.fullThreshold ?? 0.6,
    prSmoke: cloneValue(source.prSmoke ?? []),
    requirements: cloneValue(source.requirements ?? {}),
    caseSensitive: source.caseSensitive ?? true,
  }
}

/**
 * Load the project test map.
 *
 * @param {object} input Load input.
 * @param {string} input.root Repository root.
 * @param {string} [input.mapPath] Explicit map file or directory.
 * @returns {{mode: "no-map"} | {mode: "map", map: object, mapHash: string, path: string, fragments: string[], warnings: string[]}}
 * @throws {MapLoadError} When a present map cannot be read or parsed.
 * @example
 * const loaded = loadMap({ root: process.cwd() })
 * if (loaded.mode === "map") console.log(loaded.mapHash)
 */
export function loadMap({ root, mapPath }) {
  const resolvedRoot = resolve(root)
  const located = resolveMapPath({ root: resolvedRoot, mapPath: mapPath === undefined ? undefined : mapPath })
  if (located.kind === "none") return { mode: "no-map" }

  const warnings = located.warning ? [located.warning] : []
  let map

  if (located.kind === "file") {
    const data = readJson(located.path)
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new MapLoadError("map.schema", "the map file must contain a JSON object", located.path)
    }
    map = {
      schema: data.schema ?? data.policy?.schema ?? MAP_SCHEMA,
      policy: normalizePolicy({ schema: data.schema, ...(data.policy ?? {}) }),
      groups: Array.isArray(data.groups) ? cloneValue(data.groups) : [],
      layout: SINGLE_LAYOUT,
      path: located.path,
      fragments: [],
      warnings,
    }
  } else {
    const policyPath = join(located.path, "policy.json")
    if (!existsSync(policyPath)) {
      throw new MapLoadError("map.policy", "codeops/test-map/policy.json is required", policyPath)
    }
    const policyData = readJson(policyPath)
    const names = listFragmentNames(located.path)
    const groups = []
    for (const name of names) {
      const fragment = readJson(join(located.path, name))
      if (!fragment || typeof fragment !== "object") {
        throw new MapLoadError("map.schema", `fragment ${name} must contain an object`, join(located.path, name))
      }
      if (Array.isArray(fragment.groups)) groups.push(...cloneValue(fragment.groups))
    }
    map = {
      schema: policyData.schema ?? MAP_SCHEMA,
      policy: normalizePolicy(policyData),
      groups,
      layout: DIRECTORY_LAYOUT,
      path: located.path,
      fragments: names,
      warnings,
    }
  }

  return {
    mode: "map",
    map,
    mapHash: hashMap(map),
    path: map.path,
    fragments: map.fragments,
    warnings: map.warnings,
  }
}

/**
 * List fragment file names for a directory map.
 *
 * `shared.json` loads first so cross-cutting groups are available to every
 * domain fragment's dependency references. Remaining fragments load in sorted
 * order to keep diagnostics stable across machines.
 *
 * @param {string} directory Map directory.
 * @returns {string[]} Fragment file names.
 */
function listFragmentNames(directory) {
  const names = readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .filter((name) => name !== "policy.json")
    .sort()
  const sharedIndex = names.indexOf("shared.json")
  if (sharedIndex > 0) {
    names.splice(sharedIndex, 1)
    names.unshift("shared.json")
  }
  return names
}

/**
 * Sort object keys recursively so equal content serializes identically.
 *
 * @param {unknown} value JSON-compatible value.
 * @returns {unknown} A key-sorted copy.
 */
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])]),
    )
  }
  return value
}

/**
 * Produce the canonical JSON used for hashing.
 *
 * Groups are sorted by ID and object keys are sorted recursively. Load-only
 * metadata such as the layout, file path, fragments, and warnings is excluded,
 * so reordering fragments never changes the hash.
 *
 * @param {object} map Loaded map.
 * @returns {string} Canonical JSON string.
 */
export function canonicalMap(map) {
  const groups = [...(map.groups ?? [])].sort((left, right) =>
    String(left.id ?? "").localeCompare(String(right.id ?? "")),
  )
  return JSON.stringify(
    sortKeys({
      schema: map.schema,
      policy: map.policy,
      groups,
    }),
  )
}

/**
 * Compute the stable SHA-256 hash of a map.
 *
 * @param {object} map Loaded map.
 * @returns {string} Lowercase hexadecimal SHA-256 digest.
 * @example
 * const hash = hashMap(loaded.map)
 */
export function hashMap(map) {
  return createHash("sha256").update(canonicalMap(map)).digest("hex")
}

/**
 * Check whether a group relies on its runner's own target discovery.
 *
 * A target-based group has no `{tests}` token, so it may omit `tests` and is
 * exempt from file-ownership checks.
 *
 * @param {object} group Map group.
 * @returns {boolean} `true` when the command contains no `{tests}` placeholder.
 */
export function isTargetBasedGroup(group) {
  const command = group?.run?.command
  if (!Array.isArray(command)) return false
  return !command.some((token) => typeof token === "string" && token.includes("{tests}"))
}

/**
 * Convert a repository-relative path to an absolute path inside the root.
 *
 * @param {string} root Repository root.
 * @param {string} relativePath Safe repository-relative path.
 * @returns {string|null} Absolute path, or `null` when the path would escape.
 */
export function resolveInsideRoot(root, relativePath) {
  if (!isSafeRepoPath(relativePath)) return null
  const absolute = resolve(root, relativePath)
  const relation = relative(resolve(root), absolute)
  if (relation.startsWith("..") || isAbsolute(relation)) return null
  return absolute
}
