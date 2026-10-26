/**
 * Implementation tests for the Discovery store.
 *
 * These cases cover internal edges that the specification tests do not pin:
 * slug truncation, summary aggregation, dead claims, notes handling, and the
 * small result unions. They may change with the implementation; the
 * specification tests may not.
 *
 * @module discovery-store.impl.test
 */

import assert from "node:assert/strict"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"

import { createDiscoveryStore } from "./lib/discovery-store.mjs"

/** Throwaway roots created by the tests, removed afterward. */
const created = []

/** Base directory for temporary roots. */
const BASE = process.env.CODEOPS_TMPDIR ?? tmpdir()

after(() => {
  for (const directory of created) rmSync(directory, { recursive: true, force: true })
})

/** Creates a throwaway directory. */
function scratch(prefix) {
  const directory = mkdtempSync(join(BASE, `discovery-impl-${prefix}-`))
  created.push(directory)
  return directory
}

/** Creates a store over a fresh data directory and returns both. */
function newStore() {
  const root = scratch("store")
  const dataDir = join(root, "discovery")
  return { store: createDiscoveryStore({ dataDir }), dataDir }
}

/** Registers a fresh project. */
async function register(store) {
  const directory = scratch("project")
  return store.registerProject({
    directory,
    branch: null,
    repository: { id: `repo-${directory}`, canonical: directory },
  })
}

/** Builds a single-choice question. */
function single(key, group = "A") {
  return {
    key,
    group,
    type: "single",
    title: `${key} title`,
    options: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
  }
}

/** Builds a publish payload. */
function payload(questions, extra = {}) {
  return {
    artifact: "plans/billing",
    kind: "plan",
    title: "Billing",
    groups: [{ key: "A", title: "A" }],
    questions,
    ...extra,
  }
}

/** Publishes and asserts success. */
async function published(store, project, input = payload([single("q1")])) {
  const result = await store.publish(project.slug, input, "s1")
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result))
  return result.plan
}

/** Stored question lookup. */
function questionOf(record, key) {
  return record.questions.find((question) => question.key === key)
}

describe("slug edges", () => {
  it("should truncate a long directory name and keep a fallback slug", async () => {
    const { store } = newStore()
    const root = scratch("long")
    const longName = "a".repeat(80)
    const longDirectory = join(root, longName)
    const punctuation = join(root, "!!!")
    mkdirSync(longDirectory)
    mkdirSync(punctuation)

    const long = await store.registerProject({
      directory: longDirectory,
      branch: null,
      repository: { id: "long", canonical: longDirectory },
    })
    const fallback = await store.registerProject({
      directory: punctuation,
      branch: null,
      repository: { id: "punctuation", canonical: punctuation },
    })

    assert.equal(long.slug.length, 40)
    assert.equal(fallback.slug, "project")
  })

  it("should truncate the plan slug and add collision numbers", async () => {
    const { store } = newStore()
    const project = await register(store)
    const longArtifact = `plans/${"b".repeat(80)}`
    const first = await published(store, project, payload([single("q1")], { artifact: longArtifact }))
    const second = await published(store, project, payload([single("q1")], { artifact: `x/${"b".repeat(80)}` }))

    assert.ok(first.slug.length <= 52)
    assert.equal(second.slug, `${first.slug}-2`)
  })
})

describe("summaries", () => {
  it("should aggregate project counts and list plan summaries", async () => {
    const { store } = newStore()
    const project = await register(store)
    const record = await published(store, project, payload([single("q1"), single("q2")]))
    await store.saveAnswer(project.slug, record.slug, "q1", { answer: { choice: "a" } }, 1)

    const projects = await store.listProjects()
    const summary = projects.find((entry) => entry.slug === project.slug)
    assert.equal(summary.counts.plans, 1)
    assert.equal(summary.counts.answered, 1)
    assert.equal(summary.counts.open, 1)

    const plans = await store.listPlans(project.slug)
    assert.equal(plans.length, 1)
    assert.equal(plans[0].slug, record.slug)
    assert.equal(plans[0].counts.answered, 1)
  })

  it("should skip a malformed plan file in list views", async () => {
    const { store, dataDir } = newStore()
    const project = await register(store)
    const record = await published(store, project)
    writeFileSync(join(dataDir, "projects", project.slug, "plans", "broken.json"), "{bad", {
      mode: 0o600,
    })

    const plans = await store.listPlans(project.slug)
    assert.deepEqual(
      plans.map((plan) => plan.slug),
      [record.slug],
    )
  })

  it("should find a project by directory and a plan by kind and artifact", async () => {
    const { store } = newStore()
    const project = await register(store)
    const record = await published(store, project)

    const foundProject = await store.findProjectByDirectory(project.directory)
    assert.equal(foundProject.slug, project.slug)
    const foundPlan = await store.findPlan(project.slug, "plan", "plans/billing")
    assert.equal(foundPlan.slug, record.slug)
    assert.equal(await store.findPlan(project.slug, "plan", "plans/other"), null)
  })
})

describe("publish result unions", () => {
  it("should refuse an unknown project and an invalid payload", async () => {
    const { store } = newStore()
    const unknown = await store.publish("missing", payload([single("q1")]), "s1")
    assert.equal(unknown.ok, false)
    if (!unknown.ok) assert.equal(unknown.reason, "invalid")

    const project = await register(store)
    const invalid = await store.publish(project.slug, { artifact: "" }, "s1")
    assert.equal(invalid.ok, false)
    if (!invalid.ok) {
      assert.equal(invalid.reason, "invalid")
      assert.ok(invalid.errors.length > 0)
    }
  })
})

describe("concurrent publishing", () => {
  it("should assign distinct slugs when two first publishes race", async () => {
    const { store } = newStore()
    const project = await register(store)
    const [one, two] = await Promise.all([
      store.publish(project.slug, payload([single("q1")], { artifact: "plans/collide" }), "s1"),
      store.publish(project.slug, payload([single("q2")], { artifact: "collide" }), "s1"),
    ])
    assert.equal(one.ok, true)
    assert.equal(two.ok, true)
    if (!one.ok || !two.ok) return
    assert.deepEqual([one.plan.slug, two.plan.slug].sort(), ["collide", "collide-2"])

    const first = await store.findPlan(project.slug, "plan", "plans/collide")
    const second = await store.findPlan(project.slug, "plan", "collide")
    assert.equal(first.slug, "collide")
    assert.equal(second.slug, "collide-2")
    assert.ok(questionOf(first, "q1"))
    assert.ok(questionOf(second, "q2"))
  })
})

describe("notes and deferrals", () => {
  it("should trim notes, reject long notes, and clear a deferral with null", async () => {
    const { store } = newStore()
    const project = await register(store)
    const record = await published(store, project)

    const saved = await store.saveAnswer(project.slug, record.slug, "q1", { notes: "  hello  " }, 1)
    assert.equal(saved.ok, true)
    if (saved.ok) assert.equal(questionOf(saved.plan, "q1").state.notes, "hello")

    const long = await store.saveAnswer(
      project.slug,
      record.slug,
      "q1",
      { notes: "x".repeat(4001) },
      1,
    )
    assert.equal(long.ok, false)

    const deferred = await store.saveAnswer(
      project.slug,
      record.slug,
      "q1",
      { defer: { decision: "later", owner: "me", revisit: "soon" } },
      1,
    )
    assert.equal(deferred.ok, true)
    const cleared = await store.saveAnswer(project.slug, record.slug, "q1", { defer: null }, 1)
    assert.equal(cleared.ok, true)
    if (cleared.ok) assert.equal(questionOf(cleared.plan, "q1").state.defer, null)
  })
})

describe("delivery edges", () => {
  it("should treat a dead claim as free and reclaim it", async () => {
    const { store, dataDir } = newStore()
    const project = await register(store)
    const record = await published(store, project)
    await store.saveAnswer(project.slug, record.slug, "q1", { answer: { choice: "a" } }, 1)
    await store.submit(project.slug, record.slug, "A", 1)

    const file = join(dataDir, "projects", project.slug, "plans", `${record.slug}.json`)
    const stored = JSON.parse(readFileSync(file, "utf8"))
    stored.submissions[0].claimedBy = { pid: 2147483646, at: new Date().toISOString() }
    writeFileSync(file, JSON.stringify(stored), { mode: 0o600 })

    const reopened = createDiscoveryStore({ dataDir })
    const swept = await reopened.getPlan(project.slug, record.slug)
    assert.equal(swept.submissions[0].claimedBy, null)

    const pending = await reopened.pendingDeliveries(project.slug)
    assert.equal(pending.length, 1)
    assert.equal(await reopened.claimDelivery(project.slug, record.slug, 1, "s1"), true)
  })

  it("should stop returning a submission once all its questions are resolved", async () => {
    const { store } = newStore()
    const project = await register(store)
    const record = await published(store, project)
    await store.saveAnswer(project.slug, record.slug, "q1", { answer: { choice: "a" } }, 1)
    await store.submit(project.slug, record.slug, "A", 1)
    await store.resolve(project.slug, record.slug, "s1", {
      recorded: [{ key: "q1", as: "AR-1" }],
    })

    const read = await store.readAnswers(project.slug, record.slug, "s1")
    assert.equal(read.ok, true)
    if (read.ok) assert.deepEqual(read.submissions, [])
  })
})

describe("delivery marking", () => {
  it("should mark claimed submissions delivered after a wake and ignore duplicates", async () => {
    const { store } = newStore()
    const project = await register(store)
    const record = await published(store, project)
    await store.saveAnswer(project.slug, record.slug, "q1", { answer: { choice: "a" } }, 1)
    await store.submit(project.slug, record.slug, "A", 1)

    assert.equal(await store.claimDelivery(project.slug, record.slug, 1, "s1"), true)
    assert.equal(await store.markDelivered(project.slug, record.slug, [1], "s1"), 1)
    assert.deepEqual(await store.pendingDeliveries(project.slug), [])

    const current = await store.getPlan(project.slug, record.slug)
    assert.equal(current.submissions[0].deliveredTo, "s1")
    assert.equal(current.submissions[0].claimedBy, null)
    assert.equal(await store.markDelivered(project.slug, record.slug, [1], "s1"), 0)
  })
})

describe("write failures", () => {
  it("should remove a temporary file when the rename cannot complete", async () => {
    if (process.platform === "win32") return

    const { store, dataDir } = newStore()
    const root = scratch("blocked")
    const blocked = join(root, "blocked")
    mkdirSync(blocked)
    mkdirSync(join(dataDir, "projects", "blocked", "project.json"), { recursive: true })

    await assert.rejects(
      store.registerProject({
        directory: blocked,
        branch: null,
        repository: { id: "blocked", canonical: blocked },
      }),
    )
    const files = readdirSync(join(dataDir, "projects", "blocked"))
    assert.deepEqual(files.filter((name) => name.endsWith(".tmp")), [])
  })
})

describe("orphaning and deletion edges", () => {
  it("should orphan only plans owned by the named session", async () => {
    const { store } = newStore()
    const project = await register(store)
    const record = await published(store, project)

    assert.equal(await store.markOrphaned(project.slug, "someone-else"), 0)
    assert.equal(await store.markOrphaned(project.slug, "s1"), 1)
    const current = await store.getPlan(project.slug, record.slug)
    assert.equal(current.orphaned, true)
  })

  it("should return false for missing plans and leave no temporary files", async () => {
    const { store, dataDir } = newStore()
    const project = await register(store)
    const record = await published(store, project)
    await store.saveAnswer(project.slug, record.slug, "q1", { answer: { choice: "a" } }, 1)

    assert.equal(await store.setArchived(project.slug, "missing", true), false)
    assert.equal(await store.deletePlan(project.slug, "missing"), false)

    const files = readdirSync(join(dataDir, "projects", project.slug, "plans"))
    assert.deepEqual(files.filter((name) => name.endsWith(".tmp")), [])
  })

  it("should retire a submitted question when asked", async () => {
    const { store } = newStore()
    const project = await register(store)
    const record = await published(store, project)
    await store.saveAnswer(project.slug, record.slug, "q1", { answer: { choice: "a" } }, 1)
    await store.submit(project.slug, record.slug, "A", 1)

    const result = await store.resolve(project.slug, record.slug, "s1", { retire: ["q1"] })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.retired, 1)
    const current = await store.getPlan(project.slug, record.slug)
    assert.equal(questionOf(current, "q1").state.status, "retired")
  })
})
