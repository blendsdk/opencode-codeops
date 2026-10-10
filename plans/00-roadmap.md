# Roadmap: opencode-codeops

> **Feature-Set**: opencode-codeops
> **Status**: In Progress
> **Created**: 2026-10-04
> **Last Updated**: 2026-10-10 13:26
> **Progress**: n/a
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
| REQ-ANALYZE-AGENTS | Active specialist discovery: the analyze-agents skill with durable evidence | — | [analyze-agents](analyze-agents/00-index.md) | Done | ✅ | 2026-10-09 | T-07 |
| REQ-LIVE-TASK-SIDEBAR | Live CodeOps task progress in the sidebar — foundation slices 0–1 (counting fix + TUI spike) | — | [live-task-sidebar](live-task-sidebar/00-index.md) | Done | ✅ | 2026-10-10 | — |
