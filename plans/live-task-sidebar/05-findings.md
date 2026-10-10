# Findings Ledger: live-task-sidebar

| Finding | Phase | Severity | Area | Ruling |
|---------|-------|----------|------|--------|
| — (batch) | 1 | — | scripts/ (parser counting) | clean — RV-001 … RV-006 no findings; verdict safe to proceed |
| RV-001 | 2 | MAJOR | plugin/tui.tsx failure path | fixed |
| SA-004 | 2 | MINOR | plugin/tui.tsx failure path (same root cause as RV-001) | fixed |
| RV-002 | 2 | MINOR | tui-foundation impl tests (failure-path coverage) | fixed |
| SA-001 … SA-003 | 2 | — | rpc surface · failure-to-content leakage · packaging | clean |
| SA-005 | 2 | MINOR | dev dependencies (`npm audit` criticals) | accepted |
| RV-101 … RV-103 | 3 | MINOR | plan/AR/CHANGELOG evidence accuracy | fixed |

**Evidence:** Phase 2 fix committed as `4ee0646`; `npm run verify` green (333 tests, typecheck incl. TSX, version parity); one scoped re-review: accepted, no findings. Phase 3 review: evidence checked against the captured smoke artifacts; three MINOR accuracy nits fixed (root-ID reconciliation, client-bridge claim strength, route-count wording); docs-only diff, auditors skipped by design. SA-005 accepted-risk: the `seroval` advisories are reachable only through the unused `solid-js/web` SSR path; the dependency surface is dev-only for typecheck; runtime solid-js comes from the host; the `solid-js@1.9.12` pin is required by `@opentui/solid@0.5.17`, which the user approved (AR #11).
