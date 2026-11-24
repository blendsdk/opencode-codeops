# Verification Tiers: Right-Sized Verification (Wave 1)

> **Document**: 03-01-verification-tiers.md
> **Parent**: [Index](00-index.md)

## Overview

Full plans carry one verification tier that sizes the test ceremony and the review frequency
(AR-11). `critical` keeps today's test ceremony and review frequency. Review calibration and the
refuter (03-02) apply at every tier, including plans without a tier line (AR-18, AR-28).

## Proposed Changes

### Tier set and meaning (AR-11, AR-12, AR-15, AR-30)

| Aspect | `standard` | `critical` |
|---|---|---|
| Spec tests first | Yes — from ST-cases, before implementation | Yes |
| Red check | Inside the spec-test task (run the declared spec file, confirm it fails) — no separate task | Distinct red-phase task (today) |
| Implementation tests | Only for error paths and edge cases named in ST-cases or 03 docs | Edge cases, internals, error paths (today) |
| Coverage goal | Every ST-case / acceptance criterion has ≥1 test; no percentage targets | Same rule; percentage targets only when the plan records them as an AR decision |
| Review timing | A phase is reviewed when it is risk-tagged or has ≥150 changed product lines; otherwise its review is carried forward; all carried-forward changes are reviewed before the plan is reported done | Every non-trivial phase (today) |
| Immutable-oracle rule | Unchanged | Unchanged |

- The tier changes **when** a diff is reviewed, never **whether** it is reviewed. Strict defaults
  are satisfied at `standard` by the completion review (AR-4, PF-004).
- "Changed product lines" = added + deleted lines in product files under the 03-03 classification
  (AR-30).
- Mini-plans keep their existing lightweight path; tiers apply only to full plans (AR-11).

### Review status line (PF-005)

exec-plan writes one line in each phase header of `99-execution-plan.md` after the post-phase
step:

- `> **Review**: reviewed <YYYY-MM-DD HH:MM>` — the phase (and any carried-forward phases it
  covered) was reviewed; or
- `> **Review**: carried forward` — standard tier, below the trigger.

**Completion review.** At plan completion — before exec-plan reports the plan done, makes the
final push, or hands off for release — it reviews every phase still marked `carried forward` as one cumulative diff from the earliest
such phase's baseline tree, then marks each covered phase `reviewed`. Per-task pushes in
`--auto-commit` or ask-commit "commit and push" do not trigger it (PF-035). This applies whatever the
size or triviality of the last phase. If that baseline object no longer exists, it uses the
baseline of the earliest carried-forward phase that still exists and reports the gap. An early
stop names the unreviewed phases in the wrap-up.

### Derivation (AR-13, AR-29, AR-14, PF-015)

1. **Proposal.** `quality.verificationTier` in `codeops/codeops.json` set to `standard` or
   `critical` is the proposal. Otherwise (`derived`, the default, or absent) derive it:
   `critical` when the financial-system lens, a security risk tag or `security_profile`, the
   distributed-and-concurrent lens, or a migration/backfill of persisted data applies; else
   `standard`. Format or compatibility evolution alone does not make a plan critical (AR-29).
2. **Timing.** make-plan states a provisional tier at scope confirmation (Phase 1.3) and the final
   tier after the Phase 2 lens re-run; a change between the two is raised as a new ambiguity.
3. **Override.** The user may override the proposal; the reason records it. When the config
   tier differs from the derivation, the reason says so, e.g.
   `standard — config override (derived critical: security tag)`.
4. **Record.** `00-index.md` carries `> **Verification tier**: <standard|critical> — <reason>`.
5. **Execution.** exec-plan reads only the `00-index.md` line. No line → `critical`. An unknown
   value → `critical`, stated once in the run summary.
6. **Existing plans.** upgrade-plan never derives a tier for an existing plan; if it adds the line
   it writes `critical — pre-tier plan` (PF-031).

### Schema (AR-14)

`schemas/codeops-config.schema.json` → `quality.properties.verificationTier`:
`{ "type": "string", "enum": ["derived", "standard", "critical"] }`. Additive; absent means
`derived`. Older installations reject the property (`additionalProperties: false`), so the commit
body names the first version that accepts it (PF-030).

### Text changes

| File | Change |
|---|---|
| `_shared/spec-first-ordering.md` | New `## Verification tiers` section with the table above; reword "NEVER negotiable … regardless of feature size" to "the order is never negotiable; the tier decides which steps are separate tasks"; make the REQUIRED list (`:54-57`, "a distinct red-phase verification task") and the compressed form (`:64-79`) tier-aware ("separate task at critical; inside the spec-test task at standard"). Keep the `test-selection.md` link. |
| `skills/make-plan/SKILL.md` | Hard rule (`:169`) cites tiers; Phase 1.3 states the provisional tier; Phase 2 records the final tier line; derivation per §Derivation |
| `skills/make-plan/templates.md` | 00-index header gains the tier line; 07 "Coverage Goals" table (`:316-328`) replaced by the AC rule; 99 phase header gains `> **Review**:`; the spec-first paragraph (`:551-558`) becomes tier-aware |
| `skills/make-plan/quality-checklist.md` | `:41` "Test coverage goals defined" → "every ST-case/AC has a planned test"; `:51` "A red-phase verification task exists" → "a red check exists (a separate task at critical)" |
| `_shared/quality-profile.md` | Activation rows `:78`, `:80`, `:81` state that the tier sets review timing and that the completion review satisfies strict defaults; add the standard trigger row |
| `skills/exec-plan/execution-protocol.md` | Post-phase step 1 reads the tier, applies the trigger, writes the `Review` line; completion review before done/push/release; `:182` "Strict defaults review every non-trivial phase" and `:312` "Every non-trivial phase gets correctness review" become tier-aware |
| `skills/exec-plan/SKILL.md` | `:236-238` (every phase ends with a review) becomes tier-aware |
| `skills/upgrade-plan/upgrade-checklists.md` | One sentence per §Derivation step 6 |

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Tier line missing | `critical` | AR-14 |
| Tier line has an unknown value | `critical`, stated once in the run summary | AR-14 |
| `verificationTier` invalid in config | Schema validation fails → existing readiness-blocker rule | AR-14 |
| Carried-forward baseline object missing | Use the earliest existing carried-forward baseline; report the gap | AR-15 |
| Run stops before completion | Wrap-up names every phase still `carried forward` | AR-15 |
