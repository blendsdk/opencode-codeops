# Preflight Report: live-task-sidebar (slices 0–1)

> **Status**: ✅ PASSED — iteration 2: all 14 findings resolved and fixes applied + verified;
> zero carried-forward and zero new findings.
> **Iteration**: 2 (re-scan after fixes)
> **Artifact**: implementation plan at `plans/live-task-sidebar/` (8 documents; untracked in git)
> **Content hash**: `9ee627075532fbef45952bb9255bce6a771dfaecbc5f70a93d9babf5d9cc1bd1` — sha256 over
> the sorted per-file sha256 lines of the eight artifact documents, computed from within the plan
> directory (iteration 1 revision: `cc65370d824c56a41eb1f243905c999514643c1bcca339a038c98a1453d41d74`)
> **Codebase Grounded**: ≈45 repository/registry files examined; every artifact reference mapped —
> all verified except the opencode-binary internals noted under Verification Notes
> **Scope mode**: `strict` (no `--explore-scope`); no optional additions reported
> **Auto-design**: active — root invocation ID `AD-PF-LTS-20261010-1`, policy version 1. Eligible
> technical resolutions are recorded as delegated; reserved decisions remain user-owned.
> **Last Updated**: 2026-10-10 12:30

### Audit scope contract

| Term | Value |
|---|---|
| **Audit target** | `plans/live-task-sidebar/` — all 8 documents (00-ambiguity-register, 00-index, 01-requirements, 02-current-state, 03-01-parser-task-counting, 03-02-tui-foundation-spike, 07-testing-strategy, 99-execution-plan) |
| **Context documents** | `AGENTS.md`, `skills/*` consumers, `scripts/*` runtime code, installed SDK under `node_modules/@opencode/`, opencode CLI, upstream docs (opencode.ai/v2/docs/build/plugins/cli/) and issue tracker |
| **Modification set** | None yet — fixes apply only on explicit instruction |
| **Frozen product baseline** | Slices 0–1 as described in `00-index.md` (counting fix + live TUI spike); slice 2, README docs, and release actions are out of scope |

### Codebase Context Summary

**Tech stack:** OpenCode v2 plugin (`opencode-codeops` 2.1.1) — TypeScript server plugin (`plugin/index.ts`),
plain-JS helpers under `bin/lib/` (`*.mjs` + `*.d.mts`), Python tooling (`scripts/codeops_plan.py`),
Markdown skills, `node --test` on Node 22.23 locally / 24 in CI, Python 3.12.
**Architecture:** server plugin registers hooks (session/shell/tool/event) at setup; Markdown
artifacts are the single source of truth; `scripts/codeops_plan.py` is the read-only progress oracle
consumed by exec-plan, roadmap, upgrade-plan, setup-codeops, and migrate (in-process import).
**Key files examined:** `scripts/codeops_plan.py`, `plugin/index.ts`, `package.json`, `tsconfig.json`,
`CHANGELOG.md`, `scripts/check-version.mjs`, `scripts/release.mjs`, `scripts/codeops_plan_migrate.py`,
`bin/lib/opencode-plugin.mjs`, `bin/lib/reasoning-effort.{mjs,d.mts}`, `plugin/temp-lifecycle.spec.test.mjs`,
the five consumer skills, `plans/00-roadmap.md`, `.github/workflows/ci.yml`, and the installed
`@opencode/plugin` 2.0.24 SDK (host entry resolution, TUI context/slots, RPC domains, client RPC API).

**Independent verification beyond the lead scan:** the 13 dimensions were audited by 5 independent
preflight-auditor dispatches (clusters ① document soundness ② grounding ③ delivery ④ risk ⑤ fit);
high-severity recommendations were hardened by 1 blind challenger; all surviving major claims were
re-verified by the lead (registry probes, tarball inspection, upstream issue fetch, Bun transform
probe, parser corpus recount).

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 1 | 🟡 |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 1 | 🟡 |
| 4 | Completeness Gaps | 1 | 🟡 |
| 5 | Dependency Issues | 1 | 🟠 |
| 6 | Feasibility Concerns | 1 | 🟠 |
| 7 | Testability | 3 | 🟡 |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 | 🟡 |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 3 | 🟡 |
| 13 | Codebase Alignment | 2 | 🟡 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 2 | both resolved by delegated decision (PF-001, PF-002) |
| MINOR | 9 | 8 resolved by delegated decision; 1 carries a reserved ruling (PF-004) |
| OBSERVATION | 3 | adopted by delegated decision |

### Same-model bias & external-standard notes

- The artifact was authored earlier on 2026-10-10 (previous session), almost certainly by this same
  model family. Same-agent blind spots are mitigated by five independent auditor dispatches, one
  blind challenger, and lead re-verification of every surviving finding against code, the npm
  registry, the upstream docs, and the upstream issue tracker.
- External standards were verified by citing actual sources, not memory: the official OpenCode CLI
  plugin documentation (fetched), the npm registry metadata (fetched), the `@opentui/solid@0.5.17`
  tarball (downloaded and inspected), and upstream issue
  [anomalyco/opencode#33884](https://github.com/anomalyco/opencode/issues/33884) (fetched).
- **Adversarial check results:** (a) the assumption most at risk was "the packaged `./tui` entry will
  load and paint" — the upstream issue documents a silent-failure class on exactly that load path
  (PF-002); (b) the domain-expert challenge "is JSX even required for a slot?" is answered by field
  evidence of a JSX-free production pattern, falsifying AR #11's "no JSX (not possible)" note
  (folded into PF-002); (c) no security or scope-creep concerns survived verification.

---

## Findings

### PF-001: `solid-js@1.9.17` devDependency cannot install with `@opentui/solid@0.5.17` 🟠 MAJOR

**Dimension:** 5 — Dependency Issues (13 — Dependency Reality)
**Location:** `00-ambiguity-register.md` AR #11 + Note D; `03-02-tui-foundation-spike.md` §Component D
table; `02-current-state.md` §External Dependencies
**Codebase Evidence:** npm registry — `@opentui/solid` 0.5.14–0.5.17 declare
`peerDependencies: { "solid-js": "1.9.12" }` (exact pin); reproduced:
`npm install --dry-run @opentui/core@0.5.17 @opentui/solid@0.5.17 solid-js@1.9.17` → ERESOLVE
(exit 1); identical command with `solid-js@1.9.12` → resolves (109 packages). `@opentui/core@0.5.17`
declares peer `web-tree-sitter@0.25.10` (auto-installed) and engines `node >=26.4.0` /
`bun >=1.3.0` → `EBADENGINE` warnings under local Node 22.23 and CI Node 24 (advisory unless the
repo enables `engine-strict`).

**The Problem:** Task 2.1.4's gate (`npx tsc --noEmit` clean) and every `npm install`/`npm ci` fail
as pinned. AR #11's selection rule ("latest stable satisfying the SDK's peer ranges") filtered only
the SDK's own ranges (`>=0.5.14` / `>=1.9.0`) and missed `@opentui/solid`'s transitive exact peer
pin. No `@opentui/solid` release compatible with `solid-js@1.9.17` exists (0.5.14–0.5.17 all pin
1.9.12).

**Options:**

| Option | Description | Verdict |
|--------|-------------|---------|
| A | Pin devDependency `solid-js@1.9.12`; keep the published optional peer range `>=1.9.0`; note the auto-installed `web-tree-sitter` peer and the engine warnings | Only installable path; challenger converged |
| B | Keep `1.9.17` and force resolution via npm `overrides` / `--legacy-peer-deps` | Rejected: forces a combination the host package explicitly rejects, must be replicated in CI, leaves override metadata |

**Recommendation:** Option A.
**Resolution (delegated):** `AI — delegated by --auto-design` → adopt A; also update the AR #11
Note D rationale text (the selection rule that produced 1.9.17 was wrong).

### PF-002: Packaged TUI entry sits on a known-failing npm-spec loader class with a silent failure mode 🟠 MAJOR

**Dimension:** 6 — Feasibility Concerns (13 — Impact Blindness)
**Location:** `03-02-tui-foundation-spike.md` §Component D (packaging) + §Error Handling;
`07-testing-strategy.md` ST-12; `02-current-state.md` §Risks ("Low"); `00-ambiguity-register.md`
AR #11 (rejected alternative "no JSX (not possible)")
**Codebase Evidence:**
1. **Verified — transform exclusion:** `@opentui/solid@0.5.17`'s Solid transform hardcodes a
   `node_modules` exclusion (`package/scripts/solid-plugin.js:38-39`,
   `(?!.*[/\\]node_modules[/\\])`), verified by downloading and inspecting the registry tarball.
   Files under `node_modules` (how packaged plugins load) skip that transform.
2. **Verified — Bun transform behavior:** Bun 1.3.14 probe — with no discoverable
   `jsxImportSource`, a packaged TSX entry transpiles to `react/jsx-dev-runtime`; with a
   `tsconfig.json` carrying `jsxImportSource: "@opentui/solid"` (package-local **or** project-root)
   it emits `@opentui/solid/jsx-dev-runtime`.
3. **Verified — upstream issue:** [anomalyco/opencode#33884](https://github.com/anomalyco/opencode/issues/33884)
   (open; still reproducing on 1.18.11/1.18.21 and the v2 line through 2026-09-21 at least):
   npm-spec TUI plugins loading from under `node_modules` fail to load, or load and **silently
   never paint** (renderer-instance skew), with no visible error. Field workaround: `file://`
   reference outside `node_modules`, or host virtual `opentui:runtime-module:*` imports with
   hand-written `jsx()` calls and no JSX syntax — production-validated on the v2 line. The plan's
   target build is v2.0.24 (later than every reported data point; status unknown).
4. **Repo facts:** `npm pack --dry-run` ships no `tsconfig.json`; the plan ships raw
   `plugin/tui.tsx`; the plan's error table routes an entry-load failure to "recorded for slice 2"
   without attribution; 02-current-state rates the load-behavior risk "Low".

**The Problem:** The plan's decisive acceptance evidence (ST-12: packaged entry loads, the strip
renders, RPC round-trips) sits exactly on a documented loader class with a **silent** failure mode.
If it fires, the recorded outcome could not distinguish a packaging/config problem from a host
limitation from an RPC failure — risking a misleading no-go input for the slice-2 decision. The
artifact also asserts the mechanism is simple ("the official documented pattern") without any
loader-failure contingency, and AR #11 labels a JSX-free construction "not possible" when the
field-validated workaround proves otherwise.

**Options:**

| Option | Description | Verdict |
|--------|-------------|---------|
| A | Bounded temp-only pre-probe of the installed build's package-TUI load path before committing the full smoke; extend ST-12 with failure-layer attribution (`--print-logs`, distinguish entry-load error / silent no-paint / slot miss / RPC miss); correct the risk rating and the error-handling row; ship a minimal package-local runtime tsconfig in `files` only if the probe shows `react/jsx-*` emission (partial mitigation only — does not fix instance skew); record the host-blocker workaround as a slice-2 contingency input | Recommended (challenger-refined) |
| B | Rely on the smoke alone; extend only the evidence notes | Rejected: silent failures stay unattributable |
| C | Preemptively redesign the entry as JSX-free | Rejected: over-scoped for the spike; keep as slice-2 contingency |

**Recommendation:** Option A.
**Resolution (delegated):** `AI — delegated by --auto-design` → adopt A (pre-probe + attribution +
doc corrections; contingency recorded, not built).
**Hardening:** Challenger: converged — independently pushed further (documented silent-failure mode
and the node_modules transform exclusion; dropped the initial "ship tsconfig" idea as the primary
fix). One challenger claim (package-local tsconfig inert) is contradicted by the lead's own probe
(package-local tsconfig does steer the native transform); the adopted option therefore relies only
on verified facts. The plan's `02-current-state` risk row and `03-02` §Error Handling must be
corrected. Confidence: Med-High — v2.0.24's behavior is exactly what the pre-probe settles.

### PF-003: ST-4 expected output cannot be satisfied as written 🟡 MINOR

**Dimension:** 3 — Logical Contradictions (also 7 — Testability)
**Location:** `07-testing-strategy.md` §Specification Test Cases, ST-4
**Codebase Evidence:** the row's input is five tasks — `[ ]`, `[~]`, `[x]`, `[!] Blocked: reason`,
plus one `[!]` without a reason — but the expected "Counts 1/1/1/1"; `scripts/codeops_plan.py:147-150`
counts every parsed `[!]` (blocked would be 2), and the reason-less problem is only produced for
parsed tasks (`:148-149`). Additionally `inspect_plan` adds "missing required 00-index.md" and
"must declare **Implements**" problems (`:137-143`) — six of the nine pre-existing repo plans
(mini-plans without `00-index.md`) report exactly those — so "exactly one problem" requires a
complete plan-directory fixture.

**The Problem:** The spec test contradicts its own input and fixture shape; under the immutable-oracle
rule an author pinning `blocked=1` asserts behavior no correct implementation can produce.
**Options:** Single viable correction — change the expectation to `1/1/1/2` (total 5) and state the
fixture is a complete plan directory (or scope the problem assertion to the counting problem);
optionally split the reason-less case into its own ST row.
**Recommendation:** Correct to `1/1/1/2` plus the fixture-completeness statement.
**Resolution (delegated):** adopt (four independent auditors converged).

### PF-004: Migrator consumer impact — wrong integration statement + undecided admission behavior 🟡 MINOR

**Dimension:** 13 — Migration & Compatibility (4 — Completeness)
**Location:** `03-01-parser-task-counting.md` §Integration Points; `02-current-state.md` §Consumers;
`01-requirements.md` §Compatibility
**Codebase Evidence:** `scripts/codeops_plan_migrate.py:20-22` imports `parse_tasks` **in-process**
(not the `--json`/`--progress-bar` output the plan names); `:233-235` turns an empty task tuple into
a "contains no execution tasks" problem; `:302-304` exits 1 on any problem; the setup-codeops skill
refuses `--apply` on any problem/BLOCKED entry. Under the id gate, a plan whose checkbox lines all
lack ids flips to that problem — a migration-admission change for that input class. There are no
migrator tests. No evidence exists that any real legacy plan is affected (all nine repo plans are
id-clean).

**The Problem:** The plan claims "consumers need no change" while one in-process consumer's admission
control changes for a corner input class; the description of how that consumer reads the parser is
factually wrong.
**Options:**

| Option | Description | Nature |
|--------|-------------|--------|
| A | Correct the wording; explicitly record the admission change in the compatibility contract + CHANGELOG; no migration code change | Eligible part (wording) delegated and adopted |
| B | Preserve migration admission unchanged — make the migrator's presence check tolerant of any checkbox line, plus a regression fixture | **Reserved — expands the plan's modification set by one file**; challenger-recommended as technically strongest |

**Recommendation:** B if you accept the one-file expansion (keeps the compatibility promise literally
true); A otherwise.
**Resolution:** factual wording correction adopted by delegation; **User Decision: User chose Option B**
(preserve migration admission unchanged — presence-tolerant check in `codeops_plan_migrate.py` plus a
regression fixture; the one-file expansion of the plan's modification set is explicitly authorized by
the user).

### PF-005: `package-lock.json` missing from changed-file lists; no explicit install step 🟡 MINOR

**Dimension:** 4 — Completeness Gaps
**Location:** `00-index.md` §Related Files; `02-current-state.md` §Relevant Files; `99-execution-plan.md`
task 2.1.4
**Codebase Evidence:** `.github/workflows/ci.yml` runs `npm ci --ignore-scripts` (fails when the
lockfile and `package.json` diverge); `npx tsc --noEmit` needs the new devDeps installed.
**The Problem:** An executor following the file lists literally can stage `package.json` without the
regenerated lockfile → CI failure; the install step is implied but never stated.
**Resolution (delegated):** adopt — add an explicit `npm install` step to task 2.1.4 and
`package-lock.json` to both changed-file lists.

### PF-006: FR-9 failure branch has no verification method 🟡 MINOR

**Dimension:** 7 — Testability
**Location:** `07-testing-strategy.md` ST-9/§Implementation Tests; `01-requirements.md` FR-9;
`03-02` §Component C
**Codebase Evidence:** FR-9 requires "on failure it renders nothing"; ST-9 asserts slot claim,
helper import, no timer, guarded wiring; ST-12 proves only the success path; impl tests cover the
`isCodeOpsStatus` guard, not the component; Node cannot execute `.tsx`, so the component itself is
not unit-testable.
**The Problem:** No planned check maps to FR-9's failure branch; an unconditional strip would pass
every planned test.
**Resolution (delegated):** adopt — extend ST-9's expected behavior with conditional-render
assertions (payload routed through `isCodeOpsStatus`; no unconditional strip text), keeping manual
review of the TSX as the residual check.

### PF-007: tsconfig include wording can silently drop `plugin/index.ts` from the program 🟡 MINOR

**Dimension:** 1 — Ambiguities
**Location:** `03-02` §Component D row; `99-execution-plan.md` task 2.1.4
**Codebase Evidence:** `tsconfig.json:13` — `"include": ["plugin/**/*.ts"]`; no `.tsx` file will
import `plugin/index.ts`, so replacing the list with `plugin/**/*.tsx` removes the server entry from
the typecheck while `npm run verify` still passes.
**The Problem:** "include `plugin/**/*.tsx`" is ambiguous (add vs replace); the wrong reading
silently narrows verification.
**Resolution (delegated):** adopt — state "keep `plugin/**/*.ts`; add `plugin/**/*.tsx`" (or
`plugin/**/*.{ts,tsx}`).

### PF-008: New plugin test files would be published in the npm tarball 🟡 MINOR

**Dimension:** 13 — Convention Violations (packaging)
**Location:** `03-02` §Component D ("`files` already includes `plugin/`, so `tui.tsx` ships without
further changes"); `07` §Test Categories; ST-8
**Codebase Evidence:** `package.json` `files` negates test files for `scripts/` and `bin/`
(`!scripts/*.spec.test.mjs`, `!bin/*.spec.test.mjs`) but has no `plugin/` negation;
`npm pack --dry-run` currently ships `plugin/temp-lifecycle.spec.test.mjs` (118 files); the plan
adds two more plugin test files.
**The Problem:** The plan acknowledges only that `tui.tsx` ships; the two new test files (and the
pre-existing one) ship too, contrary to the repository's own convention; ST-8 checks inclusion,
not test exclusion.
**Resolution (delegated):** adopt — add `"!plugin/*.test.mjs"` and `"!plugin/*.spec.test.mjs"`
(mirroring scripts/bin), extend ST-8 to assert tests are not packed; fixes the pre-existing leak as
a side effect.

### PF-009: Fence semantics under-specified (closing rules, indentation, mixed characters) 🟡 MINOR

**Dimension:** 9 — Edge Cases (1 — Ambiguities)
**Location:** `03-01-parser-task-counting.md` §Counting Rule / §Error Handling;
`07-testing-strategy.md` §Implementation Tests
**Codebase Evidence:** the rule says only "strip fenced blocks (` ``` ` or `~~~`, with optional info
strings); unclosed = to EOF" — no closing-fence rules (same character, length ≥ opening, ≤3 leading
spaces per CommonMark), no indented-fence handling, no mixed-character behavior. Two literal
implementations diverge; a stray closing fence silently drops real tasks to EOF. Probed: no repo
plan uses indented/mixed fences, so FR-5/ST-3 parity is unaffected today; third-party/hand-authored
plans are the impact class.
**Resolution (delegated):** adopt — pin the closing/indentation semantics in the rule text and add
impl cases (indented fence, mixed characters, stray close).

### PF-010: Node test-toolchain floor not recorded 🟡 MINOR

**Dimension:** 12 — Consistency
**Location:** `01-requirements.md` §Compatibility ("Node engine stays `>=18`; CI runs Node 24"); `07`
**Codebase Evidence:** ST-11 imports `plugin/index.ts` under `node --test`, which requires Node
≥22.18 for default type stripping (probed OK on 22.23.1); `package.json` `engines` remains `>=18`;
no minimum test Node is recorded anywhere.
**The Problem:** A contributor on Node 18–22.17 (allowed by `engines`) cannot pass `npm run verify`,
and the plan does not say so.
**Resolution (delegated):** adopt — record "verify requires Node ≥22.18 (CI Node 24)" in
`01` §Compatibility and `07`.

### PF-011: Plan file inventories omit `plugin/tui-foundation.impl.test.mjs` 🟡 MINOR

**Dimension:** 12 — Consistency
**Location:** `00-index.md` §Related Files (New); `02-current-state.md` §Relevant Files (Test files row)
**Codebase Evidence:** `99-execution-plan.md` task 2.1.5, `03-02` §Testing Requirements, and `07`
§Implementation Tests all create the file; both inventories omit it.
**Resolution (delegated):** adopt — add it to both lists.

### PF-012: ST-10 lacks the partial-API containment case 🔵 OBSERVATION

**Dimension:** 7 — Testability
**Location:** `07-testing-strategy.md` ST-10; `03-02` §Component A contract point 1
**Codebase Evidence:** the contract returns `false` when `ctx.rpc.register` is not a function
(older/partial builds); ST-10 covers (a) no `rpc`, (b) throwing `register`, (c) working `register`;
the intermediate shape `rpc: {}` (or a non-function `register`) — the exact input the contract
exists for — is untested.
**Resolution (delegated):** adopt — add case (d): `rpc: {}` (and/or `register: 42`) → `false`, no
throw.

### PF-013: ST-2 input lines omit the task id 🔵 OBSERVATION

**Dimension:** 7 — Testability
**Location:** `07-testing-strategy.md` ST-2
**Codebase Evidence:** the row shows `- [ ] First` / `- [x] First again`; taken literally, the id
gate yields total 0, contradicting the stated expected total 1.
**Resolution (delegated):** adopt — write `1.1.1` into both input lines.

### PF-014: Execution-plan task 3.1.1 references the wrong section 🔵 OBSERVATION

**Dimension:** 12 — Consistency
**Location:** `99-execution-plan.md` task 3.1.1 — "Reference: 03-02 §Component D (smoke)"
**Codebase Evidence:** Component D is packaging/configuration and contains no smoke procedure; the
procedure lives in AR #14 Note F, `07` ST-12, and `03-02` §Testing Requirements.
**Resolution (delegated):** adopt — correct the reference.

---

## Delegated Resolution Provenance (auto-design, policy version 1)

Root invocation ID: `AD-PF-LTS-20261010-1`. All records below use the canonical marker
`Authority: AI — delegated by --auto-design`. Eligibility in every case: implementation mechanism,
dependency pin, testing strategy, failure/attribution design, or documentation accuracy **inside**
the user-confirmed slices 0–1; no product behavior, scope, or reserved-authority consequence —
except PF-004's behavior ruling, which is reserved and presented to the user.

| PF | Eligibility / Objective | Decision | Evidence | Rejected alternatives | Strongest counterargument | Confidence | Reopen triggers |
|----|------------------------|----------|----------|----------------------|---------------------------|------------|-----------------|
| 001 | Dependency mechanism; installable typecheck tree | Pin `solid-js@1.9.12` devDep; keep published optional peer `>=1.9.0`; note web-tree-sitter peer + engine warnings | Registry peer metadata; reproduced ERESOLVE vs clean resolve; challenger converged | npm overrides / `--legacy-peer-deps` (forces rejected combination; CI replication; override metadata) | 1.9.12 is not "latest" — but it is the only version @opentui/solid 0.5.17 accepts, and it is the version the host package itself builds against | High | a newer @opentui/solid widens its solid-js peer |
| 002 | Testing strategy + failure attribution within the spike's own purpose | Bounded pre-probe of the package-TUI load path; ST-12 failure-layer attribution; correct risk/error rows; conditional tsconfig mitigation; record host-blocker contingency | Verified tarball filter; verified Bun transform probe; verified open upstream issue #33884 (silent failures on the exact load class) | Rely on smoke alone (silent failures unattributable); preemptive JSX-free redesign (over-scoped) | v2.0.24 may already have fixed the loader, making the probe ceremony — but attribution of a failure is the plan's decisive output; probe cost is one temp setup | Med-High | probe shows the loader healthy on 2.0.24 (drop the contingency note); or shows the known failure (escalate with attributed evidence) |
| 003 | Test-oracle correction; FR-4 unchanged | Correct ST-4 to `1/1/1/2` + full-fixture statement (or split row) | Parser counting semantics (`codeops_plan.py:147-150`); fixture problem sources (`:137-143`); 4 auditors converged | leave as-is (unsatisfiable oracle) | "1/1/1/1" could be read as counts of the first four markers only — but then the fifth task's problem is unexplained and the row still fails its own assertion | High | — |
| 004 | Documentation accuracy (factual correction) + user-ruled admission preservation | Correct `03-01` §Integration Points to name the in-process import; **user ruled Option B** — presence-tolerant migrator check + regression fixture (file-scope expansion user-authorized) | `codeops_plan_migrate.py:20-22,233-235,302-304`; setup-codeops apply gate | leave the wrong sentence; Option A (accept the admission change) — declined by the user | the sentence is merely imprecise, not dangerous — but compatibility claims must be accurate | High | user picks A or B below → ruled B |
| 005 | Delivery completeness within the plan's own change surface | Add explicit `npm install` to task 2.1.4; add `package-lock.json` to both file lists | `ci.yml` `npm ci`; task 2.1.4 gate | none viable (CI fails otherwise) | the executor might commit the lockfile anyway — but the plan must not rely on that | High | — |
| 006 | Verification of an accepted requirement (FR-9) using the existing content-test pattern | Extend ST-9 with conditional-render assertions | FR-9; ST-9/ST-12 coverage gap; `.tsx` not unit-testable under Node | accept as review-only risk (weaker) | content assertions are weaker than behavioral tests — but the component cannot run under the repo's test runner; the smoke covers the success path | High | slice 2 replaces the component with testable helpers |
| 007 | Verification integrity | State "keep `plugin/**/*.ts`; add `plugin/**/*.tsx`" | `tsconfig.json:13`; silent typecheck narrowing otherwise | none viable | natural reading may already imply "add" — the explicit wording is free | High | — |
| 008 | Packaging convention parity with `scripts/`/`bin/` | Add `!plugin/*.test.mjs` + `!plugin/*.spec.test.mjs`; extend ST-8 | `package.json` files block; `npm pack --dry-run` ships `plugin/temp-lifecycle.spec.test.mjs` today | accept shipped tests (violates the repo's own exclusion pattern) | removing files from the tarball could break someone importing them — but the `exports` map does not expose them, so nothing importable is removed | High | — |
| 009 | Parser spec precision for the authorized fencing behavior | Pin CommonMark-style closing/indentation semantics + 3 impl cases | `03-01` rule text ambiguity; probed repo impact zero | leave implicit (implementation divergence; silent miscount) | the repo corpus is unaffected today — but the counting rule is normative for third-party plans | High | a supported plan format legitimately relies on other fence forms |
| 010 | Compatibility documentation accuracy | Record "verify requires Node ≥22.18 (CI Node 24)" | probed type-stripping availability; `engines >=18`; CI Node 24 | none viable | no user is actually blocked by this today — it is documentation completeness | High | test suite stops importing `.ts` |
| 011 | Documentation accuracy | Add `plugin/tui-foundation.impl.test.mjs` to both inventories | tasks and testing docs all create it; inventories omit it | none viable | none material | High | — |
| 012 | Containment-proof coverage | Add ST-10 case (d) `rpc: {}` / non-function register | contract point 1; ST-10 misses the exact "not a function" input | accept untested (cheap to add) | marginal test value | High | — |
| 013 | Test-case writability | Write `1.1.1` into ST-2's input lines | literal reading contradicts expected total | none viable | shorthand may have been intended — explicit is free | High | — |
| 014 | Cross-reference accuracy | Point task 3.1.1 at AR #14 / `07` ST-12 | Component D contains no smoke procedure | none viable | ST-12 is already cited on the same line | High | — |

**PF-004 ruling (user decision — recorded 2026-10-10):**

| Option | Effect | File-scope impact | Outcome |
|--------|--------|-------------------|---------|
| A | Accept the narrower migration admission; document it in the compatibility contract + CHANGELOG | none | Not chosen |
| B | Preserve migration admission exactly — presence-tolerant check in `codeops_plan_migrate.py` + regression fixture | adds `scripts/codeops_plan_migrate.py` (and a test) to the plan's modification set | **User Decision: User chose Option B** |

**Recorded:** `Resolved — User chose Option B`. The file-scope expansion (adding
`scripts/codeops_plan_migrate.py` and a migrator regression test to the plan's modification set) is
explicitly authorized by the user; the fix scope for PF-004 is now B.

---

## Verification Notes

- **Verified by the lead directly:** all artifact file:line references (parser, plugin, skills,
  package/tsconfig, SDK typings, CI, roadmap); parser corpus statistics recounted (nine pre-existing
  plans: 73 `N.N.N` + 31 `T.N.N` = 104 id-prefixed task lines, zero non-id/fenced/duplicate
  checkbox lines; ten plans including this one: 117/117) — every existing total is preserved;
  CLI flags (`--standalone`, `--session`, `--print-logs`); `script` present / `tmux` absent; Node
  22.23.1 type-stripping import of `plugin/index.ts`; `TMPDIR`/`HOME` per-call env honoring
  (needed by the fake-context containment tests); official docs pattern; npm registry metadata;
  `@opentui/solid@0.5.17` transform filter; upstream issue #33884; `npm pack --dry-run` contents;
  Bun JSX transform probe.
- **Not verified by the lead:** the auditor-reported extraction of the installed opencode binary's
  internals (the binary lives under a hidden path that is off-limits to this session's access
  rules). The equivalent externally verifiable facts (transform filter, upstream issue) were
  verified instead, and no finding depends on the unverified extraction.
- **Security cluster:** no findings. The `status` RPC takes no input, reads no files, and returns
  two version strings plus a project directory already exposed to connected clients; the counting
  regexes are linear (no ReDoS); guard failures emit content-free warnings only.
- **Scope-creep cluster:** no findings. No slice-2 machinery appears in executable form; the only
  new support surface is the AR #11 dependency set, which the user pre-approved.
- **Ordering cluster:** no findings. Specification-first order holds (spec tests before
  implementation in both phases); Phase 1 and Phase 2 are file-disjoint; Phase 3 depends on Phase 2
  — confirmed against the real module boundaries.

## Iteration 2 — Fix Verification (2026-10-10 12:30)

Fixes were applied on explicit user instruction ("apply all fixes"); the artifact was re-checked
against the iteration-1 findings, their direct consequences, and the unchanged audit target.
New revision content hash: `9ee627075532fbef45952bb9255bce6a771dfaecbc5f70a93d9babf5d9cc1bd1`.

| PF | Fix applied | Verified |
|----|-------------|----------|
| 001 | AR #11 row + Note D; 03-02 §Component D; 02 deps table — `solid-js@1.9.12`, revised rationale + evidence (peer pin, auto `web-tree-sitter` peer, `EBADENGINE` note) | Pin matches the installable combination (registry metadata re-checked); no stale `1.9.17` pin remains in any plan document (grep) |
| 002 | 03-02 §Component D + §Error Handling + §Testing Requirements; 02 §Risks; AR #11 Note D + Note F; 07 ST-12 + E2E row; 99 task 3.1.1 + Reference | Pre-probe, layer attribution, risk rating, and host-blocker contingency recorded consistently across all five documents; AR #11's "no JSX (impossible)" corrected to the field-validated JSX-free contingency |
| 003 | 07 ST-4 → `1/1/1/2` + fixture-completeness; 07 §Test Data fixtures | Expected counts now match the stated 5-task input and the parser's counting semantics (`codeops_plan.py:147-150`) |
| 004 (B) | 01 FR-12 + §Compatibility + AC 1; 03-01 §Integration Points + §Compatibility Contract + §Testing Requirements; 02 consumers + files; 07 ST-13 + test tables + fixtures; 99 task 1.1.1/1.1.4, Phase 1 deliverables/table/total, success criterion 1 | ST-13 derived from FR-12; task count consistent at 14 (header, phase table, totals, oracle probe `0/14`); migrator admission change no longer claims CLI-output consumption |
| 005 | 99 task 2.1.4 (`npm install`); 00-index + 02 changed-file lists (`package-lock.json`) | Lockfile now in both lists; install step before the typecheck gate |
| 006 | 07 ST-9 conditional-render assertions | FR-9 failure branch now has a stated verification method |
| 007 | 03-02 §Component D tsconfig row; 99 task 2.1.4 | "Keep `.ts` + add `.tsx`" wording removes the silent typecheck-narrowing reading |
| 008 | 03-02 §Component D `files` rows; 07 ST-8 | Negations mirror scripts/bin; ST-8 checks exclusion; pre-existing leak noted |
| 009 | 03-01 §Counting Rule + §Error Handling; 07 impl-tests row | Closing/indentation/mixed/stray semantics pinned; three impl cases added |
| 010 | 01 §Compatibility; 07 §Testing Overview | Node ≥22.18 test floor recorded; `engines >=18` still accurate for the package |
| 011 | 00-index §Related Files; 02 §Relevant Files | `plugin/tui-foundation.impl.test.mjs` present in both inventories |
| 012 | 07 ST-10 case (d) | Partial-API containment shape covered |
| 013 | 07 ST-2 input lines | Ids written into the literal inputs |
| 014 | 99 task 3.1.1 Reference | Points at 03-02 §Component D + §Testing Requirements · 07 ST-12 · AR #14 (Note F) |

**Regression check:** no new findings introduced — the edits are self-consistent (FR-12 ↔ ST-13 ↔
task 1.1.4 ↔ deliverables), all cross-references resolve, and the counts are coherent (14 tasks,
0/14). `npm run verify` passes (295 tests, version parity ok). The progress oracle reads the plan
as `Ready (0/14 verified)` with no problems.

**Iteration 2 verdict:** ✅ **PASSED — 14/14 findings resolved and verified; 0 carried forward;
0 new findings.** No further iteration is required. The fixes are plan-document edits only; the
implementation work happens through `exec-plan`.

## Roadmap

`plans/00-roadmap.md` row `REQ-LIVE-TASK-SIDEBAR` advanced to `Plan Preflighted` (🔬) on
2026-10-10, after the iteration-2 verification.

**Next steps:** run `exec-plan live-task-sidebar` to begin execution (specification-first, starting
with task 1.1.1).
