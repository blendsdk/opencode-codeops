## Preflight Report: Task T-06 — `fix-agent-frontmatter` (mini-plan)

> **Status**: ✅ PREFLIGHT PASSED — all 8 findings resolved
> **Iteration**: 2 (iteration 1 findings applied; bounded re-scan verified)
> **Artifact**: Task mini-plan at `plans/fix-agent-frontmatter/99-execution-plan.md`
> **Artifact revision**: `f14689e550cb0b71e697dd2ee78e780590f11f3e8816b2cebe6be217c0cee4b3` (scan start) → `dbd4b9b5b619862aee64d869a014721ebb3224283a8f3524ddf8b42f7283648d` (passed revision; uncommitted)
> **Codebase Grounded**: 18 files examined; 15 references mapped — all verified
> **Lens**: data & migration (file-format evolution, mixed-version compatibility) + universal categories
> **Last Updated**: 2026-10-09 14:07

> ⚠️ **SAME-SESSION REVIEW**: artifact and prior analysis were created in this session. The
> ~5-cluster `preflight-auditor` fan-out was unavailable (specialist agents not launchable in the
> session — the very condition this task fixes); sequential inline scan plus in-context hardening
> layers were used per `_shared/quality-profile.md` (dynamic-packet/inline fallback, reported).
> No CRITICAL/MAJOR findings were raised, so the mandatory challenger pass did not trigger.

### Codebase Context Summary

**Tech stack:** OpenCode plugin — TypeScript entry (`plugin/index.ts`), Python generators
(`scripts/`), Markdown skills; Node ≥18, Python ≥3.8.

**Key files examined:** `scripts/install_agents.py` (`build_agent_frontmatter:428`,
`is_codeops_generated:506-524`, `generate_custom_agent:527`, `generated_custom_template:697-711`,
`run_check:868` — catalog branch existence-only, briefs branch `STALE` compare),
`scripts/install_agents.spec.test.mjs` (`frontmatterBlock:182`, `assertMarkerFirst:209`,
`markerAgent:229`, golden test `:696`, foreign fixture `:896-906`),
`scripts/hygiene-content.spec.test.mjs` (`agentBody:60`), `scripts/fixtures/catalog-executor.golden.md`,
`agents/*.md` (12 files), `scripts/release.mjs` (`--tag latest|next|beta`),
`.github/workflows/release.yml:17`; upstream `anomalyco/opencode` v2.0.24 + dev
(`config/plugin/agent.ts`, `config/markdown.ts`, `tui/context/local.tsx`, `schema/agent.ts`,
`v1/config/migrate.ts`, gray-matter 4.0.3).

**Reference verification:** 15/15 verified (paths, helpers, commands, upstream behavior).

### Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 2 | 🟡 MINOR |
| 2 | Implicit Assumptions | 1 | 🔵 OBSERVATION |
| 4 | Completeness Gaps | 1 | 🟡 MINOR |
| 11 | Ordering & Sequencing | 1 | 🔵 OBSERVATION |
| 12 | Consistency | 1 | 🔵 OBSERVATION |
| 13 | Codebase Alignment | 2 | 🟡 MINOR |
| — | all others | 0 | — |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 0 | — |
| 🟡 MINOR | 5 | All resolved |
| 🔵 OBSERVATION | 3 | All resolved |

---

### PF-001: T-06.4 regeneration mechanism unspecified 🟡 MINOR

**Dimension:** Completeness · **Location:** T-06.4
**Codebase evidence:** `install_agents.py` writes `<project>/.opencode/agents/`; no in-repo
command writes the packaged `agents/` directory; the golden test (`install_agents.spec.test.mjs:696`)
is the existing generation path precedent.
**Problem:** The task gave no mechanism or acceptance for producing the packaged files.
**Recommendation (only viable):** state the mechanism: generate all roles into a scratch project,
copy outputs into `agents/`, confirm each starts with `---`; golden uses the same path.
**User Decision:** Resolved — User accepted recommendation (applied).

### PF-002: "review the foreign-role fixture" had no defined action 🟡 MINOR

**Dimension:** Ambiguities / Testability · **Location:** T-06.3
**Codebase evidence:** `install_agents.spec.test.mjs:896-906` — a legacy banner-first file with a
catalog template used by the `--remove-custom` refusal test.
**Recommendation:** keep as-is; it needs no change and doubles as legacy-layout coverage.
**User Decision:** Resolved — User accepted recommendation (applied).

### PF-003: Release command placeholder `<dist-tag>` 🟡 MINOR

**Dimension:** Ambiguities · **Location:** T-06.7
**Codebase evidence:** `scripts/release.mjs` requires `--tag latest|next|beta`;
`.github/workflows/release.yml:17` documents `latest` as stable.
**Recommendation (only viable for a stable patch):** pin `--tag latest`.
**User Decision:** Resolved — User accepted recommendation (applied).

### PF-004: Upgrade guidance missing from the release deliverable 🟡 MINOR

**Dimension:** Codebase Alignment (Migration & Compatibility) · **Location:** T-06.7
**Problem:** Existing installs need documented upgrade steps; package installs self-heal via the
marker file, project files need a regeneration run, and `--check` reports `STALE` until then.
**Recommendation:** require the release notes/CHANGELOG to state the upgrade steps.
**User Decision:** Resolved — User accepted recommendation (applied).

### PF-005: Migration-lens closure — boundary, rollback, mixed-version unstated 🟡 MINOR

**Dimension:** Codebase Alignment (Migration & Compatibility) · **Location:** Objective
**Assessment (verified):** boundary 2.0.3 → 2.0.4; rollback = reinstall the previous package
(files regenerate to legacy layout; no corruption); mixed version = new files + old tooling are
skipped as hand-authored by the old first-line check (`install_agents.py:524`) — safe.
**Recommendation:** add a short Compatibility paragraph recording all three statements.
**User Decision:** Resolved — User accepted recommendation (applied).

**Confidence:** High (source-verified) · **Hardening:** in-context layers only (single-path, low stakes).

### PF-006: Issue close-out should name the github-issues skill 🔵 OBSERVATION

**Dimension:** Consistency · **Location:** T-06.8
**Recommendation:** reference the github-issues skill and note the mutation authorization.
**User Decision:** Resolved — User accepted recommendation (applied).

### PF-007: Expected intermediate red suite not stated 🔵 OBSERVATION

**Dimension:** Ordering & Sequencing · **Location:** T-06.2 → T-06.3
**Codebase evidence:** `assertMarkerFirst()` (`:209-211`), `frontmatterBlock()`, and
`hygiene agentBody()` fail after the generator change until updated.
**Recommendation:** state that these are expected red between T-06.2 and T-06.3; only T-06.5
requires a fully green suite.
**User Decision:** Resolved — User accepted recommendation (applied).

### PF-008: Release-note precision 🔵 OBSERVATION

**Dimension:** Implicit Assumptions · **Location:** T-06.7
**Problem:** Parsing restores mode/hidden/permissions/descriptions and model pins;
`temperature`/`reasoningEffort` remain preserved-but-unsent by the OpenCode V2 runner.
**Recommendation:** notes must not claim request-setting behavior changes.
**User Decision:** Resolved — User accepted recommendation (applied).

---

### Iteration 2 verification

- All 8 findings verified fixed in the artifact text (quoted changes confirmed by re-read).
- Bounded 13-dimension re-scan within the unchanged audit target: **0 new findings**.
- No reference drift: all codebase anchors re-checked after the edits.
- The Compatibility paragraph closes the data & migration lens (boundary, upgrade, rollback,
  mixed-version).

### Notes

- **Audit target only:** no other artifact was passed or modified for this report. The roadmap was
  not advanced — task-lane artifacts never use the RD/Plan-Preflight stages.
- The passed revision hash above is authoritative for downstream use: a later edit to the
  mini-plan requires a targeted re-check (preflight §Convergence).
- `exec-plan` may execute T-06 from this artifact.
