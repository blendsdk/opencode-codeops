/**
 * The pure navigation gate.
 *
 * A destination is only committed after the mounted plan has finished saving.
 * The gate stores one latest request, so several link clicks during a slow
 * save cannot queue up a trail of pages. It does not know about React or the
 * browser: the caller injects the flush and the history writer, which makes
 * every interleaving testable in Node.
 *
 * @module navigation
 */

/** The history operation for one destination. */
export interface NavigationRequest {
  /** The destination hash. */
  hash: string
  /** True when the current history entry should be rewritten. */
  replace: boolean
}

/** The injected boundaries used by the gate. */
export interface NavigationGateOptions {
  /** Resolve true when the mounted editor has no unsaved work. */
  flush: () => Promise<boolean>
  /** Write the hash without deciding whether it is safe. */
  write: (hash: string, options: { replace: boolean }) => void
  /** The hash currently displayed, used to restore a failed navigation. */
  current: () => string
}

/** The gate surface used by the app shell. */
export interface NavigationGate {
  /** Store a destination; only the latest one may commit. */
  request(hash: string, options?: { replace?: boolean }): void
  /** Flush and commit the latest destination. */
  settle(): Promise<boolean>
  /** Drop the request and restore the displayed destination. */
  cancel(): void
  /** Drop the request and ignore a late flush result. */
  dispose(): void
}

/**
 * Create one navigation gate.
 *
 * @param options - The save boundary, history writer, and displayed hash.
 * @returns The gate surface.
 *
 * @example
 * const gate = createNavigationGate({ flush, write, current })
 * gate.request("#/p/repo/plan/summary")
 * await gate.settle()
 */
export function createNavigationGate(options: NavigationGateOptions): NavigationGate {
  let latest: NavigationRequest | null = null
  let running: Promise<boolean> | null = null
  let disposed = false
  let cancelled = false

  /** Restore the displayed hash with a replacement entry. */
  function restore(): void {
    options.write(options.current(), { replace: true })
  }

  /** Flush once, then commit the newest request that arrived while waiting. */
  async function run(): Promise<boolean> {
    try {
      while (!disposed && latest !== null) {
        const request = latest
        latest = null
        const saved = await options.flush()
        if (disposed) return false
        if (cancelled) {
          cancelled = false
          restore()
          return false
        }
        if (!saved) {
          latest = null
          restore()
          return false
        }
        const destination = latest ?? request
        latest = null
        options.write(destination.hash, { replace: destination.replace })
        return true
      }
      return false
    } finally {
      running = null
    }
  }

  function request(hash: string, requestOptions?: { replace?: boolean }): void {
    if (disposed) return
    // A new destination after a cancel is a fresh intent, not the cancelled one.
    cancelled = false
    latest = { hash, replace: requestOptions?.replace === true }
  }

  function settle(): Promise<boolean> {
    if (disposed || latest === null) return Promise.resolve(false)
    if (running !== null) return running
    running = run()
    return running
  }

  function cancel(): void {
    if (disposed) return
    latest = null
    if (running !== null) {
      cancelled = true
      return
    }
    restore()
  }

  function dispose(): void {
    disposed = true
    latest = null
  }

  return { request, settle, cancel, dispose }
}
