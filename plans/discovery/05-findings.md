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
| RV-001 | 3 | MAJOR | bin/lib/discovery-store.mjs (concurrent first publishes could collide) | fixed |
| RV-002 | 3 | MAJOR | 03-03 + store (no markDelivered for wake completion) | fixed |
| RV-003 | 3 | MINOR | bin/lib/discovery-store.mjs (dead claims not swept at creation) | fixed |
| RV-004 | 3 | MINOR | store readAnswers/resolve missing-plan sentinel | fixed |
| RV-005 | 3 | MINOR | bin/lib/discovery-store.mjs (stale project slugs trusted) | fixed |
| RV-006 | 3 | MINOR | bin/lib/discovery-store.mjs (reconfirm wiped notes/defer/discussion) | fixed |
| RV-007 | 3 | MINOR | 03-03 SubmittedAnswer source typing | fixed |
| RV-008 | 3 | MINOR | bin/lib/discovery-store.mjs (slug cap after collision suffix) | fixed |
| RV-009 | 3 | MINOR | bin/discovery-store.impl.test.mjs (forced write-failure cleanup) | fixed |
| RV-001 | 4 | MAJOR | bin/lib/discovery-server.mjs (raw directory registration key) | fixed |
| RV-002 | 4 | MINOR | bin/lib/discovery-server.mjs (closeIfIdle during in-flight listen) | fixed |
| RV-003 | 4 | MINOR | bin/lib/discovery-server.mjs (archive changed event payload) | fixed |
| RV-004 | 4 | MINOR | bin/lib/discovery-server.mjs (write checks before route slugs) | fixed |
| RV-005 | 4 | MINOR | bin/discovery-server.spec.test.mjs (header/error-code assertions) | fixed |
| RV-006 | 4 | MINOR | bin/discovery-server.spec.test.mjs (delete-404, hello name, submit-all) | fixed |
| RV-007 | 4 | MINOR | bin/discovery-server.impl.test.mjs (closeIfIdle with open SSE) | fixed |
