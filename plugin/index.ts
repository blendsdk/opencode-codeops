import { Plugin } from "@opencode/plugin"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  cleanStaleTmpDirs,
  ensureSessionTmpDir,
} from "../bin/lib/tmp-hygiene.mjs"
import { registerCodeOpsRpc } from "../bin/lib/codeops-rpc.mjs"
import {
  appendEffortTrace,
  applyEffort,
  extractModelVariants,
  findEffortMarker,
  isEffortLevel,
  isEffortTraceEnabled,
  isRoutingReasoning,
  normalizeModelVariants,
  readRoutingReasoning,
  readSessionEffort,
  resolveEffort,
  selectEffortVariant,
} from "../bin/lib/reasoning-effort.mjs"
import type { EffortLevel } from "../bin/lib/reasoning-effort.mjs"

// ---------------------------------------------------------------------------
// Package root — resolved at module load time so it is always the plugin's
// installed directory, regardless of the working directory at event time.
// PLUGIN_DIR contains this entry point (plugin/); PACKAGE_ROOT is one level
// above it and holds standards/, skills/, scripts/, and the agent templates.
// ---------------------------------------------------------------------------
const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = dirname(PLUGIN_DIR)

// ---------------------------------------------------------------------------
// The plugin's own version, read from the package it shipped in. There is no
// separate hardcoded version: the running plugin always reports the version of
// the npm package that was installed, so it cannot drift from the package.
// ---------------------------------------------------------------------------
const packageVersion = readPackageVersion()

/** Reads the `version` field of this package's package.json. */
function readPackageVersion(): string {
  try {
    const manifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"))
    return typeof manifest.version === "string" ? manifest.version : "0.0.0"
  } catch {
    return "0.0.0"
  }
}

// ---------------------------------------------------------------------------
// Load standards at startup (once). Both files are injected into every request
// as system instructions, so they also survive context compaction.
// ---------------------------------------------------------------------------
const codingStandards = readFileSync(
  join(PACKAGE_ROOT, "standards", "coding-standards.md"),
  "utf8"
)
const outputStyle = readFileSync(
  join(PACKAGE_ROOT, "standards", "output-style.md"),
  "utf8"
)
const standardsText = `${codingStandards}\n\n${outputStyle}`

// ---------------------------------------------------------------------------
// OpenCode 2 does not expose a session identifier to shell hooks, so the plugin
// owns one scratch directory per plugin runtime instead of one per session.
// Skills and subagents still receive it as CODEOPS_TMPDIR and delete their own
// scratch; the startup sweep reclaims directories abandoned by earlier runs.
// Several sessions can share one runtime directory, so the plugin must never
// delete it on unload; see _shared/workspace-hygiene.md.
// ---------------------------------------------------------------------------
const runtimeID = `runtime-${randomUUID()}`

/** Heading prefixed to the standards block injected into compaction summaries. */
const STANDARDS_HEADING = "## CodeOps Standards (always active)"

/**
 * Check whether a value is a plain object (not an array, class instance, or
 * `null`). Used to read unknown hook payloads without unsafe casts.
 *
 * @param value - Value to inspect
 * @returns True for `{}`-shaped objects
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Log one content-free warning. Logging is best effort: a failed log must never
 * break a request.
 *
 * @param message - Warning text that never contains prompt or file content
 */
function warnContentFree(message: string): void {
  console.warn(`CodeOps: ${message}`)
}

/**
 * Read the version recorded in an installed skills marker, if any.
 *
 * The marker (`.opencode-codeops.json`) is written by the skills installer.
 * Its absence means the skills are not managed — for example a development
 * symlink — so there is no version to compare against.
 *
 * @param skillsDir - Directory that may hold the installer marker
 * @returns The recorded version, or `undefined`
 */
function installedSkillsVersion(skillsDir: string): string | undefined {
  try {
    const marker = JSON.parse(
      readFileSync(join(skillsDir, ".opencode-codeops.json"), "utf8")
    )
    return typeof marker.version === "string" ? marker.version : undefined
  } catch {
    return undefined
  }
}

/**
 * Warn (non-blocking) when the installed skills were written by a different
 * CodeOps version than this plugin. The plugin and the files are installed by
 * separate commands, so their versions can drift; a mismatch usually means the
 * skills need `npx opencode-codeops update` again.
 *
 * @param directory - Project directory whose local skills should be checked
 */
function warnOnVersionSkew(directory: string): void {
  const skillsDirs = [
    join(homedir(), ".config", "opencode", "skills"),
    join(directory, ".opencode", "skills"),
  ]

  for (const skillsDir of skillsDirs) {
    const installed = installedSkillsVersion(skillsDir)
    if (!installed || installed === packageVersion) continue

    warnContentFree(
      `CodeOps skills at ${skillsDir} are version ${installed}, ` +
        `but the plugin is version ${packageVersion}. ` +
        `Run \`npx opencode-codeops@${packageVersion} update\` to match them.`
    )
  }
}

/**
 * Read the project routing config fresh on every request, so an edit applies
 * without restarting the session. Any failure means "no routing".
 *
 * @param directory - Project directory holding `codeops/codeops.json`
 * @returns The parsed config, or an empty object
 */
function readRoutingConfig(directory: string): unknown {
  try {
    return JSON.parse(readFileSync(join(directory, "codeops", "codeops.json"), "utf8"))
  } catch {
    return {}
  }
}

/**
 * Append one content-free trace line when the optional CODEOPS_EFFORT_TRACE
 * switch is on. Tracing is diagnostic only: it never affects a request and
 * swallows its own failures.
 *
 * @param enabled - Whether tracing is enabled for this runtime
 * @param sessionID - Session the entry belongs to
 * @param entry - Content-free trace record
 */
function traceEffort(
  enabled: boolean,
  sessionID: string,
  entry: Record<string, unknown>
): void {
  if (!enabled) return
  appendEffortTrace(runtimeID, { ts: new Date().toISOString(), sessionID, ...entry })
}

/**
 * Look up the active model's variant record from the model registry.
 *
 * OpenCode 2 request hooks carry only a model reference (provider and model
 * id), while the provider-specific option sets live on the registered model as
 * a `variants` array. Any lookup failure means "no variants", which leaves the
 * request unchanged.
 *
 * @param ctx - Plugin context whose model registry is queried
 * @param ref - Model reference from the request hook
 * @returns A variant record keyed by variant id, or an empty record
 */
async function readModelVariants(
  ctx: Plugin.Context,
  ref: { providerID: string; id: string }
): Promise<Record<string, unknown>> {
  try {
    const listed = await ctx.model.list()
    const info = listed.data.find(
      (model) => model.providerID === ref.providerID && model.id === ref.id
    )
    if (info === undefined) return {}
    return normalizeModelVariants(info.variants)
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// CodeOps plugin for OpenCode 2
// Replaces: hooks/hooks.json + hook_session_context.sh + hook_marker_guard.sh
// ---------------------------------------------------------------------------
export default Plugin.define({
  id: "opencode-codeops",
  async setup(ctx) {
    const directory = ctx.location.directory

    // Reasoning-effort state lives for the lifetime of this plugin instance:
    // the latest dispatch-marker level per session, plus a deduplication set
    // for unsupported-level warnings.
    const effortMarkers = new Map<string, EffortLevel>()
    const warnedEffortLevels = new Set<string>()
    const effortTraceEnabled = isEffortTraceEnabled(process.env.CODEOPS_EFFORT_TRACE)

    // Sweep scratch directories abandoned by earlier interrupted runs, once.
    // Cleanup is best effort: a failure must never block a session.
    try {
      cleanStaleTmpDirs()
    } catch {
      // Best effort only.
    }

    warnOnVersionSkew(directory)

    // ---------------------------------------------------------------------
    // Session lifecycle: drop captured markers when a session is deleted, so
    // a long-lived runtime does not remember ended sessions.
    // ---------------------------------------------------------------------
    const controller = new AbortController()
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          if (event.type === "session.deleted") {
            effortMarkers.delete(event.data.sessionID)
          }
        }
      } catch {
        // The stream ended or the plugin unloaded; nothing to do.
      }
    })()

    // ---------------------------------------------------------------------
    // Standards injection: add the CodeOps standards to every agent-loop
    // request and to every compaction summary, so every agent and every turn
    // sees them and they cannot be lost to compaction.
    // ---------------------------------------------------------------------
    await ctx.session.hook("context", (event) => {
      event.system.push({ type: "text", text: standardsText })
    })

    await ctx.session.hook("compaction", (event) => {
      event.system.push({ type: "text", text: `${STANDARDS_HEADING}\n\n${standardsText}` })
    })

    // ---------------------------------------------------------------------
    // Effort capture: a dispatch marker travels in the incoming user prompt.
    // It is remembered for the whole session, because the later request hook
    // sees the same session rather than the message that carried it.
    // ---------------------------------------------------------------------
    await ctx.session.hook("prompt", (event) => {
      try {
        const level = findEffortMarker([event.prompt.text])
        if (level !== undefined) {
          effortMarkers.set(event.sessionID, level)
          traceEffort(effortTraceEnabled, event.sessionID, {
            event: "capture",
            messageID: event.messageID,
            level,
          })
        }
      } catch {
        warnContentFree("Could not scan a message for a reasoning-effort marker.")
      }
    })

    // ---------------------------------------------------------------------
    // Effort apply: resolve the request's reasoning level (dispatch marker,
    // then session flag, then routing default) and merge the model's own
    // variant options. Any failure leaves the request unchanged.
    // ---------------------------------------------------------------------
    await ctx.session.hook("context", async (event) => {
      try {
        const marker = effortMarkers.get(event.sessionID)
        const session = readSessionEffort(runtimeID)
        const routing = readRoutingReasoning(readRoutingConfig(directory), event.agent)
        const level = resolveEffort({ marker, session, routing })
        const source = isEffortLevel(marker)
          ? "marker"
          : isEffortLevel(session)
            ? "session"
            : isRoutingReasoning(routing)
              ? "routing"
              : "none"
        if (level === undefined) {
          traceEffort(effortTraceEnabled, event.sessionID, {
            event: "apply",
            agent: event.agent,
            level: null,
            source,
            applied: false,
          })
          return
        }

        const variants = await readModelVariants(ctx, event.model)
        const model = { variants }
        const applied = applyEffort(event.options, level, model)
        const changed = applied !== event.options
        traceEffort(effortTraceEnabled, event.sessionID, {
          event: "apply",
          agent: event.agent,
          level,
          source,
          applied: changed,
          variant: selectEffortVariant(level, model) ?? null,
          variantLevels: Object.keys(extractModelVariants(model) ?? {}),
        })
        if (!changed) {
          if (marker !== undefined) {
            const warningKey = `${event.sessionID}:${marker}`
            if (!warnedEffortLevels.has(warningKey)) {
              warnedEffortLevels.add(warningKey)
              warnContentFree(
                `Reasoning effort ${marker} is not available for agent ${event.agent}; ` +
                  "request left unchanged."
              )
            }
          }
          return
        }
        Object.assign(event.options, applied)
      } catch {
        warnContentFree("Could not apply a reasoning-effort level to a request.")
      }
    })

    // ---------------------------------------------------------------------
    // Shell environment: export CODEOPS_PLUGIN_ROOT so skills can call
    // scripts as: python3 "${CODEOPS_PLUGIN_ROOT}/scripts/codeops_plan.py".
    // CODEOPS_TMPDIR is this runtime's scratch directory; skills and agents
    // put every scratch file there and delete it when done.
    // ---------------------------------------------------------------------
    await ctx.shell.hook("create.before", (event) => {
      event.env.CODEOPS_PLUGIN_ROOT = PACKAGE_ROOT
      try {
        event.env.CODEOPS_TMPDIR = ensureSessionTmpDir(runtimeID)
      } catch {
        // Best effort: a temp-directory failure must never block a shell.
      }
    })

    // ---------------------------------------------------------------------
    // Advisory guard: warn (non-blocking) if any edit tool targets
    // codeops/.codeops.yml, which is owned exclusively by the setup-codeops
    // skill.
    // ---------------------------------------------------------------------
    await ctx.tool.hook("execute.before", (event) => {
      const editTools = ["write", "edit", "apply_patch", "multiedit", "patch"]
      if (!editTools.includes(event.tool)) return

      const input = isRecord(event.input) ? event.input : undefined
      const filePath =
        (typeof input?.filePath === "string" ? input.filePath : undefined) ??
        (typeof input?.path === "string" ? input.path : undefined) ??
        ""

      if (filePath.includes("codeops/.codeops.yml")) {
        process.stderr.write(
          "CodeOps warning: codeops/.codeops.yml is the layout marker and is " +
            "owned by setup-codeops. Edit it only through the setup/migration " +
            "workflow (run the setup-codeops skill).\n"
        )
      }
    })

    // ---------------------------------------------------------------------
    // Status RPC: expose the plugin, host, and project identity for the
    // optional sidebar strip. Registration is feature-detected and never
    // blocks the plugin: builds without custom RPCs keep working unchanged,
    // and the sidebar simply stays hidden.
    // ---------------------------------------------------------------------
    try {
      const registered = await registerCodeOpsRpc(ctx, { pluginVersion: packageVersion })
      if (!registered) {
        warnContentFree(
          "The codeops status RPC is unavailable in this OpenCode build; " +
            "the sidebar status stays hidden."
        )
      }
    } catch {
      warnContentFree("Could not register the codeops status RPC.")
    }

    // ---------------------------------------------------------------------
    // Plugin cleanup: stop listening for events. The runtime's scratch
    // directory is deliberately left in place — other sessions may still be
    // using it — and the startup sweep reclaims abandoned directories.
    // ---------------------------------------------------------------------
    return () => {
      controller.abort()
    }
  },
})
