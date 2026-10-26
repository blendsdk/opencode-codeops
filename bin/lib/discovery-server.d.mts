/**
 * Type declarations for the CodeOps Discovery listener.
 *
 * The listener is plain JavaScript so `node --test` can exercise it directly;
 * these declarations give the TypeScript plugin entry point typed access.
 */

import type { DiscoveryStore } from "./discovery-store.mjs"

/** The result of starting the listener. */
export interface ListeningResult {
  url: string
  fallback: boolean
}

/** The delivery outcome a registered project reports. */
export type DeliveryOutcome = "woken" | "pending" | "failed"

/** Options shared by runtime creation and lookup. */
export interface DiscoveryRuntimeOptions {
  store: DiscoveryStore
  assetsDir: string
  version: string
  port?: number
  log?: (message: string) => void
}

/** The process-wide Discovery runtime. */
export interface DiscoveryRuntime {
  /** Start the listener on demand; concurrent calls share one attempt. */
  ensureListening(): Promise<ListeningResult | null>
  /** Register one project's delivery callback; returns an identity-checked unregister. */
  registerProject(
    directory: string,
    slug: string,
    deliver: (planSlug: string) => Promise<DeliveryOutcome>
  ): () => void
  /** True when an open page shows this plan. */
  hasViewer(projectSlug: string, planSlug: string): boolean
  /** Broadcast one live event to the plan's open pages. */
  notify(
    projectSlug: string,
    planSlug: string,
    event: "changed" | "delivered",
    data: Record<string, unknown>
  ): void
  /** End streams, close connections, and stop when no project remains. */
  closeIfIdle(): Promise<void>
  /** The absolute page URL, or null before the listener starts. */
  planUrl(projectSlug: string, planSlug: string): string | null
  /** The one store every handler uses. */
  readonly store: DiscoveryStore
}

/** Resolve the listener port from the environment. */
export declare function resolvePort(env?: Record<string, string | undefined>): number

/** Create a runtime, installing it in the process-wide slot when empty. */
export declare function createDiscoveryRuntime(options: DiscoveryRuntimeOptions): DiscoveryRuntime

/** The process-wide runtime, created on first use. */
export declare function getDiscoveryRuntime(options: DiscoveryRuntimeOptions): DiscoveryRuntime
