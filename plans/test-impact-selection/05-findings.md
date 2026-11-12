# Findings Ledger: Test Impact Selection

> **CodeOps Artifact Schema**: 1

| Finding | Phase | Severity | Area | Ruling |
| --- | --- | --- | --- | --- |
| SR-001 | 8 | CRITICAL | `.github/workflows/ci.yml` | fixed |
| SR-002 | 8 | MAJOR | `scripts/test-selection-docs.spec.test.mjs` | fixed |
| SR-003 | 8 | MINOR | `skills/analyze-project/SKILL.md` | fixed |
| SR-004 | 8 | MINOR | `skills/organize-tests/references/map-health.md` | fixed |
| SR-005 | 8 | MINOR | `bin/lib/test-map-validate.mjs` | fixed |
| SR-006 | 8 | MINOR | `skills/organize-tests/references/agents-testing-block.md` | fixed |
| SR-007 | 8 | MINOR | `scripts/organize-tests-content.*.test.mjs` | fixed |
| SR-008 | 8 | MINOR | `README.md` | fixed |
| SR-009 | 8 | MINOR | `CHANGELOG.md` | fixed |
| SR-010 | 8 | MINOR | `bin/codeops-test.spec.test.mjs` | fixed |
| SR-011 | 8 | MINOR | `skills/exec-plan/**` | fixed |

Re-review after the fixes: SR-001 resolved; SR-002 required one further test-line
change, applied; all other findings verified.
