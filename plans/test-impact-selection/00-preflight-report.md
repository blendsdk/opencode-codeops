# Preflight Report: Test Impact Selection

> **Status**: ✅ PREFLIGHT PASSED WITH NOTES — 30 fixes applied; iteration 2 targeted verification and full `npm run verify` passed (682 tests, 0 fail)
> **Verdict**: ✅ PASSED WITH NOTES — all 30 accepted fixes applied to the plan; no unresolved findings
> **Iteration**: 2 (fix verification)
> **Artifact**: Implementation plan at `plans/test-impact-selection/`
> **Audit target**: All 13 files in `plans/test-impact-selection/` (the report itself is not part of the audited snapshot)
> **Artifact snapshot (pre-fix)**: combined SHA-256 of the 13 sorted plan files = `066de2e1118292bb75adec521ac0e1ea5b9c834b7dc0165f5f186ca67628c9eb`
> **Artifact snapshot (post-fix)**: combined SHA-256 of the same 13 files = `5b49289913de42f54ca08430598844489e6b3a9972d3cbccf3d64c3eb609fce1`
> **Scope mode**: Strict (no `--explore-scope`); no `SE-*` proposals; no findings based on optional new functionality
> **Auto-design**: Not active; every material ruling requires the user's explicit decision
> **Modification set**: 30 findings applied across the 13 plan documents; this report and the roadmap row were updated. No code, skill, or standards file was changed.
> **Codebase Grounded**: 25 source/config/test files examined; 31 plan references mapped (29 verified, 2 approximate)
> **Last Updated**: 2026-11-12 00:20

### Audit Scope Contract

| Role | Contents |
| --- | --- |
| **Audit target** | The 13 documents in `plans/test-impact-selection/` (AR, index, requirements, current state, 03-01 … 03-07, testing strategy, execution plan) |
| **Context documents** | `AGENTS.md`; `standards/coding-standards.md`; `standards/coding-standards-full.md`; `skills/make-plan/{SKILL.md,templates.md,quality-checklist.md}`; `skills/exec-plan/{SKILL.md,execution-protocol.md,commit-modes.md}`; `skills/git-commit/SKILL.md`; `skills/analyze-project/SKILL.md`; `_shared/spec-first-ordering.md`; `package.json`; `.github/workflows/{ci.yml,release.yml}`; `plugin/index.ts`; `bin/index.mjs`; `bin/install-skills.mjs`; `scripts/{hygiene-content,specialist-content,discovery-content,reasoning-effort-content}.spec.test.mjs`; `scripts/{codeops_worktree_snapshot.py,codeops_plan.py}`; `plans/00-roadmap.md`; `plans/discovery-ui-redesign/99-execution-plan.md` |
| **Modification set** | None. No fixes applied. `plans/00-roadmap.md` was not advanced. |

**Same-agent bias note:** The plan is untracked and was authored at 2026-11-11 23:36, before this review session. No same-session creation was observed. The adversarial checklist was still applied, and one independent challenger reviewed the critical/major batch.

---

## Codebase Context Summary

**Repository:** `opencode-codeops` — a CodeOps plugin for OpenCode.

**Tech Stack:** Node.js ≥ 18 ESM (CI uses Node 24), TypeScript plugin entry (`plugin/index.ts`), React 19 + Fluent UI Discovery page, Python tooling under `scripts/`, `node:test` test suite, GitHub Actions CI/release.

**Architecture observed:**

- `plugin/index.ts` loads both standards files once and injects them into every request (`plugin/index.ts:64-76`, injection at `:284-288`).
- `skills/` and `_shared/` are Markdown behavior sources; `bin/install-skills.mjs` copies every directory containing `SKILL.md` (`bin/install-skills.mjs:111-123`), so a new skill needs no manifest entry.
- `bin/lib/` holds framework-free `.mjs` helpers with `.d.mts` declarations; `bin/index.mjs` is the installer CLI only (`bin/index.mjs:32-60`), with `install`, `update`, `status`, `uninstall`, `help`.
- `package.json` `files` includes `bin/`, `skills/`, `_shared/`, `standards/`, `schemas/`, and excludes `bin/*.test.mjs` / `bin/*.spec.test.mjs`; it does not exclude fixtures.
- `scripts/hygiene-content.spec.test.mjs:108-117` requires every skill `SKILL.md` to link `_shared/workspace-hygiene.md`.
- The phase baseline tree is real: `scripts/codeops_worktree_snapshot.py` records committed, staged, unstaged, and untracked files; the exec-plan protocol writes it into the phase header (`skills/exec-plan/execution-protocol.md:51-66`).
- The repository has no `.github/CODEOWNERS`; `codeops/` is not gitignored; `codeops/test-map/` can be committed.
- The roadmap row for this feature is `Plan Created` (`plans/00-roadmap.md:32`); a blocked preflight does not advance it.

**Key observations:**

- The plan's line references to standards and skills are largely accurate. `standards/coding-standards.md:32-34`, `standards/coding-standards-full.md:74-75` and `:107-121`, `skills/make-plan/templates.md:481`, `skills/make-plan/SKILL.md:236-238`, `skills/exec-plan/SKILL.md:180-198` and `:214-222`, `skills/git-commit/SKILL.md:17`, `skills/analyze-project/SKILL.md:13-27`, `.github/workflows/ci.yml:24-25`, and `.github/workflows/release.yml:69-70` were verified.
- `plans/discovery-ui-redesign/99-execution-plan.md:199` does record `npm run verify` passing 675 tests.
- `plugin/index.ts:64-76` is the standards **loading** block; the actual injection is `:284-288`. This is the only approximate line cite found (PF-030).
- `scripts/codeops-test.mjs` in the map example is a project wrapper described by `03-06`, not a phantom path; the packaged CLI is `bin/codeops-test.mjs`.

**Reference verification:** 31 references mapped — 29 verified against the codebase, 2 approximate (`plugin/index.ts:64-76`; `scripts/codeops-test.mjs` is a wrapper concept rather than an existing file). No phantom component or module references were found.

---

## Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 3 | 🟠 MAJOR |
| 2 | Implicit Assumptions | 1 | 🟡 MINOR |
| 3 | Logical Contradictions | 2 | 🟠 MAJOR |
| 4 | Completeness Gaps | 6 | 🟠 MAJOR |
| 5 | Dependency Issues | 2 | 🟠 MAJOR |
| 6 | Feasibility Concerns | 2 | 🟡 MINOR |
| 7 | Testability | 1 | 🟠 MAJOR |
| 8 | Security Blind Spots | 2 | 🟠 MAJOR |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 1 | 🟡 MINOR |
| 12 | Consistency | 5 | 🟠 MAJOR |
| 13 | Codebase Alignment | 5 | 🔴 CRITICAL |

**Scope-creep note:** AR-1 contains the complete Complexity Escalation Gate evidence (original goal, extra machinery, why, repository evidence, smallest solution, extra cost, independent `Simplify` verdict, direct user decision). The plan's map/selector/skill/CI surface stays within that approved packet. No unapproved material support surface was found; no scope-creep finding is raised.

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1 | fixed — see Fixes Applied |
| MAJOR | 12 | fixed — see Fixes Applied |
| MINOR | 15 | fixed/accepted — see Fixes Applied |
| OBSERVATION | 2 | accepted — docs/citation aligned |

---

## Hardening & Challenger

One independent challenger reviewed the CRITICAL/MAJOR batch with the codebase context and without the auditor's picks. It converged on the recommended resolution for 12 of 14 candidates and surfaced one cross-finding: **PF-003, PF-004, and PF-005 are one execution contract** — a full fallback needs a command source, a non-matrix execution path, and a full-safe exit policy; resolving any one alone leaves CI unable to run the fallback. **PF-001 and PF-006 share one marker** (`CODEOPS_LAST_FULL_SHA`), written only by a successful full gate.

- **PF-006** — the auditor's initial preference was a new `--plan`/`--phase-baseline` flag; the challenger recommended the smaller explicit `--baseline` option, and the auditor adopted it. `Confidence: High — a plan parser would duplicate the existing baseline input. Hardening: changed pick A → B.`
- **PF-012** — the challenger recommended removing "smoke" from FR-7; the auditor keeps the additive `prSmoke` option because FR-7 is an explicit user requirement. `Confidence: Med — the user may prefer the smaller removal. Hardening: challenger diverged — recommended removal, kept the additive field.`
- **PF-008** — the challenger converged on build-first ordering but noted that only a full gate that consumes the built artifact fully proves the digest. `Confidence: Med — artifact-level testing may be impractical for some projects. Hardening: challenger converged; counter-option C recorded.`

---

## Decision Record

**2026-11-12 00:11 — User: "accept recommendations".** This is a bulk acceptance under the Zero-Ambiguity Gate's bulk rule. It records every one of the 30 findings as `Resolved` (critical/major) or `Accepted` (minor/observation) with the recommendation stated in its entry. If the user intended only batch 1 (`PF-001` … `PF-006`), say so and `PF-007` … `PF-030` reopen.

**2026-11-12 00:20 — User: "apply fixes (all)".** This authorized the modification pass. All 30 fixes were applied to the 13 plan documents; no code, skill, or standards file was changed. The review outcome is **✅ PASSED WITH NOTES**: zero unresolved critical/major findings and zero unaccepted minors.

---

## Fixes Applied — Iteration 2

| PF | Fix applied | Plan files changed |
| --- | --- | --- |
| PF-001 | Last-full marker + ancestry; main missing/non-ancestor → full; `--last-full-sha`/`CODEOPS_LAST_FULL_SHA`; nightly success-only update | 03-03, 03-04, 03-05, 03-07, 01, 07, 99 |
| PF-002 | `full` is argv-only; string/single-element-with-spaces rejected; examples updated | 03-02, 03-05, 07, 99 |
| PF-003 | Recoverable `select`/`plan` errors → full + exit 0; `check`/`--no-fallback` keep errors; required `check --strict` job | 03-03, 03-04, 03-07, 07 |
| PF-004 | No-map `fullCommand: null`; `run` requires `--full-command`; CI keeps the existing full job | 03-03, 03-04, 03-05, 03-07, 01, 07, 99 |
| PF-005 | Four plan modes (`groups/full/none/skip`); matrix always present; separate full job; no fake `full` group | 03-04, 03-05, 03-07, 07, 99 |
| PF-006 | Explicit `--baseline`/`CODEOPS_TEST_BASE`; removed automatic phase-baseline discovery; Phase 8 passes the tree | 03-01, 03-03, 03-04, 07, 99 |
| PF-007 | `organize-tests` sole `CODEOPS-TESTING` owner; analyze-project preserves and warns | 03-01, 03-06, 01, 07, 99 |
| PF-008 | Tested source commit + reproducible artifact; provenance verifies `artifact.sourceCommit`/`reproducible` | 03-05, 03-06, 03-07, 07, 99 |
| PF-009 | Exec-plan passes `--include` for spec files; selector includes the owning group or falls back to full | 03-01, 03-03, 03-04, 01, 07, 99 |
| PF-010 | `tests` optional for target-based groups; empty-group/ownership exemptions; source ownership retained | 03-02, 03-04, 07, 99 |
| PF-011 | Canonical `node "${CODEOPS_PLUGIN_ROOT}/bin/codeops-test.mjs"`; optional wrapper; package bin | 00-index, 03-04, 03-06, 99 |
| PF-012 | `policy.prSmoke` groups selected at the PR gate with reason `smoke` | 03-02, 03-03, 03-05, 01, 07, 99 |
| PF-013 | `{tests}` = the group's full resolved test set; empty set is an error/full fallback | 03-02, 03-03, 03-04, 07 |
| PF-014 | Options table completed; `--out`/`--record` aligned; `--source-commit`, `--commit`, `--metrics` added | 03-04, 03-07, 07, 99 |
| PF-015 | Default severity and exit code made explicit for every check rule | 03-02, 03-04, 03-06, 01, 07 |
| PF-016 | Per-slice `acceptance` mode/reason field, validation, and checks | 03-02, 03-04, 03-06, 01, 07, 99 |
| PF-017 | `bin/fixtures/` excluded from the package payload; ST-54 updated | 99, 07 |
| PF-018 | Pilot `.github/CODEOWNERS` entry and skill guidance | 02, 03-06, 03-07, 00-index, 07, 99 |
| PF-019 | Optional content-free metrics and the `Test slices` table | 03-04, 03-06, 01, 07, 99 |
| PF-020 | `_shared/workspace-hygiene.md` link and content-test requirement | 03-06, 07, 99 |
| PF-021 | One authoritative module map; Related Files updated | 00-index, 03-03, 99 |
| PF-022 | AR references corrected to the decisions they actually describe | 01, 03-02, 03-03, 03-04, 07 |
| PF-023 | AR-37 records the plan-local targeted-verification gate | 00-ambiguity-register, 00-index, 99 |
| PF-024 | Case-sensitive repo-path matching by default; optional policy override | 03-02, 03-03, 07, 99 |
| PF-025 | `requirements` probe contract; `map.requires` validation; runner fails, never skips | 03-02, 03-04, 03-06, 07, 99 |
| PF-026 | `feature/**` branch class; local `task`, CI `pr` | 03-05, 07, 99 |
| PF-027 | Staging, validate-before-write, and rollback on failure | 03-06, 07, 99 |
| PF-028 | Success logs deleted; failure logs retained and reported | 03-04, 07, 99 |
| PF-029 | Release docs aligned on the single full gate / source-tested provenance | 03-05, 03-07 |
| PF-030 | Plugin citation corrected to `plugin/index.ts:64-76, 284-288` | 02 |

### Iteration 2 Verification

| Check | Result |
| --- | --- |
| Relative-link check across all 13 plan documents | ✅ all links resolve |
| Markdown table cell-count check | ✅ all tables consistent |
| AR count / ST count / task count | ✅ 37 / 69 / 86 |
| Stale-token scan (old `full` example, `group: "full"`, `--out`, `AR-33 performance`, analyze-project render) | ✅ none outside this report |
| Targeted key-phrase assertions for all 30 fixes | ✅ passed |
| `node --test scripts/hygiene-content.spec.test.mjs scripts/specialist-content.spec.test.mjs scripts/discovery-content.spec.test.mjs` | ✅ 40 pass, 0 fail |
| `npm run verify` | ✅ passed after `npm ci`: typecheck + 682 tests, 0 fail + version parity `2.5.0` |

**Post-fix artifact snapshot:** combined SHA-256 of the 13 plan files = `5b49289913de42f54ca08430598844489e6b3a9972d3cbccf3d64c3eb609fce1`. The per-file table below remains the pre-fix snapshot for audit continuity.

---

## Findings

### PF-001: Main-branch base falls back to HEAD and can skip all tests [🔴 CRITICAL]

**Dimension:** 13 — Codebase Alignment (also 4, 8, 9)
**Location:** `03-03-selector-core.md` §Change detection, branch-aware base table (line 65); `03-04-cli-and-runner.md` §`select` (lines 74-81); `03-05-branch-policy-and-provenance.md` §Nightly change detection (lines 100-106)
**Codebase Evidence:** The phase baseline mechanism exists (`scripts/codeops_worktree_snapshot.py`; `skills/exec-plan/execution-protocol.md:51-66`), but the CLI has no way to read the plan header (see PF-006). The repository's CI triggers on `push` to `main` (`.github/workflows/ci.yml:3-6`), so a direct push path is real, not hypothetical.

**The Problem:** The selector's branch table says `main`/`master` uses the previous successful full-run ref, else the merge-base for PRs, else `HEAD`. On a direct push to `main` with no marker (the state immediately after adoption, after a marker loss, or after a force-push), `HEAD` is the pushed commit. Diffing `HEAD` to the clean worktree produces no changed paths, so selection can return `none` or only `alwaysRun` groups. The stable aggregator only fails on an empty selection when it believes a code change occurred; with an empty diff it can pass. This is a silent under-selection path on the integration branch, contradicting FR-6's fail-closed contract and the plan's own safety promise. The nightly marker has the same missing-source problem (PF-006).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Require the last-full marker for `main`/`master`; if the marker is absent, unreadable, or not an ancestor of `HEAD`, select `full`. Resolve the marker from `CODEOPS_LAST_FULL_SHA` / `--last-full-sha`, and have CI pass the push event's `before` SHA where available. | Fail-closed; preserves affected selection on normal pushes; one marker shared with nightly; no silent empty diff. | Requires a marker update step and an ancestry check (both needed anyway for PF-006). |
| B | Keep the `HEAD` fallback but require CI to pass the marker on every integration run. | Smaller CLI change. | Local/direct users can still get the unsafe fallback; does not fix marker loss. |
| C | Run the full suite on every direct push to `main`; use affected selection only on PRs. | Simplest safe rule; no marker needed for main. | Gives up the cost benefit on direct integration pushes; does not cover feature/local branches. |

**Recommendation:** **Option A** — it is the only option that preserves the feature's cost benefit while removing the silent-empty-diff path. Add the marker input and ancestry check described in PF-006; missing marker, non-ancestor marker, or unreadable marker selects `full` with `reason: "unresolved-base"` or `reason: "marker-missing"`.

**Confidence:** High — the empty-diff path is directly implied by the table at `03-03:65` and the clean-worktree behavior of the existing snapshot helper.
**Hardening:** Challenger converged; it added the ancestry check and the push-event `before` SHA refinement.

**User Decision:** Resolved — User accepted recommendation: Option A (require the last-full marker; missing/unreadable/non-ancestor → full; remove the main/master HEAD fallback; CI passes the push-event before SHA).

---

### PF-002: The map's `full` command type is ambiguous and the example is not argv-safe [🟠 MAJOR]

**Dimension:** 12 — Consistency (also 1, 3, 8)
**Location:** `03-02-test-map-model.md` §Policy fields (line 80 example `"full": ["npm run verify"]`; line 112 "Full verify command string or argv-safe list"); `03-04-cli-and-runner.md` §Runner safety (line 133 "spawn with argv arrays and `shell: false`"); `03-05-branch-policy-and-provenance.md` §CI plan contract (line 88 `fullCommand: null`) and §Release plan example (line 174 `fullCommand: ["npm", "run", "verify"]`)
**Codebase Evidence:** The repository's existing command execution pattern is argv-based (`spawn` with `shell: false` is the plan's own rule); no shell tokenizer exists in the repo.

**The Problem:** The policy table allows a "command string or argv-safe list", but the executable contract requires an argv array. The example `["npm run verify"]` is an array containing one string with a space — `spawn("npm run verify", [], {shell:false})` looks for a program literally named `npm run verify` and fails with `ENOENT`. A bare string would require shell parsing or `shell: true`, both of which reintroduce injection and platform-specific quoting. The full gate is the most important command in the feature; its representation must be unambiguous.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Require `full` to be a flat argv array for one command, or an array of argv arrays for multiple commands; reject strings and one-element arrays containing spaces during validation. Update examples to `["npm", "run", "verify"]`. | Matches the runner's `shell: false` contract; no tokenizer; validation catches the dangerous shape early. | Slightly more verbose map authoring; multiple commands need a nested shape. |
| B | Allow a string and add a safe shell-like tokenizer. | Friendlier authoring. | Tokenizer must handle quotes/escapes/platforms; a security-sensitive new code path; more tests. |
| C | Allow a string and execute through a shell. | Simplest implementation. | Reintroduces shell injection and platform quoting; contradicts the plan's own security rule. |

**Recommendation:** **Option A** — require argv. Add a validation error (`map.full`) for a string or for a single-element array that contains whitespace/shell metacharacters, and update the schema, examples, and ST-1/ST-39 tests.

**Confidence:** High — the runner contract at `03-04:133` is explicit.
**Hardening:** Challenger converged; it added the one-element-with-spaces validation catch.

**User Decision:** Resolved — User accepted recommendation: Option A (argv-only `full`; reject strings and one-element-with-spaces during validation).

---

### PF-003: Invalid/stale maps exit 3/5 instead of selecting the full suite [🟠 MAJOR]

**Dimension:** 3 — Logical Contradictions (also 4, 6)
**Location:** `03-03-selector-core.md` §Non-disruption (line 161 "Any error in load/resolve/match/command construction: full with `reason`, never a partial selection"); `03-04-cli-and-runner.md` §`select` step 6 (line 81 "exit 3/5 only for configuration/selection errors") and §Error Handling (lines 174-186); `03-07-ci-release-integration.md` §Aggregator (lines 97-109)
**Codebase Evidence:** The current CI `verify` job runs `npm run verify` unconditionally (`.github/workflows/ci.yml:24-25`). The plan's replacement aggregator fails when the `plan` job fails (`03-07:102-106`), so an invalid map stops the pipeline rather than running the full suite.

**The Problem:** The plan promises "any selector error, unknown path, shared change, or stale map falls back to the full suite" (FR-6, `03-03:161`). The CLI contract says `select`/`plan` exit 3/5 on invalid map or selection error, and the CI aggregator treats a plan failure as a failure. The two behaviors cannot both hold. On adoption day, a single malformed fragment would block every PR instead of running the safe full suite, and `select --json` consumers would receive no selection at all.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Make `select`/`plan` return `{mode: "full", reason: "map-invalid"}` with the full command (if resolvable) and exit 0 for recoverable load/selection errors; keep exit 3/5 for `check` and for `--no-fallback`. CI then runs full as promised. | Matches FR-6; keeps CI unblocked; `check` still reports the defect loudly. | Silently expanding to full can hide a configuration bug and burn CI time; a required `check --strict` job must carry the loud failure. |
| B | Keep exit 3/5 and change FR-6 to "an invalid map blocks CI; unknown paths fall back to full". | Loud failure; no hidden expansion. | Contradicts the user's fail-closed requirement and the no-map compatibility promise. |
| C | Only `run` falls back; `select`/`plan` fail. | Clear distinction between inspection and execution. | CI uses `plan`, so the fallback never fires where it matters. |

**Recommendation:** **Option A**, paired with a required `check --strict` job (or a `select` warning) so the invalid map is still visible. Reserve exit 3/5 for `check` and `--no-fallback`. Add ST cases for `select`/`plan` with invalid JSON, a cycle, and a path escape.

**Confidence:** High — the contradiction is explicit in the cited lines.
**Hardening:** Challenger converged; it noted that Option B is defensible only if a required strict check carries the failure.

**User Decision:** Resolved — User accepted recommendation: Option A (recoverable select/plan errors return `mode: full` with a reason and exit 0; keep exit 3/5 for check and `--no-fallback`; require a loud strict check).

---

### PF-004: The no-map path has no source for the project's full verify command [🟠 MAJOR]

**Dimension:** 4 — Completeness Gaps (also 2, 13)
**Location:** `03-02` §Load and merge step 2 (`{ mode: "no-map" }`); `03-03` §Selection step 1 (`{ mode: "full", reason: "no-map" }`); `03-04` §`run` step 2 ("run the policy's full command(s)"); `03-05` §CI plan contract (line 94 "No map returns one entry with `group: "full"` ... and the full command"); `07-testing-strategy.md` ST-1 ("the policy/full command is the project's existing verify command")
**Codebase Evidence:** The repository records its full command in `AGENTS.md` ("Verify: `npm run verify`") and `package.json` scripts (`"verify": "npm run typecheck && npm run test && npm run check:version"`), but the plan does not define either as a no-map source for the new CLI.

**The Problem:** FR-1/AR-2 promise that a project with no map runs exactly the commands it runs today. But the new CLI's no-map result contains no command: there is no policy, and the plan never says how `run` or the CI `plan` obtains the project's full verify command. `run` says "run the policy's full command(s)" — there is no policy. The no-map CI plan says it returns "the full command" — from nowhere. The `run` command would either crash, run nothing, or need an undocumented discovery rule (AGENTS.md parsing) that would be a new language-specific/format-specific layer.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | No-map `select`/`plan` report `mode: full` with `fullCommand: null` and a reason; `run` requires an explicit `--full-command <argv>` (or a project wrapper) and otherwise refuses with guidance; CI keeps its existing full job. | Honest separation: the map owns commands; no-map is informational for the selector; no new discovery layer. | Adds a flag/refusal path; the CI no-map plan cannot execute by itself. |
| B | Discover the command from `AGENTS.md` or `package.json` (e.g., `scripts.verify`). | No user flag; matches the repo's current documentation. | New parsing layer; ambiguous for polyglot/custom projects; contradicts "the map is the only command source"; can read stale/wrong commands. |
| C | Require a map for `run`; no-map CLI only reports `mode: full`. | Simplest and safest; no new flag. | `run` is not usable in a no-map project, but the agent can keep running its existing full command directly. |

**Recommendation:** **Option A** — add `--full-command` for the no-map/full path and keep `fullCommand: null` in `select`/`plan` when there is no map. Document that the CI no-map path uses the project's existing full job (today's behavior), not a fabricated command. Add an ST case for `run` with and without `--full-command`.

**Confidence:** High — no command source exists in the no-map model.
**Hardening:** Challenger converged on A; it noted C is simpler but less faithful to FR-1.

**User Decision:** Resolved — User accepted recommendation: Option A (no-map select/plan report `fullCommand: null`; `run` requires `--full-command` or refuses; CI keeps the existing full job).

---

### PF-005: The CI plan/run contract has no executable path for `none`, `skip`, or no-map `full` [🟠 MAJOR]

**Dimension:** 4 — Completeness Gaps (also 3, 11)
**Location:** `03-05` §CI plan contract (lines 71-96: `mode: "skip"` has no matrix; no-map returns `group: "full"`); `03-04` §`run` step 4 (line 88 "an unknown/unselected group is a usage error (exit 2)"); `03-07` §Affected plan and shards (lines 61-109, especially the `test` job condition and `run --group "${{ matrix.group }}"`)
**Codebase Evidence:** The current CI has one static `verify` job (`.github/workflows/ci.yml:8-25`); the plan's matrix job is new. GitHub Actions requires a valid `matrix` object; `fromJSON(null)` fails before the job can run.

**The Problem:** The plan contract defines `mode: groups` with a matrix, `mode: full` with `fullCommand` (and sometimes all groups), `mode: skip` for nightly with no matrix, and `mode: none` for docs-only without a defined shape. The workflow pipes `jq -c .matrix` into `matrix`, and the test-job condition is only `!= '{"include":[]}'`. If `matrix` is missing, the output is `null`, the condition is true, and the matrix expansion fails. For no-map, the plan emits one entry `group: "full"`; the test job calls `run --selection plan.json --group full`, but `run --group` treats an unknown/unselected group as a usage error. The CI template therefore cannot execute the two paths the safety contract depends on (no-map full and docs-only none).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Always emit `matrix: {include: []}` for `none`/`skip`; condition the test job on `mode` as well; add an explicit full path (`full: true` + `fullCommand`) that runs the full gate instead of a fake group. Keep `run --group` rejecting unknown IDs. | Complete contract; no fake group; one aggregator can cover all modes. | Two workflow paths (matrix vs full) can drift; the full path needs its own test. |
| B | Separate jobs for `groups`, `full`, `none`, and `skip`. | Clear responsibilities. | More workflow surface; duplicate checkout/install; harder to keep one required check. |
| C | Require a map for CI shards; no-map remains today's static job. | Smallest CI change; preserves no-map behavior exactly. | The plan still needs a defined `none`/`skip` path for map projects; does not solve the contract. |

**Recommendation:** **Option A** — define the plan JSON for every mode, always emit a matrix object, and add a dedicated full-gate path. Add ST-39/ST-40 cases for no-map, docs-only, nightly skip, and a full fallback. This is the same execution contract referenced by PF-003 and PF-004; resolve them together.

**Confidence:** High — the matrix and `--group` behavior are explicit in the plan.
**Hardening:** Challenger converged; it recommended the same cross-finding consolidation.

**User Decision:** Resolved — User accepted recommendation: Option A (always emit `matrix.include`; condition the test job on mode; add an explicit full-gate path; no fake `full` group).

---

### PF-006: The phase baseline tree is not discoverable by the CLI [🟠 MAJOR]

**Dimension:** 5 — Dependency Issues (also 1, 4)
**Location:** `03-03` §Change detection inputs (line 51 "the phase baseline tree recorded in the plan header"); `03-04` §`select` step 3 (line 78 "then the phase baseline"); `99-execution-plan.md` task 8.2.6 (line 267 `shadow` with no `--baseline`)
**Codebase Evidence:** The phase baseline is real and reusable (`scripts/codeops_worktree_snapshot.py`; `skills/exec-plan/execution-protocol.md:51-66`), but it lives in a plan header. The CLI has no `--plan` option, no plan-directory option, and no rule for locating the active plan among multiple plans.

**The Problem:** The selector's input list treats the phase baseline as an automatic input, and `select` step 3 says "then the phase baseline" after the env var. But the command-line contract provides no way to find it. The exec-plan skill can pass `--baseline`, but the plan does not require it; the Phase 8 pilot `shadow` command passes no baseline at all. In practice the implementation must either guess a plan (unsafe in a multi-plan repo) or silently fall through to the branch base — which is the unsafe `main`/`HEAD` path in PF-001.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add `--plan <path>` or `--phase-baseline <sha>` and define plan-header parsing. | Makes the intended base discoverable; supports standalone use. | Adds plan-format knowledge to the CLI; another base input. |
| B | Require an explicit `--baseline` for every gate except the branch-aware default; remove the automatic phase-baseline step; update exec-plan and the Phase 8 task to pass the phase tree. | Smallest change; reuses the existing option; no plan parser; one base input. | A caller can forget the flag and silently measure a different diff; the skill must enforce it. |
| C | Read the baseline only from `CODEOPS_TEST_BASE`. | Simple. | The env var is not set in most local/CI runs; hidden state. |

**Recommendation:** **Option B** — require `--baseline` (or `CODEOPS_TEST_BASE`) and remove the undefined automatic step. Update `03-03`/`03-04` and task 8.2.6 to pass the phase tree; make the exec-plan packet include it. This is the challenger's smaller option and avoids a plan parser.

**Confidence:** High — the existing `--baseline` option already accepts a tree or ref.
**Hardening:** Changed pick A → B after the challenger; the plan parser was judged unnecessary duplication.

**User Decision:** Resolved — User accepted recommendation: Option B (require explicit `--baseline` or `CODEOPS_TEST_BASE`; remove the automatic phase-baseline step; update exec-plan and Phase 8).

---

### PF-007: The `CODEOPS-TESTING` block has two writers [🟠 MAJOR]

**Dimension:** 3 — Logical Contradictions (also 12, 13)
**Location:** `03-01-lightweight-scoped-verification.md` §analyze-project changes (line 88 "Render a `CODEOPS-TESTING` block"); `01-requirements.md` FR-13 (line 28 "analyze-project renders the testing block"); `99-execution-plan.md` tasks 1.2.6 (line 67) and 6.2.7 (line 209); versus `03-06-organize-tests-skill.md` §AGENTS.md testing block (line 101 "owned by `organize-tests`; `analyze-project` preserves it byte-for-byte")
**Codebase Evidence:** `skills/analyze-project/SKILL.md:13-27` already owns the `CODEOPS-PROJECT` managed block and preserves non-managed text. The repository's `AGENTS.md` has `CODEOPS-PROJECT` and `CODEOPS-SPECIALISTS` blocks. A nested block with two writers would violate the single-owner invariant that makes byte-for-byte preservation testable.

**The Problem:** The plan says both skills render the same block. `03-01` says analyze-project renders it and preserves it on refresh; `03-06` says organize-tests owns it and analyze-project preserves it. Phase 1 and Phase 6 both include an analyze-project task with nearly identical wording. Two writers can overwrite each other's content, break byte-for-byte preservation, and make the block's ownership untestable. This is a containment invariant, not a style preference.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | `organize-tests` is the sole writer/owner; `analyze-project` only detects the block, preserves it byte-for-byte, reports drift, and warns when it is missing/stale. | One owner; testable preservation; matches the existing managed-block pattern. | Users must run `organize-tests` (or an update path) to refresh the block; analyze-project cannot repair it. |
| B | `analyze-project` is the sole writer; `organize-tests` provides data/requests. | Analyze-project is already the AGENTS writer. | The skill knows the map and commands; passing them through a second layer adds coupling. |
| C | Split into two blocks with separate owners. | Clear ownership. | Duplicate testing information; more markers; violates the "one block" design in 03-06. |

**Recommendation:** **Option A** — make `organize-tests` the sole owner and rewrite `03-01:88`, FR-13, and tasks 1.2.6/6.2.7 so analyze-project detects/preserves/warns. Add a content test with a pre-existing nested block.

**Confidence:** High — the two statements are mutually exclusive.
**Hardening:** Challenger converged; it added the drift-warning duty for analyze-project.

**User Decision:** Resolved — User accepted recommendation: Option A (organize-tests is the sole CODEOPS-TESTING owner; analyze-project detects, preserves byte-for-byte, and warns on drift).

---

### PF-008: The full gate runs before the artifact is built, so the provenance digest is not the tested artifact [🟠 MAJOR]

**Dimension:** 8 — Security Blind Spots (also 3, 13)
**Location:** `03-05` §Artifact promotion (lines 143-148: build → full gate → provenance); `03-07` §Release and package gate (lines 111-131: `verify` full gate → `package` builds → `provenance write`)
**Codebase Evidence:** The repository's release flow builds the npm package during `scripts/release.mjs` after `npm run verify` (`release.yml:69-70` and the release step at `:72-86`); the plan's reusable `verify-full.yml` runs `npm run verify` and `npm pack --dry-run`, not a test of the packed artifact.

**The Problem:** The plan's core provenance promise is that the same artifact digest may reuse full-run evidence at production. But the example package job runs the full gate first and builds the artifact afterwards. The digest recorded in provenance is computed from a build that the full gate never saw. If the build is non-deterministic, includes generated code, or differs from the tested source, the record claims `full: true` for an untested artifact. This undermines the release gate and the artifact-promotion rule, which explicitly says "Build the artifact once" before the full gate.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Build the artifact first, then run the full gate against that artifact (or against a source tree pinned to the same commit), then write provenance with the digest. | Matches the 03-05 rule; the digest is the tested tree. | Full tests may not run against a packaged artifact; build-first increases the time before feedback. |
| B | Run the full gate on source, record both the source commit and the build digest, and require a build-reproducibility check (rebuild produces the same digest). | Practical for source-level suites; proves the artifact came from the tested commit. | Reproducible builds are hard; a second build costs time. |
| C | Re-run the full suite after the build. | Strongest proof. | Doubles the cost; contradicts the "verify once, promote" goal. |

**Recommendation:** **Option A** where the project's tests can consume the artifact; otherwise **Option B** with an explicit reproducibility check. The package job must not compute provenance before the corresponding full gate. Add an ST case asserting the recorded digest is the one the gate tested.

**Confidence:** Med — artifact-level testing may be impractical for some projects, so the fallback matters.
**Hardening:** Challenger converged on A; it noted C is the only complete proof and B is more honest when artifact testing is impractical.

**User Decision:** Resolved — User accepted recommendation: Option A where artifact-level testing is practical, otherwise Option B (record the source commit and require a build-reproducibility check).

---

### PF-009: "Spec tests are never skipped" has no selection or CLI mechanism [🟠 MAJOR]

**Dimension:** 7 — Testability (also 2, 3, 4)
**Location:** `03-01` prime directive 5 (line 35 "The feature's spec test file always runs, even if the map would not select its group"); `03-03` §Selection steps 4-10 (no spec-test rule); `03-04` options (line 46 `--include <path>` only); `03-01` exec-plan changes (lines 69-77, no `--include` integration); risk table `02-current-state.md` (line 140 "Spec file always included")
**Codebase Evidence:** The repo's spec-first convention names files `[feature].spec.test.[ext]` (`standards/coding-standards-full.md:74-85`; `_shared/spec-first-ordering.md`), and the plan itself uses `*.spec.test.mjs` files. There is no map field or selector step that identifies the current feature's spec file.

**The Problem:** The standards say a feature's spec test is an immutable oracle and is never skipped. The plan elevates that to a prime directive, but selection only knows groups, globs, tiers, and dependencies. If a source change selects a group whose tests do not include the feature's spec file (or if the spec file is in a different group), the spec test can be deferred or skipped. `--include` exists, but neither make-plan, exec-plan, nor the selector is told to pass it. The risk table's mitigation ("Spec file always included") is not backed by a mechanism or an ST case.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Define exec-plan to pass `--include` for the plan's declared spec file(s) on every task gate; the selector includes the owning group (or falls back to full if unowned). | Uses the existing option; only the plan knows the feature's spec file; testable with ST cases. | Depends on the agent passing the flag; a forgotten flag can still skip. |
| B | Add a map-level `spec`/`alwaysRun` flag or a reserved `*.spec.test.*` rule. | Enforceable by the map. | Runs unrelated specs; a map cannot identify "the feature's" spec file for a task; expensive. |
| C | Weaken the directive to "the selected group's tests include the spec file; selection must not exclude a group that owns it". | No new mechanism. | Drops the absolute guarantee; a spec file outside the group is still skipped. |

**Recommendation:** **Option A** — make `--include` part of the exec-plan task contract and add ST cases for owned and unowned spec files. Also add a `check` warning when a slice has a `*.spec.test.*` file outside its task group.

**Confidence:** High — the guarantee is unenforceable as written.
**Hardening:** Challenger converged; it noted that only exec-plan knows the task's spec file.

**User Decision:** Resolved — User accepted recommendation: Option A (exec-plan passes `--include` for the plan's spec files; the selector includes the owning group or falls back to full).

---

### PF-010: Rust/target-based groups cannot satisfy the required `tests` field [🟠 MAJOR]

**Dimension:** 13 — Codebase Alignment (also 3, 4)
**Location:** `03-02` §Group model field table (line 65 `tests` required; line 66 `{tests}` expansion), §Validation rules (line 176 `map.empty-group`), §Language-neutral runner contract (line 145 "Rust unit tests are inline in source; a crate group uses `--lib --tests`, not `{tests}`"); `07-testing-strategy.md` ST-44 ("target-based ownership; no `{tests}` requirement")
**Codebase Evidence:** The repo has no Rust test fixtures yet, so the plan's Rust acceptance depends on the new fixtures. The plan's own compiler example uses `crates/codegen-x86/tests/**/*.rs`, which covers integration-test files, not inline `#[cfg(test)]` unit tests in `src/`.

**The Problem:** `tests` is required and validation rejects a group whose `tests` glob matches no file. Rust unit tests are commonly inline in `src/`, so a crate with only inline unit tests has no test files matching a `tests` glob. ST-44 says crate groups have "no `{tests}` requirement", but the map model still requires `tests` and the empty-group rule still rejects the group. The Rust fixture path is therefore either invalid or must point `tests` at source files, which breaks the ownership/check semantics. This threatens the language-neutrality requirement (FR-17) and acceptance criterion 11.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Make `tests` optional for groups whose `run.command` contains no `{tests}`; skip the empty-group and file-ownership checks for those target-based groups; keep `sources` ownership and add a command smoke test (`--list`) during adoption. | Models target-based runners honestly; keeps file-based ownership checks strict. | Target-based groups lose per-test ownership/orphan checks; needs a separate orphan policy for those ecosystems. |
| B | Require `tests` to point at source globs for inline tests. | Keeps a non-empty field. | Source files are not test files; overlaps with `sources`; check semantics break. |
| C | Add a separate `ownership` field for target-based groups. | Clean separation. | New schema surface; more validation; not needed if A is enough. |

**Recommendation:** **Option A** — make `tests` optional/empty-allowed when the command has no `{tests}`, skip the `map.empty-group`/one-owner checks for those groups, and keep a separate source-ownership validation. Add a Rust fixture with only inline tests to prove it.

**Confidence:** High — the contradiction is explicit between `03-02:65/176` and ST-44.
**Hardening:** Challenger converged; it recommended keeping source-overlap validation and a separate orphan scan for file-based ecosystems.

**User Decision:** Resolved — User accepted recommendation: Option A (`tests` optional for groups whose command has no `{tests}`; skip empty-group/ownership checks for those groups; keep source-overlap validation).

---

### PF-011: The CLI invocation path is undefined across the plan [🟠 MAJOR]

**Dimension:** 5 — Dependency Issues (also 12, 13)
**Location:** `00-index.md` §User-facing commands (lines 49-56, bare `codeops-test`); `03-06` protocol step 9 (line 70, optional `scripts/codeops-test.mjs` wrapper); `99-execution-plan.md` task 8.2.6 (line 267, `node bin/codeops-test.mjs`); `03-07` CI example (line 96, `node bin/codeops-test.mjs`)
**Codebase Evidence:** `package.json` `bin` currently exposes only `opencode-codeops` (`"opencode-codeops": "bin/index.mjs"`). `bin/install-skills.mjs` copies skills, not the CLI. Existing skills invoke helpers through `${CODEOPS_PLUGIN_ROOT}` (e.g., `python3 "${CODEOPS_PLUGIN_ROOT}/scripts/codeops_worktree_snapshot.py"` in `execution-protocol.md:59`).

**The Problem:** The plan uses three different invocation forms: a bare `codeops-test` in the user-facing command table, `node bin/codeops-test.mjs` in this repo's CI/pilot, and an optional project wrapper `scripts/codeops-test.mjs` in the skill. A plugin installed with `npx opencode-codeops install` copies skills but does not put `bin/codeops-test.mjs` on the user's PATH; the package's `bin` entry only creates a global binary after a global npm install. The skill and the user-facing docs therefore may not be able to run the CLI at all. This is a dependency/availability gap, not just naming.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Standardize skill and user-facing invocations on `node "${CODEOPS_PLUGIN_ROOT}/bin/codeops-test.mjs"`; generate a project wrapper (`scripts/codeops-test.mjs`) only for users who want npm scripts; register the package bin for global installs. | Works with the existing plugin install; one canonical path; CI can pin the plugin. | `${CODEOPS_PLUGIN_ROOT}` may be unset in arbitrary CI shells; CI must install/export the plugin root, and the wrapper can drift. |
| B | Require a global `npm install -g opencode-codeops` so `codeops-test` is on PATH. | Simple command name. | Contradicts the documented `npx` install path; global installs are optional; CI needs an extra step. |
| C | Only support the project wrapper `scripts/codeops-test.mjs`. | Explicit per-project. | The wrapper must be generated before any command runs; bootstrap problem; extra file in every project. |

**Recommendation:** **Option A** — use `${CODEOPS_PLUGIN_ROOT}/bin/codeops-test.mjs` in skills and docs; make the wrapper a convenience, not the only path. Add a content test that every command example uses the canonical form. In CI, install the plugin or set the root explicitly.

**Confidence:** High — the installer's scope is verified, and the package bin list is verified.
**Hardening:** Challenger converged; it noted CI must set/export the root or install the plugin.

**User Decision:** Resolved — User accepted recommendation: Option A (skills and docs use `node "${CODEOPS_PLUGIN_ROOT}/bin/codeops-test.mjs"`; the wrapper is optional; register the package bin for global installs).

---

### PF-012: The PR gate's "configured smoke" has no map field or selector rule [🟠 MAJOR]

**Dimension:** 4 — Completeness Gaps (also 3, 7)
**Location:** `01-requirements.md` FR-7 (line 22 "PR runs task+phase plus configured smoke"); `03-03` §Reasons (line 126 `smoke` — "PR smoke configuration") and §Gate policy (lines 107-114, `pr` = task+phase+always-run); `03-05` §Gate mapping (line 61 "Merge queue/PR uses affected + smoke")
**Codebase Evidence:** No existing smoke concept in the repo's test configuration; the plan's map model has no `smoke` field, and no AR entry resolves one.

**The Problem:** FR-7 explicitly requires configured smoke at the PR gate. The selector's reasons list names `smoke`, but the map schema has no way to configure it, and the gate table does not select it. The PR gate therefore silently degrades to task+phase+always-run. A project cannot implement the stated PR behavior, and an implementer cannot tell whether `smoke` is a tier, a flag, a policy list, or a dead reason.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a policy `prSmoke: ["group.id", ...]` list (or `smoke: true` on groups) and a selector rule that includes them at the PR gate with reason `smoke`; validate the IDs. | Fulfills FR-7; small additive field; testable with ST cases. | New config surface; needs a rule for gates other than PR (ignore or defer). |
| B | Remove "smoke" from FR-7 and the `smoke` reason; define PR = task+phase+always-run. | Smaller; no orphan concept. | Drops a stated requirement without an AR decision; weakens the PR gate. |
| C | Defer smoke as a follow-up with a named AR deferral. | Keeps the option open. | The plan would not satisfy FR-7 at completion; needs a user-approved deferral. |

**Recommendation:** **Option A** — add the policy field and selector rule. It is additive within the approved map model and directly fulfills FR-7. Add ST cases for a smoke group at `pr`, `task`, and `release`.

**Confidence:** Med — the user may prefer the smaller removal (Option B), but FR-7 is explicit.
**Hardening:** Challenger diverged — it recommended B (remove smoke); the auditor keeps A to honor the stated requirement.

**User Decision:** Resolved — User accepted recommendation: Option A (add a `prSmoke` policy list and a PR-gate selector rule with the `smoke` reason).

---

### PF-013: `{tests}` does not say whether it expands to the group's full test set or changed tests only [🟠 MAJOR]

**Dimension:** 1 — Ambiguities (also 6, 9)
**Location:** `03-02` §Group model (line 66 "`{tests}` expands to matched test paths as separate argv entries"); `03-03` §Selection step 11 (line 102 "replace `{tests}` with matched test paths as separate argv entries"); `03-04` §Runner safety (line 133 "`{tests}` expands to separate args")
**Codebase Evidence:** The runner uses `spawn` without a shell; the group's `tests` globs are the only ownership metadata. A source-only change has no changed test path, so a changed-only interpretation would produce an empty argument list.

**The Problem:** "Matched test paths" is not defined relative to the change set. If it means the group's full resolved test files, a source-only change runs the group correctly. If it means only changed test files, a source-only change expands to an empty list; depending on the runner, that runs zero tests (silent under-testing) or every test (safe but expensive). The plan's zero-test validation applies at adoption time, not at selection time. This ambiguity sits on the main use case: a source change selecting its group's tests.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Define `{tests}` as the group's full resolved test set, independent of the change set; an empty resolved set is a validation/fallback error. | Matches the feature-slice model; source-only changes run the group; deterministic. | Large groups can blow the task budget; the plan's answer is to split slow groups. |
| B | Define `{tests}` as changed test files only. | Minimal per-change cost. | Empty on source-only changes; silent under-testing or accidental full runs; not the feature-slice model. |
| C | Support both with a flag (e.g., `--changed-tests`). | Flexibility. | More CLI/contract surface; the default must still be defined. |

**Recommendation:** **Option A** — state "all test files matched by the group's `tests` globs, resolved independently of the change set", and make an empty resolved set a `map.empty-group`/full-fallback error at selection time. Add an ST case with a source-only change and a group that owns tests.

**Confidence:** High — a changed-only reading is a plausible implementation of the current wording.
**Hardening:** Challenger converged; it noted that splitting slow groups is the answer to the budget cost, not narrowing `{tests}`.

**User Decision:** Resolved — User accepted recommendation: Option A (`{tests}` means the group's full resolved test set, independent of the change set; an empty resolved set is a validation/full-fallback error).

---

### PF-014: The CLI options table is missing flags used by other component documents [🟡 MINOR]

**Dimension:** 12 — Consistency
**Location:** `03-04` §Options (lines 37-56) versus `03-04` exit code 5 / error table (`--no-fallback`, lines 67, 178), `03-04` runner safety (`--keep-logs`, line 137), `03-05` §Provenance (`--coverage`, `--acceptance`, `--full-run-id`, line 137), `03-07` package gate (`--out`, line 124)
**Codebase Evidence:** `03-04` is declared the exact CLI contract owner (`00-index.md:58`), so undefined flags have no authoritative definition.

**The Problem:** The component examples invoke `--out`, `--coverage`, `--acceptance`, `--full-run-id`, `--no-fallback`, and `--keep-logs`, but the options table does not list them. An implementer following the table will reject valid documented commands; an implementer following the examples will add undocumented flags. `--record` is listed for `run`, but `03-05` uses `provenance verify --record`, where the table does not apply it.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add every used flag to the `03-04` options table with its command scope and default; change examples that use a different flag name (`--out` → `--record` or add `--out`). | One contract; examples parse. | Slightly larger table. |
| B | Change the component examples to use only listed flags. | Smaller CLI. | Provenance input flags are genuinely needed; removing them loses features. |

**Recommendation:** **Option A** — complete the table; align `--out`/`--record` on one name; add a CLI spec case that every documented flag parses.

**Confidence:** High — the mismatch is mechanical.
**Hardening:** Not required (MINOR).

**User Decision:** Resolved — User accepted recommendation: Option A (complete the CLI options table; align `--out`/`--record`; add a parse test for every documented flag).

---

### PF-015: `check` severity and exit-code semantics are ambiguous [🟡 MINOR]

**Dimension:** 1 — Ambiguities
**Location:** `03-02` §Validation rules (lines 163-187, especially `map.overlap`, `map.orphan-test`, `map.slice-no-task`, `map.empty-group`) and line 187 "`--strict` promotes warnings (unclassified sources, slow groups, overlaps, missing task-tier tests) to errors"; `03-04` §`check` (lines 96-105) and exit codes (lines 60-68); `07-testing-strategy.md` ST-7, ST-8, ST-32
**Codebase Evidence:** The current repo has no `check` command; the plan defines it from scratch, so the implementer has no precedent.

**The Problem:** The validation table presents `map.overlap`, `map.orphan-test`, and `map.slice-no-task` as error codes, but the strict text says overlaps and missing task-tier tests are warnings promoted by `--strict`; `03-06` says a slice without task-tier tests is a warning with adoption blocked in strict. `check` exits 3 for invalid map and 4 for drift/strict failure, but the table does not classify which code is 3 vs 4. The adoption gate (`check --strict`) depends on this.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a default severity (`error`/`warning`) and exit code (`3`/`4`) to every validation rule; make overlaps/orphans/slice-no-task warnings by default and errors under `--strict` (or vice versa) consistently across STs. | One authoritative table; tests can assert. | Requires editing the table and STs. |
| B | Treat every listed rule as an error, and let `--strict` only promote unclassified sources/slow groups. | Simpler. | Less flexible for adoption; contradicts `03-06` warning wording. |

**Recommendation:** **Option A** — make the severity and exit code explicit per rule, and align ST-7/ST-8/ST-32.

**Confidence:** High — the contradiction is textual.
**Hardening:** Not required (MINOR).

**User Decision:** Resolved — User accepted recommendation: Option A (add default severity and exit code to every check rule; align ST-7/ST-8/ST-32).

---

### PF-016: A per-slice acceptance record with a reason is required but not modeled [🟡 MINOR]

**Dimension:** 4 — Completeness Gaps
**Location:** `03-02` §Slice contract (line 195 "an explicit manual/external/N/A acceptance record with a reason"); `03-02` §Validation (line 180 `map.slice-no-release`); `03-06` protocol step 5 (line 66 "a recorded manual/external/N/A reason")
**Codebase Evidence:** The map policy has one global `acceptance: {mode, groups, checklist}` object (03-02 lines 101-105); there is no per-slice or per-group acceptance field.

**The Problem:** The slice contract requires a per-slice manual/external/N/A acceptance record with a reason, but the schema has only a global acceptance mode. A project with `acceptance.mode: automated` cannot exempt one slice with a recorded reason; a project with `manual` exempts every slice. The validator cannot distinguish "this slice has no release tests and no recorded exception" from "the whole project is manual".

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a per-slice `acceptance: {mode, reason}` field or a `sliceAcceptance` map; validate it. | Models the contract. | New schema surface. |
| B | Make the global acceptance mode the only rule and remove the per-slice reason wording. | Smaller. | Less granular; a manual project cannot flag individual slices. |

**Recommendation:** **Option A** if per-slice exemptions are intended; otherwise **Option B** and remove the wording. Add a validation test for a slice with no release tier.

**Confidence:** Med — the plan may intend the global mode to apply to all slices.
**Hardening:** Not required (MINOR).

**User Decision:** Resolved — User accepted recommendation: Option A (add a per-slice acceptance mode/reason and validate it; use Option B only if per-slice exemptions are not intended).

---

### PF-017: Test fixtures under `bin/fixtures/` will be shipped in the npm package [🟡 MINOR]

**Dimension:** 13 — Codebase Alignment
**Location:** `99-execution-plan.md` task 2.2.4 (line 95 `bin/fixtures/test-selection/**`); `07-testing-strategy.md` §Test Data (lines 142-148); `07-testing-strategy.md` ST-54 ("excludes tests")
**Codebase Evidence:** `package.json` `files` includes `"bin/"`, `"!bin/*.test.mjs"`, and `"!bin/*.spec.test.mjs"`; it has no `!bin/fixtures/` exclusion.

**The Problem:** The plan puts Node/Rust/custom/polyglot/invalid fixtures under `bin/fixtures/test-selection/`. The package `files` pattern includes `bin/` and only excludes top-level test files, so `npm pack --dry-run` will ship the fixtures. ST-54 says the pack excludes tests, and the package payload should not carry fixture repos.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add `!bin/fixtures/` to `package.json` `files` (or move fixtures to a non-shipped path); assert in the pack test. | Keeps the payload clean. | One more exclusion pattern. |
| B | Leave fixtures in the package. | No change. | Bloats the package; contradicts ST-54. |

**Recommendation:** **Option A** — add the exclusion and an ST-54 assertion.

**Confidence:** High — the package manifest is explicit.
**Hardening:** Not required (MINOR).

**User Decision:** Resolved — User accepted recommendation: Option A (exclude `bin/fixtures/` from the npm package; assert it in ST-54).

---

### PF-018: CODEOWNERS map protection is required but absent and untasked [🟡 MINOR]

**Dimension:** 8 — Security Blind Spots (also 4, 13)
**Location:** `03-07` §Branch protection and merge queue (line 170 "Protect `codeops/test-map/**` with CODEOWNERS"); `03-06` §Map layout decision (line 95 "CODEOWNERS maps it to the team"); `00-index.md` key decisions ("Map governance | CODEOWNERS, strict check, reasons for ignores | AR-24")
**Codebase Evidence:** `find . -name CODEOWNERS` returns nothing; `.github/` contains only `workflows/`. No Phase 8 task creates or updates a CODEOWNERS entry.

**The Problem:** AR-24 and the plan's key-decisions table name CODEOWNERS as a map-protection control. The repository has no CODEOWNERS file, and the pilot-map tasks (8.2.3-8.2.5) do not add one. A project adopting the skill is told to use CODEOWNERS, but the plan's own pilot does not. The strict check and ignore reasons are implemented; the review control is not.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a Phase 8 task to create `.github/CODEOWNERS` with `codeops/test-map/**` owned by the map maintainers; document the user-project equivalent. | Completes AR-24; testable by file content. | Requires choosing an owner; creates a new repo file. |
| B | Document that CODEOWNERS is advisory for user projects and this repo uses a branch-protection/review rule instead. | No new file. | Does not implement the stated control; weaker evidence. |

**Recommendation:** **Option A** — add the task and a content test for the CODEOWNERS entry.

**Confidence:** High — the file is absent.
**Hardening:** Not required (MINOR).

**User Decision:** Resolved — User accepted recommendation: Option A (add `.github/CODEOWNERS` for `codeops/test-map/**` and a content test).

---

### PF-019: FR-19 metrics and FR-23 human fallback table are not designed [🟡 MINOR]

**Dimension:** 4 — Completeness Gaps (also 10)
**Location:** `01-requirements.md` FR-19 (line 34 "Metrics are content-free and optional (AR-24, AR-32)") and FR-23 (line 41 "The `organize-tests` output can render a human-readable `Test slices` table into the AGENTS.md testing block"); `03-06` §AGENTS.md testing block (lines 99-114, no table) and §Modes (lines 28-39, no metrics mode)
**Codebase Evidence:** AR-32 resolved "optional; output goes to existing outcome-review/metrics surfaces"; the repo has `scripts/codeops_outcomes.py` and the outcome-review skill. The plan does not name either.

**The Problem:** Two Should-Have requirements have no concrete design: FR-19 says metrics are content-free and optional, but no component defines what is emitted, where, or how opt-in works; FR-23 says the skill can render a `Test slices` table into the AGENTS.md block, but the block template has no table and no mode/task covers it. The plan's `Won't Have` list does not exclude either, so they remain promised but unbuilt.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a small metrics contract (optional `--metrics`/outcome event, content-free fields) and a `Test slices` table option to 03-06; add ST cases. | Fulfills both Should-Haves. | More plan surface. |
| B | Move both to `Won't Have`/a named deferral with an AR entry. | Keeps the plan smaller. | Requires user approval; drops promised functionality. |
| C | Implement only FR-23 (table) and defer metrics. | Smaller. | Still needs an AR deferral for metrics. |

**Recommendation:** **Option A** if both are desired; otherwise **Option B** with an explicit user decision. Do not leave them as unimplemented Should-Haves.

**Confidence:** High — no design exists.
**Hardening:** Not required (MINOR).

**User Decision:** Resolved — User accepted recommendation: Option A (add the optional content-free metrics contract and the `Test slices` table; otherwise use Option B with an explicit AR deferral).

---

### PF-020: The new `organize-tests` skill omits the mandatory workspace-hygiene link [🟡 MINOR]

**Dimension:** 13 — Codebase Alignment (also 7)
**Location:** `03-06-organize-tests-skill.md` §Skill frontmatter/Protocol (lines 43-72) and §Safety rules (lines 126-133); `99-execution-plan.md` task 6.2.1 (line 203)
**Codebase Evidence:** `scripts/hygiene-content.spec.test.mjs:108-117` iterates every directory under `skills/` with a `SKILL.md` and fails if the file does not include `_shared/workspace-hygiene.md`. The existing test is part of `npm run verify` (`node --test`).

**The Problem:** The new skill's content outline does not include the hygiene link. When Phase 6 adds `skills/organize-tests/SKILL.md`, the existing hygiene content test will fail at the Phase 6 full verify (task 6.3.3). The plan's Phase 6 content tests do not mention this requirement, so the failure is discovered late.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add the workspace-hygiene link to the new skill content and a Phase 6 content-test assertion. | Makes the existing test pass; consistent with every skill. | One line. |
| B | Exempt the new skill from the hygiene test. | No content change. | Breaks the repository invariant; not recommended. |

**Recommendation:** **Option A** — add the link and assertion.

**Confidence:** High — the existing test is explicit.
**Hardening:** Not required (MINOR).

**User Decision:** Resolved — User accepted recommendation: Option A (add the `_shared/workspace-hygiene.md` link to the new skill and a Phase 6 content assertion).

---

### PF-021: Module boundaries and the Related Files list are inconsistent [🟡 MINOR]

**Dimension:** 12 — Consistency (also 5)
**Location:** `03-03` §Module boundaries (lines 30-41: `test-map.mjs` "Load, merge, validate"; one `test-map` module); `99-execution-plan.md` task 2.2.3 (line 94 `bin/lib/test-map-validate.mjs`); `00-index.md` §Related Files (line 99 `bin/lib/{test-map,test-selection,test-runner,test-branch-policy,test-provenance}.mjs`)
**Codebase Evidence:** The repo's `bin/lib/` pattern is one `.mjs` + one `.d.mts` per concern; the plan's Phase 2 task adds a separate validation module, while 03-03 assigns validation to `test-map.mjs`.

**The Problem:** The module table, the execution-plan tasks, and the index's Related Files list disagree on the module set. 03-03 lists six modules (`test-map`, `test-selection-glob`, `test-selection-changes`, `test-selection`, `test-selection-explain`, `test-runner`); Phase 2 adds `test-map-validate`; the Related Files list omits `test-map-validate`, `test-selection-glob`, `test-selection-changes`, and `test-selection-explain`. An implementer cannot tell which modules to create or where validation lives.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Update 03-03, Phase 2, and the Related Files list to one module map; decide whether validation is a separate `test-map-validate.mjs` or part of `test-map.mjs`. | One source of truth. | Documentation edits. |
| B | Keep the current split and add a cross-reference note. | No structural change. | Still inconsistent. |

**Recommendation:** **Option A** — make the module list authoritative and update the plan tasks/Related Files.

**Confidence:** High — the lists are explicit.
**Hardening:** Not required (MINOR).

**User Decision:** Resolved — User accepted recommendation: Option A (one authoritative module map; update 03-03, Phase 2, and the Related Files list).

---

### PF-022: Several AR cross-references do not point to the decision they claim [🟡 MINOR]

**Dimension:** 12 — Consistency
**Location:** `01-requirements.md` Security line 71 ("never interpolate ... (AR-33)"); `03-04` error table lines 179-180 and 185 ("AR-33"); `03-02` error table line 288 ("Duplicate ID/cycle ... AR-16") and line 290 ("Empty/overlapping groups ... AR-22"); `03-03` error table line 205 ("Dependency cycle ... AR-16")
**Codebase Evidence:** AR-33 is "How is the selector itself tested?"; AR-16 is "Must the artifact/config schema change?"; AR-22 is "How are shared test fixtures/helpers treated?" None of them is the security/validation decision cited.

**The Problem:** The traceability requirement says every design decision carries an AR back-reference. Using AR-33 for runtime command safety, AR-16 for validation, and AR-22 for empty groups makes the audit chain misleading. The plan's own quality checklist requires every citation to resolve to an existing AR entry; these resolve, but to the wrong decision.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Correct the refs (use AR-20/AR-24 for security/fallback, AR-2/AR-20 for validation) or add the missing decision to the register. | Honest traceability. | Register/table edits. |
| B | Add a note that the refs are approximate. | No table edits. | Weakens the audit trail. |

**Recommendation:** **Option A** — correct the refs and add a content test that AR refs are in range and category-appropriate.

**Confidence:** High — the AR table is explicit.
**Hardening:** Not required (MINOR).

**User Decision:** Resolved — User accepted recommendation: Option A (correct the AR cross-references or add the missing decision to the register).

---

### PF-023: The plan-local targeted verification conflicts with the current standards until Phase 1 lands [🟡 MINOR]

**Dimension:** 11 — Ordering & Sequencing (also 3)
**Location:** `99-execution-plan.md` §Overview (line 13 "Plan-local verification policy: each phase uses a targeted `**Verify**` command ... a dedicated final task ... full `npm run verify`"); `standards/coding-standards.md:32-34` and `standards/coding-standards-full.md:74-75` (full verify before completing any task or committing); Phase 1 tasks 1.1.1-1.3.2 (lines 57-74)
**Codebase Evidence:** The always-injected standards are not conditional today; Phase 1 task 1.2.1 changes them. The plan's Phase 1 tasks run before that change is verified.

**The Problem:** The plan authorizes a targeted per-phase verify so the feature's own development does not pay the full suite per task. But the current always-injected standards require the full verify before every task/commit; the conditional wording is only added in Phase 1. Until 1.2.1 is implemented and verified, the earlier Phase 1 tasks (and every later phase before the change) would violate the standards. The plan does not record an AR decision approving this plan-local gate.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a named AR entry (e.g., `Technical`) approving the plan-local gate for this plan, with the full-verify fallback at each phase end. | Explicit authority; keeps the cost benefit. | Register addition. |
| B | Run the full verify for Phase 1 tasks until 1.2.1 lands, then use the plan-local gate. | Strictly honors the current standards. | Slower Phase 1. |
| C | Drop the plan-local policy and use full verify per task. | Simplest compliance. | Defeats the plan's own cost goal. |

**Recommendation:** **Option A** — record the plan-local gate as an explicit user-approved decision, or **Option B** for Phase 1 only.

**Confidence:** High — the standards are explicit and the plan's policy is not yet authorized.
**Hardening:** Not required (MINOR).

**User Decision:** Resolved — User accepted recommendation: Option A (record the plan-local gate as an explicit user-approved decision; otherwise use Option B for Phase 1 only).

---

### PF-024: Case sensitivity follows the platform, making selection non-deterministic across OS [🟡 MINOR]

**Dimension:** 6 — Feasibility Concerns (also 9)
**Location:** `03-03` §Glob matching (line 88 "Case sensitivity follows the platform for filesystem paths; the selector reports the effective mode")
**Codebase Evidence:** The selector is intended to be deterministic (`03-03` result order, map hash, ST determinism test); CI is Linux, developers may be on macOS/Windows with case-insensitive filesystems.

**The Problem:** Matching repo-relative Git paths is not the same as filesystem lookup. A case-insensitive matcher on macOS/Windows can select a different group than a case-sensitive matcher on Linux for the same commit. That breaks the plan's determinism claim and can make CI and local evidence disagree. The plan says it reports the effective mode but does not define a stable policy.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Match repo-relative paths case-sensitively on every platform (Git semantics); add an explicit `caseSensitive` policy only if needed. | Deterministic; matches Git. | Authors must use exact case. |
| B | Match case-insensitively everywhere. | Matches Windows developer expectations. | Can over-select; still differs from Git on Linux. |
| C | Keep platform-dependent behavior and document it. | No change. | Non-deterministic; contradicts the determinism test. |

**Recommendation:** **Option A** — case-sensitive matching for repo-relative paths, with an optional policy override and a determinism ST across platforms.

**Confidence:** Med — the plan may consider platform-following intentional, but it conflicts with determinism.
**Hardening:** Not required (MINOR).

**User Decision:** Resolved — User accepted recommendation: Option A (case-sensitive matching for repo-relative paths; optional policy override; cross-platform determinism test).

---

### PF-025: `requires` failure detection is undefined [🟡 MINOR]

**Dimension:** 2 — Implicit Assumptions (also 6)
**Location:** `03-02` §Group model (line 71 "`requires` ... Missing requirement fails, never skips"); `03-04` §`run` step 8 (line 92 "Missing `requires` (db/browser/device) fails the group with a clear message; it is never a skip")
**Codebase Evidence:** The repo has no service-probe helper or convention; the plan does not add one.

**The Problem:** The runner cannot know whether a `db`, `browser`, or `device` is available unless the plan defines a probe, an environment flag, or a project-supplied check. "Missing requirement fails" is an implicit assumption about a capability the runner does not have. Implementers may invent different probes, or treat `requires` as metadata and never fail.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Define a probe contract: env var (e.g., `CODEOPS_REQUIRES=db,browser`) and/or a project-supplied `check` command per requirement; fail when the probe says absent. | Explicit; testable. | New small config surface. |
| B | Treat `requires` as metadata only; let the group command fail naturally. | No probe. | The "never skip" guarantee is weaker; failures are less clear. |
| C | Remove `requires` from the schema. | Smallest. | Loses the declared service contract. |

**Recommendation:** **Option A** — define the probe contract and add tests for present/absent/invalid.

**Confidence:** High — no detection mechanism exists.
**Hardening:** Not required (MINOR).

**User Decision:** Resolved — User accepted recommendation: Option A (define a `requires` probe contract with present/absent/invalid tests).

---

### PF-026: Feature branches have no branch-policy class or default gate [🟡 MINOR]

**Dimension:** 1 — Ambiguities (also 12)
**Location:** `03-05` §Branch policy (lines 31-53) and §Gate mapping (line 62 "Feature (`feature/**`, other local) | `task`/`pr`"); `03-03` §Branch-aware base (line 60 `feature/**`)
**Codebase Evidence:** The default policy has `integration`, `release`, `acceptance`, and `unknown`; there is no `feature` key. `03-05` classification maps every unmatched branch to `unknown` → integration gate + warning.

**The Problem:** The gate table says a feature branch uses `task` or `pr`, but the policy cannot identify a feature branch; it falls into `unknown` → integration `pr` + warning. The CLI has no context switch to choose `task` for local work. A developer running `codeops-test run` on `feature/x` gets the slower PR gate and a warning, contrary to the table's intent.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a `feature` pattern/list with default `task` for local runs and `pr` for CI (detect `CI`), or require `--gate task` locally. | Matches the table; clear. | New policy key or env-dependent behavior. |
| B | Remove the feature row and document that local callers pass `--gate task`. | Smaller. | Less discoverable. |
| C | Treat feature branches as `pr` everywhere. | Simple. | Slower local loop; warning noise. |

**Recommendation:** **Option A** — add the feature class and define the CI/local split, or **Option B** with an explicit doc note.

**Confidence:** Med — the plan may intend `--gate` to be the local switch.
**Hardening:** Not required (MINOR).

**User Decision:** Resolved — User accepted recommendation: Option A (add a feature branch class/default gate; otherwise use Option B with an explicit doc note).

---

### PF-027: "Apply atomically" has no staging or rollback mechanism [🟡 MINOR]

**Dimension:** 6 — Feasibility Concerns (also 9)
**Location:** `03-06` protocol step 9 (line 70 "Apply atomically — write map/policy/fragments, generate the thin project wrapper ..., update the `CODEOPS-TESTING` block, patch CI additively, add package scripts")
**Codebase Evidence:** The repo's installer writes managed files with marker ownership and preserves hand-authored files; it does not provide a multi-file transaction primitive.

**The Problem:** The skill writes several files across the repository. "Atomically" is not achievable with independent writes; a failure midway can leave a partial map, a half-updated AGENTS block, and a CI patch without the map. The plan does not define staging, validation-before-commit, or rollback.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Define a staging step: render all content in memory/temp, validate the map and diffs, then write; on failure, restore the prior files. | Predictable; matches the "apply atomically" intent. | More implementation work. |
| B | Rename the step "Apply with validation" and define a per-file sequence with a clear failure report; no rollback. | Simpler. | Partial state on failure. |
| C | Write only one file per invocation. | Small steps. | Many invocations; worse UX. |

**Recommendation:** **Option A** if the plan wants the atomicity claim; otherwise **Option B** with an explicit partial-state warning.

**Confidence:** High — no transaction mechanism is defined.
**Hardening:** Not required (MINOR).

**User Decision:** Resolved — User accepted recommendation: Option A (staging, validation-before-write, and rollback; otherwise use Option B with a partial-state warning).

---

### PF-028: Failure logs may be deleted before the user can use the reported path [🟡 MINOR]

**Dimension:** 4 — Completeness Gaps (also 7)
**Location:** `03-04` §Runner safety (line 137 "delete after the run unless `--keep-logs` is explicit"); `03-04` §`run` step 6 (line 90 "print a one-line PASS or the failure tail (last 50 lines + log path)") and error table (line 179 "failure tail + log path")
**Codebase Evidence:** The repo's verify-output capture rule keeps a log under `$CODEOPS_TMPDIR` for the failure tail (`skills/exec-plan/execution-protocol.md:231`); workspace hygiene permits named temp artifacts to outlive the task.

**The Problem:** The runner says logs are deleted after the run unless `--keep-logs` is explicit. On failure it prints a log path for the user to inspect. If the log is deleted at the end of the same run, the path is dead. The plan does not distinguish success from failure retention.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Retain failure logs (named, under the temp root) and delete them only on success or after an explicit cleanup; state the retention window. | The reported path is usable. | Temp files outlive the run; needs cleanup guidance. |
| B | Delete always; print only the failure tail and no path. | Clean. | Loses the full log. |
| C | Keep logs only with `--keep-logs`, but make the failure message say the path may be gone. | Honest. | Still loses evidence. |

**Recommendation:** **Option A** — retain failure logs under the temp root and document cleanup.

**Confidence:** High — the current wording is contradictory on failure.
**Hardening:** Not required (MINOR).

**User Decision:** Resolved — User accepted recommendation: Option A (retain failure logs under the temp root and document cleanup).

---

### PF-029: Release documentation says "all shards" but the release example uses the single full gate [🔵 OBSERVATION]

**Dimension:** 12 — Consistency
**Location:** `03-05` §CI plan contract (line 93 "release/acceptance return every group ... the matrix includes all groups"); `03-07` §Architecture (line 22 "plan(all) → all shards → verify aggregator → package") versus §Release and package gate (lines 113-129, `verify` calls `verify-full.yml`, no shards) and §This repository's changes (lines 172-178)
**Codebase Evidence:** `verify-full.yml` runs `npm run verify` + `npm pack --dry-run` in one job; the current `.github/workflows/release.yml:69-70` also runs `npm run verify`.

**The Problem:** The plan describes release as all shards in one place and as a single reusable full gate in another. Both satisfy the full-suite guarantee, but the workflow shape and the aggregator semantics differ. An implementer may build two release paths or assume the matrix is the release gate.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | State that release runs either the full gate or all shards, and make the example and template use one shape consistently. | Clear; no duplicate path. | Documentation edit. |
| B | Make release always use the reusable full gate; remove "all shards" wording. | Simpler. | Gives up shard parallelism for large suites. |

**Recommendation:** **Option A/B** — choose one release shape; the full gate is the simpler default for this repo. No code impact.

**Confidence:** High — the wording is inconsistent.
**Hardening:** Not required (OBSERVATION).

**User Decision:** Accepted — User accepted recommendation: Option B (align the docs on the single reusable full gate; remove the conflicting "all shards" wording).

---

### PF-030: `plugin/index.ts:64-76` cites standards loading, not injection [🔵 OBSERVATION]

**Dimension:** 13 — Codebase Alignment
**Location:** `02-current-state.md` §Dependencies (line 116 "The plugin standards injection (`plugin/index.ts:64-76`)")
**Codebase Evidence:** `plugin/index.ts:64-76` reads `standards/coding-standards.md` and `output-style.md` into `standardsText`; the injection into the system prompt is at `plugin/index.ts:284-288`.

**The Problem:** The citation points to the loading block, not the injection hook. The plan's claim is true, but the line reference is approximate; a reviewer following it to verify the "injected into every request" behavior lands one step early.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Cite `plugin/index.ts:64-76, 284-288` (load + inject). | Accurate. | One-line edit. |
| B | Leave as is. | No edit. | Slightly misleading. |

**Recommendation:** **Option A** — update the cite.

**Confidence:** High — the code is explicit.
**Hardening:** Not required (OBSERVATION).

**User Decision:** Resolved — User accepted recommendation: Option A (cite `plugin/index.ts:64-76, 284-288` for loading plus injection).

---

## Next Steps

1. All 30 accepted fixes are applied; see the Fixes Applied table and the post-fix snapshot above.
2. Iteration 2 verification passed (links, tables, counts, stale tokens, key phrases, 40 targeted content tests, and full `npm run verify`: 682 tests, 0 fail, version `2.5.0`). Dependencies were provisioned with `npm ci` (485 packages).
3. The plan is ready for `exec-plan` or a human review of the applied fixes. No further preflight iteration is required unless the plan changes again.
4. The roadmap row is advanced to `Plan Preflighted` (🔬) on 2026-11-12; it does not move to `Done` until the plan is executed and verified.
5. No code, skill, or standards file was changed by this fix pass; the plan documents, this report, and the roadmap row are the complete modification set.

## Pre-fix Artifact Snapshot (per-file SHA-256)

| File | SHA-256 |
| --- | --- |
| `00-ambiguity-register.md` | `8c35cf84363d1debd94d5c01b07a7e3f00220cade75a83d05c02c9552ad0c6c7` |
| `00-index.md` | `ec5f82972de438b5deadbd4c0fe429e2955b3e50b8bde50eb4c77be158db45ee` |
| `01-requirements.md` | `b9282e69dc07a03fa0d92b128637d4fd622bcddf6e3d3960b7aa83d21668363d` |
| `02-current-state.md` | `27a964782670f1ed75d94a4e1ffb88b94dbd04b6cab98b76c238aa448fef614d` |
| `03-01-lightweight-scoped-verification.md` | `e71cf0ffbbb16adf8aa7a75fc88da50eaf32d8c9b61ad9c7c1a7d05bf4be0d32` |
| `03-02-test-map-model.md` | `6dde010c4f4cf25f2691cfaa36a4b29aac09202c528033e373e8c1f19d9adfd4` |
| `03-03-selector-core.md` | `d33f074249da18eaa7f26ef4828d95be7009558ba70d31f4a9a0fb96155ce9f9` |
| `03-04-cli-and-runner.md` | `1ccf7de851c73cff57d4c3bf5a22ece24d8b5fbb965315f030d51821249c94e6` |
| `03-05-branch-policy-and-provenance.md` | `cf73fead6f0ef6dac2c082b607c035421e24225fb7e5c75345be977237571b23` |
| `03-06-organize-tests-skill.md` | `d14d7d120d824023fc903b7501009df2e671f5a7ed5ad86fb1d8fb42d58244be` |
| `03-07-ci-release-integration.md` | `dd691becba24967ba8aec4271effad9fbe5700bb598eb6c65a7f17a0f9426ce3` |
| `07-testing-strategy.md` | `6f9fffc6568a94a299097c741c1cf91c3def561d9b94d3fbe15b25a9b99bf3b7` |
| `99-execution-plan.md` | `af1c8f196df3d9cfab65c5aaea498848c6e967d5ba0cdecdb293e00c1bfdc15b` |
