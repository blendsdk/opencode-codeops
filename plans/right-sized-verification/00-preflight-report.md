## Preflight Report: Right-Sized Verification (Wave 1)

> **Status**: ✅ PREFLIGHT PASSED — all 38 findings resolved (2 iterations)
> **Audit target**: `plans/right-sized-verification/` (all plan documents)
> **Context documents**: AGENTS.md, `_shared/`, `skills/make-plan/`, `skills/exec-plan/`, `skills/upgrade-plan/`, `agent-templates/`, `agents/`, `schemas/`, `bin/lib/codeops-progress.*`, `plugin/index.ts`, `codeops/test-map/`, existing spec tests, `scripts/install_agents.py`, `scripts/release.mjs`
> **Content hash (final, after iteration 2 fixes)**: `c2ca8b2130ea270e` (sha256 of the concatenated plan documents, first 16 hex)
> **Independence**: five clustered fresh-context auditor dispatches (general agents, dynamic packets), same model family as the author — `uniform-effort`
> **Effort**: requested high (cluster ④ xhigh) → inherited; mapping unavailable
> **Date**: 2026-11-24 23:56
> ⚠️ **SAME-SESSION REVIEW** — the plan was authored in this session; auditors ran in fresh contexts. Consider a new-session review for additional independence.

### Codebase Context Summary

The auditors checked every line reference in 02 against the code (all matched), the test map and
selection semantics, the installer's output and check directories, the release tool's version
and group logic, plan-file parsers, the compaction event type, and all spec tests pinning the
texts the plan edits.

### Summary by Severity

| Severity | Iteration 1 | Resolved |
|---|---|---|
| 🔴 CRITICAL | 1 | 1 |
| 🟠 MAJOR | 11 (+PF-001 reopened in iteration 2) | 11 |
| 🟡 MINOR | 19 + 4 (iteration 2) | 23 |
| 🔵 OBSERVATION | 2 + 1 (iteration 2) | 3 |

### Findings and decisions

Cluster IDs in brackets (①..⑤). Decisions: PF-006, PF-012, PF-014 ruled individually by the user
(recorded as AR-28, AR-29, AR-30); all others "User accepted recommendation" (bulk acceptance,
2026-11-24).

| PF | Sev | Dimension | Finding (short) | Resolution applied |
|---|---|---|---|---|
| PF-001 | 🔴 | Ordering | Single up-front oracle keeps Phases 2–5 green checks and gates red; new content spec not run by the task gate [③④②⑤] | Flat `ST-<n>` test names; per-phase `--test-name-pattern` green checks; gates declare the expected-red remainder; content spec added to `content.guidance`; slice table corrected (07, 99) |
| PF-002 | 🟠 | Completeness | "Distinct red-phase task" still required in `spec-first-ordering.md:54-57`, `:64-79`, `templates.md:551-558`, `make-plan/SKILL.md:169` [③②] | Tier-aware edits named in 03-01 and tasks 2.1.1–2.1.3; ST-2/ST-4 extended |
| PF-003 | 🟠 | Completeness | exec-plan `SKILL.md:236-238`, `:249-254`, `commit-modes.md`, protocol `:312` restate old review/pause rules [③] | Added to 03-01/03-02 and tasks 2.1.6, 3.1.5; ST-8, ST-14 |
| PF-004 | 🟠 | Codebase Alignment | Standard trigger conflicts with strict-default activation rows `quality-profile.md:78,80,81` [②] | "Tier changes when, not whether"; completion review satisfies strict defaults (03-01); ST-7 |
| PF-005 | 🟠 | Edge Cases | Carried-forward review state not durable; final review not guaranteed [④] | `> **Review**:` line per phase; completion review before done/push/release; baseline fallback (03-01); ST-8 |
| PF-006 | 🟠 | Security | Refuter can overturn SA/PE/SR findings at every tier [④] | User kept AR-19/20 (AR-28): refuted findings listed, ledgered, reinstatable; exec-plan "dismissed automatically" reworded to "dismissed silently" (03-02); ST-13 |
| PF-007 | 🟠 | Contradictions | "critical = exactly today" is false [①] | Wording narrowed everywhere: critical keeps today's ceremony and review frequency; calibration/refuter apply to all tiers (00, 01, 03-01) |
| PF-008 | 🟠 | Contradictions | `Downgraded` vs "only Confirmed stops" [①] | Downgrade to 🟠 still stops; to 🟡 report-only (03-02, R7); ST-13 |
| PF-009 | 🟠 | Contradictions | "Not findings" wider than AR-18; silences security checklists; undefined "blast radius" [①] | Reworded to hypothetical scenarios not covered by requirements or an active checklist; scope defined as changed lines plus direct callers/callees (03-02); ST-10 |
| PF-010 | 🟠 | Codebase Alignment | Four reviewer templates never reference quality-profile [②] | Calibration delivered via every packet row and applied at merge; no template edits (03-02); ST-10, ST-13 |
| PF-011 | 🟠 | Edge Cases | 10-minute stale check drops the compaction note when needed; done runs still noted [④②] | Stale check removed; `done` → null (03-05); ST-19 |
| PF-012 | 🟠 | Feasibility | Replay subject (and most plans) derive `critical` under AR-13 [④②①⑤③] | User narrowed critical signals (AR-29); replay records the derived tier and runs `standard` and `critical` with answers from the original register; AC-3 limited to what replays prove (00, 01, 99 7.1.3) |
| PF-013 | 🟡 | Redundancy | ST-10 duplicates the hygiene sync test and is already green; ST-3 link clause duplicated [①⑤③②] | ST-12 now asserts `Mode: refute` in the packaged agent; ST-3 keeps only the order statement (expected green) |
| PF-014 | 🟡 | Consistency | "changed" vs "added" lines; Markdown excluded though it is product here [①④②] | User ruled AR-30: Markdown counts; artifacts/lockfiles/generated excluded; trigger added+deleted, balance added (03-03) |
| PF-015 | 🟡 | Ambiguities | Tier precedence, config conflict, derivation timing [①④②] | Proposal → override → record; conflict disclosed in reason; provisional at 1.3, final after Phase 2 lens re-run; exec-plan reads only 00-index (03-01) |
| PF-016 | 🟡 | Consistency | `refuted` not in ledger vocabulary [①] | Vocabulary gains `refuted` and `downgraded` (03-02) |
| PF-017 | 🟡 | Consistency | This plan's tier label misstated its shape [①] | Label reworded (00-index) |
| PF-018 | 🟡 | Contradictions | No "Changed" group; MINOR needs a `feat` commit [①] | Commit-type guidance in 99; 02 notes the Features mapping |
| PF-019 | 🟡 | Security / Consistency | Note values unsanitized; plan name vs path [④①] | Values sanitized and quoted; location hint `plans/ or codeops/features/*/plans/` (03-05); ST-21 |
| PF-020 | 🟡 | Testability | ST-18 assertions too weak [⑤] | ST-20 asserts labelled fields |
| PF-021 | 🟡 | Testability | Impl-test "helper throws" needs a test seam [⑤②] | Throw case dropped; impl test asserts hook ordering through the existing harness (07) |
| PF-022 | 🟡 | Testability | YAML folding method unspecified; invalid plain scalars [⑤] | Folding rule in 07 §Conventions; ST-23 |
| PF-023 | 🟡 | Testability | Prose ST-cases lack an assertion convention [⑤] | Content-assertion convention in 07 |
| PF-024 | 🟡 | Test Impact | organize-tests pinned test needs single-line description [⑤②] | 03-04 Rule 5 |
| PF-025 | 🟡 | Test Impact | 07 slice table named wrong groups [⑤②] | Corrected (merged into PF-001 fix) |
| PF-026 | 🟡 | Completeness | R4 exec half and 03 error rows untested/uncited [③] | ST-8, ST-13, ST-15 cover them; tasks cite §Error Handling |
| PF-027 | 🟡 | Dependencies | Phases wrongly declared independent [③] | Sequential graph; compaction before descriptions (99) |
| PF-028 | 🟡 | Dependency Reality | Installer does not write `agents/` [③②] | Generate → copy → check spelled out (03-02, 3.1.3) |
| PF-029 | 🟡 | Architecture | `mode=refute` would break the pinned dispatch header [②] | `Mode: refute` in the packet body; refute packet row; insufficiency rule per mode (03-02) |
| PF-030 | 🟡 | Migration | Mixed-version window: older installs reject the property; old agents lack refute [④] | Commit body names the version; no-rows reply reported as out of date (03-02, 99) |
| PF-031 | 🟡 | Migration | upgrade-plan could add a derived standard tier to old plans [④] | Never derive for existing plans; `critical — pre-tier plan` (03-01); ST-9 |
| PF-032 | 🔵 | Consistency | Description example listed modes the rule forbids [①] | Rule 4 allows user-typed invocation arguments |
| PF-033 | 🔵 | Stale Assumptions | Baseline figures not reproducible [②] | Recomputed with commands recorded in 00-index §Assessment |

Refuted candidates (not findings) are listed in each cluster's result: parser breakage, untracked
files in counts, note length, ownership checks, roadmap rows, map orphaning, and plan verification
load (≈30% of tasks).

### Iteration 2

One fresh-context verifier re-checked PF-001..PF-033 against the plan and the code and re-scanned
all 13 dimensions. PF-002..PF-033 confirmed present and correct (line refs, note length, baseline
figures, test-name patterns, regeneration path, hook scope reproduced).

| PF | Sev | Finding (short) | Resolution applied |
|---|---|---|---|
| PF-001 (reopened) | 🟠 | Task verify lines in Phases 2–6 still ran later-phase red cases; green checks lacked the file; plugin spec red at file level | Every Task verify names the cumulative scoped green check with the file and the allowed expected-red remainder; plugin spec red at file level until Phase 5 (99) |
| PF-034 | 🟡 | "Fully green from Phase 5" stale after reorder | Phase 6 (07, 99) |
| PF-035 | 🟡 | "Completion review before push" fires on per-task pushes | Tied to plan completion (done, final push, release) (03-01, R4) |
| PF-036 | 🟡 | Calibration on every packet row reaches preflight-auditor | Named rows only; preflight-auditor excluded (03-02, 3.1.1) |
| PF-037 | 🟡 | Cited harness cannot register the progress tool | Impl test uses the `tool.transform` capture and the progress tool's `execute` (07) |
| PF-038 | 🔵 | commit-modes line refs and a PF citation | Aligned (02, 03-03) |

Decisions: PF-001 completes the accepted iteration-1 resolution; PF-034..PF-038 "User accepted
recommendation" (2026-11-25).
