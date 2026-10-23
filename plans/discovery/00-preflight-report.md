# Preflight Report: discovery — Iteration 1

> **Status**: ✅ PASSED — all 34 findings resolved (1 critical, 11 major, 20 minor, 2 observation); fixes applied and verified in iterations 2–3
> **Iteration**: 3 (fix verification and bounded re-scans)
> **Artifact**: implementation plan at `plans/discovery/` (13 documents)
> **Audit target**: `plans/discovery/**` · **Scope mode**: strict
> **Context documents** (evidence only, not audited): repository source, `AGENTS.md`, `skills/`,
> `_shared/`, `scripts/`, `plugin/`, `bin/lib/`, `schemas/`, `package.json`, `tsconfig.json`,
> `CHANGELOG.md`, `README.md`, `.github/workflows/`, installed `@opencode/*` 2.0.26 declarations
> **Modification set**: the audit target only. One finding (PF-007) would need an explicit
> expansion to `scripts/exec-plan-progress-content.spec.test.mjs`; it is reserved for the user.
> **Codebase grounded**: 24 source/test/config files examined in the repository, plus 6 installed
> host type declarations; 61 plan references mapped, 55 verified, 6 corrected (see PF-022).
> **Delegated authority**: `--auto-design` active — root invocation ID `PF-DISC-20261023-1`,
> policy version 1. `--auto-commit` is not a preflight option; the user authorized the fixes and
> the commit after the two reserved rulings, and the commit follows verification.
> **Last Updated**: 2026-10-23

**Same-agent bias note:** the artifact was created in an earlier session, not this one, but by the
same model family. Independent challenger used for every critical/major finding (single batch).

## Codebase Context Summary

**Tech stack:** Node ESM plugin (TypeScript entry `plugin/index.ts`, framework-free `bin/lib/*.mjs`
helpers with `.d.mts`), `node --test`, TypeScript 5, Node engines `>=18`, CI Node 24.
**Architecture:** one `Plugin.define` per location; per-request config read; host features are
feature-detected and failures are content-free warnings; helper modules are host-free so tests can
exercise them directly.

**Key files examined:** `plugin/index.ts`, `bin/lib/codeops-progress.mjs`, `bin/install-skills.mjs`,
`bin/` test layout, `plugin/progress-server.spec.test.mjs`, `plugin/tui-foundation.spec.test.mjs`,
`scripts/release.mjs`, `scripts/exec-plan-progress-content.spec.test.mjs`, `scripts/codeops_outcomes.py`,
`package.json`, `tsconfig.json`, `.gitignore`, `.github/workflows/{ci,release}.yml`, `CHANGELOG.md`,
`README.md`, `skills/{make-plan,preflight,analyze-project}/…`, `_shared/zero-ambiguity-gate.md`,
`schemas/codeops-config.schema.json`, and `@opencode/{plugin,schema,client}` 2.0.26 declarations.

**Verified host facts:** `ToolContext` adds `signal` (`plugin/dist/promise/tool.d.ts:11-14`);
`ToolDomain` has `transform`/`reload`/`list`; `SessionDomain` includes `get`/`prompt`; `SessionPromptInput`
has top-level `delivery` and `resume` (`client/.../types.d.ts:5527+`); `SessionInfo` carries `projectID`
and `location` but no hosting-process identity (`:2836-2862`); `ctx.location` is `{directory, project{id,
directory, canonical}}`; `ctx.vcs` exists.

## Summary by Dimension

| # | Dimension | Findings | Highest |
|---|---|---|---|
| 1 | Ambiguities | 4 | 🔴 |
| 2 | Implicit Assumptions | 3 | 🟠 |
| 3 | Logical Contradictions | 6 | 🟠 |
| 4 | Completeness Gaps | 2 | 🟡 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 6 | 🟠 |
| 8 | Security Blind Spots | 2 | 🟡 |
| 9 | Edge Cases | 3 | 🟠 |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 2 | 🟠 |
| 12 | Consistency | 2 | 🟡 |
| 13 | Codebase Alignment | 4 | 🟠 |

Domain lenses applied: **web application**, **distributed and concurrent** (two processes, shared
files, delivery claims), **data and migration** (`schemaVersion`, refusal, no migration of v1 data).
Compiler/language, financial-system lenses not applicable.

## Summary by Severity

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 1 | 1 resolved |
| MAJOR | 11 | 11 resolved |
| MINOR | 20 | 20 resolved (2 by user ruling) |
| OBSERVATION | 2 | 2 resolved |

---

## Delegation record (shared provenance)

All resolutions marked `AI — delegated by --auto-design` below share the following, per
`_shared/auto-design.md` policy version 1:

- **Authority:** AI — delegated by `--auto-design`, root invocation ID `PF-DISC-20261023-1`.
- **Eligibility boundary:** implementation mechanisms, internal interfaces, spec precision, and
  test mechanics inside the user-confirmed scope (AR-1…AR-53); no product behaviour, scope,
  retention, ownership policy, or acceptance criterion is changed. PF-007 and PF-017 are reserved
  and carry no delegated marker.
- **Objective:** an executable plan whose spec tests, contracts, and codebase references agree.
- **Evidence base:** this report's Codebase Context Summary.
- **Hardening:** layered reframing applied; one blind challenger received the whole
  critical/major batch without the lead's picks (`Challenger: converged` unless a finding says
  otherwise). No finding waives risk.
- **Policy version:** 1 · **Root invocation ID:** `PF-DISC-20261023-1`.

---

# Findings

## 🔴 CRITICAL

### PF-001: A partial republish silently retires answered and submitted questions 🔴 CRITICAL

**Dimension:** 1 Ambiguities (also 4, 9)
**Location:** `03-03-store.md` §Transitions `publish`; `03-07-skills-and-docs.md` item 8; `07-testing-strategy.md` ST-12, ST-18; `03-02-rules-and-model.md` §Functions
**Codebase evidence:** not applicable (plan-internal contract). The contradiction is between
`03-03:108` ("keys missing from the payload → `retired` unless recorded"; no rule for `submitted`),
`03-03:113` (`readAnswers` returns only submissions whose questions are still `submitted`), and
`03-07:62` ("republish the same artifact with new questions").

**The Problem:** Two defects with one root cause — the publish merge is written as if every publish
carried the whole plan, while the protocol invites incremental republishing.
1. `03-07` item 8 tells the agent to republish "with new questions". Taken literally, every earlier
   question is omitted, so every `open` answer and every `submitted`-but-unrecorded answer becomes
   `retired`. Retired questions are excluded from `readAnswers`, so the user's decision never
   reaches the Ambiguity Register. This is silent loss of an authoritative decision in the normal
   follow-up flow.
2. A `submitted` question whose content changed has no merge rule at all, and `questionFingerprint`
   never lists its fields. A kept answer can also become invalid for a changed question type
   (`{choice:"no"}` on a question that became `text`), and `reconfirm` only clears `changed`.

**Options:**
| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Require a full republish; treat `submitted` exactly like `recorded` (never retired by omission, kept with a warning when content changed); list the fingerprint fields (`type`, `title`, `why`, `evidence`, option `id`/`label`/`description`, `recommendation`); reject a `type` change on republish ("use a new key"); add `baseRevision` to Submit so a republish between render and submit is caught | Keeps AR-24's "removed → retired" intact for open questions, closes the data-loss path, removes all test-author guesswork | Slightly longer protocol text; a type change costs a new key |
| B | Retire submitted questions but return them from `answers` with a `retired` flag | Both ARs hold literally | The agent must handle a new flag; the wake message count and "delivered exactly once" bookkeeping get murkier |

**Recommendation:** Option A. It relies only on decisions already made (AR-5 delivery, AR-24
re-confirm, AR-52 submitted answers are frozen) and eliminates a silent data-loss path.

**User Decision:** AI — delegated by `--auto-design` · Eligibility: publish-merge mechanism inside AR-5/AR-24/AR-52 · Decision: A · Rejected: B (new flag and count semantics) · Counterargument: a type change forces a re-ask, more churn than a re-confirmable answer · Confidence: High · Hardening: `Challenger: diverged — rated MAJOR and preferred rejecting the type change rather than dropping the answer` (adopted; the challenger's variant is Option A) · Reopen: an agent cannot resend all questions without exceeding the 200-question cap.

## 🟠 MAJOR

### PF-002: "Hosted" is asserted, not observable — AR-46's invariant is unproven

**Dimension:** 2 Implicit Assumptions
**Location:** `03-05-plugin-integration.md` §Waking and delivery (`:92`); `03-01-host-spike.md` §Assumptions; AR-46
**Codebase evidence:** `SessionInfo` carries `projectID` and `location` but nothing identifying the
process that runs the session (`@opencode/client/.../types.d.ts:2836-2862`); `session.get`/`prompt`
are client RPCs into the shared service (`plugin/dist/promise/session.d.ts:143`); the session store
is one file, `~/.local/share/opencode/opencode.db`, shared by the service and `--standalone`.

**The Problem:** `ctx.session.get({sessionID})` resolving proves the session row exists, not that
this process hosts it. AR-46 requires "a process wakes only sessions it hosts". None of assumptions
A–E measures the cross-process case, and `03-01` claims no re-planning is needed, so the executor
would ship an invariant it cannot verify — either waking a session another process is running, or
marking a submission delivered into an inbox nobody drains.

**Options:**
| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add assumption F to the spike (second process: does `get`/`prompt` for the first process's session succeed?), pre-agree the fallback in `03-01`, and keep `session.get` + the pending-retry path | Cheap, follows the existing spike pattern, no new state | The fallback wording depends on the measurement |
| B | Record the owning process in the plan (`owner: {sessionID, instanceId, pid, at}`) and deliver only there or when that process is provably gone | Implements AR-46 literally | New persisted state, weak liveness signals (PID reuse), more adoption edge cases |

**Recommendation:** Option A. Option B's liveness signals are unreliable and the two-process case is
already an accepted low-risk edge (AR-46); measure first, then decide. Reject `session.active()`:
it would disable the idle-session wake, which is the main case.

**User Decision:** AI — delegated by `--auto-design` · Eligibility: host-behaviour measurement and pre-agreed fallback (AR-19 pattern) · Decision: A · Rejected: B (unreliable liveness, new state); `active()` (breaks idle wake) · Counterargument: the spike may be inconclusive, leaving the invariant still unproven · Confidence: Med · Hardening: `Challenger: diverged — rejected directory-equality and recommended measuring first` (adopted) · Reopen: assumption F shows a second process can prompt another process's session.

### PF-003: The UI has no seam that `renderToString` can exercise

**Dimension:** 7 Testability (also 6)
**Location:** `07-testing-strategy.md` ST-51, ST-52; `03-06-web-ui.md` §Data flow, §CSP nonce, §Proposed Changes
**Codebase evidence:** plan-internal, verified against React semantics: `renderToString` runs no
effects and renders a Suspense fallback instead of waiting; Node has no `window`, `document`, or
`matchMedia`.

**The Problem:** ST-51 requires the plan title, a question title, `Recommended`, the group title, and
`Submit group` in the server-rendered HTML at `#/p/my-repo/billing`, but PlanPage loads its data in an
effect, `useHashRoute` reads `window.location`, and `useSystemTheme` reads `matchMedia` during render.
The seam ST-51 calls "injected fixture API" is never defined, and an async API cannot help. ST-52
additionally loads `renderer.ts` in Node, where `createDOMRenderer(document, …)` throws.

**Options:**
| Option | Description | Pros | Cons |
|---|---|---|---|
| A | `App({ route, api, initial })` props; pure presentational views render from `initial`; browser-only hooks live in `main.tsx` or behind `typeof window`; `createAppRenderer(nonce, doc = globalThis.document)`; ST-51 passes initial data and an explicit route | Deterministic, matches AD-58 "thin views over pure modules", fixes both ST-51 and ST-52 | One more prop path to keep aligned with the fetch path |
| B | Narrow ST-51 to shell/loading states | No design change | Stops proving the plan view renders |

**Recommendation:** Option A, with both paths rendering the same `planView` output so they cannot drift.

**User Decision:** AI — delegated by `--auto-design` · Eligibility: internal UI architecture inside AD-58/AR-36 · Decision: A · Rejected: B (weaker oracle); `prerenderToNodeStream` + `use()` (larger design change) · Counterargument: an `initial` prop duplicates the data path · Confidence: High · Hardening: `Challenger: converged` · Reopen: the manual checklist finds a rendering difference between the SSR and browser paths.

### PF-004: Runtime and store construction, and the plugin test seam, are unspecified

**Dimension:** 7 Testability (also 2)
**Location:** `03-05-plugin-integration.md` §Code Examples, §Opt-in check; `03-04-server.md` §Runtime API; `07-testing-strategy.md` §Testing Overview, ST-27, ST-37, ST-41…ST-47
**Codebase evidence:** `plugin/index.ts:221-222` — `setup(ctx)` takes only `ctx`; `plugin/progress-server.spec.test.mjs:117-142` — the existing fake context has only `location.directory`, no `project`, `session.get/prompt`, or `tool.reload`; `03-04:51-52` — `resolvePort` accepts 1–65535 only, so port 0 is unreachable.

**The Problem:** The example passes `{ directory, store, runtime }` without saying where `store`,
`runtime`, `assetsDir`, or `version` come from; no Phase 5 task creates them. `getDiscoveryRuntime`
is first-call-wins, so `node --test` cases in one file inherit the first case's store, data
directory, asset directory, and port. Tests therefore cannot get the "fresh temp data directory /
port 0 / injected opener" that `07:17-19` promises, and ST-33's "no `dist/`" case cannot coexist
with a suite that already started a listener. ST-43's "opener called once" would launch `xdg-open`
for real. The suite also depends on whether the developer's OpenCode holds 4747.

**Options:**
| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Specify: store/runtime created lazily on first enable from `resolveDataDir(process.env)`, `join(PACKAGE_ROOT,"discovery-ui","dist")`, `packageVersion`; export `createDiscoveryRuntime(options)` with `getDiscoveryRuntime` as the `globalThis` wrapper; tests pre-create with `port: 0` + temp store and set `CODEOPS_DATA_DIR`; ST-43 drives `registerDiscoveryTools` directly with an injected opener | Hermetic, matches the existing fake-context pattern, no production cost | A slightly wider exported surface |
| B | Let `resolvePort` accept `"0"` | Small | Changes a user-facing contract (AR-21) and still leaves the singleton unresettable |

**Recommendation:** Option A (injection over a reset hook — no order-dependent global state).

**User Decision:** AI — delegated by `--auto-design` · Eligibility: construction seam, testing mechanics inside AD-59/AR-33 · Decision: A · Rejected: B (contract change, incomplete) · Counterargument: a factory widens the public module surface · Confidence: High · Hardening: `Challenger: converged` · Reopen: the host exposes a plugin-level injection point that makes a factory unnecessary.

### PF-005: Listener lifecycle and plugin cleanup are incomplete

**Dimension:** 9 Edge Cases
**Location:** `03-04-server.md` §Runtime API; `03-05-plugin-integration.md` §Opt-in check, §Proposed Changes, §Code Examples; `plugin/index.ts:251-263`, `:445-447`
**Codebase evidence:** the `session.deleted` loop is created at `:251-263`, before the tool blocks
(`:428-438`); the returned cleanup at `:445-447` only aborts the event subscription;
`DiscoveryController.dispose()` is declared but no task or ST case wires it.

**The Problem:** Four lifecycle defects share one root — no owner for the listener's end of life.
1. `onSessionDeleted` cannot see a controller declared later inside `try`; the plan's example would
   not compile as written.
2. Cleanup never unregisters the project or closes the listener, so a reloaded instance keeps a
   `deliver` closure over a dead `ctx`, shows `live`, and `closeIfIdle` never reaches zero.
3. `ensureListening` has no in-flight guard: two projects enabling concurrently make the second bind
   fail with `EADDRINUSE`, fall back to a random port, and leave two listeners.
4. `closeIfIdle` awaits `server.close()` while an SSE stream is open; inside the awaited `context`
   hook that blocks every request in the session.
5. Unregister is keyed by directory only, so a stale cleanup removes a newer registration.

**Options:**
| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Declare `let discovery` before the event loop; call `onSessionDeleted` inside it; cleanup calls `dispose()` (unregister by token, dispose transform, `closeIfIdle`); `ensureListening` shares one in-flight promise; `closeIfIdle` ends SSE responses and closes connections before `close()`; `sync()` does not await the close in the hook | Closes all five, matches the host's disposable transform registration | ~15 extra lines |
| B | Never close the listener; unregister only | Simpler | Contradicts ST-42 ("listener closed") and AR-9's wording |

**Recommendation:** Option A.

**User Decision:** AI — delegated by --auto-design · Eligibility: lifecycle mechanism inside AR-9/AR-48 · Decision: A · Rejected: B (contradicts ST-42) · Counterargument: disposal is optional for a process-lifetime listener, so the only real cost of doing nothing is the dead method and the reload case · Confidence: High · Hardening: `Challenger: diverged — re-rated MINOR`; lead keeps MAJOR because `closeIfIdle` inside an awaited hook can block every request · Reopen: the host disposes plugin instances in a way that makes explicit cleanup unnecessary.

### PF-006: Two store instances in one process have two write queues

**Dimension:** 9 Edge Cases
**Location:** `03-03-store.md` §Durability; `03-04-server.md` §Runtime API; `03-05-plugin-integration.md`; ST-26
**Codebase evidence:** `plugin/index.ts:221-234` — all state is built per plugin instance inside `setup`; `03-03:122-124` places the queue inside a store instance; `03-04:33-34` makes the runtime's store first-call-wins.

**The Problem:** In the normal single-process configuration the page writes through the runtime's
store while the agent's tools write through their instance's store. Both perform read → await →
write, so one update can be lost, and `claimDelivery` racing `readAnswers` can let two callers claim
the same submission (a double wake, breaking R8's "exactly once"). ST-26's "while" cannot pass
deterministically either: with two independent queues either interleaving is legal.

**Options:**
| Option | Description | Pros | Cons |
|---|---|---|---|
| A | One process-wide queue keyed by absolute file path (module-level `Map<path, Promise>`), and every handler uses `runtime.store`; reword ST-26 as sequential | Closes both in-process races; no API change | A module-level map is state, but keyed and bounded by file count |
| B | Synchronous read-modify-write in one tick | No queue at all | Blocks the event loop and duplicates the async API |
| C | Declare one store per process and reword ST-26 | Smallest text change | Leaves the page/tool split unfixed |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design` · Eligibility: concurrency mechanism inside AD-54/AR-46 · Decision: A · Rejected: B (blocking), C (leaves the split) · Counterargument: the interleaving window is a few milliseconds · Confidence: High · Hardening: `Challenger: diverged — re-rated MINOR`; lead keeps MAJOR because the double-delivery case breaks a stated guarantee · Reopen: measured lost updates or double wakes are absent in the live run.

### PF-007: The planned `## Unreleased` entry breaks another feature's oracle, and ST-61 repeats a fixed bug 🟠 MAJOR — RESERVED

**Dimension:** 13 Codebase Alignment (test impact)
**Location:** `03-07-skills-and-docs.md` §`CHANGELOG.md` (`:111-115`); `99-execution-plan.md` 8.1.3 and Phase 8 modification set; `07-testing-strategy.md` ST-61
**Codebase evidence:** `scripts/exec-plan-progress-content.spec.test.mjs:113-140` — when the top
section is `## Unreleased` it requires `### Added`, `codeops_progress`, `sidebar`, `` `./tui` ``,
and `v2.0.26`; `CHANGELOG.md:5` currently starts at `## 2.2.1`. Commit `951346a` moved this same
check from the newest section to the whole document precisely because the release tool regenerates
that section.

**The Problem:** A Discovery-only Unreleased section flips that test into its Unreleased branch and
fails three assertions, so `npm run verify` fails at Phase 8 — after the feature is otherwise done.
Independently, ST-61 ("the top section mentions Discovery") reintroduces the fragility `951346a`
removed: the next release with no `discovery:` commit regenerates a section that does not mention
it. A naive document-wide fix also passes in the red phase, because `CHANGELOG.md:472` already
contains the word "discovery".

**Options:**
| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Phase 8 also amends `scripts/exec-plan-progress-content.spec.test.mjs` (Unreleased branch accepts either feature group and pins the progress facts document-wide), and ST-61 becomes "Unreleased: this entry; released: a `- discovery:` item anywhere" | Keeps the CHANGELOG entry and makes both tests stable across the release fold | Edits another feature's spec oracle; needs the user's explicit scope approval |
| B | No `## Unreleased` entry; rely on the release fold | Zero cross-feature edits | Weakens R16/ST-61 until release, against the AGENTS.md versioning policy |
| C | Shape the Discovery entry to satisfy the old assertions | No edits | Wrong prose; would have to mention `codeops_progress`, `./tui`, `v2.0.26` |

**Recommendation:** Option A. It is the only option that keeps R16 while making both oracles stable.
Because it expands the modification set to another feature's test, it is reserved for the user.

**User Decision:** Resolved — User chose Option A: amend the progress content test. Phase 8's
modification set and task 8.1.4 now include `scripts/exec-plan-progress-content.spec.test.mjs`,
and ST-61 is written against the stable document-wide `- discovery:` form.

### PF-008: Adding `prepack` makes every pack test run a full build

**Dimension:** 7 Testability
**Location:** `07-testing-strategy.md` ST-53; `03-06-web-ui.md` `prepack`; `99-execution-plan.md` Phase 6 modification set
**Codebase evidence:** `plugin/tui-foundation.spec.test.mjs:117` already runs
`spawnSync("npm",["pack","--dry-run","--json"])` and `JSON.parse`s stdout; `node --test` runs files
in parallel; npm runs `prepack` for a directory pack even with `--dry-run` unless `--ignore-scripts`.

**The Problem:** After Phase 6, the existing tui test and ST-53 each trigger a full React/Fluent
esbuild build into the same `discovery-ui/dist/` from two parallel test processes, and the build's
inherited stdio can corrupt the `--json` payload the existing test parses. `verify` therefore becomes
slow and intermittently red, and Phase 6's modification set does not include the tui test.

**Options:**
| Option | Description | Pros | Cons |
|---|---|---|---|
| A | ST-53 builds into a temp outdir (or `discovery-ui/dist`) itself, then packs with `--ignore-scripts`; add `--ignore-scripts` to the tui test; add that test to Phase 6's set; keep CI's plain `npm pack --dry-run` as the prepack proof; ST-54 asserts the `prepack` script explicitly | Deterministic, no parallel builds, keeps tarball proof | The pack test no longer proves prepack; ST-54 must |
| B | Weaken ST-53 to a static `files` check | Simplest | Loses the tarball proof |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design` · Eligibility: test mechanics inside AD-59/AR-33 · Decision: A · Rejected: B (no proof) · Counterargument: only CI proves prepack is wired · Confidence: High · Hardening: `Challenger: diverged — re-rated MINOR`; lead keeps MAJOR because it makes `npm run verify` intermittent · Reopen: npm stops running `prepack` for `--dry-run`.

### PF-009: Spike fallbacks contradict immutable spec tests and have no variants

**Dimension:** 11 Ordering & Sequencing
**Location:** `03-01-host-spike.md` §Recording; `03-04-server.md` §Fallback B; `03-05-plugin-integration.md` §Fallback A; `07-testing-strategy.md` ST-27, ST-34, ST-37, ST-45, ST-46, ST-62
**Codebase evidence:** not applicable (plan-internal), verified against `03-01:51-53` ("need no
re-planning") and `07:29-31` (immutable oracle).

**The Problem:** Phase 1 may select Fallback B (always port 0, one project per listener), which
contradicts ST-27's `{fallback:false}` and ST-34's repository grouping, or Fallback A (no waker),
which makes ST-45, ST-46, and ST-62 unachievable. Neither fallback has any test case, and the
"never adjust a test" rule then blocks the executor mid-plan.

**Options:**
| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Pre-author conditional variants (ST-27B/34B/37B; ST-44A/45A; ST-62A), each labelled "replaces ST-n when Phase 1 selects Fallback X", plus one task line naming the selected set | Executor has a valid oracle on either path | Variants that never run can rot |
| B | Make a failed assumption a stop-and-amend point | No dead variants | Contradicts AR-19's pre-agreed fallbacks and pauses execution |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design` · Eligibility: test-case authoring inside AR-19 · Decision: A · Rejected: B (contradicts AR-19) · Counterargument: unused variants are maintenance debt · Confidence: High · Hardening: `Challenger: converged` · Reopen: the spike selects no fallback (base path unchanged).

### PF-010: Seven tasks claim ST cases pass before their prerequisites exist

**Dimension:** 11 Ordering & Sequencing
**Location:** `99-execution-plan.md` tasks 3.2.1, 3.2.3, 4.2.2, 5.2.5, 6.2.4
**Codebase evidence:** plan-internal; checked against the ST preconditions and the task order.

**The Problem:** 3.2.1 claims ST-14 (needs `registerProject`, 3.2.2) and ST-25 (needs `getPlan`,
3.2.4); 3.2.3 claims ST-17 (`markOrphaned`, 3.2.6) and ST-18 (`saveAnswer`/`resolve`, 3.2.5-3.2.6);
4.2.2 claims ST-30's `PUT` 200 (needs 4.2.5); 5.2.5 claims ST-46 ("`setup` runs", needs 5.2.6);
6.2.4 claims ST-50 (the build needs the views from 6.2.6-6.2.9). Each task's verify step cannot pass
as written, so the executor either marks `[!]` or pulls later work into an earlier phase.

**Options:**
| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Move each claim to the first task whose prerequisites exist (ST-14→3.2.2; ST-17/18→3.2.6; ST-25→3.2.7; ST-30→4.2.5; ST-46→5.2.6; ST-50→6.2.9) | Text-only, keeps the task-size bound | Slightly later green signals |
| B | Keep the claims and note "partial green" | No edits | Breaks the per-task verify loop |

**Recommendation:** Option A.

**User Decision:** AI — delegated by `--auto-design` · Eligibility: implementation sequencing · Decision: A · Rejected: B (breaks the loop) · Counterargument: later green signals reduce early feedback · Confidence: High · Hardening: `Challenger: converged` · Reopen: the exec-plan skill permits partial verification.

### PF-011: The UI type-check cannot accept the imports the tests require

**Dimension:** 13 Codebase Alignment (dependency/toolchain reality)
**Location:** `03-06-web-ui.md` `tsconfig.json` line and `typecheck` script; `07-testing-strategy.md` §Testing Overview
**Codebase evidence:** `07:21-23` requires explicit `.ts` import extensions so Node type stripping can
load the modules; TypeScript rejects a `.ts` specifier without `allowImportingTsExtensions` (TS5097,
valid only with `noEmit`); the planned tsconfig has `noEmit` but not the flag; the root
`tsconfig.json` has neither.

**The Problem:** With `.ts` specifiers `npm run verify` fails at typecheck; without them ST-48/49/52/55
cannot load the module graph under `node --test`. `erasableSyntaxOnly` is also absent, so nothing
enforces the "erasable syntax only" rule the test strategy depends on.

**Options:** Add `"allowImportingTsExtensions": true` and `"erasableSyntaxOnly": true` to
`discovery-ui/tsconfig.json`; state the type-only-import rule (`import type`) so a value-imported
type cannot break stripping. Only one viable option — bundle-before-test and bundle-only testing were
rejected (new machinery / loses direct module tests, both against AD-59).

**Recommendation:** Add both flags and the `import type` rule to `03-06`.

**User Decision:** AI — delegated by `--auto-design` · Eligibility: toolchain configuration · Decision: add both flags · Rejected: bundling before tests (machinery) · Counterargument: one more compiler flag to keep in sync with the root config · Confidence: High · Hardening: `Challenger: converged` · Reopen: TypeScript drops the flag or the toolchain floor moves below 5.0.

### PF-012: The delivery contract contradicts itself and cannot report "woken"

**Dimension:** 3 Logical Contradictions
**Location:** `03-05-plugin-integration.md` §Waking and delivery; `03-04-server.md` §Runtime API, §Endpoints; AR-46; `07-testing-strategy.md` ST-23, ST-35, ST-45
**Codebase evidence:** not applicable (plan-internal); verified that `session.prompt` resolves on
acceptance, so it can be awaited cheaply.

**The Problem:** (1) "for each undelivered submission … claim … then prompt" contradicts "one
message per plan". (2) `deliver: (planSlug) => Promise<void>` cannot tell the submit endpoint whether a
prompt happened, yet the response reports `delivery: "woken" | "pending"`. (3) AR-46 says delivery
happens at "its next Discovery tool call"; `03-05` says "every tool call for that plan". (4) A crash
between claim and prompt loses the wake permanently (the submission is marked delivered), and a
prompt that rejects after acceptance can wake twice.

**Options:**
| Option | Description | Pros | Cons |
|---|---|---|---|
| A | One prompt per plan covering all claimed submissions; `deliver` returns `"woken" \| "pending" \| "failed"`; release all claims on failure; one delivery-point wording; two-phase claim (`claimedBy{pid,at}`, `deliveredAt` after the prompt resolves, dead-PID claims released at setup) | Deterministic, honest `woken`, survives crashes | One extra field and a startup sweep |
| B | Keep per-submission prompts; accept the lost-wake window | Least change | Breaks R8 and AR-46's wording |

**Recommendation:** Option A, with the challenger's simplification: claim → prompt → set
`deliveredAt`, plus a startup sweep of stale `claimedBy` (no separate two-phase commit).

**User Decision:** AI — delegated by `--auto-design` · Eligibility: delivery mechanism inside AR-5/AR-46 · Decision: A · Rejected: B (breaks exactly-once) · Counterargument: the extra state adds recovery paths · Confidence: High · Hardening: `Challenger: diverged — proposed claim → prompt → deliveredAt plus a stale sweep` (adopted) · Reopen: the host exposes a de-duplicating prompt id (then the sweep can be removed).

## 🟡 MINOR

### PF-013: The store has no way to report `newer-version` / `unreadable`

**Dimension:** 1 Ambiguities · **Location:** `03-03-store.md` §API, §Durability; `03-04-server.md` §Endpoints; ST-25
**Codebase evidence:** not applicable. ST-25 requires `getPlan` to "fail with `newer-version`", but the signature is `Promise<PlanRecord | null>` and no result union carries that reason.
**Problem:** The spec author must guess between a thrown typed error and a result object; the server and tools need a mapping either way.
**Options:** A — a typed `DiscoveryDataError {code: "newer-version" | "unreadable"}` thrown on those two paths only, mapped to 409 by the server and `reason: "error"` by the tools, with "never throws" restated as a tool-boundary property. B — add both reasons to every result union (uglier, one error style).
**Recommendation:** A.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: internal error interface · Decision: A · Rejected: B · Counterargument: throws inside modules described as never-throwing invite new unhandled paths · Confidence: High · Reopen: a host API requires result objects.

### PF-014: `revision` is bumped only by publish, but ST-36 expects a save to produce one

**Dimension:** 3 Logical Contradictions · **Location:** `03-03-store.md` §Transitions; ST-18, ST-20, ST-36
**Codebase evidence:** not applicable. `03-03:108` increments `revision` only in `publish`; ST-36 expects `changed` with "the new revision" after a save; ST-18 and ST-20 depend on saves leaving it unchanged.
**Problem:** ST-36 and ST-18 cannot both hold; whichever the spec author picks, `baseRevision` semantics shift.
**Options:** A — `revision` is the publish revision; every mutation emits `changed` with the current `revision`; staleness keeps comparing `revisedAt`. B — bump on every save (breaks ST-18/ST-20).
**Recommendation:** A.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: internal version semantics · Decision: A · Rejected: B · Counterargument: pages cannot use `revision` to detect any change · Confidence: High · Reopen: a consumer needs a global change counter (then add a separate `seq`).

### PF-015: A disabled project still creates and chmods the Discovery data directory

**Dimension:** 2 Implicit Assumptions · **Location:** `03-03-store.md` §Durability; `03-05-plugin-integration.md` §Opt-in check, §Code Examples; ST-41
**Codebase evidence:** `03-03:120-121` creates 0700 directories and chmods an existing discovery directory "at store creation"; the controller receives a store built at `setup` (`03-05:47-49`, `:124`), before the `enabled` check.
**Problem:** A disabled project writes `~/.local/share/opencode/codeops/discovery/` on load, contradicting R1 and AD-57 ("off means exactly as today"); ST-41 would not catch it.
**Options:** A — create the store and runtime lazily on first enable; add "the discovery directory does not exist after a disabled setup" to ST-41. B — document the eager write (rejected: a silent home-directory write is what opt-in promises to avoid).
**Recommendation:** A.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: initialization mechanism inside R1 · Decision: A · Rejected: B · Counterargument: lazy creation moves the failure to the first publish · Confidence: High · Reopen: the store needs its directory at construction for another reason.

### PF-016: `Evaluation` is undefined, and visibility/implication order is ambiguous

**Dimension:** 1 Ambiguities · **Location:** `03-02-rules-and-model.md` §Functions, §`evaluatePlan`; ST-8, ST-9, ST-10
**Codebase evidence:** not applicable. ST-8…ST-10 assert `visible`, `implied.{answer,from,reasons}`, `source`, `overridesImplied`, and conflict entries that `03-02` never defines.
**Problem:** The store, view models, and readiness all consume this shape. Also: visibility uses effective answers (which include implied ones), so the combined `showIf`+`implies` graph can cycle even though each is acyclic; `anyOf` on a `multiple` question is unspecified (any overlap or all).
**Options:** A — define the `Evaluation` type; compute visibility from explicit answers first, then implications from visible explicit answers onto visible targets; state `anyOf` = any selected id; reject cycles across both graphs. B — reject cycles across both graphs only (leaves the shape undefined).
**Recommendation:** A.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: internal data structure and evaluation order (AR-26/AR-50 fixed the rule language) · Decision: A · Rejected: B · Counterargument: two-phase evaluation may surprise an agent expecting one pass · Confidence: High · Reopen: a valid rule set is rejected by the combined cycle check.

### PF-017: `groupReadiness` narrows AR-42 without a recorded decision 🟡 MINOR — RESERVED

**Dimension:** 3 Logical Contradictions · **Location:** `03-02-rules-and-model.md` §`groupReadiness`; AR-42; ST-11
**Codebase evidence:** not applicable. `03-02:134-135` adds "and at least one of them is answered or deferred", which AR-42 does not contain; ST-11 encodes it ("not ready (nothing to deliver)"); the `missing` reason enum has no value for that block.
**Problem:** AR-42 is a user decision; the extra condition narrows it and no AR/delegated note records the change. When it is the only blocker, the Submit tooltip and skipped list have nothing to show.
**Options:** A — keep the condition, record it as a delegated clarification, and add a `nothing-to-submit` reason. B — remove it and allow an all-"needs discussion" submission (an empty wake).
**Recommendation:** A. Reserved because it changes behaviour relative to a user decision.
**User Decision:** Resolved — User chose to keep the guard and record it. AD-63 now holds the
delegated provenance, and `groupReadiness` reports `nothing-to-submit` when that guard is the only
blocker.

### PF-018: "Answered" is used in two senses

**Dimension:** 12 Consistency · **Location:** `03-02` §Functions; `03-03` `submit`; `03-06` status badges; ST-49
**Codebase evidence:** not applicable. `03-02:95` defines "Answered" as an effective answer, a valid deferral, **or** "needs discussion"; `03-03:110` submits answered and deferred questions and leaves "needs discussion" open.
**Problem:** Counts and badges can disagree with what Submit sends.
**Options:** A — "answered" means an effective answer only; count deferred and needs-discussion separately. B — keep the umbrella term and define each bucket explicitly in `planCounts`.
**Recommendation:** A, and add both cases to ST-49.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: terminology and derived counts · Decision: A · Rejected: B (three meanings of one word) · Counterargument: changing the term touches several docs · Confidence: High · Reopen: a UI label needs the umbrella meaning.

### PF-019: `readDiscoveryConfig`'s "invalid means disabled" contradicts ST-40

**Dimension:** 3 Logical Contradictions · **Location:** `03-05` §Opt-in check doc comment, §Error Handling; ST-40; `03-05` §Config schema
**Codebase evidence:** not applicable. The doc comment says "anything missing or invalid means disabled"; ST-40 expects `chatMaxQuestions: -1` → `{enabled: true, chatMaxQuestions: 3}` although `-1` violates `minimum: 0`.
**Problem:** Two defensible implementations, one immutable oracle.
**Options:** A — keep ST-40: a missing/non-boolean `enabled` or an unreadable file disables; an invalid `chatMaxQuestions` falls back to 3. B — treat any invalid field as disabled (changes ST-40).
**Recommendation:** A, and reword the doc comment and error row.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: configuration parsing · Decision: A · Rejected: B (breaks ST-40) · Counterargument: silent per-field fallback hides a config error · Confidence: High · Reopen: the schema gains a strict validation step that reports errors to the user.

### PF-020: The wake text's placeholders are under-specified

**Dimension:** 1 Ambiguities · **Location:** `03-05` §Waking; AD-56; AR-20; ST-45; `03-03` record
**Codebase evidence:** not applicable. ST-45 asserts the exact text; nothing defines `project name` (slug or basename), what `<n>` counts, how group titles are joined, or the singular.
**Problem:** Any mismatch fails an immutable oracle.
**Options:** A — define `project.name` as the directory basename, `<n>` as the number of submitted questions in the claimed submissions, groups joined with ", ", singular "answer". B — assert a prefix/substring instead of the exact text.
**Recommendation:** A (keeps the test exact and the text readable).
**User Decision:** AI — delegated by `--auto-design` · Eligibility: text formatting inside AR-20 · Decision: A · Rejected: B (weaker oracle) · Counterargument: exact text is brittle across UX tweaks · Confidence: High · Reopen: the wake text needs localization.

### PF-021: "Not built" cannot recover after a build, because assets are listed once at listener start

**Dimension:** 3 Logical Contradictions · Location: `01-requirements.md` R14; `03-04-server.md` §Static assets
**Codebase evidence:** not applicable. Assets are listed from `dist/assets/` at listener start; R14 says the page works after `npm run build:discovery`.
**Problem:** Building while OpenCode runs still serves 404 until a restart; `index.html`'s read timing is unstated.
**Options:** A — re-list and re-read `index.html` whenever `dist/` was missing at the last check. B — reword R14/the page to "…then restart OpenCode".
**Recommendation:** A (small, and matches the developer experience of the test suite).
**User Decision:** AI — delegated by `--auto-design` · Eligibility: static-asset serving mechanism inside R14/AR-37 · Decision: A · Rejected: B (worse UX) · Counterargument: a stat per request is unnecessary work · Confidence: High · Reopen: `dist/` is served from a packaged location that never changes.

### PF-022: Reference and terminology drift

**Dimension:** 12 Consistency
**Location:** `01-requirements.md` R15 ("A–D" vs 03-01's A–E); `03-04` §Error Handling ("`fallback: true`") vs the tool field `fallbackPort`; `02-current-state.md:19`, AD-56 (`codeops-progress.mjs:537-571`); `02:49`, `03-07:115` (release.mjs range); `02:17` etc. (`readRoutingConfig` at `:158-168`); `02`/AD-62 (`report-format.md:109-139/:109-149`); `00-index:112`/AD-62 (analyze-project range); `02:49` (schema `tool.d.ts` cited for `signal`).
**Codebase evidence:** `bin/lib/codeops-progress.mjs` has 564 lines (`registerCodeOpsProgressTool` = `:537-564`); `mergeChangelog` = `scripts/release.mjs:298-313`; `readRoutingConfig` starts at `plugin/index.ts:161`; Step 5 = `report-format.md:109-155`; `signal` is added by `plugin/dist/promise/tool.d.ts:11-14`, not by `schema/dist/tool.d.ts`.
**Problem:** Ranges past EOF and a `signal` citation that does not contain `signal` undermine the plan's "verified" claim; R15 omits assumption E, which AR-45 depends on; `fallbackPort`'s type is never stated.
**Options:** A — correct every range, change R15 to A–E, define `fallbackPort: number | null`. B — leave them (rejected; the plan's grounding argument is the citations).
**Recommendation:** A.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: documentation accuracy · Decision: A · Rejected: B · Counterargument: line references drift again on the next edit · Confidence: High · Reopen: a cited file is restructured.

### PF-023: ST-15 uses paths that cannot exist, while projects are keyed by realpath

**Dimension:** 3 Logical Contradictions · Location: ST-15; `03-03` §Identity
**Codebase evidence:** not applicable. `realpath("/w/My Repo")` throws ENOENT; the test cannot create root-level directories.
**Problem:** The case fails for a reason unrelated to slugs.
**Options:** A — state the inputs as temp directories with those basenames. B — fall back to `path.resolve` when realpath fails (changes behaviour).
**Recommendation:** A.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: test fixture · Decision: A · Rejected: B · Counterargument: none · Confidence: High · Reopen: registration receives paths that may not exist.

### PF-024: Route parameters reach file paths without a slug check

**Dimension:** 8 Security Blind Spots · Location: `03-04` §Endpoints; `03-03` §Proposed Changes, `deletePlan`; R11
**Codebase evidence:** not applicable. Slugs are `[a-z0-9-]`, but nothing checks `:p`/`:plan` at the server or store boundary; ST-33 tests traversal only for `/assets/`.
**Problem:** `DELETE .../projects/..%2F..%2F<dir>/plans/..%2Fpackage` with `{confirm:true}` can resolve outside the data directory. Host/Origin checks stop websites, so this is defence in depth, but R11's "path traversal" claim is not true as written.
**Options:** A — reject params not matching `^[a-z0-9-]{1,48}$` with 404 before routing, and have the store confirm the resolved path stays under `dataDir`; add a traversal case. B — rely on Host/Origin only (rejected: R11 claims the control).
**Recommendation:** A.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: security mechanism tightening inside AR-4/AR-29 · Decision: A · Rejected: B · Counterargument: any local process can already read the files · Confidence: High · Reopen: routes are generated only from stored records.

### PF-025: Some live events are never sent

**Dimension:** 4 Completeness Gaps · Location: `03-04` §Runtime API/§Live events; `03-05` §Tools; ST-36, ST-44, ST-45
**Codebase evidence:** not applicable. Only publish notifies; nothing sends `changed` after `resolve` or after `answers` claims a submission, and nothing sends `delivered`.
**Problem:** An open page keeps showing "Submitted" instead of "Recorded as AR-7", and the delivery indicator never updates, until reloaded.
**Options:** A — resolve/answers/deliver handlers call `runtime.notify`; add the events to ST-44/ST-45. B — rely on the page's polling/reload (there is none).
**Recommendation:** A.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: live-update mechanism inside AR-24 · Decision: A · Rejected: B · Counterargument: one more event to keep ordered · Confidence: High · Reopen: SSE is replaced.

### PF-026: Three requirement clauses have no specification case

**Dimension:** 4 Completeness Gaps · Location: R2, R8, R11; ST-43, ST-45, ST-31/32
**Codebase evidence:** not applicable. Traced R1–R16 and acceptance criteria 1–7: everything else maps. Missing: R2's port-fallback notice (ST-43 never asserts `fallbackPort`), R8's "next Discovery tool call" delivery point, and R11's "no internal details" 500 envelope (only an implementation test).
**Problem:** The clauses are promised but not proven by the immutable oracle.
**Options:** A — add: ST-43 asserts `fallbackPort` when the port is taken; ST-45 asserts a prompt at the next publish for that plan; ST-31/32 assert a forced store exception returns 500 `{error:"internal"}` with no path or stack.
**Recommendation:** A.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: test coverage of existing requirements · Decision: A · Rejected: none viable · Counterargument: more assertions to maintain · Confidence: High · Reopen: a requirement clause is removed.

### PF-027: ST-62 proves less than Acceptance 4

**Dimension:** 7 Testability · Location: ST-62; `01-requirements.md` Acceptance 4
**Codebase evidence:** not applicable. Acceptance 4 requires publishing from `make-plan`, answering in the browser, and the answers landing in the register; ST-62 allows answers "saved through the page API" without `make-plan` and does not name the register artifact.
**Problem:** The acceptance criterion stays unproven.
**Options:** A — align ST-62: publish from `make-plan`, answer in the browser, assert the scratch plan's `00-ambiguity-register.md` contains the answers as exact text with their `DQ-` keys. B — accept the weaker proof (rejected: it is the headline acceptance criterion).
**Recommendation:** A.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: test procedure inside the existing criterion · Decision: A · Rejected: B · Counterargument: the live run becomes more setup-heavy · Confidence: High · Reopen: the browser cannot be driven in CI (it is manual by design).

### PF-028: Spike C does not prove the tool list is per location

**Dimension:** 2 Implicit Assumptions · Location: `03-01` assumption C; `03-05` §Tools; ST-42
**Codebase evidence:** `ctx.tool.list()` is documented as the process-wide list "after every transform" (`plugin/dist/promise/tool.d.ts:56-58`), while transforms register per instance.
**Problem:** If the tool list is process-wide, the first opted-in project exposes `codeops_discovery_*` to every project in the process (breaking opt-in), the handler closure belongs to the enabling instance, and disabling one project removes the tools for all.
**Options:** A — extend spike C with one assertion using `ctx.tool.list()`: with one opted-in and one non-opted-in project, the non-opted-in instance sees no Discovery tool. B — resolve the project from the calling session's directory in each handler (needs a session→directory lookup).
**Recommendation:** A (one probe line; keeps the opt-in guarantee verifiable).
**User Decision:** AI — delegated by `--auto-design` · Eligibility: host measurement inside AR-13 · Decision: A · Rejected: B (new machinery for an unmeasured risk) · Counterargument: the probe may need a second session per project · Confidence: Med · Reopen: the tool list is per instance (probe passes, no further work).

### PF-029: Helper tests are placed against the repository's convention, and the declaration leaks host types

**Dimension:** 13 Codebase Alignment · Location: `07-testing-strategy.md` §Specification Tests; `03-05` `createDiscoveryController(ctx: PluginContext, …)`
**Codebase evidence:** every existing `bin/lib/*.mjs` test sits in `bin/` (`bin/reasoning-effort.spec.test.mjs`, `bin/tmp-hygiene.impl.test.mjs`); `bin/lib/codeops-progress.d.mts:233-236` declares `ctx: unknown` and imports nothing from `@opencode/*`.
**Problem:** `plugin/` is the wiring surface and `bin/` the helper surface; the plan mixes them, and a `bin/lib` declaration would become the first that depends on host types, which breaks the host-free property the tests rely on.
**Options:** A — move the rules/store/server suites to `bin/` and type `ctx` as `unknown` in `discovery-tools.d.mts`. B — keep the plan's layout and record the deviation.
**Recommendation:** A.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: file layout and typing convention · Decision: A · Rejected: B · Counterargument: more files move than the plan lists · Confidence: High · Reopen: a helper needs a typed host call that `unknown` cannot express.

### PF-030: Two cases assert async state without a synchronisation rule

**Dimension:** 7 Testability · Location: ST-36 (`hasViewer` false after close); ST-27 ("free port")
**Codebase evidence:** not applicable. SSE disconnects are observed asynchronously; a port obtained by binding 0 and closing can be taken before reuse.
**Problem:** Both cases are race-prone, so `verify` can flake.
**Options:** A — ST-36 waits for the server's close handling (bounded polling, as `progress-server.spec.test.mjs:58-66` already does); ST-27 obtains the "requested" port by binding a first runtime and pointing a second at it (needs PF-004's factory).
**Recommendation:** A.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: test mechanics · Decision: A · Rejected: fixed sleeps (nondeterministic) · Counterargument: polling hides a real bug if unbounded · Confidence: High · Reopen: the runtime exposes a viewer-count change callback.

### PF-031: `renderer.ts` imports `@griffel/react`, which is not declared

**Dimension:** 13 Codebase Alignment (dependency reality) · Location: `03-06` §CSP nonce, §devDependencies; ST-52, ST-54
**Codebase evidence:** the installed `fluentui` skill states `@griffel/react` is only a transitive dependency and must be added explicitly to `package.json` (`~/.config/opencode/skills/fluentui/references/foundation/styling-griffel.md:18-21`); ST-54 enumerates five devDependencies and omits it.
**Problem:** The bundle imports an undeclared package. It resolves today only through npm hoisting, and a stricter layout breaks the build.
**Options:** A — declare `@griffel/react` in `devDependencies` and keep ST-50's single-copy assertion. B — rely on hoisting (rejected: undeclared dependency).
**Recommendation:** A.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: dependency declaration inside AR-36 · Decision: A · Rejected: B · Counterargument: one more pinned package version · Confidence: High · Reopen: Fluent re-exports the renderer helpers.

### PF-032: The at-rest protection rationale does not hold once the listener serves answers

**Dimension:** 8 Security Blind Spots · Location: `01-requirements.md` §Security ("same protection as the repository files")
**Codebase evidence:** not applicable. Any local user can read `http://127.0.0.1:4747` answers regardless of 0700/0600, so file modes protect the data at rest but not the running service.
**Problem:** The stated justification is wrong and the trust assumption (single-user machine) is implicit. AR-4 stands; this is a documentation correction.
**Options:** A — state the single-user-machine assumption in the README and restate the 0700/0600 rationale as "at rest only". B — leave the rationale (rejected: it misleads a reviewer).
**Recommendation:** A.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: documentation of an existing approved policy · Decision: A · Rejected: B · Counterargument: the README already says "local-only, no login" · Confidence: High · Reopen: any authentication is added.

## 🔵 OBSERVATION

### PF-033: Red-phase steps do not allow a case that passes before any code exists

**Dimension:** 7 Testability · Location: `99` steps 3.1.2, 4.1.2, 5.1.2, 6.1.2, 7.1.2; `07` ST-41
**Codebase evidence:** `plugin/index.ts` registers no Discovery tool or listener today, so ST-41's negative checks already hold.
**Problem:** Only Phase 2's step allows documented early passes; Phase 5 requires every case to fail.
**Options:** A — copy "document any that pass with justification" into the other red-phase steps and name ST-41 as expected to pass.
**Recommendation:** A.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: process wording · Decision: A · Rejected: none viable · Confidence: High.

### PF-034: Browsers allow six connections per host, so six open plan tabs can stall saves

**Dimension:** 9 Edge Cases · Location: `03-04` §Live events; `03-07` README section
**Codebase evidence:** not applicable (HTTP/1.1 browser limit); the listener is HTTP/1.1.
**Problem:** Each plan tab holds one SSE stream; a seventh tab's fetches queue behind them, and autosave appears to hang.
**Options:** A — document the limit in the README. B — close a hidden tab's stream on `visibilitychange` (changes AR-31's viewer counting).
**Recommendation:** A.
**User Decision:** AI — delegated by `--auto-design` · Eligibility: documentation of a local limitation · Decision: A · Rejected: B (changes approved viewer semantics) · Confidence: Med · Reopen: HTTP/2 or `EventSource` multiplexing makes the limit irrelevant.

---

## Considered and dismissed

| Item | Reason |
|---|---|
| Dead owner after `opencode service restart` (challenger H-11) | AR-40 is about *deleted* sessions; a restart leaves the session row alive, so `session.get` still resolves, the wake still queues, and no adoption is needed. The two-process hosting question is PF-002. |
| `location.directory` equality as the hosting test | Rejected: service and `--standalone` can serve the same directory, so equality is neither necessary nor sufficient; PF-002 measures instead. |
| Sequence: `--auto-commit` applies fixes | `--auto-commit` is not a preflight option and `--auto-design` grants no action permission; fixes and commits stay pending until explicitly authorized. |
| Scope-expansion proposals (`SE-*`) | Strict scope (no `--explore-scope`): optional additions are not reported. |

## Resolution log (iterations 2–3)

All 34 findings were applied to `plans/discovery/` and verified by a fresh-context auditor.

| Iteration | Result |
|---|---|
| 2 (fix verification) | 24 closed, 8 partial (PF-001, 004, 011, 016, 018, 022, 024, 025), 2 open (PF-010, PF-028); 2 new major regressions: ST-18's fixture demanded one publish that was both applied and refused, and Phase 8 wrote `## Unreleased` before amending the progress content test |
| 3 (bounded recheck of those fixes) | All 13 checked points fixed; one non-blocking fixture-wording residue, corrected; verdict `clean` |

Structural checks after the fixes: 76 tasks match the phase table (4/9/11/11/11/14/8/8) and the
progress header; 69 ST rows (base 1–63 unique plus ST-27B/34B/37B/44A/45A/62A); every internal
Markdown link resolves; no stale citation from PF-022 remains outside this report;
`scripts/exec-plan-progress-content.spec.test.mjs` still passes unchanged.

## Convergence

| State | Result |
|---|---|
| Unresolved 🔴/🟠 | none |
| Remaining 🟡/🔵 | none (all applied) |
| Reserved decisions | PF-007 and PF-017 ruled by the user |
| Verdict | ✅ **PASSED** — all 34 findings resolved |
| Roadmap | advanced to `Plan Preflighted` (🔬) |

Before plan execution consumes this artifact, compare each plan document's current git blob with the
hashes recorded here; a mismatch makes this pass stale and requires a targeted re-check.
