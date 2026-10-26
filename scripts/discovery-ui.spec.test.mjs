/**
 * Specification tests for the Discovery web UI.
 *
 * These cases pin routing, the pure view models, the Griffel renderer factory,
 * the build output, server-side rendering, packaging, and the API client.
 * They are written from the contract documents only, so a failure here means
 * the implementation does not satisfy the specification.
 *
 * @module discovery-ui.spec.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { after, describe, it } from "node:test"

import { createApi } from "../discovery-ui/src/api.ts"
import { createAppRenderer } from "../discovery-ui/src/renderer.ts"
import { formatRoute, parseRoute } from "../discovery-ui/src/route.ts"
import { planView, projectsView } from "../discovery-ui/src/view-models.ts"
import { buildDiscoveryUi } from "../scripts/build-discovery-ui.mjs"

/** Throwaway roots created by the tests, removed afterward. */
const created = []

/** Base directory for temporary roots. */
const BASE = process.env.CODEOPS_TMPDIR ?? tmpdir()

/** The repository root. */
const ROOT = fileURLToPath(new URL("..", import.meta.url))

after(() => {
  for (const directory of created) rmSync(directory, { recursive: true, force: true })
})

/** Creates a throwaway directory. */
function scratch(prefix) {
  const directory = mkdtempSync(join(BASE, `discovery-ui-${prefix}-`))
  created.push(directory)
  return directory
}

/** Builds a stored plan record used by the view-model and SSR cases. */
function planFixture() {
  const state = (extra = {}) => ({
    answer: null,
    notes: "",
    defer: null,
    needsDiscussion: false,
    proposalDismissed: false,
    status: "open",
    changed: false,
    recordedAs: null,
    ...extra,
  })
  return {
    schemaVersion: 1,
    slug: "billing",
    key: "plan:plans/billing",
    kind: "plan",
    artifact: "plans/billing",
    title: "Billing plan",
    owner: { sessionID: "s1" },
    orphaned: false,
    archived: false,
    unarchivedAt: null,
    revision: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    groups: [
      { key: "Rules", title: "Rules", dependsOn: ["Scope"], submittedAt: null },
      { key: "Scope", title: "Scope", dependsOn: [], submittedAt: null },
      { key: "Extra", title: "Extra", dependsOn: [], submittedAt: null },
    ],
    questions: [
      {
        key: "DQ-1",
        group: "Scope",
        type: "single",
        title: "Refund policy",
        why: "It decides the flow",
        options: [
          { id: "yes", label: "Refund" },
          {
            id: "no",
            label: "No refund",
            implies: [
              { question: "DQ-5", answer: "x", reason: "No refunds" },
              { question: "DQ-6", answer: "x", reason: "first" },
            ],
          },
        ],
        recommendation: "yes",
        fingerprint: "f1",
        revisedAt: 1,
        state: state({ answer: { choice: "no" } }),
      },
      {
        key: "DQ-2",
        group: "Scope",
        type: "text",
        title: "Details",
        fingerprint: "f2",
        revisedAt: 1,
        state: state({
          defer: { decision: "later", owner: "me", revisit: "next week" },
          changed: true,
        }),
      },
      {
        key: "DQ-5",
        group: "Scope",
        type: "single",
        title: "Implied choice",
        options: [
          { id: "x", label: "X" },
          { id: "y", label: "Y" },
        ],
        fingerprint: "f5",
        revisedAt: 1,
        state: state(),
      },
      {
        key: "DQ-8",
        group: "Scope",
        type: "text",
        title: "Open question",
        fingerprint: "f8",
        revisedAt: 1,
        state: state(),
      },
      {
        key: "DQ-9",
        group: "Scope",
        type: "text",
        title: "Discussion",
        fingerprint: "f9",
        revisedAt: 1,
        state: state({ needsDiscussion: true }),
      },
      {
        key: "DQ-3",
        group: "Rules",
        type: "text",
        title: "Recorded one",
        fingerprint: "f3",
        revisedAt: 1,
        state: state({ status: "recorded", recordedAs: "AR-7" }),
      },
      {
        key: "DQ-4",
        group: "Rules",
        type: "text",
        title: "Retired one",
        fingerprint: "f4",
        revisedAt: 1,
        state: state({ status: "retired" }),
      },
      {
        key: "DQ-6",
        group: "Rules",
        type: "single",
        title: "Conflict",
        options: [
          { id: "x", label: "X" },
          { id: "y", label: "Y" },
        ],
        fingerprint: "f6",
        revisedAt: 1,
        state: state(),
      },
      {
        key: "DQ-7",
        group: "Rules",
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
        fingerprint: "f7",
        revisedAt: 1,
        state: state({ answer: { choice: "a" } }),
      },
      {
        key: "DQ-10",
        group: "Extra",
        type: "text",
        title: "Submitted one",
        fingerprint: "f10",
        revisedAt: 1,
        state: state({ status: "submitted" }),
      },
      {
        key: "DQ-11",
        group: "Extra",
        type: "text",
        title: "Extra answer",
        fingerprint: "f11",
        revisedAt: 1,
        state: state({ answer: { text: "done" } }),
      },
    ],
    submissions: [],
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

describe("routes", () => {
  it("should parse the three views and reject unknown or invalid segments", () => {
    assert.deepEqual(parseRoute(""), { view: "projects" })
    assert.deepEqual(parseRoute("#/"), { view: "projects" })
    assert.deepEqual(parseRoute("#/p/my-repo"), { view: "project", project: "my-repo" })
    assert.deepEqual(parseRoute("#/p/my-repo/billing"), {
      view: "plan",
      project: "my-repo",
      plan: "billing",
    })
    assert.deepEqual(parseRoute("#/p/My%20Repo"), { view: "not-found" })
    assert.deepEqual(parseRoute("#/x"), { view: "not-found" })
    assert.deepEqual(parseRoute("#/p/my-repo/billing/extra"), { view: "not-found" })
  })

  it("should round-trip every valid route", () => {
    for (const hash of ["#/", "#/p/my-repo", "#/p/my-repo/billing"]) {
      assert.equal(formatRoute(parseRoute(hash)), hash)
    }
  })
})

// ---------------------------------------------------------------------------
// View models
// ---------------------------------------------------------------------------

describe("view models", () => {
  it("should order groups, label locks, and expose readiness", () => {
    const view = planView(planFixture())
    const order = view.groups.map((group) => group.key)
    assert.ok(order.indexOf("Rules") > order.indexOf("Scope"))

    const rules = view.groups.find((group) => group.key === "Rules")
    assert.equal(rules.locked, true)
    assert.equal(rules.lockLabel, "Unlocks after Scope is submitted")
    assert.match(rules.summary, /^\d+ of \d+ ready$/)

    const scope = view.groups.find((group) => group.key === "Scope")
    assert.equal(scope.locked, false)
  })

  it("should label recommendations, selections, implications, conflicts, and changes", () => {
    const view = planView(planFixture())
    const scope = view.groups.find((group) => group.key === "Scope")
    const refund = scope.questions.find((question) => question.key === "DQ-1")
    const recommended = refund.options.find((option) => option.id === "yes")
    assert.equal(recommended.recommended, true)
    assert.equal(recommended.selected, false, "a recommendation is never pre-selected")
    assert.equal(refund.options.find((option) => option.id === "no").selected, true)

    const implied = scope.questions.find((question) => question.key === "DQ-5")
    assert.equal(implied.implied.label, "Implied by DQ-1 — No refunds")

    const rules = view.groups.find((group) => group.key === "Rules")
    const conflict = rules.questions.find((question) => question.key === "DQ-6")
    assert.deepEqual([...conflict.conflict.sources].sort(), ["DQ-1", "DQ-7"])
    assert.equal(conflict.conflict.label.includes("DQ-1"), true)

    const changed = scope.questions.find((question) => question.key === "DQ-2")
    assert.equal(changed.changed, true)
  })

  it("should map status labels and list retired questions separately", () => {
    const view = planView(planFixture())
    const labels = new Map(
      view.groups.flatMap((group) => group.questions.map((question) => [question.key, question.statusLabel])),
    )
    assert.equal(labels.get("DQ-1"), "Answered")
    assert.equal(labels.get("DQ-2"), "Deferred")
    assert.equal(labels.get("DQ-8"), "Open")
    assert.equal(labels.get("DQ-9"), "Needs discussion")
    assert.equal(labels.get("DQ-10"), "Submitted")
    assert.equal(labels.get("DQ-3"), "Recorded as AR-7")
    assert.deepEqual(
      view.retired.map((question) => question.key),
      ["DQ-4"],
    )
    assert.equal(view.retired[0].statusLabel, "Retired")
    assert.equal(view.retired[0].readOnly, true)
  })

  it("should partition counts and summarize submit-all", () => {
    const view = planView(planFixture())
    assert.deepEqual(view.counts, {
      open: 2,
      answered: 4,
      deferred: 1,
      discussion: 1,
      submitted: 1,
      recorded: 1,
    })
    assert.equal(view.groups.find((group) => group.key === "Scope").summary, "3 of 5 ready")
    assert.deepEqual(view.submitAll.ready, ["Extra"])
    const scope = view.submitAll.skipped.find((entry) => entry.group === "Scope")
    const rules = view.submitAll.skipped.find((entry) => entry.group === "Rules")
    assert.equal(scope.label, "DQ-2 is changed — re-confirm, DQ-8 is unanswered")
    assert.equal(rules.label, "Unlocks after Scope is submitted")
  })

  it("should group projects by repository and flag offline projects", () => {
    const view = projectsView([
      {
        name: "repo",
        canonical: "/work/repo",
        projects: [
          {
            slug: "my-repo",
            name: "my-repo",
            branch: "main",
            directory: "/work/repo",
            counts: { plans: 1, open: 2, answered: 1, deferred: 0, discussion: 0, submitted: 0, recorded: 0 },
            live: false,
          },
        ],
      },
    ])
    assert.equal(view.repositories.length, 1)
    assert.equal(view.repositories[0].projects[0].liveBadge, "Not open in OpenCode")
    assert.equal(view.repositories[0].projects[0].countsLabel, "2 open · 1 answered · 0 submitted")
  })
})

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

describe("renderer", () => {
  it("should attach the nonce and tolerate a missing document at creation", () => {
    // `styleElementAttributes` is the map the renderer applies to every style
    // element it creates; asserting it is the Node-side equivalent of reading
    // the inserted element's attributes.
    const stubDocument = {
      createElement() {
        return { setAttribute() {}, appendChild() {}, style: {} }
      },
      head: { appendChild() {} },
    }
    const renderer = createAppRenderer("abc", stubDocument)
    assert.equal(renderer.styleElementAttributes.nonce, "abc")
    assert.doesNotThrow(() => createAppRenderer("abc"))
  })
})

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

describe("api client", () => {
  it("should return data, map stale, and map network failures", async () => {
    const okFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ plan: { slug: "billing" } }),
    })
    const okApi = createApi("http://127.0.0.1:1", okFetch)
    const data = await okApi.getPlan("my-repo", "billing")
    assert.equal(data.ok, true)
    assert.equal(data.data.plan.slug, "billing")

    const staleFetch = async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: "stale", message: "changed" }),
    })
    const stale = await createApi("http://127.0.0.1:1", staleFetch).getPlan("p", "plan")
    assert.equal(stale.ok, false)
    assert.equal(stale.kind, "stale")

    const network = await createApi("http://127.0.0.1:1", async () => {
      throw new Error("offline")
    }).getPlan("p", "plan")
    assert.equal(network.ok, false)
    assert.equal(network.kind, "network")
  })
})

// ---------------------------------------------------------------------------
// Build, SSR, and packaging
// ---------------------------------------------------------------------------

describe("build", () => {
  it("should build a self-contained bundle with a nonce template", async () => {
    const outdir = scratch("build")
    const { metafile } = await buildDiscoveryUi({ outdir })
    const html = readFileSync(join(outdir, "index.html"), "utf8")
    assert.ok(html.includes('name="csp-nonce"'))
    assert.ok(html.includes("__CSP_NONCE__"))
    assert.ok(html.includes('src="/assets/app.js"'))
    assert.ok(!html.includes("http://"))
    assert.ok(!html.includes("https://"))

    const bundle = readFileSync(join(outdir, "assets", "app.js"))
    assert.ok(bundle.length <= 1_048_576, `bundle is ${bundle.length} bytes`)
    const text = bundle.toString("utf8")
    assert.ok(!text.includes('import("http'))
    assert.ok(!text.includes('from "http'))
    assert.ok(!text.includes('fetch("http'))

    const griffel = Object.keys(metafile.inputs).filter((path) =>
      path.replaceAll("\\\\", "/").includes("@griffel/core/"),
    )
    assert.ok(griffel.length > 0)
    const directories = new Set(
      griffel.map((path) =>
        path.slice(0, path.indexOf("@griffel/core") + "@griffel/core".length),
      ),
    )
    assert.equal(directories.size, 1, "the bundle must contain one @griffel/core copy")
  })

  it("should render the three views through renderToString with initial data", async () => {
    const entry = scratch("ssr")
    const fixturePath = join(entry, "fixture.json")
    writeFileSync(fixturePath, JSON.stringify(planFixture()))
    const entryPath = join(entry, "entry.tsx")
    writeFileSync(
      entryPath,
      `import React from "react"
import { renderToString } from "react-dom/server"
import { readFileSync } from "node:fs"
import { App } from ${JSON.stringify(join(ROOT, "discovery-ui/src/app.tsx"))}
import { parseRoute } from ${JSON.stringify(join(ROOT, "discovery-ui/src/route.ts"))}
const plan = JSON.parse(readFileSync(${JSON.stringify(fixturePath)}, "utf8"))
const project = { slug: "my-repo", name: "my-repo", branch: "main", directory: "/work/my-repo" }
const repositories = [{ name: "repo", canonical: "/work/repo", projects: [{ ...project, counts: { plans: 1, open: 1, answered: 1, deferred: 0, discussion: 0, submitted: 0, recorded: 0 }, live: true }] }]
const api = { async getPlan() { throw new Error("no fetch in SSR") } }
const summary = { slug: plan.slug, title: plan.title, kind: plan.kind, artifact: plan.artifact, revision: plan.revision, archived: plan.archived, orphaned: plan.orphaned, updatedAt: plan.updatedAt, counts: { open: 2, answered: 3, submitted: 0, recorded: 0 } }
const cases = [["#/", { repositories }], ["#/p/my-repo", { project, plans: [summary] }], ["#/p/my-repo/billing", { project, plan }]]
const rendered = cases.map(([hash, initial]) => ({ hash, html: renderToString(React.createElement(App, { route: parseRoute(hash), api, initial })) }))
process.stdout.write(JSON.stringify(rendered))
`,
    )
    const bundlePath = join(entry, "entry.cjs")
    const { build } = await import("esbuild")
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
    const routes = new Map(JSON.parse(run.stdout).map((entry) => [entry.hash, entry.html]))
    const projects = routes.get("#/")
    assert.ok(projects.includes("repo"))
    assert.ok(projects.includes("my-repo"))
    const project = routes.get("#/p/my-repo")
    assert.ok(project.includes("Billing plan"))
    const plan = routes.get("#/p/my-repo/billing")
    assert.ok(plan.includes("Billing plan"))
    assert.ok(plan.includes("Refund policy"))
    assert.ok(plan.includes("Recommended"))
    assert.ok(plan.includes("Scope"))
    assert.ok(plan.includes("Submit group"))
  })
})

describe("packaging", () => {
  it("should describe the UI scripts, dependencies, and ignore rules", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))
    assert.equal(manifest.scripts["build:discovery"], "node scripts/build-discovery-ui.mjs")
    assert.equal(manifest.scripts.prepack, "npm run build:discovery")
    assert.ok(manifest.scripts.typecheck.includes("tsc -p discovery-ui"))
    assert.ok(manifest.files.includes("discovery-ui/dist/"))
    assert.ok(manifest.files.includes("!discovery-ui/src/"))
    assert.deepEqual(manifest.dependencies, { "@opencode/plugin": manifest.dependencies["@opencode/plugin"] })
    for (const dependency of [
      "react",
      "react-dom",
      "@fluentui/react-components",
      "@fluentui/react-icons",
      "@griffel/react",
      "esbuild",
    ]) {
      assert.ok(manifest.devDependencies[dependency], `${dependency} must be a devDependency`)
    }
    assert.match(readFileSync(join(ROOT, ".gitignore"), "utf8"), /^discovery-ui\/dist\/$/m)

    const tsconfig = JSON.parse(readFileSync(join(ROOT, "discovery-ui", "tsconfig.json"), "utf8"))
    assert.equal(tsconfig.compilerOptions.noEmit, true)
    assert.equal(tsconfig.compilerOptions.allowImportingTsExtensions, true)
    assert.equal(tsconfig.compilerOptions.erasableSyntaxOnly, true)
  })

  it("should include the built UI in the package and no UI sources", async () => {
    const outdir = join(ROOT, "discovery-ui", "dist")
    const existed = existsSync(outdir)
    await buildDiscoveryUi({ outdir })
    try {
      const packed = spawnSync(
        "npm",
        ["pack", "--dry-run", "--json", "--ignore-scripts"],
        { cwd: ROOT, encoding: "utf8" },
      )
      assert.equal(packed.status, 0, packed.stderr)
      const entries = JSON.parse(packed.stdout)[0].files.map((file) => file.path)
      assert.ok(entries.includes("discovery-ui/dist/index.html"))
      assert.ok(entries.includes("discovery-ui/dist/assets/app.js"))
      assert.ok(!entries.some((path) => path.startsWith("discovery-ui/src/")))
    } finally {
      if (!existed) rmSync(outdir, { recursive: true, force: true })
    }
  })
})
