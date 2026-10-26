/**
 * Type declarations for the CodeOps Discovery plugin integration.
 *
 * The module is plain JavaScript so `node --test` can exercise it directly;
 * these declarations give the TypeScript plugin entry point typed access.
 */

import type { DiscoveryRuntime } from "./discovery-server.mjs"

/** The project's Discovery settings. */
export interface DiscoverySettings {
  enabled: boolean
  chatMaxQuestions: number
}

/** The dependencies of one controller. */
export interface DiscoveryControllerDeps {
  directory: string
  dataDir: string
  assetsDir: string
  version: string
  openBrowser?: (url: string) => boolean
  branchOf?: (directory: string) => string | null
  warn?: (message: string) => void
}

/** The result of a tool call. */
export interface DiscoveryToolResult {
  ok: boolean
  reason?: string
  message?: string
  [key: string]: unknown
}

/** The per-project Discovery controller. */
export interface DiscoveryController {
  /** Re-read the setting and enable or disable Discovery. */
  sync(): Promise<void>
  isEnabled(): boolean
  onSessionDeleted(sessionID: string): Promise<void>
  /** Unregister, reload the tool list, and close the listener when idle. */
  dispose(): Promise<void>
  /** The runtime, or null while Discovery has never been enabled. */
  readonly runtime: DiscoveryRuntime | null
  /** Publish a plan round. */
  publish(input: unknown, sessionID: string): Promise<DiscoveryToolResult>
  /** Read submitted answers. */
  answers(input: unknown, sessionID: string): Promise<DiscoveryToolResult>
  /** Record or retire questions. */
  resolve(input: unknown, sessionID: string): Promise<DiscoveryToolResult>
}

/** Read the project's Discovery settings. */
export declare function readDiscoveryConfig(directory: string): DiscoverySettings

/** Create the per-project controller; never throws. */
export declare function createDiscoveryController(
  ctx: unknown,
  deps: DiscoveryControllerDeps
): DiscoveryController

/** Register the three agent tools; never throws. */
export declare function registerDiscoveryTools(
  ctx: unknown,
  controller: DiscoveryController
): Promise<boolean>
