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
 * The five levels a plan or skill may suggest.
 *
 * These are the only values accepted in dispatch markers, session flags, and
 * plan suggestions. Routing policy is project configuration and may name the
 * wider provider enum instead.
 */
export const EFFORT_LEVELS = Object.freeze(["low", "medium", "high", "xhigh", "max"])

/**
 * The reasoning values accepted by `routing.roles.<agent>.reasoning` in the
 * project configuration.
 *
 * The list mirrors the CodeOps config schema, which passes provider-native
 * values through so a project can ask for `minimal` or `none` even though the
 * suggestion vocabulary only offers the five common levels.
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
const MARKER_PATTERN = /^\[codeops-effort:\s*(low|medium|high|xhigh|max)\]\s*$/

/**
 * Check whether a value is one of the five suggestion levels.
 *
 * @param value - Value to inspect
 * @returns True only for `"low"`, `"medium"`, `"high"`, `"xhigh"`, or `"max"`
 *
 * @example
 * isEffortLevel("high") // true
 * isEffortLevel("default") // false
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
 * level outside the five-level allowlist — yields `undefined`.
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
 * Order of provider reasoning levels, weakest to strongest.
 *
 * The scale is used only to pick the nearest exposed variant when a model
 * does not offer the exact requested level.
 */
const EFFORT_RANK = Object.freeze({
  none: 0,
  minimal: 1,
  low: 2,
  medium: 3,
  high: 4,
  xhigh: 5,
  max: 6,
})

/**
 * How a requested level reached the applied variant, or why it did not.
 *
 * - `exact`: the model exposes the requested level.
 * - `alias`: the verified provider table supplied the variant.
 * - `nearest`: a one-step canonical neighbour was chosen.
 * - `fail-open`: nothing safe applied and the request was left unchanged.
 */
export const EFFORT_MAPPINGS = Object.freeze(["exact", "alias", "nearest", "fail-open"])

/**
 * Verified provider aliases, keyed by provider id.
 *
 * The table is deliberately small and only covers provider/model families
 * whose option names are known. Runtime variants are authoritative: this table
 * is consulted only after an exact canonical match fails. OpenAI and Anthropic
 * use the canonical names unchanged. DeepSeek exposes `high`/`max` instead of
 * `medium`/`xhigh`, so those two requests map onto its scale.
 *
 * Unknown providers have no entry and therefore fail open. `default` is never
 * a key: the vocabulary has no such level.
 */
const VERIFIED_PROVIDER_ALIASES = Object.freeze({
  openai: Object.freeze({
    low: "low",
    medium: "medium",
    high: "high",
    xhigh: "xhigh",
    max: "max",
  }),
  anthropic: Object.freeze({
    low: "low",
    medium: "medium",
    high: "high",
    xhigh: "xhigh",
    max: "max",
  }),
  deepseek: Object.freeze({
    low: "low",
    medium: "high",
    high: "high",
    xhigh: "max",
    max: "max",
    none: "none",
  }),
})

/**
 * Maximum length of one identifier inside the capability line.
 *
 * The real ids are short. The cap keeps a hostile host value from growing the
 * prompt-bound line without bound.
 */
const MAX_CAPABILITY_IDENTIFIER_LENGTH = 64

/**
 * Read a model's variants as a normalized id-keyed record.
 *
 * Accepts both the OpenCode 2 array shape and the older record shape. A model
 * without a usable variants collection yields an empty record, which makes
 * every later lookup fail open.
 *
 * @param model - Model object from the hook input
 * @returns A record mapping variant id to its settings object
 */
function modelVariantRecord(model) {
  if (!isPlainObject(model) || !("variants" in model)) return {}
  return normalizeModelVariants(model.variants)
}

/**
 * List the usable canonical variant keys a model exposes.
 *
 * A key counts only when it is a canonical reasoning name, it is not `none`,
 * and its value is a plain object. Malformed entries are ignored so they can
 * never reach the request options.
 *
 * @param variants - Normalized variant record
 * @returns Canonical variant keys with usable settings
 */
function usableVariantKeys(variants) {
  return Object.keys(variants).filter(
    (key) =>
      key !== "none" &&
      Object.prototype.hasOwnProperty.call(EFFORT_RANK, key) &&
      isPlainObject(variants[key])
  )
}

/**
 * Pick the nearest canonical variant to a requested level.
 *
 * Ties resolve to the higher level so ordinary work is never under-powered.
 * The caller still applies the max guard and the distance rule.
 *
 * @param level - Requested canonical or routing level
 * @param candidates - Usable canonical variant keys
 * @returns The nearest key, or `undefined` when the list is empty
 */
function nearestVariantKey(level, candidates) {
  let best
  for (const key of candidates) {
    if (best === undefined) {
      best = key
      continue
    }
    const distance = Math.abs(EFFORT_RANK[key] - EFFORT_RANK[level])
    const bestDistance = Math.abs(EFFORT_RANK[best] - EFFORT_RANK[level])
    if (
      distance < bestDistance ||
      (distance === bestDistance && EFFORT_RANK[key] > EFFORT_RANK[best])
    ) {
      best = key
    }
  }
  return best
}

/**
 * Resolve the model variant and the disclosure source for a requested level.
 *
 * The order is fixed by the contract:
 *
 * 1. `none` is exact-match only; mapping it to a reasoning level would enable
 *    reasoning the caller explicitly disabled.
 * 2. An exact canonical variant wins.
 * 3. The verified provider alias applies when the exact variant is absent.
 * 4. Otherwise the nearest exposed canonical variant is used, but only when it
 *    is at most one canonical step away. A nearest `max` is refused unless the
 *    request was `max` or the DeepSeek alias above supplied it.
 *
 * Anything else returns `mapping: "fail-open"` and no variant, which leaves
 * the request unchanged. The function never throws.
 *
 * @param level - Requested level (any routing enum value)
 * @param model - Model object from the hook input
 * @returns The variant key and the mapping source
 *
 * @example
 * resolveEffortVariant("medium", {
 *   providerID: "deepseek",
 *   variants: { low: {}, high: {}, max: {} },
 * }) // { variant: "high", mapping: "alias" }
 */
export function resolveEffortVariant(level, model) {
  const failOpen = { variant: undefined, mapping: "fail-open" }
  if (!isRoutingReasoning(level)) return failOpen

  const variants = modelVariantRecord(model)

  if (level === "none") {
    return isPlainObject(variants.none)
      ? { variant: "none", mapping: "exact" }
      : failOpen
  }

  const candidates = usableVariantKeys(variants)
  if (candidates.includes(level)) return { variant: level, mapping: "exact" }

  const providerID =
    isPlainObject(model) && typeof model.providerID === "string" ? model.providerID : undefined
  const alias =
    providerID === undefined ? undefined : VERIFIED_PROVIDER_ALIASES[providerID]?.[level]
  if (typeof alias === "string" && candidates.includes(alias)) {
    return { variant: alias, mapping: "alias" }
  }

  const nearest = nearestVariantKey(level, candidates)
  if (nearest === undefined) return failOpen
  if (nearest === "max" && level !== "max") return failOpen
  if (Math.abs(EFFORT_RANK[nearest] - EFFORT_RANK[level]) > 1) return failOpen
  return { variant: nearest, mapping: "nearest" }
}

/**
 * Choose the model variant key to apply for a requested level.
 *
 * This is the variant-key view of {@link resolveEffortVariant}, kept for
 * callers that only need the key. It returns `undefined` for every fail-open
 * outcome.
 *
 * @param level - Requested level (any routing enum value)
 * @param model - Model object from the hook input
 * @returns The variant key to apply, or `undefined` when none applies
 *
 * @example
 * selectEffortVariant("medium", { variants: { low: {}, high: {} } }) // "high"
 */
export function selectEffortVariant(level, model) {
  return resolveEffortVariant(level, model).variant
}

/**
 * Merge the model's variant options for a level into the request options.
 *
 * The runtime model carries a `variants` record whose entries are the exact
 * provider options for each level (for example `reasoningEffort`, or a nested
 * `reasoning.effort`). This function is the only place that mapping is
 * consumed, so the plugin never hardcodes a provider key. The applied key is
 * chosen by {@link resolveEffortVariant}; a fail-open outcome returns the
 * original options reference unchanged.
 *
 * There is deliberately no raw `reasoningEffort` fallback. Sending a level a
 * provider never advertised risks an error or a silently ignored option, so a
 * model without usable variants keeps its request unchanged and the caller
 * records `effort unavailable` instead.
 *
 * The function is pure: it returns a new object when a change applies.
 *
 * @param options - Current provider options
 * @param level - Candidate level from {@link resolveEffort}
 * @param model - Model object from the hook input
 * @returns The original options, or a new merged object when a change applies
 */
export function applyEffort(options, level, model) {
  const resolution = resolveEffortVariant(level, model)
  if (resolution.variant === undefined) return options
  const variants = modelVariantRecord(model)
  return deepMergePlain(options, variants[resolution.variant])
}

/**
 * Restrict one identifier to the capability-line allowlist.
 *
 * Only `A-Z`, `a-z`, `0-9`, `.`, `_`, `:`, `/`, and `-` survive. Every other
 * character — including CR, LF, tabs, and brackets — is removed, so a hostile
 * id can never add a line or close a field. The result is capped so the
 * prompt-bound line stays bounded. Non-strings become an empty string.
 *
 * @param value - Untrusted identifier
 * @param maxLength - Maximum accepted length (defaults to 64)
 * @returns The sanitized identifier
 *
 * @example
 * sanitizeEffortIdentifier("bad\nmodel]") // "badmodel"
 */
export function sanitizeEffortIdentifier(value, maxLength = MAX_CAPABILITY_IDENTIFIER_LENGTH) {
  if (typeof value !== "string") return ""
  const cap =
    Number.isInteger(maxLength) && maxLength > 0 ? maxLength : MAX_CAPABILITY_IDENTIFIER_LENGTH
  return value.replace(/[^A-Za-z0-9._:/-]/g, "").slice(0, cap)
}

/**
 * Order variant ids for display: canonical rank first, then alphabetically.
 *
 * @param a - First variant id
 * @param b - Second variant id
 * @returns Negative, zero, or positive per the usual comparator contract
 */
function compareVariantIds(a, b) {
  const rankA = Object.prototype.hasOwnProperty.call(EFFORT_RANK, a)
    ? EFFORT_RANK[a]
    : Number.MAX_SAFE_INTEGER
  const rankB = Object.prototype.hasOwnProperty.call(EFFORT_RANK, b)
    ? EFFORT_RANK[b]
    : Number.MAX_SAFE_INTEGER
  if (rankA !== rankB) return rankA - rankB
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * Build the one-line, content-free effort capability disclosure.
 *
 * The line names the model, the variants the host exposed, the context limit,
 * the requested level, the applied variant (or `unavailable`), and how the
 * mapping was reached. Identifiers are sanitized and capped; the context limit
 * is printed only when it is a positive integer. The result never contains a
 * newline, so callers can inject it as one system line.
 *
 * @param input - Resolution facts; unknown fields degrade to safe defaults
 * @returns One capability line
 *
 * @example
 * buildEffortCapabilityLine({
 *   providerID: "openai",
 *   modelID: "o1",
 *   variants: ["high"],
 *   contextLimit: 200000,
 *   requested: "high",
 *   applied: "high",
 *   mapping: "exact",
 * }) // "CodeOps effort: model=openai/o1; variants=high; context=200000; requested=high; applied=high; mapping=exact"
 */
export function buildEffortCapabilityLine(input) {
  const record = isPlainObject(input) ? input : {}
  const provider = sanitizeEffortIdentifier(record.providerID) || "unknown"
  const model = sanitizeEffortIdentifier(record.modelID) || "unknown"

  const rawVariants = Array.isArray(record.variants) ? record.variants : []
  const variants = [
    ...new Set(rawVariants.map((value) => sanitizeEffortIdentifier(value)).filter(Boolean)),
  ].sort(compareVariantIds)
  const variantText = variants.length > 0 ? variants.join(",") : "none"

  const context =
    Number.isInteger(record.contextLimit) && record.contextLimit > 0
      ? String(record.contextLimit)
      : "unknown"

  const requested = sanitizeEffortIdentifier(record.requested) || "unknown"
  const applied = sanitizeEffortIdentifier(record.applied) || "unavailable"
  const mapping = EFFORT_MAPPINGS.includes(record.mapping) ? record.mapping : "fail-open"

  return `CodeOps effort: model=${provider}/${model}; variants=${variantText}; context=${context}; requested=${requested}; applied=${applied}; mapping=${mapping}`
}

/**
 * Normalize a host model's variant collection into a keyed record.
 *
 * OpenCode 2 exposes model variants as an array of entries shaped
 * `{ id, settings }`, while {@link applyEffort} consumes a record keyed by
 * variant id. This adapter bridges the two without changing the core logic.
 * A record input is passed through unchanged, so v1-style callers and tests
 * keep working. Malformed entries — non-objects, missing ids, non-object
 * settings — are skipped; anything that is not an array or plain object yields
 * an empty record.
 *
 * @param variants - Variant collection from the host (any shape)
 * @returns A record mapping variant id to its settings object
 *
 * @example
 * normalizeModelVariants([{ id: "high", settings: { reasoningEffort: "high" } }])
 * // { high: { reasoningEffort: "high" } }
 */
export function normalizeModelVariants(variants) {
  if (isPlainObject(variants)) return { ...variants }
  if (!Array.isArray(variants)) return {}

  const record = {}
  for (const entry of variants) {
    if (!isPlainObject(entry)) continue
    const id = entry.id
    if (typeof id !== "string" || id.length === 0) continue
    const settings = isPlainObject(entry.settings) ? entry.settings : {}
    Object.defineProperty(record, id, {
      value: settings,
      writable: true,
      enumerable: true,
      configurable: true,
    })
  }
  return record
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
