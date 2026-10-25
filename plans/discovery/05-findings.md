# Findings: discovery

> **Document**: 05-findings.md
> **Parent**: [Index](00-index.md)
> **CodeOps Artifact Schema**: 1

Findings ledger for the execution quality loop. One row per finding.

| Finding | Phase | Severity | Area | Ruling |
| --- | --- | --- | --- | --- |
| RV-001 | 1 | MAJOR | 99-execution-plan (Phase 1 note, F attribution) | fixed |
| RV-002 | 1 | MINOR | 99-execution-plan (Phase 1 note, B evidence) | fixed |
| RV-003 | 1 | MINOR | 99-execution-plan (Phase 1 note, task timestamps) | fixed |
| RV-001 | 2 | MAJOR | bin/lib/discovery-rules.mjs (duplicate group keys accepted) | fixed |
| RV-002 | 2 | MAJOR | bin/lib/discovery-rules.mjs (untrimmed implication references) | fixed |
| RV-003 | 2 | MINOR | bin/discovery-rules.spec.test.mjs (missing type fingerprint variant) | fixed |
| RV-004 | 2 | MINOR | bin/lib/discovery-rules.mjs (fingerprint did not use FINGERPRINT_FIELDS) | fixed |
| RV-005 | 2 | MINOR | bin/lib/discovery-rules.mjs (over-strict repeated option ids) | fixed |
| RV-006 | 2 | MINOR | bin tests (case naming convention) | fixed |
| RV-007 | 2 | MINOR | 00-ambiguity-register.md (stale Last Updated) | fixed |
| RV-008 | 2 | MINOR | bin/lib/discovery-rules.mjs (absent vs empty evidence fingerprint) | fixed |
