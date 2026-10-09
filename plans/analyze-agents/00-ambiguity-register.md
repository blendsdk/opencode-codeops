## Ambiguity Register: analyze-agents (specialist discovery)

> **Status**: ✅ GATE PASSED — all 15 items resolved
> **Last Updated**: 2026-10-09 14:32
> **Scope**: feature plan for the `analyze-agents` skill and its supporting records; systematically reviewed across all 12 categories.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Naming & terminology | Manual command / feature name | `analyze-agents` / `analyze-specialists` | `analyze-agents` | ✅ Resolved |
| 2 | Scope | Invocation surface | skill + script / also CLI / CLI only | Skill is the interface; user chose skill + script — the script component is reopened in AR-10 and covered by the AR-15 escalation | ✅ Resolved (note) |
| 3 | Data & state | Durable findings ledger location | per-plan `05-findings.md` / project index / extend the register | Per-plan `05-findings.md` | ✅ Resolved |
| 4 | Data & state | Check-state + AGENTS.md line ownership | state file + analyze-project renders / AGENTS.md only / `codeops.json` field | `codeops/specialist-check.json`; analyze-project renders the managed line | ✅ Resolved |
| 5 | Behavioral | Trigger policy and surface | 2-features + review surfaces / every analyze-project run / request-only | Every analyze-project run | ✅ Resolved |
| 6 | Scope | Detector scope | repo signals + ledger recurrence / plus routing coverage / ledger only | Repo signals + ledger recurrence; routing/catalog coverage stays in `setup-routing` | ✅ Resolved |
| 7 | Scope | Check enforcement | checklist + summary lines / checklist only / summaries only | Checklist + summary lines (delivered by T-07) | ✅ Resolved |
| 8 | Data & state | Ledger format and writer | one row per ruling batch `id · phase · severity · area · ruling`, appended by exec-plan's review step to the layout-aware `05-findings.md`; no prose — recommended / free-form log | User accepted recommendation: compact row per ruling batch in the layout-aware `05-findings.md`; no prose | ✅ Resolved |
| 9 | Data & state | State record shape and degradation | `{ checkedAt: ISO-8601, plans: [plan folders] }` (layout-aware); written on every run including `None`; missing or corrupt ⇒ "never checked" and the recommendation shows (fails loud) — recommended / timestamp only | User accepted recommendation: `{ checkedAt, plans[] }`; written on every run including `None`; missing/corrupt ⇒ "never checked" (fails loud) | ✅ Resolved |
| 10 | Technical (signal collection) | How signals are collected | **no Python script in v1** — the skill reads artifacts and manifests natively; a script is deferred until evidence shows the model path is insufficient (avoids the Python 3.8 TOML floor and a fourth surface) — recommended / ship the script now | User accepted recommendation: no Python script in v1; native artifact/manifest reading; script deferred until evidence shows the model path insufficient | ✅ Resolved |
| 11 | Technical (detector) | v1 signals and thresholds | (a) ledger area recurrence — same area in ≥2 plans or ≥3 findings; (b) repeated domain/lens tags across requirements/plans; (c) manifest/DSL/codegen signals read natively; no free-text mining in v1; thresholds anchor judgment, not hard gates — recommended / wider heuristic set | User accepted recommendation: the v1 signal set with judgment anchors; no free-text mining in v1 | ✅ Resolved |
| 12 | Integration points | Delegation into existing checks | `make-plan` / `make-requirements` / `analyze-project` run the same detection over the same artifacts and criteria; manual criteria remain the fallback — recommended / keep per-skill copies | User accepted recommendation: delegated detection; manual criteria remain the fallback | ✅ Resolved |
| 13 | Edge cases | Failure and boundary behavior | missing ledger ⇒ doc/manifest signals only, stated in the output; malformed rows skipped with a note; empty repo ⇒ `None` with evidence; nested layout resolved via `_shared/layout-convention.md` — recommended / fail hard | User accepted recommendation: graceful degradation as specified; nested layout honored | ✅ Resolved |
| 14 | Security & compliance | Data handling | local reads only, no network, no new dependencies; ledger/state carry identifiers, areas, and rulings — never prose; nothing enters the content-free metrics store — recommended (mandated by the existing privacy rule) | User accepted recommendation: local-only; identifiers/areas only; nothing in the metrics store | ✅ Resolved |
| 15 | Technical (complexity escalation) | E's new support surface | smaller (T-07 only) / approve the original larger option / approve the **simplified** larger option | User directly approved the **simplified larger option** (skill + ledger + state, no script) on the packet below | ✅ Resolved |

### Resolution Notes

**AR-5:** The chosen "every analyze-project run" is implemented as: the coverage line is shown on
every run; the explicit recommendation for `analyze-agents` appears when the state file is missing
or the recorded plan set differs from the current one; a recorded check clears it.

**AR-2 / AR-10:** The interview selected skill + script. The independent challenger returned
**Simplify** and recommended dropping both the script and the state file. Reconciliation: the
script is dropped (accepted — its strongest input needs semantic judgment a scanner cannot supply,
and native model reading avoids the Python 3.8 manifest-parsing limits); the state file is kept
(the user explicitly weighed the state file against parsing the managed AGENTS.md line during the
interview and chose the file).

**AR-15 — Complexity Escalation packet (full approval evidence):**

```text
Original goal: Make CodeOps actively detect and propose project-specific specialist subagents —
  visible checks, low-friction proposals, and durable evidence — so the capability is actually used.
Extra system or support code: a new `analyze-agents` skill; a per-plan `05-findings.md` ledger
  (concretizes exec-plan's currently undefined "durable finding artifact"); a small
  `codeops/specialist-check.json` state file; wiring of analyze-project (coverage line) and
  make-plan/make-requirements (delegated detection). The Python script is removed from v1 after
  challenger review.
Why it may be needed: the current failure is behavioral (coverage, visibility, gating), but the
  strongest signal — recurring review findings — has no durable record at all; without the ledger
  and a periodic project-level re-check, recurrence can never be evidenced and existing projects
  are never re-evaluated.
Evidence: plans/adaptive-reasoning-effort/00-index.md:88-94 (the single recorded check since ship —
  a silent "None"); skills/exec-plan/execution-protocol.md:202 (records decisions in an undefined
  "finding artifact"); skills/make-plan/SKILL.md:74 vs its Phase 4 summary (no surfacing);
  _shared/layout-convention.md:194-198 (the task lane skips the check).
Smallest solution that still works: Task T-07 alone — visible outcomes, proposal split, and the
  analyze-project coverage line over the state file.
Extra cost: one skill directory; one ledger convention; one small JSON state file; edits in three
  skills plus exec-plan; ongoing — the ledger is written during execution (bound to the existing
  mandatory ruling step) and the state file advances on every analyze-agents run, including "None".
Independent verdict: Simplify — the wording/policy option already targets the visibility, gating,
  and coverage causes; the larger option must justify itself on durable evidence; four new surfaces
  were two too many; the script's strongest input needs semantic judgment and manifest detection is
  fragile on the Python 3.8 floor; keep the durable-evidence kernel as plain text read by the
  existing skills. (Reconciled: script dropped; state file kept per the user's explicit interview
  choice; ledger binds to the existing ruling step so it cannot silently go unwritten.)
Direct user decision: approved the simplified larger option — script dropped; ledger and state file
  kept (explicit choice on this packet, 2026-10-09 14:32).
```

**Other categories reviewed with no open items:** Feature gaps (covered by AR-10/11), UX &
presentation (outputs follow the T-07 proposal format), Non-functional gaps (local, small-scale
scan), Stakeholder conflicts (single user), Security threats beyond data handling (none — local
reads only).
