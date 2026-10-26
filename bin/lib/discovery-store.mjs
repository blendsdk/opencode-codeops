/**
 * Discovery store.
 *
 * Persists projects, plans, answers, and submissions as JSON files and owns
 * every state transition. The server and the agent tools are its only callers;
 * the rules module supplies validation and evaluation.
 *
 * Two invariants shape the implementation:
 *
 * - **Durability.** Every mutation re-reads the file, applies the change, and
 *   writes a temporary file that is renamed over the original. Mutations for
 *   one absolute path share a single process-wide queue, so two store
 *   instances in the same process cannot interleave a read-modify-write.
 * - **Refusal over repair.** A file written by a newer schema version or a
 *   malformed file is never rewritten. The caller receives a typed
 *   `DiscoveryDataError` and can tell the user to update CodeOps.
 *
 * The module is Node-only: it reads and writes the user's data directory.
 *
 * @module discovery-store
 */

import { randomBytes } from "node:crypto"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join, resolve, sep } from "node:path"

import {
  DISCOVERY_SCHEMA_VERSION,
  SLUG_PATTERN,
  evaluatePlan,
  groupReadiness,
  planCounts,
  questionFingerprint,
  toAnswer,
  validateAnswer,
  validateDefer,
  validatePublish,
} from "./discovery-rules.mjs"

/** Maximum length of a generated project slug. */
const PROJECT_SLUG_MAX = 40

/** Maximum length of a generated plan slug, including suffix and collision number. */
const PLAN_SLUG_MAX = 52

/** Maximum length of a stored note. */
const NOTES_MAX = 4000

/** One queue per absolute file path, shared by every store instance. */
const writeQueues = new Map()

/**
 * A refusal to read or write Discovery data.
 *
 * `code` is `newer-version` when the file was written by a newer CodeOps
 * version, and `unreadable` when it cannot be parsed or resolved safely.
 */
export class DiscoveryDataError extends Error {
  /**
   * @param {"newer-version" | "unreadable"} code - The refusal reason.
   * @param {string} message - A message safe to show the user.
   */
  constructor(code, message) {
    super(message)
    this.name = "DiscoveryDataError"
    this.code = code
  }
}

/**
 * Expand a leading `~` to the user's home directory.
 *
 * @param {string} value - The configured path.
 * @param {string} home - The home directory to substitute.
 * @returns {string} The expanded path.
 */
function expandHome(value, home) {
  if (value === "~") return home
  if (value.startsWith("~/")) return join(home, value.slice(2))
  return value
}

/**
 * Resolve the Discovery data directory.
 *
 * The base is `$CODEOPS_DATA_DIR` when set, otherwise
 * `~/.local/share/opencode/codeops`; the result always ends in `discovery`.
 *
 * @param {Record<string, string | undefined>} [env] - Environment variables.
 * @param {string} [home] - Home directory, injectable for tests.
 * @returns {string} The absolute Discovery data directory.
 */
export function resolveDataDir(env = process.env, home = homedir()) {
  const base = env?.CODEOPS_DATA_DIR
    ? expandHome(String(env.CODEOPS_DATA_DIR), home)
    : join(home, ".local/share/opencode/codeops")
  return join(base, "discovery")
}

/** True for an object created by `{}` or `JSON.parse`, false for arrays/null. */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** Lower-case and slugify one path segment, falling back to `project`. */
function slugify(value, max) {
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "")
  return slug.length > 0 ? slug : "project"
}

/** Derive the base plan slug from the artifact's last segment and the kind. */
function planSlugBase(artifact, kind) {
  const segment = String(artifact).split("/").filter(Boolean).pop() ?? "plan"
  let base = slugify(segment, PROJECT_SLUG_MAX)
  if (kind !== "plan" && base !== kind) base = `${base}-${kind}`
  return base.slice(0, PLAN_SLUG_MAX).replace(/-+$/g, "") || "plan"
}

/** Create a directory with owner-only permissions and tighten an existing one. */
function ensureDirectory(directory, mode = 0o700) {
  mkdirSync(directory, { recursive: true, mode })
  try {
    chmodSync(directory, mode)
  } catch {
    // Best effort: some file systems do not support POSIX modes.
  }
}

/** True when a process id is still running on this machine. */
function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error?.code === "EPERM"
  }
}

/** Write one JSON record through a temporary file and an atomic rename. */
function writeJson(file, record) {
  ensureDirectory(dirname(file))
  const temporary = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`
  try {
    writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 })
    renameSync(temporary, file)
  } catch (error) {
    try {
      unlinkSync(temporary)
    } catch {
      // The temporary file was never created or is already gone.
    }
    throw error
  }
}

/**
 * Run one task inside the process-wide queue for a file path.
 *
 * The task always runs after the previous task for the same path settles,
 * whether it succeeded or failed. The returned promise carries the task's own
 * result or error.
 *
 * @template T
 * @param {string} file - The absolute file path.
 * @param {() => Promise<T> | T} task - The critical section.
 * @returns {Promise<T>} The task's result.
 */
function withFile(file, task) {
  const previous = writeQueues.get(file) ?? Promise.resolve()
  const run = previous.then(task, task)
  const tracked = run.catch(() => {})
  writeQueues.set(file, tracked)
  tracked.finally(() => {
    if (writeQueues.get(file) === tracked) writeQueues.delete(file)
  })
  return run
}

/**
 * Create the discovery store over one data directory.
 *
 * The data directory is created with mode `0700` if needed and tightened if it
 * already exists. All other methods are asynchronous so the write queue can
 * serialize them.
 *
 * @param {{ dataDir: string, now?: () => Date }} options - The data directory and an
 *   optional clock, injectable for tests.
 * @returns {object} The store API.
 */
export function createDiscoveryStore(options) {
  const dataDir = resolve(options.dataDir)
  const now = typeof options.now === "function" ? options.now : () => new Date()
  const timestamp = () => now().toISOString()
  ensureDirectory(dataDir)

  const projectsRoot = join(dataDir, "projects")

  /** Absolute project directory, refusing a path outside the data directory. */
  function projectDirectory(projectSlug) {
    if (typeof projectSlug !== "string" || !SLUG_PATTERN.test(projectSlug)) {
      throw new DiscoveryDataError("unreadable", "invalid project slug")
    }
    const directory = resolve(projectsRoot, projectSlug)
    if (!directory.startsWith(projectsRoot + sep)) {
      throw new DiscoveryDataError("unreadable", "path outside the Discovery data directory")
    }
    return directory
  }

  /** Absolute plan file, refusing a path outside the project directory. */
  function planFile(projectSlug, planSlug) {
    if (typeof planSlug !== "string" || !SLUG_PATTERN.test(planSlug)) {
      throw new DiscoveryDataError("unreadable", "invalid plan slug")
    }
    const directory = projectDirectory(projectSlug)
    const file = resolve(directory, "plans", `${planSlug}.json`)
    if (!file.startsWith(join(directory, "plans") + sep)) {
      throw new DiscoveryDataError("unreadable", "path outside the Discovery data directory")
    }
    return file
  }

  /** The project record file. */
  function projectFile(projectSlug) {
    return join(projectDirectory(projectSlug), "project.json")
  }

  /** Parse one JSON file, refusing newer or malformed data. */
  function readJson(file) {
    if (!existsSync(file)) return null
    let parsed
    try {
      parsed = JSON.parse(readFileSync(file, "utf8"))
    } catch {
      throw new DiscoveryDataError("unreadable", `unreadable Discovery data: ${basename(file)}`)
    }
    if (!isPlainObject(parsed)) {
      throw new DiscoveryDataError("unreadable", `unreadable Discovery data: ${basename(file)}`)
    }
    if (
      typeof parsed.schemaVersion === "number" &&
      parsed.schemaVersion > DISCOVERY_SCHEMA_VERSION
    ) {
      throw new DiscoveryDataError(
        "newer-version",
        "written by a newer CodeOps version — update CodeOps",
      )
    }
    return parsed
  }

  /** Read every project record; a broken project is skipped, never rewritten. */
  function readProjectRecords() {
    if (!existsSync(projectsRoot)) return []
    const records = []
    for (const entry of readdirSync(projectsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      try {
        const record = readJson(join(projectsRoot, entry.name, "project.json"))
        if (!record) continue
        if (record.slug !== entry.name || !SLUG_PATTERN.test(record.slug)) continue
        records.push(record)
      } catch {
        // A broken project stays unavailable; other projects keep working.
      }
    }
    return records.sort((left, right) => String(left.slug).localeCompare(String(right.slug)))
  }

  /** Read every plan record of a project, optionally skipping refused files. */
  function readPlanRecords(projectSlug, { skipRefused = true } = {}) {
    const directory = join(projectDirectory(projectSlug), "plans")
    if (!existsSync(directory)) return []
    const records = []
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue
      try {
        const record = readJson(join(directory, entry.name))
        if (record) records.push(record)
      } catch (error) {
        if (!skipRefused) throw error
      }
    }
    return records.sort((left, right) => String(left.slug).localeCompare(String(right.slug)))
  }

  /** Pick a unique project slug for a directory name. */
  function uniqueProjectSlug(base, records) {
    const taken = new Set(records.map((record) => record.slug))
    let slug = base
    let counter = 2
    while (taken.has(slug)) {
      const suffix = `-${counter}`
      slug = `${base.slice(0, Math.max(1, PROJECT_SLUG_MAX - suffix.length))}${suffix}`
      counter += 1
    }
    return slug
  }

  /** Pick a unique plan slug inside one project. */
  function uniquePlanSlug(base, records) {
    const taken = new Set(records.map((record) => record.slug))
    let slug = base
    let counter = 2
    while (taken.has(slug)) {
      const suffix = `-${counter}`
      slug = `${base.slice(0, Math.max(1, PLAN_SLUG_MAX - suffix.length))}${suffix}`
      counter += 1
    }
    return slug
  }

  /** Build the evaluation state from a plan record. */
  function stateOf(record) {
    return {
      questions: Object.fromEntries(
        record.questions.map((question) => [
          question.key,
          { ...question.state, revisedAt: question.revisedAt },
        ]),
      ),
      submittedGroups: record.groups
        .filter((group) => Boolean(group.submittedAt))
        .map((group) => group.key),
    }
  }

  /** The default state of a new question. */
  function defaultQuestionState() {
    return {
      answer: null,
      notes: "",
      defer: null,
      needsDiscussion: false,
      proposalDismissed: false,
      status: "open",
      changed: false,
      recordedAs: null,
    }
  }

  /** Build a new plan record from a validated payload. */
  function newPlanRecord(slug, plan, sessionID, at) {
    return {
      schemaVersion: DISCOVERY_SCHEMA_VERSION,
      slug,
      key: `${plan.kind}:${plan.artifact}`,
      kind: plan.kind,
      artifact: plan.artifact,
      title: plan.title,
      owner: { sessionID },
      orphaned: false,
      archived: false,
      unarchivedAt: null,
      revision: 1,
      createdAt: at,
      updatedAt: at,
      groups: plan.groups.map((group) => ({ ...group, submittedAt: null })),
      questions: plan.questions.map((question) => ({
        ...question,
        fingerprint: questionFingerprint(question),
        revisedAt: 1,
        state: defaultQuestionState(),
      })),
      submissions: [],
    }
  }

  /** Merge a validated payload into an existing plan record. */
  function mergePlanRecord(existing, plan, sessionID, takeover, at) {
    const revision = existing.revision + 1
    const warnings = []
    const oldByKey = new Map(existing.questions.map((question) => [question.key, question]))
    const incomingKeys = new Set(plan.questions.map((question) => question.key))
    const questions = []

    for (const [index, incoming] of plan.questions.entries()) {
      const old = oldByKey.get(incoming.key)
      if (!old) {
        questions.push({
          ...incoming,
          fingerprint: questionFingerprint(incoming),
          revisedAt: revision,
          state: defaultQuestionState(),
        })
        continue
      }
      if (old.type !== incoming.type) {
        return {
          ok: false,
          errors: [
            `questions[${index}].type: ${incoming.key} changes type; use a new key for a new decision`,
          ],
        }
      }
      const fingerprint = questionFingerprint(incoming)
      if (fingerprint === old.fingerprint) {
        questions.push({
          ...old,
          ...incoming,
          fingerprint: old.fingerprint,
          revisedAt: old.revisedAt,
          state: old.state,
        })
        continue
      }
      if (old.state.status === "open") {
        questions.push({
          ...incoming,
          fingerprint,
          revisedAt: revision,
          state: { ...old.state, changed: true },
        })
        continue
      }
      warnings.push(
        `${incoming.key} is ${old.state.status}; use a new key for a new decision`,
      )
      questions.push(old)
    }

    for (const question of existing.questions) {
      if (incomingKeys.has(question.key)) continue
      if (question.state.status === "open") {
        questions.push({ ...question, state: { ...question.state, status: "retired" } })
      } else {
        if (question.state.status === "submitted" || question.state.status === "recorded") {
          warnings.push(
            `${question.key} is ${question.state.status}; use a new key for a new decision`,
          )
        }
        questions.push(question)
      }
    }

    const oldGroups = new Map(existing.groups.map((group) => [group.key, group]))
    const ownerId = existing.owner?.sessionID ?? null
    const nextOwner =
      ownerId === null || existing.orphaned || takeover ? { sessionID } : existing.owner

    return {
      ok: true,
      warnings,
      plan: {
        ...existing,
        title: plan.title,
        owner: nextOwner,
        orphaned: false,
        archived: false,
        unarchivedAt: existing.archived ? at : existing.unarchivedAt ?? null,
        revision,
        updatedAt: at,
        groups: plan.groups.map((group) => ({
          ...group,
          submittedAt: oldGroups.get(group.key)?.submittedAt ?? null,
        })),
        questions,
      },
    }
  }

  /**
   * Release claims left behind by processes that no longer run.
   *
   * A claim is a hint that a wake is in flight; a dead claim must never hide
   * pending work. Refused files are left untouched, exactly like every other
   * reader.
   */
  function sweepDeadClaims() {
    for (const project of readProjectRecords()) {
      for (const summary of readPlanRecords(project.slug)) {
        try {
          const file = planFile(project.slug, summary.slug)
          const record = readJson(file)
          if (!record) continue
          let changed = false
          for (const submission of record.submissions) {
            if (submission.claimedBy && !isPidAlive(submission.claimedBy.pid)) {
              submission.claimedBy = null
              changed = true
            }
          }
          if (changed) {
            record.updatedAt = timestamp()
            writeJson(file, record)
          }
        } catch {
          // A refused plan stays unavailable; the sweep never rewrites it.
        }
      }
    }
  }

  sweepDeadClaims()

  return {
    /**
     * Register a checkout directory, or refresh its branch and repository.
     *
     * @param {{ directory: string, branch: string | null,
     *   repository: { id: string, canonical: string } }} input - Project identity.
     * @returns {Promise<object>} The project record.
     */
    async registerProject(input) {
      const directory = resolve(String(input.directory))
      let real = directory
      try {
        real = realpathSync(directory)
      } catch {
        // Registration may race a directory that no longer exists; keep the path.
      }
      const records = readProjectRecords()
      const repository = {
        id: String(input.repository?.id ?? real),
        canonical: String(input.repository?.canonical ?? real),
        name: basename(String(input.repository?.canonical ?? real)),
      }
      const existing = records.find((record) => record.directory === real)
      if (existing) {
        existing.branch = input.branch ?? null
        existing.repository = repository
        existing.updatedAt = timestamp()
        writeJson(projectFile(existing.slug), existing)
        return existing
      }
      const slug = uniqueProjectSlug(slugify(basename(real), PROJECT_SLUG_MAX), records)
      const record = {
        schemaVersion: DISCOVERY_SCHEMA_VERSION,
        slug,
        directory: real,
        name: basename(real),
        branch: input.branch ?? null,
        repository,
        createdAt: timestamp(),
        updatedAt: timestamp(),
      }
      writeJson(projectFile(slug), record)
      return record
    },

    /**
     * List every readable project with its aggregated question counts.
     *
     * @returns {Promise<object[]>} Project summaries.
     */
    async listProjects() {
      const summaries = []
      for (const project of readProjectRecords()) {
        const plans = readPlanRecords(project.slug)
        const counts = {
          plans: plans.length,
          open: 0,
          answered: 0,
          deferred: 0,
          discussion: 0,
          submitted: 0,
          recorded: 0,
        }
        for (const record of plans) {
          const state = stateOf(record)
          const plan = planCounts(record, state, evaluatePlan(record, state))
          for (const key of Object.keys(counts)) {
            if (key !== "plans") counts[key] += plan[key]
          }
        }
        summaries.push({ ...project, counts })
      }
      return summaries
    },

    /**
     * Read one project record.
     *
     * @param {string} projectSlug - The project slug.
     * @returns {Promise<object | null>} The record, or null when missing.
     */
    async getProject(projectSlug) {
      return readJson(projectFile(projectSlug))
    },

    /**
     * Find a project by its checkout directory.
     *
     * @param {string} directory - The checkout directory.
     * @returns {Promise<object | null>} The record, or null when missing.
     */
    async findProjectByDirectory(directory) {
      let real = resolve(String(directory))
      try {
        real = realpathSync(real)
      } catch {
        // Fall back to the resolved path.
      }
      return readProjectRecords().find((record) => record.directory === real) ?? null
    },

    /**
     * List the plans of a project.
     *
     * @param {string} projectSlug - The project slug.
     * @returns {Promise<object[]>} Plan summaries, archived plans included.
     */
    async listPlans(projectSlug) {
      return readPlanRecords(projectSlug).map((record) => {
        const state = stateOf(record)
        return {
          slug: record.slug,
          kind: record.kind,
          artifact: record.artifact,
          title: record.title,
          revision: record.revision,
          archived: record.archived,
          orphaned: record.orphaned,
          updatedAt: record.updatedAt,
          counts: planCounts(record, state, evaluatePlan(record, state)),
        }
      })
    },

    /**
     * Read one plan record.
     *
     * @param {string} projectSlug - The project slug.
     * @param {string} planSlug - The plan slug.
     * @returns {Promise<object | null>} The record, or null when missing.
     * @throws {DiscoveryDataError} When the file must be refused.
     */
    async getPlan(projectSlug, planSlug) {
      return readJson(planFile(projectSlug, planSlug))
    },

    /**
     * Find a plan by kind and artifact path.
     *
     * @param {string} projectSlug - The project slug.
     * @param {string} kind - The plan kind.
     * @param {string} artifact - The artifact path.
     * @returns {Promise<object | null>} The matching record, or null.
     */
    async findPlan(projectSlug, kind, artifact) {
      return (
        readPlanRecords(projectSlug, { skipRefused: false }).find(
          (record) => record.key === `${kind}:${artifact}`,
        ) ?? null
      )
    },

    /**
     * Publish a plan, or a new revision of it.
     *
     * @param {string} projectSlug - The project slug.
     * @param {unknown} payload - The publish payload.
     * @param {string} sessionID - The owning session.
     * @returns {Promise<object>} The publish result union.
     */
    async publish(projectSlug, payload, sessionID) {
      const project = readJson(projectFile(projectSlug))
      if (!project) {
        return { ok: false, reason: "invalid", errors: ["project not found"] }
      }
      const validated = validatePublish(payload)
      if (!validated.ok) return { ok: false, reason: "invalid", errors: validated.errors }
      const plan = validated.plan
      const takeover = isPlainObject(payload) && payload.takeover === true
      const key = `${plan.kind}:${plan.artifact}`

      // Publishing is serialized per project, not per target file: a new plan
      // chooses its slug by scanning its siblings, so two concurrent first
      // publishes of different keys could otherwise pick the same slug.
      const lock = join(projectDirectory(projectSlug), ".publish")
      return withFile(lock, () => {
        const records = readPlanRecords(projectSlug, { skipRefused: false })
        const existing = records.find((record) => record.key === key) ?? null
        const slug = existing
          ? existing.slug
          : uniquePlanSlug(planSlugBase(plan.artifact, plan.kind), records)
        const file = planFile(projectSlug, slug)
        const current = readJson(file)
        if (current && current.key !== key) {
          return {
            ok: false,
            reason: "invalid",
            errors: [`${key}: a different plan already owns the slug "${slug}"`],
          }
        }
        const ownerId = current?.owner?.sessionID ?? null
        if (current && ownerId !== null && !current.orphaned && ownerId !== sessionID && !takeover) {
          return { ok: false, reason: "owned", owner: ownerId }
        }
        const at = timestamp()
        if (!current) {
          const record = newPlanRecord(slug, plan, sessionID, at)
          writeJson(file, record)
          return { ok: true, plan: record, warnings: [] }
        }
        const merged = mergePlanRecord(current, plan, sessionID, takeover, at)
        if (!merged.ok) return { ok: false, reason: "invalid", errors: merged.errors }
        writeJson(file, merged.plan)
        return { ok: true, plan: merged.plan, warnings: merged.warnings }
      })
    },

    /**
     * Save one answer, deferral, notes, discussion marker, or proposal action.
     *
     * @param {string} projectSlug - The project slug.
     * @param {string} planSlug - The plan slug.
     * @param {string} key - The question key.
     * @param {object} patch - The answer patch.
     * @param {number} baseRevision - The revision the page rendered.
     * @returns {Promise<object>} The save result union.
     */
    async saveAnswer(projectSlug, planSlug, key, patch, baseRevision) {
      const file = planFile(projectSlug, planSlug)
      return withFile(file, () => {
        const record = readJson(file)
        if (!record) return { ok: false, reason: "not-found", message: "plan not found" }
        const question = record.questions.find((entry) => entry.key === key)
        if (!question) return { ok: false, reason: "not-found", message: "question not found" }
        if (question.state.status !== "open") {
          return { ok: false, reason: "read-only", message: "this question is read-only" }
        }
        const state = stateOf(record)
        if (evaluatePlan(record, state).lockedGroups.has(question.group)) {
          return { ok: false, reason: "locked", message: "submit the prerequisite group first" }
        }
        if (typeof baseRevision === "number" && baseRevision < question.revisedAt) {
          return { ok: false, reason: "stale", message: "this question changed — re-check it" }
        }
        if (!isPlainObject(patch)) {
          return { ok: false, reason: "invalid", message: "expected an answer patch" }
        }

        const next = { ...question.state }
        if (patch.reconfirm === true) {
          const check = next.answer === null ? { ok: true } : validateAnswer(question, next.answer)
          if (!check.ok) {
            next.answer = null
            next.changed = true
            question.state = next
            record.updatedAt = timestamp()
            writeJson(file, record)
            return { ok: false, reason: "invalid", message: check.error }
          }
          next.changed = false
        }
        if (patch.confirmProposal === true) {
          if (!question.proposal) {
            return { ok: false, reason: "invalid", message: "this question has no proposal" }
          }
          next.answer = toAnswer(question, question.proposal.answer)
          next.changed = false
        }
        if (patch.dismissProposal === true) next.proposalDismissed = true
        if ("answer" in patch) {
          if (patch.answer === null) {
            next.answer = null
          } else {
            const check = validateAnswer(question, patch.answer)
            if (!check.ok) return { ok: false, reason: "invalid", message: check.error }
            next.answer = patch.answer
          }
          next.changed = false
        }
        if ("defer" in patch) {
          if (patch.defer === null) {
            next.defer = null
          } else {
            const check = validateDefer(patch.defer)
            if (!check.ok) return { ok: false, reason: "invalid", message: check.error }
            next.defer = patch.defer
          }
        }
        if ("notes" in patch) {
          if (typeof patch.notes !== "string") {
            return { ok: false, reason: "invalid", message: "notes must be text" }
          }
          if (patch.notes.length > NOTES_MAX) {
            return { ok: false, reason: "invalid", message: "notes are too long" }
          }
          next.notes = patch.notes.trim()
        }
        if ("needsDiscussion" in patch) {
          next.needsDiscussion = patch.needsDiscussion === true
        }

        question.state = next
        record.updatedAt = timestamp()
        writeJson(file, record)
        return { ok: true, plan: record }
      })
    },

    /**
     * Submit one ready group, or every ready group.
     *
     * @param {string} projectSlug - The project slug.
     * @param {string} planSlug - The plan slug.
     * @param {string | null} group - One group key, or null for every ready group.
     * @param {number | null} baseRevision - The revision the page rendered, or null.
     * @returns {Promise<object>} The submit result union.
     */
    async submit(projectSlug, planSlug, group, baseRevision) {
      const file = planFile(projectSlug, planSlug)
      return withFile(file, () => {
        const record = readJson(file)
        if (!record) return { ok: false, reason: "not-found" }
        const state = stateOf(record)
        const evaluation = evaluatePlan(record, state)
        const keys = group === null ? record.groups.map((entry) => entry.key) : [group]
        const chosen = []
        const skipped = []
        for (const key of keys) {
          const readiness = groupReadiness(record, state, evaluation, key)
          if (group !== null && !readiness.ready) {
            return { ok: false, reason: "not-ready", missing: readiness.missing }
          }
          if (readiness.ready) chosen.push(key)
          else skipped.push({ group: key, missing: readiness.missing })
        }
        if (chosen.length === 0) return { ok: false, reason: "nothing-ready" }
        if (typeof baseRevision === "number") {
          const stale = record.questions.some(
            (question) =>
              chosen.includes(question.group) &&
              question.state.status === "open" &&
              question.revisedAt > baseRevision,
          )
          if (stale) return { ok: false, reason: "stale" }
        }

        const submitted = []
        for (const question of record.questions) {
          if (!chosen.includes(question.group)) continue
          if (question.state.status !== "open") continue
          const entry = evaluation.questions.get(question.key)
          if (entry?.visible !== true) continue
          if (entry.effective !== null) {
            question.state.status = "submitted"
            submitted.push({
              key: question.key,
              title: question.title,
              answer: entry.effective,
              source: entry.source ?? "user",
              impliedBy: entry.source === "implied" ? entry.impliedBy : [],
              overridesImplied: entry.overridesImplied,
              notes: question.state.notes ?? "",
              defer: question.state.defer ?? null,
              needsDiscussion: false,
            })
          } else if (question.state.defer && validateDefer(question.state.defer).ok) {
            question.state.status = "submitted"
            submitted.push({
              key: question.key,
              title: question.title,
              answer: null,
              source: null,
              impliedBy: [],
              overridesImplied: false,
              notes: question.state.notes ?? "",
              defer: question.state.defer,
              needsDiscussion: false,
            })
          }
        }

        const at = timestamp()
        for (const key of chosen) {
          const entry = record.groups.find((candidate) => candidate.key === key)
          if (entry && !entry.submittedAt) entry.submittedAt = at
        }
        const submission = {
          id: record.submissions.reduce((max, item) => Math.max(max, item.id), 0) + 1,
          at,
          groups: chosen,
          questions: submitted,
          claimedBy: null,
          deliveredAt: null,
          deliveredTo: null,
        }
        record.submissions.push(submission)
        record.updatedAt = at
        writeJson(file, record)
        return { ok: true, submission, skipped }
      })
    },

    /**
     * List submissions that are still waiting for a wake.
     *
     * A claim whose process is gone no longer counts as live, so the
     * submission is visible again.
     *
     * @param {string} projectSlug - The project slug.
     * @returns {Promise<Array<{ planSlug: string, submissions: object[] }>>} Pending work.
     */
    async pendingDeliveries(projectSlug) {
      const pending = []
      for (const record of readPlanRecords(projectSlug)) {
        const submissions = record.submissions.filter(
          (submission) =>
            submission.deliveredAt == null &&
            !(submission.claimedBy && isPidAlive(submission.claimedBy.pid)),
        )
        if (submissions.length > 0) pending.push({ planSlug: record.slug, submissions })
      }
      return pending
    },

    /**
     * Claim one submission for a wake. Returns false when another live claim
     * exists or the submission was already delivered.
     *
     * @param {string} projectSlug - The project slug.
     * @param {string} planSlug - The plan slug.
     * @param {number} submissionId - The submission id.
     * @param {string} sessionID - The claiming session.
     * @returns {Promise<boolean>} True when this call owns the claim.
     */
    async claimDelivery(projectSlug, planSlug, submissionId, sessionID) {
      const file = planFile(projectSlug, planSlug)
      return withFile(file, () => {
        const record = readJson(file)
        if (!record) return false
        const submission = record.submissions.find((item) => item.id === submissionId)
        if (!submission) return false
        if (submission.deliveredAt != null) return false
        if (submission.claimedBy && isPidAlive(submission.claimedBy.pid)) return false
        submission.claimedBy = { pid: process.pid, at: timestamp() }
        record.updatedAt = timestamp()
        writeJson(file, record)
        return true
      })
    },

    /**
     * Release a claim after a failed wake so the next delivery point retries.
     *
     * @param {string} projectSlug - The project slug.
     * @param {string} planSlug - The plan slug.
     * @param {number} submissionId - The submission id.
     * @returns {Promise<void>} Resolves when the file is written.
     */
    async releaseDelivery(projectSlug, planSlug, submissionId) {
      const file = planFile(projectSlug, planSlug)
      await withFile(file, () => {
        const record = readJson(file)
        if (!record) return
        const submission = record.submissions.find((item) => item.id === submissionId)
        if (!submission) return
        submission.claimedBy = null
        submission.deliveredAt = null
        submission.deliveredTo = null
        record.updatedAt = timestamp()
        writeJson(file, record)
      })
    },

    /**
     * Mark claimed submissions delivered after a wake prompt resolves.
     *
     * Only submissions without a `deliveredAt` are changed, so a duplicate
     * call is harmless. The claim is cleared at the same time.
     *
     * @param {string} projectSlug - The project slug.
     * @param {string} planSlug - The plan slug.
     * @param {number[]} submissionIds - The submissions the prompt covered.
     * @param {string} sessionID - The session that was prompted.
     * @returns {Promise<number>} How many submissions changed.
     */
    async markDelivered(projectSlug, planSlug, submissionIds, sessionID) {
      const file = planFile(projectSlug, planSlug)
      return withFile(file, () => {
        const record = readJson(file)
        if (!record) return 0
        const ids = new Set(Array.isArray(submissionIds) ? submissionIds : [])
        const at = timestamp()
        let count = 0
        for (const submission of record.submissions) {
          if (!ids.has(submission.id) || submission.deliveredAt != null) continue
          submission.deliveredAt = at
          submission.deliveredTo = sessionID
          submission.claimedBy = null
          count += 1
        }
        if (count > 0) {
          record.updatedAt = at
          writeJson(file, record)
        }
        return count
      })
    },

    /**
     * Read submitted answers, adopting the plan when it has no live owner.
     *
     * Every returned submission is marked delivered to the calling session.
     *
     * @param {string} projectSlug - The project slug.
     * @param {string} planSlug - The plan slug.
     * @param {string} sessionID - The calling session.
     * @returns {Promise<object>} The read result union.
     */
    async readAnswers(projectSlug, planSlug, sessionID) {
      const file = planFile(projectSlug, planSlug)
      return withFile(file, () => {
        const record = readJson(file)
        if (!record) return { ok: false, reason: "not-found" }
        const ownerId = record.owner?.sessionID ?? null
        if (ownerId !== null && !record.orphaned && ownerId !== sessionID) {
          return { ok: false, reason: "owned", owner: ownerId }
        }
        let changed = false
        if (ownerId === null || record.orphaned) {
          record.owner = { sessionID }
          record.orphaned = false
          changed = true
        }
        const statusByKey = new Map(
          record.questions.map((question) => [question.key, question.state.status]),
        )
        const submissions = record.submissions
          .map((submission) => ({
            ...submission,
            questions: submission.questions.filter(
              (entry) => statusByKey.get(entry.key) === "submitted",
            ),
          }))
          .filter((submission) => submission.questions.length > 0)
        const at = timestamp()
        for (const submission of submissions) {
          if (submission.deliveredAt == null) {
            submission.deliveredAt = at
            submission.deliveredTo = sessionID
            submission.claimedBy = null
            changed = true
          }
        }
        if (changed) {
          record.updatedAt = at
          writeJson(file, record)
        }
        return { ok: true, plan: record, submissions }
      })
    },

    /**
     * Record submitted questions as resolved, or retire questions.
     *
     * The whole call is validated before anything changes; one unknown or
     * non-submitted key refuses the batch.
     *
     * @param {string} projectSlug - The project slug.
     * @param {string} planSlug - The plan slug.
     * @param {string} sessionID - The calling session.
     * @param {{ recorded?: Array<{ key: string, as: string }>, retire?: string[] }} input -
     *   Resolution input.
     * @returns {Promise<object>} The resolve result union.
     */
    async resolve(projectSlug, planSlug, sessionID, input) {
      const file = planFile(projectSlug, planSlug)
      return withFile(file, () => {
        const record = readJson(file)
        if (!record) return { ok: false, reason: "not-found" }
        const ownerId = record.owner?.sessionID ?? null
        if (ownerId !== null && !record.orphaned && ownerId !== sessionID) {
          return { ok: false, reason: "owned", owner: ownerId }
        }
        if (ownerId === null || record.orphaned) {
          record.owner = { sessionID }
          record.orphaned = false
        }

        const recorded = Array.isArray(input?.recorded) ? input.recorded : []
        const retire = Array.isArray(input?.retire) ? input.retire : []
        const byKey = new Map(record.questions.map((question) => [question.key, question]))
        const errors = []
        for (const entry of recorded) {
          const question = byKey.get(entry?.key)
          if (!question) errors.push(`${entry?.key}: unknown question`)
          else if (question.state.status !== "submitted") {
            errors.push(`${entry.key}: only a submitted question can be recorded`)
          } else if (typeof entry.as !== "string" || entry.as.trim().length === 0) {
            errors.push(`${entry.key}: recordedAs is required`)
          }
        }
        for (const key of retire) {
          if (!byKey.has(key)) errors.push(`${key}: unknown question`)
        }
        if (errors.length > 0) return { ok: false, reason: "invalid", errors }

        let recordedCount = 0
        let retiredCount = 0
        for (const entry of recorded) {
          const question = byKey.get(entry.key)
          question.state.status = "recorded"
          question.state.recordedAs = entry.as.trim()
          recordedCount += 1
        }
        for (const key of retire) {
          const question = byKey.get(key)
          if (question.state.status === "recorded") continue
          question.state.status = "retired"
          retiredCount += 1
        }
        record.updatedAt = timestamp()
        writeJson(file, record)
        return { ok: true, recorded: recordedCount, retired: retiredCount }
      })
    },

    /**
     * Mark every plan owned by a session as orphaned so the next session adopts it.
     *
     * @param {string} projectSlug - The project slug.
     * @param {string} sessionID - The session that disappeared.
     * @returns {Promise<number>} How many plans became orphaned.
     */
    async markOrphaned(projectSlug, sessionID) {
      let count = 0
      for (const summary of readPlanRecords(projectSlug)) {
        const file = planFile(projectSlug, summary.slug)
        const changed = await withFile(file, () => {
          const record = readJson(file)
          if (!record || record.owner?.sessionID !== sessionID) return false
          record.orphaned = true
          record.updatedAt = timestamp()
          writeJson(file, record)
          return true
        })
        if (changed) count += 1
      }
      return count
    },

    /**
     * Archive or unarchive one plan.
     *
     * @param {string} projectSlug - The project slug.
     * @param {string} planSlug - The plan slug.
     * @param {boolean} archived - The new archive flag.
     * @returns {Promise<boolean>} False when the plan does not exist.
     */
    async setArchived(projectSlug, planSlug, archived) {
      const file = planFile(projectSlug, planSlug)
      return withFile(file, () => {
        const record = readJson(file)
        if (!record) return false
        record.archived = archived === true
        record.updatedAt = timestamp()
        writeJson(file, record)
        return true
      })
    },

    /**
     * Delete one plan file. Nothing is deleted automatically.
     *
     * @param {string} projectSlug - The project slug.
     * @param {string} planSlug - The plan slug.
     * @returns {Promise<boolean>} False when the plan does not exist.
     */
    async deletePlan(projectSlug, planSlug) {
      const file = planFile(projectSlug, planSlug)
      return withFile(file, () => {
        if (!existsSync(file)) return false
        unlinkSync(file)
        return true
      })
    },
  }
}
