## Ambiguity Register: live-task-sidebar (slices 0–1: parser counting fix + live TUI spike)

> **Status**: ✅ GATE PASSED — all 21 items resolved
> **Last Updated**: 2026-10-10 13:21
> **Scope**: feature plan for the live-task-sidebar foundation. Slice 0 fixes the execution-task
> counting rule in `scripts/codeops_plan.py`; slice 1 is the live spike (packaged `./tui` entry,
> a `sidebar.content` status strip, and the server `codeops` RPC foundation). Systematically
> reviewed across all 12 categories.
> **Auto-design**: active for this workflow chain — eligible technical decisions are delegated
> under `_shared/auto-design.md` policy version 1, root invocation ID `AD-LTS-20261010-1`;
> reserved decisions remain user-owned.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope | Staging of the whole live-task-sidebar feature | all three slices at once / slices 0+1 now, slice 2 after spike evidence / slice 0 only | User (this conversation): proceed with slices 0+1; slice 2 is decided later on the live spike evidence | ✅ Resolved |
| 2 | Scope | Plan target and tracker identity | full plan `plans/live-task-sidebar/` / two task mini-plans / no plan docs | User approved `make-plan live-task-sidebar`; tracker ID `REQ-LIVE-TASK-SIDEBAR` follows the repository's existing `REQ-*` convention | ✅ Resolved |
| 3 | Technical unknowns | Execution-task counting rule (which checkbox lines are real tasks) | id-prefixed lines + fence stripping + first-occurrence dedupe (AI) / keep matching every checkbox line / section-scoped heuristics | AI — delegated by --auto-design (note A) | ✅ Resolved |
| 4 | Data & state | Parser output compatibility with existing consumers | JSON schema unchanged, counts corrected (AI) / versioned schema change / new tool alongside | AI — delegated by --auto-design (note A) | ✅ Resolved |
| 5 | Scope | `make-plan` deliverables template keeps checkbox bullets | leave the template as-is — the parser now ignores non-task checkboxes (AI) / convert deliverables to plain bullets | AI — delegated by --auto-design (note A) | ✅ Resolved |
| 6 | Technical unknowns | Spike architecture for the live proof | server-side status RPC + TUI `sidebar.content` strip in the same package (AI) / TUI-only static render / separate TUI package / file-based signaling | AI — delegated by --auto-design (note B) | ✅ Resolved |
| 7 | Naming & terminology | Entry points, plugin ID, RPC identity | `./tui` → `plugin/tui.tsx`; TUI plugin id `opencode-codeops-tui`; RPC id `codeops`, method `status` (AI) | AI — delegated by --auto-design (note B) | ✅ Resolved |
| 8 | Integration points | RPC contract shape | `status` with empty-object input, output `{ pluginVersion, openCodeVersion, directory }` (AI) | AI — delegated by --auto-design (note B) | ✅ Resolved |
| 9 | Technical unknowns | Helper placement and guard contract | `bin/lib/codeops-rpc.mjs` + `.d.mts`; feature-detects `ctx.rpc.register`; never throws; returns registered/not (AI) / inline in `plugin/index.ts` / TS module | AI — delegated by --auto-design (note C) | ✅ Resolved |
| 10 | Edge cases | Proving containment on builds without the new APIs | runtime fake-context tests plus the guard (AI) / install an older OpenCode build | AI — delegated by --auto-design (note C) | ✅ Resolved |
| 11 | Technical (dependencies) | `@opentui/core`, `@opentui/solid`, `solid-js` devDependencies + optional peerDependencies | devDeps pinned for typecheck + optional peers per the official plugin docs (AI) / no JSX dependency (not required — a JSX-free virtual-import pattern exists as a slice-2 contingency) / vendored shims | AI — delegated by --auto-design (note D); complexity gate assessed as not triggered; the user pre-approved the surface in the impact review | ✅ Resolved |
| 12 | Technical unknowns | TypeScript/JSX configuration for `plugin/tui.tsx` | `jsx: preserve` + `jsxImportSource: @opentui/solid`; include `plugin/**/*.tsx` (AI) | AI — delegated by --auto-design (note D) | ✅ Resolved |
| 13 | UX & presentation | Spike strip content and states | one line `CodeOps v<version>`; renders only on RPC success; default terminal styling; no timer/poll (AI) | AI — delegated by --auto-design (note E) | ✅ Resolved |
| 14 | Non-functional | Live smoke procedure and recorded evidence | packed tarball into a scratch project, pty capture, fallback to user-assisted observation; record the tested minimum build (AI) | AI — delegated by --auto-design (note F) | ✅ Resolved |
| 15 | Scope | Documentation and release boundary | CHANGELOG `## Unreleased` entry only; no README feature docs; no release/publish (user-owned act) (AI) | AI — delegated by --auto-design (note G) | ✅ Resolved |
| 16 | Security & compliance | RPC data surface | version strings + the server's project directory only; no inputs; no file access; nothing else leaves the server (AI) | AI — delegated by --auto-design (note B) | ✅ Resolved |
| 17 | Behavioral | Interim visibility if a release happens before slice 2 | the honest status strip is the only user-visible addition (AI) | AI — delegated by --auto-design (note E) | ✅ Resolved |
| 18 | Feature gaps | Handling of the user-held slice-2 design brief | slice 2 is planned separately when the user decides; this plan references its intent in one line and does not copy or restate it (AI) | AI — delegated by --auto-design (note G) | ✅ Resolved |
| 19 | Technical unknowns | Verify command | `npm run verify` — repository fact, not a decision | ✅ Resolved — `AGENTS.md` §Verification commands | ✅ Resolved |
| 20 | Integration points | Where the RPC payload type guard lives (the coding standards ban unsafe casts, so the `unknown` JsonSchema result needs validation) | export `isCodeOpsStatus(value)` from the shared helper alongside the definition (AI) / guard inside `plugin/tui.tsx` | AI — delegated by --auto-design (note H) | ✅ Resolved |
| 21 | Technical (runtime) | Live-smoke method under the host's actual plugin loading and RPC behavior | host-supported file loading (project plugin discovery + `opencode.json` directory specs), layered attribution, and the user-assisted fallback (AI) / registry-spec install / committed harness | AI — delegated by --auto-design (note I) | ✅ Resolved |

### Resolution Notes

**User decisions (rows 1–2).** The user reviewed the staged recommendation (slice 0: parser
counting correctness; slice 1: live spike as the go/no-go gate; slice 2: the full live-task-sidebar
feature, decided later) and replied: *"I agree with your recommendations. Let go with that plan
(slice 0+1). Use --auto-design."* The plan shape (`make-plan live-task-sidebar`) was proposed in
the same exchange and accepted.

**Note A — rows 3–5 (parser counting, compatibility, template).**
```text
Authority: AI — delegated by --auto-design
Eligibility: implementation mechanism + data semantics within the user-confirmed slice-0 goal
  ("fix the parser counting — deliverables/example checkboxes inflate totals today"); no user
  artifact contradicts the rule; no reserved-authority consequence.
Objective: counts, lifecycle, and resume candidates reflect only real execution tasks.
Decision: keep matching marker lines `- [x|~|!| ]`, but require the content to begin with a task
  id (`N.N.N` or `T-N.N`, optional `**`), strip fenced code blocks first, and count each id once
  (first occurrence in document order). JSON schema, progress-bar format, lifecycle rules, and
  `next_task` semantics unchanged. Deliverables template left as-is (now harmless).
Evidence: scripts/codeops_plan.py:24 (TASK_RE matches every checkbox line); probe showed
  deliverables and quoted examples counted; all 9 repo plans use only `N.N.N` (73 lines) and
  `T-N.N` (31 lines) with zero non-id checkbox lines, so every existing total is preserved;
  consumers: skills/roadmap/SKILL.md:27, skills/upgrade-plan/SKILL.md:76,
  skills/setup-codeops/SKILL.md:76, skills/exec-plan/execution-protocol.md:116.
Rejected alternatives: keep current behavior (violates the counting goal); count only inside
  `## Phase` sections (fragile: mini-plans and legacy checklist formats); parser rewrite (slice-2
  concern, not needed to satisfy counting correctness).
Strongest counterargument: the `[~]`/`[x]` semantics could be broadened by future plan formats
  the id rule rejects; mitigated by keeping the marker vocabulary and adding formats with
  regression evidence.
Confidence: High — the rule is derived from all nine real plans and the documented templates.
Reopen triggers: a supported plan format legitimately uses a task id outside `N.N.N`/`T-N.N`;
  a consumer relies on non-id checkbox counting.
```

**Note B — rows 6–8, 16 (spike architecture, naming, RPC contract, security surface).**
```text
Authority: AI — delegated by --auto-design
Eligibility: internal architecture and interfaces within the user-approved slice-1 scope
  ("minimal ./tui sidebar section + one no-op RPC ... prove slot renders, RPC round-trips").
Objective: the smallest end-to-end proof that a packaged TUI entry can render server data in the
  sidebar, without building any slice-2 machinery.
Decision: one package, two entries — server plugin keeps id `opencode-codeops` and registers the
  `codeops` RPC (method `status`, empty-object input, output
  `{ pluginVersion, openCodeVersion, directory }`); TUI plugin id `opencode-codeops-tui` claims
  `sidebar.content` (append) and renders a status line only when `status` succeeds. The method has
  no parameters and reads nothing from disk; it returns only the plugin version, the OpenCode
  server version, and the plugin instance's project directory — values already within the
  connected client's trust context.
Evidence: node_modules/@opencode/plugin/dist/tui/context.d.ts:161-178 (`sidebar.content` slot
  input), :476-477 (`ui.slot`); node_modules/@opencode/plugin/dist/host.js (entry resolution:
  `server` then `tui`); node_modules/@opencode/plugin/dist/promise/rpc.d.ts:21 (register);
  @opencode/client/promise/rpc.d.ts (`client.rpc(def)`); opencode v2.0.24 installed.
Rejected alternatives: TUI-only static render (fails the accepted RPC round-trip criterion);
  a separate TUI package (extra packaging surface, contradicts the documented single-package
  `./tui` convention); file-based signaling (breaks the server-side plan-source design the brief
  requires, R6); tool-based reporting now (slice 2 machinery).
Strongest counterargument: JSON-Schema inputs/outputs are `unknown` in TypeScript, so the TUI
  must narrow the payload manually; accepted for the spike, slice 2 may move to Standard Schema.
Confidence: High — every API used exists in the installed SDK the runtime ships.
Reopen triggers: the smoke shows the entry-loading or slot behavior differs from the typings.
```

**Note C — rows 9–10 (helper, guard, containment proof).**
```text
Authority: AI — delegated by --auto-design
Eligibility: failure and recovery design + testing strategy within approved scope.
Objective: a load failure of the new surface can never break the always-on server plugin, and the
  guard is provable without an older build.
Decision: the RPC definition and the guarded registration live in `bin/lib/codeops-rpc.mjs` with
  `bin/lib/codeops-rpc.d.mts` (the repository's plain-JS-helper pattern, so `node --test` can
  exercise it directly). `registerCodeOpsRpc(ctx, { pluginVersion })` feature-detects
  `ctx.rpc.register`, registers when present, returns a boolean, never throws; `plugin/index.ts`
  additionally wraps the call in try/catch as defense in depth. Containment is proven by runtime
  tests that call the server plugin's `setup` with fake contexts (with and without `rpc`),
  isolated via `TMPDIR`/`HOME` fixture overrides (both honor per-call env in Node 22).
Evidence: plugin/index.ts:214-395 (setup shape; hooks only, no rpc); bin/lib/reasoning-effort.mjs
  + .d.mts precedent; Node 22.23 runs `.ts` directly (probed: `import('./plugin/index.ts')`
  resolves the default plugin export); os.tmpdir()/os.homedir() honor per-call env (probed).
Rejected alternatives: inline registration in plugin/index.ts (not directly testable); TypeScript
  helper module (adds runtime-import questions for the .mjs test path).
Strongest counterargument: content-adjacent tests can drift from runtime behavior; mitigated by
  the fake-context runtime tests, not content assertions alone.
Confidence: High.
Reopen triggers: an older 2.x build fails to load the server plugin; Node type-stripping behavior
  changes in CI (Node 24).
```

**Note D — rows 11–12 (dependencies and JSX configuration).**
```text
Authority: AI — delegated by --auto-design
Eligibility: implementation mechanism; dependencies required by the platform to render JSX in a
  TUI plugin. Complexity Escalation Gate assessed: not triggered — these are the host's required
  JSX peer packages (the plugin API renders `JSX.Element` only), there is no smaller direct
  solution, they are dev-only for typecheck plus optional peer metadata, and the user explicitly
  approved this small dependency surface in the impact review before this plan.
Objective: typecheck and ship the TUI entry with zero added runtime dependency.
Decision: devDependencies `@opentui/core@0.5.17`, `@opentui/solid@0.5.17`, `solid-js@1.9.12`
  (every `@opentui/solid` release 0.5.14–0.5.17 pins `solid-js@1.9.12` exactly, and that version
  also satisfies the SDK's `>=1.9.0` peer range); `peerDependencies` with the SDK's ranges, marked
  optional in `peerDependenciesMeta`; tsconfig gains `jsx: preserve` and
  `jsxImportSource: @opentui/solid`, keeping the existing `plugin/**/*.ts` include and adding
  `plugin/**/*.tsx` to it.
Evidence: official CLI-plugin docs ("Publish and load" — expose `./tui`; add OpenTUI peers when
  rendering JSX); node_modules/@opencode/plugin/package.json peer ranges; tsc probe with
  `skipLibCheck` passed without any additional type packages; npm registry probed — `@opentui/solid`
  0.5.14–0.5.17 declare `peerDependencies: { solid-js: "1.9.12" }`, installing with 1.9.17 fails
  ERESOLVE while 1.9.12 resolves; `@opentui/core` also auto-resolves its `web-tree-sitter@0.25.10`
  peer and prints advisory `EBADENGINE` warnings under Node 22/24 (engines `node >=26.4.0`).
Rejected alternatives: no JSX (not required — a host virtual-import, JSX-free slot pattern is
  field-validated; withheld as the slice-2 contingency); vendored type shims
  (maintenance burden, drift); skipping typecheck of the TUI entry (degrades `npm run verify`).
Strongest counterargument: newer @opentui type versions could drift from the runtime's bundled
  version; the smoke test exercises the real runtime and is the check.
Confidence: High.
Reopen triggers: the smoke shows a runtime/type mismatch; the host's peer ranges move; the
  package-TUI load path misbehaves (the known npm-spec loader class).
```

**Note E — rows 13, 17 (strip behavior and interim visibility).**
```text
Authority: AI — delegated by --auto-design
Eligibility: UX presentation of the user-approved minimal section.
Objective: an honest, minimal proof-of-life that cannot mislead.
Decision: the strip renders a single short line `CodeOps v<pluginVersion>` and only when the
  `status` RPC resolves; on failure it renders nothing. No timer, no polling, no session state in
  the spike (slice 2 owns the live behavior). If a release ships before slice 2, this line is the
  only user-visible addition and it is factually a status, not a progress claim.
Evidence: slice-1 acceptance criteria (slot renders; RPC round-trips); the brief's honesty rules
  (R5) favor no claim over a false claim.
Rejected alternatives: always-visible static text (cannot distinguish RPC failure); "loading"
  states (unneeded for a spike).
Strongest counterargument: a version-only line could look like a half-shipped feature to users;
  the CHANGELOG entry documents it as the TUI foundation.
Confidence: High.
Reopen triggers: the smoke shows slot render rules differ; slice-2 planning replaces the content.
```

**Note F — row 14 (smoke procedure).**
```text
Authority: AI — delegated by --auto-design
Eligibility: testing strategy within approved scope; no new committed harness.
Objective: prove on a real OpenCode v2 build that the packaged `./tui` entry loads, the sidebar
  slot renders, and the RPC round-trips — with reproducible evidence and no repository pollution.
Decision: `npm pack` into a temp destination; a scratch project under the temp root with
  `opencode.json` plugins ["opencode-codeops"] and the tarball installed; launch
  `opencode <scratch> --standalone --session <id> --print-logs` inside a pty with a large window
  (Python `pty` + `TIOCSWINSZ`, fallback `script -qec`), capture output, assert the strip text;
  fallback to user-assisted observation if pty capture is inconclusive. Record the exact OpenCode
  version as the tested minimum. A bounded temp-only entry-load pre-probe runs before the full
  smoke, and any missing strip is attributed to a layer (entry load, slot render, or RPC) from the
  captured logs before a conclusion is recorded; the known npm-spec loader failure class (silent
  no-paint, upstream issue #33884) and its documented workaround are carried as slice-2
  contingency inputs.
Evidence: `script` is available; tmux is not; the CLI accepts `--standalone`, `--session`, and
  `--print-logs` (probed via `opencode --help`); Python 3 is a runtime requirement of this repo.
Rejected alternatives: a committed smoke harness (the brief forbids building a new broad harness);
  tmux (not installed); background-service runs (isolation risk).
Strongest counterargument: pty byte-capture of an alternate-screen TUI can miss re-renders;
  mitigated by a generous capture window and the user-assisted fallback.
Confidence: Med — the rendering path is the spike's own risk, which is the point of the spike.
Reopen triggers: capture shows no strip although the RPC is proven — adjust method and repeat; the
  pre-probe or smoke implicates the host npm-spec TUI loader, in which case the attributed evidence
  and the documented workaround feed the slice-2 decision.
```

**Note G — rows 15, 18 (boundaries).**
```text
Authority: AI — delegated by --auto-design
Eligibility: scope containment within the user-approved slices; publication remains reserved and
  user-owned, so the plan performs none.
Objective: keep the change reviewable and reversible; keep slice 2 unentangled.
Decision: CHANGELOG `## Unreleased` entry (Fixes: parser counting; Notes: TUI foundation) is the
  only documentation; no README changes; no release task. The slice-2 brief stays with the user;
  slice-2 requirements will be re-derived when that decision is made.
Evidence: CHANGELOG.md release-note convention; AGENTS.md (release tooling owns versions);
  make-plan never releases.
Rejected alternatives: README section now (documents an incomplete feature); release task now
  (reserved authority); copying the brief into the plan (duplication; the plan cites intent only).
Strongest counterargument: an unreleased parser fix stays invisible to users until the user
  releases; the user controls timing and the CHANGELOG entry keeps it release-ready.
Confidence: High.
Reopen triggers: the user requests a release or README coverage in this scope.
```

**Note H — row 20 (payload validation placement).**
```text
Authority: AI — delegated by --auto-design
Eligibility: internal interface placement within the approved RPC contract; no product behavior
  change, no scope change.
Objective: validate the `unknown` RPC payload without unsafe casts and keep it testable.
Decision: `isCodeOpsStatus(value)` is exported from `bin/lib/codeops-rpc.mjs` (next to the
  definition); `plugin/tui.tsx` imports it. Node cannot run `.tsx` directly, so a guard inside the
  entry file could not be unit-tested; the helper can.
Evidence: standards ban `as any`/`as unknown` casts; Node 22.23 type stripping covers `.ts` but
  not `.tsx` (probed: `.ts` import works; JSX is not transformed).
Rejected alternatives: cast in the TSX (violates the standards); guard in a separate `.ts` module
  (second surface for one function).
Strongest counterargument: the helper now owns a slice-2-flavored concern; mitigated — it is the
  contract module, and slice 2 replaces the guard alongside the schema.
Confidence: High.
Reopen triggers: slice 2 adopts Standard Schema, making runtime narrowing unnecessary.
```

**Note I — row 21 (live-smoke method adaptation).**
```text
Authority: AI — delegated by --auto-design
Eligibility: testing strategy within approved scope; the recorded smoke intent (packed artifact
  loads; sidebar slot renders; RPC round-trips; tested build recorded) and the pre-authorized
  fallbacks (observed-limitation recording; user-assisted observation) are unchanged.
Objective: run the ST-12 smoke against the installed build with faithful, attributable evidence.
Decision: load the packed artifact through the host-supported file routes — the project discovery
  layout (`<project>/.opencode/plugins/opencode-codeops/` with root `index.ts`/`tui.tsx` shims
  re-exporting the packed `plugin/index.ts`/`plugin/tui.tsx`) and, as a cross-check,
  `opencode.json` `file://` directory specs; capture with a Python pty (160–240 cols) and scheduled
  key injection; attribute every missing strip by layer; record platform limitations and hand the
  visual confirmation to the user-assisted fallback.
Evidence: the host installs registry-name plugin specs into its own cache (unpublished versions
  cannot be registry-loaded); a tarball `file://` spec is rejected with "configured plugin path must
  be a directory"; `.ts` TUI entries fail to load with a JSX syntax error (`.tsx` required); the
  packed entries loaded with no errors via both file routes; `ctx.rpc.register` succeeds
  server-side (control-probe ground truth written to a file); `client.rpc(CodeOpsRpc).status({})`
  from the TUI fails with `{"type":"rpc.unavailable","message":"RPC is unavailable: codeops"}` on
  v2.0.24 in `--standalone` and against the shared service, reproduced with a minimal control RPC
  under both load routes; the `sidebar.content` pane did not render in any captured view
  (home/session/diff; 160–240 cols; leader-bind and palette routes explored).
Rejected alternatives: registry-spec install (impossible for the unpublished 2.1.1); `cli.json`
  path forms (inert in the isolated probe runs; not pursued further); a committed smoke harness
  (AR #14 boundary); driving the user's shared service harder than one smoke session (avoided
  state churn).
Strongest counterargument: file-route loading is not the registry install path users will have,
  and the client-bridge failure may be an artifact of the probe environment rather than the build.
  Mitigation: the failure was control-reproduced with a minimal plugin and across three routes,
  and registry-install behavior itself was directly observed (install failure for an unpublished
  name); all residuals are recorded for the go/no-go.
Confidence: High for the load and registration findings; Med for the client-bridge attribution
  (byte-level captured errors and a control plugin, but no upstream issue cross-reference yet).
Reopen triggers: an OpenCode build ≥2.0.26 (the 2.0.24 build already offered the update); an
  upstream confirmation about the client RPC bridge; a user-assisted observation contradicting the
  captured evidence.
Policy version: 1
Root invocation ID: AD-EX-LTS-20261010-1
```

**Other categories reviewed with no open items.** Feature gaps (slices are user-staged; slice 2
is explicitly out of scope). Behavioral gaps (guarded registration, render-only-on-success, and
fake-context tests cover the failure paths; no other state transitions exist in the spike).
Stakeholder conflicts (single user). Non-functional gaps (no polling; trivial RPC payload).
Integration points beyond the RPC (none — no skills, no plan artifacts, no agents change).
