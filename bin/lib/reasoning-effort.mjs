#!/usr/bin/env node
/**
 * Adaptive reasoning-effort helper for CodeOps sessions.
 *
 * The plugin needs one place to answer a simple question per request: "which
 * reasoning level should this request use, if any?" This module answers it
 * without any framework dependency so `node --test` can exercise every edge:
 *
 * - marker scanning over message text parts;
 * - source precedence (dispatch marker, session flag, routing default);
 * - routing-config lookup with hostile-shape tolerance;
 * - provider-option application through the model's own variant record; and
 * - reading the per-session state file written by the skills.
 *
 * Every function is deliberately total: malformed input yields "no override",
 * never a thrown error. The plugin hooks sit on the request path, where a
 * crash would break the user's session, so safety beats strictness here.
 *
 * @module lib/reasoning-effort
 */

import { appendFileSync, lstatSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { ensureSessionTmpDir, sessionTmpDir } from "./tmp-hygiene.mjs"

/**
 * The four levels a plan or skill may suggest.
 *
 * These are the only values accepted in dispatch markers, session flags, and
 * plan suggestions. Routing policy is project configuration and may name the
 * wider provider enum instead.
 */
export const EFFORT_LEVELS = Object.freeze(["low", "medium", "high", "max"])

/**
 * The reasoning values accepted by `routing.roles.<agent>.reasoning` in the
 * project configuration.
 *
 * The list mirrors the CodeOps config schema, which passes provider-native
 * values through so a project can ask for `minimal` or `xhigh` even though the
 * suggestion vocabulary only offers the four common levels.
 */
export const ROUTING_REASONING_VALUES = Object.freeze([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
])

/**
 * Largest state file accepted by {@link readSessionEffort}.
 *
 * The real file is a few dozen bytes. The cap keeps a hostile or corrupt file
 * from being slurped into memory if the temp directory is ever tampered with.
 */
const MAX_STATE_FILE_BYTES = 4096

/**
 * One standalone marker line, anchored to the whole line.
 *
 * The marker is intentionally different from the human-readable plan line
 * `> **Reasoning**: ...`, so quoting a plan can never act as a machine
 * directive. Whitespace inside the brackets is tolerated; text before or after
 * is not.
 */
const MARKER_PATTERN = /^\[codeops-effort:\s*(low|medium|high|max)\]\s*$/

/**
 * Check whether a value is one of the four suggestion levels.
 *
 * @param value - Value to inspect
 * @returns True only for `"low"`, `"medium"`, `"high"`, or `"max"`
 *
 * @example
 * isEffortLevel("high") // true
 * isEffortLevel("xhigh") // false
 */
export function isEffortLevel(value) {
  return typeof value === "string" && EFFORT_LEVELS.includes(value)
}

/**
 * Check whether a value is a valid routing reasoning entry.
 *
 * @param value - Value to inspect
 * @returns True for any value in the routing enum
 */
export function isRoutingReasoning(value) {
  return typeof value === "string" && ROUTING_REASONING_VALUES.includes(value)
}

/**
 * Find the first valid dispatch marker across a list of message text parts.
 *
 * Only string entries are inspected; non-string entries (tool parts, images,
 * malformed structures) are skipped so a hostile part can never break the
 * request path. Lines are split on `\n`, `\r\n`, and `\r`, then trimmed before
 * the anchored pattern is applied, so surrounding whitespace is tolerated.
 *
 * @param texts - Candidate text parts (usually the text of a message's parts)
 * @returns The first valid level, or `undefined` when none is present
 *
 * @example
 * findEffortMarker(["run the task", "[codeops-effort: medium]"]) // "medium"
 */
export function findEffortMarker(texts) {
  if (!Array.isArray(texts)) return undefined
  for (const text of texts) {
    if (typeof text !== "string") continue
    for (const line of text.split(/\r\n|\r|\n/)) {
      const match = MARKER_PATTERN.exec(line.trim())
      if (match) return match[1]
    }
  }
  return undefined
}

/**
 * Resolve the effective level from the three explicit sources.
 *
 * Precedence is "most specific wins": a dispatch marker beats a session
 * flag, which beats a routing default. Each source is validated before it is
 * accepted, so an invalid value is ignored rather than propagated. A
 * non-object argument yields `undefined` instead of throwing.
 *
 * @param input - Candidate sources; all optional
 * @returns The first valid value, or `undefined` when no source applies
 *
 * @example
 * resolveEffort({ session: "high", routing: "low" }) // "high"
 */
export function resolveEffort(input) {
  if (!isPlainObject(input)) return undefined
  const { marker, session, routing } = input
  if (isEffortLevel(marker)) return marker
  if (isEffortLevel(session)) return session
  if (isRoutingReasoning(routing)) return routing
  return undefined
}

/**
 * Compute the session state-file path inside the session temp directory.
 *
 * @param sessionID - Session identifier
 * @param base - Base temp directory (injectable for tests)
 * @returns Absolute path to `reasoning-effort.json` for the session
 */
export function sessionEffortPath(sessionID, base) {
  return join(sessionTmpDir(sessionID, base), "reasoning-effort.json")
}

/**
 * Parse session state-file text into a validated level.
 *
 * The expected payload is `{"schema":1,"reasoning":"<level>"}` with any
 * unknown keys ignored. Anything else — malformed JSON, the wrong schema, a
 * level outside the four-level allowlist — yields `undefined`.
 *
 * @param text - Raw file contents
 * @returns The validated level, or `undefined`
 */
export function parseStateFile(text) {
  try {
    const value = JSON.parse(text)
    if (!isPlainObject(value)) return undefined
    if (value.schema !== 1) return undefined
    return isEffortLevel(value.reasoning) ? value.reasoning : undefined
  } catch {
    return undefined
  }
}

/**
 * Read the session's reasoning-effort state file.
 *
 * The file is written by `scripts/codeops_effort.py` for `--auto-effort`
 * runs. Only a small regular file is accepted: a missing file, a non-regular
 * file (symlinks are never followed), an oversized file, and any read or parse
 * failure all mean "no session effort" and return `undefined`.
 *
 * @param sessionID - Session identifier
 * @param base - Base temp directory (injectable for tests)
 * @returns The session level, or `undefined`
 */
export function readSessionEffort(sessionID, base) {
  try {
    const path = sessionEffortPath(sessionID, base)
    const info = lstatSync(path)
    if (!info.isFile()) return undefined
    if (info.size > MAX_STATE_FILE_BYTES) return undefined
    return parseStateFile(readFileSync(path, "utf-8"))
  } catch {
    return undefined
  }
}

/**
 * Check whether the optional trace environment switch is on.
 *
 * Tracing is opt-in and diagnostic: it is enabled only when the value is
 * exactly `1` or `true`, compared case-insensitively. Every other value,
 * including `undefined`, disables it.
 *
 * @param value - Raw `CODEOPS_EFFORT_TRACE` value
 * @returns True only for `"1"` or `"true"` in any case
 */
export function isEffortTraceEnabled(value) {
  if (typeof value !== "string") return false
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true"
}

/**
 * Compute the trace-file path inside the session temp directory.
 *
 * @param sessionID - Session identifier
 * @param base - Base temp directory (injectable for tests)
 * @returns Absolute path to `reasoning-effort-trace.jsonl`
 */
export function sessionEffortTracePath(sessionID, base) {
  return join(sessionTmpDir(sessionID, base), "reasoning-effort-trace.jsonl")
}

/**
 * Append one content-free trace entry to the session trace file.
 *
 * The entry is serialized as one compact JSON line. Nothing here inspects or
 * interprets the entry; callers must never pass prompt text, file content, or
 * secrets. The session directory is created when missing. Any failure — an
 * unwritable path, an unserializable entry — returns false instead of
 * throwing, because tracing must never affect a request.
 *
 * @param sessionID - Session identifier
 * @param entry - Plain, content-free record to append
 * @param base - Base temp directory (injectable for tests)
 * @returns True when the line was appended, false otherwise
 */
export function appendEffortTrace(sessionID, entry, base) {
  try {
    const line = `${JSON.stringify(entry)}\n`
    ensureSessionTmpDir(sessionID, base)
    appendFileSync(sessionEffortTracePath(sessionID, base), line, "utf-8")
    return true
  } catch {
    return false
  }
}

/**
 * Read an agent's explicit reasoning entry from the project routing config.
 *
 * Only an own `routing.roles.<agent>.reasoning` property counts; unknown
 * agents, missing sections, inherited properties, and malformed shapes all
 * return `undefined` instead of throwing.
 *
 * @param config - Parsed `codeops/codeops.json` content (any shape)
 * @param agent - Dispatching agent name
 * @returns The configured routing value, or `undefined`
 */
export function readRoutingReasoning(config, agent) {
  if (!isPlainObject(config)) return undefined
  const routing = config.routing
  if (!isPlainObject(routing)) return undefined
  const roles = routing.roles
  if (!isPlainObject(roles)) return undefined
  if (typeof agent !== "string" || agent.length === 0) return undefined
  if (!Object.prototype.hasOwnProperty.call(roles, agent)) return undefined
  const entry = roles[agent]
  if (!isPlainObject(entry)) return undefined
  return isRoutingReasoning(entry.reasoning) ? entry.reasoning : undefined
}

/**
 * Extract the model's runtime variant record, when the host exposes one.
 *
 * The installed SDK type does not declare `variants`, but the running host
 * attaches it to every model. The `in` check keeps this graceful when the
 * property is absent, and a cast is never used.
 *
 * @param model - Model object from the hook input
 * @returns The variants record when it is a plain object, else `undefined`
 */
export function extractModelVariants(model) {
  if (!isPlainObject(model)) return undefined
  if (!("variants" in model)) return undefined
  return isPlainObject(model.variants) ? model.variants : undefined
}

/**
 * Check whether a model advertises reasoning support.
 *
 * @param model - Model object from the hook input
 * @returns True only when `capabilities.reasoning` is exactly `true`
 */
export function modelSupportsReasoning(model) {
  if (!isPlainObject(model)) return false
  const capabilities = model.capabilities
  if (!isPlainObject(capabilities)) return false
  return capabilities.reasoning === true
}

/**
 * Merge the model's variant options for a level into the request options.
 *
 * The runtime model carries a `variants` record whose entries are the exact
 * provider options for each level (for example `reasoningEffort`, or a nested
 * `reasoning.effort`). This function is the only place that mapping is
 * consumed, so the plugin never hardcodes a provider key. A matching variant
 * is applied even when the model's reasoning capability flag is absent or
 * false: the variant itself is the provider-known option set, and the host
 * applies inherited variants the same way. Only when no variants record
 * exists does the documented `reasoningEffort` passthrough require an
 * explicit reasoning capability. The function is pure: it returns a new
 * object when a change applies and the original object reference otherwise.
 *
 * @param options - Current provider options
 * @param level - Candidate level from {@link resolveEffort}
 * @param model - Model object from the hook input
 * @returns The original options, or a new merged object when a change applies
 */
export function applyEffort(options, level, model) {
  if (!isRoutingReasoning(level)) return options

  const variants = extractModelVariants(model)
  if (variants !== undefined) {
    if (!Object.prototype.hasOwnProperty.call(variants, level)) return options
    const variantOptions = variants[level]
    if (!isPlainObject(variantOptions)) return options
    return deepMergePlain(options, variantOptions)
  }

  if (!modelSupportsReasoning(model)) return options
  return { ...options, reasoningEffort: level }
}

/**
 * Recursively merge plain objects into a new object.
 *
 * Values that are not plain objects — arrays, class instances, primitives —
 * are replaced, not merged. Neither input is mutated. The result is created
 * with data properties, so a hostile `__proto__` key in a variant can never
 * change the result's prototype chain.
 *
 * @param target - Base object
 * @param source - Overrides to merge on top
 * @returns A new merged plain object
 */
export function deepMergePlain(target, source) {
  const result = isPlainObject(target) ? { ...target } : {}
  if (!isPlainObject(source)) return result

  for (const key of Object.keys(source)) {
    const incoming = source[key]
    const current = Object.prototype.hasOwnProperty.call(result, key)
      ? result[key]
      : undefined
    const merged =
      isPlainObject(incoming) && isPlainObject(current)
        ? deepMergePlain(current, incoming)
        : incoming
    Object.defineProperty(result, key, {
      value: merged,
      writable: true,
      enumerable: true,
      configurable: true,
    })
  }

  return result
}

/**
 * Check whether a value is a plain object (not an array, class instance, or
 * `null`).
 *
 * @param value - Value to inspect
 * @returns True for `{}`-shaped objects and objects with a null prototype
 */
function isPlainObject(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
