# add_requirement & review_requirements Protocols

> Read this when the user is in **Add One RD** or **Health Check** mode (see
> Step 0 in SKILL.md). Both operate on an existing `requirements/` set and reuse
> the gate (`zero-ambiguity-gate.md`) and templates (`templates.md`).

---

## add_requirement Protocol

Triggered by "add_requirement", "add a feature/RD", "I also need …" when a
`requirements/` set already exists.

1. Read `requirements/README.md` to understand the current set.
2. Ask the user: *"What new capability or feature do you want to add?"*
3. Run a **condensed discovery** for just this feature — comparable-systems analysis and edge-case scenarios (see `discovery-phases.md` §1.3 and §1.5).
4. **🚨 Run the Zero-Ambiguity Gate for this new RD.** Compile an Ambiguity Register scoped to
   just this feature and resolve every item. In normal mode, resolve material items with the user.
   With active auto-design, resolve eligible technical items under the shared policy and escalate
   reserved items. **Append** new AR entries to the existing
   `requirements/00-ambiguity-register.md` (create it if it doesn't exist). All gate rules apply:
   no silent deferrals, unauthorized delegation, or guesswork. See `zero-ambiguity-gate.md`.
5. Determine where in the dependency graph the new RD fits.
6. Assign the next available RD number.
7. Write the new RD following the universal template, with AR # traceability (see `templates.md` §3.3).
8. Update `requirements/README.md`:
   - Add it to the document index.
   - Update the dependency graph.
   - Update implementation phases if affected.
9. Mark an existing `## Coverage Map` in `requirements/00-ambiguity-register.md` stale: replace
   its freshness line with `> **Freshness**: STALE — requirements changed by add_requirement on
   <date>; re-run the coverage hunt.` `add_requirement` does not run the coverage hunt in this
   version; the existing Zero-Ambiguity Gate still applies.
10. Run cross-reference validation against the existing RDs (see SKILL.md Phase 4.1).
11. Sync the roadmap if one exists (SKILL.md Phase 4.4).

Compatibility: existing registers without a coverage map remain valid; the map is added on the
next full-discovery or health-check run. No new schema stamp, artifact, or migration is introduced.

---

## review_requirements Protocol

Triggered by "review_requirements", "check my requirements", "what's
missing/inconsistent" when a `requirements/` set exists. The Health Check runs the coverage hunt by
default. It produces a diagnostic report — it does NOT modify the RDs unless the user then asks.

1. Read all documents in `requirements/`.
2. Run these checks:
   - **Completeness** — every "Must Have" has acceptance criteria (and they meet the specificity rules in `templates.md` §3.4B).
   - **Consistency** — no contradictions between RDs.
   - **Coverage Hunt** — run the coverage hunt from SKILL.md §Phase 2A against the existing set
     (four default clusters, or twelve with `--thorough`; `--no-coverage-hunt` disables it). This
     is the "what is missing?" pass and uses the RD-01 packet and result contract.
   - **Coverage checklist** — run the "Did You Consider…" checklist (`templates.md`).
   - **Dependencies** — no circular dependencies; all references valid.
   - **Scope creep** — "Should Have" items that should be "Won't Have".
   - **Orphans** — features mentioned but not owned by any RD.
   - **Traceability** — decisions in RDs back-reference AR # entries; the register exists and is fully resolved.
3. Produce a diagnostic report from this template:

```markdown
## Requirements Health Check: [Project Name]

**Documents Analyzed:** X RDs
**Date:** [Date]

### ✅ Passing
- [Check that passed]

### ⚠️ Warnings
- [Minor issue — recommendation]

### ❌ Issues Found
- [Serious gap or inconsistency — action required]

### Suggestions
- [Improvement opportunity]

### Coverage

> **Coverage**: <completed>/<total> clusters · <examined>/12 categories · <N> candidates · <M> limits · Effort: <requested→applied> · Independence: <mixed-model|mixed-effort|uniform-effort>
> **Freshness**: Coverage as of <date>; artifacts <list>

| Cluster | Area | Examined | Not examined / limit | Candidates | Notes / limit | Confidence |
|---------|------|----------|----------------------|------------|---------------|------------|
| ... | ... | ... | ... | ... | ... | ... |

**Material candidates:** CV-001 … CV-00N (short titles)
**Source note:** merged `CV-*` IDs and `DQ-*` keys
**Optional candidates:** `CV-*` with `Classification: optional`
**Complexity candidates:** routed to the Complexity Escalation Gate
```

4. After presenting the report, write the consolidated coverage map to
   `requirements/00-ambiguity-register.md` under a `## Coverage Map` heading, after the register
   table and before the resolution notes. The map is diagnostic evidence; it does not add open
   register rows or reopen the gate unless the user asks to act on a finding.

The health check is diagnostic: it writes the map and reports candidates, but it does not add open
register rows or reopen the gate unless the user asks to act on a finding. It never rewrites RDs
without a fix instruction. After presenting the report, offer to fix the issues found — e.g. via
add_requirement for missing coverage, or by revising specific RDs (each revision that introduces a
new decision must go through the Zero-Ambiguity Gate). When the user asks to act on a material
candidate, add it as an open register row and reopen the gate until it is resolved or explicitly
deferred.
