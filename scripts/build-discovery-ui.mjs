/**
 * Build the Discovery web app into a self-contained bundle.
 *
 * esbuild bundles `discovery-ui/src/main.tsx` into `<outdir>/assets/app.js`
 * and copies the HTML template beside it. The listener serves that directory;
 * no remote asset is referenced, so the page works offline and under the
 * nonce-based CSP.
 *
 * @module build-discovery-ui
 */

import { cpSync, mkdirSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { build } from "esbuild"

/** The repository root. */
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/**
 * Build the app.
 *
 * @param {{ outdir?: string, metafile?: boolean }} [options] - Output directory
 *   (defaults to `discovery-ui/dist`) and whether to return the metafile.
 * @returns {Promise<{ metafile?: object }>} The esbuild metafile when requested.
 */
export async function buildDiscoveryUi(options = {}) {
  const outdir = options.outdir ?? join(ROOT, "discovery-ui", "dist")
  const metafile = options.metafile !== false
  rmSync(outdir, { recursive: true, force: true })
  mkdirSync(join(outdir, "assets"), { recursive: true })

  const result = await build({
    absWorkingDir: ROOT,
    entryPoints: [join(ROOT, "discovery-ui", "src", "main.tsx")],
    outfile: join(outdir, "assets", "app.js"),
    bundle: true,
    format: "esm",
    minify: true,
    target: "es2022",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    metafile,
    logLevel: "silent",
  })

  cpSync(join(ROOT, "discovery-ui", "index.html"), join(outdir, "index.html"))
  return { metafile: result.metafile }
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const { metafile } = await buildDiscoveryUi()
  const outputs = Object.keys(metafile?.outputs ?? {})
  console.error(`Discovery UI built: ${outputs.join(", ")}`)
}
