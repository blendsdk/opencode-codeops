/**
 * The CodeOps TUI entry: the live run-progress view in the session sidebar.
 *
 * The view is deliberately honest: it shows only reported values from the
 * server's run state, always with an as-of time, and it renders nothing when
 * there is no run, when the host lacks the events API, or when every call
 * fails. There are no timers — the text recomputes whenever the component
 * re-renders — and no file access; all display and merge logic lives in the
 * shared helper module so it can be tested under plain Node.
 *
 * @module tui
 */

import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { createEffect, createResource, createSignal, onCleanup, Show } from "solid-js"

import {
  acceptRunCleared,
  acceptRunUpdate,
  describeRun,
  mergeRunState,
} from "../bin/lib/codeops-progress.mjs"
import type { CodeOpsRunState } from "../bin/lib/codeops-progress.mjs"
import { CodeOpsRpc, requestProgress } from "../bin/lib/codeops-rpc.mjs"

/**
 * The live run-progress view.
 *
 * Resolves the session's location once, subscribes to the `updated` and
 * `cleared` events before requesting an initial snapshot, and merges both
 * delivery paths monotonically. A clear records its server-stamped
 * `clearedAt`; both merge paths ignore deliveries at or before it, so a late
 * snapshot or update can never resurrect a cleared run. Every failure path is
 * silent: a host without the events API still renders from the snapshot, and
 * an invalid or missing snapshot renders nothing.
 *
 * @returns The three display lines, or nothing when no run is known.
 */
function CodeOpsProgress() {
  const context = usePlugin()
  const location = context.location ?? context.data.location.default()
  const directory = location?.directory ?? ""
  const [run, setRun] = createSignal<CodeOpsRunState | null>(null)
  const [clearedAt, setClearedAt] = createSignal(0)

  // Subscribe BEFORE the snapshot: events are live-only, so a snapshot
  // fetched first could miss an update arriving in between. Guarded: a host
  // without the events API still renders from the snapshot below.
  const stops: (() => void)[] = []
  try {
    const events = context.client.rpc(CodeOpsRpc).events
    stops.push(
      events.on("updated", (event) => {
        const snapshot = acceptRunUpdate(event, directory)
        if (snapshot && snapshot.updatedAt > clearedAt()) {
          setRun((current) => mergeRunState(current, snapshot))
        }
      }),
      events.on("cleared", (event) => {
        const cleared = acceptRunCleared(event, directory)
        const current = run()
        if (
          cleared &&
          current &&
          cleared.plan === current.plan &&
          cleared.sessionID === current.sessionID
        ) {
          setClearedAt(cleared.clearedAt)
          setRun(null)
        }
      })
    )
  } catch {
    // Events unavailable: the snapshot-only view below still renders.
  }
  onCleanup(() => stops.forEach((stop) => stop()))

  // Initial snapshot; null or a failure means "nothing known". The clear
  // guard applies here too: a snapshot at or before the last clear is ignored.
  const [initial] = createResource(async () => requestProgress(context.client, { location }))
  createEffect(() => {
    const snapshot = initial()
    if (snapshot && snapshot.updatedAt > clearedAt()) {
      setRun((current) => mergeRunState(current, snapshot))
    }
  })

  return (
    <Show when={run()}>
      {(snapshot) => {
        const view = () => describeRun(snapshot(), Date.now())
        return (
          <>
            {view().lines.map((line) => (
              <text>{line}</text>
            ))}
          </>
        )
      }}
    </Show>
  )
}

/**
 * The opencode-codeops TUI plugin: claims the sidebar content slot with the
 * live run view. The host disposes the claim when the plugin unloads.
 */
export default Plugin.define({
  id: "opencode-codeops-tui",
  setup(context) {
    return context.ui.slot({ append: "sidebar.content", render: () => <CodeOpsProgress /> })
  },
})
