/**
 * Type declarations for the CodeOps status RPC helper.
 *
 * The helper is plain JavaScript so `node --test` can exercise it directly;
 * these declarations give the TypeScript plugin entries typed access.
 */

/** JSON-Schema shape of the empty input accepted by the `status` method. */
export type CodeOpsRpcStatusInput = {
  readonly type: "object"
  readonly additionalProperties: false
}

/** JSON-Schema shape of the payload the `status` method returns. */
export type CodeOpsRpcStatusOutput = {
  readonly type: "object"
  readonly additionalProperties: false
  readonly required: readonly ["pluginVersion", "openCodeVersion", "directory"]
  readonly properties: {
    readonly pluginVersion: { readonly type: "string" }
    readonly openCodeVersion: { readonly type: "string" }
    readonly directory: { readonly type: "string" }
  }
}

/** The status payload after runtime validation. */
export interface CodeOpsStatus {
  readonly pluginVersion: string
  readonly openCodeVersion: string
  readonly directory: string
}

/** The portable RPC definition shared by the server plugin and the TUI entry. */
export interface CodeOpsRpcDefinition {
  readonly id: "codeops"
  readonly methods: {
    readonly status: {
      readonly input: CodeOpsRpcStatusInput
      readonly output: CodeOpsRpcStatusOutput
    }
  }
  readonly events: Readonly<Record<string, never>>
}

/** The shared definition object; plain data with no runtime imports. */
export declare const CodeOpsRpc: CodeOpsRpcDefinition

/** Options accepted by {@link registerCodeOpsRpc}. */
export interface RegisterCodeOpsRpcOptions {
  /** Version of the installed package, reported by the status method. */
  pluginVersion?: string
}

/**
 * Feature-detect `ctx.rpc.register`, register the codeops RPC when present,
 * and report success. Never throws.
 */
export declare function registerCodeOpsRpc(
  ctx: unknown,
  options?: RegisterCodeOpsRpcOptions
): Promise<boolean>

/** Validate an unknown RPC payload as a complete CodeOps status record. */
export declare function isCodeOpsStatus(value: unknown): value is CodeOpsStatus

/** The location a status call is scoped to. */
export interface CodeOpsLocation {
  readonly directory: string
  readonly workspaceID?: string
}

/** Call options forwarded to the status call. */
export interface CodeOpsCallOptions {
  readonly location?: CodeOpsLocation
}

/** Structural client shape {@link requestStatus} consumes. */
export interface CodeOpsStatusClient {
  readonly rpc: (definition: CodeOpsRpcDefinition) => {
    readonly status: (
      input: Record<string, never>,
      options?: CodeOpsCallOptions
    ) => Promise<unknown>
  }
}

/**
 * Request the raw status payload from a host client, converting every
 * transport failure into `undefined`.
 *
 * Pass the calling session's location in `options`: the host resolves RPC
 * calls against it, and a call without one can miss the plugin's registration
 * when the session's project differs from the host's default location.
 */
export declare function requestStatus(
  client: CodeOpsStatusClient,
  options?: CodeOpsCallOptions
): Promise<unknown>
