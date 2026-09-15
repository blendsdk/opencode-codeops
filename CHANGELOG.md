# Changelog

All notable changes to CodeOps are recorded here.

## 1.3.0 — 2026-09-15

- Add a one-line curl installer (`install.sh`) that downloads the repository tarball and runs the
  skills installer. Pin a version with `CODEOPS_REF`.
- Add `status` and `uninstall` subcommands to `bin/install-skills.mjs`.
- Record owned skills and the installed version in `<skills-dir>/.opencode-codeops.json`, and
  replace managed skills atomically on upgrade. Skills not owned by this package are never touched.
- Add specification tests for the installer, run with `node --test`.

## 1.2.0 — OpenCode port — 2026-09-12

Port from `codex-codeops` (Codex plugin) to `opencode-codeops` (OpenCode plugin).

### Breaking changes
- Plugin is now loaded via OpenCode's plugin system (`"plugin": ["opencode-codeops"]` in `opencode.json`) instead of Codex's marketplace mechanism.
- `PLUGIN_ROOT` environment variable renamed to `CODEOPS_PLUGIN_ROOT` to avoid collisions with other plugins.
- Agent files are now OpenCode Markdown format (`.opencode/agents/<role>.md`) instead of Codex TOML (`.codex/agents/<role>.toml`). Regenerate with `scripts/install_agents.py`.
- `setup-routing` now targets `opencode.json` instead of `.codex/config.toml`.

### Changes
- All 16 skills ported verbatim with Codex-specific terminology updated to OpenCode.
- All 12 subagents ship with no hardcoded `model` field — agents inherit the user's active model automatically. Pin models per-role via `opencode.json` or the `setup-routing` skill.
- `bin/codeops-worktree --launch` now starts `opencode` instead of `codex`.
- Standards are now injected into sessions via OpenCode's `session.created`, `session.compacted`, and `experimental.session.compacting` hooks — providing stronger coverage than the Codex equivalent.
- `scripts/install_agents.py` rewritten to generate OpenCode `.md` agent files instead of Codex `.toml` files.

---

## 1.2.0 — 2026-09-04

- Add an always-active Complexity Escalation Gate that requires a visible cost-and-evidence packet,
  an independent challenger, and explicit user approval before material support machinery enters
  requirements, plans, or implementation.
- Make escaped complexity a blocking major finding, reserve escalation approval to the user even
  under `--auto-design`, and reuse existing ambiguity and finding records instead of adding a new
  lifecycle or configuration system.
- Use plain international English in user-facing CodeOps responses.

## 1.1.0 — 2026-08-30

- Show a deterministic ten-cell progress bar after every verified `exec-plan` task, including exact
  task counts and percentage for accessibility.
- Derive the display directly from authoritative Markdown task markers without adding mutable
  progress state or changing the execution-plan artifact format.
- Add specification and implementation coverage for rendering, verification-pending tasks,
  read-only behavior, boundary states, invalid inputs, and conflicting CLI output modes.

## 1.0.1 — 2026-08-26

- Direct planning and implementation toward the simplest solution that satisfies authorized
  requirements, existing project conventions, and demonstrated risks.
- Guard the minimum-sufficient-design instruction in plan quality checks and deterministic plugin
  validation without changing existing workflow gates or artifact formats.

## 1.0.0 — 2026-08-08

- Make Markdown plans the sole authoritative owner of execution progress and requirement delivery,
  removing the mutable traceability graph, transition API, journal, lock, and shadow state.
- Add a read-only plan parser that derives lifecycle, next task, and RD delivery directly from
  `00-index.md` ownership metadata and `99-execution-plan.md` checklist markers.
- Add an all-or-nothing migrator for existing nested projects that preserves checklist progress,
  recovers lightweight and plan-local ownership, and deletes obsolete `traceability.json` files.
- Make `setup-codeops --yes` automatically detect, migrate, and verify legacy workflow state in an
  already-configured project while retaining clean-tree and ambiguity safeguards.
- Validate the migration on JSVision with 21 active plans, deletion of five legacy graphs, and a
  passing Windows, macOS, and Linux CI matrix on Node.js 22 and 24.

## 0.4.0 — 2026-07-31

- Keep planning, preflight, and execution inside strict product scope by default, suppressing
  optional feature suggestions without hiding necessary correctness, safety, or feasibility work.
- Add invocation-scoped `--explore-scope` with durable, user-owned `Keep`, `Defer`, and `Discard`
  decisions for optional additions.
- Keep scope authority separate from auto-design, finding resolution, fix permission, and commit
  modes, with collision-free registers and resume-safe invalidation rules.

## 0.3.1 — 2026-07-24

- Make junior-readable source documentation a non-negotiable implementation standard.
- Require language-appropriate documentation for public APIs and non-trivial internal entities
  while avoiding comments that merely restate trivial private code.
- Block execution-task completion when required documentation is missing, and make omissions an
  explicit phase-review finding even when builds, tests, and linters pass.
- Add conformance coverage that preserves the executor, reviewer, and completion-gate contracts.

## 0.3.0 — 2026-07-23

- Add invocation-scoped `--auto-design` to requirements, planning, preflight, and execution.
- Select eligible technical decisions through a documented strongest-option rubric with durable
  provenance, bounded escalation, invalidation, and independent challenge for high-impact choices.
- Preserve user authority over product direction, risk acceptance, permissions, destructive or
  external actions, and keep commit behavior independent from design delegation.
- Add deterministic contract, boundary, hostile-argument, and collection coverage.

## 0.2.0 — 2026-07-23

- Promote the Codex plugin from beta to the first stable 0.2 release.
- Add dependency-aware, target-scoped readiness across requirements, audit, planning, execution,
  roadmap, feature acceptance, and release workflows.
- Add schema-2 semantic revisions, validation snapshots, atomic lifecycle transitions, explicit
  recovery, and safe schema-1 graph upgrades.
- Keep the broader 1.0 comparative and external complex-project pilot gate explicitly open.
- Adopt Semantic Versioning for all subsequent releases.

## 0.2.0-beta.7 — 2026-07-23

- Add schema-2 target-scoped readiness, atomic lifecycle transitions, and recoverable graph
  upgrades across requirements, audit, planning, execution, roadmap, acceptance, and release.
- Scope readiness gates to the selected feature so unrelated draft work does
  not block planning or execution.
- Treat traceability node IDs as feature-local and require explicit
  qualification for cross-feature links.
- Add planning target, context, and modification boundaries plus bounded
  post-gate ambiguity discovery.
- Align make-plan with the shared named-deferral contract.
- Review complete phase changes in every commit mode using worktree snapshots
  that include staged, unstaged, committed, and newly created files.
- Escalate repeated identical verification failures instead of retrying
  indefinitely.

## 0.2.0-beta.6 — 2026-07-23

- Keep single-document preflight audits scoped to their selected target while
  using related artifacts only as context.
- Bound corrective rescans, preserve finding identity by root cause, and stop
  cleanly when minor findings are explicitly accepted.
- Store narrow preflight evidence separately so sibling requirements and whole
  plans cannot advance from an out-of-scope pass.
- Add deterministic validation for preflight scope and convergence contracts.

## 0.2.0-beta.5 — 2026-07-23

- Make `status` a successful observation for structurally valid projects whose
  requirements or plans are not yet execution-ready.
- Treat migrated Claude roadmap, requirement, and plan documents as first-class
  Codex schema-1 artifacts during roadmap presentation.
- Add regression coverage for valid-but-blocked status and invalid status data.

## 0.2.0-beta.4 — 2026-07-23

- Exclude `codeops/_archive` traceability graphs and execution plans from live
  readiness, lifecycle, and task-progress reports.
- Add regression coverage for repositories with large archived project histories.

## 0.2.0-beta.3 — 2026-07-23

- Enforce per-node lifecycle status vocabularies and reopened-ambiguity invalidation.
- Make the migration layout marker the final commit point after required artifacts.
- Retain versioned ambiguity-benchmark, installation-lifecycle, and independent-review evidence.
- Reconcile release claims, platform boundaries, and governing plan state with evidence.

## 0.2.0-beta.2 — 2026-07-23

- Add deterministic traceability, readiness, lifecycle, drift, and strict-config validation.
- Add Codex-native capability roles and optional project agent installation.
- Add compiler, financial, web, distributed, and migration ambiguity lenses.
- Add retained adversarial scenario and Claude 3.12.0 parity evidence.
- Add install, migration, concepts, troubleshooting, CI, and release documentation.

## 0.2.0-beta.1 — 2026-07-23

- First installable Codex-native beta with requirements, planning, execution,
  review, roadmap, migration, documentation, routing, and utility skills.
