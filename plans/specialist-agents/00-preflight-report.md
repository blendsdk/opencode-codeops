# Preflight Report: Specialist Agents Plan

> **Status**: ✅ PREFLIGHT PASSED — all findings resolved (32 initial + 12 re-scan corrections)
> **Iteration**: 2 (re-scan after fixes; converged)
> **Artifact**: implementation plan at `plans/specialist-agents/` (9 documents, uncommitted)
> **Codebase Grounded**: 20+ source files examined; all `file:line` references in `02-current-state.md` verified
> **Last Updated**: 2026-10-04 00:27

> **⚠️ SAME-SESSION REVIEW**: This plan was authored in the current session. Same-agent bias risk
> is elevated. Five independent auditor clusters and one independent challenger were used to
> counter it; still consider a human domain review for the migration-scope decision (PF-013).

## Codebase Context Summary

**Tech Stack:** Node 18+ (ESM, `node --test`), TypeScript plugin entry (`plugin/index.ts`),
Python 3.8+ generators (`scripts/*.py`), Markdown skills shared with OpenCode.
**Architecture:** The plugin injects standards per session; skills are Markdown instructions;
`scripts/install_agents.py` renders `.opencode/agents/*.md` from `agent-templates/`;
`bin/index.mjs` orchestrates package installers with marker-owned atomic replacement;
`scripts/codeops_plan.py` derives plan state from Markdown; `scripts/codeops-migrate.sh` moves
flat artifacts to the nested layout.
**Key files examined:** `scripts/install_agents.py`, `bin/install-agents.mjs`,
`bin/lib/opencode-install.mjs`, `schemas/codeops-config.schema.json`, `_shared/quality-profile.md`,
`_shared/layout-convention.md`, `_shared/zero-ambiguity-gate.md`, `skills/setup-routing/SKILL.md`,
`skills/make-plan/*`, `skills/exec-plan/*`, `skills/analyze-project/SKILL.md`,
`scripts/codeops_plan.py`, `scripts/codeops-migrate.sh`, `package.json`, `README.md`.

**Reference verification:** all plan references to `install_agents.py` anchors (24/39/58/65/204/215/269),
`bin/lib/opencode-install.mjs:76-82`, `codeops-migrate.sh:75,94,102-106,297`, and
`quality-profile.md:68,108,121` resolved. External OpenCode claims (startup discovery, `hidden`
semantics, `reasoningEffort`) are verified against current upstream docs/source, not against the
installed binary (PF-031 notes the residual).

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 4 | 🟠 |
| 2 | Implicit Assumptions | 2 | 🟠 |
| 3 | Logical Contradictions | 4 | 🟠 |
| 4 | Completeness Gaps | 6 | 🟠 |
| 5 | Dependency Issues | 1 | 🟠 |
| 6 | Feasibility Concerns | 4 | 🟠 |
| 7 | Testability | 7 | 🔴 |
| 8 | Security Blind Spots | 5 | 🟠 |
| 9 | Edge Cases | 4 | 🟠 |
| 10 | Scope Creep Indicators | 1 | 🟡 |
| 11 | Ordering & Sequencing | 2 | 🔴 |
| 12 | Consistency | 5 | 🟡 |
| 13 | Codebase Alignment | 5 | 🟠 |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 1 | All resolved |
| 🟠 MAJOR | 20 | All resolved |
| 🟡 MINOR | 10 | All resolved |
| 🔵 OBSERVATION | 1 | All resolved |

**Independent challenger:** one dispatch received the whole critical/major batch and the codebase
context. Verdict: **converged** on every finding's recommended direction; it raised no
`Not a real defect` verdicts and added six missing findings (three promoted to MAJOR below:
PF-019, PF-020, PF-021). Confidence disclosure: all recommendations High except PF-004 (Med-High)
and PF-013 (Med).

## Decisions (2026-10-04)

- **All 32 findings:** user accepted every recommended resolution and instructed the fixes to be
  applied. Individual CRITICAL/MAJOR entries record the batch decision; the MINOR/OBSERVATION
  tables inherit it.
- **PF-013:** user approved the scope expansion — `scripts/codeops-migrate.sh` will preserve/refuse
  an existing `codeops/codeops.json`.
- **PF-026:** user approved dropping atomic writes in favor of the existing plain-write pattern.
- **PF-012:** user approved recording the ≤2-candidate budget as AR #24.
- Iteration 2 (focused re-scan of the changed plan documents) runs after the fixes and its result
  is appended below.

---

## CRITICAL

### PF-001: Phase 1's green gate is unreachable [🔴 CRITICAL]

**Dimension:** Ordering & Sequencing / Testability
**Location:** `99-execution-plan.md` Phase 1 (1.2.3) vs Phase 4; `07-testing-strategy.md` ST-30
**The Problem:** ST-30 asserts `_shared/specialist-agents.md` is linked from five skill/shared
files that are edited only in Phase 4. Phase 1 writes only the document and the layout path, so
task 1.2.3 ("verify green") cannot pass, and every `npm run verify` in Phases 2–3 inherits the
failure. The immutable-oracle rule forbids weakening ST-30; the plan cannot execute as written.
**Recommended resolution:** Split ST-30: Phase 1 asserts existence, schema stamp, and required
sections; move the cross-skill link assertions into ST-32 (Phase 4). Update the Test Categories
mapping.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

---

## MAJOR

### PF-002: ST-5's 41-character slug is valid under the approved regex [🟠 MAJOR]

**Dimension:** Testability / Logical Contradictions
**Location:** `07-testing-strategy.md` ST-5; AR #15; `03-02` frontmatter rules
**The Problem:** `^[a-z][a-z0-9-]{1,40}$` admits 2–41 characters; ST-5 (immutable oracle)
requires a 41-character slug to be rejected. Implementing the rule fails ST-5; passing ST-5
violates AR #15.
**Recommended resolution:** Keep the user-approved regex; change ST-5 to reject a 42-character
slug and add an accept case at 41 characters so the boundary is pinned.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-003: `--check` spec fixtures cannot pass [🟠 MAJOR]

**Dimension:** Testability
**Location:** ST-17 … ST-21; `99-execution-plan.md` integration test
**The Problem:** `--check` with no `--roles` iterates all twelve catalog roles
(`scripts/install_agents.py:212-252`) and exits 1 when they are absent. The fixtures contain only
custom content, so ST-20's exit-0 assertion is impossible, and ST-17…ST-19 pass for the wrong
reason. The plan also specifies `MISSING: <role>` output while the code prints paths.
**Recommended resolution:** Pre-generate all twelve catalog agents in check fixtures; keep current
default-role behavior; assert the spec'd custom output tokens explicitly.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-004: AGENTS.md file-state behavior is undefined [🟠 MAJOR]

**Dimension:** Completeness Gaps / Edge Cases
**Location:** `03-02` managed block + error table; ST-21/ST-25
**The Problem:** No rule or test for: AGENTS.md absent entirely (setup-routing can run before
analyze-project), empty file, missing trailing newline, CRLF, duplicate START/END pairs, or
END-before-START. The executor must guess, which the Zero-Ambiguity Gate forbids.
**Recommended resolution:** Create AGENTS.md containing only the managed block when absent; define
normalization for empty/no-newline/CRLF; reject duplicate/reversed markers untouched; add ST
cases for each.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-005: `--remove-custom` can delete catalog-generated agents [🟠 MAJOR]

**Dimension:** Security Blind Spots
**Location:** `03-02` removal/error table
**The Problem:** The guard "CodeOps marker + matching role comment" is satisfied by catalog files
(`scripts/install_agents.py:116`), so `--remove-custom executor --yes` deletes the packaged
executor agent. Validation exists only on the create path; ST-24 tests only marker-less files.
**Recommended resolution:** Apply create-path validation (slug, reserved, catalog) on removal,
require the `Template:` comment to be `domain-specialist-*`, keep brief-absent report-and-continue
for orphan cleanup, and add a refusal ST.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-006: Symlink guards are missing for generated files [🟠 MAJOR]

**Dimension:** Security Blind Spots
**Location:** `03-02` generated agent/security; `01-requirements.md` security
**The Problem:** Only the brief path is canonicalized. A symlinked `.opencode/agents/` or
AGENTS.md can redirect writes into the global config or be destroyed by `os.replace`;
`bin/install-agents.mjs:388-394` already refuses this exact class. The symlink-escape requirement
has no test.
**Recommended resolution:** Reuse the Node installer's lstat/refuse pattern for
`.opencode/agents/`, the target file, and AGENTS.md; always unlink the link itself on removal; add
a symlink-escape ST case (file and directory variants).
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-007: Marker sanitization is bypassable [🟠 MAJOR]

**Dimension:** Security Blind Spots
**Location:** `03-02` sanitization; ST-14
**The Problem:** Deleting `<!--`/`-->` once is not iterated to a fixed point:
`<!<!---- CODEOPS-SPECIALISTS:START ---->>` (under the cap) sanitizes into the exact managed
marker, allowing marker injection into AGENTS.md.
**Recommended resolution:** Sanitize in a bounded loop until stable, reject if a marker sequence
remains, and add an ST case with the stitched payload.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-008: Unquoted YAML frontmatter values can silently break agents [🟠 MAJOR]

**Dimension:** Security Blind Spots / Edge Cases
**Location:** `03-02` generated agent
**The Problem:** Values are emitted unquoted. Descriptions starting with YAML indicators (`[`,
`{`, `*`, `&`, `!`, `%`, `@`, `-`) can make OpenCode fail to parse or misparse the agent, while
`--check` compares bytes and reports OK.
**Recommended resolution:** Emit all frontmatter string values double-quoted with escaping
(JSON-style); add ST cases for leading indicators; consider a parse check in `--check`.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-009: Reserved-name list omits three built-ins [🟠 MAJOR]

**Dimension:** Security Blind Spots / Codebase Alignment
**Location:** AR #15; `03-02` frontmatter rules
**The Problem:** Only `plan`, `build`, `general`, `explore`, `scout` are reserved. OpenCode also
documents hidden system agents `compaction`, `title`, `summary`; a specialist with one of those
names can shadow a system agent.
**Recommended resolution:** Reserve all eight documented built-ins; add a test with one omitted
name; note that the list must track OpenCode.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-010: A sandbox override can make a reviewer writable [🟠 MAJOR]

**Dimension:** Security Blind Spots
**Location:** `03-02` generated agent (permission mapping)
**The Problem:** `routing.roles.<reviewer>.sandbox: workspace-write` applies
`edit: allow` after the reviewer template default, contradicting the read-only reviewer contract
(`scripts/install_agents.py:64-69,163-167`).
**Recommended resolution:** Clamp per kind: reviewers always keep `edit: deny`; add an ST case
with `kind: reviewer` + `sandbox: workspace-write`.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-011: Executor write-default contradiction [🟠 MAJOR]

**Dimension:** Logical Contradictions
**Location:** `01-requirements.md` R9 vs `03-02` + ST-2
**The Problem:** R9 says executor write access "requires the explicit sandbox override"; 03-02 and
the immutable ST-2 expect `edit: allow` by default. Spec tests derived from R9 would fail.
**Recommended resolution:** Fix R9 wording to match AR #9's distinct template defaults; keep ST-2.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-012: Detection and budget have no verification and no authority record [🟠 MAJOR]

**Dimension:** Completeness Gaps / Testability
**Location:** R1/R2; `03-01` authority and budget; ST-30/31; Phase 4.3
**The Problem:** The three detection points, always-recorded outcome, ≤2-candidate budget,
`--auto-design` ban, and rejection non-reappearance have no ST, no content assertion, and no
manual scenario. The ≤2 budget also cites AR #4/#21, which do not record it.
**Recommended resolution:** Extend ST-30/ST-31 content assertions; add a manual negative-detection
scenario; record the ≤2 budget as a new AR entry approved by the user.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-013: Flat-layout migration can overwrite `codeops/codeops.json` [🟠 MAJOR]

**Dimension:** Implicit Assumptions / Codebase Alignment
**Location:** `01-requirements.md` compatibility; ST-33; `03-03` creation flow
**The Problem:** setup-routing writes routing policy into `codeops/codeops.json` in flat layout;
a later `setup-codeops` migration runs `cat > codeops/codeops.json`
(`scripts/codeops-migrate.sh:297`) with no existence guard, silently overwriting committed policy.
ST-33 only dry-runs and its fixture omits this file.
**Recommended resolution:** (a) Minimal engine fix — make the migrator refuse or preserve an
existing `codeops/codeops.json`, surface it in the preview, and extend ST-33 with an apply-mode
fixture. This expands the modification set to `scripts/codeops-migrate.sh` and needs explicit
user approval. (b) No engine change — add a preview warning, a recorded risk, and an apply-mode
test fixture that documents the overwrite.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-014: Dry-run is untested for sync and removal modes [🟠 MAJOR]

**Dimension:** Testability
**Location:** R11; ST-15
**The Problem:** Only `--custom --dry-run` has a case. `--dry-run --sync-agents-md`,
`--dry-run --remove-custom`, and `--dry-run` × `--yes` precedence are undefined and untested,
though these modes touch user-owned files.
**Recommended resolution:** Add ST cases and define "dry-run always wins over `--yes`".
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-015: Auto-sync-on-removal contradicts R8 [🟠 MAJOR]

**Dimension:** Logical Contradictions / Consistency
**Location:** R8 vs `03-02` removal; ST-23
**The Problem:** R8 says removal leaves the AGENTS.md index to setup-routing / `--sync-agents-md`;
03-02 says `--remove-custom --yes` also syncs. ST-23 does not say which invocation removes the
entry, so its oracle is ambiguous.
**Recommended resolution:** Keep auto-sync (matches AR #11); reword R8 and AR #11's phrasing;
ST-23 invokes only `--remove-custom --yes`.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-016: The setup-routing stance sentence is not in the task scope [🟠 MAJOR]

**Dimension:** Completeness Gaps / Codebase Alignment
**Location:** `skills/setup-routing/SKILL.md:62`; task 4.2.4; AR #8
**The Problem:** AR #8 deliberately changes the "AGENTS.md receives only a concise instruction"
stance, but no task names that line edit and no test asserts it. The shipped skill can contradict
its own managed block.
**Recommended resolution:** Amend task 4.2.4 to update the sentence explicitly and assert the new
stance in ST-32.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-017: The promised integration test has no owning task [🟠 MAJOR]

**Dimension:** Completeness Gaps
**Location:** `07-testing-strategy.md` integration row; AC #5; Phase 3.3
**The Problem:** The end-to-end lifecycle test (brief → `--custom` → sync → check → remove →
check) is promised and required by acceptance criterion #5, but no task creates it.
**Recommended resolution:** Add a task (e.g. 3.3.5) with a named test file.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-018: Manual verification is incomplete and self-certifiable [🟠 MAJOR]

**Dimension:** Testability / Feasibility
**Location:** Phase 4.3; ST-34/35; AR #19
**The Problem:** The modified skills are not installed in the running session, so ST-34/35 would
exercise the shipped v1.7.1 skills; restarts are human-only; with `--auto-commit` the executor
can self-record unverifiable results. The AR #19 model check is unscheduled.
**Recommended resolution:** Mark ST-34/35 and the model check as **user-executed acceptance
items** that block Phase 4/5 completion until results are recorded; add a prep task where the
executor stages the working-tree plugin/skills in a scratch scope; define the evidence format
(step log/transcript).
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-019: Creation flow generates before writing routing policy [🟠 MAJOR]

**Dimension:** Dependency Issues / Ordering & Sequencing (challenger-added)
**Location:** `03-03` creation steps 2 vs 4; ST-9
**The Problem:** Routing overrides win over the brief, but the flow runs `--custom` before writing
`routing.roles.<role>`; step 5's `--check` then immediately reports STALE.
**Recommended resolution:** Write routing policy before `--custom`, or regenerate after policy
changes; update the flow text and ST-9 context.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-020: Multi-role list semantics are undefined [🟠 MAJOR]

**Dimension:** Ambiguities (challenger-added)
**Location:** `03-02` CLI surface; AR #13
**The Problem:** `--custom <role>[,<role>]` and `--remove-custom <role>[,<role>]` have no
all-or-nothing rule; a valid-then-invalid list can leave partial writes/deletions. AR #13 approved
a singular `<role>`, and no ST covers a list.
**Recommended resolution:** Drop the comma-list; keep a singular `<role>` (repeat the flag for
multiple roles only if a use case appears).
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

### PF-021: Invalid briefs during `--check`/`--sync-agents-md` are undefined [🟠 MAJOR]

**Dimension:** Ambiguities / Edge Cases (challenger-added)
**Location:** `03-02` check state table and sync rules
**The Problem:** The state table covers agent/index states only. A malformed or reserved-name
brief in `codeops/specialists/` has no defined output or exit behavior.
**Recommended resolution:** Add an `INVALID: <role>` state with its reason, exit 1; sync refuses
to process invalid briefs; add an ST case.
**User Decision:** Resolved — User accepted the recommendation (batch decision, 2026-10-04)

---

## MINOR

| # | Finding | Location | Recommended resolution |
|---|---------|----------|------------------------|
| PF-022 | Removal partial state if the post-delete sync fails (index keeps a removed role) | `03-02` removal/error table | Render/validate the index before deleting, or define an explicit partial-state report |
| PF-023 | No catalog regression check (AC #6/R5) | Phase 2 tasks; `07` | Add a case regenerating a catalog role and comparing to `agents/`, plus a task |
| PF-024 | Python 3.8 claim false: PEP 585 generics without `from __future__ import annotations` | `scripts/install_agents.py:24,42,58,65`; README | Add the future import (one line, matches sibling scripts) |
| PF-025 | Role-name/path hardening: `$` anchor newline-permissive, DOS device names, trailing dot/space | `03-02` role rules | Use `re.fullmatch`; reject DOS names and trailing dot/space; add ST cases |
| PF-026 | Atomic writes are beyond the approved v1 surface (no AR) | R11; `03-02`; task 2.2.3 | Drop atomicity and reuse the existing `write_text` pattern; symlink lstat (PF-006) still applies. If kept, record explicit approval |
| PF-027 | Brief body is both "appended verbatim" and "sanitized" | `03-02` brief/security | Sanitize control characters while preserving Markdown; state the exact rule and test it |
| PF-028 | ST oracles not byte-precise: "16 KB", "a newline escape", "one adjacent blank line" | ST-13/14/27 | Pin 16384 bytes, the exact input characters, and before/after blank-line placement |
| PF-029 | Documentation consistency batch | multiple | Fix: 03-01 marker form (`START/END`); lifecycle order (sync→check); block line-budget wording (3 fixed lines, soft budget, project cap + pointer); `02` risk ST-27→ST-33; "participating skill" wording vs exec-plan; removal missing-agent rule; ST source anchors (`Req R4, R9`; ST-33 compatibility + AR #17); quality-profile stale line lists (15-16, 132; execution-protocol:180 `RV/SA/PE`); schema-edit assertion in the content test; brief `schema: 1` field; bash/sandbox mapping wording; replace the unmeasurable 90% target with a behavior matrix; label external claims |
| PF-030 | Spec tests are not hermetic against `CODEOPS_PLUGIN_ROOT` | `07` testing overview | Tests unset/override `CODEOPS_PLUGIN_ROOT` to the checkout root for every spawn |
| PF-031 | `reasoningEffort` range claim unverified at the pinned release; schema `reasoning` is an unconstrained string | `02`, `01`, AR #19 | Reword to "provider passthrough"; constrain schema `reasoning` to the documented enum; keep AR #19's accepted manual check and add it to ST-34 |

## OBSERVATION

| # | Finding | Recommended resolution |
|---|---------|------------------------|
| PF-032 | Housekeeping: AR #21 cites an undefined "option D"; `00-index.md` says "single-language TypeScript/Python" and claims the gap check ran before its protocol existed; lifecycle "Review after first use" has no AR owner; no upgrade guidance that template changes make custom agents STALE | Define/correct the option label; reword the index evidence; label the lifecycle row as optional guidance; add a one-line upgrade note to the README |

---

## Iteration 2 — re-scan after fixes

An independent auditor verified all accepted fixes and re-scanned the 13 dimensions for
fix-induced regressions. Twelve corrections were found and applied: PA2-001 (R11 atomic wording),
PA2-002 (Phase 3 ST range vs test-file mapping), PA2-003 (ST-32 stance assertion and attribution),
PA2-004 (removal unlink behavior), PA2-005 (AR-21 "option D" note), PA2-006 (AR-15/AR-19
refinements), PA2-007 (lifecycle review label), PA2-008 (cross-reference citations), PA2-009
(optional `schema` in R3), PA2-010 (explicit START/END markers), PA2-011 (ST-24 template-mismatch
case), PA2-012 (ST-33 single pinned behavior). All 32 initial findings were verified present; no
unfixed major remains.

## Verdict

✅ **PREFLIGHT PASSED** — every CRITICAL/MAJOR/MINOR/OBSERVATION finding is resolved; the plan is
ready for execution. The plan's execution intent remains `exec-plan specialist-agents
--auto-commit` (AR #23), with ST-34/ST-35/ST-43 as user-owned acceptance evidence (PF-018).

- **Challenger:** converged; its six additions are resolved.
- **Fix authority:** batch decision 2026-10-04 (user accepted all recommendations); PF-013
  (migrator scope), PF-026 (drop atomicity), and PF-012 (AR #24) recorded as explicit choices.
- **Roadmap:** the `REQ-SPECIALIST-AGENTS` row advances to `Plan Preflighted` (🔬).
