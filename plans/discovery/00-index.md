# discovery Implementation Plan

> **Feature**: Discovery — answer CodeOps discovery questions in a local Fluent UI web app instead of the terminal; the agent continues on Submit
> **Status**: Planning Complete
> **Created**: 2026-10-23
> **Implements**: REQ-DISCOVERY
> **CodeOps Artifact Schema**: 1

## Overview

During `make-plan` and `preflight` the agent asks many discovery questions in the terminal. They
scroll away, get scattered across rounds, and the agent sometimes forgets an answer or assumes
one. Answering often needs time to think or to discuss with colleagues, which the terminal flow
does not allow.

Discovery moves those question rounds into a local web app. The agent publishes a plan's
questions in groups; the user answers in the browser with choices, free text, notes, deferrals,
and "needs discussion" markers. Rules the agent attaches to questions hide questions that no
longer apply and pre-fill implied answers. Pressing Submit wakes the agent, which reads the
answers, records them in the plan's Ambiguity Register (still the authoritative record), and
publishes follow-ups.

Discovery is opt-in per project and runs entirely on the local machine. The listener lives inside
the CodeOps plugin in the OpenCode background service; there is no separate process. Design
decisions and their evidence are owned by the [Ambiguity Register](00-ambiguity-register.md);
requirements are owned by [01-requirements.md](01-requirements.md).

## Minimum-Sufficient Baseline

**Original goal:** answer discovery questions in a browser — typed answers, choices, and rules
that hide or settle other questions — centralized per project, plan, and session; the agent
continues on Submit without typing; local only; opt-in; the Ambiguity Register stays the record
(AR-1, AR-2, AR-5, AR-6, AR-13).
**Smallest viable design:** one `node:http` listener inside the existing plugin process, shared
by every opted-in project in that process; plan data as JSON files in the CodeOps data directory;
three agent tools registered like `codeops_progress`; the session woken with `ctx.session.prompt`.
Behaviour lives in a browser-safe rules module shared by the page and the server (AR-3).
**Excluded machinery:** a standalone Discovery process with CRUD API, SDK, start/stop commands,
event stream between processes, and version-skew checks (AR-3); `@blendsdk/fluentui-react-components`,
react-hook-form, a router library, Vite, and browser test harnesses (AR-36); Markdown rendering of
question text (AR-29); a lock-based single writer (AR-46).
**Approved complexity:** AR-3 (in-plugin listener with a fixed port, revised smaller design) and
AR-36 (React 19 + Fluent UI v9 + Fluent icons bundled with esbuild; build at publish, AR-37).

## Document Index

| # | Document | Description |
| --- | --- | --- |
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (audit trail) |
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Requirements, scope, and acceptance criteria |
| 02 | [Current State](02-current-state.md) | Current implementation, host API evidence, risks |
| 03-01 | [Host Spike](03-01-host-spike.md) | Unverified host behaviour, probe method, fallbacks |
| 03-02 | [Rules and Model](03-02-rules-and-model.md) | Publish contract, rule evaluation, readiness |
| 03-03 | [Store](03-03-store.md) | Data directory, projects, plans, answers, delivery |
| 03-04 | [Server](03-04-server.md) | Shared listener, endpoints, security, live events |
| 03-05 | [Plugin Integration](03-05-plugin-integration.md) | Opt-in, agent tools, waking, browser opening |
| 03-06 | [Web UI](03-06-web-ui.md) | Fluent UI app, views, build, CSP nonce |
| 03-07 | [Skills and Docs](03-07-skills-and-docs.md) | Shared protocol, make-plan, preflight, analyze-project, docs |
| 07 | [Testing Strategy](07-testing-strategy.md) | Specification test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases and task checklist |
| PF | [Preflight Report](00-preflight-report.md) | Iteration 1 quality audit, findings, and resolutions |

## Quick Reference

### Agent side

```ts
codeops_discovery_publish({
  artifact: "plans/billing", kind: "plan", title: "Billing plan",
  groups: [{ key: "scope", title: "Scope" }, { key: "data", title: "Data", dependsOn: ["scope"] }],
  questions: [{ key: "DQ-1", group: "scope", type: "single", title: "Support partial refunds?",
                options: [{ id: "yes", label: "Yes" },
                          { id: "no", label: "No",
                            implies: [{ question: "DQ-2", answer: "n/a", reason: "No refunds" }] }],
                recommendation: "no" },
              { key: "DQ-2", group: "data", type: "text", title: "Refund window?" }],
})
// → { ok: true, url: "http://127.0.0.1:4747/#/p/my-repo/billing", revision: 1, opened: true }

codeops_discovery_answers({ artifact: "plans/billing", kind: "plan" })
codeops_discovery_resolve({ artifact: "plans/billing", kind: "plan",
                            recorded: [{ key: "DQ-1", as: "AR-7" }], retire: [] })
```

### User side

`http://127.0.0.1:4747/` → projects (grouped by repository) → a project's plans → a plan's
question groups. Submit a group or all ready groups; the agent wakes with a one-line pointer.

### Key Decisions

| Decision | Outcome |
| --- | --- |
| Runtime | In-plugin listener, fixed port 4747 (`CODEOPS_DISCOVERY_PORT`), separate project/plan views — AR-3, AR-21 |
| UI | React 19 + Fluent UI v9, esbuild, hash routing, built at publish — AR-36, AR-37 |
| Opt-in | `discovery.enabled` in `codeops/codeops.json`, `analyze-project --with-discovery` — AR-13, AR-35, AR-45 |
| Record | Answers transcribed into the Ambiguity Register / preflight report — AR-7, AR-27, AR-39 |
| Adoption | `make-plan` (interview + register) and `preflight` (all findings by severity) — AR-18, AR-38, AR-39 |

## Specialist Agents

| Role | Kind | Use | AR Ref |
| ---- | ---- | --- | ------ |
| agent-pipeline-reviewer | reviewer | Phase 7 (skills and `analyze-project`, which changes the content of the `CODEOPS-PROJECT` managed block in `AGENTS.md`) | AGENTS.md specialist index (required-for rule) |

No new candidate. The Fluent UI work is covered by the installed `fluentui` and `fluentui-design`
skills carried in executor packets; the local-server security surface is covered by the catalog
security reviewer with the `owasp-web` profile; the host-API unknowns are isolated in the Phase 1
spike.

_Detection evidence: AGENTS.md "Specialist agents" index (`agent-pipeline-reviewer` required for
"the AGENTS.md managed blocks"); `skills/analyze-project/SKILL.md:15-27` owns the managed section
this plan extends; no recurring review findings in this area (`plans/*/05-findings.md` hold no
Discovery-related areas); the skills `fluentui` (v9.74.7 baseline) and `fluentui-design` are
installed under `~/.config/opencode/skills/`._

## Related Files

New: `bin/lib/discovery-rules.mjs`, `bin/lib/discovery-store.mjs`, `bin/lib/discovery-server.mjs`,
`bin/lib/discovery-tools.mjs` (each with `.d.mts`), `discovery-ui/` (sources, `tsconfig.json`,
`index.html`), `scripts/build-discovery-ui.mjs`, `_shared/discovery.md`, and the spec/impl test
files listed in [07-testing-strategy.md](07-testing-strategy.md).

Changed: `plugin/index.ts`, `schemas/codeops-config.schema.json`, `package.json`,
`package-lock.json`, `.gitignore`, `_shared/zero-ambiguity-gate.md`, `skills/make-plan/SKILL.md`,
`skills/preflight/SKILL.md`, `skills/preflight/report-format.md`,
`skills/analyze-project/SKILL.md`, `plugin/tui-foundation.spec.test.mjs`,
`scripts/exec-plan-progress-content.spec.test.mjs`, `README.md`, `CHANGELOG.md`.

Depends on: the installed OpenCode v2 plugin surface (`@opencode/plugin` 2.0.26:
`ctx.tool.transform`/`reload`, `ctx.session.prompt`, `ctx.event.subscribe`, `ctx.location`) and
the Phase 1 spike outcomes (03-01).
