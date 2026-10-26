/**
 * Discovery plugin integration.
 *
 * Connects Discovery to OpenCode: the opt-in check, the controller lifecycle,
 * the three agent tools, waking sessions, delivery, orphaning, and opening the
 * browser. The plugin entry point wires this module behind feature detection.
 *
 * Everything here is defensive: a missing host API, an unreadable config, or a
 * failing store call degrades to a documented result object. No handler throws
 * into an agent turn.
 *
 * @module discovery-tools
 */

import { execFile } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { DiscoveryPublishSchema, PLAN_KINDS } from "./discovery-rules.mjs"
import { createDiscoveryStore } from "./discovery-store.mjs"
import { getDiscoveryRuntime } from "./discovery-server.mjs"

/** The default question limit when the config names none. */
const DEFAULT_CHAT_MAX_QUESTIONS = 3

/** The name of the publish tool. */
const PUBLISH_TOOL = "codeops_discovery_publish"

/** The name of the answers tool. */
const ANSWERS_TOOL = "codeops_discovery_answers"

/** The name of the resolve tool. */
const RESOLVE_TOOL = "codeops_discovery_resolve"

/** The short tool descriptions shown to the agent. */
const DESCRIPTIONS = {
  [PUBLISH_TOOL]:
    "Publish a round of discovery questions and open the browser page. " +
    "Read _shared/discovery.md before using it.",
  [ANSWERS_TOOL]:
    "Read the answers the user submitted for a published plan. " +
    "Record them with codeops_discovery_resolve afterwards. " +
    "Read _shared/discovery.md before using it.",
  [RESOLVE_TOOL]:
    "Record submitted answers as resolved (with their register ids) or retire questions. " +
    "Read _shared/discovery.md before using it.",
}

/** The answers tool input schema. */
const ANSWERS_INPUT = {
  type: "object",
  additionalProperties: false,
  required: ["artifact", "kind"],
  properties: {
    artifact: { type: "string", minLength: 1, maxLength: 300 },
    kind: { type: "string", enum: [...PLAN_KINDS] },
  },
}

/** The resolve tool input schema. */
const RESOLVE_INPUT = {
  type: "object",
  additionalProperties: false,
  required: ["artifact", "kind"],
  properties: {
    artifact: { type: "string", minLength: 1, maxLength: 300 },
    kind: { type: "string", enum: [...PLAN_KINDS] },
    recorded: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "as"],
        properties: {
          key: { type: "string", minLength: 1 },
          as: { type: "string", minLength: 1 },
        },
      },
    },
    retire: { type: "array", items: { type: "string", minLength: 1 } },
  },
}

/** A short failure result. */
function failure(reason, message, extra = {}) {
  return { ok: false, reason, message, ...extra }
}

/** Open a URL with the platform's default browser without a shell. */
function defaultOpenBrowser(url) {
  try {
    const [command, args] =
      process.platform === "darwin"
        ? ["open", [url]]
        : process.platform === "win32"
          ? ["cmd", ["/c", "start", "", url]]
          : ["xdg-open", [url]]
    const child = execFile(command, args, { detached: true, stdio: "ignore" })
    child.on("error", () => {})
    child.unref()
    return true
  } catch {
    return false
  }
}

/**
 * Read the project's Discovery settings.
 *
 * An unreadable file, a missing `discovery` object, or a missing/non-boolean
 * `enabled` means disabled. An invalid `chatMaxQuestions` falls back to 3
 * without disabling Discovery.
 *
 * @param {string} directory - The project directory.
 * @returns {{ enabled: boolean, chatMaxQuestions: number }} The settings.
 */
export function readDiscoveryConfig(directory) {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(join(directory, "codeops", "codeops.json"), "utf8"))
  } catch {
    return { enabled: false, chatMaxQuestions: DEFAULT_CHAT_MAX_QUESTIONS }
  }
  const discovery = parsed?.discovery
  if (discovery === null || typeof discovery !== "object" || Array.isArray(discovery)) {
    return { enabled: false, chatMaxQuestions: DEFAULT_CHAT_MAX_QUESTIONS }
  }
  if (typeof discovery.enabled !== "boolean" || discovery.enabled !== true) {
    return { enabled: false, chatMaxQuestions: DEFAULT_CHAT_MAX_QUESTIONS }
  }
  const limit =
    Number.isInteger(discovery.chatMaxQuestions) && discovery.chatMaxQuestions >= 0
      ? discovery.chatMaxQuestions
      : DEFAULT_CHAT_MAX_QUESTIONS
  return { enabled: true, chatMaxQuestions: limit }
}

/**
 * Create the per-instance Discovery controller.
 *
 * The store and the process-wide runtime are created on the first **enabled**
 * `sync()` and never while the project is disabled. Every method contains its
 * own failures; the controller never throws to its caller.
 *
 * @param {unknown} ctx - The plugin context; only `tool`, `session`, and
 *   `location` are read.
 * @param {{ directory: string, dataDir: string, assetsDir: string, version: string,
 *   openBrowser?: (url: string) => boolean,
 *   branchOf?: (directory: string) => string | null,
 *   warn?: (message: string) => void }} deps - Controller dependencies.
 * @returns {object} The controller.
 */
export function createDiscoveryController(ctx, deps) {
  const openBrowser = typeof deps.openBrowser === "function" ? deps.openBrowser : defaultOpenBrowser
  let runtime = null
  let projectSlug = null
  let unregister = null
  let enabled = false
  let disposed = false
  let warnedAboutWake = false

  /** Reload the tool list without letting a host failure escape. */
  async function reloadTools() {
    try {
      await ctx?.tool?.reload?.()
    } catch {
      // The next request re-reads the transform.
    }
  }

  /** The absolute page URL of a plan, or null. */
  function pageUrl(planSlug) {
    return projectSlug ? runtime?.planUrl(projectSlug, planSlug) ?? null : null
  }

  /** Find the registered project. */
  async function project() {
    if (!runtime) return null
    return runtime.store.findProjectByDirectory(deps.directory)
  }

  /** Build the wake text for one plan's claimed submissions. */
  async function wakeText(record, claimed) {
    const projectRecord = await runtime.store.getProject(projectSlug)
    const name = projectRecord?.name ?? "project"
    const groups = new Set(claimed.flatMap((submission) => submission.groups))
    const titles = record.groups.filter((group) => groups.has(group.key)).map((group) => group.title)
    const count = claimed.reduce((total, submission) => total + submission.questions.length, 0)
    const noun = count === 1 ? "answer" : "answers"
    return `Discovery: ${count} ${noun} submitted for ${name} › ${record.title} (${titles.join(", ")}). Read them with ${ANSWERS_TOOL}.`
  }

  /**
   * Wake the plan's owner with one message covering every claimed submission.
   *
   * Returns `woken` only after the prompt resolves and the claims are recorded.
   * A missing session API, an unreachable owner, a live foreign claim, or a
   * rejected prompt all leave the work pending.
   */
  async function deliver(planSlug) {
    if (!runtime || !projectSlug || disposed) return "pending"
    try {
      const record = await runtime.store.getPlan(projectSlug, planSlug)
      if (!record || !record.owner?.sessionID) return "pending"
      const sessionID = record.owner.sessionID
      if (typeof ctx?.session?.get !== "function" || typeof ctx?.session?.prompt !== "function") {
        return "pending"
      }
      try {
        await ctx.session.get({ sessionID })
      } catch {
        return "pending"
      }
      const pending = await runtime.store.pendingDeliveries(projectSlug)
      const entry = pending.find((item) => item.planSlug === planSlug)
      if (!entry) return "pending"
      const claimed = []
      try {
        for (const submission of entry.submissions) {
          if (await runtime.store.claimDelivery(projectSlug, planSlug, submission.id, sessionID)) {
            claimed.push(submission)
          }
        }
        if (claimed.length === 0) return "pending"
        const text = await wakeText(record, claimed)
        await ctx.session.prompt({ sessionID, text, delivery: "queue" })
      } catch {
        for (const submission of claimed) {
          try {
            await runtime.store.releaseDelivery(projectSlug, planSlug, submission.id)
          } catch {
            // A refused file stays claimed until its pid is gone.
          }
        }
        return "pending"
      }
      try {
        await runtime.store.markDelivered(
          projectSlug,
          planSlug,
          claimed.map((submission) => submission.id),
          sessionID,
        )
        for (const submission of claimed) {
          runtime.notify(projectSlug, planSlug, "delivered", { submissionId: submission.id })
        }
        return "woken"
      } catch {
        return "pending"
      }
    } catch {
      return "pending"
    }
  }

  /** Deliver every plan that has pending work. */
  async function deliverPending() {
    if (!runtime || !projectSlug) return
    try {
      const pending = await runtime.store.pendingDeliveries(projectSlug)
      for (const entry of pending) await deliver(entry.planSlug)
    } catch {
      // Delivery is best effort at every point.
    }
  }

  /** Turn Discovery on for this project. */
  async function enable() {
    try {
      if (!runtime) {
        const store = createDiscoveryStore({ dataDir: deps.dataDir })
        runtime = getDiscoveryRuntime({
          store,
          assetsDir: deps.assetsDir,
          version: deps.version,
        })
      }
      const branch =
        typeof deps.branchOf === "function" ? deps.branchOf(deps.directory) : null
      const record = await runtime.store.registerProject({
        directory: deps.directory,
        branch,
        repository: {
          id: String(ctx?.location?.project?.id ?? deps.directory),
          canonical: String(ctx?.location?.project?.canonical ?? deps.directory),
        },
      })
      projectSlug = record.slug
      await runtime.ensureListening()
      unregister = runtime.registerProject(deps.directory, record.slug, deliver)
      enabled = true
      if (
        !warnedAboutWake &&
        (typeof ctx?.session?.get !== "function" || typeof ctx?.session?.prompt !== "function")
      ) {
        warnedAboutWake = true
        if (typeof deps.warn === "function") {
          deps.warn("Discovery cannot wake sessions in this OpenCode build.")
        }
      }
      await deliverPending()
      await reloadTools()
    } catch {
      enabled = false
      unregister = null
    }
  }

  /** Turn Discovery off for this project without blocking the hook. */
  async function disable() {
    if (unregister) {
      try {
        unregister()
      } catch {
        // The registration may already be gone.
      }
    }
    unregister = null
    enabled = false
    projectSlug = null
    if (runtime) {
      try {
        void runtime.closeIfIdle()
      } catch {
        // Nothing is listening.
      }
    }
    await reloadTools()
  }

  return {
    get runtime() {
      return runtime
    },

    isEnabled() {
      return enabled
    },

    async sync() {
      if (disposed) return
      const config = readDiscoveryConfig(deps.directory)
      if (config.enabled === enabled) return
      if (config.enabled) await enable()
      else await disable()
    },

    async onSessionDeleted(sessionID) {
      if (!runtime || !projectSlug) return
      try {
        await runtime.store.markOrphaned(projectSlug, sessionID)
      } catch {
        // Orphaning is best effort; a later publish can still take over.
      }
    },

    async dispose() {
      disposed = true
      if (unregister) {
        try {
          unregister()
        } catch {
          // Already unregistered.
        }
      }
      unregister = null
      enabled = false
      await reloadTools()
      if (runtime) await runtime.closeIfIdle()
    },

    /** Publish a plan round on behalf of the agent. */
    async publish(input, sessionID) {
      try {
        if (!enabled || !runtime) {
          return failure("disabled", "Discovery is disabled for this project.")
        }
        const listening = await runtime.ensureListening()
        if (!listening) {
          return failure("unavailable", "Discovery is unavailable on this machine; ask in chat.")
        }
        const projectRecord = await project()
        if (!projectRecord) return failure("not-found", "This project is not registered.")
        const result = await runtime.store.publish(projectRecord.slug, input, sessionID)
        if (!result.ok) {
          if (result.reason === "invalid") {
            return failure("invalid", "The publish payload is invalid.", {
              errors: result.errors,
            })
          }
          return failure("owned", "This plan is owned by another session.", {
            owner: result.owner,
          })
        }
        const url = pageUrl(result.plan.slug)
        const opened = !runtime.hasViewer(projectRecord.slug, result.plan.slug) && Boolean(openBrowser(url))
        runtime.notify(projectRecord.slug, result.plan.slug, "changed", {
          revision: result.plan.revision,
        })
        await deliver(result.plan.slug)
        return {
          ok: true,
          url,
          plan: {
            slug: result.plan.slug,
            title: result.plan.title,
            kind: result.plan.kind,
            artifact: result.plan.artifact,
            revision: result.plan.revision,
          },
          revision: result.plan.revision,
          opened,
          fallbackPort: listening.fallback ? Number(new URL(listening.url).port) : null,
          warnings: result.warnings,
        }
      } catch {
        return failure("error", "Discovery could not publish this plan.")
      }
    },

    /** Read the submitted answers for a plan. */
    async answers(input, sessionID) {
      try {
        if (!enabled || !runtime) {
          return failure("disabled", "Discovery is disabled for this project.")
        }
        const projectRecord = await project()
        if (!projectRecord) return failure("not-found", "This project is not registered.")
        const plan = await runtime.store.findPlan(projectRecord.slug, input.kind, input.artifact)
        if (!plan) return failure("not-found", "No published plan matches that artifact.")
        const result = await runtime.store.readAnswers(projectRecord.slug, plan.slug, sessionID)
        if (!result.ok) {
          if (result.reason === "not-found") {
            return failure("not-found", "The plan no longer exists.")
          }
          return failure("owned", "This plan is owned by another session.", {
            owner: result.owner,
          })
        }
        runtime.notify(projectRecord.slug, plan.slug, "changed", {
          revision: result.plan.revision,
        })
        return {
          ok: true,
          plan: {
            slug: result.plan.slug,
            title: result.plan.title,
            revision: result.plan.revision,
          },
          submissions: result.submissions,
        }
      } catch {
        return failure("error", "Discovery could not read the answers.")
      }
    },

    /** Record or retire questions for a plan. */
    async resolve(input, sessionID) {
      try {
        if (!enabled || !runtime) {
          return failure("disabled", "Discovery is disabled for this project.")
        }
        const projectRecord = await project()
        if (!projectRecord) return failure("not-found", "This project is not registered.")
        const plan = await runtime.store.findPlan(projectRecord.slug, input.kind, input.artifact)
        if (!plan) return failure("not-found", "No published plan matches that artifact.")
        const result = await runtime.store.resolve(projectRecord.slug, plan.slug, sessionID, {
          recorded: input.recorded,
          retire: input.retire,
        })
        if (!result.ok) {
          if (result.reason === "not-found") {
            return failure("not-found", "The plan no longer exists.")
          }
          if (result.reason === "owned") {
            return failure("owned", "This plan is owned by another session.", {
              owner: result.owner,
            })
          }
          return failure("invalid", "The resolve input is invalid.", {
            ...(result.errors === undefined ? {} : { errors: result.errors }),
          })
        }
        runtime.notify(projectRecord.slug, plan.slug, "changed", {
          revision: plan.revision,
        })
        return { ok: true, recorded: result.recorded, retired: result.retired }
      } catch {
        return failure("error", "Discovery could not record the answers.")
      }
    },
  }
}

/**
 * Register the three Discovery tools on a plugin context.
 *
 * The transform adds the tools only while the controller is enabled, so a
 * disabled project behaves exactly as before. Registration never throws and
 * returns a boolean, like the progress tool.
 *
 * @param {unknown} ctx - The plugin context.
 * @param {object} controller - The Discovery controller.
 * @returns {Promise<boolean>} True when the transform completed.
 */
export async function registerDiscoveryTools(ctx, controller) {
  if (typeof ctx?.tool?.transform !== "function") return false
  try {
    await ctx.tool.transform((tool) => {
      if (!controller.isEnabled()) return
      tool.add({
        name: PUBLISH_TOOL,
        description: DESCRIPTIONS[PUBLISH_TOOL],
        input: DiscoveryPublishSchema,
        async execute(input, toolContext) {
          return { output: await controller.publish(input, toolContext?.sessionID ?? "") }
        },
      })
      tool.add({
        name: ANSWERS_TOOL,
        description: DESCRIPTIONS[ANSWERS_TOOL],
        input: ANSWERS_INPUT,
        async execute(input, toolContext) {
          return { output: await controller.answers(input, toolContext?.sessionID ?? "") }
        },
      })
      tool.add({
        name: RESOLVE_TOOL,
        description: DESCRIPTIONS[RESOLVE_TOOL],
        input: RESOLVE_INPUT,
        async execute(input, toolContext) {
          return { output: await controller.resolve(input, toolContext?.sessionID ?? "") }
        },
      })
    })
    return true
  } catch {
    return false
  }
}
