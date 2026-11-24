# Review Calibration & Refuter: Right-Sized Verification (Wave 1)

> **Document**: 03-02-review-calibration.md
> **Parent**: [Index](00-index.md)

## Overview

Reviewers raise fewer, better findings at every tier (AR-18), and every critical/major finding is
challenged once before it stops execution (AR-19, AR-20, AR-28).

## Proposed Changes

### Calibration rules — new `## Finding calibration` section in `_shared/quality-profile.md` (AR-18)

1. **Test-gap severity.** A missing or thin test is 🟡 MINOR, unless an ST-case or acceptance
   criterion has no test at all — then 🟠 MAJOR.
2. **Not findings** (report none of these):
   - an issue in code outside the changed lines and the code that directly calls or is called by
     them;
   - anything the project's linter, formatter, or type checker reports;
   - a guard for a hypothetical scenario that neither the requirements nor an active
     security/risk checklist covers;
   - a test that re-proves behavior an existing test already proves;
   - a style preference that no written rule states.
3. **Quoted rule.** A `standards` finding quotes the rule text it relies on; without a quote it
   is not a standards finding.
4. **Machinery routing.** A remedy that adds a harness, validator, gate, guard framework, or other
   verification support code is not a fix task; it is raised as a complexity escalation under
   `_shared/zero-ambiguity-gate.md`.

**How it reaches every reviewer (PF-010, PF-036).** The packet table in `_shared/quality-profile.md`
gives the phase-reviewer, security-auditor, perf-auditor, domain-specialist-reviewer, and refute
rows "the `Finding calibration` section"; the `preflight-auditor` row is excluded (preflight is
out of scope), and exec-plan applies the
section when it merges findings (post-phase step 3): findings that fall under rule 2 are dropped
with a one-line note, and severities are adjusted under rule 1. No other agent template changes.

### Refute mode (AR-6, AR-19, AR-20, AR-28)

- **When:** exec-plan post-phase step, after merging and calibrating findings and before
  presenting them, if any 🔴 or 🟠 finding remains — at every tier, for every finding prefix
  (RV, SA, PE, SR).
- **Who:** one fresh `correctness-reviewer` dispatch per phase; prefer a different model than the
  finding reviewers when routing offers one; record independence as usual.
- **Mode naming (PF-029):** the packet body starts with `Mode: refute` after the standard
  dispatch header; the header itself is unchanged.
- **Packet:** the phase diff, the 🔴/🟠 findings verbatim, the ST-cases and requirements they
  cite, the calibration section, and the output contract below. The packet table gains a
  `refute` row; the reviewer's "insufficient packet" rule names the refute packet's required
  fields instead of lenses and verify context.
- **Output contract:** one row per finding:
  `<ID> — Confirmed | Downgraded → <severity> | Refuted — <evidence file:line>`.
- **Effect:**
  - `Confirmed` 🔴/🟠 → the existing ruling stop.
  - `Downgraded` → handled at the new severity: a downgrade to 🟠 still stops; to 🟡 it is
    report-only (PF-008).
  - `Refuted` → not a stop. Listed to the user under "Refuted" with its evidence, recorded in
    `05-findings.md` with ruling `refuted`; the user may reinstate it at any time, and a
    reinstated finding is handled as `Confirmed` (AR-28).
- **Ledger (PF-016):** the Ruling vocabulary gains `refuted` and `downgraded`; `downgraded` is used
  only for a downgrade to 🟡; a downgrade to 🟠 is recorded at its new severity with the user's
  ruling.
- **Rule reconciliation (AR-28):** exec-plan's "a critical/major finding may never be dismissed
  automatically" becomes "never dismissed silently: a refuted finding is reported, ledgered, and
  reinstatable". `skills/exec-plan/SKILL.md` "Finding gate" (`:249-254`) and
  `skills/exec-plan/commit-modes.md` (`:35-37`, `:86-87`) say "Confirmed 🔴/🟠" (PF-003).
- **Budget:** one refute dispatch per phase; no refute of a refute; the single re-review rule is
  unchanged.

### Template and agent

- `agent-templates/phase-reviewer.md`: add the `Mode: refute` bullet with its output contract and
  the reference to `## Finding calibration`.
- Regenerate the packaged agent (PF-028): run
  `CODEOPS_PLUGIN_ROOT=$(pwd) python3 scripts/install_agents.py --project . --roles correctness-reviewer` (the session variable otherwise points at the installed package and its older template), copy
  `.opencode/agents/correctness-reviewer.md` to `agents/correctness-reviewer.md`, then
  `CODEOPS_PLUGIN_ROOT=$(pwd) python3 scripts/install_agents.py --project . --check`. The existing hygiene spec test
  (`scripts/hygiene-content.spec.test.mjs:139`) proves the packaged body matches the template.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Refute dispatch fails | Treat every 🔴/🟠 as `Confirmed`; report the failure | AR-20 |
| Refuter returns no row for a finding | That finding is `Confirmed` | AR-20 |
| Refuter returns no rows at all | All `Confirmed`; report "refuter out of date or failed" (PF-030) | AR-20 |
| Refuter raises a new finding | Ignored; refute mode rules only on given findings | AR-19 |
