/**
 * The CodeOps status RPC: definition, registration guard, and payload guard.
 *
 * The definition is plain data — the SDK's `Rpc.define` performs identity and
 * reserved-name validation only — so this module needs no runtime import of
 * the SDK and `node --test` can exercise it directly. The registration guard
 * keeps the surface safe on builds that do not implement custom RPCs: it never
 * throws and reports success with a boolean. The status request helper turns
 * every transport failure into "no status", so a rendering component never has
 * to catch.
 *
 * @module codeops-rpc
 */

/**
 * The portable `codeops` RPC definition shared by the server plugin and the
 * TUI entry: one `status` method with an empty-object input and a
 * three-string payload, and no events.
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
  },
  events: {},
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
 * @param ctx - Server plugin context; only `rpc.register`, `app.version`, and
 *   `location.directory` are read.
 * @param {{ pluginVersion?: string }} [options] - Registration options.
 * @returns `true` when the registration call completed, `false` when the host
 *   lacks the RPC API or the registration failed. Never throws.
 */
export async function registerCodeOpsRpc(ctx, { pluginVersion } = {}) {
  if (typeof ctx?.rpc?.register !== "function") return false
  try {
    await ctx.rpc.register(CodeOpsRpc, {
      async status() {
        return {
          pluginVersion: asText(pluginVersion),
          openCodeVersion: asText(ctx?.app?.version),
          directory: asText(ctx?.location?.directory),
        }
      },
    })
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
