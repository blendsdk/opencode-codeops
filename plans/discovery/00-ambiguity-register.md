## Ambiguity Register: discovery

> **Status**: ✅ GATE PASSED — all 63 items resolved (53 user decisions · 10 delegated under auto-design)
> **Last Updated**: 2026-10-23 09:22
> **Scope**: standalone feature plan for Discovery — a local web application where CodeOps
> discovery questions are answered in the browser instead of the terminal, with the CodeOps plugin
> publishing questions and waking the owning session on Submit. Reviewed across all 12 categories
> plus the web-application, distributed-and-concurrent, and data-and-migration lenses
> (`references/domains/`). Rows 1–53 were decided in normal mode. From 2026-10-23 the user asked
> to continue with `--auto-design`: eligible technical decisions are delegated under
> `_shared/auto-design.md` policy version 1, root invocation ID `AD-DISC-20261023-1`; reserved
> decisions remain user-owned. Row 63 records the clarifications that came out of the preflight
> audit (2026-10-23) under its own invocation, `PF-DISC-20261023-1`.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope | Form of the feature | Markdown question sheet + validator / static HTML skin / local web app | User: a local web application ("Discovery") where answers are typed and choices made in the browser; no Markdown file to edit and hand back | ✅ Resolved |
| 2 | Scope | Supported environment | local machine only / local + remote OpenCode over SSH | User: local developer machine only; remote OpenCode and SSH are out of scope for now | ✅ Resolved |
| 3 | Technical (complexity escalation) | Standalone Discovery service: one shared process with CRUD API, central JSON store, SDK, CLI lifecycle, auto-start, event stream with delivery claim | revised smaller (in-plugin listener, fixed port) / approve standalone service / smallest (in-plugin, OS-assigned port) | User: **revised** — the page is served from inside the CodeOps plugin in the OpenCode background service on a fixed port; projects and plans on separate pages; JSON in the data directory; the plugin wakes the session directly. No separate process, SDK, CRUD API, plugin↔service event stream, or start/stop commands (full evidence: AR-3 note) | ✅ Resolved |
| 4 | Security & compliance | Authentication and local protections | login/token auth / no auth with local protections | User accepted recommendation: no authentication or authorization; listen on 127.0.0.1 only, Host-header allowlist (`localhost`, `127.0.0.1`), writes only as JSON from Discovery's own page or without a browser Origin, no CORS headers | ✅ Resolved |
| 5 | Behavioral | How the agent continues after answers | type "continue" / blocking tool call / plugin wakes the session | User accepted recommendation: answering a question only saves it; Submit (one group or all answered) is the trigger; the plugin wakes the owning session via `ctx.session.prompt` with `delivery: "queue"`; each submission is delivered exactly once (status field in the data file + in-memory flag); submissions saved but not yet delivered are delivered when the plugin starts. *Updated per AR-3: no event stream between separate processes* | ✅ Resolved |
| 6 | Behavioral | Questions that remove or answer other questions | rules in page / agent re-evaluation / both | User accepted recommendation: agent-declared rules evaluated instantly in the page (hide non-applicable questions; pre-fill implied answers labelled "Implied by …", overridable); groups that depend on others stay locked until those are submitted; settlements the agent proposes after a submission come back as "Proposed" with Confirm / Reopen | ✅ Resolved |
| 7 | Data & state | Where answers live | committed JSON next to the plan / Discovery's own data directory | User accepted recommendation: Discovery's own data directory; decisions are transcribed into the plan's Ambiguity Register, which stays the authoritative record in the repo | ✅ Resolved |
| 8 | Data & state | Storage engine | JSON files / SQLite | User accepted recommendation: JSON files, no new dependencies, runs on Node ≥18 | ✅ Resolved |
| 9 | Integration points | Starting and stopping Discovery | manual only / plugin auto-start + CLI | *Updated per AR-3:* the listener starts inside the plugin on first use in an opted-in project and stops when the OpenCode service stops; no separate process and no start/stop/status commands | ✅ Resolved |
| 10 | Integration points | Port policy | OS-assigned / fixed default, changeable | User accepted recommendation: fixed default port, changeable (specifics in row 21) | ✅ Resolved |
| 11 | Scope | When the page is used instead of chat | always / threshold | User accepted recommendation: every discovery round in adopted skills goes to the page; chat for 1–3 quick questions, cutoff configurable in `codeops/codeops.json` | ✅ Resolved |
| 12 | Scope | Adoption order | make-plan first / preflight first / both | User accepted recommendation: `make-plan` first, then `preflight` (which ones this plan covers: row 18) | ✅ Resolved |
| 13 | Scope | Opt-in | always on / opt-in per project | User: must be opt-in. Accepted recommendation: `"discovery": {"enabled": true}` in `codeops/codeops.json`, switched with `analyze-project --with-discovery` / `--without-discovery`; off by default; `--no-discovery` skips it for one run; when Discovery cannot start, the skill says so and falls back to chat; the gate is never skipped | ✅ Resolved |
| 14 | Integration points | Agent-facing interface | one tool per CRUD call / three coarse tools | User accepted recommendation: three coarse plugin tools — publish (all groups and questions of a plan in one idempotent call), answers (read submissions), resolve (mark recorded as `AR-n` or retire). *Updated per AR-3:* no SDK and no generic CRUD API; the page uses a small set of endpoints (read views, save an answer, submit) | ✅ Resolved |
| 15 | Data & state | Identity of projects, plans, questions | random IDs / readable keys | User accepted recommendation: projects identified by path and shown by a readable slug assigned once (`api`, `api-2`); plans by artifact path within the project; questions by a stable key supplied by the agent; no random identifiers for identity | ✅ Resolved |
| 16 | Data & state | Data model | projects → plans → groups → questions (+ rounds?) | User accepted recommendation: projects → plans (kind: plan / requirements / preflight) → groups → questions; a question carries options, recommendation, answer, notes, rules, and status (open → answered → submitted → recorded as `AR-n`); submissions are recorded for delivery; no separate "rounds" | ✅ Resolved |
| 17 | Non-functional | Verify command | — | Repository fact: `npm run verify` (AGENTS.md §Verification commands) | ✅ Resolved |
| 18 | Scope | What this plan contains | core + make-plan / core + make-plan + preflight | User: core + `make-plan` + `preflight` — spike, listener, storage, rules, Fluent UI, the three agent tools, wake on Submit, opt-in (schema + `analyze-project` flags), `_shared/discovery.md`, `make-plan` and `preflight` adoption, docs. Out of scope for this plan: exec-plan review batches, sidebar indicator, `/discovery` command, per-question "Ask the agent", export/print view, colleague sharing, remote/SSH | ✅ Resolved |
| 19 | Technical unknowns | Spike handling and fallback | spike with pre-agreed fallbacks / stop on any failure | User accepted recommendation: Phase 1 throwaway spike, nothing committed, proving (a) `ctx.session.prompt` wakes an idle session and queues on a busy one, (b) plugin instances in one service share one listener, (c) tool calls run in the plugin instance of the calling session's directory, (d) the background service keeps serving after the terminal UI closes. Fallbacks: (a) fails → the answers tool waits until Submit; (b) fails → one listener per project on an OS-assigned port, no cross-project list; (c) fails → stop and reopen; (d) documented only | ✅ Resolved |
| 20 | Behavioral | Content of the wake message | pointer only / full answers in the prompt | User accepted recommendation: pointer only, e.g. "Discovery: 7 answers submitted for opencode-codeops › discovery (group: Scope). Read them with codeops_discovery_answers." | ✅ Resolved |
| 21 | Integration points | Default port number and where it is configured | 4747 + env var / user config file | User accepted recommendation: default 4747; override with the environment variable `CODEOPS_DISCOVERY_PORT`; no new config file | ✅ Resolved |
| 22 | Data & state | Identity of git worktrees of the same project | checkout = project / repository = project | User accepted recommendation: each checkout directory (main checkout or worktree) is its own project entry; slug from the directory name, `-2` on collision; the header shows the branch; entries of the same repository are grouped under its name on the projects page | ✅ Resolved |
| 23 | Behavioral | Two sessions publishing for the same plan | ask to take over / last publisher wins | User accepted recommendation: the publish is refused with the owner's name; the agent asks in chat; on agreement it republishes with takeover and becomes the owner; submissions always wake the current owner | ✅ Resolved |
| 24 | Edge cases | Agent republishes while the user is answering | keep + flag changes / reset changed answers | User accepted recommendation: questions matched by key; unchanged → answer kept; text or options changed → answer kept but marked "Question changed — re-confirm", blocking Submit for that group until confirmed; removed → retired (read-only, collapsed) — refined by AD-63(b): submitted questions are kept until recorded; saves carry the plan revision and a stale save is rejected for that question and reloaded; the page receives changes live over a server-sent event stream | ✅ Resolved |
| 25 | UX & presentation | Question types and per-question actions | four types + actions / add number and date | User accepted recommendation: single choice, multiple choice, free text, single choice + "Other" text; every question has notes, "Defer" (decision, owner, revisit — all required), and "Needs discussion" (stays open, excluded from Submit); recommendation shown as a badge, never pre-selected; no "accept all" | ✅ Resolved |
| 26 | Technical unknowns | Rule language for show-if and implies | simple rules / expression language | User accepted recommendation: `showIf` = list of {question, anyOf:[options]}, all must hold; `implies` on an option = {question, answer, reason}; group `dependsOn` = groups that must be submitted first; references only within the same plan; conflicting implications → both shown, answered manually; overriding an implied answer is allowed and reported to the agent; no expression language | ✅ Resolved |
| 27 | Behavioral | Interplay with the Zero-Ambiguity and Complexity Escalation gates | escalations in chat / escalations on the page | User accepted recommendation: complexity-escalation approvals stay in chat with the visible STOP packet, never on the page; no "accept all" on the page; the agent copies each answer into the register as exact text with its question key; implied answers recorded as "implied by <key>, shown and submitted"; Defer requires decision, owner, and revisit | ✅ Resolved |
| 28 | Data & state | Data-file versioning and retention | version + manual cleanup / auto-delete | User accepted recommendation: every data file carries `schemaVersion: 1`; a newer version is refused with a clear message and never rewritten; no automatic deletion — a plan is archived or deleted from its page (delete asks for confirmation); recorded questions are read-only | ✅ Resolved |
| 29 | Security & compliance | Data protection and input handling | confirm (single viable option; Markdown rendering would need a library and another review) | User confirmed: data directory 0700, files 0600, atomic writes (temp file + rename); CSP `script-src 'self'`, `style-src 'self'` + per-request nonce for Fluent's runtime styles, `connect-src 'self'`, no remote assets; question text rendered as plain text with inline code and line breaks (no Markdown/HTML); request bodies capped at 256 KB and schema-validated; error responses carry no internals | ✅ Resolved |
| 30 | Edge cases | Port taken by another program, Discovery crashed | fall back + notice / fall back to chat | User accepted recommendation: when 4747 is taken, this process listens on an OS-assigned port and the link says so; chat fallback only when no listener can start; no background retry loop; after an OpenCode restart, open pages show "Discovery restarted — reload" and reconnect automatically | ✅ Resolved |
| 31 | UX & presentation | When the browser opens | only if not open / link only / always open | User accepted recommendation: the publish tool returns the plan's link and the agent shows it in chat; the plugin opens the browser only when no tab currently has that plan open; otherwise the open tab updates live | ✅ Resolved |
| 32 | UX & presentation | Browser support and accessibility | evergreen + OS theme / light theme only | User accepted recommendation: current Chrome, Edge, Firefox, Safari; Fluent keyboard and screen-reader support, labelled fields, visible focus, announced save/submit results; light and dark theme following the OS; English only | ✅ Resolved |
| 33 | Non-functional | Testing strategy, including the web page | confirm (single viable option within the exhausted review budget) | User confirmed: `node --test` spec/impl tests for rules, storage, server (real listener on an ephemeral port: CSP + nonce, Host/Origin checks, MIME types, 127.0.0.1 bind), agent tools (fake plugin context), and pure UI view-model modules; `react-dom/server` render smoke tests of every view; a build test (temp dir, no remote URLs, size budget); a pack test (assets in the tarball); a manual browser checklist run once by the user; no Playwright/jsdom/vitest | ✅ Resolved |
| 34 | Naming & terminology | Names of modules, tools, commands, settings, paths | use these / user names | User accepted: `plans/discovery/`, roadmap `REQ-DISCOVERY`; `bin/lib/discovery-rules.mjs`, `discovery-store.mjs`, `discovery-server.mjs`, `discovery-tools.mjs` (+ `.d.mts`); UI source `discovery-ui/` (own tsconfig) built by `scripts/build-discovery-ui.mjs` (`npm run build:discovery`) into `discovery-ui/dist/`; tools `codeops_discovery_publish` / `codeops_discovery_answers` / `codeops_discovery_resolve`; settings `discovery.enabled`, `discovery.chatMaxQuestions` (default 3); env `CODEOPS_DISCOVERY_PORT`; data `~/.local/share/opencode/codeops/discovery/` (honours `CODEOPS_DATA_DIR`); protocol `_shared/discovery.md`; question keys `DQ-<n>` per plan, `PF-NNN` for preflight | ✅ Resolved |
| 35 | Integration points | `analyze-project --with-discovery` when `codeops/codeops.json` is absent | create minimal file / refuse | User accepted recommendation: show, then write `{schema: 1, mode: "strict", artifacts: {layout: detected, root: "codeops" nested / "." flat}, discovery: {enabled: true}}`; `strict` equals the defaults applied when the file is missing (`_shared/quality-profile.md` §Parsing, absence, and ownership); no code reads `artifacts.root` today | ✅ Resolved |
| 36 | Technical (complexity escalation) | UI stack for a multi-view web app (user: separate project/plan views; "use the fluentui skill and create a great UI"; `@blendsdk/fluentui-react-components` "if need be") | simplified Fluent / Fluent + blendsdk / plain HTML | User: **simplified Fluent** — React 19 + `@fluentui/react-components` v9 + `@fluentui/react-icons`, bundled with esbuild, hash routing (`#/` → `#/p/:project` → `#/p/:project/:plan`); no `@blendsdk/fluentui-react-components`, react-hook-form, router library, Vite, or browser test harness (full evidence: AR-36 note) | ✅ Resolved |
| 37 | Technical unknowns | How the built UI bundle reaches the npm package | build at publish / commit with freshness test | User: build at publish — produced by the prepack/release step, gitignored; a test checks it builds, has no remote URLs, and stays under a size budget; a git checkout needs one local build | ✅ Resolved |
| 38 | Integration points | Which `make-plan` questions go to the page | interview + register / register review only | User accepted recommendation: the Phase 1.1 interview and the Phase 1C register review go to Discovery as groups by category (scope first); complexity escalations and rounds at or under the chat cutoff stay in chat; questions that surface while writing documents go to chat when within the cutoff, otherwise to a new group | ✅ Resolved |
| 39 | Integration points | How `preflight` uses the page | all findings by severity / Critical + Major only | User accepted recommendation: findings published as a plan of kind `preflight`, grouped Critical, Major, Minor, Observation; each finding's options become choices with the recommendation badge; keys `PF-NNN`; the challenger still runs before publishing; answers are written back into the preflight report; groups replace the 5–8-per-batch pacing | ✅ Resolved |
| 40 | Behavioral | The session that owns a plan has been deleted | next session adopts / ask before adopting | User accepted recommendation: the plan page says "The session that asked these questions has ended — your answers are saved."; the next session that publishes or reads answers for that plan becomes the owner without asking and receives undelivered submissions | ✅ Resolved |
| 41 | Behavioral | Answering a project that is not open in OpenCode | yes, deliver later / read-only | User accepted recommendation: the projects page lists every project from the data directory; answering and Submit work; delivery waits until OpenCode is next open in that project | ✅ Resolved |
| 42 | Behavioral | Submitting a group that still has "Needs discussion" questions | yes, they stay open / no | User accepted recommendation: a group can be submitted once every visible question is answered, deferred, or marked "Needs discussion"; discussion items stay open and can be submitted later | ✅ Resolved |
| 43 | UX & presentation | How a group waiting on `dependsOn` is shown | visible read-only / hidden | User accepted recommendation: shown read-only with "Unlocks after <group> is submitted" | ✅ Resolved |
| 44 | Non-functional | Size budget the bundle test enforces | 1 MB minified JS / no limit | User accepted recommendation: the build test fails above 1 MB of minified JavaScript | ✅ Resolved |
| 45 | Behavioral | When switching discovery on or off takes effect | immediately / after restart | User accepted recommendation: immediately — the plugin re-checks the setting at the start of each request and adds or removes its tools when it changes | ✅ Resolved |
| 46 | Edge cases | Two OpenCode processes (e.g. the service plus `opencode --standalone`) using Discovery at the same time: shared data files and waking a session owned by the other process | re-read + deliver later / lock with one writer | User accepted recommendation: every change re-reads the plan file just before an atomic write; a process wakes only sessions it hosts — refined by AD-63(d): `session.get` is a reachability check and assumption F measures the cross-process case; a submission for a session in the other process waits until that process's next Discovery tool call or restart; live waking is guaranteed with one OpenCode process per project | ✅ Resolved |
| 47 | Behavioral | What "Submit all answered" submits when some groups are not ready | submit ready groups / only when all ready | User accepted recommendation: submits every unlocked group that is ready, in one submission; groups that are not ready stay open and the confirmation lists them with what is missing | ✅ Resolved |
| 48 | Integration points | When the listener starts: when an opted-in project's plugin instance loads, or at the first publish | when the project loads / at first publish | User accepted recommendation: as soon as OpenCode loads the plugin for an opted-in project (or the project becomes opted in, AR-45), so the bookmarked URL works whenever OpenCode is open in any opted-in project | ✅ Resolved |
| 49 | Edge cases | Which saves count as stale, and two browser tabs editing the same plan | only changed questions / any older revision | User accepted recommendation: a save made against an older plan revision is rejected only when that question changed since then; saves to unchanged questions go through; between two tabs the latest save per question wins and the other tab updates live | ✅ Resolved |
| 50 | Behavioral | Whether an implied answer can itself imply further answers (chained implications) | no chaining / chain them | User accepted recommendation: no chaining — implications fire only from answers the user gave, in one pass; the agent declares direct implications when it wants them | ✅ Resolved |
| 51 | Behavioral | What happens to the answer of a question that becomes hidden by `showIf` | keep, don't submit / clear it | User accepted recommendation: the answer is kept but not submitted or counted while hidden; it reappears when the question becomes visible again | ✅ Resolved |
| 52 | Behavioral | Whether a submitted (not yet recorded) answer can still be edited | read-only / editable and resubmit | User accepted recommendation: submitted answers are read-only; corrections go through chat or a follow-up question | ✅ Resolved |
| 53 | Behavioral | What happens when the agent republishes an archived plan | republish unarchives / refuse | User accepted recommendation: the plan becomes active again with the new questions, and the page notes it was unarchived | ✅ Resolved |
| 54 | Data & state | Store internals: data-directory layout, project and plan slugs, file schema, merge, ownership, delivery claim, write serialization | per-plan files / single database file / index file | AI — delegated by --auto-design (note AD-54) | ✅ Resolved |
| 55 | Integration points | Server internals: request pipeline, endpoint and status-code contract, CSP and nonce, static assets, live-event contract, viewer tracking | REST-style JSON + SSE per plan / single RPC endpoint / polling | AI — delegated by --auto-design (note AD-55) | ✅ Resolved |
| 56 | Integration points | Agent tool contracts: input/output schemas, failure reasons, wake text, delivery points | coarse tools with typed reasons / free-text results | AI — delegated by --auto-design (note AD-56) | ✅ Resolved |
| 57 | Technical unknowns | Plugin wiring: opt-in check and tool reload, listener lifecycle, project registration, hosted-session check, browser opener | context-hook check + reload / restart-only / file watcher | AI — delegated by --auto-design (note AD-57) | ✅ Resolved |
| 58 | Technical unknowns | UI internals: source layout, pure view-model modules, component structure, Fluent patterns, nonce wiring, theme, autosave, build script | thin React over pure modules / stateful components | AI — delegated by --auto-design (note AD-58) | ✅ Resolved |
| 59 | Non-functional | Test mechanics within AR-33: render smoke through an esbuild-built temp module, fake plugin contexts, real listener on port 0, isolated data directories | as listed / jsdom | AI — delegated by --auto-design (note AD-59) | ✅ Resolved |
| 60 | Feature gaps | Specialist-gap check outcome | none new; existing `agent-pipeline-reviewer` for Phase 7 / propose a UI specialist | AI — delegated by --auto-design (note AD-60) | ✅ Resolved |
| 61 | Technical unknowns | Phase decomposition and sequencing | 8 phases, spike first, rules → store → server → plugin → UI → skills → docs/E2E | AI — delegated by --auto-design (note AD-61) | ✅ Resolved |
| 62 | Integration points | Skill protocol mechanics: how make-plan and preflight map questions and findings onto the page and back, and how `analyze-project` edits the config and the managed line | as in note AD-62 / new rule features | AI — delegated by --auto-design (note AD-62) | ✅ Resolved |
| 63 | Behavioral | Readiness guard, full-republish rule, and delivery claim semantics surfaced by the preflight audit | keep the guard + `nothing-to-submit` reason / remove it; full-set publish / retire on omission; one prompt per plan with claim-then-prompt / per-submission prompts | AI — delegated by --auto-design (note AD-63) | ✅ Resolved |

### Resolution Notes

**Rows 1–16 (user decisions, this conversation, 2026-10-22).** The design was developed in
conversation before `make-plan` started. The user rejected the Markdown sheet (row 1), set the
local-only boundary (row 2), proposed the standalone Discovery application with CRUD APIs and an
SDK, and required opt-in (row 13). The remaining rows were presented as a consolidated decision
table with recommendations, and the user answered "LGTM", then "proceed" — recorded as bulk
acceptance of those recommendations. Bulk acceptance did not approve row 3; it was decided
separately on its own Complexity Escalation Gate packet.

**AR-3 — complexity escalation (Discovery runtime).**
```text
Original goal: answer CodeOps discovery questions in a browser (typed answers, choices, rules that
  hide or settle other questions), centralized per project/plan/session; the agent continues on
  Submit without typing; local only; opt-in; the Ambiguity Register stays the record.
Extra system or support code: a standalone Discovery service — its own long-running process with
  auto-start and start/stop/status CLI, a generic CRUD API (projects → plans → groups → questions),
  an SDK, a plugin↔service event stream with reconnect and exactly-once delivery claims, a central
  project registry, and version-skew checks.
Why it may be needed: answering while OpenCode is not running from a bookmarked URL; one durable
  inbox across projects; possible use by other agents; matches the user's sketch.
Evidence: waking the agent is only possible from a live plugin instance (`ctx.session.prompt`,
  @opencode/plugin 2.0.26 SessionDomain); OpenCode loads one plugin instance per location
  (`ctx.location.directory`, plugin/index.ts:222); plugins cannot register routes on OpenCode's own
  server; precedent `codeops_progress` tool with feature detection (plugin/index.ts:428-438);
  `codeops/codeops.json` re-read per use (plugin/index.ts:161).
Smallest solution that still works: serve the page from inside the plugin in the OpenCode background
  service (one listener, fixed port, separate project and plan views), JSON in the data directory,
  direct wake on Submit with a status field preventing double delivery; page endpoints only.
Extra cost: ~1,500–2,000 more lines incl. tests, 2–3 more phases, and a permanent second runtime to
  keep in sync (event stream, reconnect, delivery claims, version checks exist only to bridge it).
Independent verdict: Unnecessary — the extra machinery mostly patches the split between two
  processes; CRUD and SDK each serve a single in-repo consumer; justified only if answering while
  OpenCode is down is required.
Direct user decision: revised — the smaller in-plugin design with a fixed port and separate project
  and plan pages (question tool, 2026-10-22).
```

**AR-36 — complexity escalation (UI stack).**
```text
Original goal: a polished Discovery web UI with separate views (project list → a project's plans →
  a plan's question groups), built with Fluent UI per the user's instruction.
Extra system or support code: React 19 + @fluentui/react-components v9 + @fluentui/react-icons
  (optionally @blendsdk/fluentui-react-components with react-hook-form), a bundler, a second
  tsconfig, a built bundle shipped in the npm package.
Why it may be needed: the user asked for Fluent UI and a great UI; Fluent provides accessible radio
  groups, checkboxes, dialogs, and message bars that a hand-written page would re-create.
Evidence: the only runtime dependency is @opencode/plugin (package.json:71-73); no web build
  exists; build precedent scripts/build-tui.mjs → committed plugin/tui.js with a freshness test;
  tsconfig.json targets Solid JSX (jsxImportSource @opentui/solid); @blendsdk/fluentui-react-components
  0.3.0 peers on react ^19, react-hook-form ^7.55, @fluentui/react-datepicker-compat and engines
  node >=22 (its packages/react-components/package.json).
Smallest solution that still works: plain HTML/CSS/vanilla JS views with hash routing and a
  hand-maintained Fluent-like token stylesheet; no build, no dependencies.
Extra cost: ~5 devDependencies, an esbuild build script, a few hundred KB of bundled JavaScript in
  the package, per-request CSP nonces for Fluent's runtime styles, a second tsconfig; no new runtime
  dependency (everything is bundled).
Independent verdict: Simplify — React 19 + Fluent v9 + icons bundled with esbuild and hash routing;
  drop @blendsdk/fluentui-react-components (its react-hook-form layer competes with the rules engine
  and autosave; node >=22; pre-1.0; nothing needed that core Fluent lacks), Vite, a router library,
  and browser test harnesses; behaviour in pure modules tested with node --test; react-dom/server
  render smoke tests; build at publish time.
Direct user decision: revised — the simplified Fluent stack as the challenger described
  (question tool, 2026-10-22).
```

**Rows 5, 9, 14** were updated as direct consequences of the AR-3 decision; their user-accepted
intent (no typing to continue, coarse agent tools) is unchanged.

**Rows 18–45 (user decisions, 2026-10-22/23).** Presented in five batches through the question
tool with a recommendation each; the user chose every option recorded above. Rows 29 and 33 were
presented as the single viable option (a Markdown renderer or a browser test harness would be new
machinery needing another challenger, and the run's two-challenger budget was spent). On
2026-10-23 the user confirmed the complete register, including the verify command (row 17).

**Rows 46–49 (surfaced during authoring, 2026-10-23).** Found while specifying the store, server,
and plugin wiring; added to the register before any dependent document was written, presented
with recommendations, and decided by the user. Row 48 clarifies the start moment left open by
row 9 ("on first use"). Row 13's accepted proposal also included the managed `AGENTS.md` line
"Discovery: enabled" written by `analyze-project --with-discovery` (conversation, 2026-10-22);
the plan implements it under row 13.

**Rows 50–53 (surfaced during authoring, 2026-10-23).** Found while specifying rule evaluation
and the store; asked before 03-02 and 03-03 were written and decided by the user.

**Note AD-54 — row 54 (store internals).**
```text
Authority: AI — delegated by --auto-design
Eligibility: data structures, persistence, and concurrency mechanisms inside user decisions AR-7,
  AR-8, AR-15, AR-16, AR-22–AR-24, AR-28, AR-40, AR-46, AR-49–AR-53; no retention or ownership
  policy is created.
Objective: durable, isolated, crash-safe plan data that two processes cannot corrupt.
Decision: <data>/discovery/projects/<projectSlug>/project.json and
  .../plans/<planSlug>.json, one file per plan; project slug from the checkout directory name
  (lowercase, non [a-z0-9] → "-", trimmed, ≤40, "-2"… on collision with another directory);
  plan key "<kind>:<artifact>", plan slug from the artifact's last segment plus "-<kind>" for
  non-plan kinds (unless equal), "-2"… on collision; stored lifecycle open|submitted|recorded|
  retired with "answered" derived by the rules module; every mutation goes through one
  per-file in-process queue, re-reads the file, applies the change, and writes a 0600 temp file
  in the same directory followed by rename; directories 0700; schemaVersion > 1 or malformed
  JSON refuses the file and never rewrites it; republish keeps recorded/retired questions as
  they are and returns a warning when a recorded question's content changed ("use a new key");
  submission ids increase per plan; delivery is claimed as claim-then-prompt with `deliveredAt`
  written after the prompt resolves (refined by AD-63(c)).
Evidence: precedent data base path (scripts/codeops_outcomes.py:41-50); rename is atomic within
  one directory on POSIX filesystems; projects are few (manual registration per checkout).
Rejected alternatives: one database file for everything (one corrupt write breaks all
  projects; larger write contention); an index file of projects (second source of truth that
  can disagree with the project files); reusing a recorded question key for a new decision
  (would silently overwrite an audit trail entry).
Strongest counterargument: scanning project files on every list is O(projects); acceptable for
  a local single-user tool and simpler than an index that can drift.
Confidence: High — would change if listing becomes measurably slow (hundreds of projects).
Hardening: forced reframing applied; challenger not required (reversible internal mechanism;
  the run's challenger budget is spent).
Policy version: 1
Root invocation ID: AD-DISC-20261023-1
Reopen triggers: a filesystem without atomic rename in use; lost updates observed between
  processes; list latency complaints.
```

**Note AD-55 — row 55 (server internals).**
```text
Authority: AI — delegated by --auto-design
Eligibility: internal interfaces and security mechanisms implementing the approved policy AR-4
  and AR-29 literally; adds only tightening headers; no new access policy.
Objective: a small, verifiable HTTP surface for the page with the approved local protections.
Decision: pipeline Host allowlist → method/content-type/Origin check for writes → 256 KB cap →
  JSON parse → route; security headers on every response (CSP, nosniff, no-referrer,
  frame-ancestors 'none', no-store on API); no CORS headers. HTML CSP: default-src 'none';
  script-src 'self'; style-src 'self' 'nonce-<16 random bytes>'; connect-src 'self';
  img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'. Static
  assets served only from a file list read at start (no path joins from the URL). Endpoints:
  GET /api/health, GET /api/projects, GET /api/projects/:p, GET /api/projects/:p/plans/:plan,
  PUT …/questions/:key, POST …/submit, POST …/archive, DELETE …/plans/:plan (body
  {confirm:true}), GET …/events (SSE: hello{instanceId,revision}, changed{revision},
  delivered{submissionId}). Errors: {error:<code>, message:<text>} with 400/403/404/409/413/
  415/421/500 and no internals (code list in 03-04 §Request pipeline); resolvePort exported. Open SSE connections per plan count as viewers (AR-31).
Evidence: Fluent/Griffel inserts runtime <style> elements that need a nonce (AR-36 challenger
  finding, microsoft/fluentui PR #26046); EventSource reconnects automatically, which gives the
  restart notice (AR-30) without client retry code.
Rejected alternatives: one RPC endpoint (harder to test per status code); polling (wasteful,
  slower updates); WebSockets (no gain for server→page notifications; more code).
Strongest counterargument: SSE keeps a connection per open tab; negligible locally.
Confidence: High — would change if a target browser blocks localhost SSE.
Hardening: challenger not required (literal implementation of user-approved policy; budget spent).
Policy version: 1
Root invocation ID: AD-DISC-20261023-1
Reopen triggers: CSP blocks Fluent at runtime despite the nonce; a security review finding.
```

**Note AD-56 — row 56 (agent tool contracts).**
```text
Authority: AI — delegated by --auto-design
Eligibility: internal interfaces within AR-14, AR-20, AR-23, AR-27, AR-40.
Objective: tools the agent cannot misuse silently and that never break an agent turn.
Decision: codeops_discovery_publish(input = DiscoveryPublishSchema) → {ok, url, plan, revision,
  opened, fallbackPort, warnings} | {ok:false, reason, …}; codeops_discovery_answers({artifact, kind}) →
  {ok, plan, submissions:[{id, at, questions:[{key, title, answer, source:"user"|"implied",
  impliedBy, overridesImplied, notes, defer, needsDiscussion}]}]}; codeops_discovery_resolve(
  {artifact, kind, recorded:[{key, as}], retire:[key]}) → {ok, recorded, retired}. Failure
  reasons: disabled, unavailable, invalid (with errors), owned (with owner), not-found, error
  (and aborted, only under spike fallback A).
  Every handler is async, validates defensively, and returns a result instead of throwing. Wake
  text: "Discovery: <n> answers submitted for <project> › <plan title> (<group titles>). Read
  them with codeops_discovery_answers." — one message per plan with pending submissions.
  Reading answers claims their submissions as delivered.
Evidence: codeops_progress handler contract (bin/lib/codeops-progress.mjs:537-564).
Rejected alternatives: free-text tool results (the agent would parse prose); one tool with an
  action field (weaker per-action schemas).
Strongest counterargument: three tools add three entries to the tool list; only when opted in.
Confidence: High.
Hardening: challenger not required (reversible interface; budget spent).
Policy version: 1
Root invocation ID: AD-DISC-20261023-1
Reopen triggers: the host rejects the schemas; agents misread the results in the live run.
```

**Note AD-57 — row 57 (plugin wiring).**
```text
Authority: AI — delegated by --auto-design
Eligibility: internal architecture and lifecycle implementing AR-9, AR-13, AR-31, AR-40, AR-45,
  AR-46, AR-48.
Objective: off means exactly as today; on means the listener and tools exist for every opted-in
  project in the process.
Decision: a context-hook check reads codeops/codeops.json per request (like readRoutingConfig);
  on a change it starts or reuses the shared listener, registers or unregisters the project, and
  calls ctx.tool.reload(); the tools' transform adds them only while the project is enabled; the
  listener closes when no opted-in project remains registered in the process. Project
  registration records directory, branch (git rev-parse --abbrev-ref HEAD; "detached" for HEAD),
  and repository {id, canonical} from ctx.location.project. A session counts as hosted when
  ctx.session.get({sessionID}) succeeds. Delivery claims first, then prompts; a failed prompt
  releases the claim so the next delivery point retries. session.deleted marks that session's
  plans orphaned.
  Browser opener: execFile without a shell — xdg-open (Linux), open (macOS), cmd /c start ""
  (Windows) — detached, output ignored, failures reported as opened:false; injectable for tests.
Evidence: plugin/index.ts:161-167 (per-request config read), :251-263 (session.deleted),
  ctx.tool.reload and ctx.session.get in the V2 plugin docs.
Rejected alternatives: restart-only switching (contradicts AR-45); a file watcher (new
  machinery, timers); a shell for the opener (injection risk).
Strongest counterargument: a config read per request costs one small file read; already done.
Confidence: Med-High — spike E decides whether reload affects the same or the next request.
Hardening: challenger not required (reversible; budget spent).
Policy version: 1
Root invocation ID: AD-DISC-20261023-1
Reopen triggers: spike B/C/E outcomes; host lacks ctx.session.get.
```

**Note AD-58 — row 58 (UI internals).**
```text
Authority: AI — delegated by --auto-design
Eligibility: internal architecture of the approved stack AR-36 implementing user decisions
  AR-22, AR-24–AR-26, AR-30–AR-32, AR-42, AR-43, AR-47, AR-49–AR-53.
Objective: a coherent Fluent UI app whose behaviour is testable without a browser.
Decision: discovery-ui/{index.html, tsconfig.json, src/}; pure modules route.ts, api.ts,
  view-models.ts hold all derivations (via bin/lib/discovery-rules.mjs); thin React views
  ProjectsPage, ProjectPage, PlanPage, GroupSection, QuestionCard, DeferFields, SubmitDialog,
  ConnectionBanner; hooks useHashRoute and usePlanEvents; main.tsx builds a Griffel DOM renderer
  with the nonce from <meta name="csp-nonce"> inside RendererProvider → FluentProvider with
  webLightTheme/webDarkTheme following prefers-color-scheme; fluentui-design patterns PAT-001
  (application shell), PAT-002 (list page), PAT-004 (form page); choices save immediately, text
  saves after 500 ms idle and on blur; results announced through an aria-live region;
  scripts/build-discovery-ui.mjs bundles src/main.tsx with esbuild (ESM, minified, es2022,
  production) into discovery-ui/dist/assets/app.js and copies index.html.
Evidence: fluentui-design skill pattern index; challenger guidance in AR-36 (thin views over pure
  modules, renderToString smoke tests, single Griffel copy).
Rejected alternatives: stateful components holding rule logic (untestable without a DOM);
  Fluent Nav drawer shell (three levels are clearer as a breadcrumb).
Strongest counterargument: a hand-rolled hash route hook needs care with encoding; covered by
  route.ts spec tests.
Confidence: High.
Hardening: challenger not required (reversible; budget spent).
Policy version: 1
Root invocation ID: AD-DISC-20261023-1
Reopen triggers: the manual checklist finds a usability problem; the bundle exceeds the budget.
```

**Note AD-59 — row 59 (test mechanics).**
```text
Authority: AI — delegated by --auto-design
Eligibility: testing strategy inside the user-confirmed AR-33.
Objective: every contract proven at the cheapest sufficient layer with node --test.
Decision: rules/store/view-model tests import the modules directly; store tests use a fresh
  temp data directory per test; server tests start a real listener on port 0 and use fetch;
  plugin tests drive plugin/index.ts setup with a fake context (existing progress-server
  pattern) and an injected opener; render smoke tests bundle a test entry with esbuild into
  $CODEOPS_TMPDIR (fallback os.tmpdir()) and call react-dom/server renderToString; build and
  pack tests call buildDiscoveryUi into a temp dir and npm pack --dry-run --json.
Evidence: existing fake-context tests (plugin/progress-server.spec.test.mjs); Node fetch and
  node:test are available on the toolchain floor (Node ≥22.18).
Rejected alternatives: jsdom or vitest (excluded by AR-33).
Strongest counterargument: renderToString cannot test interaction; the manual checklist covers it.
Confidence: High.
Hardening: challenger not required; budget spent.
Policy version: 1
Root invocation ID: AD-DISC-20261023-1
Reopen triggers: Fluent SSR rendering fails in Node.
```

**Note AD-60 — row 60 (specialist-gap check).**
```text
Authority: AI — delegated by --auto-design
Eligibility: detection outcome within the approved scope; creation is reserved and not requested.
Objective: run the make-plan specialist-gap check and record the outcome.
Decision: no new candidate; the existing agent-pipeline-reviewer reviews Phase 7 because it
  changes the content of the AGENTS.md managed block (AGENTS.md specialist index: required for
  "the AGENTS.md managed blocks").
Evidence: fluentui and fluentui-design skills installed (packets carry them); catalog security
  reviewer with the owasp-web profile covers the listener; no recurring findings in this area.
Rejected alternatives: a standing Fluent UI reviewer (would restate the skills — disqualifier).
Strongest counterargument: UI review quality depends on packets loading the skills; the plan's
  Phase 6 instructions require it.
Confidence: Med-High.
Hardening: challenger not required; budget spent.
Policy version: 1
Root invocation ID: AD-DISC-20261023-1
Reopen triggers: Phase 6 reviews show repeated Fluent findings.
```

**Note AD-61 — row 61 (phase decomposition).**
```text
Authority: AI — delegated by --auto-design
Eligibility: implementation sequencing.
Objective: retire the largest unknowns first and keep every phase independently verifiable.
Decision: 1 spike → 2 rules → 3 store → 4 server → 5 plugin integration + config schema → 6 web
  UI + packaging → 7 skills protocol (agent-pipeline-reviewer) → 8 docs, live end-to-end run,
  manual checklist.
Evidence: dependency order of 03-02…03-07; spike outcomes select fallbacks used from Phase 4 on.
Rejected alternatives: UI first (would build against an unproven runtime).
Strongest counterargument: the UI is the user-visible value and arrives late; the spike and
  core are prerequisites for any working page.
Confidence: High.
Hardening: challenger not required; budget spent.
Policy version: 1
Root invocation ID: AD-DISC-20261023-1
Reopen triggers: a spike fallback that reorders work.
```

**Note AD-62 — row 62 (skill protocol mechanics).**
```text
Authority: AI — delegated by --auto-design
Eligibility: interface and sequencing mechanics implementing user decisions AR-11, AR-13, AR-27,
  AR-35, AR-38, AR-39; no new product behaviour; uses only rule features already decided (AR-26).
Objective: skills publish, read, and record through one protocol without weakening any gate.
Decision: make-plan publishes one Discovery plan per plan folder (kind "plan", artifact = plan
  folder), groups by register category with Scope first, keys DQ-<n>, question types chosen per
  question; preflight publishes kind "preflight" for the audited artifact, groups Critical,
  Major, Minor, Observation (no dependsOn), keys PF-NNN, each finding as "single-other": its
  options as choices plus "Other" free text for a custom decision or a dismissal with reasoning;
  Defer maps to "Accepted Risk" with decision/owner/revisit. After publishing the agent posts one
  line with the link and ends its turn. On wake it calls answers, transcribes (exact text, key,
  source; implied → "implied by <key>, shown and submitted"; overrides noted; Defer → named
  deferral; needs discussion stays open), then resolve. Answers given in chat for published
  questions are recorded the same way and resolved so the page matches. analyze-project
  --with-discovery: refuse an invalid existing codeops/codeops.json; otherwise set
  discovery.enabled true preserving other keys (or create the AR-35 minimal file), preview, write,
  and add "- Discovery: enabled — question rounds open in the local Discovery page" to the
  CODEOPS-PROJECT managed block; --without-discovery sets enabled false (keeping
  chatMaxQuestions) and removes the line; both flags together are a usage error.
Evidence: skills/preflight/report-format.md:109-155 (decision forms: choose, dismiss, accepted
  risk); skills/analyze-project/SKILL.md:15-29; _shared/quality-profile.md (invalid structured
  configuration is a readiness blocker).
Rejected alternatives: a dedicated "dismiss" rule feature (new behaviour beyond AR-26); one
  Discovery plan per make-plan round (fragments one plan's questions across pages).
Strongest counterargument: dismissals as "Other" text rely on the user writing a reason; the
  skill asks again in chat when the text gives none.
Confidence: Med-High — the live run may show agents need tighter wording.
Hardening: challenger not required (reversible protocol text; budget spent).
Policy version: 1
Root invocation ID: AD-DISC-20261023-1
Reopen triggers: the live run shows mis-transcription or skipped gates.
```

**Preflight addenda (2026-10-23).** PF-006 refines AD-54: the per-file queue is process-wide,
keyed by absolute file path. PF-001 refines AD-54: a publish is the full question set and
submitted questions are retained until recorded. PF-002 refines AD-57: `session.get` is a
reachability check, and Phase 1 assumption F measures the cross-process case. PF-012 refines
AD-56 and AD-57: one claim-then-prompt per plan, `deliveredAt` written after the prompt resolves,
and `deliver` returns `"woken" | "pending" | "failed"`. PF-005 refines AD-57: `dispose()` runs
from the plugin cleanup and unregisters only its own registration.

**Implementation note on AR-36.** The approved React stack is written in TypeScript, so its
dev-only type packages `@types/react` and `@types/react-dom` come with it (02 §External
Dependencies). They add no runtime code or build machinery beyond the approved packet.

**Note AD-63 — row 63 (preflight clarifications).**
```text
Authority: AI — delegated by --auto-design
Eligibility: mechanisms and spec precision inside AR-5, AR-24, AR-42, AR-46, AR-52; the user's
  AR-42 intent (a submission always carries something) is kept, not changed.
Objective: remove the preflight ambiguities without weakening a gate or adding support machinery.
Decision: (a) a group stays unready while every pending question is "needs discussion", and
  `missing` carries one `nothing-to-submit` entry; (b) a publish is the plan's full question set,
  submitted questions are kept (with a warning) until recorded, and a changed question `type` is
  refused ("use a new key"); (c) delivery is one claim-then-prompt per plan, `deliveredAt` is
  written only after the prompt resolves, and dead-pid claims are released at store creation;
  (d) `session.get` is a reachability check; Phase 1 assumption F measures the cross-process case
  and its pre-agreed fallback keeps the wake pending rather than dropping it.
Evidence: PF-001, PF-002, PF-012, PF-017 in 00-preflight-report.md; 03-02 §groupReadiness;
  03-03 §Transitions; 03-04 §Runtime API; 03-05 §Waking and delivery.
Rejected alternatives: removing the readiness guard (an empty wake, against AR-47's intent);
  retiring submitted questions (loses a decision the user already gave); pid-based owner tracking
  (weak liveness signals, new persisted state) for (d).
Strongest counterargument: the readiness guard is a behaviour AR-42 does not spell out, so a
  literal reader may call it scope creep; it is recorded here as a clarification, not a change.
Confidence: High.
Hardening: challenger reviewed the related findings (H-1, H-2, H-12, H-13).
Policy version: 1
Root invocation ID: PF-DISC-20261023-1
Reopen triggers: assumption F shows a second process can safely prompt the first process's
  sessions; the live run reports an empty-wake complaint.
```
