import type { Plugin } from "@opencode-ai/plugin"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import {
  cleanStaleTmpDirs,
  ensureSessionTmpDir,
  removeSessionTmpDir,
} from "../bin/lib/tmp-hygiene.mjs"
import {
  applyEffort,
  findEffortMarker,
  readRoutingReasoning,
  readSessionEffort,
  resolveEffort,
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
// Load standards at startup (once). Both files are injected into every session.
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
// Workspace hygiene — the plugin owns one temp directory per session (exported
// as CODEOPS_TMPDIR) and sweeps directories abandoned by earlier interrupted
// runs. The sweep runs at most once per plugin process, so spawning many child
// sessions does not repeat the directory walk.
// ---------------------------------------------------------------------------
let sweptStaleTmpDirs = false

/**
 * Sweep temp directories abandoned by earlier interrupted runs, once per
 * process. Cleanup is best effort: a failure must never block a session.
 */
function sweepStaleTmpDirsOnce(): void {
  if (sweptStaleTmpDirs) return
  sweptStaleTmpDirs = true
  try {
    cleanStaleTmpDirs()
  } catch {
    // Best effort only.
  }
}

// ---------------------------------------------------------------------------
// Helper — inject standards into a session without triggering an AI reply.
// Uses client.session.prompt with noReply: true (confirmed from OpenCode SDK).
// ---------------------------------------------------------------------------
async function injectStandards(
  client: Parameters<Plugin>[0]["client"],
  sessionId: string
): Promise<void> {
  await client.session.prompt({
    path: { id: sessionId },
    body: {
      noReply: true,
      parts: [{ type: "text", text: standardsText }],
    },
  })
}

// ---------------------------------------------------------------------------
// Helper — read the version recorded in an installed skills marker, if any.
// The marker (`.opencode-codeops.json`) is written by the skills installer.
// Its absence means the skills are not managed — for example a development
// symlink — so there is no version to compare against.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Helper — warn (non-blocking) when the installed skills were written by a
// different CodeOps version than this plugin. The plugin and the files are
// installed by separate commands, so their versions can drift; a mismatch
// usually means the skills need `npx opencode-codeops update` again.
// ---------------------------------------------------------------------------
async function warnOnVersionSkew(
  client: Parameters<Plugin>[0]["client"],
  directory: string
): Promise<void> {
  const skillsDirs = [
    join(homedir(), ".config", "opencode", "skills"),
    join(directory, ".opencode", "skills"),
  ]

  for (const skillsDir of skillsDirs) {
    const installed = installedSkillsVersion(skillsDir)
    if (!installed || installed === packageVersion) continue

    await client.app.log({
      body: {
        service: "codeops",
        level: "warn",
        message:
          `CodeOps skills at ${skillsDir} are version ${installed}, ` +
          `but the plugin is version ${packageVersion}. ` +
          `Run \`npx opencode-codeops@${packageVersion} update\` to match them.`,
      },
    })
  }
}

// ---------------------------------------------------------------------------
// Helper — log one content-free warning. Logging is best effort: a failed log
// must never break a request.
// ---------------------------------------------------------------------------
async function warnContentFree(
  client: Parameters<Plugin>[0]["client"],
  message: string
): Promise<void> {
  try {
    await client.app.log({ body: { service: "codeops", level: "warn", message } })
  } catch {
    // Best effort only.
  }
}

// ---------------------------------------------------------------------------
// Helper — read the project routing config fresh on every request, so an edit
// applies without restarting the session. Any failure means "no routing".
// ---------------------------------------------------------------------------
function readRoutingConfig(directory: string): unknown {
  try {
    return JSON.parse(readFileSync(join(directory, "codeops", "codeops.json"), "utf8"))
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// CodeOps plugin for OpenCode
// Replaces: hooks/hooks.json + hook_session_context.sh + hook_marker_guard.sh
// ---------------------------------------------------------------------------
export const CodeOpsPlugin: Plugin = async ({ client, directory }) => {
  // Reasoning-effort state lives for the lifetime of this plugin instance:
  // one entry per user message that carried a dispatch marker, plus a
  // deduplication set for unsupported-level warnings.
  const effortMarkers = new Map<string, { sessionID: string; level: EffortLevel }>()
  const warnedEffortLevels = new Set<string>()

  return {
    // -----------------------------------------------------------------------
    // Hook 1 & 2: inject standards on session.created and session.compacted.
    // Both are dispatched via the generic event hook.
    // session.created  → new session    (Codex: startup)
    // session.compacted → after compact  (Codex: resume|compact)
    // Also the hygiene lifecycle: a new top-level session sweeps abandoned
    // temp directories once, and a deleted session's temp directory is removed.
    // -----------------------------------------------------------------------
    event: async ({ event }) => {
      if (event.type === "session.created") {
        const info = (event.properties as { info: { id: string; parentID?: string } }).info
        await injectStandards(client, info.id)
        await warnOnVersionSkew(client, directory)
        if (!info.parentID) sweepStaleTmpDirsOnce()
      } else if (event.type === "session.deleted") {
        const info = (event.properties as { info: { id: string } }).info
        removeSessionTmpDir(info.id)
        try {
          for (const [messageID, entry] of effortMarkers) {
            if (entry.sessionID === info.id) effortMarkers.delete(messageID)
          }
        } catch {
          // Best effort: cleanup must never break session deletion.
        }
      } else if (event.type === "session.compacted") {
        const sessionId: string = (event.properties as { sessionID: string }).sessionID
        await injectStandards(client, sessionId)
      }
    },

    // -----------------------------------------------------------------------
    // Hook 3: inject standards into the compaction context itself, so they
    // survive through the compaction summary and are not lost mid-session.
    // -----------------------------------------------------------------------
    "experimental.session.compacting": async (_input, output) => {
      output.context.push(
        "## CodeOps Standards (always active — survive this compaction)\n\n" +
          standardsText
      )
    },

    // -----------------------------------------------------------------------
    // Hook 4: export CODEOPS_PLUGIN_ROOT into every shell so skills can call
    // scripts as: python3 "${CODEOPS_PLUGIN_ROOT}/scripts/codeops_plan.py"
    // The value is the package root (parent of this plugin/ directory), which
    // is where skills/, scripts/, and the other shipped assets live.
    // CODEOPS_TMPDIR is the session's directory under the CodeOps temp root;
    // skills and agents put every scratch file there and delete it when done.
    // -----------------------------------------------------------------------
    "shell.env": async (input, output) => {
      output.env.CODEOPS_PLUGIN_ROOT = PACKAGE_ROOT
      try {
        output.env.CODEOPS_TMPDIR = ensureSessionTmpDir(input.sessionID)
      } catch {
        // Best effort: a temp-directory failure must never block a shell.
      }
    },

    // -----------------------------------------------------------------------
    // Hook 5: advisory guard — warn (non-blocking) if any edit tool targets
    // codeops/.codeops.yml, which is owned exclusively by the setup-codeops
    // skill. Equivalent to Codex PreToolUse hook_marker_guard.sh.
    // args are on the output parameter per the OpenCode plugin type signature.
    // -----------------------------------------------------------------------
    "tool.execute.before": async (input, output) => {
      const editTools = ["write", "edit", "apply_patch"]
      if (!editTools.includes(input.tool)) return

      const args = output.args as Record<string, unknown> | undefined
      const filePath: string =
        (args?.filePath as string | undefined) ??
        (args?.path as string | undefined) ??
        ""

      if (filePath.includes("codeops/.codeops.yml")) {
        process.stderr.write(
          "CodeOps warning: codeops/.codeops.yml is the layout marker and is " +
            "owned by setup-codeops. Edit it only through the setup/migration " +
            "workflow (run the setup-codeops skill).\n"
        )
      }
    },

    // -----------------------------------------------------------------------
    // Hook 6: capture a dispatch marker from an incoming user message. The
    // marker travels in the dispatch packet text; storing it by message id
    // lets the later chat.params hook apply it to the same request.
    // -----------------------------------------------------------------------
    "chat.message": async (input, output) => {
      try {
        const texts = output.parts.map((part) =>
          part.type === "text" ? part.text : undefined
        )
        const level = findEffortMarker(texts)
        if (level !== undefined) {
          effortMarkers.set(output.message.id, { sessionID: input.sessionID, level })
        }
      } catch {
        await warnContentFree(client, "Could not scan a message for a reasoning-effort marker.")
      }
    },

    // -----------------------------------------------------------------------
    // Hook 7: resolve the request's reasoning level (dispatch marker, then
    // session flag, then routing default) and merge the model's own variant
    // options. Any failure leaves the request unchanged.
    // -----------------------------------------------------------------------
    "chat.params": async (input, output) => {
      try {
        const stored = effortMarkers.get(input.message.id)
        const marker = stored && stored.sessionID === input.sessionID ? stored.level : undefined
        const session = readSessionEffort(input.sessionID)
        const routing = readRoutingReasoning(readRoutingConfig(directory), input.agent)
        const level = resolveEffort({ marker, session, routing })
        if (level === undefined) return

        const applied = applyEffort(output.options, level, input.model)
        if (applied === output.options) {
          if (marker !== undefined) {
            const warningKey = `${input.sessionID}:${marker}`
            if (!warnedEffortLevels.has(warningKey)) {
              warnedEffortLevels.add(warningKey)
              await warnContentFree(
                client,
                `Reasoning effort ${marker} is not available for agent ${input.agent}; ` +
                  "request left unchanged."
              )
            }
          }
          return
        }
        output.options = applied
      } catch {
        await warnContentFree(client, "Could not apply a reasoning-effort level to a request.")
      }
    },
  }
}
