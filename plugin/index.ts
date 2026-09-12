import type { Plugin } from "@opencode-ai/plugin"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

// ---------------------------------------------------------------------------
// Package root — resolved at module load time so it is always the plugin's
// installed directory, regardless of the working directory at event time.
// PLUGIN_DIR contains this entry point (plugin/); PACKAGE_ROOT is one level
// above it and holds standards/, skills/, scripts/, and the agent templates.
// ---------------------------------------------------------------------------
const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = dirname(PLUGIN_DIR)

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
// CodeOps plugin for OpenCode
// Replaces: hooks/hooks.json + hook_session_context.sh + hook_marker_guard.sh
// ---------------------------------------------------------------------------
export const CodeOpsPlugin: Plugin = async ({ client }) => {
  return {
    // -----------------------------------------------------------------------
    // Hook 1 & 2: inject standards on session.created and session.compacted.
    // Both are dispatched via the generic event hook.
    // session.created  → new session    (Codex: startup)
    // session.compacted → after compact  (Codex: resume|compact)
    // -----------------------------------------------------------------------
    event: async ({ event }) => {
      if (event.type === "session.created") {
        const sessionId: string = (event.properties as { info: { id: string } }).info.id
        await injectStandards(client, sessionId)
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
    // -----------------------------------------------------------------------
    "shell.env": async (_input, output) => {
      output.env.CODEOPS_PLUGIN_ROOT = PACKAGE_ROOT
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
  }
}
