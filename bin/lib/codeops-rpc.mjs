/**
 * The CodeOps RPC: definition, registration guard, payload guard, and the
 * progress snapshot helper.
 *
 * The definition is plain data — the SDK's `Rpc.define` performs identity and
 * reserved-name validation only — so this module needs no runtime import of
 * the SDK and `node --test` can exercise it directly. The definition carries
 * the `status` method, the `progress` method that answers with the current run
 * snapshot, and the `updated`/`cleared` events the sidebar follows. The
 * registration guard keeps the surface safe on builds that do not implement
 * custom RPCs: it never throws and reports success with a boolean. When the
 * host returns a registration exposing `events.emit`, the guard binds the
 * runtime's emission through it, so accepted reports push live updates.
 *
 * @module codeops-rpc
 */

import { RunClearedSchema, RunStateSchema, isCodeOpsRunState } from "./codeops-progress.mjs"

/**
 * The portable `codeops` RPC definition shared by the server plugin and the
 * TUI entry: a `status` method with an empty-object input and a three-string
 * payload, a `progress` method answering with the current run snapshot (or
 * `null`), and the `updated`/`cleared` events that push every accepted change.
 */
export const CodeOpsRpc = {
  id: "codeops",
  methods: {
    status: {
      input: { type: "object", additionalProperties: false },
      output: {
        type: "object",
        additionalProperties: false,
        required: ["pluginVersion", "openCodeVersion", "directory"],
        properties: {
          pluginVersion: { type: "string" },
          openCodeVersion: { type: "string" },
          directory: { type: "string" },
        },
      },
    },
    progress: {
      input: { type: "object", additionalProperties: false },
      output: { anyOf: [RunStateSchema, { type: "null" }] },
    },
  },
  events: {
    updated: { schema: RunStateSchema },
    cleared: { schema: RunClearedSchema },
  },
}

/**
 * Coerce an optional host value to the string form the payload requires.
 *
 * @param value - Value reported by the host context.
 * @returns The value as a string, or an empty string when it is absent.
 */
function asText(value) {
  return value === undefined || value === null ? "" : String(value)
}

/**
 * Register the codeops RPC on a plugin context, feature-detected and
 * never-throwing.
 *
 * When a runtime is supplied, the `progress` method answers with its current
 * snapshot and — if the returned registration exposes `events.emit` — the
 * runtime binds its emission through that function, so every accepted report
 * or clear pushes a live event.
 *
 * @param ctx - Server plugin context; only `rpc.register`, `app.version`, and
 *   `location.directory` are read.
 * @param {{ pluginVersion?: string, runtime?: object }} [options] -
 *   Registration options.
 * @returns `true` when the registration call completed, `false` when the host
 *   lacks the RPC API or the registration failed. Never throws.
 */
export async function registerCodeOpsRpc(ctx, { pluginVersion, runtime } = {}) {
  if (typeof ctx?.rpc?.register !== "function") return false
  try {
    const registration = await ctx.rpc.register(CodeOpsRpc, {
      async status() {
        return {
          pluginVersion: asText(pluginVersion),
          openCodeVersion: asText(ctx?.app?.version),
          directory: asText(ctx?.location?.directory),
        }
      },
      progress() {
        return runtime?.snapshot() ?? null
      },
    })
    if (
      runtime &&
      typeof runtime.bindEmit === "function" &&
      typeof registration?.events?.emit === "function"
    ) {
      runtime.bindEmit(registration.events.emit)
    }
    return true
  } catch {
    return false
  }
}

/**
 * Validate an unknown RPC payload as a complete CodeOps status record.
 *
 * @param value - Value received from the RPC.
 * @returns `true` only for a plain object carrying exactly the three string
 *   fields of the contract.
 */
export function isCodeOpsStatus(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  if (Object.keys(value).length !== 3) return false
  return (
    typeof value.pluginVersion === "string" &&
    typeof value.openCodeVersion === "string" &&
    typeof value.directory === "string"
  )
}

/**
 * Request the codeops status payload from a host client, converting every
 * transport failure into `undefined`.
 *
 * A caller can therefore render from the result without a `catch`: a host
 * without the RPC, a server plugin that failed to register, and a failed call
 * all collapse into the same "no status" outcome. The payload is returned as
 * received; narrow it with {@link isCodeOpsStatus} before use.
 *
 * Pass the calling session's location in `options`. The host resolves RPC
 * calls against a location, and a call without one can miss the plugin's
 * registration — the default location does not necessarily match a project
 * opened through a path argument.
 *
 * @param client - Host client exposing `rpc(definition).status({}, options)`.
 * @param {{ location?: { directory?: string, workspaceID?: string } }} [options]
 *   - Call options forwarded to the status call.
 * @returns The raw status payload, or `undefined` when the call fails.
 */
export async function requestStatus(client, options) {
  try {
    return await client.rpc(CodeOpsRpc).status({}, options)
  } catch {
    return undefined
  }
}

/**
 * Request the current run snapshot from a host client, converting every
 * failure into `null`.
 *
 * Pass the calling session's location in `options`, for the same reason as
 * {@link requestStatus}: the host resolves RPC calls against a location, and
 * a call without one can miss the plugin's registration. The payload is
 * validated before it is returned, so an invalid payload, a "no run" answer,
 * and any transport failure all collapse into `null` and the caller can
 * render without a `catch`.
 *
 * @param client - Host client exposing `rpc(definition).progress({}, options)`.
 * @param {{ location?: { directory?: string, workspaceID?: string } }} [options]
 *   - Call options forwarded to the progress call.
 * @returns The validated snapshot, or `null` when no run is active or the
 *   call failed. Never throws.
 */
export async function requestProgress(client, options) {
  try {
    const payload = await client.rpc(CodeOpsRpc).progress({}, options)
    return isCodeOpsRunState(payload) ? payload : null
  } catch {
    return null
  }
}
