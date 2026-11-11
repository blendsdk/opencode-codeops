# Ambiguity Register: Test Impact Selection

> **Status**: ✅ GATE PASSED — all 37 items resolved
> **Last Updated**: 2026-11-11 23:36
> **Authority**: User approved the design across the 2026-11-11 design review and directed plan creation. Rows below record the decisions made in that review.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Technical (complexity escalation) | Is the feature a lightweight plan-scoped test command, or a full opt-in map/selector/skill/CI layer? | A: lightweight only; B: full opt-in layer | Approved B, with the independent challenger's lightweight fallback adopted first and its anti-silent-selection mitigations folded in. Full evidence in §Complexity Escalation AR-1. | ✅ Resolved |
| 2 | Scope | What happens in a project with no test map? | A: infer groups; B: existing full verify | B — exact current behavior; no map means full verify per task/commit. | ✅ Resolved |
| 3 | Scope | Which languages must the core support? | A: Node only; B: language-neutral core + adapters + custom fallback | B — any language CodeOps handles; adapters are data/recipes, not core code. | ✅ Resolved |
| 4 | Behavioral | Where does the full suite run? | A: every task/PR; B: release/package branch, acceptance, production; nightly changed-only | B — full on the branch that builds deployable packages and at acceptance; nightly only when relevant changes exist. | ✅ Resolved |
| 5 | Behavioral | What counts as a relevant change for the nightly full run? | A: any commit; B: source/test/config since last successful full; docs skipped | B — compare to the last successful full-run SHA; docs-only changes skip. | ✅ Resolved |
| 6 | Technical | What is the primary grouping model? | A: directories/packages; B: feature slices | B — feature slice is the primary unit; compiler pipeline stages and library modules are allowed slice shapes. | ✅ Resolved |
| 7 | Non-functional | What is the task-gate budget? | A: hard 2 minutes; B: soft 2–3 minutes; C: no budget | B — 120 s target, 180 s acceptable; over 180 s warns, never drops tests. | ✅ Resolved |
| 8 | Technical | Where does the map live, and how do multiple agents avoid conflicts? | A: one large file; B: domain fragments; C: one file per feature | B — `codeops/test-map/` with one fragment per bounded context plus `shared.json`; single-file mode for small projects. | ✅ Resolved |
| 9 | Scope | Which tests always run regardless of change? | A: global security group; B: per-project list; C: none | B — per-project configuration; default empty; always-run groups must be fast task-tier groups. | ✅ Resolved |
| 10 | Scope | How is acceptance handled? | A: automated only; B: project-configurable automated/manual/external | B — project records `automated`, `manual`, or `external`; release/acceptance gate enforces it. | ✅ Resolved |
| 11 | Integration | Which branch names trigger which gates? | A: one release branch; B: configurable patterns | B — `main`/`master` integration; `release/**`, `release*`, `hotfix/**`, `hotfix*` release; `acceptance/**`, `acceptance*` acceptance; `v*` tags release. | ✅ Resolved |
| 12 | Behavioral | What happens when a branch matches multiple patterns? | A: first match; B: strictest gate | B — acceptance > release/hotfix > integration > feature; unknown → integration + warning. | ✅ Resolved |
| 13 | Behavioral | Does a hotfix require the full suite? | A: affected only; B: full + expedited acceptance | B — full required; acceptance may be an expedited manual sign-off with explicit approval. | ✅ Resolved |
| 14 | Integration | Do acceptance and production re-run the full suite for the same build? | A: re-run everywhere; B: verify once, promote the artifact | B — reuse full-run evidence for the same artifact digest; a rebuild requires a new full gate. | ✅ Resolved |
| 15 | Naming | What is the map artefact called and where does it live? | A: `codeops.json` key; B: `codeops/test-map.json` / `codeops/test-map/` | B — separate schema-versioned artefact; no change to `codeops/codeops.json`. | ✅ Resolved |
| 16 | Compatibility | Must the artifact/config schema change? | A: bump schema; B: additive separate map | B — map has its own `schema: 1`; plan/artifact/config schemas unchanged. | ✅ Resolved |
| 17 | Technical | Where does the selector live and what runtime does it use? | A: new service; B: Node ESM under `bin/`, no new dependency | B — Node ≥18 ESM, matching the repo's existing CLI/tooling. | ✅ Resolved |
| 18 | Naming | What are the CLI commands? | A: one `test` command with flags; B: subcommands | B — `select`, `run`, `check`, `plan`, `shadow`, `provenance`. | ✅ Resolved |
| 19 | Technical | What is the diff baseline? | A: always `origin/main`; B: phase baseline then branch-aware fallback | B — phase baseline tree first; branch-aware merge-base/tag next; otherwise full. | ✅ Resolved |
| 20 | Behavioral | What happens on an unknown, unowned, shared, or selector-error path? | A: skip; B: full suite | B — fail closed to the full suite, with a visible reason. | ✅ Resolved |
| 21 | Behavioral | What happens on a docs-only change? | A: full suite; B: no tests | B — no tests; the standards' non-code validation table still applies independently. | ✅ Resolved |
| 22 | Behavioral | How are shared test fixtures/helpers treated? | A: owning group only; B: full or shared dependency | B — a shared test-support group or full-suite fallback; `check` requires classification. | ✅ Resolved |
| 23 | Behavioral | How is selection safety proven before adoption? | A: trust the map; B: shadow mode + zero missed failures | B — shadow mode compares selected and full outcomes; enable only at zero missed failures. | ✅ Resolved |
| 24 | Security | How is the map protected from weakening selection? | A: trust authors; B: review + strict check | B — CODEOWNERS, `check --strict`, reasons for `ignorePaths`, review of map diffs. | ✅ Resolved |
| 25 | Non-functional | Where is coverage measured? | A: per task; B: full release/acceptance gate | B — selection never replaces coverage; the full gate measures it where the project already does. | ✅ Resolved |
| 26 | Integration | What do delegated executor packets receive? | A: full verify only; B: task and gate commands + baseline + expected groups | B — both commands, baseline, expected footprint, and the fallback rule. | ✅ Resolved |
| 27 | Compatibility | How do old plans and AGENTS.md files behave? | A: migrate; B: no migration | B — a single `**Verify**` line is the gate command; task selection is derived only when a map exists; old AGENTS.md is preserved. | ✅ Resolved |
| 28 | Naming | What is the new skill called? | A: `test-map`; B: `organize-tests` | B — `organize-tests`. | ✅ Resolved |
| 29 | Behavioral | How invasive is the skill? | A: rewrite tests/CI; B: preview/apply, no test edits, additive CI | B — never edit tests, never remove CI jobs, preview all writes, idempotent. | ✅ Resolved |
| 30 | Integration | How does CI handle a changing set of affected shards? | A: static full job; B: dynamic matrix + stable aggregator | B — one stable `verify` aggregator is the required check; release runs all shards. | ✅ Resolved |
| 31 | Behavioral | How does the plan know the expected test footprint? | A: discover at runtime only; B: plan records it | B — make-plan records expected slices/groups; exec-plan reports test-scope drift. | ✅ Resolved |
| 32 | Non-functional | Are metrics/audit mandatory? | A: mandatory service; B: optional content-free metrics | B — optional; output goes to existing outcome-review/metrics surfaces. | ✅ Resolved |
| 33 | Technical | How is the selector itself tested? | A: unit only; B: spec + impl + fixture ecosystems + security | B — spec tests first, impl tests, Node/Rust/custom fixtures, path/command security cases. | ✅ Resolved |
| 34 | Compatibility | How is the feature released? | A: major bump; B: additive minor | B — minor version via `scripts/release.mjs`; CHANGELOG entry; no breaking skill contract. | ✅ Resolved |
| 35 | Behavioral | What is the lightweight fallback for projects that do not want a map? | A: no fallback; B: plan-scoped task verify | B — a plan may record a scoped task command; make-plan runs it once and records the observed test count; exec-plan falls back to full outside the expected modification set. | ✅ Resolved |
| 36 | Integration | Who owns CI templates? | A: CodeOps rewrites project CI; B: advisory templates, additive patches | B — templates are advisory; the skill patches additively and never removes an existing full gate. | ✅ Resolved |
| 37 | Technical | May this plan use targeted per-phase verification while the feature's conditional standards wording is being implemented? | A: full verify per task until Phase 1 lands; B: named plan-local gate with full verify at each phase end | B — plan-local gate; every phase ends with `npm run verify`; no commit without a passing phase gate. Recorded by preflight PF-023. | ✅ Resolved |

## Complexity Escalation AR-1 — approval evidence

**Original goal:** Stop paying for the entire test suite on every task/commit/session while keeping a trustworthy full-suite release gate.

**Extra system or support code:** A committed test-impact map (schema, fragments, tiers, globs, dependency edges, budgets, branch policy), a selector CLI and command runner, a `organize-tests` skill with shadow adoption and audit, conditional plan/exec/commit/analyze integration, and advisory CI templates for dynamic shards, a stable aggregator, nightly changed-only runs, and release provenance/artifact promotion.

**Why it may be needed:** A single full verify command serves three different altitudes — task feedback, phase/PR integration, and release gating. Manual plan-scoped commands reduce cost but rely on authoring discipline and cannot produce deterministic, auditable selection across languages, teams, worktrees, or CI shards.

**Evidence:** `standards/coding-standards.md:33-34`; `skills/exec-plan/SKILL.md:180-185`; `skills/exec-plan/execution-protocol.md:105-123`; `skills/make-plan/templates.md:481`; `skills/git-commit/SKILL.md:17`; `.github/workflows/ci.yml:24-25`; `.github/workflows/release.yml:69-70`; the latest plan evidence records ~675 tests at `plans/discovery-ui-redesign/99-execution-plan.md:199`. The phase baseline tree already exists at `execution-protocol.md:51-66`.

**Smallest solution that still works:** Add a `**Task verify**` line per phase, have make-plan run it once and record the observed test count, run it per task/commit, and keep the full verify at phase/plan/CI/release. This is Phase 1 of the plan and remains a supported fallback for projects that do not adopt a map.

**Extra cost:** New schema, selector modules, CLI, tests, one skill plus references, workflow templates, map fragments, and ongoing map checks. The map is opt-in; no project pays the cost until it runs `organize-tests` and approves the map.

**Independent verdict:** `Simplify` — the challenger found the map/selector/skill/CI surface larger than the stated goal requires and recommended plan-scoped commands plus a durable `AGENTS.md` test-slices table. The plan adopts the lightweight fallback first, the authoring-time scoped-command proof, and the expected-modification-set fallback; the remaining machinery is phased and opt-in.

**Direct user decision:** Approved the larger opt-in design and directed plan creation. The map/skill/CI layer stays because the user explicitly requires deterministic grouping, an adoption skill for existing projects, multi-worktree/multi-team operation, and CI/CD gate changes.

## Resolution Notes

**AR-1:** This row is the complexity-escalation owner. The plan's Phase 1 is the challenger's smallest alternative; Phases 2–7 add the opt-in machinery only after that behavior is documented and tested. The map never changes a project without a map.

**AR-2 / AR-20 / AR-27:** The no-map path is a hard compatibility contract: same commands, same gates, same plan format, same AGENTS.md behavior. Any selector error falls back to full.

**AR-4 / AR-5 / AR-11 / AR-12 / AR-13 / AR-14:** The full gate is release-centric. The stable CI aggregator is the required check; production reuses evidence only for the same artifact digest.

**AR-7 / AR-35:** The 2–3 minute budget is a soft design target. A scoped command that runs zero tests is forbidden; make-plan must run it once and record the observed count.

**AR-8 / AR-23 / AR-24:** Domain fragments + shadow mode + strict map checks are the multi-team/worktree safety package. Adoption is refused at any shadow-mode missed failure.

**AR-29 / AR-36:** The skill and CI templates are additive. They never rewrite tests or remove an existing full gate.

**AR-37:** The plan-local gate is authorized for this plan only. It does not change the project-wide standards; those change in Phase 1, and every phase still ends with the full `npm run verify`.
