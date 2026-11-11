#!/usr/bin/env node
/**
 * Human-readable rendering of a selection result.
 *
 * JSON is the machine contract; people need a compact summary they can scan in
 * a terminal. This module keeps formatting out of the selector so both outputs
 * describe exactly the same result object.
 *
 * @module lib/test-selection-explain
 */

/**
 * Render the base evidence as one short label.
 *
 * @param {{kind?: string, value?: string}|null} base Resolved base.
 * @returns {string} Human-readable base.
 */
function formatBase(base) {
  if (!base?.value) return "unresolved"
  return `${base.kind ?? "ref"} ${base.value}`
}

/**
 * Render a selection result as a compact multi-line summary.
 *
 * @param {object} result Selection result from `selectTests`.
 * @returns {string} Human-readable summary.
 * @example
 * console.log(formatSelection(result))
 */
export function formatSelection(result) {
  const lines = [`mode: ${result.mode}`, `gate: ${result.gate}`, `base: ${formatBase(result.base)}`]

  if (result.mode === "full") {
    lines.push(`reason: ${result.reason ?? "unknown"}`)
    if (result.unknownPaths?.length) lines.push(`unknown: ${result.unknownPaths.join(", ")}`)
    if (result.fullCommand) {
      const command = Array.isArray(result.fullCommand[0])
        ? result.fullCommand.map((argv) => argv.join(" ")).join(" && ")
        : result.fullCommand.join(" ")
      lines.push(`command: ${command}`)
    } else {
      lines.push("command: none configured")
    }
    return lines.join("\n")
  }

  if (result.mode === "none") {
    lines.push(`reason: ${result.reason ?? "docs-only"}`)
    return lines.join("\n")
  }

  lines.push(`selected: ${result.selected.length}/${result.selected.length + result.skipped.length + result.deferred.length} groups`)
  for (const entry of result.selected) {
    lines.push(`  ${entry.id}  ${entry.reasons.join(", ")}`)
  }
  if (result.deferred.length > 0) {
    lines.push("deferred:")
    for (const entry of result.deferred) lines.push(`  ${entry.id}  ${entry.reason}`)
  }
  if (result.skipped.length > 0) lines.push(`skipped: ${result.skipped.join(", ")}`)
  lines.push(`budget: ${result.budget.estimatedSec}s (${result.budget.status})`)
  for (const warning of result.warnings ?? []) lines.push(`warning: ${warning.code} ${warning.message}`)
  return lines.join("\n")
}

/**
 * Render a result as stable JSON.
 *
 * @param {object} result Selection result.
 * @returns {string} Pretty-printed JSON with a trailing newline.
 */
export function formatSelectionJson(result) {
  return `${JSON.stringify(result, null, 2)}\n`
}
