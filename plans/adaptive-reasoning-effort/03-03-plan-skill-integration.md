# Plan and Skill Integration: Adaptive Reasoning Effort

> **Document**: 03-03-plan-skill-integration.md
> **Parent**: [Index](00-index.md)

This document owns how the contract ([03-01](03-01-reasoning-effort-contract.md)) reaches plans
and skills, and how `exec-plan` turns a phase suggestion into a dispatch marker. Runtime details
are owned by [03-02](03-02-plugin-runtime-override.md).

## make-plan

### Phase and mini-plan suggestion line

`skills/make-plan/templates.md` adds one advisory line to the phase header template — after the
`**Lenses**` line — and the mini-plan shape in `skills/make-plan/SKILL.md` adds it to its single
header:

```markdown
> **Reasoning**: medium — bounded CRUD endpoints reusing existing patterns
```

The level and its derivation rules are owned by 03-01 §Plan suggestion derivation. `make-plan`
writes the line for every phase and every task mini-plan. The line is a suggestion: no gate reads
it, deleting it is valid, and its absence means "inherit".

### Authoring rule

While composing phases, `make-plan` applies the derivation table from `_shared/reasoning-effort.md`;
the reason is a short plain-language phrase (no AR/plan identifiers, per the documentation ban).
`skills/make-plan/SKILL.md` links to `_shared/reasoning-effort.md` instead of restating levels.

## exec-plan

### Flag parsing

`skills/exec-plan/SKILL.md` gains an option section modeled on the existing `--auto-design` /
`--explore-scope` sections; `skills/exec-plan/execution-protocol.md` gains the inline behavior.
Shared parsing and semantics are owned by 03-01 §Auto-effort option:

- Bare `--auto-effort`: apply the current phase's `Reasoning:` level; when a phase has no line, no
  session change occurs for that phase.
- `--auto-effort=<level>`: force that level for the whole run, including every dispatch marker
  composed during it.
- Absent: print the phase suggestion only.

### Dispatch packets (AR #6, #12)

Every dispatched unit — executor, correctness reviewer, security/perf/concurrency/financial/
semantics auditor, spec-test author, specialist, and codebase-scout — receives one standalone
marker line in its packet (the complexity-gate design challenger is excluded; its independence
contract is unchanged):

```text
[codeops-effort: medium]
```

Placement: immediately after the `[codeops-dispatch …]` header for quality agents
(`_shared/quality-profile.md` §Dispatch packets), or as the first line for packets that have no
header. The level resolves as:

1. the run's forced `--auto-effort=<level>` when present, else the phase's `Reasoning:` line when
   present;
2. otherwise no marker is added — the plugin still applies a routing role default if the project
   configured one (03-01 §Precedence);
3. otherwise the child inherits the parent variant.

The marker is part of the packet, so the executor sees it as context; it is never cited in shipped
code comments (the existing documentation ban already forbids plan identifiers in code).

### Reporting

For every dispatch the parent reports the applied level and its source in the dispatch commentary,
for example `Dispatch: executor — reasoning: medium (phase suggestion)`, or
`— reasoning: high (routing default)`, or `— inherited`. Reporting is observational; it never
gates the dispatch.

### Inline phases (AR #6)

When a phase runs inline (the default per `execution-protocol.md` §Execution mode):

1. Print `Suggested reasoning: <level> — <reason>` before the phase's first task.
2. Without `--auto-effort`, do nothing else — the session keeps its own variant.
3. With `--auto-effort`, set the session level through
   `python3 "${CODEOPS_PLUGIN_ROOT}/scripts/codeops_effort.py" set --dir "$CODEOPS_TMPDIR" --reasoning <level>`
   and update it when the next phase's suggestion differs; `clear` at session wrap-up.
4. If `$CODEOPS_TMPDIR` is empty or the helper fails, print the advise-only note and continue.

Effort is never a dispatch-selection criterion: the existing rules in
`execution-protocol.md` §Execution mode (inline first, dispatch a bounded phase when justified)
are unchanged.

## Skills that accept `--auto-effort` (AR #5, #7)

Each of these adds one short option section that announces the mode and links to
`_shared/reasoning-effort.md` for the shared contract, parsing rules, and that skill's recommended
level (03-01 §Skill recommendation table):

| Skill | File |
| ----- | ---- |
| make-requirements | `skills/make-requirements/SKILL.md` |
| make-plan | `skills/make-plan/SKILL.md` |
| preflight | `skills/preflight/SKILL.md` |
| grill-me | `skills/grill-me/SKILL.md` |
| exec-plan | `skills/exec-plan/SKILL.md` |
| retro-requirements | `skills/retro-requirements/SKILL.md` |
| upgrade-plan | `skills/upgrade-plan/SKILL.md` |

The section shape (each skill substitutes its own recommended level from 03-01 §Skill
recommendation table):

```markdown
## Auto-effort option

If `$ARGUMENTS` contains exactly one exact standalone `--auto-effort` or `--auto-effort=<level>`
token before the first `--` sentinel, remove it before resolving targets, paths, or modes; zero
occurrences means this skill's recommended level from 03-01 §Skill recommendation table is printed
as a suggestion only, more than one or an invalid level is an argument error; announce
`Auto-effort active — reasoning <level> applied for this run`; then read and apply
[../../_shared/reasoning-effort.md](../../_shared/reasoning-effort.md)
§Auto-effort option. The run clears the level before its final summary.
```

## Documentation

| Artifact | Change |
| -------- | ------ |
| `_shared/reasoning-effort.md` (new) | Shipped restatement of 03-01: levels, marker grammar, precedence, skill table, derivation, auto-effort semantics, suggestion-only guarantee |
| `skills/setup-routing/routing.md` | New "Reasoning effort policy" subsection: the four levels, how routing defaults interact with markers and session flags, and deepseek flash guidance (`low/medium/high/max`) |
| `skills/setup-routing/SKILL.md` | Mention reasoning defaults in the proposal output and link the policy subsection |
| `_shared/quality-profile.md` | §Model, effort, and agent resolution links to `_shared/reasoning-effort.md` for the runtime override; the static resolution order is unchanged |
| `README.md` | "Adaptive reasoning effort" subsection under "Agent model configuration": marker example, `--auto-effort`, precedence |

## Out of Scope Here

`install_agents.py` defaults, agent templates, the config schema, and model pins are unchanged
(AR #17). `CHANGELOG.md` and `package.json` are owned by `scripts/release.mjs` and are never edited
by plan tasks (AR #23).
