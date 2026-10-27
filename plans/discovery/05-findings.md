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
| RV-001 | 5 | MAJOR | plugin/discovery-plugin.spec.test.mjs (submit-to-wake path untested) | fixed |
| RV-002 | 5 | MINOR | plugin/discovery-plugin.impl.test.mjs / spec (disable close masked) | fixed |
| RV-003 | 5 | MINOR | bin/lib/discovery-tools.mjs (claim leak before the prompt) | fixed |
| RV-004 | 5 | MINOR | bin/lib/discovery-tools.mjs (not-found mapped as owned/invalid) | fixed |
| RV-005 | 5 | MINOR | bin/lib/discovery-tools.mjs (dispose did not remove tools) | fixed |
| RV-006 | 5 | MINOR | plugin/discovery-plugin.spec.test.mjs (missing-prompt case hollow) | fixed |
| RV-007 | 5 | MINOR | plugin/discovery-plugin.spec.test.mjs (runtime/impliedBy/dead-pid gaps) | fixed |
| RV-008 | 5 | MINOR | 03-05 + tools (warn channel and doc pointer) | fixed |
| RV-009 | 5 | MINOR | plans/discovery/99-execution-plan.md (task note placement) | fixed |
| RV-001 | 6 | MAJOR | views/DeferFields.tsx (invalid empty deferral) | fixed |
| RV-002 | 6 | MAJOR | app.tsx (errors replace the page; no silent reloads) | fixed |
| RV-003 | 6 | MAJOR | app.tsx / views (no debounce or blur flush) | fixed |
| RV-004 | 6 | MAJOR | app.tsx (no aria-live announcements) | fixed |
| RV-005 | 6 | MAJOR | app.tsx (plan state survives a route change) | fixed |
| RV-006 | 6 | MAJOR | views/QuestionCard.tsx (unlabelled checkboxes) | fixed |
| RV-007 | 6 | MINOR | store listPlans (orphaned missing) | fixed |
| RV-008 | 6 | MINOR | spec ST-49 (weak counts/summary assertions) | fixed |
| RV-009 | 6 | MINOR | spec ST-50 (vacuous griffel check) | fixed |
| RV-010 | 6 | MINOR | spec ST-51 (routes asserted together) | fixed |
| RV-011 | 6 | MINOR | spec ST-52 (renderer attribute assertion) | fixed |
| RV-012 | 6 | MINOR | views/ProjectPage.tsx (no archived switch) | fixed |
| RV-013 | 6 | MINOR | view-models countsLabel (submitted omitted) | fixed |
| RV-014 | 6 | MINOR | view-models status precedence | fixed |
| RV-015 | 6 | MINOR | views/GroupSection.tsx (raw missing codes) | fixed |
| RV-016 | 6 | MINOR | UI dead code | fixed |
| RV-017 | 6 | MINOR | 03-06 menu wording vs buttons | fixed |
| RV-018 | 6 | MINOR | views/QuestionCard.tsx (duplicated radio block) | fixed |
| RV-001 | 7 | MAJOR | skills/analyze-project (minimal config missed discovery) | fixed |
| RV-002 | 7 | MINOR | _shared/discovery.md (AR id leak) | fixed |
| RV-003 | 7 | MINOR | _shared/discovery.md (retirement wording) | fixed |
| RV-004 | 7 | MINOR | skills/make-plan (authoring-time questions) | fixed |
| RV-005 | 7 | MINOR | content spec ST-57 (unbounded slice) | fixed |
| RV-006 | 7 | MINOR | content spec ST-59 (weak Discovery path) | fixed |
| SR-001 | 7 | MAJOR | skills/analyze-project (AR-35 shape and layout) | fixed |
| SR-002 | 7 | MAJOR | skills/analyze-project (managed line not derived) | fixed |
| SR-003 | 7 | MAJOR | skills/analyze-project (--without-discovery rules) | fixed |
| SR-004 | 7 | MINOR | skills/analyze-project (managed-line discipline) | fixed |
| SR-005 | 7 | MINOR | skills/analyze-project (symlink containment) | fixed |
| SR-006 | 7 | MINOR | content spec (analyze-project literals) | fixed |
| RV-001 | 8 | MAJOR | views/QuestionCard.tsx (Firefox text inputs kept only the last keystroke) | fixed |
| RV-002 | 8 | MAJOR | views/PlanPage.tsx (group submit skipped the confirmation) | fixed |
| RV-003 | 8 | MAJOR | views/DeferFields.tsx (stale draft after the first save) | fixed |
| RV-004 | 8 | MINOR | views/QuestionCard.tsx (focused external value not adopted) | fixed |
| RV-005 | 8 | MINOR | spec ST-21 (weak progress-feature pin) | fixed |
| RV-006 | 8 | MINOR | temp-root cleanup | fixed |
