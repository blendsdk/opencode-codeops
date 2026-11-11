#!/usr/bin/env node
/**
 * Small, dependency-free glob matcher for repository paths.
 *
 * The selector must not pull a general-purpose glob library into the plugin:
 * the supported syntax is intentionally narrow, and every pattern comes from a
 * committed map that a reviewer can read. This module documents that syntax and
 * rejects constructs it does not implement instead of silently treating them as
 * literals.
 *
 * Supported: `*` (within one segment), `**` (across segments), `?` (one
 * character), character classes such as `[abc]`, `[a-z]`, `[!abc]`, and `\`
 * escapes. Not supported: braces, extglobs, and leading negation groups.
 *
 * @module lib/test-selection-glob
 */

const REGEXP_SPECIAL = /[\\^$.*+?()[\]{}|]/

/**
 * Validate one glob pattern against the supported syntax.
 *
 * @param {unknown} pattern Candidate pattern.
 * @returns {{ok: true} | {ok: false, message: string}} Validation result.
 * @example
 * validateGlobPattern("src/**\/*.ts") // { ok: true }
 */
export function validateGlobPattern(pattern) {
  if (typeof pattern !== "string" || pattern.length === 0) {
    return { ok: false, message: "glob must be a non-empty string" }
  }
  if (pattern.startsWith("!")) {
    return { ok: false, message: "negation groups are not supported" }
  }
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]
    if (character === "\\") {
      index += 1
      continue
    }
    if (character === "{" || character === "}") {
      return { ok: false, message: "brace expansion is not supported" }
    }
    if (character === "(" && index > 0 && "?*+@!".includes(pattern[index - 1])) {
      return { ok: false, message: "extglobs are not supported" }
    }
    if (character === "[") {
      const end = findClassEnd(pattern, index + 1)
      if (end === -1) return { ok: false, message: "unterminated character class" }
      index = end
    }
  }
  return { ok: true }
}

/**
 * Find the closing bracket of a character class.
 *
 * @param {string} pattern Glob pattern.
 * @param {number} start Index just after `[`.
 * @returns {number} Index of `]`, or -1 when the class is unterminated.
 */
function findClassEnd(pattern, start) {
  for (let index = start; index < pattern.length; index += 1) {
    if (pattern[index] === "\\") {
      index += 1
      continue
    }
    if (pattern[index] === "]") return index
  }
  return -1
}

/**
 * Convert one glob pattern to an anchored regular expression.
 *
 * @param {string} pattern Glob pattern.
 * @param {object} [options] Matching options.
 * @param {boolean} [options.caseSensitive=true] Whether case matters.
 * @returns {RegExp} Anchored expression matching a normalized repo path.
 */
export function globToRegExp(pattern, { caseSensitive = true } = {}) {
  const validation = validateGlobPattern(pattern)
  if (!validation.ok) {
    throw new Error(`invalid glob ${JSON.stringify(pattern)}: ${validation.message}`)
  }

  let source = "^"
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]

    if (character === "\\") {
      const next = pattern[index + 1]
      if (next === undefined) {
        source += "\\\\"
      } else {
        source += REGEXP_SPECIAL.test(next) ? `\\${next}` : next
        index += 1
      }
      continue
    }

    if (character === "*" && pattern[index + 1] === "*") {
      index += 1
      if (pattern[index + 1] === "/") {
        index += 1
        source += "(?:.*/)?"
      } else {
        source += ".*"
      }
      continue
    }

    if (character === "*") {
      source += "[^/]*"
      continue
    }

    if (character === "?") {
      source += "[^/]"
      continue
    }

    if (character === "[") {
      const end = findClassEnd(pattern, index + 1)
      let body = pattern.slice(index + 1, end)
      if (body.startsWith("!")) body = `^${body.slice(1)}`
      source += `[${body.replace(/\\/g, "\\\\")}]`
      index = end
      continue
    }

    source += REGEXP_SPECIAL.test(character) ? `\\${character}` : character
  }
  source += "$"
  return new RegExp(source, caseSensitive ? "" : "i")
}

/**
 * Match one normalized repository path against one glob.
 *
 * @param {string} path Repo-relative path with forward slashes.
 * @param {string} pattern Glob pattern.
 * @param {object} [options] Matching options.
 * @param {boolean} [options.caseSensitive=true] Whether case matters.
 * @returns {boolean} `true` when the pattern matches the whole path.
 */
export function matchesGlob(path, pattern, options = {}) {
  return globToRegExp(pattern, options).test(path)
}

/**
 * Match one path against any pattern in a list.
 *
 * @param {string} path Repo-relative path.
 * @param {string[]} patterns Glob patterns.
 * @param {object} [options] Matching options.
 * @returns {boolean} `true` when at least one pattern matches.
 */
export function matchesAnyGlob(path, patterns, options = {}) {
  return patterns.some((pattern) => matchesGlob(path, pattern, options))
}

/**
 * Extract the literal directory prefix of a glob, before the first wildcard.
 *
 * @param {string} pattern Glob pattern.
 * @returns {string} Prefix ending at the last literal `/`, or an empty string.
 */
function globPrefix(pattern) {
  let literal = ""
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]
    if ("*?[".includes(character)) break
    if (character === "\\") {
      literal += pattern[index + 1] ?? ""
      index += 1
      continue
    }
    literal += character
  }
  const slash = literal.lastIndexOf("/")
  return slash === -1 ? "" : literal.slice(0, slash + 1)
}

/**
 * Decide whether two globs can match a common path.
 *
 * This is a conservative prefix check, not a set-intersection proof. It is used
 * to stop a documented ignore rule from swallowing an owned source or a
 * full-on path, so a false positive is a safe error the author can resolve by
 * narrowing the pattern.
 *
 * @param {string} left First glob.
 * @param {string} right Second glob.
 * @returns {boolean} `true` when the patterns overlap or one contains the other.
 * @example
 * globsIntersect("web/**", "web/billing/**") // true
 */
export function globsIntersect(left, right) {
  if (left === right) return true
  const leftPrefix = globPrefix(left)
  const rightPrefix = globPrefix(right)
  if (leftPrefix === "" || rightPrefix === "") return false
  return leftPrefix.startsWith(rightPrefix) || rightPrefix.startsWith(leftPrefix)
}
