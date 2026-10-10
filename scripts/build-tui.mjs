/**
 * Build the packaged TUI entry.
 *
 * OpenCode transpiles plugin TSX with its OpenTUI renderer runtime only for
 * files outside `node_modules`. A published package always installs into
 * `node_modules`, so a source `.tsx` entry falls back to the default React
 * JSX transform and fails to load ("Cannot find package 'react'"). Compiling
 * `plugin/tui.tsx` with `@opentui/solid`'s own transform — the same pipeline
 * the host applies to project-local plugins — produces a plain-JavaScript
 * entry whose runtime imports (`@opentui/solid`, `solid-js`) the host
 * rewrites to its bundled renderer.
 *
 * The generated artifact `plugin/tui.js` is committed and shipped as the
 * `./tui` export; `scripts/tui-entry-build.spec.test.mjs` fails when it is
 * stale, so the release verification blocks a stale entry.
 *
 * @module build-tui
 */

import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

/** Repository root: this file lives in `<root>/scripts/`. */
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/** Source of the TUI entry, authored as TSX. */
const SOURCE = join(ROOT, "plugin", "tui.tsx")

/** Generated JavaScript entry shipped as `./tui`. */
const TARGET = join(ROOT, "plugin", "tui.js")

/** Header marking the artifact as generated. */
const HEADER =
  "// Generated from plugin/tui.tsx — do not edit; run `npm run build:tui` to regenerate.\n"

/**
 * Load `@opentui/solid`'s Solid JSX transform.
 *
 * The transform module is not part of the package's public exports map, so it
 * is resolved through the package root: resolve the package entry point, then
 * import the transform beside it.
 *
 * @returns The `transformSolidSource(code, options)` function.
 */
async function loadTransform() {
  const require = createRequire(join(ROOT, "scripts", "build-tui.mjs"))
  const packageEntry = require.resolve("@opentui/solid")
  const modulePath = join(dirname(packageEntry), "scripts", "solid-transform.js")
  const module = await import(pathToFileURL(modulePath).href)
  return module.transformSolidSource
}

/**
 * Compile the current `plugin/tui.tsx` into the shipped entry source.
 *
 * @returns The complete `plugin/tui.js` content, header included.
 */
export async function buildTuiSource() {
  const transformSolidSource = await loadTransform()
  const source = readFileSync(SOURCE, "utf8")
  const transformed = await transformSolidSource(source, { filename: SOURCE })
  const code = typeof transformed === "string" ? transformed : transformed.code
  return HEADER + code
}

// When run directly (`npm run build:tui`), regenerate the committed artifact.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const code = await buildTuiSource()
  writeFileSync(TARGET, code)
  console.log(`built plugin/tui.js (${code.length} chars)`)
}
