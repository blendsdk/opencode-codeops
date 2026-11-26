# Task T-08: Lean delivery — far fewer tokens, steps, and verification tasks per feature

> **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Progress**: 34/37 tasks (92%)
> **Last Updated**: 2026-11-26 13:25
> **Reasoning**: high — changes the core planning and execution protocols; every phase is measured
> **Plan form**: single document by user decision (this plan practises lever C before lever C exists)
> **Release**: MAJOR (3.0.0) — commits that change a skill contract carry a `BREAKING CHANGE:` footer (D-12)

## Objective

Make an ordinary (`standard`-tier) CodeOps feature dramatically cheaper and faster from plan to
merge, without weakening `critical`-tier rigor, and prove each step with measurements taken from
real sessions.

**Goal for a standard feature (arm M; baselines are re-measured in Phase 0 with the kit):**

| Metric (workflow it is measured on) | Evidence today (2026-11-25 analysis) | Target |
|---|---|---|
| Planning cached tokens (make-plan + preflight sessions → make-plan session) | make-plan ~79M + preflight ~219M per invocation | −60% |
| Planning fresh tokens (same) | make-plan 0.93M + preflight 2.62M per invocation | −50% |
| Execution cached tokens (exec-plan session tree) | ~90M per invocation | −60% |
| Median context per primary step (exec-plan) | 356k (p90 649k) | ≤ 150k |
| Bookkeeping steps in exec-plan (edits to CodeOps artifacts + `date` + progress-bar + `mark` calls) | 29% of edits are artifacts; `date` ~5% of shell calls | ≥ 70% of the Phase 0 bookkeeping share removed |
| Plan documents (M) | 9–15 files, 50–260 KB | 1 file, ≤ 20 KB |
| Verification share of tasks (M, leading-verb classifier) | 44–47% (0.1.6 arms); 57% original plan | ≤ 25% |
| Test : product lines per phase | 1.6:1 repo-wide | ≤ 1:1 |
| Review rounds per standard plan (dispatches reported separately) | one per phase + re-reviews + refute | 1 end round + ≤ 1 refute |

`critical` keeps today's rigor (full plan set, coverage hunt, preflight, per-phase review) and
still benefits from levers A, B, and F.

**Smallest viable design:** change the existing skills, shared protocols, plan templates, agent
templates, and `scripts/codeops_plan.py`; add one dev-only measurement script under
`scripts/bench/` that never ships. No new agent roles; one new plan shape (the standard
single-document plan).

**Excluded machinery:** a shipped metrics feature; a router (issue #4, Wave 2); auto-continuation;
blocking guards beyond the verification-balance brake.

## Evidence (baseline analysis, 2026-11-25)

Source: the local OpenCode database — content-free fields only (token counts, step counts, tool
names, file-path classes; tool inputs are read in memory and only counts and classes are kept) —
68 root sessions that used CodeOps workflows across 11 projects, $452 recorded spend — plus every
plan in this repository.

| Workflow | Invocations | Fresh tok / inv | Cached tok / inv | Primary steps / inv | Median ctx / step | p90 ctx / step |
|---|---|---|---|---|---|---|
| exec-plan | 203 | 1.23M | 90.2M | 166 | 356k | 649k |
| preflight | 88 | 2.62M | 219.0M | 165 | 393k | 674k |
| make-plan | 101 | 0.93M | 78.5M | 107 | 323k | 576k |

Calibration references for 0.1.5 (session-tree totals: fresh = input + output + reasoning +
cache.write; cached = cache.read; messages = assistant messages in the tree):

| Root session | Fresh | Cached | Messages | Subagent sessions |
|---|---|---|---|---|
| `ses_e98382d3dffetvhdV8n2Gzr2Dk` | 5,247,983 | 273,350,060 | 1,448 | 19 |
| `ses_e7b217b89ffeSevZraL9DXl9s6` | 3,369,919 | 264,958,592 | 1,266 | 12 |
| `ses_e332d5906ffemS7jQxD95BgExL` | 1,853,610 | 92,106,624 | 422 | 2 |

Findings that shape the levers:

1. **Context size dominates.** Cached re-reads outnumber fresh tokens 70–80×. CodeOps instructions
   are only 35–49k tokens per workflow and plan documents 12–65k; most of the ~350k per step is
   conversation accumulation in long single sessions.
2. **Bookkeeping steps.** 29% of exec-plan edits touch CodeOps artifacts; `date` alone is ~5% of
   shell calls; 40–55% of shell calls are `sed`/`grep`/`cat` inspection.
3. **Planning ceremony.** Plans run 9–15 documents / 50–260 KB with 11–69 spec cases, 9–64
   ambiguity rows, and 8–38 preflight findings. Preflight is the most expensive workflow; half its
   tokens are subagents and half its edits rewrite plan documents.
4. **Verification multiplies at the source** — every behavior becomes a spec case before tiers or
   reviews can trim anything.
5. **Environment.** Installed CodeOps is 2.8.1 (Wave 1 unreleased); subagent sessions cannot
   dispatch subagents (all 72 nested attempts failed; in this harness the tool is absent), so arms
   run as headless root sessions.

## Levers (in shipping order)

| Lever | Change | Primary metric |
|---|---|---|
| **B. Collapse bookkeeping** | One `codeops_plan.py mark` call updates a task's mark, timestamp, Progress, and Last Updated and prints the bar; the progress-tool report goes in the same step; no separate `date` or progress-bar steps; roadmap sync only at phase boundaries | bookkeeping step share |
| **C. One-document standard plan** | At `standard`, make-plan writes only `99-execution-plan.md`: header (tier, Implements, goal and smallest design), Decisions (D-n, the user's answers, including runtime ambiguities and complexity approvals with full evidence), Acceptance criteria (AC-n = the spec cases), Tasks. One batched question round; no coverage hunt, no separate register, no preflight. `critical` keeps the full set | plan docs/KB, planning tokens |
| **D. Tests equal acceptance criteria** | At `standard` the spec cases are the acceptance criteria (guide 3–8 per phase); implementation tests only where an AC names an error path or edge; the verification balance **blocks** above 1:1 (the parent computes it from the snapshot diff) | verification share, test:product |
| **A. Phase-scoped contexts** | exec-plan (both tiers) dispatches each phase at or above a size threshold (set in 3.1.3 from measured phase sizes) to a fresh executor with a compact packet and a structured report; the primary keeps the plan and per-phase summaries; `critical` phases run on the session model | median ctx/step, cached tokens |
| **E. One review** | At `standard`, one end-of-plan review round plus the refute pass; per-phase review only for risk-tagged phases; `critical` unchanged | review rounds |
| **F. Instruction diet** | Split the heavy skills into a lean core (standard path) and `critical`-only references; option blocks load only when their flag is present | instruction tokens per workflow |

## Decisions

| # | Decision | Status |
|---|---|---|
| D-1 | Measurement kit lives dev-only in `scripts/bench/`, committed, excluded from the npm package | User, 2026-11-25 |
| D-2 | This plan is a single document; reviewed by an independent auditor instead of preflight | User, 2026-11-25 |
| D-3 | Order: measure → B → C+D → A+E → F → real-world check | User, 2026-11-25 |
| D-4 | The verification balance blocks at `standard` above 1:1 (raises the existing complexity STOP packet); `critical` stays report-only. Supersedes Wave 1's report-only rule for `standard` | User, 2026-11-25 |
| D-5 | `standard` plans skip the coverage hunt, the separate ambiguity register, and preflight; the plan's Decisions table owns every decision; the Zero-Ambiguity rule still applies to every material decision | User, 2026-11-25 |
| D-6 | Lever A applies to both tiers | User, 2026-11-25 |
| D-7 | At `standard`, one end-of-plan review round (+ refute); per-phase review only when risk-tagged; the 150-line trigger is removed | User, 2026-11-25 |
| D-8 | Any phase (1–4) may supersede existing spec assertions whose guarded behavior or text it changes; each phase's first task lists them, the user approves them in one batch, and the phase's new spec file guards the replacement | User, 2026-11-25 (extended to Phases 1–3) |
| D-9 | A/B arms run as headless root sessions (`opencode run --title bench-<arm> --archived --auto`) started inside throwaway git worktrees, on the user's default model (recorded per arm), following the CodeOps skill text at a named ref, answering questions from the subject's recorded inputs | User, 2026-11-25; revised 2026-11-25 (subagent sessions have no subagent tool) |
| D-10 | ~~Nested dispatch via `experimental.subagent_depth: 2`~~ — superseded: the smoke showed child sessions have no subagent tool at all, so arms run as root sessions (D-9) and no config change is needed | User, 2026-11-25 |
| D-11 | Arm runtime: arms read SKILL and `_shared` files by path from a checkout of the ref under test and run `${CODEOPS_PLUGIN_ROOT}` commands against that checkout; reviewer/executor roles run as generic subagents with the ref's template text in the packet; plugin hooks stay at the installed version as a controlled constant | User, 2026-11-25 |
| D-12 | Release as MAJOR (3.0.0); contract-changing commits carry a `BREAKING CHANGE:` footer | User, 2026-11-25 |
| D-13 | Arm isolation is enforced by the OS: bubblewrap sandbox, private standalone OpenCode with no session history, CodeOps plugin off for every arm with the ref's standards loaded through `instructions` (revises D-11's "plugin hooks stay at the installed version"), network limited to the model API plus an npm mirror that refuses CodeOps, automatic per-arm audit; the harness is committed under `scripts/bench/harness/` | User, 2026-11-25 |
| D-14 | Phase 0 review fixes: subject M is slice 1 only (TUI/RPC foundation, FR-6–FR-9 and FR-11; acceptance = the tui-foundation spec) because slice 0 changes CodeOps's own plan parser, which every ref ships and arms can read or probe; the bench spec's review, bookkeeping, and edit-class assertions are superseded by stricter ones (template-based dispatch classes, refute rounds, scripted artifact writes, progress-tool calls, out-of-repo edits, tree-wide context, a classifier table); all five baselines are rerun | User, 2026-11-26 |

## Measurement method

**Kit** (`scripts/bench/bench.py`, read-only, dev-only; reads tool inputs in memory and outputs
only counts and classes):

- `sessions --root <id> | --ids <id,…>` → per session and per tree (walked recursively): fresh,
  cached, cost, assistant messages, primary steps (the named session only), subagent sessions and
  tokens, median/p90 context per primary step (input + cache.read + cache.write per assistant
  message), edit share by path class (CodeOps artifacts / tests / product), bookkeeping steps
  (artifact edits + `date` + progress-bar + `mark` calls), review rounds and reviewer dispatches,
  model and variant.
- `plans <dir…>` → documents, KB, numbered tasks, verification tasks by leading verb phrase (write
  or run tests, verify, review, audit), spec cases or ACs, decisions.
- `instructions --ref <dir>` → static footprint per workflow (SKILL.md plus linked documents, two
  levels), split into always-read and flag/tier-conditional.

**Arm protocol** (`scripts/bench/README.md`):

1. **Ref binding (D-11).** Check out the CodeOps ref under test in its own worktree (pinned SHA).
   The arm reads skills by path there, never through the skill tool, and substitutes
   `${CODEOPS_PLUGIN_ROOT}` with that path. Reviewer and executor roles are generic subagents
   whose packet carries the ref's agent template text.
2. **Subject worktree.** A separate throwaway worktree at the subject's base commit; `npm ci` before
   the arm starts (not measured). Every shell call runs there; `--no-commit`; pushing forbidden;
   after the arm, `git status` of the main checkout must be unchanged.
3. **Sessions.** Each workflow is its own sibling arm session on the same worktree: make-plan;
   preflight (baseline refs only); exec-plan. Gates name the workflow they measure.
4. **Inputs (identical across arms).**
   - **M** = `live-task-sidebar` slice 1 (D-14): `01-requirements.md` and
     `00-ambiguity-register.md` read from `d168332` (the register is a question→answer lookup),
     plus an interface sheet; base = `d168332^`; scope = FR-6–FR-9 and FR-11 (no slice 0, no live
     smoke); acceptance = `plugin/tui-foundation.spec.test.mjs` at `6ac519d`. Post-Wave-1 arms pin
     `quality.verificationTier: standard` in the worktree's `codeops/codeops.json`.
   - **S** = `reasoning-effort-trace` T-03.1–T-03.3: the plan objective plus the interface excerpt
     (`isEffortTraceEnabled`, `appendEffortTrace`, `sessionEffortTracePath`); base = `80f4e18^`;
     acceptance = the spec tests at `80f4e18`. S measures lever B and is a no-regression control
     only (mini-plans have no tier).
   - **H** = `test-impact-selection`: planning-only replays, reported, not gated.
   - Questions the inputs do not answer: take the skill's recommended option and log it as an
     assumption; assumptions are counted in §Results.
5. **Repeats and noise.** Baseline M twice and S three times; decision band = max(10%, observed
   spread); a pass inside the band gets one confirming re-run; report medians.
6. **Quality guard.** The subject's acceptance tests pass; confirmed review findings per arm are
   recorded; `npm run verify` is green at every phase end.

## Test and review budget (this plan)

- Spec cases: at most 9 per phase across at most 2 new spec files, written before that phase's
  implementation (no up-front oracle for later phases, because measurements may reshape them).
- Implementation tests only for named error paths. Test:product lines ≤ 1:1 per phase.
- One review round per phase at its end, plus the refute pass; `agent-pipeline-reviewer` joins
  Phases 2, 3, and 4 (agent templates, packaged agents).

## Tasks

### Phase 0 — Measurement kit and baseline

> **Review**: reviewed 2026-11-26 07:02 (review + one re-review; findings closed)
> **Phase baseline tree**: c0665623f6db04ef8ecff6a877a9ba19b7983247

- [x] 0.1.1 Write `scripts/bench/bench.spec.test.mjs` (≤ 6 cases) against a tiny synthetic SQLite fixture built in the test: fresh/cached split; recursive tree walk; primary-only steps and median context; edit share by path class; bookkeeping step count; output contains no message text — confirm it fails ✅ (completed: 2026-11-25 12:43; red: 6/6 fail on the missing bench.py)
- [x] 0.1.2 Implement `scripts/bench/bench.py` (`sessions`, `plans`, `instructions`), read-only against the OpenCode DB; the 0.1.1 cases pass ✅ (completed: 2026-11-25 12:53; reads tool calls from both message `content` and `session_part`; tree totals include compaction spend; 6/6 pass)
- [x] 0.1.3 Add `"!scripts/bench/"` to `package.json` `files`; write `scripts/bench/README.md` (kit usage and the arm protocol) ✅ (completed: 2026-11-25 12:53; `npm pack --dry-run` lists no bench file)
- [x] 0.1.4 Smoke arm (D-9): one headless `opencode run` root session in a throwaway worktree dispatches one reviewer subagent and reads a skill by path from a ref checkout; `bench.py sessions --root` shows the child session and the main checkout's `git status` is unchanged ✅ (completed: 2026-11-25 12:54; `ses_ded71fc75ffe3iujkpVyMlKMXn`, 35 s: skill read by path from the ref, 1 child session, 1 review dispatch detected, main checkout unchanged; headless default model is `opencode/tidepool-alpha-free`, so arms pass `-m` explicitly)
- [x] 0.1.5 Calibrate: `bench.py sessions --root` on the three §Evidence references reproduces fresh, cached, and message counts within 1% ✅ (completed: 2026-11-25 12:53; exact match on all three (fresh, cached, messages, subagent sessions) once compaction spend is counted)
- [x] 0.1.6 Pin the baseline ref (current main SHA, recorded in §Results); baseline arms: M ×2 (make-plan, preflight, exec-plan sessions) and S ×3 (exec-plan); record metrics, the noise band, and the exec-plan bookkeeping step share ✅ (completed: 2026-11-26 03:48; corrected harness, 5 valid arms, §Results)
- [x] 0.1.7 Optional reference arm: M ×1 on `v2.8.1` (attributes Wave 1; no gate) ✅ (completed: 2026-11-25 22:56; skipped by design — optional, no gate; attributing Wave 1 does not change any decision here)
- [x] 0.1.8 `bench.py plans` on H, M, S originals and `bench.py instructions` on the baseline ref; record in §Results; end-of-phase review ✅ (completed: 2026-11-26 07:02; review + one re-review closed, §Results)

**Verify**: `npm run verify`

### Phase 1 — Lever B: collapse bookkeeping

> **Review**: reviewed 2026-11-26 08:55 (review + one re-review; findings closed)
> **Phase baseline tree**: c0bc461b4746ea933ca5fadd701b3c1687c557b2

- [x] 1.1.1 List the existing spec assertions Phase 1 supersedes (e.g. `scripts/exec-plan-progress-content.spec.test.mjs` ST-19 on report moments) and get the user's one-batch approval (D-8) ✅ (completed: 2026-11-26 07:05; none superseded: the ten report moments, fail-soft wording, README sidebar text, and the parser `--json`/`--progress-bar` contracts all stay true)
- [x] 1.1.2 Write `scripts/codeops-plan-mark.spec.test.mjs` (≤ 9 cases): `mark` sets `[~]`/`[x]`/`[!]` with a system timestamp, updates Progress and Last Updated, prints the bar, touches only real task lines (never quoted example lines), is idempotent, rejects an unknown id; plus the protocol-wording replacements approved in 1.1.1 — confirm it fails ✅ (completed: 2026-11-26 07:05; red: 7/8 fail; ST-K7 passes early because the parser already rejects unknown arguments with the id in its error)
- [x] 1.1.3 Implement `codeops_plan.py mark --plan <dir> --task <id> --state implemented|done|blocked [--note <text>]` ✅ (completed: 2026-11-26 07:06; ST-K1–K7 pass; parser specs and doctest pass)
- [x] 1.1.4 exec-plan protocol and SKILL: one `mark` call per transition, with the progress-tool report in the same step, replaces the manual edit, `date`, and progress-bar steps; roadmap sync only at phase boundaries; README sidebar text updated ✅ (completed: 2026-11-26 07:07; SKILL loop, protocol update procedure and step loop, division of labor, plan-template rules block; README unchanged (the sidebar behaves as before); content specs 201/201)
- [x] 1.1.5 Arms S ×n and M ×1 (exec-plan) on the Phase 1 SHA; gate: ≥ 70% of the 0.1.6 bookkeeping share removed (≤ 9% S, ≤ 12% M), acceptance tests pass; total primary steps reported; record; end-of-phase review ✅ (completed: 2026-11-26 08:45; gate missed (bookkeeping ~halved: S 29→16%, M 41→22%); accepted by the user; review pending)

**Verify**: `npm run verify`

### Phase 2 — Levers C+D: one-document standard plan, tests equal acceptance criteria

> **Review**: reviewed 2026-11-26 11:03 (specialist review + one re-review; findings closed)
> **Phase baseline tree**: d51fbb14e145e8e6965e55319f4f5ec9121f93f4

- [x] 2.1.1 List the existing spec assertions Phase 2 supersedes (e.g. `right-sized-verification-content.spec.test.mjs` ST-15 "report-only"/"1.5:1"/"never block"; `plan-coverage-content.spec.test.mjs` coverage hunt by default for full plans) and get the user's one-batch approval (D-8) ✅ (completed: 2026-11-26 08:52; two superseded, approved: coverage hunt default -> critical only; balance report-only -> blocks above 1:1 at standard)
- [x] 2.1.2 Write `scripts/lean-plan-content.spec.test.mjs` and `scripts/codeops-plan-single-doc.spec.test.mjs` (≤ 9 cases together): single-document form, Decisions owning decisions, ACs as spec cases, blocking brake at standard, critical unchanged, the approved replacements, and `codeops_plan.py` reading Implements and tier from the plan header — confirm they fail ✅ (completed: 2026-11-26 08:55; red: 9/9 fail before implementation; superseded assertions removed from plan-coverage and right-sized specs (approved))
- [x] 2.1.3 Shared protocols for single-document plans: `_shared/zero-ambiguity-gate.md` (at `standard` the plan's Decisions table owns decisions, runtime ambiguities, and complexity approvals with full evidence), `_shared/layout-convention.md` (a mini-plan is a single document without a tier line), exec-plan's tier/goal/baseline source and STOP-packet path for single-document plans ✅ (completed: 2026-11-26 08:56; zero-ambiguity owner row, layout convention, exec-plan tier/goal/escalation sources; LP-3, LP-6, LP-7 green)
- [x] 2.1.4 make-plan: at `standard`, one batched question round with recommended answers, no coverage hunt, no separate register, no preflight step; write only `99-execution-plan.md` (header, Decisions, Acceptance criteria, Tasks); `critical` path unchanged ✅ (completed: 2026-11-26 08:57; make-plan standard section, critical-only hunt default, single-document template, ordering rules (2.1.6 text); LP-1, LP-2, LP-4, LP-5 green; LP-2's section reader made fence-aware before commit)
- [x] 2.1.5 exec-plan entry gate, `codeops_plan.py`, roadmap sync, upgrade-plan, and `codeops_plan_migrate.py` accept a standard single-document plan ✅ (completed: 2026-11-26 08:57; parser and nested migration read a single document's header; roadmap, upgrade-plan, make-plan roadmap hook updated; SD-1, SD-2 green)
- [x] 2.1.6 `_shared/spec-first-ordering.md`, templates, and agent-template vocabulary (AC-n, D-n): at `standard` spec cases are the ACs (guide 3–8 per phase), implementation tests only where an AC names an error path or edge; the parent computes the balance and raises the STOP packet above 1:1 at `standard`; regenerate affected packaged agents with `CODEOPS_PLUGIN_ROOT=$(pwd)` ✅ (completed: 2026-11-26 09:00; ordering rules (AC-n spec cases, 3–8 per phase), executor/reviewer vocabulary, D-n in the plan-ID leak check; agents regenerated with CODEOPS_PLUGIN_ROOT=$(pwd); executor golden fixture follows the template)
- [x] 2.1.7 Planning-only arms at the Phase 2 SHA re-author H, M, S from their input packets; `bench.py plans`; gate on M: 1 document ≤ 20 KB, verification share ≤ 25%; H and S reported ✅ (completed: 2026-11-26 10:02; M only (H and S replays skipped: not gated); 1 document, 21–27 KB, verification 29–38% — narrowly missed, accepted)
- [x] 2.1.8 Arm M ×n (make-plan then exec-plan) on the Phase 2 SHA; gate: planning fresh −50% and cached −60% vs baseline make-plan + preflight, acceptance tests pass; record; end-of-phase review with `agent-pipeline-reviewer` ✅ (completed: 2026-11-26 10:02; planning fresh −91%, cached −94%; cost −80%; acceptance 8/8; specialist review closed)

**Verify**: `npm run verify`

### Phase 3 — Levers A+E: phase-scoped execution, one review round

> **Review**: reviewed 2026-11-26 12:06 (specialist review + one re-review; findings closed)
> **Phase baseline tree**: e0a81e0c4036c11c1c572b7b9310f856017d8639

- [x] 3.1.1 List the existing spec assertions Phase 3 supersedes (e.g. `right-sized-verification-content.spec.test.mjs` ST-7 "150 … product lines") and get the user's one-batch approval (D-8) ✅ (completed: 2026-11-26 11:03; one superseded, approved: the 150-product-line review trigger (ST-7); 'at most one refute per phase' stays true)
- [x] 3.1.2 Write `scripts/phase-dispatch-content.spec.test.mjs` (≤ 6 cases): per-phase executor dispatch above the threshold at both tiers, the compact packet, the structured report, parent-only marks and balance, `critical` phases on the session model, standard end review round — confirm it fails ✅ (completed: 2026-11-26 11:04; red: 6/6 fail)
- [x] 3.1.3 Measure M's post-Phase-2 phase sizes (2.1.8 plans) and set the dispatch threshold so M's feature phases dispatch ✅ (completed: 2026-11-26 11:04; Phase 2 M plans: phases of 7, and 4+4 tasks (baseline 5+5, 4+5+2); threshold = 3 or more tasks, so every feature phase dispatches)
- [x] 3.1.4 exec-plan: dispatch each phase at or above the threshold to a fresh executor with the phase packet and a structured report (files changed, verify result, blockers); the parent keeps summaries, calls `mark`, and computes the balance ✅ (completed: 2026-11-26 11:05; phase-scoped dispatch section, phase report, parent-only marks/gate/balance; PD-1..PD-4 green)
- [x] 3.1.5 `agent-templates/plan-task-executor.md` and `plan-task-executor-opus.md`: accept the phase packet and return the report contract; regenerate packaged agents with `CODEOPS_PLUGIN_ROOT=$(pwd)`; `install_agents.py --check` clean ✅ (completed: 2026-11-26 11:05; both executor templates return the phase report and never edit the plan; agents and golden regenerated; --check clean)
- [x] 3.1.6 Implement review timing at `standard`: one end-of-plan round + refute; per-phase round only for risk-tagged phases; remove the 150-line trigger; `critical` unchanged ✅ (completed: 2026-11-26 11:05; standard: one end-of-plan review round + refute, risk-tagged phases only; 150-line trigger removed; PD-5 green)
- [x] 3.1.7 Arm M ×n (exec-plan) on the Phase 3 SHA; gate: median context per primary step ≤ 150k, execution cached tokens −60% vs 0.1.6, review rounds = 1 (+ ≤ 1 refute), acceptance tests pass; record; end-of-phase review with `agent-pipeline-reviewer` ✅ (completed: 2026-11-26 12:06; ctx ≤150k and 1 review round met; execution cached −45–56% (gate −60%) and one 7/8 acceptance accepted by the user)

**Verify**: `npm run verify`

### Phase 4 — Lever F: instruction diet

> **Review**: reviewed 2026-11-26 13:08 (review + one re-review; findings closed)
> **Phase baseline tree**: 53083cbe72b02dd6365e08536b04caad74296778

- [x] 4.1.1 List every content spec assertion that pins text the diet moves; get the user's one-batch approval (D-8) ✅ (completed: 2026-11-26 12:22; light trim (user's choice): no text moves, so no assertion is superseded)
- [x] 4.1.2 Write the replacement spec file (≤ 9 cases) guarding the moved text at its new location — confirm it fails ✅ (completed: 2026-11-26 12:22; instruction-diet-content spec (2 cases); red: 2/2 fail)
- [x] 4.1.3 Split make-plan, exec-plan, preflight, and make-requirements into a lean core plus `critical`-only references; move option blocks (`--auto-design`, `--explore-scope`, `--auto-effort`, Discovery) behind their flags ✅ (completed: 2026-11-26 12:24; light trim (user's choice): standard-run reading lists in make-plan and exec-plan; option and critical-only links marked conditional; no file splits)
- [x] 4.1.4 `bench.py instructions`: standard-path footprint ≤ 15k tokens per workflow (from 35–49k) ✅ (completed: 2026-11-26 12:24; always-read: make-plan 46.1k → 32.5k, exec-plan 38.4k → 31.7k; ≤15k not reached (light trim, accepted scope))
- [x] 4.1.5 Arm M ×1 on the Phase 4 SHA; gate: median context per primary step does not regress vs 3.1.7, acceptance tests pass; record; end-of-phase review with `agent-pipeline-reviewer` ✅ (completed: 2026-11-26 13:07; acceptance 8/8 ×2; context 146–149k (+5%, within band); review findings fixed in 05ab341)

**Verify**: `npm run verify`

### Phase 5 — Real-world validation and closeout

- [x] 5.1.1 Hand the user the MAJOR release step (`node scripts/release.mjs release --type auto --tag <dist-tag>`) and the update step (`npx opencode-codeops update`); proceed after the user releases and updates or explicitly defers ✅ (completed: 2026-11-26 13:25; 3.0.0 published by the Release workflow (run 45818965860, provenance signed); version guard fixed to ignore the layout schema version)
- [ ] 5.1.2 Next real standard feature in one of the user's projects: `bench.py sessions` and compare with that project's historical make-plan, preflight, and exec-plan medians
- [ ] 5.1.3 A second real feature in another project, same measurements
- [ ] 5.1.4 Final before/after report in §Results against the Objective targets; update issue #4 (Wave 2) from the results; roadmap row T-08 to Done

**Verify**: `npm run verify`

## Results

**Baseline ref:** `7509f22d725f71281bfb55f1077d1ee657da8fd2` (main after Wave 1 and the kit).
**Arm model:** `deepseek/deepseek-flash#max` (the user's working model; ~89k of their messages in
the 60 days before 2026-11-25). **Harness:** `scripts/bench/harness/` (bench README §Arm protocol):
process-only ref, standalone shallow subject, bubblewrap sandbox with a private OpenCode and no
CodeOps plugin, network limited to the model API plus an npm mirror that refuses CodeOps; M arms pin
`quality.verificationTier: standard`; acceptance = the subject's original spec files copied over
the arm's own, plus the subject's `npm run verify`.

**Discarded runs (kept under `discarded/` in the output store, never compared):** six arms whose
agents reached the original answers before the isolation was complete — one through a
full-checkout ref, two through this repository's history from subagents that never saw the
prompt rules, one through a global npm install and the npm registry — plus the first unsandboxed
set, rerun under identical conditions. All five valid baselines below have clean audits.

### Phase 0 baseline (final, 2026-11-26)

Baseline arms: S1–S3 and M3–M4 — all `valid` (audit, scope check, and checkout check pass;
`harness/remeasure.py` re-applies the current kit and checks to every stored arm). Superseded,
not used: M1 (invalid — changed the plan parser and planned the live smoke) and M2 (valid, but on
the earlier packet that still described slice 0). Earlier discarded runs reached subject answers
before the isolation was complete. Flagged paths in the valid arms are probes of what the sandbox
shows (own ref, tools, packet, workspace; the opencode binary, which contains no subject answer;
the masked nvm folder). The network filter blocked GitHub, the npm `opencode-codeops` package, and
several web-search services.

| Arm | Workflow | Min | Fresh | Cached | Primary steps | Median ctx/step (primary / tree) | Tool calls | Bookkeeping | Review / refute rounds | Cost |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 | exec-plan | 15 | 383,698 | 10,958,208 | 69 | 133,443 / 115,182 | 112 | 32 (29%) | 2 / 1 | $0.17 |
| S2 | exec-plan | 10 | 256,828 | 8,943,488 | 79 | 99,251 / 93,564 | 92 | 24 (26%) | 1 / 0 | $0.12 |
| S3 | exec-plan | 10 | 263,377 | 8,655,232 | 60 | 124,333 / 108,885 | 98 | 32 (33%) | 1 / 0 | $0.11 |
| M3 | make-plan | 22 | 1,019,899 | 53,330,688 | 153 | 292,606 / 126,924 | 198 | — | — | $0.57 |
| M3 | preflight | 31 | 1,533,115 | 49,970,176 | 93 | 275,631 / 99,500 | 177 | — | — | $0.80 |
| M3 | exec-plan | 36 | 783,047 | 38,029,312 | 174 | 173,118 / 117,512 | 216 | 83 (38%) | 2 / 0 | $0.41 |
| M4 | make-plan | 22 | 1,030,203 | 33,916,928 | 85 | 231,520 / 104,874 | 147 | — | — | $0.49 |
| M4 | preflight | 34 | 1,795,540 | 150,721,280 | 334 | 375,672 / 170,148 | 361 | — | — | $1.17 |
| M4 | exec-plan | 34 | 680,449 | 34,697,984 | 151 | 182,026 / 131,018 | 191 | 83 (43%) | 2 / 0 | $0.34 |

Bookkeeping is reported for exec-plan only: during make-plan and preflight, plan-document edits
are the work itself. Coverage-hunt and preflight auditors appear as 4–5 audit dispatches per
make-plan / preflight session.

| Medians (spread = (max − min) / median) | n | Fresh | Cached | Primary steps | Median ctx/step | Bookkeeping share | Review rounds |
|---|---|---|---|---|---|---|---|
| S exec-plan | 3 | 263,377 (48%) | 8,943,488 (26%) | 69 (28%) | 124,333 (28%) | 28.6% (26–33%) | 1 |
| M planning (make-plan + preflight) | 2 | 2,689,379 (10%) | 143,969,536 (56%) | — | — | — | — |
| M exec-plan | 2 | 731,748 (14%) | 36,363,648 (9%) | 163 (14%) | 177,572 (5%) | 40.9% (38–43%) | 2 |

| Quality and shape | M3 | M4 | S1–S3 |
|---|---|---|---|
| Acceptance (original specs) | 8/8, verify ✅ | 8/8, verify ✅ | 36/36, verify ✅ each |
| Plan documents / KB | 12 / 140.4 | 10 / 133.5 | 1–2 / ~3 |
| Tasks / verification share | 10 / 50% | 11 / 18% | 3 / 67% |
| Spec cases / decisions | 5 / 38 | 4 / 43 | — |
| Assumptions logged | 18 | 28 | 2–3 |
| Cost (planning + execution) | $1.37 + $0.41 = $1.77 | $1.67 + $0.34 = $2.01 | $0.11–0.17 |

### Phase 1 result — lever B (ref `5691016`, 2026-11-26)

Paired with the baseline (S on the same mini-plan; M3/M4 re-executing the exact baseline M3/M4
plans). All five arms valid; acceptance unchanged (S 36/36 each, M 8/8 each).

| Exec-plan arm | Bookkeeping share, baseline → Phase 1 | Primary steps | Cached tokens |
|---|---|---|---|
| S (median of 3) | 29% → 16% | 69 → 62 | 8.9M → 8.1M |
| M3 (paired) | 38% → 22% | 174 → 151 | 38.0M → 39.3M |
| M4 (paired) | 43% → 23% | 151 → 77 | 34.7M → 19.0M |

**Gate missed; accepted by the user (2026-11-26).** Bookkeeping roughly halved (≈ 45% removed) but
did not reach ≤ 9% (S) / ≤ 12% (M): the remaining calls are mostly the two `mark` calls each task
needs (counted as bookkeeping by design), plus hand-written phase-header lines, `date` calls for
them, and roadmap row edits. Further cuts (phase-header and roadmap writes through one call,
dropping the intermediate `[~]` mark) are deferred; planning, ~80% of a feature's tokens, is the
larger lever.

### Phase 2 result — levers C+D (ref `de1f95e`, 2026-11-26)

Two M arms, make-plan then exec-plan (no preflight), compared with baseline M3/M4 (make-plan +
preflight + exec-plan). Both valid; acceptance 8/8 each.

| M arm | Planning fresh / cached | Execution fresh / cached | Total cost | Total time |
|---|---|---|---|---|
| Baseline M3 | 2.55M / 103.3M | 0.78M / 38.0M | $1.77 | 89 min |
| Baseline M4 | 2.83M / 184.6M | 0.68M / 34.7M | $2.01 | 90 min |
| Phase 2 M1 | 0.25M / 9.0M | 0.49M / 21.1M | $0.36 | 32 min |
| Phase 2 M2 | 0.25M / 8.9M | 0.65M / 25.1M | $0.42 | 41 min |

Planning fresh −91% and cached −94% (gates −50% / −60%: met). Cost per feature −80%, time −60%.
Plan shape: 1 plan document (plus the review ledger written during execution), 21.2 KB and 26.7 KB
(gate ≤ 20 KB: narrowly missed); verification share 29% and 38% on 7–8 tasks (gate ≤ 25%:
missed by one task each). **Accepted by the user (2026-11-26).**

### Phase 3 result — levers A+E (ref `7f042f7`, 2026-11-26)

Two M exec-plan arms re-executing the Phase 2 arms' plans (paired). Both valid.

| M exec-plan | Cached tokens | Median ctx/step (primary) | Review rounds | Cost | Acceptance |
|---|---|---|---|---|---|
| Baseline M3 / M4 | 38.0M / 34.7M | 173k / 182k | 2 / 2 | $0.41 / $0.34 | 8/8, 8/8 |
| Phase 2 M1 / M2 | 21.1M / 25.1M | 169k / 159k | 1 / 2 | $0.24 / $0.31 | 8/8, 8/8 |
| Phase 3 M1 / M2 | 16.1M / 20.2M | 136k / 141k | 1 / 1 | $0.23 / $0.28 | 8/8, 7/8 |

Median context per primary step ≤ 150k: met. Review rounds = 1: met. Execution cached −56% / −45%
vs the 0.1.6 baseline (gate −60%): missed. One arm failed one acceptance test (the strip text
rendered twice — a miss earlier baseline arms also made). **Accepted by the user (2026-11-26).**
A standard feature now costs ≈ $0.35–0.40 end to end (baseline $1.77–2.01).

### Phase 4 result — lever F, light trim (ref `96c2268`, 2026-11-26)

Light trim chosen by the user: reading lists in make-plan and exec-plan, option and critical-only
links flag-gated; no file splits. Always-read instruction footprint: make-plan 46.1k → 32.6k,
exec-plan 38.4k → 31.7k approx tokens (≤ 15k gate not reached — accepted scope). Two M arms
(make-plan + exec-plan), both valid, acceptance 8/8 each; total cost $0.47 / $0.43; median context
per primary step 146k / 149k vs 136k / 141k in Phase 3 (+5%, inside the decision band; ≤ 150k
holds). One arm's plan lacked the `mark` execution-rules block — the reading-list defect the phase
review found (RV-002), fixed in `05ab341`.

**Static baselines (0.1.8).** Original plans: H 15 docs / 254 KB / 86 tasks / 46% verification;
M 10 / 119 KB / 14 / 57%; S 1 / 1.8 KB / 6 / 33%. Instruction footprint at the baseline ref
(always-read, approx tokens): make-plan 44.4k, make-requirements 30.9k, preflight 33.6k,
exec-plan 36.2k.

**What the baseline says.** Planning is ~80% of an M feature's tokens (~2.7M fresh / ~144M cached
vs ~0.7M / ~36M to execute). Bookkeeping is 29% (S) and 41% (M) of exec-plan tool calls, so the
lever B gate (≥ 70% removed) is **≤ 9% (S) and ≤ 12% (M)**. Decision band per metric =
max(10%, the spread above). M planning cached tokens vary widely (preflight ran 93 vs 334 steps),
so planning-cached gates take a confirming re-run; M's verification share (18–50% on 4–5 spec
cases) is too noisy to gate alone and is read together with spec-case counts.

## Risks and rollback

| Risk | Mitigation |
|---|---|
| Lean standard plans let ambiguity through | Zero-Ambiguity rule still applies to every material decision (D-5); risky work derives `critical` |
| Blocking brake stops legitimate test-heavy work | It raises the existing STOP packet, so the user can approve; `critical` is report-only |
| Phase executors lose context and redo work | Structured packet and report; parent keeps summaries; measured in 3.1.7 |
| Arm noise | Repeats, a measured noise band, and confirming re-runs (Measurement method §5) |
| Arms run stale code | Ref binding by path and pinned SHAs (D-11); smoke in 0.1.4 |
| Arms touch the main checkout | `--no-commit`, worktree-only shell calls, no push, `git status` check after each arm |
| Superseding spec assertions weakens guarantees | One-batch user approval and a replacement test per superseded assertion (D-8) |

**Rollback:** each lever is its own phase commit set; `quality.verificationTier: critical` restores
today's heavy path for any project without a revert.

## Success criteria

1. Every phase gate met or explicitly ruled by the user.
2. §Results shows the Objective targets met on arm M and on at least one real feature.
3. `npm run verify` green; `critical`-tier behavior unchanged except levers A, B, F.
