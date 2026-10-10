/**
 * The CodeOps TUI entry: a one-line status strip in the session sidebar.
 *
 * The strip is deliberately honest: it renders the plugin version line only
 * when the server plugin answers the `status` RPC with a valid payload. On
 * every failure — a host without custom RPCs, a server plugin that could not
 * register, an invalid payload — it renders nothing, so the sidebar never
 * shows an unverified claim.
 *
 * @module tui
 */

import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { createResource, Show } from "solid-js"

import { isCodeOpsStatus, requestStatus } from "../bin/lib/codeops-rpc.mjs"

/**
 * The sidebar status strip.
 *
 * Resolves the server's status once per mount, scoped to the session's
 * location so the host can find the plugin's registration regardless of how
 * the terminal was opened. The resource yields the validated payload, or
 * `undefined` for every failure mode; the strip renders exactly when a valid
 * payload is present.
 *
 * @returns The strip line, or nothing when the status is unavailable.
 */
function CodeOpsStrip() {
  const context = usePlugin()
  const location = context.location ?? context.data.location.default()
  const [status] = createResource(async () => {
    const payload = await requestStatus(context.client, { location })
    return isCodeOpsStatus(payload) ? payload : undefined
  })
  return (
    <Show when={status()}>
      {(payload) => <text>CodeOps v{payload().pluginVersion}</text>}
    </Show>
  )
}

/**
 * The opencode-codeops TUI plugin: claims the sidebar content slot with the
 * status strip. The host disposes the claim when the plugin unloads.
 */
export default Plugin.define({
  id: "opencode-codeops-tui",
  setup(context) {
    return context.ui.slot({ append: "sidebar.content", render: () => <CodeOpsStrip /> })
  },
})
