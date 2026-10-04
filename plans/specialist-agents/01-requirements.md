# Requirements: Specialist Agents

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **CodeOps Artifact Schema**: 1

## Feature Overview

CodeOps gains a project-specific specialist-agent capability. During requirements gathering, plan
creation, and project analysis, CodeOps checks repository evidence for a capability gap that the
twelve catalog roles and dynamic packets cannot close. When a gap exists, it presents a specialist
candidate through the existing Complexity Escalation Gate. After explicit user approval,
`setup-routing` writes a project brief under `codeops/specialists/` and the installer generates a
visible `.opencode/agents/<role>.md` from one of two generic templates. The generated agent's
description is model-visible; `setup-routing` also maintains a compact managed index in the
project's `AGENTS.md`. Plans record which specialist serves which phase, and `exec-plan` dispatches
it as an additional reviewer or executor with a dynamic-packet fallback.

This is a standalone feature: there is no upstream RD. This document is the owning requirements
document.

## Functional Requirements

### Must Have

- [ ] **R1 — Detection.** `make-requirements`, `make-plan`, and `analyze-project` run the
  evidence-based specialist-gap check defined in `_shared/specialist-agents.md`. `make-plan`
  always records the outcome in `00-index.md` (a role table or an explicit `None` with reason).
  (AR #6)
- [ ] **R2 — Proposal and authority.** A candidate is proposed with a bounded packet (capability,
  evidence with `file:line`, why existing roles and packets are insufficient, smallest
  alternative, cost, intended use). Approval reuses the Complexity Escalation Gate; `--auto-design`
  cannot approve; at most two candidates per requirements set or plan (AR #24); creation requires
  explicit user confirmation. (AR #4, AR #21, AR #24)
- [ ] **R3 — Project brief.** A specialist is defined by `codeops/specialists/<role>.md` with flat
  frontmatter (optional `schema`, `role`, `kind`, `description`, `capability`, `scope`, `evidence`,
  optional `effort`, `reasoning`, `hidden`, `required-for`) and a Markdown body. `role` matches the
  filename, `description` is mandatory and single-line, and all prompt-bound text is sanitized to
  a fixed point and length-capped. (AR #12, PF-029)
- [ ] **R4 — Generation.** `scripts/install_agents.py --custom <role>` generates a marker-owned
  `.opencode/agents/<role>.md` from `domain-specialist-reviewer` or `domain-specialist-executor`,
  chosen by `kind`, with `mode: subagent`, the brief description, `hidden: false` by default,
  reviewer permissions read-only, executor permissions writable, and routing overrides applied.
  Generation is refused for invalid names and for collisions with catalog roles, OpenCode
  built-ins, or hand-authored files. (AR #9, AR #15)
- [ ] **R5 — Reasoning default.** Generated specialists carry `reasoningEffort: max` by default
  unless the brief or routing policy overrides it. `routing.roles.<role>` gains an optional
  `reasoning` field (schema updated). The twelve catalog roles keep their current policy. (AR #10,
  AR #19)
- [ ] **R6 — AGENTS.md index.** `install_agents.py --sync-agents-md` renders a sanitized managed
  block delimited by `<!-- CODEOPS-SPECIALISTS:START -->` and
  `<!-- CODEOPS-SPECIALISTS:END -->`, listing each specialist with its description and
  optional `required-for` rule. It appends when missing, replaces only the block when present,
  removes it when no specialists exist, and refuses malformed markers. `setup-routing` is the sole
  writer; `analyze-project` preserves the block. (AR #7, AR #8, AR #14)
- [ ] **R7 — Execution use.** A plan's `00-index.md` "Specialist Agents" table maps a role to
  phases/use. `exec-plan` dispatches a listed specialist as an additional reviewer or executor;
  specialist reviewer findings use the `SR-NNN` prefix; a specialist never replaces a required
  reviewer or gate. When the agent is unavailable (for example its generated file is missing, its
  brief is invalid, or a dispatch fails), dispatch falls back to a generic subagent carrying the
  brief excerpt and reports the fallback.
  (AR #16)
- [ ] **R8 — Lifecycle.** `--check` reports missing, stale (re-render mismatch), orphaned,
  invalid-brief, and hand-authored-collision states. `--remove-custom <role> --yes` deletes the
  generated agent and the brief after confirmation, never touches hand-authored or catalog files,
  and triggers the AGENTS.md index sync; `setup-routing` drops the routing policy entry.
  (AR #11, AR #13, AR #18, PF-015, PF-021)
- [ ] **R9 — Security.** Role names are allowlisted slugs (whole-string match, platform-hostile
  names rejected); brief paths are canonicalized and rejected on traversal; symlinked agent
  directories, target files, and AGENTS.md are refused; prompt text and AGENTS.md values are
  sanitized to a marker-free fixed point and emitted as escaped YAML scalars; no secrets are read
  or written; reviewer specialists are read-only regardless of a sandbox override. (AR #15,
  AR #18, PF-006, PF-007, PF-008, PF-010, PF-025)

### Should Have

- [ ] **R10 — Documentation.** The README describes detection, creation, routing, and fallback. A
  new canonical `_shared/specialist-agents.md` is linked from the participating skills
  (`make-requirements`, `make-plan`, `analyze-project`, `setup-routing`) and
  `_shared/quality-profile.md`; `exec-plan` points at `quality-profile.md` for routing and adds no
  private copy. `_shared/layout-convention.md` records `codeops/specialists/`. (AR #8, PF-029)
- [ ] **R11 — Determinism.** Generated files use the existing plain-write pattern; `--dry-run`
  prints intended changes for every mode, always wins over `--yes`, and writes nothing.
  (PF-014, PF-026)

### Won't Have (Out of Scope)

- Outcome-metric events or automatic benefit scoring for specialists. (AR #3)
- Tag-based automatic specialist selection; selection stays explicit in the plan table. (AR #3)
- Runtime creation during `exec-plan`; detection may report a gap, but creation happens through
  `setup-routing`. (AR #3, AR #6)
- Any creation without explicit user approval. (AR #4)
- Changing reasoning defaults for the twelve catalog roles. (AR #10)
- Hot-reload machinery beyond OpenCode's native agent discovery; availability follows whatever the
  running OpenCode build provides. (AR #19, AR #27)
- A second agent registry; `codeops/specialists/` and `codeops.json` are the only owners. (AR #3)

## Technical Requirements

### Security

- Role-name allowlist: whole-string match of `[a-z][a-z0-9-]{1,40}`; reject `plan`, `build`,
  `general`, `explore`, `scout`, `compaction`, `title`, `summary`, catalog role names, DOS device
  names, trailing dot or space, path separators, `..`, absolute paths, and newline-injected
  values. (AR #15, PF-009, PF-025)
- Brief path resolution stays inside `<project>/codeops/specialists/`; reject symlink escapes.
  Symlinked `.opencode/agents/`, the target agent file, and `AGENTS.md` are refused, and removal
  unlinks the link itself. (PF-006)
- `description`, `required-for`, and frontmatter values are sanitized to a marker-free fixed
  point, length-capped, and emitted as escaped YAML scalars before entering agent frontmatter or
  AGENTS.md. (PF-007, PF-008)
- Reviewer specialists are read-only (`edit: deny`) regardless of a routing sandbox override;
  executor write access is the default template permission and the sandbox may only tighten it.
  Prompt text never includes credentials. (AR #9, AR #12, PF-010, PF-011)
- `--remove-custom` deletes only marker-verified custom files whose template marker is
  `domain-specialist-*`; catalog, built-in, and hand-authored files are refused. (AR #11, PF-005)

### Compatibility

- Flat and nested layouts: `codeops/specialists/` is project-level in both; the flat-to-nested
  migration must not move or reject it (`scripts/codeops-migrate.sh:102-106,134-152`), and it must
  preserve or refuse an existing `codeops/codeops.json` instead of overwriting it
  (`scripts/codeops-migrate.sh:297`; PF-013).
- OpenCode current release; availability follows the running build's agent discovery — the tested
  build resolves agents created mid-session, so no restart is promised or required. (AR #19, AR #27)
- Python 3.8+ and Node 18+ (existing repository requirements); no new runtime dependency.
  `scripts/install_agents.py` gains the sibling scripts' `from __future__ import annotations` so
  the documented 3.8 floor stays true. (PF-024)
- `reasoningEffort` is a provider passthrough, not an OpenCode-validated enum; the documented
  `none…max` values are constrained in the routing schema and verified manually with the active
  model. A project whose model rejects the option overrides it via routing policy. (AR #19,
  PF-031)

### Performance

No runtime performance surface: all new behavior is CLI-time generation and Markdown rendering.
`--check` re-renders briefs in memory and compares text; brief bodies are size-capped.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| Specialist kind | Catalog-only / novel specialists / OpenCode-generated | Novel specialists | Catalog roles are generic; the value is durable project-specific context | AR #5 |
| Creation authority | Recommend + approve / auto-create / report-only | Recommend + approve | Material support machinery needs user authority; auto-design excluded | AR #4 |
| Discoverability | AGENTS.md index / pointer only / none; visible vs hidden | Generated index; visible | Coding agents must know the specialist exists and when to use it | AR #7 |
| Templates | Two (reviewer/executor) / one | Two | Distinct prompt contracts and permission defaults prevent a muddled role | AR #9 |
| Reasoning | Specialists only / all agents | Specialists only | Avoids a blanket cost increase on recon and executors | AR #10 |
| Removal | Agent + brief / agent only | Agent + brief | Leaves no stale brief or routing entry behind | AR #11 |
| Complexity | Smaller (catalog-only) / larger subsystem | Larger with two trims | User approved after the visible packet and `Simplify` verdict | AR #21 |

> **Traceability:** Every scope decision references the Ambiguity Register entry that resolved it.
> See [00-ambiguity-register.md](00-ambiguity-register.md).

## Acceptance Criteria

1. [ ] `npm run verify` passes (type-check, `node --test`, version parity).
2. [ ] Spec tests were written before implementation, with a recorded red phase and green phase.
3. [ ] Every ST case in [07-testing-strategy.md](07-testing-strategy.md) passes or has a recorded,
   approved manual verification.
4. [ ] `_shared/specialist-agents.md` exists and is linked from `make-requirements`, `make-plan`,
   `analyze-project`, `setup-routing`, and `_shared/quality-profile.md`; `exec-plan` points at
   `quality-profile.md`; no `${PLUGIN_ROOT}` leaks; skill frontmatter intact.
5. [ ] The end-to-end lifecycle test `scripts/specialists-lifecycle.spec.test.mjs` passes: brief →
   generated agent → AGENTS.md block → `--check` clean → `--remove-custom --yes` restores the
   prior state.
6. [ ] No catalog agent behavior, gate, or reviewer count changes; the ST-42 regeneration
   comparison proves catalog output is unchanged; missing specialists fall back to dynamic
   packets and report the fallback.
7. [ ] No new runtime dependency is introduced.
