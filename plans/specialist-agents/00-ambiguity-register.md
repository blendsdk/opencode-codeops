# Ambiguity Register: Specialist Agents

> **Status**: ✅ GATE PASSED — all 27 items resolved (AR #25, #26, #27 added and resolved at execution time)
> **Last Updated**: 2026-10-04 02:44

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope | Plan lane — no `requirements/` set exists; standalone plan or requirements first? | Standalone full-form plan (recommended) / run `make-requirements` first | User invoked `make-plan specialist-agents` directly; repo is flat layout with no RD set | ✅ Resolved — User decision (invocation) |
| 2 | Naming | Plan folder slug and location | `plans/specialist-agents/` / other slug | User named the target `specialist-agents` | ✅ Resolved — User decision (invocation) |
| 3 | Scope | v1 boundary | Keep proposed v1 / defer removal path / add tag-based selection | Keep proposed v1: protocol, installer create/check/remove, generated AGENTS.md block, skill wiring, docs, spec tests. Excludes outcome metrics, tag-based auto-selection, creation without explicit approval | ✅ Resolved — User chose "Keep proposed v1" |
| 4 | Technical | Creation authority | Recommend + user approval / auto-create on evidence / report-only | Recommend with evidence, explicit user approval required; `--auto-design` cannot approve | ✅ Resolved — User chose "Recommend, user approves" |
| 5 | Technical | Specialist kind | Novel domain specialists / existing 12 catalog roles only / OpenCode-generated prompts | Novel domain specialists from a generic template + committed project brief | ✅ Resolved — User chose "Novel domain specialists" |
| 6 | Technical | Detection points | Requirements + plan + analyze-project / requirements + plan only / also runtime | `make-requirements`, `make-plan`, and `analyze-project` detect; `setup-routing` creates; `exec-plan` uses | ✅ Resolved — User chose "Requirements + plan + analyze-project" |
| 7 | Technical | Routing and discoverability layers | Generated compact AGENTS.md index / pointer only / no AGENTS.md; visible vs hidden | Mandatory model-visible `description`; policy in `codeops/codeops.json`; generated AGENTS.md index; plan `00-index.md` selection table; specialists visible by default (`hidden: false`) | ✅ Resolved — User chose generated index + visible default |
| 8 | Technical | AGENTS.md block renderer and owner | Installer-rendered / setup-routing prose / analyze-project owns | `install_agents.py --sync-agents-md` renders; `setup-routing` is sole writer of the block delimited by `<!-- CODEOPS-SPECIALISTS:START -->` and `<!-- CODEOPS-SPECIALISTS:END -->`; deliberately changes the current "concise routing note only" stance | ✅ Resolved — User chose installer-rendered block |
| 9 | Technical | Generic template count | Two (reviewer + executor) / one generic | Two: `domain-specialist-reviewer` and `domain-specialist-executor`, with distinct contracts and permission defaults | ✅ Resolved — User chose two templates |
| 10 | Technical | Reasoning default | New specialists only / all CodeOps agents | Specialists default `reasoningEffort: max`; the 12 catalog roles keep current policy; optional per-role `reasoning` override in `codeops.json` | ✅ Resolved — User chose specialists only |
| 11 | Technical | Removal semantics | Generated agent + brief / generated agent only | `--remove-custom` deletes the marker-owned generated agent and the brief after explicit confirmation, and drops the routing + AGENTS.md entries; hand-authored files are never touched | ✅ Resolved — User chose agent + brief |
| 12 | Data & state | Brief schema and validation rules | Simple flat frontmatter (`role`, `kind`, `description`, `capability`, `scope`, `evidence`, optional `effort`, `reasoning`, `hidden`, `required-for`) + Markdown body; mandatory single-line `description`; sanitize control characters; size cap | User accepted recommendation | ✅ Resolved — User accepted recommendation |
| 13 | Technical | Installer CLI surface and `--check` semantics | `--custom <role>`, `--remove-custom <role>`, `--sync-agents-md`; `--check` = missing + stale (re-render compare) + orphan/hand-authored report; `--dry-run` supported everywhere | User accepted recommendation | ✅ Resolved — User accepted recommendation |
| 14 | Technical | AGENTS.md sync behavior | Append the managed block when missing; refuse malformed markers (`START` without `END`); ≤10 lines; sanitized single-line fields; never touch other text; `analyze-project` preserves the block | User accepted recommendation | ✅ Resolved — User accepted recommendation |
| 15 | Security & compliance | Role naming and collision policy | Slug `^[a-z][a-z0-9-]{1,40}$`; reject catalog role names and OpenCode built-ins (`plan`, `build`, `general`, `explore`, `scout`); reject path separators and `..`; preserve hand-authored files, refuse to overwrite without an explicit user decision | User accepted recommendation | ✅ Resolved — User accepted recommendation |
| 16 | Integration points | `exec-plan` selection wiring for novel roles | Plan `00-index.md` "Specialist Agents" table maps phase → role; dispatch as an additional reviewer/executor; extend independence rules; `SR-NNN` finding prefix; dynamic-packet fallback when unavailable; standard reviewers and gates unchanged | User accepted recommendation | ✅ Resolved — User accepted recommendation |
| 17 | Technical | Testing approach for the Python installer | Node spec tests (`*.spec.test.mjs`) spawning `python3 scripts/install_agents.py` under `npm run verify`; security cases mandatory; flat-layout migration regression; no new pytest harness | User accepted recommendation | ✅ Resolved — User accepted recommendation |
| 18 | Edge cases | Error-handling strategy | Malformed/missing brief, unknown `kind`, duplicate role, unwritable AGENTS.md, stale generated agent, removal of a role referenced by an active plan — strategies table in the component spec | User accepted recommendation | ✅ Resolved — User accepted recommendation |
| 19 | Technical | Reasoning option mechanism and provider fallback | Frontmatter passthrough `reasoningEffort: max` (OpenCode accepts `none…max`); routing override per role; manual verification with the active model; no automatic provider-capability detection | User accepted recommendation | ✅ Resolved — User accepted recommendation |
| 20 | Naming & terminology | Names of new files, flags, and markers | `_shared/specialist-agents.md`; `codeops/specialists/<role>.md`; `agent-templates/domain-specialist-{reviewer,executor}.md`; flags `--custom`, `--remove-custom`, `--sync-agents-md`; markers `<!-- CODEOPS-SPECIALISTS:START -->` / `<!-- CODEOPS-SPECIALISTS:END -->` | User accepted recommendation | ✅ Resolved — User accepted recommendation |
| 21 | Technical (complexity escalation) | Novel-specialist subsystem vs a smaller design | A: catalog-only; B: novel subsystem; C: OpenCode-generated. Independent challenger verdict: **Simplify** | Direct user choice: **approved larger design with two trims** — spec tests run under `node --test` spawning `python3`, and explicit `exec-plan` selection wiring is in scope. AGENTS.md index, `reasoning: max`, three detection points, and two templates retained per earlier explicit choices | ✅ Resolved — User approved larger option (visible packet) |
| 22 | Naming & terminology | Parseable `> **Implements**:` target for a standalone full plan (no RD exists; the plan parser requires at least one target and accepts only `RD-*`, `T-\d+`, `REQ-*`) | `REQ-SPECIALIST-AGENTS` (recommended) / create an RD first / other tracker id | User chose `REQ-SPECIALIST-AGENTS` | ✅ Resolved — User decision |
| 23 | Scope | Invocation carried `--auto-commit`, which is not a `make-plan` flag | Record as execution intent / drop | Record `exec-plan --auto-commit` as the intended execution mode; `make-plan` itself writes no commits | ✅ Resolved — User chose "Record it for execution" |
| 24 | Scope | Detection budget: at most two specialist candidates per requirements set or plan | Record as a resolved decision / remove the budget | At most two candidates per requirements set or plan, proposed in one batch; recorded during preflight (PF-012) | ✅ Resolved — User accepted recommendation (preflight PF-012) |
| 25 | Technical (runtime) | ST-42's oracle requires the refactored generator's catalog output to be byte-identical to `agents/executor.md`, but the pre-refactor generator never reproduced that file: `agent-templates/plan-task-executor.md` has no YAML frontmatter description (fallback text) and carries a provenance comment absent from `agents/executor.md` (`git log`: both landed in the v1.2.0 port). Satisfying the literal oracle would change catalog generation, which R5 and AC #6 forbid. | A: capture the pre-refactor catalog output as a committed golden fixture and compare against it (recommended) · B: fix the generator to reproduce `agents/*.md` (changes catalog behavior; violates R5/AC #6) · C: drop the ST-42 regression guard | Option A — golden fixture `scripts/fixtures/catalog-executor.golden.md` captured from the pre-refactor generator; ST-42 amended to compare against it | ✅ Resolved — User chose golden fixture |
| 26 | Technical (runtime) | Phase 2 review RV-1: the sanitizer's spec wording in `03-02` ("collapse once, then remove markers") did not actually reach a fixed point when marker removal leaves double spaces; the implementation was corrected and the spec wording needed the matching correction during the phase | Keep the stale wording / correct the spec wording to the true fixed-point pass | The wording was corrected as a necessary correction belonging to the sanitizer fix; the path is added to the Phase 2 expected modification set | ✅ Resolved — necessary correction, recorded after the fact |
| 27 | Technical (runtime) | ST-35 assumed OpenCode loads project agents only at session start, so an agent created mid-session would be unavailable. In the tested OpenCode build, a session started before `pg-migration-reviewer` existed dispatched it natively after it was created (session `ses_efba8900`, fixture `/tmp/opencode/specialist-acceptance-fallback`; "native dispatch, fallback not needed"). The "for example created after session start" example in R7/03-03/README/`_shared` is wrong for this version; the fallback requirement itself stands. | A: correct the availability wording everywhere and test fallback by a genuinely missing agent (recommended) · B: keep the wording, mark ST-35 N/A for this environment · C: adjust only the tests, leave the docs | Option A — availability wording corrected in R7, the Won't-Have note, 03-03, 07 ST-35, README, and `_shared/specialist-agents.md`; ST-35 retriggered by a missing generated agent | ✅ Resolved — User chose docs correction |

### Resolution Notes

**AR-1–AR-11:** Direct user decisions imported from the discovery conversation; not re-confirmed
(shared gate, rule 3).

**AR-12–AR-20:** Resolved by bulk acceptance: "accept all recommendations" for the presented
batch. The recommended option for each row is spelled out in the User Decision column.

**AR-21 — Complexity Escalation Gate (complete approval evidence):**

```text
Original goal: Detect during requirements/plan creation when a project-specific specialist
  sub-agent would materially help, recommend it with evidence, and create/route it after
  explicit user approval.
Extra system or support code: Novel-specialist subsystem — _shared/specialist-agents.md,
  codeops/specialists/<role>.md briefs, two generated templates, installer modes --custom /
  --remove-custom / --sync-agents-md, AGENTS.md managed index block, three detection hooks,
  reasoningEffort: max default for specialists, exec-plan selection wiring.
Why it may be needed: The 12 catalog roles are generic and install_agents.py rejects unknown
  roles (scripts/install_agents.py:24-39); packet-only dispatch cannot carry durable
  project-specific domain knowledge across sessions.
Evidence: references/domains/selection.md (lenses already run at requirements/plan time);
  _shared/quality-profile.md:134 (dynamic packets are the correctness baseline);
  OpenCode ToolRegistry.describeTask (agent descriptions are model-visible; hidden affects UI
  only); no documented agent hot-reload.
Smallest solution that still works: Catalog-only detection and dispatch through the existing
  12 roles and dynamic packets, with no brief, templates, installer changes, or AGENTS.md block
  (challenger option D was the middle alternative).
Extra cost: ~10 new/changed files; Python installer surface plus Node spec tests; a deliberate
  AGENTS.md policy change; brief maintenance; max-reasoning cost on specialist dispatches; new
  cache of stale-brief risk.
Independent verdict: Simplify — several elements are not goal-required and novel roles are not
  wired into exec-plan's closed reviewer selection; its strongest counterargument was that
  without generation/check/removal machinery the specialist is only prose and can silently fail
  to honor CodeOps contracts.
Direct user decision: approved larger — with two challenger-derived trims: (1) spec tests run
  under `node --test` and spawn `python3` (CI-enforceable), and (2) explicit exec-plan selection
  wiring is in scope. The AGENTS.md index, reasoning default, three detection points, and two
  templates are retained as explicit user choices.
```

**Preflight refinements (owner: the preflight report `00-preflight-report.md`):**

- PF-015 refines AR-11 — `--remove-custom --yes` deletes agent + brief and triggers the AGENTS.md
  sync; `setup-routing` drops the routing policy.
- PF-029 refines AR-14's "≤10 lines" to a soft budget (three fixed lines plus one line per
  specialist, with an overflow pointer and a project cap).
- PF-009 refines AR-15 — the reserved built-in list is now eight names (`plan`, `build`, `general`,
  `explore`, `scout`, `compaction`, `title`, `summary`).
- PF-031 refines AR-19 — `reasoningEffort` is a provider passthrough, not an OpenCode-validated
  enum; the `none…max` range is constrained in the routing schema.
- AR-21's options were A (catalog-only), B (novel subsystem), and C (OpenCode-generated). The
  challenger's middle alternative was a trimmed catalog-only variant; there is no "option D".
- AR #24 was added by preflight decision PF-012.
- AR #27 refines AR-19's availability claim: the tested OpenCode build resolves project agents
  created mid-session, so the "next session" wording was removed; dispatch fallback remains for
  genuinely unavailable specialists (missing file, invalid brief, failed dispatch).

**AR-25 (runtime):** Discovered during Phase 2, task 2.1.1. ST-42 conflates "the refactor leaves
catalog output unchanged" (the requirement) with "the generator reproduces `agents/executor.md`"
(a property the repository never had). The user approved resolution A: the pre-refactor output of
`python3 scripts/install_agents.py --roles executor` was captured before any generator edit as
`scripts/fixtures/catalog-executor.golden.md`; ST-42 compares the refactored generator's output
against that golden file byte-for-byte. This keeps the regression guard and R5/AC #6 intact.

**AR-22:** Added during authoring per the surface-during-authoring rule. The plan parser
(`scripts/codeops_plan.py:62-67`, `:141-143`) requires a parseable target and the grammar accepts
`RD-*`, `T-\d+`, or `REQ-*` (`scripts/codeops_plan.py:19-23`). Since the user chose the standalone
lane (AR-1), `REQ-SPECIALIST-AGENTS` is the single viable target; creating an RD was rejected as
contradicting AR-1, and `T-\d+` was rejected as misrepresenting a multi-component feature as a
lightweight task.
