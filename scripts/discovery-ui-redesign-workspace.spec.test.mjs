/**
 * Specification tests for the redesigned Discovery workspace.
 *
 * The suite combines pure progress derivations with server-rendered output for
 * the shared header, the selected-group workspace, the decision summary, and
 * the question controls. Browser-only focus and history behaviour stays in
 * the live checklist; this suite pins the render and model contracts.
 *
 * @module discovery-ui-redesign-workspace.spec.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { after, before, describe, it } from "node:test"
import { build } from "esbuild"

import { buildDiscoveryUi } from "../scripts/build-discovery-ui.mjs"

/** The repository root. */
const ROOT = fileURLToPath(new URL("..", import.meta.url))
/** Base directory for temporary roots. */
const BASE = process.env.CODEOPS_TMPDIR ?? tmpdir()
/** Throwaway roots created by the suite. */
const created = []

after(() => {
  for (const directory of created) rmSync(directory, { recursive: true, force: true })
})

/** Create a throwaway directory. */
function scratch(prefix) {
  const directory = mkdtempSync(join(BASE, `discovery-ui-redesign-${prefix}-`))
  created.push(directory)
  return directory
}

/** The default stored question state. */
function state(extra = {}) {
  return {
    answer: null,
    notes: "",
    defer: null,
    needsDiscussion: false,
    proposalDismissed: false,
    status: "open",
    changed: false,
    recordedAs: null,
    ...extra,
  }
}

/** One stored question. */
function question(key, group, extra = {}) {
  const { state: questionState, ...rest } = extra
  return {
    key,
    group,
    type: "text",
    title: key,
    fingerprint: `f-${key}`,
    revisedAt: 1,
    state: state(questionState),
    ...rest,
  }
}

/** The shared plan fixture for the render and model cases. */
function workspaceFixture() {
  return {
    slug: "billing",
    title: "Billing plan",
    kind: "plan",
    artifact: "plans/billing",
    revision: 1,
    orphaned: false,
    archived: false,
    unarchivedAt: null,
    groups: [
      { key: "Rules", title: "Rules", dependsOn: ["Scope"], submittedAt: null },
      { key: "Scope", title: "Scope", dependsOn: [], submittedAt: null },
      { key: "Extra", title: "Extra", dependsOn: [], submittedAt: "2026-01-01" },
      { key: "Complete", title: "Complete", dependsOn: [], submittedAt: "2026-01-01" },
      { key: "Empty", title: "Empty", dependsOn: [], submittedAt: null },
    ],
    questions: [
      question("DQ-1", "Scope", {
        type: "single",
        title: "Refund policy",
        why: "It decides the flow",
        options: [
          { id: "yes", label: "Refund" },
          {
            id: "no",
            label: "No refund",
            implies: [
              { question: "DQ-5", answer: "y", reason: "No refunds" },
              { question: "DQ-6", answer: "x", reason: "first" },
            ],
          },
        ],
        recommendation: "yes",
        state: { answer: { choice: "no" } },
      }),
      question("DQ-2", "Scope", {
        type: "text",
        title: "Details",
        state: {
          defer: { decision: "later", owner: "me", revisit: "next week" },
          changed: true,
        },
      }),
      question("DQ-3", "Rules", {
        title: "Recorded one",
        state: { status: "recorded", recordedAs: "AR-7", answer: { text: "recorded answer" } },
      }),
      question("DQ-4", "Rules", {
        title: "Retired one",
        state: { status: "retired", answer: { text: "old answer" } },
      }),
      question("DQ-5", "Scope", {
        type: "single",
        title: "Implied choice",
        options: [
          { id: "x", label: "X" },
          { id: "y", label: "Y" },
        ],
      }),
      question("DQ-6", "Rules", {
        type: "single",
        title: "Conflict",
        options: [
          { id: "x", label: "X" },
          { id: "y", label: "Y" },
        ],
      }),
      question("DQ-7", "Rules", {
        type: "single",
        title: "Other source",
        options: [
          {
            id: "a",
            label: "A",
            implies: [{ question: "DQ-6", answer: "y", reason: "second" }],
          },
          { id: "b", label: "B" },
        ],
        state: { answer: { choice: "a" } },
      }),
      question("DQ-8", "Scope", {
        title: "Open question",
        state: { notes: "a note" },
      }),
      question("DQ-9", "Scope", {
        title: "Discussion",
        state: { needsDiscussion: true },
      }),
      question("DQ-10", "Extra", {
        title: "Submitted one",
        state: { status: "submitted", answer: { text: "sent" } },
      }),
      question("DQ-11", "Extra", {
        title: "Extra answer",
        state: { answer: { text: "done" } },
      }),
      question("DQ-12", "Scope", {
        type: "multiple",
        title: "Pick several",
        options: [
          { id: "a", label: "Option A" },
          { id: "b", label: "Option B" },
        ],
        state: { answer: { choices: ["b", "a"] } },
      }),
      question("DQ-13", "Scope", {
        type: "single-other",
        title: "Other choice",
        options: [
          { id: "x", label: "X" },
          { id: "y", label: "Y" },
        ],
        state: { answer: { other: "custom" } },
      }),
      question("DQ-14", "Scope", {
        title: "Text answer",
        state: { answer: { text: "hello" } },
      }),
      question("DQ-15", "Scope", {
        type: "single",
        title: "Proposal",
        options: [
          { id: "p", label: "P" },
          { id: "q", label: "Q" },
        ],
        proposal: { answer: "p" },
      }),
      question("DQ-16", "Scope", {
        title: "Unsafe <script>alert(1)</script>",
        evidence: ["<b>raw</b>"],
      }),
      question("DQ-17", "Complete", {
        title: "Finished question",
        state: { status: "recorded", recordedAs: "AR-9", answer: { text: "finished" } },
      }),
      question("DQ-hidden", "Scope", {
        title: "Hidden draft",
        showIf: [{ question: "DQ-1", anyOf: ["yes"] }],
      }),
      question("DQ-removed", "Gone", {
        title: "Removed group question",
        state: { answer: { text: "old removed" } },
      }),
    ],
  }
}

/** The project record used by the render cases. */
const PROJECT = {
  slug: "my-repo",
  name: "my-repo",
  branch: "main",
  directory: "/work/my-repo",
}

/** The projects response used by the root route. */
const REPOSITORIES = [
  {
    name: "repo",
    canonical: "/work/repo",
    projects: [{ ...PROJECT, counts: { plans: 1 }, live: true }],
  },
]

/** The plan summary used by the project route. */
const PLAN_SUMMARY = {
  slug: "billing",
  title: "Billing plan",
  kind: "plan",
  artifact: "plans/billing",
  revision: 1,
  archived: false,
  orphaned: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
  counts: { open: 2, answered: 3, submitted: 1, recorded: 1 },
}

/** Build a temporary SSR entry and return its captured JSON output. */
async function renderWorkspace() {
  const directory = scratch("ssr")
  const fixturePath = join(directory, "fixture.json")
  writeFileSync(
    fixturePath,
    JSON.stringify({
      plan: workspaceFixture(),
      project: PROJECT,
      repositories: REPOSITORIES,
      summary: PLAN_SUMMARY,
    }),
  )
  const entryPath = join(directory, "entry.tsx")
  writeFileSync(
    entryPath,
    `import React from "react"
import { renderToString } from "react-dom/server"
import { readFileSync } from "node:fs"
import { App } from ${JSON.stringify(join(ROOT, "discovery-ui/src/app.tsx"))}
import { QuestionCard } from ${JSON.stringify(join(ROOT, "discovery-ui/src/views/QuestionCard.tsx"))}
import { DecisionSummary } from ${JSON.stringify(join(ROOT, "discovery-ui/src/views/DecisionSummary.tsx"))}
import { ConnectionBanner } from ${JSON.stringify(join(ROOT, "discovery-ui/src/views/ConnectionBanner.tsx"))}
import { planView } from ${JSON.stringify(join(ROOT, "discovery-ui/src/view-models.ts"))}
import { workspaceView } from ${JSON.stringify(join(ROOT, "discovery-ui/src/workspace-model.ts"))}
import { applyDrafts } from ${JSON.stringify(join(ROOT, "discovery-ui/src/workspace-model.ts"))}
import { parseRoute } from ${JSON.stringify(join(ROOT, "discovery-ui/src/route.ts"))}
const fixture = JSON.parse(readFileSync(${JSON.stringify(fixturePath)}, "utf8"))
const api = { async getPlan() { throw new Error("no fetch in SSR") }, async listProjects() { throw new Error("no fetch in SSR") }, async getProject() { throw new Error("no fetch in SSR") } }
const plan = fixture.plan
const initial = { project: fixture.project, plan }
const cases = [
  ["#/", { repositories: fixture.repositories }],
  ["#/p/my-repo", { project: fixture.project, plans: [fixture.summary] }],
  ["#/p/my-repo/billing", initial],
  ["#/p/my-repo/billing/groups/Extra", initial],
  ["#/p/my-repo/billing/groups/Rules", initial],
  ["#/p/my-repo/billing/summary", initial],
]
const routes = cases.map(([hash, data]) => ({ hash, html: renderToString(React.createElement(App, { route: parseRoute(hash), api, initial: data })) }))
const view = planView(plan)
const byKey = new Map(view.groups.flatMap((group) => group.questions.map((item) => [item.key, item])).concat(view.hidden.map((item) => [item.key, item]), view.retired.map((item) => [item.key, item])))
const card = (key, extra = {}) => renderToString(React.createElement(QuestionCard, { question: { ...byKey.get(key), ...extra } }))
const summary = renderToString(React.createElement(DecisionSummary, {
  plan: applyDrafts(view, { "DQ-hidden": { answer: { text: "hidden draft" } }, "DQ-removed": { answer: { text: "removed draft" } } }, { "DQ-8": "offline" }),
  projectSlug: "my-repo",
  progress: workspaceView(view),
  drafts: { "DQ-hidden": { answer: { text: "hidden draft" } }, "DQ-removed": { answer: { text: "removed draft" } } },
  incomplete: { "DQ-2": { reason: "Complete the deferral fields" } },
  errors: { "DQ-8": "offline" },
  onDiscard: () => {},
  onRetry: () => {},
}))
const orphan = renderToString(React.createElement(App, { route: parseRoute("#/p/my-repo/billing"), api, initial: { project: fixture.project, plan: { ...plan, orphaned: true, unarchivedAt: "2026-01-01" } } }))
const connection = {
  restarted: renderToString(React.createElement(ConnectionBanner, { status: "restarted" })),
  reconnecting: renderToString(React.createElement(ConnectionBanner, { status: "reconnecting" })),
}
const cards = {
  single: card("DQ-1"),
  multiple: card("DQ-12"),
  other: card("DQ-13"),
  text: card("DQ-14"),
  proposal: card("DQ-15"),
  changed: card("DQ-2"),
  implied: card("DQ-5"),
  conflict: card("DQ-6"),
  notes: card("DQ-8"),
  discussion: card("DQ-9"),
  unsafe: card("DQ-16"),
  error: card("DQ-8", { error: "Save failed", hasDraft: true }),
  long: card("DQ-1", { title: "A".repeat(200) }),
}
const incompleteCard = renderToString(React.createElement(QuestionCard, {
  question: byKey.get("DQ-8"),
  incomplete: "Complete the deferral decision, owner, and revisit fields.",
}))
const identity = renderToString(React.createElement(App, {
  route: parseRoute("#/p/my-repo/billing"),
  api,
  initial: { project: { ...fixture.project, name: "My Repo" }, plan },
}))
process.stdout.write(JSON.stringify({ routes, summary, orphan, connection, cards, incompleteCard, identity }))
`,
  )
  const bundlePath = join(directory, "entry.cjs")
  await build({
    absWorkingDir: ROOT,
    nodePaths: [join(ROOT, "node_modules")],
    entryPoints: [entryPath],
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node22",
    jsx: "automatic",
    outfile: bundlePath,
    logLevel: "silent",
  })
  const run = spawnSync(process.execPath, [bundlePath], { encoding: "utf8" })
  assert.equal(run.status, 0, run.stderr)
  return JSON.parse(run.stdout)
}

describe("workspace derivations (ST-24)", () => {
  it("should keep Ready and Complete distinct and exclude hidden/retired work", async () => {
    const { planView } = await import("../discovery-ui/src/view-models.ts")
    const { workspaceView } = await import("../discovery-ui/src/workspace-model.ts")
    const view = planView(workspaceFixture())
    const progress = workspaceView(view)
    const complete = progress.groups.find((group) => group.key === "Complete")
    const extra = progress.groups.find((group) => group.key === "Extra")
    const empty = progress.groups.find((group) => group.key === "Empty")

    assert.equal(complete.complete, true)
    assert.equal(complete.empty, false)
    assert.equal(extra.complete, false, "a newly extended group is not complete")
    assert.equal(empty.empty, true)
    assert.equal(empty.pendingCount, 0)
    assert.equal(progress.groups.find((group) => group.key === "Scope").complete, false)
    assert.equal(
      view.groups.find((group) => group.key === "Empty").summary,
      "0 of 0 ready",
      "the existing empty-group assertion stays unchanged",
    )
    assert.equal(progress.totalGroups, 4, "groups with no visible questions are excluded")
    assert.equal(progress.completedGroups, 1)
    assert.equal(progress.visibleQuestions, 16, "hidden and retired questions are excluded")

    const answered = view.groups
      .flatMap((group) => group.questions)
      .filter((question) => {
        if (question.changed || question.conflict !== null || question.proposal !== null) return false
        if (question.statusKey === "submitted" || question.statusKey === "recorded") {
          return question.storedAnswer !== null
        }
        return question.statusKey === "answered"
      })
      .map((question) => question.key)
      .sort()
    assert.deepEqual(answered, [
      "DQ-1",
      "DQ-10",
      "DQ-11",
      "DQ-12",
      "DQ-13",
      "DQ-14",
      "DQ-17",
      "DQ-3",
      "DQ-5",
      "DQ-7",
    ])
    assert.equal(progress.answeredQuestions, answered.length)
  })

  it("should keep a removed group inspectable as retired context", async () => {
    const { planView } = await import("../discovery-ui/src/view-models.ts")
    const view = planView(workspaceFixture())
    const removed = view.retired.find((question) => question.key === "DQ-removed")
    assert.equal(removed.removedGroup, true)
    assert.deepEqual(removed.storedAnswer, { text: "old removed" })
    assert.equal(view.groups.some((group) => group.key === "Gone"), false)
  })
})

describe("rendered workspace (ST-21, ST-22, ST-23, ST-25, ST-26)", () => {
  let output

  before(async () => {
    output = await renderWorkspace()
  })

  it("should render the shared shell, breadcrumb, and one selected destination", () => {
    const legacy = output.routes.find((route) => route.hash === "#/p/my-repo/billing").html
    assert.match(legacy, /aria-label="Breadcrumb"/)
    assert.ok(legacy.includes("Projects"))
    assert.ok(legacy.includes("my-repo"))
    assert.ok(legacy.includes("Billing plan"))
    assert.ok(legacy.includes('href="#/"'))
    assert.ok(legacy.includes('href="#/p/my-repo"'))
    assert.equal((legacy.match(/<main/g) ?? []).length, 1)
    assert.ok(legacy.includes("Refund policy"), "the legacy URL selects the first actionable group")
    assert.ok(legacy.includes("Submit group"))
    assert.ok(legacy.includes("Recommended"))

    const extra = output.routes.find((route) => route.hash.endsWith("/groups/Extra")).html
    assert.ok(extra.includes("Submitted one"))
    assert.ok(extra.includes("Extra answer"))
    assert.equal(extra.includes("Refund policy"), false, "only the selected group is editable")

    const summaryRoute = output.routes.find((route) => route.hash.endsWith("/summary")).html
    assert.ok(summaryRoute.includes("Decision summary"))
    assert.ok(summaryRoute.includes("Submit all ready groups"))

    const rules = output.routes.find((route) => route.hash.endsWith("/groups/Rules")).html
    assert.ok(rules.includes("Locked"))
    assert.ok(rules.includes("Unlocks after Scope is submitted"))

    const projects = output.routes.find((route) => route.hash === "#/").html
    assert.ok(projects.includes("repo"))
    assert.ok(projects.includes("my-repo"))
    const project = output.routes.find((route) => route.hash === "#/p/my-repo").html
    assert.ok(project.includes("Billing plan"))
  })

  it("should render every question type, state, and escaped text (ST-22)", () => {
    const { cards } = output
    assert.match(cards.single, /role="radiogroup"/)
    assert.match(cards.single, /aria-label="Refund policy"/)
    assert.ok(cards.single.includes("Recommended"))
    const selectedInput = cards.single.match(/<input[^>]*value="no"[^>]*>/)
    const recommendedInput = cards.single.match(/<input[^>]*value="yes"[^>]*>/)
    assert.ok(selectedInput !== null && selectedInput[0].includes("checked"))
    assert.ok(recommendedInput !== null && !recommendedInput[0].includes("checked"))
    assert.match(cards.multiple, /type="checkbox"/)
    assert.match(cards.multiple, /role="group" aria-label="Pick several"/)
    assert.ok(cards.multiple.includes("Option A"))
    assert.ok(cards.multiple.includes("Option B"))
    assert.ok(cards.other.includes('placeholder="Other"'))
    assert.ok(cards.other.includes("custom"))
    assert.ok(cards.text.includes("hello"))
    assert.ok(cards.proposal.includes("Proposed:"))
    assert.ok(cards.proposal.includes("Confirm"))
    assert.ok(cards.proposal.includes("Reopen"))
    assert.ok(cards.changed.includes("Question changed — re-confirm."))
    assert.ok(cards.changed.includes("Re-confirm"))
    assert.ok(cards.implied.includes("Implied by DQ-1"))
    assert.ok(cards.conflict.includes("Conflicting answers from"))
    assert.ok(cards.unsafe.includes("&lt;script&gt;"))
    assert.equal(cards.unsafe.includes("<script>alert(1)</script>"), false)
    assert.ok(cards.unsafe.includes("&lt;b&gt;raw&lt;/b&gt;"))
    assert.ok(cards.long.includes("A".repeat(200)))
  })

  it("should keep the details disclosure mounted and open the right cases (ST-23)", () => {
    assert.match(output.cards.notes, /aria-expanded="false"/)
    assert.ok(output.cards.notes.includes("Notes added"))
    assert.match(output.cards.notes, /id="DQ-8-details" hidden=""/)
    assert.ok(output.cards.notes.includes('aria-label="Open question notes"'))
    assert.match(output.cards.changed, /aria-expanded="true"/)
    assert.ok(output.cards.changed.includes("Deferral decision"))
    assert.ok(output.cards.changed.includes("Defer this question"))
    assert.match(output.cards.discussion, /aria-expanded="true"/)
    assert.match(output.cards.error, /aria-expanded="true"/)
    assert.ok(output.cards.error.includes("Save failed"))
    assert.ok(output.cards.error.includes("Discard unsaved change"))
  })

  it("should keep collapsed details mounted and reveal incomplete work (ST-20-ui)", () => {
    assert.match(output.cards.notes, /id="DQ-8-details" hidden=""/)
    assert.ok(output.cards.notes.includes('aria-label="Open question notes"'))
    assert.match(output.incompleteCard, /aria-expanded="true"/)
    assert.ok(
      output.incompleteCard.includes("Complete the deferral decision, owner, and revisit fields."),
    )
  })

  it("should expose group and summary destinations in the rendered navigation (ST-13-ui)", () => {
    const legacy = output.routes.find((route) => route.hash === "#/p/my-repo/billing").html
    assert.ok(legacy.includes('href="#/p/my-repo/billing/groups/Scope"'))
    assert.ok(legacy.includes('href="#/p/my-repo/billing/summary"'))
    assert.ok(legacy.includes('aria-current="page"'), "the current breadcrumb is marked")
    assert.ok(legacy.includes('href="#main-content"'))
    assert.match(legacy, /<main id="main-content" tabindex="-1"/)
    const project = output.routes.find((route) => route.hash === "#/p/my-repo").html
    assert.ok(project.includes('aria-current="page"'))
  })

  it("should show the loaded identity instead of the route slug", () => {
    assert.ok(output.identity.includes("My Repo"))
    assert.ok(output.identity.includes('href="#/p/my-repo"'))
  })

  it("should summarize current, retired, and retained drafts with links (ST-25)", () => {
    const { summary } = output
    assert.ok(summary.includes("Refund policy"))
    assert.ok(summary.includes("No refund"))
    assert.ok(summary.includes("Pick several"))
    assert.ok(summary.includes("Option A, Option B"), "multiple choice keeps the declared order")
    assert.ok(summary.includes("Other: custom"))
    assert.ok(summary.includes("Deferred — later"))
    assert.ok(summary.includes("Needs discussion"))
    assert.ok(summary.includes("Recorded as AR-7"))
    assert.ok(summary.includes("Unanswered"))
    assert.ok(summary.includes("Retired questions"))
    assert.ok(summary.includes("old answer"), "a retired answer uses the stored answer")
    assert.ok(summary.includes("group removed"))
    assert.ok(summary.includes("old removed"))
    assert.ok(summary.includes("Unsent drafts"))
    assert.ok(summary.includes("hidden draft"))
    assert.ok(summary.includes("removed draft"))
    assert.ok(summary.includes("offline"))
    assert.ok(summary.includes("Complete the deferral fields"))
    assert.ok(summary.includes("Discard unsaved change"))
    assert.ok(summary.includes("Retry"))
    assert.ok(summary.includes('href="#/p/my-repo/billing/groups/Scope"'))
    assert.ok(summary.includes('href="#/p/my-repo/billing/groups/Rules"'))
  })

  it("should keep archive, delete, missing reasons, and restart feedback (ST-26)", () => {
    const scope = output.routes.find((route) => route.hash === "#/p/my-repo/billing").html
    assert.ok(scope.includes("Submit group"))
    assert.ok(scope.includes("Missing:"))
    assert.ok(scope.includes("Archive"))
    assert.ok(scope.includes("Delete…"))
    assert.ok(output.routes.find((route) => route.hash.endsWith("/summary")).html.includes("Submit all ready groups"))
    assert.ok(output.orphan.includes("This plan&#x27;s session ended."))
    assert.ok(output.orphan.includes("This plan was unarchived by a new publish."))
    assert.ok(output.connection.restarted.includes("Discovery restarted — reload"))
    assert.ok(output.connection.reconnecting.includes("Reconnecting…"))
  })

  it("should render the three-choice theme control for every route (ST-9-ui)", () => {
    for (const route of output.routes) {
      assert.match(route.html, /role="radiogroup"[^>]*aria-label="Theme"/)
      assert.ok(route.html.includes("System"))
      assert.ok(route.html.includes("Light"))
      assert.ok(route.html.includes("Dark"))
    }
  })
})

describe("build and package (ST-27)", () => {
  it("should build a nonce-safe bundle with Nav and one Griffel copy", async () => {
    const outdir = scratch("build")
    const { metafile } = await buildDiscoveryUi({ outdir })
    const html = readFileSync(join(outdir, "index.html"), "utf8")
    assert.ok(html.includes('name="csp-nonce"'))
    assert.ok(html.includes("__CSP_NONCE__"))
    assert.ok(!html.includes("http://"))
    assert.ok(!html.includes("https://"))
    const bundle = readFileSync(join(outdir, "assets", "app.js"))
    assert.ok(bundle.length <= 1_048_576, `bundle is ${bundle.length} bytes`)
    const inputs = Object.keys(metafile.inputs).map((path) => path.replaceAll("\\\\", "/"))
    assert.ok(inputs.some((path) => path.includes("@fluentui/react-nav/")), "the bundle includes Fluent Nav")
    const griffel = inputs.filter((path) => path.includes("@griffel/core/"))
    assert.ok(griffel.length > 0)
    const directories = new Set(
      griffel.map((path) =>
        path.slice(0, path.indexOf("@griffel/core") + "@griffel/core".length),
      ),
    )
    assert.equal(directories.size, 1, "the bundle must contain one @griffel/core copy")
  })

  it("should keep the dependency surface exact", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))
    assert.deepEqual(Object.keys(manifest.dependencies).sort(), ["@opencode/plugin"])
    assert.deepEqual(
      Object.keys(manifest.devDependencies).sort(),
      [
        "@fluentui/react-components",
        "@fluentui/react-icons",
        "@griffel/react",
        "@opentui/core",
        "@opentui/solid",
        "@types/node",
        "@types/react",
        "@types/react-dom",
        "esbuild",
        "react",
        "react-dom",
        "solid-js",
        "typescript",
      ].sort(),
    )
    assert.ok(manifest.files.includes("discovery-ui/dist/"))
    assert.ok(manifest.files.includes("!discovery-ui/src/"))
  })
})
