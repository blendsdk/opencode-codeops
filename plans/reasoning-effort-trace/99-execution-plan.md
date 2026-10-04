# Task T-03: Opt-in reasoning-effort request trace

> **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Progress**: 4/5 tasks (80%)
> **Reasoning**: medium — bounded helper addition following existing project patterns
> **Last Updated**: 2026-10-04 13:52

## Objective

Make the applied reasoning level directly observable for acceptance checks. When the
`CODEOPS_EFFORT_TRACE` environment variable is `1` or `true` (case-insensitive), the plugin
appends one content-free JSON line per marker capture and per request application to the
session's scratch directory. Without the variable, behavior is unchanged.

**Smallest viable design:** one append-only helper in the existing reasoning-effort module plus
two call sites in the existing plugin hooks. No new dependency, no new configuration surface,
no default behavior change. Trace lines carry only a timestamp, event name, message id, agent
name, level, source, and applied flag — never prompt text.

## Tasks

- [x] T-03.1 Write spec tests for the trace helper (enabled check, path, append, blocked write) ✅ (completed: 2026-10-04 13:44)
- [x] T-03.2 Implement the helper, its type declarations, the plugin wiring, and the contract note ✅ (completed: 2026-10-04 13:44)
- [x] T-03.3 Full verification (`npm run verify`) ✅ (completed: 2026-10-04 13:44)
- [x] T-03.4 Live trace smoke after the global update (capture + apply lines readable) ✅ (completed: 2026-10-04 13:50) — smoke exposed a marker-scoping defect, tracked as T-03.5
- [~] T-03.5 Fix the marker-scoping defect found by the smoke: session-scoped markers (user decision) ⏳ (implemented: 2026-10-04 13:52)

**Verify**: `npm run verify`
