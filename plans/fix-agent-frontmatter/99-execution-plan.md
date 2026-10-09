# Task T-06: Emit frontmatter-first agent files so OpenCode honors mode, hidden, and permissions

> **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Progress**: 0/8 tasks (0%)
> **Reasoning**: medium — bounded bugfix in the agent-file generator with deterministic tests and an explicit upgrade-compatibility check
> **Phase baseline tree**: cf268832b3b6d522e4218dd20118d9de8aa5bc1b
> **Scope mode**: strict · **Expected modification set**: `scripts/install_agents.py`, `scripts/install_agents.spec.test.mjs`, `scripts/install_agents.impl.test.mjs`, `scripts/hygiene-content.spec.test.mjs`, `scripts/fixtures/catalog-executor.golden.md`, `agents/*.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`
> **Last Updated**: 2026-10-09 14:37

## Objective

Fix issue #2: every generated agent file starts with a three-line `#` provenance banner before the
opening `---`. OpenCode parses agent frontmatter only when the file begins with `---`
(`gray-matter` 4.0.3 via `ConfigMarkdown.parseOption`), so the whole block is silently dropped:
all twelve catalog roles install as visible, selectable primary agents, their intended `permission`
maps never apply, model/temperature pins and descriptions are lost, and the raw YAML header becomes
part of the system prompt.

After the fix, generated files start with `---`; the banner becomes YAML comments inside the
frontmatter; `opencode debug agents` reports `mode: subagent`, the intended `hidden` value, and the
declared permission rules for every role.

**Smallest viable design:** move the banner inside the frontmatter in both generators
(`build_agent_frontmatter()`, `generate_custom_agent()` in `scripts/install_agents.py`); make
ownership detection recognize the new layout **and** the legacy banner-first layout so existing
installs are upgraded instead of being skipped as hand-authored; extend `run_check()` to
content-compare catalog roles (user-approved scope addition); regenerate the packaged
`agents/*.md` files and the golden fixture from the templates. No new dependency, no new layer,
no installer-JS change, no V2-native frontmatter migration.

Out of scope: modernizing generated fields to V2-native shapes (`permissions` ruleset, `options`);
`bin/install-agents.mjs` (it copies files unchanged and tracks ownership by marker file); any
OpenCode-side change; README edits beyond the release notes.

**Compatibility:** boundary 2.0.3 → 2.0.4. Upgrade: package installs self-heal through the
marker-file replacement (`opencode-codeops update`); project-generated files upgrade on the next
`--roles`/`--custom` run, with `--check` reporting `STALE` until then. Rollback: reinstall the
previous package — files regenerate to the legacy layout and the visibility bug returns, but no
data or file corruption occurs. Mixed version: new files plus old tooling are treated as
hand-authored by the old first-line check and skipped safely; the package installer replaces files
by marker file regardless of layout.

## Tasks

- [x] T-06.1 Write the failing regression tests (red) in `scripts/install_agents.spec.test.mjs`: every generated catalog and specialist file starts with `---` (line 1); the ownership marker, `mode: subagent`, and the intended `hidden` value sit inside the leading frontmatter block; a legacy banner-first file is still recognized as CodeOps-owned (re-generation replaces it instead of skipping it as hand-authored); `--check` reports `STALE` for a catalog role whose file does not match the generator output ✅ (completed: 2026-10-09 14:34)
- [x] T-06.2 Implement frontmatter-first emission and compatibility detection: banner as YAML comments inside the frontmatter in `build_agent_frontmatter()` and `generate_custom_agent()`; dual-layout `is_codeops_generated()`; verify or extend the `generated_custom_template()` header scan; catalog content comparison in `run_check()` — T-06.1 tests green (the pre-existing layout tests — `assertMarkerFirst()`, `frontmatterBlock()`, `agentBody()` — are expected red until T-06.3; only T-06.5 requires a fully green suite) ✅ (completed: 2026-10-09 14:36)
- [x] T-06.3 Update existing helpers, fixtures, and goldens: `frontmatterBlock()`, `assertMarkerFirst()`, and `markerAgent()` in `scripts/install_agents.spec.test.mjs`; `agentBody()` in `scripts/hygiene-content.spec.test.mjs`; keep the foreign-role fixture as-is (it is a legacy-layout `--remove-custom` refusal case and doubles as legacy coverage); regenerate `scripts/fixtures/catalog-executor.golden.md` through the same generation path as T-06.4 ✅ (completed: 2026-10-09 14:37)
- [x] T-06.4 Regenerate the twelve packaged `agents/*.md` files: run the fixed generator for all roles into a scratch project, copy the outputs into `agents/`, and confirm each file starts with `---` ✅ (completed: 2026-10-09 14:37)
- [x] T-06.5 Full verification: `npm run verify`, plus a legacy-upgrade check (`--check` reports `STALE` on a legacy install and re-generation replaces the files) ✅ (completed: 2026-10-09 14:38)
- [x] T-06.6 Live spot-check with OpenCode 2.0.24: install the regenerated agents into a scratch project; `opencode debug agents` reports `mode: subagent`, the intended `hidden` value, and the permission rules; the agent cycle no longer lists the roles ✅ (completed: 2026-10-09 14:38)
- [ ] T-06.7 Release patch v2.0.4: commit through the git-commit skill; run the repo release flow (`node scripts/release.mjs release --type auto --tag latest`); the release notes/CHANGELOG must state the upgrade steps for existing installs (package `update`/`install`; project files need a `--roles`/`--custom` re-run; `--check` reports `STALE` until then) and must not claim `temperature`/`reasoningEffort` behavior changes (model pins now apply; request settings remain preserved but unsent in OpenCode V2); confirm the CHANGELOG entry and the published version
- [ ] T-06.8 Released-artifact verification and issue close-out: install the released package into a scratch scope, re-run the `opencode debug agents` check, then update and close issue #2 through the github-issues skill (mutation explicitly authorized) with the fix reference

**Verify**: `npm run verify`

## Quality Review

Post-task review on the whole-task diff (baseline tree `cf268832`), 2026-10-09. The specialist
reviewer agents were not installable at review time (the condition this task fixes); one independent
correctness reviewer and one security/migration auditor ran on generic packets and both returned
**PASS WITH NOTES**.

| ID | Severity | Finding | Resolution |
|----|----------|---------|------------|
| RV-001 / SA-002 | MINOR | `--check` catalog comparison could abort on a missing or unreadable template | Guarded: reports `INVALID: <role>` instead of a traceback |
| RV-002 / SA-001 | MINOR | Regeneration replaced the curated agent descriptions with generic fallbacks | Curated descriptions restored in `agent-templates/*.md` (parsed from the provenance comment) and catalog descriptions emitted as quoted YAML scalars; packaged agents and golden regenerated |
| SA-003 | OBSERVATION | Catalog `--check` lacked the custom branch's symlink guard | Symlinked catalog files now report `HAND-AUTHORED (skip)` |
| RV-004 | OBSERVATION | `is_codeops_generated()` docstring imprecise about the scan window | Wording corrected (within the first eight lines) |
| RV-003 | OBSERVATION | Matcher change scrutinized for spec-test weakening | Confirmed legitimate (exact skip-marker match); no action |
