# Roadmap: opencode-codeops

> **Feature-Set**: opencode-codeops
> **Status**: In Progress
> **Created**: 2026-10-04
> **Last Updated**: 2026-11-25 00:05
> **Progress**: 5 / 5 (100%)
> **CodeOps Artifact Schema**: 1

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Depends-on / Blocker |
|----|-------|----|------|-------|--------|--------------|----------------------|
| T-01 | Install `_shared/` and `references/` beside the installed skills | — | [fix-shared-reference-install](fix-shared-reference-install/99-execution-plan.md) | Done | ✅ | 2026-09-24 | — |
| T-02 | Push release tags by creating annotated tags | — | [fix-release-tag-push](fix-release-tag-push/99-execution-plan.md) | Done | ✅ | 2026-09-24 | — |
| REQ-SPECIALIST-AGENTS | Specialist-agent detection, creation, routing, and use | — | [specialist-agents](specialist-agents/00-index.md) | Done | ✅ | 2026-10-04 | — |
| REQ-ADAPTIVE-REASONING-EFFORT | Adaptive per-dispatch reasoning effort with advisory per-phase suggestions | — | [adaptive-reasoning-effort](adaptive-reasoning-effort/00-index.md) | Done | ✅ | 2026-10-04 13:13 | — |
| T-03 | Opt-in reasoning-effort request trace | — | [reasoning-effort-trace](reasoning-effort-trace/99-execution-plan.md) | Done | ✅ | 2026-10-04 14:06 | — |
| T-04 | Note the exposed model variant set (`low`/`high`/`max`) in the effort docs | — | — | Done | ✅ | 2026-10-04 14:08 | — |
| T-05 | Map missing reasoning levels to the nearest exposed variant | — | [effort-level-fallback](effort-level-fallback/99-execution-plan.md) | Done | ✅ | 2026-10-04 14:13 | — |
| T-06 | Fix agent frontmatter layout so mode/hidden/permissions apply (issue #2) | — | [fix-agent-frontmatter](fix-agent-frontmatter/99-execution-plan.md) | Done | ✅ | 2026-10-09 | — |
| T-07 | Specialist awareness: visible checks, proposal split, analyze-project coverage | — | [specialist-awareness](specialist-awareness/99-execution-plan.md) | Done | ✅ | 2026-10-09 | — |
| T-08 | Lean delivery: far fewer tokens, steps, and verification tasks per standard feature (measured per lever) | — | [lean-delivery](lean-delivery/99-execution-plan.md) | Executing | 🔄 | 2026-11-25 12:10 | REQ-RIGHT-SIZED-VERIFICATION |
| REQ-ANALYZE-AGENTS | Active specialist discovery: the analyze-agents skill with durable evidence | — | [analyze-agents](analyze-agents/00-index.md) | Done | ✅ | 2026-10-09 | T-07 |
| REQ-LIVE-TASK-SIDEBAR | Live CodeOps task progress in the sidebar — foundation slices 0–1 (counting fix + TUI spike) | — | [live-task-sidebar](live-task-sidebar/00-index.md) | Done | ✅ | 2026-10-10 | — |
| REQ-LIVE-TASK-PROGRESS | Live CodeOps task progress in the sidebar — the full feature (slice 2: progress tool, live state, sidebar view, exec-plan reporting) | — | [live-task-progress](live-task-progress/00-index.md) | Done | ✅ | 2026-10-10 20:39 | — |
| REQ-DISCOVERY | Discovery — answer CodeOps question rounds in a local Fluent UI page; Submit wakes the agent (opt-in; make-plan + preflight) | — | [discovery](discovery/00-index.md) | Done | ✅ | 2026-10-27 11:58 | — |
| REQ-RIGHT-SIZED-VERIFICATION | Right-sized verification (Wave 1): tiers, verification balance, review calibration + refuter, skill descriptions, compaction note | — | [right-sized-verification](right-sized-verification/00-index.md) | Done | ✅ | 2026-11-25 09:42 | — |
| REQ-WAVE2-ENTRY-AND-FLOWS | Wave 2: router + status CLI, lightweight change path, bug flow, converge pass ([#4](https://github.com/blendsdk/opencode-codeops/issues/4)) | — | — | Backlog | ⬜ | 2026-11-25 09:37 | REQ-RIGHT-SIZED-VERIFICATION |
| REQ-DISCOVERY-UI-REDESIGN | Discovery plan workspace — group navigation, focused questions, decision summary, and theme preference | — | [discovery-ui-redesign](discovery-ui-redesign/00-index.md) | Done | ✅ | 2026-10-29 14:56 | REQ-DISCOVERY |
| REQ-TEST-IMPACT-SELECTION | Opt-in, language-neutral test-impact selection — affected feature-slice gates locally/PR, full suite at release/acceptance | — | [test-impact-selection](test-impact-selection/00-index.md) | Done | ✅ | 2026-11-12 03:05 | — |
| RD-03 | Independence and Effort Allocation | [RD-03](../requirements/RD-03-independence-and-effort.md) | [effort-allocation](effort-allocation/00-index.md) | Done | ✅ | 2026-11-24 01:23 | — |
| RD-01 | Coverage Hunt Protocol | [RD-01](../requirements/RD-01-coverage-hunt-protocol.md) | — | Done | ✅ | 2026-11-24 01:20 | depends on RD-03 |
| RD-02 | Coverage Auditor Mode | [RD-02](../requirements/RD-02-coverage-auditor-mode.md) | — | Done | ✅ | 2026-11-24 01:50 | depends on RD-01 |
| RD-04 | Requirements-Stage Integration | [RD-04](../requirements/RD-04-requirements-stage.md) | — | Done | ✅ | 2026-11-24 09:06 | depends on RD-01, RD-02, RD-03 |
| RD-05 | Plan-Stage Integration | [RD-05](../requirements/RD-05-plan-stage.md) | — | Done | ✅ | 2026-11-24 09:14 | depends on RD-01, RD-02, RD-03 |
