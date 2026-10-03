# Current State: Specialist Agents

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

CodeOps already has every mechanism this feature builds on, but no path that turns project
specialization into a standing agent:

- **Twelve fixed roles.** `scripts/install_agents.py:24-39` maps twelve role names to template
  files. The installer rejects any other role (`scripts/install_agents.py:215-219`).
- **Project-agent generation.** `install_agents.py` renders `.opencode/agents/<role>.md` from
  `agent-templates/<template>.md`, applying `model`/`effort`/`sandbox` from
  `codeops/codeops.json` (`scripts/install_agents.py:145-179`) and preserving hand-authored files
  via a first-line marker (`scripts/install_agents.py:182-187`).
- **Package installer.** `bin/install-agents.mjs` copies the packaged `agents/` into project or
  global scope, owning only files listed in `.opencode-codeops.json`; other files are skipped, so
  project specialists survive package upgrades (`bin/install-agents.mjs:176-215`).
- **Manual routing setup.** `skills/setup-routing/SKILL.md:23-45` classifies the project into
  domains and risks, proposes roles/policy, and only after confirmation generates catalog agents
  (`skills/setup-routing/SKILL.md:66-81`).
- **Domain-lens selection.** `references/domains/selection.md` is read by `make-requirements`
  (`skills/make-requirements/SKILL.md:46`), `make-plan` (`skills/make-plan/SKILL.md:62`), and
  `preflight`. Lenses produce checklists, not agents.
- **Quality profile.** `_shared/quality-profile.md:121-134` defines role resolution (project agent
  → `opencode.json` defaults → parent model) and the dynamic-packet fallback. Nothing routes a
  novel role.
- **Plan parser.** `scripts/codeops_plan.py:19-23` accepts `RD-*`, `T-\d+`, and `REQ-*` targets on
  the `> **Implements**:` line and requires at least one (`scripts/codeops_plan.py:141-143`).

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `scripts/install_agents.py` | Role→template rendering, routing overrides | Add custom-role modes, brief validation, AGENTS.md sync, `reasoning` |
| `schemas/codeops-config.schema.json` | `codeops.json` contract | Add optional `reasoning` under `routing.roles.<role>` |
| `_shared/layout-convention.md` | Canonical artifact paths | Add `codeops/specialists/` |
| `_shared/quality-profile.md` | Role resolution, dispatch, prefixes | Add specialist resolution, `SR-NNN`, fallback rules |
| `skills/make-plan/SKILL.md` + `templates.md` | Plan creation | Add detection step and index section |
| `skills/make-requirements/SKILL.md` | Requirements gathering | Add detection step and register recording |
| `skills/analyze-project/SKILL.md` | Repo analysis | Add specialization signals and recommendation |
| `skills/setup-routing/SKILL.md` + `routing.md` | Routing policy and agent generation | Add creation/removal flow; document `reasoning` |
| `skills/exec-plan/SKILL.md` + `execution-protocol.md` | Plan execution | Add selection wiring and fallback pointer |
| `scripts/codeops-migrate.sh` | Flat-to-nested migration | Preserve/refuse an existing `codeops/codeops.json` (PF-013) |
| `README.md` | User documentation | Document the specialist workflow and upgrade note |

### Code Analysis

The installer's fixed role map is the hard boundary:

```python
ROLE_TO_TEMPLATE: dict[str, str] = {
    "explorer":                    "codebase-scout",
    ...
    "semantics-reviewer":          "semantics-reviewer",
}
```

and unknown roles fail fast (`scripts/install_agents.py:216-219`). Routing policy is read from
`codeops/codeops.json` under `routing.roles` (`scripts/install_agents.py:204-210`), but the schema's
role object allows only `model`, `effort`, and `sandbox`
(`schemas/codeops-config.schema.json:36-45`), all applied at generation time.

OpenCode discovers agents from `.opencode/agents/**/*.md` and builds the model-facing agent list
from every non-primary agent, filtered only by `permission.task`; `hidden` affects UI autocomplete
only (verified against upstream source `ToolRegistry.describeTask` and
`packages/opencode/src/config/agent.ts`, fetched 2026-10-04; not verified against the installed
binary). Agent `description` is the model-visible when-to-use text. `reasoningEffort` is passed
through to the provider as a model option (upstream docs show `reasoningEffort: "high"`); OpenCode
does not validate a `none…max` enum, so acceptance is provider-dependent (PF-031).

## Gaps Identified

### Gap 1: No novel roles

**Current Behavior:** Only the twelve catalog roles can be generated; an unknown role is rejected.
**Required Behavior:** A project can define and generate a specialist role from a committed brief.
**Fix Required:** Brief schema + validation and `--custom` generation in `install_agents.py`;
two generic templates.

### Gap 2: No durable project-specialist context

**Current Behavior:** Domain knowledge is re-injected into every dispatch packet from
`references/domains/*.md` and the repository, and can erode across sessions and compaction.
**Required Behavior:** Project-specific capability, invariants, and conventions live in
`codeops/specialists/<role>.md` and are embedded into the generated agent prompt.
**Fix Required:** The brief artifact and its layout-convention entry.

### Gap 3: No detection step

**Current Behavior:** Lens selection answers "what should we think about", never "does this project
need a standing specialist".
**Required Behavior:** `make-requirements`, `make-plan`, and `analyze-project` run an evidence-based
gap check and record its outcome, proposing candidates through the Complexity Escalation Gate.
**Fix Required:** `_shared/specialist-agents.md` plus detection steps in the three skills.

### Gap 4: No discoverability or selection

**Current Behavior:** A hypothetical novel agent would not appear in any project guidance, and
`exec-plan` selects reviewers from a fixed tag table
(`skills/setup-routing/routing.md:32-42`).
**Required Behavior:** Model-visible descriptions, a generated AGENTS.md index, a plan selection
table, and explicit `exec-plan` dispatch rules with fallback.
**Fix Required:** `--sync-agents-md`, plan template section, quality-profile and exec-plan updates.

### Gap 5: No lifecycle

**Current Behavior:** The package installer can upgrade and uninstall catalog agents, but there is
no check, staleness detection, or removal for project-defined roles.
**Required Behavior:** `--check` reports missing/stale/orphan states; `--remove-custom` removes the
agent and brief after confirmation.
**Fix Required:** Installer modes plus error-handling rules.

## Dependencies

### Internal Dependencies

- `scripts/install_agents.py` and the existing marker/ownership convention.
- `_shared/quality-profile.md` resolution and packet conventions.
- `_shared/zero-ambiguity-gate.md` Complexity Escalation Gate and the Ambiguity Register.
- `references/domains/selection.md` lens selection.
- `scripts/codeops_plan.py` `Implements` grammar.

### External Dependencies

None added. Python 3.8+, Node 18+ (existing); `node --test` (existing); OpenCode current
(agent discovery, `reasoningEffort` passthrough).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Over-eager proposals create agent clutter | Med | Med | Evidence criteria, ≤2 budget, challenger, explicit approval (AR #4, #21) |
| Brief text becomes stale or contradicts repo state | Med | Med | `--check` stale detection, lifecycle review, removal path (AR #13) |
| Prompt injection through brief text or AGENTS.md | Low | High | Sanitization, caps, read-only reviewer default (AR #15, #18) |
| Provider rejects `reasoningEffort` | Med | Low | Routing override, manual model check, documented fallback (AR #19) |
| Specialist agent unavailable after creation (startup discovery) | High | Low | Planning-time creation, dynamic-packet fallback and report (AR #16) |
| Flat-layout migration mishandles `codeops/specialists/` or overwrites `codeops/codeops.json` | Low | High | Migration spec case ST-33 with an apply-mode preservation fixture; migrator guard (PF-013) |
