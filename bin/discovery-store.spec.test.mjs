/**
 * Specification tests for the Discovery store.
 *
 * These cases pin the observable behaviour of project registration, plan
 * publishing and republishing, answer saving, submission, delivery claiming,
 * ownership, refusal, and deletion. They are written from the contract
 * documents only, so a failure here means the implementation does not satisfy
 * the specification — never that the test is wrong.
 *
 * Every case uses a throwaway data directory under the session temp root and
 * removes it afterward.
 *
 * @module discovery-store.spec.test
 */

import assert from "node:assert/strict"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"

import {
  DiscoveryDataError,
  createDiscoveryStore,
  resolveDataDir,
} from "./lib/discovery-store.mjs"

/** Throwaway roots created by the tests, removed afterward. */
const created = []

/** Base directory for temporary roots. */
const BASE = process.env.CODEOPS_TMPDIR ?? tmpdir()

/** Stable clock so timestamps never make a case flaky. */
const clock = () => new Date("2026-01-01T00:00:00.000Z")

after(() => {
  for (const directory of created) rmSync(directory, { recursive: true, force: true })
})

/** Creates a throwaway directory under the temp root. */
function scratch(prefix) {
  const directory = mkdtempSync(join(BASE, `discovery-${prefix}-`))
  created.push(directory)
  return directory
}

/** Creates a store over a fresh data directory. */
function newStore() {
  const root = scratch("store")
  return createDiscoveryStore({ dataDir: join(root, "discovery"), now: clock })
}

/** Registers a fresh project directory and returns the record. */
async function register(store, name = "project") {
  const directory = scratch(name)
  return store.registerProject({
    directory,
    branch: null,
    repository: { id: `repo-${name}`, canonical: directory },
  })
}

/** Builds one option. */
function option(id, extra = {}) {
  return { id, label: id.toUpperCase(), ...extra }
}

/** Builds a single-choice question. */
function single(key, group, options = ["a", "b"], extra = {}) {
  return {
    key,
    group,
    type: "single",
    title: `${key} title`,
    options: options.map((id) => option(id)),
    ...extra,
  }
}

/** Builds a free-text question. */
function text(key, group, extra = {}) {
  return { key, group, type: "text", title: `${key} title`, ...extra }
}

/** Builds a publish payload. */
function payload(questions, extra = {}) {
  return {
    artifact: "plans/billing",
    kind: "plan",
    title: "Billing plan",
    groups: [{ key: "A", title: "A" }],
    questions,
    ...extra,
  }
}

/** Publishes and asserts success, returning the plan record. */
async function published(store, project, input, sessionID = "s1") {
  const result = await store.publish(project.slug, input, sessionID)
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result))
  return result.plan
}

/** Publishes an answer and asserts success. */
async function answer(store, project, plan, key, value, baseRevision = plan.revision) {
  const result = await store.saveAnswer(
    project.slug,
    plan.slug,
    key,
    { answer: value },
    baseRevision,
  )
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result))
  return result.plan
}

/** Returns the stored question by key. */
function questionOf(record, key) {
  return record.questions.find((question) => question.key === key)
}

/** Reads a plan file as text. */
function planFile(dataDir, projectSlug, planSlug) {
  return join(dataDir, "projects", projectSlug, "plans", `${planSlug}.json`)
}

// ---------------------------------------------------------------------------
// Data directory
// ---------------------------------------------------------------------------

describe("data directory resolution", () => {
  it("should resolve from the environment, the home fallback, and a tilde path", () => {
    assert.equal(resolveDataDir({ CODEOPS_DATA_DIR: "/tmp/x" }, "/h"), join("/tmp/x", "discovery"))
    assert.equal(
      resolveDataDir({}, "/h"),
      join("/h", ".local/share/opencode/codeops", "discovery"),
    )
    assert.equal(
      resolveDataDir({ CODEOPS_DATA_DIR: "~/d" }, "/h"),
      join("/h", "d", "discovery"),
    )
  })
})

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

describe("permissions", () => {
  it("should create owner-only directories and files and tighten an existing directory", async () => {
    const root = scratch("permissions")
    const dataDir = join(root, "discovery")
    mkdirSync(dataDir, { recursive: true, mode: 0o755 })
    if (process.platform !== "win32") chmodSync(dataDir, 0o755)

    const store = createDiscoveryStore({ dataDir, now: clock })
    const project = await register(store, "permissions")
    const projectDir = join(dataDir, "projects", project.slug)

    if (process.platform !== "win32") {
      assert.equal(statSync(dataDir).mode & 0o777, 0o700)
      assert.equal(statSync(projectDir).mode & 0o777, 0o700)
      assert.equal(statSync(join(projectDir, "project.json")).mode & 0o777, 0o600)
    }
  })
})

// ---------------------------------------------------------------------------
// Project identity
// ---------------------------------------------------------------------------

describe("project identity", () => {
  it("should slug collisions, update an existing directory, and fall back to project", async () => {
    const root = scratch("slugs")
    mkdirSync(join(root, "w"))
    mkdirSync(join(root, "v"))
    const first = join(root, "w", "My Repo")
    const second = join(root, "v", "my-repo")
    const punctuation = join(root, "w", "___")
    mkdirSync(first)
    mkdirSync(second)
    mkdirSync(punctuation)

    const store = newStore()
    const one = await store.registerProject({
      directory: first,
      branch: null,
      repository: { id: "r1", canonical: first },
    })
    const two = await store.registerProject({
      directory: second,
      branch: null,
      repository: { id: "r2", canonical: second },
    })
    const again = await store.registerProject({
      directory: first,
      branch: "feat/x",
      repository: { id: "r1", canonical: first },
    })
    const fallback = await store.registerProject({
      directory: punctuation,
      branch: null,
      repository: { id: "r3", canonical: punctuation },
    })

    assert.equal(one.slug, "my-repo")
    assert.equal(two.slug, "my-repo-2")
    assert.equal(again.slug, "my-repo")
    assert.equal(again.branch, "feat/x")
    assert.equal(fallback.slug, "project")
  })
})

// ---------------------------------------------------------------------------
// Plan identity and ownership
// ---------------------------------------------------------------------------

describe("plan identity", () => {
  it("should derive slugs from the artifact and kind and resolve collisions", async () => {
    const store = newStore()
    const project = await register(store)

    const billing = await published(store, project, payload([text("Q1", "A")]))
    const preflight = await published(
      store,
      project,
      payload([text("Q1", "A")], { artifact: "plans/billing", kind: "preflight" }),
    )
    const requirements = await published(
      store,
      project,
      payload([text("Q1", "A")], { artifact: "requirements", kind: "requirements" }),
    )
    const other = await published(
      store,
      project,
      payload([text("Q1", "A")], { artifact: "x/billing" }),
    )

    assert.equal(billing.slug, "billing")
    assert.equal(preflight.slug, "billing-preflight")
    assert.equal(requirements.slug, "requirements")
    assert.equal(other.slug, "billing-2")
  })
})

describe("ownership", () => {
  it("should enforce the owner, honor takeover, and adopt an orphaned plan", async () => {
    const store = newStore()
    const project = await register(store)
    const input = payload([text("Q1", "A")])

    const first = await published(store, project, input, "s1")
    assert.equal(first.owner.sessionID, "s1")

    const blocked = await store.publish(project.slug, input, "s2")
    assert.equal(blocked.ok, false)
    if (!blocked.ok) {
      assert.equal(blocked.reason, "owned")
      assert.equal(blocked.owner, "s1")
    }

    const taken = await store.publish(project.slug, { ...input, takeover: true }, "s2")
    assert.equal(taken.ok, true)
    if (taken.ok) assert.equal(taken.plan.owner.sessionID, "s2")

    const orphaned = await store.markOrphaned(project.slug, "s2")
    assert.equal(orphaned, 1)

    const adopted = await published(store, project, input, "s3")
    assert.equal(adopted.owner.sessionID, "s3")
    assert.equal(adopted.orphaned, false)
  })
})

// ---------------------------------------------------------------------------
// Republish merge
// ---------------------------------------------------------------------------

describe("republish merge", () => {
  function revisionOne() {
    return payload(
      [
        single("DQ-1", "A"),
        single("DQ-2", "A"),
        text("DQ-3", "A"),
        single("DQ-4", "R"),
        single("DQ-6", "S"),
        single("DQ-8", "A"),
      ],
      {
        groups: [
          { key: "R", title: "Recorded" },
          { key: "S", title: "Submitted" },
          { key: "A", title: "Answers" },
        ],
      },
    )
  }

  function revisionTwo() {
    return payload(
      [
        single("DQ-1", "A"),
        single("DQ-2", "A", ["a", "b"], { title: "DQ-2 changed" }),
        single("DQ-4", "R", ["a", "b"], { title: "DQ-4 changed" }),
        text("DQ-5", "A"),
        text("DQ-7", "A"),
        single("DQ-8", "A"),
      ],
      {
        groups: [
          { key: "R", title: "Recorded" },
          { key: "S", title: "Submitted" },
          { key: "A", title: "Answers" },
        ],
      },
    )
  }

  it("should keep submitted questions, retire omitted ones, and refuse a type change", async () => {
    const store = newStore()
    const project = await register(store)
    const record = await published(store, project, revisionOne(), "s1")

    await answer(store, project, record, "DQ-1", { choice: "a" })
    await answer(store, project, record, "DQ-2", { choice: "a" })
    await answer(store, project, record, "DQ-8", { choice: "a" })
    await answer(store, project, record, "DQ-4", { choice: "a" })
    const submittedRecorded = await store.submit(project.slug, record.slug, "R", 1)
    assert.equal(submittedRecorded.ok, true)
    const recordedResult = await store.resolve(project.slug, record.slug, "s1", {
      recorded: [{ key: "DQ-4", as: "AR-7" }],
    })
    assert.equal(recordedResult.ok, true)

    await answer(store, project, record, "DQ-6", { choice: "a" })
    const submitted = await store.submit(project.slug, record.slug, "S", 1)
    assert.equal(submitted.ok, true)

    const republished = await store.publish(project.slug, revisionTwo(), "s1")
    assert.equal(republished.ok, true)
    if (!republished.ok) return
    assert.equal(republished.plan.revision, 2)
    assert.ok(republished.warnings.some((warning) => warning.includes("DQ-4")))
    assert.ok(republished.warnings.some((warning) => warning.includes("DQ-6")))

    const current = republished.plan
    assert.equal(questionOf(current, "DQ-1").state.answer.choice, "a")
    assert.equal(questionOf(current, "DQ-1").state.changed, false)
    assert.equal(questionOf(current, "DQ-2").state.answer.choice, "a")
    assert.equal(questionOf(current, "DQ-2").state.changed, true)
    assert.equal(questionOf(current, "DQ-2").revisedAt, 2)
    assert.equal(questionOf(current, "DQ-3").state.status, "retired")
    assert.equal(questionOf(current, "DQ-4").state.status, "recorded")
    assert.equal(questionOf(current, "DQ-5").state.status, "open")
    assert.equal(questionOf(current, "DQ-5").revisedAt, 2)
    assert.equal(questionOf(current, "DQ-6").state.status, "submitted")
    assert.equal(questionOf(current, "DQ-7").state.status, "open")

    const saved = await store.saveAnswer(
      project.slug,
      current.slug,
      "DQ-8",
      { answer: { choice: "b" } },
      2,
    )
    assert.equal(saved.ok, true)
    const afterSave = await store.getPlan(project.slug, current.slug)
    assert.equal(afterSave.revision, 2)

    const typed = revisionTwo()
    typed.questions = typed.questions.map((question) =>
      question.key === "DQ-7"
        ? { ...question, type: "single", options: [option("a"), option("b")], title: "DQ-7 title" }
        : question,
    )
    const refused = await store.publish(project.slug, typed, "s1")
    assert.equal(refused.ok, false)
    if (!refused.ok) {
      assert.equal(refused.reason, "invalid")
      assert.ok(refused.errors.some((error) => error.includes("DQ-7") && error.includes("type")))
    }
    const afterRefusal = await store.getPlan(project.slug, current.slug)
    assert.equal(afterRefusal.revision, 2)
  })
})

// ---------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------

describe("archive", () => {
  it("should archive and unarchive on the next publish", async () => {
    const store = newStore()
    const project = await register(store)
    const record = await published(store, project, payload([text("Q1", "A")]))

    assert.equal(await store.setArchived(project.slug, record.slug, true), true)
    let archived = await store.getPlan(project.slug, record.slug)
    assert.equal(archived.archived, true)

    const republished = await published(store, project, payload([text("Q1", "A")]))
    assert.equal(republished.archived, false)
    assert.ok(republished.unarchivedAt)
  })
})

// ---------------------------------------------------------------------------
// Saving answers
// ---------------------------------------------------------------------------

describe("saving answers", () => {
  it("should validate, block locked or read-only questions, and require the right revision", async () => {
    const store = newStore()
    const project = await register(store)
    const input = payload(
      [
        single("DQ-1", "A"),
        single("DQ-2", "A"),
        single("DQ-3", "B", ["a", "b"], {
          proposal: { answer: "a", reason: "the agent infers this" },
        }),
      ],
      {
        groups: [
          { key: "A", title: "A" },
          { key: "B", title: "B", dependsOn: ["A"] },
        ],
      },
    )
    let record = await published(store, project, input)
    record = await answer(store, project, record, "DQ-1", { choice: "a" })
    record = await answer(store, project, record, "DQ-2", { choice: "a" })

    const valid = await store.saveAnswer(project.slug, record.slug, "DQ-1", { answer: { choice: "b" } }, 1)
    assert.equal(valid.ok, true)

    const invalid = await store.saveAnswer(project.slug, record.slug, "DQ-1", { answer: { choice: "zz" } }, 1)
    assert.equal(invalid.ok, false)
    if (!invalid.ok) assert.equal(invalid.reason, "invalid")

    const locked = await store.saveAnswer(project.slug, record.slug, "DQ-3", { answer: { choice: "a" } }, 1)
    assert.equal(locked.ok, false)
    if (!locked.ok) assert.equal(locked.reason, "locked")

    const changed = await published(
      store,
      project,
      payload(
        [
          single("DQ-1", "A"),
          single("DQ-2", "A", ["a", "b"], { title: "DQ-2 changed" }),
          single("DQ-3", "B", ["a", "b"], {
            proposal: { answer: "a", reason: "the agent infers this" },
          }),
        ],
        {
          groups: [
            { key: "A", title: "A" },
            { key: "B", title: "B", dependsOn: ["A"] },
          ],
        },
      ),
    )
    assert.equal(changed.revision, 2)

    const stale = await store.saveAnswer(project.slug, changed.slug, "DQ-2", { answer: { choice: "a" } }, 1)
    assert.equal(stale.ok, false)
    if (!stale.ok) assert.equal(stale.reason, "stale")

    const fresh = await store.saveAnswer(project.slug, changed.slug, "DQ-1", { answer: { choice: "a" } }, 1)
    assert.equal(fresh.ok, true)

    const reconfirmed = await store.saveAnswer(
      project.slug,
      changed.slug,
      "DQ-2",
      { reconfirm: true },
      2,
    )
    assert.equal(reconfirmed.ok, true)
    if (reconfirmed.ok) assert.equal(questionOf(reconfirmed.plan, "DQ-2").state.changed, false)

    await store.saveAnswer(project.slug, changed.slug, "DQ-1", { answer: { choice: "a" } }, 2)
    const second = await store.saveAnswer(project.slug, changed.slug, "DQ-1", { answer: { choice: "b" } }, 2)
    assert.equal(second.ok, true)
    if (second.ok) assert.equal(questionOf(second.plan, "DQ-1").state.answer.choice, "b")

    const submitted = await store.submit(project.slug, changed.slug, "A", 2)
    assert.equal(submitted.ok, true)

    const readOnly = await store.saveAnswer(project.slug, changed.slug, "DQ-1", { answer: { choice: "a" } }, 2)
    assert.equal(readOnly.ok, false)
    if (!readOnly.ok) assert.equal(readOnly.reason, "read-only")

    const confirmed = await store.saveAnswer(
      project.slug,
      changed.slug,
      "DQ-3",
      { confirmProposal: true },
      2,
    )
    assert.equal(confirmed.ok, true)
    if (confirmed.ok) assert.equal(questionOf(confirmed.plan, "DQ-3").state.answer.choice, "a")

    const submittedB = await store.submit(project.slug, changed.slug, "B", 2)
    assert.equal(submittedB.ok, true)
    await store.resolve(project.slug, changed.slug, "s1", {
      recorded: [{ key: "DQ-3", as: "AR-9" }],
    })
    const recordedReadOnly = await store.saveAnswer(
      project.slug,
      changed.slug,
      "DQ-3",
      { answer: { choice: "b" } },
      2,
    )
    assert.equal(recordedReadOnly.ok, false)
    if (!recordedReadOnly.ok) assert.equal(recordedReadOnly.reason, "read-only")
  })

  it("should clear an answer that no longer validates on re-confirm", async () => {
    const store = newStore()
    const project = await register(store)
    const first = await published(store, project, payload([single("DQ-1", "A", ["a", "b"])]))
    await answer(store, project, first, "DQ-1", { choice: "a" })

    const second = await published(
      store,
      project,
      payload([single("DQ-1", "A", ["b", "c"], { title: "DQ-1 changed" })]),
    )
    assert.equal(second.revision, 2)
    assert.equal(questionOf(second, "DQ-1").state.changed, true)

    const result = await store.saveAnswer(project.slug, second.slug, "DQ-1", { reconfirm: true }, 2)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, "invalid")
    const current = await store.getPlan(project.slug, second.slug)
    assert.equal(questionOf(current, "DQ-1").state.answer, null)
  })
})

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

describe("submission", () => {
  it("should submit a ready group with explicit and implied answers and leave discussion open", async () => {
    const store = newStore()
    const project = await register(store)
    const input = payload(
      [
        single("q1", "A", ["a", "b"], {
          options: [
            option("a", {
              implies: [{ question: "q2", answer: "yes", reason: "bundle" }],
            }),
            option("b"),
          ],
        }),
        text("q2", "A"),
        text("q3", "A"),
        text("q4", "B"),
      ],
      {
        groups: [
          { key: "A", title: "A" },
          { key: "B", title: "B" },
        ],
      },
    )
    let record = await published(store, project, input)
    record = await answer(store, project, record, "q1", { choice: "a" })
    const discussed = await store.saveAnswer(
      project.slug,
      record.slug,
      "q3",
      { needsDiscussion: true },
      1,
    )
    assert.equal(discussed.ok, true)

    const result = await store.submit(project.slug, record.slug, "A", 1)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.submission.id, 1)
    assert.equal(result.submission.deliveredAt, null)
    assert.deepEqual(result.submission.groups, ["A"])

    const current = await store.getPlan(project.slug, record.slug)
    assert.equal(questionOf(current, "q1").state.status, "submitted")
    assert.equal(questionOf(current, "q2").state.status, "submitted")
    assert.equal(questionOf(current, "q3").state.status, "open")
    const implied = result.submission.questions.find((entry) => entry.key === "q2")
    assert.equal(implied.source, "implied")
    assert.deepEqual(implied.impliedBy, ["q1"])
    assert.ok(current.groups.find((group) => group.key === "A").submittedAt)

    const notReady = await store.submit(project.slug, record.slug, "B", 1)
    assert.equal(notReady.ok, false)
    if (!notReady.ok) {
      assert.equal(notReady.reason, "not-ready")
      assert.ok(notReady.missing.length > 0)
    }
  })

  it("should submit every ready group and report the skipped ones", async () => {
    const store = newStore()
    const project = await register(store)
    const input = payload(
      [single("q1", "A"), single("q2", "B"), single("q3", "C")],
      {
        groups: [
          { key: "A", title: "A" },
          { key: "B", title: "B" },
          { key: "C", title: "C" },
        ],
      },
    )
    let record = await published(store, project, input)
    record = await answer(store, project, record, "q1", { choice: "a" })
    record = await answer(store, project, record, "q3", { choice: "a" })

    const result = await store.submit(project.slug, record.slug, null, 1)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.submission.groups, ["A", "C"])
    assert.deepEqual(
      result.skipped.map((entry) => entry.group),
      ["B"],
    )

    const again = await store.submit(project.slug, record.slug, null, 1)
    assert.equal(again.ok, false)
    if (!again.ok) assert.equal(again.reason, "nothing-ready")
  })
})

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

describe("delivery", () => {
  it("should list, claim, hide, and release pending submissions", async () => {
    const store = newStore()
    const project = await register(store)
    let record = await published(store, project, payload([single("q1", "A")]))
    record = await answer(store, project, record, "q1", { choice: "a" })
    await store.submit(project.slug, record.slug, "A", 1)

    let pending = await store.pendingDeliveries(project.slug)
    assert.equal(pending.length, 1)
    assert.equal(pending[0].submissions[0].id, 1)

    assert.equal(await store.claimDelivery(project.slug, record.slug, 1, "s1"), true)
    assert.equal(await store.claimDelivery(project.slug, record.slug, 1, "s1"), false)
    pending = await store.pendingDeliveries(project.slug)
    assert.deepEqual(pending, [])

    await store.releaseDelivery(project.slug, record.slug, 1)
    pending = await store.pendingDeliveries(project.slug)
    assert.equal(pending.length, 1)
  })
})

// ---------------------------------------------------------------------------
// Answers, ownership, and recording
// ---------------------------------------------------------------------------

describe("reading answers", () => {
  it("should enforce ownership, adopt an orphan, and record or retire keys atomically", async () => {
    const store = newStore()
    const project = await register(store)
    const input = payload(
      [single("q1", "A"), single("q2", "A"), text("q3", "A"), text("q9", "C")],
      {
        groups: [
          { key: "A", title: "A" },
          { key: "C", title: "C" },
        ],
      },
    )
    let record = await published(store, project, input, "s1")
    record = await answer(store, project, record, "q1", { choice: "a" })
    record = await answer(store, project, record, "q2", { choice: "a" })
    record = await store.saveAnswer(project.slug, record.slug, "q3", { needsDiscussion: true }, 1)
    record = record.plan
    await store.submit(project.slug, record.slug, "A", 1)

    const first = await store.readAnswers(project.slug, record.slug, "s1")
    assert.equal(first.ok, true)
    if (!first.ok) return
    assert.equal(first.submissions.length, 1)
    assert.equal(first.submissions[0].deliveredTo, "s1")
    assert.ok(first.submissions[0].deliveredAt)

    const stranger = await store.readAnswers(project.slug, record.slug, "s2")
    assert.equal(stranger.ok, false)
    if (!stranger.ok) {
      assert.equal(stranger.reason, "owned")
      assert.equal(stranger.owner, "s1")
    }

    await store.markOrphaned(project.slug, "s1")
    const adopted = await store.readAnswers(project.slug, record.slug, "s2")
    assert.equal(adopted.ok, true)
    if (adopted.ok) assert.equal(adopted.plan.owner.sessionID, "s2")

    const resolved = await store.resolve(project.slug, record.slug, "s2", {
      recorded: [{ key: "q1", as: "AR-7" }],
      retire: ["q9"],
    })
    assert.equal(resolved.ok, true)
    if (resolved.ok) {
      assert.equal(resolved.recorded, 1)
      assert.equal(resolved.retired, 1)
    }
    const current = await store.getPlan(project.slug, record.slug)
    assert.equal(questionOf(current, "q1").state.status, "recorded")
    assert.equal(questionOf(current, "q1").state.recordedAs, "AR-7")
    assert.equal(questionOf(current, "q9").state.status, "retired")

    const unknown = await store.resolve(project.slug, record.slug, "s2", {
      recorded: [{ key: "nope", as: "AR-8" }],
    })
    assert.equal(unknown.ok, false)
    if (!unknown.ok) assert.equal(unknown.reason, "invalid")

    const openKey = await store.resolve(project.slug, record.slug, "s2", {
      recorded: [{ key: "q3", as: "AR-8" }],
    })
    assert.equal(openKey.ok, false)
    if (!openKey.ok) assert.equal(openKey.reason, "invalid")
  })
})

// ---------------------------------------------------------------------------
// Refusal
// ---------------------------------------------------------------------------

describe("refusal", () => {
  it("should refuse a newer schema version and leave the bytes untouched", async () => {
    const root = scratch("refusal")
    const dataDir = join(root, "discovery")
    const store = createDiscoveryStore({ dataDir, now: clock })
    const project = await register(store, "refusal")
    const record = await published(store, project, payload([text("q1", "A")]))
    const file = planFile(dataDir, project.slug, record.slug)
    writeFileSync(file, JSON.stringify({ schemaVersion: 2 }), { mode: 0o600 })
    const before = readFileSync(file)

    await assert.rejects(
      store.getPlan(project.slug, record.slug),
      (error) => error instanceof DiscoveryDataError && error.code === "newer-version",
    )
    await assert.rejects(
      store.publish(project.slug, payload([text("q1", "A")]), "s1"),
      (error) => error instanceof DiscoveryDataError && error.code === "newer-version",
    )
    assert.deepEqual(readFileSync(file), before)
  })

  it("should refuse a malformed plan file without hiding a valid one", async () => {
    const root = scratch("unreadable")
    const dataDir = join(root, "discovery")
    const store = createDiscoveryStore({ dataDir, now: clock })
    const project = await register(store, "unreadable")
    const valid = await published(store, project, payload([text("q1", "A")]))
    const plansDir = join(dataDir, "projects", project.slug, "plans")
    writeFileSync(join(plansDir, "broken.json"), "{bad", { mode: 0o600 })

    await assert.rejects(
      store.getPlan(project.slug, "broken"),
      (error) => error instanceof DiscoveryDataError && error.code === "unreadable",
    )
    const stillThere = await store.getPlan(project.slug, valid.slug)
    assert.equal(stillThere.slug, valid.slug)
  })
})

// ---------------------------------------------------------------------------
// Multiple stores and deletion
// ---------------------------------------------------------------------------

describe("multiple stores", () => {
  it("should serialize writes per path and keep concurrent saves", async () => {
    const root = scratch("queue")
    const dataDir = join(root, "discovery")
    const storeA = createDiscoveryStore({ dataDir, now: clock })
    const storeB = createDiscoveryStore({ dataDir, now: clock })
    const project = await register(storeA, "queue")
    const record = await published(storeA, project, payload([single("q1", "A"), single("q2", "A")]))

    await storeA.saveAnswer(project.slug, record.slug, "q1", { answer: { choice: "a" } }, 1)
    await storeB.saveAnswer(project.slug, record.slug, "q2", { answer: { choice: "b" } }, 1)
    let current = await storeA.getPlan(project.slug, record.slug)
    assert.equal(questionOf(current, "q1").state.answer.choice, "a")
    assert.equal(questionOf(current, "q2").state.answer.choice, "b")

    const [firstSave, secondSave] = await Promise.all([
      storeA.saveAnswer(project.slug, record.slug, "q1", { answer: { choice: "b" } }, 1),
      storeA.saveAnswer(project.slug, record.slug, "q2", { answer: { choice: "a" } }, 1),
    ])
    assert.equal(firstSave.ok, true)
    assert.equal(secondSave.ok, true)
    current = await storeA.getPlan(project.slug, record.slug)
    assert.equal(questionOf(current, "q1").state.answer.choice, "b")
    assert.equal(questionOf(current, "q2").state.answer.choice, "a")

    const count = await storeA.markOrphaned(project.slug, "s1")
    assert.equal(count, 1)
    current = await storeA.getPlan(project.slug, record.slug)
    assert.equal(current.orphaned, true)

    assert.equal(await storeA.deletePlan(project.slug, record.slug), true)
    assert.equal(existsSync(planFile(dataDir, project.slug, record.slug)), false)
    assert.equal(await storeA.getPlan(project.slug, record.slug), null)
  })
})
